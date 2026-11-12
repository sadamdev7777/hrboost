-- Langkah "Daftar akaun Pentadbir" dikira siap jika syarikat sudah mempunyai Pentadbir yang mempunyai akaun log masuk.
-- Sebelum ini hanya register_company_email merekodkannya, jadi syarikat yang dicipta melalui import / seed
-- (cth. MTB) sentiasa menunjukkan langkah 1 belum siap walaupun Pentadbir sudah log masuk.
create or replace function company_onboarding_state(p_company uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when has_role(p_company, '{hr,admin}') then jsonb_build_object(
    'name', c.name, 'code', c.code, 'completed_at', c.onboarding_completed_at,
    'steps', (select coalesce(jsonb_agg(distinct s), '[]') from (
                select step s from company_onboarding_progress where company_id = c.id
                union all
                select 'admin' where exists (select 1 from user_roles ur join persons p on p.id = ur.person_id
                                              where ur.company_id = c.id and ur.role = 'admin' and p.auth_user_id is not null)) x),
    'employees', (select count(*) from employments where company_id = c.id and status in ('probation','active')),
    'activated', (select count(*) from employments e join persons p on p.id = e.person_id
                   where e.company_id = c.id and e.status in ('probation','active') and p.auth_user_id is not null),
    'departments', (select count(*) from departments where company_id = c.id),
    'departments_without_head', (select count(*) from departments d where d.company_id = c.id and d.head_person_id is null
                                  and exists (select 1 from employments e where e.department_id = d.id and e.status in ('probation','active'))),
    'holidays', (select count(*) from company_holiday_options(c.id, extract(year from now())::int) where chosen),
    'invites_pending', (select count(*) from employments e join persons p on p.id = e.person_id
                         where e.company_id = c.id and e.status in ('probation','active') and p.auth_user_id is null)
  ) end
  from companies c where c.id = p_company
$$;
