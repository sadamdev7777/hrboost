-- =====================================================================
--  Penambahbaikan audit HR
--  1. approval_task_context: konteks ringkas untuk senarai Kelulusan
--     (baki cuti selepas, rakan sejabatan bercuti pada tarikh sama, lampiran).
--  2. Pemberitahuan dalam aplikasi: notifications.read_at + tanda dibaca.
--  3. Data terkumpul (gaji, KWSP, PCB) semua pekerja untuk satu tahun —
--     diisi sekali gus supaya PCB tepat apabila mula pada pertengahan tahun.
-- =====================================================================

-- 1 ---------------------------------------------------------------------
create or replace function approval_task_context(p_tasks uuid[])
returns table(task_id uuid, balance_after numeric, team_off int, team_names text, has_attachment boolean)
language sql stable security definer set search_path = public as $$
  select t.id,
         case when lt.deduct_balance then (
           select b.available from leave_balances b
            where b.employment_id = lr.employment_id and b.leave_type_id = lr.leave_type_id
              and b.year = extract(year from lr.start_date)::int) end,
         coalesce(o.n, 0)::int,
         o.nama,
         lr.attachment_path is not null
    from approval_tasks t
    join approval_requests r on r.id = t.request_id
    left join leave_requests lr on r.request_type = 'leave' and lr.id = r.reference_id
    left join leave_types lt on lt.id = lr.leave_type_id
    left join employments e on e.id = lr.employment_id
    left join lateral (
      select count(*) n, string_agg(nm, ', ' order by nm) nama from (
        select distinct coalesce(p2.preferred_name, p2.full_name) nm
          from leave_requests l2
          join employments e2 on e2.id = l2.employment_id
          join persons p2 on p2.id = e2.person_id
         where e.department_id is not null and e2.department_id = e.department_id and e2.id <> e.id
           and l2.status in ('approved','pending')
           and l2.start_date <= lr.end_date and l2.end_date >= lr.start_date) z
    ) o on lr.id is not null
   where t.id = any(p_tasks) and t.approver_person_id = current_person_id();
$$;

-- 2 ---------------------------------------------------------------------
alter table notifications add column if not exists read_at timestamptz;
create index if not exists notifications_person_created on notifications(person_id, created_at desc);

create or replace function mark_my_notifications_read(p_ids uuid[] default null)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update notifications set read_at = now()
   where person_id = current_person_id() and read_at is null and (p_ids is null or id = any(p_ids));
  get diagnostics n = row_count;
  return n;
end $$;

-- 3 ---------------------------------------------------------------------
create or replace function hr_opening_balances(p_company uuid, p_year int)
returns table(employment_id uuid, name text, employee_no text, join_date date,
              up_to_month int, gross numeric, epf numeric, pcb numeric, payroll_months int)
language plpgsql security definer set search_path = public as $$
begin
  if not has_role(p_company, '{hr,finance,admin}') then raise exception 'Tidak dibenarkan'; end if;
  insert into data_access_log(actor_person_id, subject_person_id, resource, via)
  select current_person_id(), e.person_id, 'salary', 'web'
    from employments e where e.company_id = p_company and e.status in ('probation','active');
  return query
  select e.id, coalesce(p.preferred_name, p.full_name), e.employee_no, e.join_date,
         ob.up_to_month, ob.gross, ob.epf, ob.pcb,
         (select count(*)::int from payslips ps join payroll_runs pr on pr.id = ps.payroll_run_id
           where ps.employment_id = e.id and pr.period_year = p_year and pr.status in ('approved','paid','locked'))
    from employments e
    join persons p on p.id = e.person_id
    left join payroll_opening_balances ob on ob.employment_id = e.id and ob.year = p_year
   where e.company_id = p_company and e.status in ('probation','active')
   order by e.employee_no;
end $$;

revoke all on function approval_task_context(uuid[]) from public;
revoke all on function mark_my_notifications_read(uuid[]) from public;
revoke all on function hr_opening_balances(uuid, int) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function approval_task_context(uuid[]) from anon;
    revoke all on function mark_my_notifications_read(uuid[]) from anon;
    revoke all on function hr_opening_balances(uuid, int) from anon;
    grant execute on function approval_task_context(uuid[]) to authenticated, service_role;
    grant execute on function mark_my_notifications_read(uuid[]) to authenticated, service_role;
    grant execute on function hr_opening_balances(uuid, int) to authenticated, service_role;
  end if;
end $$;
