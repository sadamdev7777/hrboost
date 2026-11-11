-- =====================================================================
--  Prestasi: konteks pengguna dalam satu panggilan.
--  Sebelum ini setiap muat halaman membuat 5 permintaan berturut (persons → employments →
--  user_roles/departments → my_login_status) sebelum data halaman bermula. my_context()
--  memulangkan semuanya sekali gus. SECURITY INVOKER: RLS terpakai sama seperti pertanyaan asal
--  (syarikat digantung tidak kelihatan).
-- =====================================================================

create or replace function my_context(p_company uuid default null)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare p persons; emps jsonb; aktif uuid; r jsonb; h jsonb;
begin
  select * into p from persons where auth_user_id = auth.uid();
  if p.id is null then return null; end if;

  select coalesce(jsonb_agg(x order by x.join_date), '[]') into emps from (
    select e.id, e.company_id, e.employee_no, e.department_id, e.join_date,
           c.code as company_code, c.name as company_name, c.logo_path,
           to_char(coalesce(e.work_start, c.work_start), 'HH24:MI') as work_start,
           to_char(c.work_end, 'HH24:MI') as work_end, c.late_grace_minutes,
           d.name as department_name, ps.title as position
      from employments e
      join companies c on c.id = e.company_id
      left join departments d on d.id = e.department_id
      left join positions ps on ps.id = e.position_id
     where e.person_id = p.id and e.status in ('probation','active')
  ) x;

  select coalesce((select (j->>'company_id')::uuid from jsonb_array_elements(emps) j where (j->>'company_id')::uuid = p_company limit 1),
                  (emps->0->>'company_id')::uuid) into aktif;

  select coalesce(jsonb_agg(role), '[]') into r from user_roles where person_id = p.id and company_id = aktif;
  select coalesce(jsonb_agg(id), '[]') into h from departments where company_id = aktif and head_person_id = p.id;

  return jsonb_build_object(
    'person', jsonb_build_object('id', p.id, 'full_name', p.full_name, 'preferred_name', p.preferred_name,
                                 'photo_path', p.photo_path, 'email', p.email, 'language', p.language),
    'employments', emps,
    'active_company', aktif,
    'roles', r,
    'heads', h,
    'login', my_login_status());
end $$;

revoke all on function my_context(uuid) from public, anon;
grant execute on function my_context(uuid) to authenticated;

-- Indeks untuk pertanyaan yang kerap (senarai kelulusan, sejarah, jadual gaji)
create index if not exists approval_tasks_approver_status_idx on approval_tasks(approver_person_id, status);
create index if not exists approval_tasks_request_idx on approval_tasks(request_id);
create index if not exists employment_compensation_emp_idx on employment_compensation(employment_id, component_id, effective_from desc);
create index if not exists user_roles_person_company_idx on user_roles(person_id, company_id);
create index if not exists employments_person_idx on employments(person_id);
