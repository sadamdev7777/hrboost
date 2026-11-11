-- =====================================================================
--  QuickBooks Online: sambungan OAuth & penyegerakan (Edge Functions qbo-oauth & accounting-sync)
--  • Tuntutan diluluskan → Bill (pembekal = pekerja) mengikut akaun jenis tuntutan.
--  • Gaji diluluskan → Journal Entry mengikut peta akaun GL (Tetapan Gaji).
--  Token muat semula (refresh token) disimpan dalam Supabase Vault — tidak pernah dipaparkan di UI.
--  Semua fungsi di bawah (kecuali qbo_connect_start / qbo_disconnect / accounting_retry) untuk service role sahaja.
-- =====================================================================

-- Keadaan OAuth sementara (10 minit) — menghalang CSRF pada pautan balik Intuit
create table if not exists qbo_oauth_states (
  state       text primary key,
  company_id  uuid not null references companies(id) on delete cascade,
  person_id   uuid not null references persons(id) on delete cascade,
  expires_at  timestamptz not null default now() + interval '10 minutes'
);
alter table qbo_oauth_states enable row level security;

-- Sandaran jika Vault tiada (ujian tempatan sahaja): jadual tanpa polisi RLS, service role sahaja
create table if not exists integration_credentials (
  company_id  uuid not null references companies(id) on delete cascade,
  provider    text not null,
  vault_id    uuid,
  secret      text,
  updated_at  timestamptz not null default now(),
  primary key (company_id, provider)
);
alter table integration_credentials enable row level security;

create or replace function qbo_connect_start(p_company uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare s text := encode(gen_random_bytes(24), 'hex');
begin
  if not has_role(p_company, '{finance,admin}') then raise exception 'Hanya Kewangan/Pentadbir'; end if;
  delete from qbo_oauth_states where expires_at < now();
  insert into qbo_oauth_states(state, company_id, person_id) values (s, p_company, current_person_id());
  return s;
end $$;

create or replace function qbo_connect_finish(p_state text) returns uuid
language plpgsql security definer set search_path = public as $$
declare st qbo_oauth_states;
begin
  delete from qbo_oauth_states where state = p_state returning * into st;
  if st.state is null or st.expires_at < now() then raise exception 'Pautan sambungan tamat tempoh. Sila cuba semula.'; end if;
  return st.company_id;
end $$;

-- Simpan / baca kelayakan (refresh token + realm). Vault jika ada.
create or replace function integration_secret_set(p_company uuid, p_provider text, p_secret text) returns void
language plpgsql security definer set search_path = public as $$
declare v uuid; nama text := 'hrboost:' || p_provider || ':' || p_company;
begin
  select vault_id into v from integration_credentials where company_id = p_company and provider = p_provider;
  if exists (select 1 from pg_namespace where nspname = 'vault') then
    if v is null then
      execute 'select vault.create_secret($1, $2)' into v using p_secret, nama;
    else
      execute 'select vault.update_secret($1, $2)' using v, p_secret;
    end if;
    insert into integration_credentials(company_id, provider, vault_id, secret, updated_at) values (p_company, p_provider, v, null, now())
    on conflict (company_id, provider) do update set vault_id = excluded.vault_id, secret = null, updated_at = now();
  else
    insert into integration_credentials(company_id, provider, secret, updated_at) values (p_company, p_provider, p_secret, now())
    on conflict (company_id, provider) do update set secret = excluded.secret, updated_at = now();
  end if;
end $$;

create or replace function integration_secret_get(p_company uuid, p_provider text) returns text
language plpgsql security definer set search_path = public as $$
declare r integration_credentials; s text;
begin
  select * into r from integration_credentials where company_id = p_company and provider = p_provider;
  if r.vault_id is not null then
    execute 'select decrypted_secret from vault.decrypted_secrets where id = $1' into s using r.vault_id;
    return s;
  end if;
  return r.secret;
end $$;

create or replace function qbo_disconnect(p_company uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not has_role(p_company, '{finance,admin}') then raise exception 'Hanya Kewangan/Pentadbir'; end if;
  delete from integration_credentials where company_id = p_company and provider = 'quickbooks' returning vault_id into v;
  if v is not null then execute 'delete from vault.secrets where id = $1' using v; end if;
  update companies set accounting_config = accounting_config - 'realm_id' - 'connected_at' where id = p_company;
  insert into integration_sync_state(company_id, provider, last_error, updated_at) values (p_company, 'quickbooks', null, now())
  on conflict (company_id, provider) do update set last_error = null, updated_at = now();
end $$;

-- Cuba semula rekod yang gagal (Kewangan)
create or replace function accounting_retry(p_company uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not has_role(p_company, '{finance,admin}') then raise exception 'Hanya Kewangan/Pentadbir'; end if;
  update accounting_sync_queue set status = 'pending', attempts = 0, error = null
   where company_id = p_company and status = 'failed';
  get diagnostics n = row_count;
  return n;
end $$;

-- Ambil kerja seterusnya (kunci baris supaya dua pekerja tidak memproses rekod sama)
create or replace function accounting_queue_next(p_limit int default 20)
returns table(id uuid, company_id uuid, entity_type text, entity_id uuid, attempts int)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with x as (
    select q.id from accounting_sync_queue q join companies c on c.id = q.company_id
     where q.system = 'quickbooks' and c.status = 'active' and c.accounting_system = 'quickbooks'
       and (q.status = 'pending' or (q.status = 'failed' and q.attempts < 5 and q.created_at > now() - interval '14 days'))
     order by q.created_at limit p_limit for update of q skip locked
  )
  update accounting_sync_queue q set attempts = q.attempts + 1 from x where q.id = x.id
  returning q.id, q.company_id, q.entity_type, q.entity_id, q.attempts;
end $$;

create or replace function accounting_queue_done(p_id uuid, p_ok boolean, p_ref text, p_error text) returns void
language plpgsql security definer set search_path = public as $$
declare q accounting_sync_queue;
begin
  update accounting_sync_queue set status = case when p_ok then 'success' else 'failed' end::sync_status,
         external_ref = coalesce(p_ref, external_ref), error = case when p_ok then null else left(p_error, 500) end,
         synced_at = case when p_ok then now() else synced_at end
   where id = p_id returning * into q;
  insert into integration_sync_state(company_id, provider, last_synced_at, last_error, updated_at)
  values (q.company_id, 'quickbooks', case when p_ok then now() end, case when p_ok then null else left(p_error, 300) end, now())
  on conflict (company_id, provider) do update
    set last_synced_at = coalesce(excluded.last_synced_at, integration_sync_state.last_synced_at),
        last_error = excluded.last_error, updated_at = now();
end $$;

-- Data Bill bagi satu tuntutan diluluskan
create or replace function accounting_claim_bill(p_claim uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'claim_id', cl.id, 'title', cl.title, 'total', cl.total_amount,
    'vendor_name', left(p.full_name || ' (' || e.employee_no || ')', 100),
    'employee_no', e.employee_no,
    'txn_date', coalesce((r.completed_at at time zone 'Asia/Kuala_Lumpur')::date, current_date),
    'default_account', c.gl_accounts->>'claims_expense',
    'lines', (select coalesce(jsonb_agg(jsonb_build_object(
                'account', nullif(ct.account_ref, ''), 'type', ct.name,
                'description', left(concat_ws(' · ', ct.name, nullif(i.description, ''), to_char(i.expense_date, 'DD/MM/YYYY')), 400),
                'amount', i.amount) order by i.expense_date), '[]')
                from claim_items i join claim_types ct on ct.id = i.claim_type_id where i.claim_id = cl.id))
  from claims cl join employments e on e.id = cl.employment_id join persons p on p.id = e.person_id
  join companies c on c.id = e.company_id left join approval_requests r on r.id = cl.approval_request_id
  where cl.id = p_claim
$$;

-- Jurnal gaji (sama seperti eksport GL dalam Proses Gaji) sebagai baris JSON
create or replace function accounting_payroll_journal(p_run uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r payroll_runs; c companies; out jsonb;
begin
  select * into r from payroll_runs where id = p_run;
  select * into c from companies where id = r.company_id;
  with l as (
    select l.component_code, l.kind, sum(l.amount) amt from payslip_lines l join payslips s on s.id = l.payslip_id
     where s.payroll_run_id = r.id group by 1, 2
  ), akaun as (
    select coalesce(nullif(pc.account_ref, ''), case when l.kind = 'earning' then coalesce(c.gl_accounts->>'salary_expense', 'Gaji & Upah') else 'Potongan gaji' end) acc,
           case when l.kind = 'earning' then l.amt else 0 end dr, case when l.kind = 'deduction' and l.component_code not in ('EPF','SOCSO','EIS','SKBBK','PCB','ZAKAT','CP38','UNPAID') then l.amt else 0 end cr
      from l left join pay_components pc on pc.company_id = r.company_id and pc.code = l.component_code
     where l.kind in ('earning','deduction') and l.component_code not in ('EPF','SOCSO','EIS','SKBBK','PCB','ZAKAT','CP38')
    union all select coalesce(c.gl_accounts->>'salary_expense', 'Gaji & Upah'), 0, coalesce((select amt from l where component_code = 'UNPAID'), 0)
    union all select coalesce(c.gl_accounts->>'employer_expense', 'Caruman majikan'), coalesce((select sum(amt) from l where kind = 'employer'), 0), 0
    union all select coalesce(c.gl_accounts->>'epf_payable', 'KWSP perlu dibayar'), 0, coalesce((select sum(amt) from l where component_code in ('EPF','EPF_ER')), 0)
    union all select coalesce(c.gl_accounts->>'socso_payable', 'PERKESO & SIP perlu dibayar'), 0, coalesce((select sum(amt) from l where component_code in ('SOCSO','SOCSO_ER','EIS','EIS_ER','SKBBK')), 0)
    union all select coalesce(c.gl_accounts->>'pcb_payable', 'PCB perlu dibayar'), 0, coalesce((select sum(amt) from l where component_code in ('PCB','CP38')), 0)
    union all select coalesce(c.gl_accounts->>'zakat_payable', 'Zakat perlu dibayar'), 0, coalesce((select sum(amt) from l where component_code = 'ZAKAT'), 0)
    union all select coalesce(c.gl_accounts->>'hrdf_payable', 'Levi HRD Corp perlu dibayar'), 0, coalesce((select sum(amt) from l where component_code = 'HRDF'), 0)
    union all select coalesce(c.gl_accounts->>'net_payable', 'Gaji bersih perlu dibayar'), 0, (select coalesce(sum(net), 0) from payslips where payroll_run_id = r.id)
  )
  select jsonb_build_object(
           'run_id', r.id,
           'txn_date', coalesce(r.pay_date, (make_date(r.period_year, r.period_month, 1) + interval '1 month - 1 day')::date),
           'memo', 'Gaji ' || to_char(make_date(r.period_year, r.period_month, 1), 'MM/YYYY') || case when r.cycle_no > 1 then ' (kitaran ' || r.cycle_no || ')' else '' end,
           'doc_number', 'HRB-' || r.period_year || lpad(r.period_month::text, 2, '0') || '-' || r.cycle_no,
           'lines', coalesce(jsonb_agg(jsonb_build_object('account', acc, 'debit', dr, 'credit', cr) order by dr desc, acc), '[]'))
    into out
    from (select acc, sum(dr) dr, sum(cr) cr from akaun group by acc having sum(dr) <> 0 or sum(cr) <> 0) z;
  return out;
end $$;

-- Status sambungan untuk halaman Integrasi Akaun (tanpa rahsia)
create or replace function qbo_status(p_company uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not has_role(p_company, '{hr,finance,admin}') then null else jsonb_build_object(
    'connected', exists (select 1 from integration_credentials where company_id = p_company and provider = 'quickbooks'),
    'realm_id', (select accounting_config->>'realm_id' from companies where id = p_company),
    'connected_at', (select accounting_config->>'connected_at' from companies where id = p_company),
    'last_synced_at', (select last_synced_at from integration_sync_state where company_id = p_company and provider = 'quickbooks'),
    'last_error', (select last_error from integration_sync_state where company_id = p_company and provider = 'quickbooks'),
    'pending', (select count(*) from accounting_sync_queue where company_id = p_company and status = 'pending'),
    'failed', (select count(*) from accounting_sync_queue where company_id = p_company and status = 'failed'),
    'synced', (select count(*) from accounting_sync_queue where company_id = p_company and status = 'success')) end
$$;

do $$
declare f text;
begin
  foreach f in array array['qbo_connect_finish(text)','integration_secret_set(uuid,text,text)','integration_secret_get(uuid,text)',
                           'accounting_queue_next(int)','accounting_queue_done(uuid,boolean,text,text)','accounting_claim_bill(uuid)',
                           'accounting_payroll_journal(uuid)'] loop
    execute 'revoke all on function ' || f || ' from public';
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute 'revoke all on function ' || f || ' from anon, authenticated';
      execute 'grant execute on function ' || f || ' to service_role';
    end if;
  end loop;
  foreach f in array array['qbo_connect_start(uuid)','qbo_disconnect(uuid)','accounting_retry(uuid)','qbo_status(uuid)'] loop
    execute 'revoke all on function ' || f || ' from public';
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute 'revoke all on function ' || f || ' from anon';
      execute 'grant execute on function ' || f || ' to authenticated';
    end if;
  end loop;
  -- accounting-sync setiap 10 minit (pg_net memanggil Edge Function; URL & kunci dari Vault — ditetapkan semasa pemasangan)
end $$;
