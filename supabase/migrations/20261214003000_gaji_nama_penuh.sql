-- =====================================================================
--  Skrin penggajian memaparkan nama penuh (ikut kad pengenalan), bukan nama panggilan:
--  hr_pay_table (Gaji Pekerja) dan payroll_variance (laporan varians & CSV).
-- =====================================================================
create or replace function hr_pay_table(p_company uuid, p_on date default null, p_via action_channel default 'web')
returns jsonb language plpgsql security definer set search_path = public as $$
declare d date := coalesce(p_on, (now() at time zone 'Asia/Kuala_Lumpur')::date); res jsonb; baris jsonb;
begin
  if not has_role(p_company, '{hr,finance,admin}') then raise exception 'Tidak dibenarkan'; end if;

  insert into data_access_log(actor_person_id, subject_person_id, resource, via)
  select current_person_id(), e.person_id, 'salary', p_via
    from employments e where e.company_id = p_company and e.status in ('probation','active');

  select coalesce(jsonb_agg(x.r || jsonb_build_object('calc', pay_estimate((x.r->>'employment_id')::uuid, x.r->'items', d))
                            order by x.dept nulls last, x.no), '[]')
    into baris
    from (
      select dp.name as dept, e.employee_no as no, jsonb_build_object(
               'employment_id', e.id,
               'name', coalesce(p.full_name, p.preferred_name),
               'employee_no', e.employee_no,
               'department', dp.name,
               'status', e.status,
               'join_date', e.join_date,
               'items', coalesce((
                  select jsonb_object_agg(pc.code, ec.amount)
                    from employment_compensation ec join pay_components pc on pc.id = ec.component_id
                   where ec.employment_id = e.id and pay_component_is_fixed(pc.code)
                     and ec.effective_from <= d and (ec.effective_to is null or ec.effective_to >= d)), '{}'),
               'effective_from', (
                  select max(ec.effective_from) from employment_compensation ec join pay_components pc on pc.id = ec.component_id
                   where ec.employment_id = e.id and pay_component_is_fixed(pc.code)
                     and ec.effective_from <= d and (ec.effective_to is null or ec.effective_to >= d)),
               'upcoming', exists (
                  select 1 from employment_compensation ec join pay_components pc on pc.id = ec.component_id
                   where ec.employment_id = e.id and pay_component_is_fixed(pc.code) and ec.effective_from > d)) as r
        from employments e
        join persons p on p.id = e.person_id
        left join departments dp on dp.id = e.department_id
       where e.company_id = p_company and e.status in ('probation','active')
    ) x;

  select jsonb_build_object(
    'on', d,
    'components', coalesce((
      select jsonb_agg(jsonb_build_object('code', pc.code, 'name', pc.name, 'kind', pc.kind,
                                          'epf', pc.epf_applicable, 'socso', pc.socso_applicable, 'taxable', pc.taxable)
                       order by (pc.code <> 'BASIC'), pc.kind, pc.name)
        from pay_components pc where pc.company_id = p_company and pay_component_is_fixed(pc.code)
           and pc.active and pc.kind <> 'benefit' and (pc.in_table or exists (select 1 from employment_compensation ec where ec.component_id = pc.id))), '[]'),
    'rows', baris,
    'totals', (
      select jsonb_object_agg(k, s) from (
        select k, sum((b->'calc'->>k)::numeric) s
          from jsonb_array_elements(baris) b,
               unnest(array['gross','epf_employee','epf_employer','socso_employee','socso_employer','eis_employee','eis_employer','pcb','hrdf','net','employer_cost']) k
         where (b->'calc'->>'statutory_ready')::boolean
         group by k) t)
  ) into res;
  return res;
end $$;

create or replace function payroll_variance(p_run uuid)
returns table(employment_id uuid, employee_no text, name text, prev_gross numeric, gross numeric, prev_net numeric, net numeric,
              prev_epf numeric, epf numeric, prev_pcb numeric, pcb numeric, status text, note text)
language plpgsql stable security definer set search_path = public as $$
declare r payroll_runs; prev uuid;
begin
  select * into r from payroll_runs where id = p_run;
  if r.id is null or not has_role(r.company_id, '{hr,finance,ceo,admin}') then raise exception 'Tidak dibenarkan'; end if;
  select id into prev from payroll_runs where company_id = r.company_id and cycle_no = 1
     and make_date(period_year, period_month, 1) = (make_date(r.period_year, r.period_month, 1) - interval '1 month')::date;
  return query
  with sek as (select * from payslips where payroll_run_id = p_run), lalu as (select * from payslips where payroll_run_id = prev)
  select coalesce(s.employment_id, l.employment_id), e.employee_no, coalesce(p.full_name, p.preferred_name),
         l.gross, s.gross, l.net, s.net, l.epf_employee, s.epf_employee, l.pcb, s.pcb,
         case when l.id is null then 'baharu' when s.id is null then 'tiada' when s.net <> l.net then 'berubah' else 'sama' end,
         case when s.id is not null and l.id is not null then (
           select string_agg(case when coalesce(n.a, 0) > coalesce(o.a, 0) then '+ ' else '− ' end || lower(coalesce(n.d, o.d)) || ' ' || to_char(abs(coalesce(n.a, 0) - coalesce(o.a, 0)), 'FM999,990.00'), ', ')
             from (select component_code, max(description) d, sum(amount) a from payslip_lines where payslip_id = s.id and kind in ('earning','deduction') group by component_code) n
             full join (select component_code, max(description) d, sum(amount) a from payslip_lines where payslip_id = l.id and kind in ('earning','deduction') group by component_code) o using (component_code)
            where coalesce(n.a, 0) <> coalesce(o.a, 0)) end
    from sek s full join lalu l on l.employment_id = s.employment_id
    join employments e on e.id = coalesce(s.employment_id, l.employment_id) join persons p on p.id = e.person_id
   order by case when l.id is null or s.id is null then 0 when s.net <> l.net then 1 else 2 end, 3;
end $$;
