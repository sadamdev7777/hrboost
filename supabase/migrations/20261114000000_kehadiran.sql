-- =====================================================================
--  Fasa E: Kehadiran, Pembetulan Masa, Integrasi Kehadiran (CrossChex Cloud)
--  Rahsia CrossChex (kunci API, rahsia, token) disimpan dalam Supabase Vault sahaja.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Kalendar kehadiran bulanan seorang pekerja (skrin Kehadiran / ProfilPekerja)
-- ---------------------------------------------------------------------
create or replace function attendance_month(p_employment uuid, p_from date, p_to date)
returns table(work_date date, working_day boolean, clock_in timestamptz, clock_out timestamptz,
              late_minutes int, source text, leave_code text, holiday text,
              correction_status request_status, correction_request uuid)
language plpgsql stable security definer set search_path = public as $$
declare e employments; tz text; hari_ini date;
begin
  select * into e from employments where id = p_employment;
  if e.id is null or not can_view_employment(e.id) then raise exception 'Tidak dibenarkan'; end if;
  select timezone into tz from companies where id = e.company_id;
  hari_ini := (now() at time zone tz)::date;
  return query
  select d::date,
         is_working_day(e.company_id, d::date, e.work_state),
         a.clock_in, a.clock_out, coalesce(a.late_minutes, 0), a.source,
         (select lt.code from leave_requests lr join leave_types lt on lt.id = lr.leave_type_id
           where lr.employment_id = e.id and lr.status = 'approved' and d::date between lr.start_date and lr.end_date limit 1),
         (select h.name from company_holidays(e.company_id, d::date, d::date) h limit 1),
         (select c.status from attendance_corrections c where c.employment_id = e.id and c.work_date = d::date
           and c.status in ('pending','approved','rejected','returned') order by c.created_at desc limit 1),
         (select c.approval_request_id from attendance_corrections c where c.employment_id = e.id and c.work_date = d::date
           order by c.created_at desc limit 1)
    from generate_series(greatest(p_from, e.join_date), least(p_to, hari_ini, coalesce(e.end_date, p_to)), interval '1 day') d
    left join attendance_records a on a.employment_id = e.id and a.work_date = d::date
   order by d desc;
end $$;

-- ---------------------------------------------------------------------
-- 2. Semakan permohonan pembetulan masa
-- ---------------------------------------------------------------------
create or replace function trg_attendance_correction_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare tz text;
begin
  select c.timezone into tz from employments e join companies c on c.id = e.company_id where e.id = new.employment_id;
  if new.work_date > (now() at time zone tz)::date then raise exception 'Tarikh pembetulan tidak boleh pada masa hadapan'; end if;
  if new.work_date < (now() at time zone tz)::date - 31 then raise exception 'Pembetulan hanya untuk 31 hari terakhir'; end if;
  if new.requested_clock_in is null and new.requested_clock_out is null then raise exception 'Sila isi masa masuk atau keluar'; end if;
  if new.requested_clock_in is not null and new.requested_clock_out is not null
     and new.requested_clock_out <= new.requested_clock_in then
    raise exception 'Masa keluar mesti selepas masa masuk';
  end if;
  if coalesce(trim(new.reason), '') = '' then raise exception 'Sila nyatakan sebab'; end if;
  if exists (select 1 from attendance_corrections where employment_id = new.employment_id
              and work_date = new.work_date and status = 'pending' and id <> new.id) then
    raise exception 'Pembetulan untuk tarikh ini sedang menunggu kelulusan';
  end if;
  return new;
end $$;
drop trigger if exists attendance_correction_check on attendance_corrections;
create trigger attendance_correction_check before insert on attendance_corrections
  for each row execute function trg_attendance_correction_check();

-- ---------------------------------------------------------------------
-- 3. Tetapan integrasi kehadiran (satu bagi setiap syarikat)
-- ---------------------------------------------------------------------
create table if not exists attendance_integrations (
  company_id        uuid primary key references companies(id) on delete cascade,
  provider          text not null default 'crosschex' check (provider in ('crosschex')),
  api_url           text not null default 'https://api.eu.crosschexcloud.com',
  sync_minutes      int not null default 5 check (sync_minutes in (5, 15, 30)),
  active            boolean not null default true,
  key_secret_id     uuid,       -- vault.secrets
  secret_secret_id  uuid,       -- vault.secrets
  token_secret_id   uuid,       -- vault.secrets (token semasa, diperbaharui automatik)
  next_run_at       timestamptz not null default now(),
  updated_by        uuid references persons(id),
  updated_at        timestamptz not null default now()
);
alter table attendance_integrations enable row level security;
-- Tiada polisi: hanya dibaca melalui RPC (id rahsia tidak didedahkan kepada pelayar).

create table if not exists integration_sync_log (
  id          bigint generated always as identity primary key,
  company_id  uuid not null references companies(id) on delete cascade,
  provider    text not null,
  ok          boolean not null,
  message     text not null,
  records     int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists integration_sync_log_company on integration_sync_log(company_id, created_at desc);
alter table integration_sync_log enable row level security;
drop policy if exists read_hr on integration_sync_log;
create policy read_hr on integration_sync_log for select using (has_role(company_id, '{hr,admin}'));

-- Simpan / tukar kunci. Kosongkan p_key / p_secret untuk mengekalkan nilai sedia ada.
create or replace function set_attendance_integration(p_company uuid, p_api_url text, p_key text,
                                                      p_secret text, p_minutes int default 5, p_active boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare r attendance_integrations; nm text;
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Hanya HR/Pentadbir'; end if;
  if p_api_url !~ '^https://[a-z0-9.-]+(\.crosschexcloud\.com)(/.*)?$' then
    raise exception 'URL API mesti alamat crosschexcloud.com (https)';
  end if;
  if not exists (select 1 from pg_extension where extname = 'supabase_vault') then
    raise exception 'Vault tidak tersedia';
  end if;
  select * into r from attendance_integrations where company_id = p_company for update;
  if r.company_id is null then
    if coalesce(p_key, '') = '' or coalesce(p_secret, '') = '' then raise exception 'Sila isi kunci dan rahsia API'; end if;
    insert into attendance_integrations(company_id, api_url) values (p_company, p_api_url) returning * into r;
  end if;
  nm := 'crosschex:' || p_company;
  if coalesce(p_key, '') <> '' then
    if r.key_secret_id is null then
      execute 'select vault.create_secret($1, $2)' into r.key_secret_id using trim(p_key), nm || ':key';
    else
      execute 'select vault.update_secret($1, $2)' using r.key_secret_id, trim(p_key);
    end if;
  end if;
  if coalesce(p_secret, '') <> '' then
    if r.secret_secret_id is null then
      execute 'select vault.create_secret($1, $2)' into r.secret_secret_id using trim(p_secret), nm || ':secret';
    else
      execute 'select vault.update_secret($1, $2)' using r.secret_secret_id, trim(p_secret);
    end if;
  end if;
  update attendance_integrations
     set api_url = rtrim(p_api_url, '/'), sync_minutes = coalesce(p_minutes, 5), active = coalesce(p_active, true),
         key_secret_id = r.key_secret_id, secret_secret_id = r.secret_secret_id,
         -- kunci baharu: token lama tidak lagi sah
         token_secret_id = case when coalesce(p_key, '') <> '' or coalesce(p_secret, '') <> '' then null else token_secret_id end,
         next_run_at = now(), updated_by = current_person_id(), updated_at = now()
   where company_id = p_company;
  insert into integration_sync_state(company_id, provider) values (p_company, 'crosschex')
  on conflict (company_id, provider) do nothing;
  perform emit_event(p_company, 'settings.attendance_integration', current_person_id(), null,
                     jsonb_build_object('keys_changed', coalesce(p_key, '') <> '' or coalesce(p_secret, '') <> ''));
end $$;

-- Status untuk skrin IntegrasiKehadiran (tanpa rahsia)
create or replace function attendance_integration_status(p_company uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when has_role(p_company, '{hr,admin}') then jsonb_build_object(
    'configured', i.company_id is not null and i.key_secret_id is not null,
    'api_url', coalesce(i.api_url, 'https://api.eu.crosschexcloud.com'),
    'sync_minutes', coalesce(i.sync_minutes, 5),
    'active', coalesce(i.active, false),
    'token_valid', s.token_expires_at > now() and i.token_secret_id is not null,
    'last_synced_at', s.last_synced_at,
    'last_error', s.last_error,
    'next_run_at', i.next_run_at,
    'employees', (select count(*) from employments where company_id = p_company and status in ('probation','active')),
    'matched', (select count(*) from employments where company_id = p_company and status in ('probation','active')
                  and attendance_workno is not null),
    'unmatched', coalesce((select jsonb_agg(jsonb_build_object('workno', workno, 'punches', n, 'last', last) order by last desc)
                   from (select workno, count(*) n, max(punched_at) last from attendance_punches
                          where company_id = p_company and employment_id is null group by workno) u), '[]'),
    'log', coalesce((select jsonb_agg(jsonb_build_object('ok', ok, 'message', message, 'records', records, 'at', created_at)
                       order by created_at desc)
                  from (select * from integration_sync_log where company_id = p_company order by created_at desc limit 6) l), '[]')
  ) end
    from (select p_company as cid) x
    left join attendance_integrations i on i.company_id = x.cid
    left join integration_sync_state s on s.company_id = x.cid and s.provider = 'crosschex'
$$;

-- HR minta tarikan segera ("Tarik sekarang")
create or replace function request_attendance_sync(p_company uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Hanya HR/Pentadbir'; end if;
  update attendance_integrations set next_run_at = now() where company_id = p_company;
  if not found then raise exception 'Integrasi belum disediakan'; end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. Untuk Edge Function crosschex-sync sahaja (service role)
-- ---------------------------------------------------------------------
create or replace function crosschex_targets(p_company uuid default null, p_force boolean default false)
returns table(company_id uuid, api_url text, api_key text, api_secret text, token text,
              token_expires_at timestamptz, last_synced_at timestamptz, timezone text)
language plpgsql security definer set search_path = public as $$
begin
  if not is_service_role() then raise exception 'Tidak dibenarkan'; end if;
  return query execute $q$
    select i.company_id, i.api_url,
           (select decrypted_secret from vault.decrypted_secrets where id = i.key_secret_id),
           (select decrypted_secret from vault.decrypted_secrets where id = i.secret_secret_id),
           (select decrypted_secret from vault.decrypted_secrets where id = i.token_secret_id),
           s.token_expires_at, s.last_synced_at, c.timezone
      from attendance_integrations i
      join companies c on c.id = i.company_id and c.status = 'active'
      left join integration_sync_state s on s.company_id = i.company_id and s.provider = 'crosschex'
     where i.active and i.key_secret_id is not null and i.secret_secret_id is not null
       and ($1 is null or i.company_id = $1)
       and ($2 or i.next_run_at <= now())
  $q$ using p_company, p_force;
end $$;

create or replace function crosschex_mark(p_company uuid, p_ok boolean, p_message text, p_records int default 0,
                                          p_synced_to timestamptz default null, p_token text default null,
                                          p_token_expires timestamptz default null)
returns void language plpgsql security definer set search_path = public as $$
declare r attendance_integrations;
begin
  if not is_service_role() then raise exception 'Tidak dibenarkan'; end if;
  select * into r from attendance_integrations where company_id = p_company for update;
  if p_token is not null then
    if r.token_secret_id is null then
      execute 'select vault.create_secret($1, $2)' into r.token_secret_id using p_token, 'crosschex:' || p_company || ':token';
    else
      execute 'select vault.update_secret($1, $2)' using r.token_secret_id, p_token;
    end if;
  end if;
  update attendance_integrations
     set token_secret_id = r.token_secret_id,
         next_run_at = now() + make_interval(mins => r.sync_minutes)
   where company_id = p_company;
  insert into integration_sync_state(company_id, provider, last_synced_at, token_expires_at, last_error, updated_at)
  values (p_company, 'crosschex', case when p_ok then p_synced_to end, p_token_expires,
          case when p_ok then null else p_message end, now())
  on conflict (company_id, provider) do update
     set last_synced_at = coalesce(case when p_ok then excluded.last_synced_at end, integration_sync_state.last_synced_at),
         token_expires_at = coalesce(excluded.token_expires_at, integration_sync_state.token_expires_at),
         last_error = case when p_ok then null else p_message end,
         updated_at = now();
  insert into integration_sync_log(company_id, provider, ok, message, records)
  values (p_company, 'crosschex', p_ok, left(p_message, 300), coalesce(p_records, 0));
  delete from integration_sync_log where company_id = p_company
     and id not in (select id from integration_sync_log where company_id = p_company order by id desc limit 200);
end $$;

-- Pengguna boleh menguruskan integrasi (Edge Function semak sebelum ujian / tarik manual)
create or replace function can_manage_attendance(p_company uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select has_role(p_company, '{hr,admin}')
$$;

-- Kebenaran fungsi
do $$
declare f text;
begin
  foreach f in array array[
    'attendance_month(uuid, date, date)', 'set_attendance_integration(uuid, text, text, text, int, boolean)',
    'attendance_integration_status(uuid)', 'request_attendance_sync(uuid)', 'can_manage_attendance(uuid)'] loop
    execute format('revoke execute on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function %s from anon', f);
      execute format('grant execute on function %s to authenticated, service_role', f);
    end if;
  end loop;
  foreach f in array array['crosschex_targets(uuid, boolean)',
                           'crosschex_mark(uuid, boolean, text, int, timestamptz, text, timestamptz)'] loop
    execute format('revoke execute on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function %s from anon, authenticated', f);
      execute format('grant execute on function %s to service_role', f);
    end if;
  end loop;
  execute 'revoke execute on function trg_attendance_correction_check() from public';
end $$;

-- ---------------------------------------------------------------------
-- 5. Rekod yang dibetulkan (diluluskan) tidak ditulis ganti oleh imbasan CrossChex
--    seterusnya (rebuild_attendance_day melangkau source = 'correction').
-- ---------------------------------------------------------------------
create or replace function trg_attendance_correction_approved() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    update attendance_records set source = 'correction'
     where employment_id = new.employment_id and work_date = new.work_date;
  end if;
  return new;
end $$;
drop trigger if exists attendance_correction_approved on attendance_corrections;
create trigger attendance_correction_approved after update of status on attendance_corrections
  for each row execute function trg_attendance_correction_approved();
revoke execute on function trg_attendance_correction_approved() from public;
