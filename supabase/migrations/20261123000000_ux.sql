-- =====================================================================
--  Penambahbaikan UX
--  company_attendance_connected: adakah syarikat sudah menyambung sistem
--  kehadiran (integrasi aktif atau ada rekod 30 hari lepas)? Jika belum,
--  skrin pekerja tidak memaparkan "Tidak hadir" yang mengelirukan.
-- =====================================================================
create or replace function company_attendance_connected(p_company uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_company_member(p_company) and (
    exists (select 1 from attendance_integrations i where i.company_id = p_company)
    or exists (select 1 from attendance_records a join employments e on e.id = a.employment_id
                where e.company_id = p_company and a.work_date >= (now() at time zone 'Asia/Kuala_Lumpur')::date - 30));
$$;
revoke all on function company_attendance_connected(uuid) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function company_attendance_connected(uuid) from anon;
    grant execute on function company_attendance_connected(uuid) to authenticated, service_role;
  end if;
end $$;

-- Lewat = melebihi kelonggaran syarikat (late_grace_minutes), sama seperti automasi WhatsApp.
-- Sebelum ini Papan Pemuka mengira sebarang minit selepas waktu masuk sebagai lewat.
create or replace function hr_dashboard(p_company uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
        m0 date := date_trunc('month', today)::date; out jsonb;
begin
  if not has_role(p_company, '{hr,finance,ceo,admin}') then raise exception 'Tidak dibenarkan'; end if;
  select jsonb_build_object(
    'company_code', (select code from companies where id = p_company),
    'on_leave', coalesce((
      select jsonb_agg(jsonb_build_object('employment_id', e.id, 'name', coalesce(p.preferred_name, p.full_name),
               'leave', lt.code, 'leave_name', lt.name, 'half_day', lr.half_day, 'department', d.name)
             order by coalesce(p.preferred_name, p.full_name))
        from leave_requests lr join employments e on e.id = lr.employment_id
        join persons p on p.id = e.person_id join leave_types lt on lt.id = lr.leave_type_id
        left join departments d on d.id = e.department_id
       where e.company_id = p_company and lr.status = 'approved' and today between lr.start_date and lr.end_date), '[]'),
    'late_today', (select count(*) from attendance_records a join employments e on e.id = a.employment_id
                    where e.company_id = p_company and a.work_date = today and a.late_minutes > (select c.late_grace_minutes from companies c where c.id = p_company)),
    'sla_breached', (select count(*) from approval_requests r
                      where r.company_id = p_company and r.status = 'pending' and r.sla_breached),
    'attention', coalesce((select jsonb_agg(x order by x->>'sort') from (
        -- permohonan melepasi tempoh
        select jsonb_build_object('sort', '1' || r.submitted_at, 'kind', 'sla', 'request_id', r.id,
                 'text', r.title || ' tertangguh' ||
                   coalesce(' di ' || (select string_agg(distinct t.step_name, ', ') from approval_tasks t
                                        where t.request_id = r.id and t.status = 'pending'), '')) x
          from approval_requests r where r.company_id = p_company and r.status = 'pending' and r.sla_breached
        union all
        -- tempoh percubaan tamat dalam 30 hari
        select jsonb_build_object('sort', '2' || e.probation_end_date, 'kind', 'probation', 'employment_id', e.id,
                 'text', 'Tempoh percubaan ' || coalesce(p.preferred_name, p.full_name) || ' tamat ' || fmt_tarikh(e.probation_end_date))
          from employments e join persons p on p.id = e.person_id
         where e.company_id = p_company and e.status = 'probation'
           and e.probation_end_date <= today + 30
        union all
        -- pertukaran akaun bank menunggu pengesahan
        select jsonb_build_object('sort', '3' || b.requested_at, 'kind', 'bank', 'employment_id', e.id,
                 'text', 'Pertukaran akaun bank ' || coalesce(p.preferred_name, p.full_name) || ' menunggu pengesahan')
          from bank_change_requests b join persons p on p.id = b.person_id
          join employments e on e.person_id = b.person_id and e.company_id = p_company and e.status in ('probation','active')
         where b.status = 'pending' and has_role(p_company, '{hr,admin}')
        union all
        -- lewat berulang bulan ini (3 kali atau lebih)
        select jsonb_build_object('sort', '4' || coalesce(p.preferred_name, p.full_name), 'kind', 'late', 'employment_id', e.id,
                 'text', coalesce(p.preferred_name, p.full_name) || ' lewat ' || count(*) || ' kali bulan ini')
          from attendance_records a join employments e on e.id = a.employment_id join persons p on p.id = e.person_id
         where e.company_id = p_company and a.work_date >= m0 and a.late_minutes > (select c.late_grace_minutes from companies c where c.id = p_company)
         group by e.id, p.preferred_name, p.full_name having count(*) >= 3
      ) s), '[]'),
    'claims_approved_month', coalesce((
      select sum(c.total_amount) from claims c join employments e on e.id = c.employment_id
        join approval_requests r on r.id = c.approval_request_id
       where e.company_id = p_company and c.status = 'approved' and r.completed_at >= m0), 0),
    'payroll_draft', (select (totals->>'gross')::numeric from payroll_runs
                       where company_id = p_company and period_year = extract(year from today)
                         and period_month = extract(month from today)),
    'headcount', (select count(*) from employments where company_id = p_company and status in ('probation','active'))
  ) into out;
  return out;
end $$;

create or replace function hr_dashboard_extra(p_company uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare today date := (now() at time zone 'Asia/Kuala_Lumpur')::date; r payroll_runs; out jsonb;
begin
  if not has_role(p_company, '{hr,finance,ceo,admin}') then raise exception 'Tidak dibenarkan'; end if;
  select * into r from payroll_runs where company_id = p_company
     and period_year = extract(year from today) and period_month = extract(month from today);
  select jsonb_build_object(
    'present_today', (select count(*) from attendance_records a join employments e on e.id = a.employment_id
                       where e.company_id = p_company and a.work_date = today and a.clock_in is not null),
    'attendance_connected', exists (select 1 from attendance_records a join employments e on e.id = a.employment_id
                                     where e.company_id = p_company and a.work_date >= today - 7)
                            or exists (select 1 from attendance_integrations i where i.company_id = p_company),
    'late_names', coalesce((select jsonb_agg(jsonb_build_object('name', coalesce(p.preferred_name, p.full_name),
                                   'employment_id', e.id, 'clock_in', a.clock_in, 'late_minutes', a.late_minutes) order by a.clock_in)
                              from attendance_records a join employments e on e.id = a.employment_id join persons p on p.id = e.person_id
                             where e.company_id = p_company and a.work_date = today and a.late_minutes > (select c.late_grace_minutes from companies c where c.id = p_company)), '[]'),
    'no_salary', case when has_role(p_company, '{hr,finance,admin}') then
                   (select count(*) from employments e where e.company_id = p_company and e.status in ('probation','active')
                       and not exists (select 1 from employment_compensation ec join pay_components pc on pc.id = ec.component_id
                                        where ec.employment_id = e.id and pc.code = 'BASIC' and ec.effective_from <= today
                                          and (ec.effective_to is null or ec.effective_to >= today)))
                 end,
    'payroll', jsonb_build_object(
                 'year', extract(year from today)::int, 'month', extract(month from today)::int,
                 'status', r.status,
                 'gross', (r.totals->>'gross')::numeric,
                 'net', (r.totals->>'net')::numeric,
                 'employer', (r.totals->>'employer')::numeric),
    'joiners', coalesce((select jsonb_agg(jsonb_build_object('employment_id', e.id, 'name', coalesce(p.preferred_name, p.full_name),
                                 'join_date', e.join_date, 'department', d.name) order by e.join_date)
                           from employments e join persons p on p.id = e.person_id left join departments d on d.id = e.department_id
                          where e.company_id = p_company and e.status in ('probation','active')
                            and e.join_date between today - 7 and today + 7), '[]')
  ) into out;
  return out;
end $$;
