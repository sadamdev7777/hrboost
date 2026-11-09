-- =====================================================================
--  9. Ringkasan harian WhatsApp untuk HR (5:00 petang waktu Malaysia)
--  10. Pratonton slip gaji oleh pekerja sebelum hari gaji + "Lapor kesilapan"
-- =====================================================================

-- ---------------------------------------------------------------------
-- 9. Ringkasan harian
-- ---------------------------------------------------------------------
alter table companies add column if not exists hr_daily_digest boolean not null default true;

create or replace function hr_daily_digest_text(p_company uuid, p_person uuid, p_today date default null) returns text
language plpgsql stable security definer set search_path = public as $$
declare t date := coalesce(p_today, (now() at time zone 'Asia/Kuala_Lumpur')::date);
        hari text[] := array['Ahad','Isnin','Selasa','Rabu','Khamis','Jumaat','Sabtu'];
        bln text[] := array['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogo','Sep','Okt','Nov','Dis'];
        grace int; n_pending int; n_sla int; n_leave int; n_late int; n_absent_names text; baru text; berk record; n_semak int; n_tamat int;
        baris text[] := array[]::text[];
begin
  select late_grace_minutes into grace from companies where id = p_company;
  select count(*), count(*) filter (where r.sla_breached) into n_pending, n_sla
    from approval_requests r where r.company_id = p_company and r.status = 'pending';
  select count(distinct lr.employment_id) into n_leave
    from leave_requests lr join employments e on e.id = lr.employment_id
   where e.company_id = p_company and lr.status = 'approved' and t between lr.start_date and lr.end_date;
  select count(*) into n_late from attendance_records a join employments e on e.id = a.employment_id
   where e.company_id = p_company and a.work_date = t and a.late_minutes > coalesce(grace, 0);
  select string_agg(coalesce(p.preferred_name, p.full_name), ', ' order by coalesce(p.preferred_name, p.full_name)) into baru
    from employments e join persons p on p.id = e.person_id
   where e.company_id = p_company and e.status in ('probation','active') and e.join_date = t + 1;
  select count(*) into n_semak from onboarding_checklist_items c join employments e on e.id = c.employment_id
   where c.company_id = p_company and c.owner = 'hr' and c.done_at is null and c.due_date <= t and e.status in ('probation','active');
  select count(*) into n_tamat from employments e join persons p on p.id = e.person_id
   where e.company_id = p_company and e.status in ('probation','active')
     and (e.contract_end_date between t and t + 7 or p.permit_expiry between t and t + 7 or p.passport_expiry between t and t + 7);

  if n_pending > 0 then
    baris := baris || ('• ' || n_pending || ' permohonan menunggu kelulusan' || case when n_sla > 0 then ' (' || n_sla || ' melepasi tempoh)' else '' end);
  end if;
  if n_leave > 0 or n_late > 0 then
    baris := baris || ('• Hari ini: ' || concat_ws(', ', case when n_leave > 0 then n_leave || ' pekerja bercuti / MC' end,
                                                     case when n_late > 0 then n_late || ' lewat masuk' end));
  end if;
  if baru is not null then baris := baris || ('• Pekerja baharu mula esok: ' || baru); end if;
  for berk in select * from statutory_due_items(p_company, t) d where d.days_left between 0 and 5 order by d.due_date loop
    baris := baris || ('• ' || berk.label || ' perlu dihantar ' || case when berk.days_left = 0 then 'hari ini' else 'dalam ' || berk.days_left || ' hari' end);
  end loop;
  if n_semak > 0 then baris := baris || ('• ' || n_semak || ' perkara senarai semak pekerja baharu perlu disiapkan'); end if;
  if n_tamat > 0 then baris := baris || ('• ' || n_tamat || ' kontrak / permit / pasport tamat dalam 7 hari'); end if;

  if array_length(baris, 1) is null then return null; end if;
  return 'Ringkasan HR ' || hari[extract(dow from t)::int + 1] || ', ' || extract(day from t) || ' ' || bln[extract(month from t)::int] || E':\n'
         || array_to_string(baris, E'\n') || E'\n\nButiran di HRBoost → Papan Pemuka.';
end $$;

create or replace function hr_daily_digest() returns int
language plpgsql security definer set search_path = public as $$
declare c record; p record; msg text; n int := 0;
        t date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
begin
  -- Hari bekerja sahaja (Isnin–Jumaat)
  if extract(isodow from t) > 5 then return 0; end if;
  for c in select id from companies where status = 'active' and hr_daily_digest loop
    for p in select distinct ur.person_id from user_roles ur
               join employments e on e.person_id = ur.person_id and e.company_id = c.id and e.status in ('probation','active')
              where ur.company_id = c.id and ur.role = 'hr' loop
      msg := hr_daily_digest_text(c.id, p.person_id, t);
      continue when msg is null;
      perform notify_person(p.person_id, c.id, msg);
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'hrboost-hr-daily-digest';
    perform cron.schedule('hrboost-hr-daily-digest', '0 9 * * 1-5', 'select public.hr_daily_digest()');  -- 5:00 petang MYT
  end if;
end $$;

-- Pratonton untuk HR sendiri (Tetapan): mesej yang akan dihantar hari ini
create or replace function my_daily_digest_preview(p_company uuid) returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Tidak dibenarkan'; end if;
  return hr_daily_digest_text(p_company, current_person_id());
end $$;

create or replace function set_hr_daily_digest(p_company uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Hanya HR / Pentadbir'; end if;
  update companies set hr_daily_digest = p_on where id = p_company;
end $$;

-- ---------------------------------------------------------------------
-- 10. Pratonton slip oleh pekerja
-- ---------------------------------------------------------------------
alter table companies add column if not exists payslip_preview boolean not null default true;

-- Status larian yang boleh dilihat oleh pekerja sendiri
create or replace function payslip_visible_status(p_run payroll_runs) returns boolean
language sql stable security definer set search_path = public as $$
  select p_run.status in ('approved','paid','locked')
      or (p_run.status in ('calculated','pending') and coalesce((select payslip_preview from companies where id = p_run.company_id), false))
$$;

create or replace function payslip_is_mine(p_payslip uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from payslips s join employments e on e.id = s.employment_id
                   join payroll_runs r on r.id = s.payroll_run_id
                  where s.id = p_payslip and e.person_id = current_person_id() and payslip_visible_status(r))
$$;

create or replace function payslip_meta(p_payslip uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('period_year', r.period_year, 'period_month', r.period_month, 'pay_date', r.pay_date,
           'status', r.status, 'company', jsonb_build_object('name', c.name, 'code', c.code, 'reg_no', c.reg_no,
           'epf', c.epf_employer_no, 'socso', c.socso_employer_no, 'lhdn', c.lhdn_employer_no))
    from payslips s join payroll_runs r on r.id = s.payroll_run_id join companies c on c.id = r.company_id
    join employments e on e.id = s.employment_id
   where s.id = p_payslip
     and ((e.person_id = current_person_id() and payslip_visible_status(r))
          or has_role(r.company_id, '{hr,finance,ceo,admin}'))
$$;

create table if not exists payslip_issues (
  id              uuid primary key default gen_random_uuid(),
  payroll_run_id  uuid not null references payroll_runs(id) on delete cascade,
  employment_id   uuid not null references employments(id) on delete cascade,
  message         text not null check (length(message) between 3 and 1000),
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  resolved_by     uuid references persons(id),
  resolution      text
);
alter table payslip_issues enable row level security;
create policy read_issue on payslip_issues for select using (
  exists (select 1 from payroll_runs r where r.id = payroll_run_id and has_role(r.company_id, '{hr,finance,admin}'))
  or exists (select 1 from employments e where e.id = employment_id and e.person_id = current_person_id()));

drop function if exists my_payslips(uuid);
create function my_payslips(p_employment uuid)
returns table(id uuid, period_year int, period_month int, pay_date date, status payroll_status, net numeric, draft boolean, issue_open boolean)
language sql stable security definer set search_path = public as $$
  select s.id, r.period_year, r.period_month, r.pay_date, r.status, s.net,
         r.status in ('calculated','pending'),
         exists (select 1 from payslip_issues i where i.payroll_run_id = r.id and i.employment_id = s.employment_id and i.resolved_at is null)
    from payslips s join payroll_runs r on r.id = s.payroll_run_id join employments e on e.id = s.employment_id
   where s.employment_id = p_employment and e.person_id = current_person_id() and payslip_visible_status(r)
   order by r.period_year desc, r.period_month desc
$$;

create or replace function report_payslip_issue(p_payslip uuid, p_message text) returns uuid
language plpgsql security definer set search_path = public as $$
declare s payslips; r payroll_runs; e employments; nid uuid; nama text; p record;
        bln text[] := array['Januari','Februari','Mac','April','Mei','Jun','Julai','Ogos','September','Oktober','November','Disember'];
begin
  select * into s from payslips where id = p_payslip;
  select * into r from payroll_runs where id = s.payroll_run_id;
  select * into e from employments where id = s.employment_id;
  if s.id is null or e.person_id is distinct from current_person_id() or not payslip_visible_status(r) then raise exception 'Tidak dibenarkan'; end if;
  if r.status not in ('calculated','pending','approved') then raise exception 'Gaji bulan ini telah dibayar. Hubungi HR secara terus.'; end if;
  if length(trim(coalesce(p_message, ''))) < 3 then raise exception 'Sila terangkan kesilapan'; end if;
  insert into payslip_issues(payroll_run_id, employment_id, message) values (r.id, e.id, trim(p_message)) returning id into nid;
  select coalesce(preferred_name, full_name) into nama from persons where id = e.person_id;
  for p in select distinct ur.person_id from user_roles ur
             join employments x on x.person_id = ur.person_id and x.company_id = r.company_id and x.status in ('probation','active')
            where ur.company_id = r.company_id and ur.role in ('hr','finance') loop
    perform notify_person(p.person_id, r.company_id,
      nama || ' melaporkan kesilapan pada slip gaji ' || bln[r.period_month] || ' ' || r.period_year || ': "' || left(trim(p_message), 300) ||
      '". Semak di HRBoost → Gaji sebelum gaji diluluskan.');
  end loop;
  return nid;
end $$;

create or replace function payroll_issues(p_run uuid)
returns table(id uuid, employment_id uuid, name text, message text, created_at timestamptz, resolved_at timestamptz, resolution text)
language plpgsql stable security definer set search_path = public as $$
declare r payroll_runs;
begin
  select * into r from payroll_runs where payroll_runs.id = p_run;
  if r.id is null or not has_role(r.company_id, '{hr,finance,ceo,admin}') then raise exception 'Tidak dibenarkan'; end if;
  return query
  select i.id, i.employment_id, coalesce(p.preferred_name, p.full_name), i.message, i.created_at, i.resolved_at, i.resolution
    from payslip_issues i join employments e on e.id = i.employment_id join persons p on p.id = e.person_id
   where i.payroll_run_id = p_run
   order by i.resolved_at nulls first, i.created_at;
end $$;

create or replace function resolve_payslip_issue(p_issue uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare i payslip_issues; r payroll_runs; e employments;
begin
  select * into i from payslip_issues where id = p_issue;
  select * into r from payroll_runs where id = i.payroll_run_id;
  if i.id is null or not has_role(r.company_id, '{hr,finance,admin}') then raise exception 'Hanya HR / Kewangan'; end if;
  update payslip_issues set resolved_at = now(), resolved_by = current_person_id(), resolution = nullif(trim(coalesce(p_note, '')), '') where id = i.id;
  select * into e from employments where id = i.employment_id;
  perform notify_person(e.person_id, r.company_id,
    'HR telah menyemak laporan slip gaji anda' || coalesce(': ' || rtrim(nullif(trim(coalesce(p_note, '')), ''), '.') || '.', '.') || ' Lihat slip terkini di HRBoost → Saya → Slip Gaji.');
end $$;

create or replace function set_payslip_preview(p_company uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_role(p_company, '{hr,finance,admin}') then raise exception 'Hanya HR / Kewangan'; end if;
  update companies set payslip_preview = p_on where id = p_company;
end $$;

do $$
declare f text;
begin
  foreach f in array array['hr_daily_digest_text(uuid, uuid, date)', 'hr_daily_digest()', 'my_daily_digest_preview(uuid)', 'set_hr_daily_digest(uuid, boolean)',
    'payslip_visible_status(payroll_runs)', 'payslip_is_mine(uuid)', 'payslip_meta(uuid)', 'my_payslips(uuid)', 'report_payslip_issue(uuid, text)',
    'payroll_issues(uuid)', 'resolve_payslip_issue(uuid, text)', 'set_payslip_preview(uuid, boolean)'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f);
      if f in ('hr_daily_digest_text(uuid, uuid, date)', 'hr_daily_digest()') then
        execute format('grant execute on function %s to service_role', f);
      else
        execute format('grant execute on function %s to authenticated, service_role', f);
      end if;
    end if;
  end loop;
end $$;
