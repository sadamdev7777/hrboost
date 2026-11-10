-- =====================================================================
--  Modul HR (menu baharu): ringkasan untuk halaman Leave, Attendance,
--  Expense claims dan Onboarding. Baca sahaja; setiap fungsi menyemak peranan.
-- =====================================================================

-- ---------------------------------------------------------------- Cuti
-- Permohonan cuti (90 hari lalu hingga akan datang) + baki tahun semasa.
create or replace function hr_leave_overview(p_company uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  hari date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
begin
  if not has_role(p_company, '{hr,ceo,admin}') then raise exception 'Tidak dibenarkan'; end if;
  return jsonb_build_object(
    'today', hari,
    'requests', coalesce((
      select jsonb_agg(x order by x.start_date desc, x.name) from (
        select lr.id, lr.approval_request_id, lr.employment_id,
               coalesce(p.preferred_name, p.full_name) as name, d.name as department,
               lt.code as leave_code, lt.name as leave_name,
               lr.start_date, lr.end_date, lr.days, lr.half_day, lr.status, lr.created_at
          from leave_requests lr
          join employments e on e.id = lr.employment_id
          join persons p on p.id = e.person_id
          join leave_types lt on lt.id = lr.leave_type_id
          left join departments d on d.id = e.department_id
         where e.company_id = p_company
           and lr.status in ('pending','approved','rejected','returned')
           and lr.end_date >= hari - 90
         order by lr.start_date desc
         limit 400) x), '[]'::jsonb),
    -- Rekod baki dicipta semasa permohonan pertama; pekerja tanpa rekod guna kelayakan semasa.
    'balances', coalesce((
      select jsonb_agg(b order by b.name) from (
        select e.id as employment_id, coalesce(p.preferred_name, p.full_name) as name, d.name as department,
               jsonb_object_agg(lt.code, jsonb_build_object(
                 'entitled', coalesce(lb.entitled + lb.carried_forward + lb.adjustment, ent.v),
                 'used', coalesce(lb.used, 0), 'pending', coalesce(lb.pending, 0),
                 'available', coalesce(lb.available, ent.v))) as items
          from employments e
          join persons p on p.id = e.person_id
          left join departments d on d.id = e.department_id
          join leave_types lt on lt.company_id = e.company_id and lt.active and lt.deduct_balance
                                and (lt.eligible_gender is null or lt.eligible_gender = p.gender)
          left join leave_balances lb on lb.employment_id = e.id and lb.leave_type_id = lt.id and lb.year = extract(year from hari)::int
          cross join lateral (select case when lb.id is null then leave_entitlement(e.id, lt.id, extract(year from hari)::int) end as v) ent
         where e.company_id = p_company and e.status in ('probation','active')
           and (lb.id is not null or coalesce(ent.v, 0) > 0)
         group by e.id, p.preferred_name, p.full_name, d.name) b), '[]'::jsonb),
    'types', coalesce((
      select jsonb_agg(jsonb_build_object('code', lt.code, 'name', lt.name) order by lt.sort_order, lt.code)
        from leave_types lt
       where lt.company_id = p_company and lt.active and lt.deduct_balance), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------- Kehadiran
-- Kehadiran satu hari bagi setiap pekerja aktif + pembetulan masa yang menunggu.
create or replace function hr_attendance_day(p_company uuid, p_date date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  hari date := coalesce(p_date, (now() at time zone 'Asia/Kuala_Lumpur')::date);
begin
  if not has_role(p_company, '{hr,ceo,admin}') then raise exception 'Tidak dibenarkan'; end if;
  return jsonb_build_object(
    'date', hari,
    'working_day', is_working_day(p_company, hari),
    'rows', coalesce((
      select jsonb_agg(r order by r.name) from (
        select e.id as employment_id, coalesce(p.preferred_name, p.full_name) as name, d.name as department,
               e.work_start, ar.clock_in, ar.clock_out, coalesce(ar.late_minutes, 0) as late_minutes,
               (select lt.code from leave_requests lr join leave_types lt on lt.id = lr.leave_type_id
                 where lr.employment_id = e.id and lr.status = 'approved'
                   and hari between lr.start_date and lr.end_date limit 1) as leave_code,
               (select fw.id is not null from flexible_work_requests fw
                 where fw.employment_id = e.id and fw.status = 'approved'
                   and hari >= fw.start_date and (fw.end_date is null or hari <= fw.end_date) limit 1) as flexible
          from employments e
          join persons p on p.id = e.person_id
          left join departments d on d.id = e.department_id
          left join attendance_records ar on ar.employment_id = e.id and ar.work_date = hari
         where e.company_id = p_company and e.status in ('probation','active') and e.join_date <= hari) r), '[]'::jsonb),
    'corrections', coalesce((
      select jsonb_agg(c order by c.work_date desc) from (
        select ac.id, ac.approval_request_id, ac.employment_id, coalesce(p.preferred_name, p.full_name) as name,
               ac.work_date, ac.requested_clock_in, ac.requested_clock_out, ac.reason, ac.status, ac.created_at
          from attendance_corrections ac
          join employments e on e.id = ac.employment_id
          join persons p on p.id = e.person_id
         where e.company_id = p_company and ac.status = 'pending'
         limit 100) c), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------- Tuntutan
-- Semua tuntutan yang telah dihantar (bukan draf) dalam tempoh.
create or replace function hr_claims(p_company uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not has_role(p_company, '{hr,finance,ceo,admin}') then raise exception 'Tidak dibenarkan'; end if;
  return coalesce((
    select jsonb_agg(x order by x.created_at desc) from (
      select c.id, c.approval_request_id, c.employment_id, coalesce(p.preferred_name, p.full_name) as name,
             d.name as department, c.title, c.total_amount, c.status, c.created_at, c.paid_at,
             (c.paid_via_payroll_run is not null) as via_payroll,
             (select string_agg(distinct ct.name, ', ') from claim_items ci join claim_types ct on ct.id = ci.claim_type_id
               where ci.claim_id = c.id) as types,
             (select min(ci.expense_date) from claim_items ci where ci.claim_id = c.id) as expense_date
        from claims c
        join employments e on e.id = c.employment_id
        join persons p on p.id = e.person_id
        left join departments d on d.id = e.department_id
       where e.company_id = p_company and c.status <> 'draft'
         and (c.created_at at time zone 'Asia/Kuala_Lumpur')::date between p_from and p_to
       limit 1000) x), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------- Orientasi
-- Pekerja baharu (90 hari), dalam percubaan, atau belum mengaktifkan akaun.
create or replace function hr_onboarding(p_company uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  hari date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
begin
  if not has_role(p_company, '{hr,ceo,admin}') then raise exception 'Tidak dibenarkan'; end if;
  return coalesce((
    select jsonb_agg(x order by x.join_date desc, x.name) from (
      select e.id as employment_id, coalesce(p.preferred_name, p.full_name) as name, d.name as department,
             ps.title as position, e.join_date, e.status, e.probation_end_date,
             (p.auth_user_id is not null) as activated,
             i.sent_at as invite_sent_at, i.expires_at as invite_expires_at, i.accepted_at as invite_accepted_at,
             (select count(distinct op.step) from onboarding_progress op where op.employment_id = e.id) as steps_done,
             (select count(*) from onboarding_checklist_items ci where ci.employment_id = e.id) as checklist_total,
             (select count(*) from onboarding_checklist_items ci where ci.employment_id = e.id and ci.done_at is not null) as checklist_done,
             (select jsonb_build_object('submitted_at', pr.submitted_at, 'recommendation', pr.recommendation, 'hr_decision', pr.hr_decision)
                from probation_reviews pr where pr.employment_id = e.id order by pr.submitted_at desc nulls last limit 1) as review
        from employments e
        join persons p on p.id = e.person_id
        left join departments d on d.id = e.department_id
        left join positions ps on ps.id = e.position_id
        left join lateral (select * from employee_invites ei where ei.employment_id = e.id order by ei.created_at desc limit 1) i on true
       where e.company_id = p_company and e.status in ('probation','active')
         and (e.status = 'probation' or e.join_date >= hari - 90 or p.auth_user_id is null)
    ) x), '[]'::jsonb);
end $$;

revoke all on function hr_leave_overview(uuid) from public, anon;
revoke all on function hr_attendance_day(uuid, date) from public, anon;
revoke all on function hr_claims(uuid, date, date) from public, anon;
revoke all on function hr_onboarding(uuid) from public, anon;
grant execute on function hr_leave_overview(uuid) to authenticated;
grant execute on function hr_attendance_day(uuid, date) to authenticated;
grant execute on function hr_claims(uuid, date, date) to authenticated;
grant execute on function hr_onboarding(uuid) to authenticated;
