-- =====================================================================
--  Nama panggilan secara pukal (HR / Pentadbir). Data yang diimport biasanya hanya ada nama penuh
--  (huruf besar, ikut kad pengenalan); nama panggilan dipakai di semua skrin (CLAUDE.md §1.6).
-- =====================================================================
create or replace function hr_preferred_names(p_company uuid)
returns table(employment_id uuid, employee_no text, full_name text, preferred_name text, department text, activated boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Tidak dibenarkan'; end if;
  return query
    select e.id, e.employee_no, p.full_name, p.preferred_name, d.name, p.auth_user_id is not null
      from employments e
      join persons p on p.id = e.person_id
      left join departments d on d.id = e.department_id
     where e.company_id = p_company and e.status in ('probation','active')
     order by e.employee_no;
end $$;

-- p_items: [{"employment_id": "...", "name": "Saddam"}]; nama kosong = buang nama panggilan.
create or replace function hr_set_preferred_names(p_company uuid, p_items jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare
  x jsonb;
  nm text;
  pid uuid;
  n int := 0;
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Tidak dibenarkan'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Data tidak sah'; end if;
  for x in select * from jsonb_array_elements(p_items) loop
    select e.person_id into pid from employments e
     where e.id = (x->>'employment_id')::uuid and e.company_id = p_company;
    if pid is null then raise exception 'Pekerja tidak dijumpai'; end if;
    nm := nullif(regexp_replace(trim(coalesce(x->>'name', '')), '\s+', ' ', 'g'), '');
    if nm is not null and (length(nm) < 2 or length(nm) > 30) then
      raise exception 'Nama panggilan mesti 2 hingga 30 aksara: %', nm;
    end if;
    update persons set preferred_name = nm where id = pid and preferred_name is distinct from nm;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;

revoke all on function hr_preferred_names(uuid) from public, anon;
revoke all on function hr_set_preferred_names(uuid, jsonb) from public, anon;
grant execute on function hr_preferred_names(uuid) to authenticated;
grant execute on function hr_set_preferred_names(uuid, jsonb) to authenticated;

-- Papan Pemuka: bilangan pekerja tanpa nama panggilan (ditambah kepada hr_todo).
create or replace function hr_todo(p_company uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  hari date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  hr boolean := has_role(p_company, '{hr,admin}');
  urus boolean := has_role(p_company, '{hr,ceo,admin}');
  wang boolean := has_role(p_company, '{hr,finance,ceo,admin}');
begin
  if not wang then raise exception 'Tidak dibenarkan'; end if;
  return jsonb_build_object(
    'not_activated', case when urus then (
      select count(*) from employments e join persons p on p.id = e.person_id
       where e.company_id = p_company and e.status in ('probation','active') and p.auth_user_id is null) end,
    'probation_ending', case when urus then (
      select count(*) from employments e
       where e.company_id = p_company and e.status = 'probation'
         and e.probation_end_date is not null and e.probation_end_date <= hari + 30
         and not exists (select 1 from probation_reviews pr where pr.employment_id = e.id and pr.hr_decision is not null)) end,
    'claims_unpaid', (
      select jsonb_build_object('n', count(*), 'amount', coalesce(sum(c.total_amount), 0))
        from claims c join employments e on e.id = c.employment_id
       where e.company_id = p_company and c.status = 'approved' and c.paid_at is null),
    'questions_open', case when hr then (select count(*) from hr_questions q where q.company_id = p_company and q.status = 'open') end,
    'letters_pending', case when hr then (select count(*) from letter_requests l where l.company_id = p_company and l.status = 'pending') end,
    'flexible_pending', case when hr then (select count(*) from flexible_work_requests f where f.company_id = p_company and f.status = 'pending') end,
    'stuck', case when urus then (
      select count(*) from approval_requests r
       where r.company_id = p_company and r.status = 'pending'
         and (r.sla_breached or (r.sla_due_at is not null and r.sla_due_at < now()))) end,
    'pending_all', case when urus then (
      select count(*) from approval_requests r where r.company_id = p_company and r.status = 'pending') end,
    'no_nickname', case when hr then (
      select count(*) from employments e join persons p on p.id = e.person_id
       where e.company_id = p_company and e.status in ('probation','active') and nullif(trim(p.preferred_name), '') is null) end
  );
end $$;
