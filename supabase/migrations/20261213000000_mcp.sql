-- =====================================================================
--  Sambungan AI (MCP): Claude / pembantu AI lain disambungkan kepada HRBoost sebagai pengguna itu sendiri.
--   - Token peribadi (hanya hash SHA-256 disimpan), boleh dibatalkan, tamat dalam 1 tahun.
--   - mcp_call(token, alat, argumen) mengesahkan token, kemudian menjalankan alat sebagai pengguna itu:
--     semua semakan peranan (has_role, aliran kelulusan) kekal terpakai. Tiada lulus automatik.
--   - Maklumat sensitif (no. kad pengenalan, akaun bank, gaji individu orang lain) TIDAK didedahkan kepada AI.
--   - Setiap panggilan direkodkan (mcp_call_log). Had 60 panggilan seminit bagi setiap token.
-- =====================================================================

create table if not exists mcp_tokens (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references persons(id) on delete cascade,
  company_id    uuid not null references companies(id) on delete cascade,
  name          text not null check (length(trim(name)) between 1 and 60),
  token_hash    text not null unique,
  token_hint    text not null,                      -- 4 aksara terakhir untuk dikenali
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '1 year',
  last_used_at  timestamptz,
  revoked_at    timestamptz
);
create index if not exists mcp_tokens_person on mcp_tokens(person_id);
alter table mcp_tokens enable row level security;
drop policy if exists mcp_tokens_own on mcp_tokens;
create policy mcp_tokens_own on mcp_tokens for select to authenticated using (person_id = current_person_id());

create table if not exists mcp_call_log (
  id         bigint generated always as identity primary key,
  token_id   uuid not null references mcp_tokens(id) on delete cascade,
  tool       text not null,
  ok         boolean not null,
  error      text,
  at         timestamptz not null default now()
);
create index if not exists mcp_call_log_token on mcp_call_log(token_id, at desc);
alter table mcp_call_log enable row level security;
drop policy if exists mcp_log_own on mcp_call_log;
create policy mcp_log_own on mcp_call_log for select to authenticated
  using (exists (select 1 from mcp_tokens t where t.id = token_id and t.person_id = current_person_id()));

-- Cipta token: dipaparkan SEKALI sahaja
create or replace function mcp_token_create(p_company uuid, p_name text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me uuid := current_person_id(); tok text; tid uuid;
begin
  if me is null then raise exception 'Sila log masuk dahulu'; end if;
  if not exists (select 1 from employments where person_id = me and company_id = p_company and status in ('probation','active')) then
    raise exception 'Tidak dibenarkan';
  end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Sila namakan sambungan ini (cth. Claude di komputer pejabat)'; end if;
  if (select count(*) from mcp_tokens where person_id = me and revoked_at is null and expires_at > now()) >= 10 then
    raise exception 'Maksimum 10 sambungan aktif. Batalkan sambungan lama dahulu.';
  end if;
  tok := 'hrb_' || translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into mcp_tokens(person_id, company_id, name, token_hash, token_hint)
  values (me, p_company, left(trim(p_name), 60), encode(digest(tok, 'sha256'), 'hex'), right(tok, 4)) returning id into tid;
  return jsonb_build_object('id', tid, 'token', tok);
end $$;

create or replace function mcp_token_list(p_company uuid)
returns table(id uuid, name text, token_hint text, created_at timestamptz, expires_at timestamptz, last_used_at timestamptz, calls_30d bigint)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, t.token_hint, t.created_at, t.expires_at, t.last_used_at,
         (select count(*) from mcp_call_log l where l.token_id = t.id and l.at > now() - interval '30 days')
    from mcp_tokens t
   where t.person_id = current_person_id() and t.company_id = p_company and t.revoked_at is null and t.expires_at > now()
   order by t.created_at desc
$$;

create or replace function mcp_token_revoke(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update mcp_tokens set revoked_at = now() where id = p_id and person_id = current_person_id() and revoked_at is null;
  if not found then raise exception 'Sambungan tidak dijumpai'; end if;
end $$;

-- ---------------------------------------------------------------------
--  Pintu masuk alat MCP (dipanggil oleh /api/mcp dengan kunci anon)
-- ---------------------------------------------------------------------
create or replace function mcp_call(p_token text, p_tool text, p_args jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  t mcp_tokens; p persons; e employments; c companies; out jsonb; a jsonb := coalesce(p_args, '{}');
  hr boolean; kewangan boolean; d0 date; d1 date; tahun int; bulan int; lt leave_types; lr leave_requests;
  task approval_tasks; rq approval_requests; tindakan text; kata text;
begin
  select * into t from mcp_tokens where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if t.id is null or t.revoked_at is not null or t.expires_at < now() then raise exception 'Token tidak sah atau telah dibatalkan'; end if;
  select * into p from persons where id = t.person_id and is_active;
  select * into c from companies where id = t.company_id and status = 'active';
  select * into e from employments where person_id = t.person_id and company_id = t.company_id and status in ('probation','active') limit 1;
  if p.id is null or c.id is null or e.id is null then raise exception 'Akaun atau syarikat tidak aktif'; end if;
  if (select count(*) from mcp_call_log where token_id = t.id and at > now() - interval '1 minute') >= 60 then
    raise exception 'Terlalu banyak permintaan. Cuba lagi sebentar.';
  end if;

  -- Bertindak sebagai pengguna ini (untuk transaksi ini sahaja): semua semakan peranan sedia ada terpakai
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p.auth_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', coalesce(p.auth_user_id::text, ''), true);
  perform set_config('test.uid', coalesce(p.auth_user_id::text, ''), true);   -- persekitaran ujian tempatan
  update mcp_tokens set last_used_at = now() where id = t.id;

  hr := has_role(c.id, '{hr,admin}');
  kewangan := has_role(c.id, '{hr,finance,ceo,admin}');

  begin
    if p_tool = 'get_my_profile' then
      out := jsonb_build_object(
        'name', coalesce(p.preferred_name, p.full_name), 'full_name', p.full_name, 'company', c.name, 'employee_no', e.employee_no,
        'position', (select title from positions where id = e.position_id), 'department', (select name from departments where id = e.department_id),
        'join_date', e.join_date, 'roles', (select coalesce(jsonb_agg(role), '[]') from user_roles where person_id = p.id and company_id = c.id),
        'today', (now() at time zone 'Asia/Kuala_Lumpur')::date);

    elsif p_tool = 'get_leave_balance' then
      tahun := coalesce((a->>'year')::int, extract(year from now() at time zone 'Asia/Kuala_Lumpur')::int);
      select coalesce(jsonb_agg(jsonb_build_object(
               'code', x.code, 'type', x.name,
               'entitled', coalesce(b.entitled + b.carried_forward + b.adjustment, leave_entitlement(e.id, x.id, tahun)),
               'used', coalesce(b.used, 0), 'pending', coalesce(b.pending, 0),
               'available', coalesce(b.available, leave_entitlement(e.id, x.id, tahun))) order by x.sort_order), '[]')
        into out
        from leave_types x left join leave_balances b on b.leave_type_id = x.id and b.employment_id = e.id and b.year = tahun
       where x.company_id = c.id and x.active and x.deduct_balance;
      out := jsonb_build_object('year', tahun, 'balances', out);

    elsif p_tool = 'list_leave_types' then
      select coalesce(jsonb_agg(jsonb_build_object('code', code, 'name', name, 'deducts_balance', deduct_balance) order by sort_order), '[]')
        into out from leave_types where company_id = c.id and active;

    elsif p_tool = 'apply_leave' then
      select * into lt from leave_types where company_id = c.id and active
         and (upper(code) = upper(coalesce(a->>'leave_type', '')) or lower(name) = lower(coalesce(a->>'leave_type', ''))) limit 1;
      if lt.id is null then raise exception 'Jenis cuti tidak dijumpai. Gunakan list_leave_types.'; end if;
      lr := submit_leave(e.id, lt.code, (a->>'start_date')::date, coalesce((a->>'end_date')::date, (a->>'start_date')::date),
                         coalesce(nullif(a->>'half_day', ''), 'full')::leave_half, nullif(a->>'reason', ''), null, 'ai_agent');
      out := jsonb_build_object('request_id', lr.approval_request_id, 'leave_type', lt.name, 'start_date', lr.start_date, 'end_date', lr.end_date,
                                'days', lr.days, 'status', lr.status,
                                'approvers', (select coalesce(jsonb_agg(jsonb_build_object('step', s.step_order, 'name', s.step_name) order by s.step_order), '[]')
                                                from (select distinct step_order, step_name from approval_tasks where request_id = lr.approval_request_id) s));

    elsif p_tool = 'list_my_requests' then
      select coalesce(jsonb_agg(x order by x.submitted desc), '[]') into out from (
        select r.id, r.title, r.status, r.request_type, r.submitted_at as submitted,
               (select string_agg(distinct t2.step_name, ', ') from approval_tasks t2 where t2.request_id = r.id and t2.status = 'pending') as waiting_for
          from approval_requests r
         where r.requester_person_id = p.id and r.company_id = c.id
         order by r.submitted_at desc limit least(coalesce((a->>'limit')::int, 20), 50)) x;

    elsif p_tool = 'list_pending_approvals' then
      select coalesce(jsonb_agg(x order by x.submitted), '[]') into out from (
        select tk.id as task_id, r.title, r.request_type, tk.step_name as your_step, r.submitted_at as submitted,
               coalesce(rp.preferred_name, rp.full_name) as requester,
               (select name from departments d join employments re on re.department_id = d.id where re.id = r.requester_employment_id) as department,
               r.context, r.ai_summary
          from approval_tasks tk join approval_requests r on r.id = tk.request_id join persons rp on rp.id = r.requester_person_id
         where tk.approver_person_id = p.id and tk.status = 'pending' and r.company_id = c.id and r.status = 'pending'
         limit 50) x;

    elsif p_tool = 'decide_approval' then
      select * into task from approval_tasks where id = (a->>'task_id')::uuid;
      select * into rq from approval_requests where id = task.request_id;
      if task.id is null or task.approver_person_id <> p.id or rq.company_id <> c.id then raise exception 'Tugasan ini bukan untuk anda'; end if;
      tindakan := case lower(coalesce(a->>'decision', '')) when 'approve' then 'approve' when 'reject' then 'reject' when 'return' then 'return' end;
      if tindakan is null then raise exception 'Keputusan mesti approve, reject atau return'; end if;
      rq := approval_act(task.id, tindakan, nullif(a->>'comment', ''), 'ai_agent');
      out := jsonb_build_object('title', rq.title, 'decision', tindakan, 'request_status', rq.status);

    elsif p_tool = 'who_is_on_leave' then
      d0 := coalesce((a->>'from')::date, (now() at time zone 'Asia/Kuala_Lumpur')::date);
      d1 := coalesce((a->>'to')::date, d0);
      out := team_calendar(c.id, d0, d1, null);

    elsif p_tool = 'search_employees' then
      if not kewangan then raise exception 'Hanya HR, Kewangan, CEO atau Pentadbir'; end if;
      kata := '%' || lower(coalesce(a->>'query', '')) || '%';
      select coalesce(jsonb_agg(x order by x.name), '[]') into out from (
        select coalesce(pp.preferred_name, pp.full_name) as name, pp.full_name, ee.employee_no, ee.status, ee.join_date, ee.employment_type,
               (select title from positions where id = ee.position_id) as position, (select name from departments where id = ee.department_id) as department,
               (select coalesce(m.preferred_name, m.full_name) from persons m where m.id = ee.manager_person_id) as manager
          from employments ee join persons pp on pp.id = ee.person_id
         where ee.company_id = c.id and ee.status in ('probation','active')
           and (lower(pp.full_name) like kata or lower(coalesce(pp.preferred_name, '')) like kata or lower(ee.employee_no) like kata
                or exists (select 1 from departments dd where dd.id = ee.department_id and lower(dd.name) like kata)
                or exists (select 1 from positions po where po.id = ee.position_id and lower(po.title) like kata))
         limit 100) x;

    elsif p_tool = 'hr_summary' then
      if not kewangan then raise exception 'Hanya HR, Kewangan, CEO atau Pentadbir'; end if;
      d0 := (now() at time zone 'Asia/Kuala_Lumpur')::date;
      out := jsonb_build_object(
        'date', d0,
        'active_employees', (select count(*) from employments where company_id = c.id and status in ('probation','active')),
        'on_probation', (select count(*) from employments where company_id = c.id and status = 'probation'),
        'on_leave_today', (select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(pp.preferred_name, pp.full_name), 'type', ty.name)), '[]')
                             from leave_requests l join employments ee on ee.id = l.employment_id join persons pp on pp.id = ee.person_id
                             join leave_types ty on ty.id = l.leave_type_id
                            where ee.company_id = c.id and l.status = 'approved' and d0 between l.start_date and l.end_date),
        'pending_approvals_company', (select count(*) from approval_requests where company_id = c.id and status = 'pending'),
        'pending_by_type', (select coalesce(jsonb_object_agg(request_type, n), '{}') from (select request_type, count(*) n from approval_requests
                              where company_id = c.id and status = 'pending' group by 1) z),
        'approved_claims_unpaid', (select coalesce(sum(cl.total_amount), 0) from claims cl join employments ee on ee.id = cl.employment_id
                                    where ee.company_id = c.id and cl.status = 'approved' and cl.paid_at is null),
        'joined_last_30_days', (select count(*) from employments where company_id = c.id and join_date > d0 - 30));

    elsif p_tool = 'payroll_summary' then
      if not kewangan then raise exception 'Hanya HR, Kewangan, CEO atau Pentadbir'; end if;
      tahun := coalesce((a->>'year')::int, extract(year from now() at time zone 'Asia/Kuala_Lumpur')::int);
      bulan := (a->>'month')::int;
      select coalesce(jsonb_agg(jsonb_build_object('year', r.period_year, 'month', r.period_month, 'cycle', coalesce(r.label, 'Gaji bulanan'),
               'status', r.status, 'pay_date', r.pay_date, 'totals', r.totals) order by r.period_month, r.cycle_no), '[]')
        into out from payroll_runs r
       where r.company_id = c.id and r.period_year = tahun and (bulan is null or r.period_month = bulan);
      out := jsonb_build_object('note', 'Jumlah keseluruhan sahaja; gaji individu tidak didedahkan melalui AI.', 'runs', out);

    elsif p_tool = 'get_my_payslips' then
      select coalesce(jsonb_agg(jsonb_build_object('year', r.period_year, 'month', r.period_month, 'cycle', coalesce(r.label, 'Gaji bulanan'),
               'gross', s.gross, 'total_deduction', s.total_deduction, 'net', s.net, 'pay_date', r.pay_date,
               'lines', (select jsonb_agg(jsonb_build_object('item', l.description, 'kind', l.kind, 'amount', l.amount) order by l.kind, l.description)
                           from payslip_lines l where l.payslip_id = s.id and l.kind in ('earning','deduction'))) order by r.period_year desc, r.period_month desc), '[]')
        into out from payslips s join payroll_runs r on r.id = s.payroll_run_id
       where s.employment_id = e.id and payslip_visible_status(r) and r.status in ('approved','paid','locked')
         and (a->>'year' is null or r.period_year = (a->>'year')::int) and (a->>'month' is null or r.period_month = (a->>'month')::int);

    else
      raise exception 'Alat tidak dikenali: %', p_tool;
    end if;
    insert into mcp_call_log(token_id, tool, ok) values (t.id, left(coalesce(p_tool, ''), 60), true);
    return jsonb_build_object('ok', true, 'data', out);
  exception when others then
    insert into mcp_call_log(token_id, tool, ok, error) values (t.id, left(coalesce(p_tool, ''), 60), false, left(sqlerrm, 300));
    return jsonb_build_object('ok', false, 'error', sqlerrm);
  end;
end $$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function mcp_token_create(uuid, text) from public, anon;
    grant execute on function mcp_token_create(uuid, text) to authenticated;
    revoke all on function mcp_token_list(uuid) from public, anon;
    grant execute on function mcp_token_list(uuid) to authenticated;
    revoke all on function mcp_token_revoke(uuid) from public, anon;
    grant execute on function mcp_token_revoke(uuid) to authenticated;
    revoke all on function mcp_call(text, text, jsonb) from public;
    grant execute on function mcp_call(text, text, jsonb) to anon, authenticated;
    grant select on mcp_tokens, mcp_call_log to authenticated;
  end if;
end $$;
