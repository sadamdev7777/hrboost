-- =====================================================================
--  Pratonton gaji (Gaji Pekerja): kira caruman berkanun & gaji bersih
--  secara automatik semasa HR memasukkan gaji pokok / elaun tetap.
--  Menggunakan fungsi kiraan yang sama dengan payroll_calculate
--  (stat_epf, stat_socso_eis, stat_pcb, kadar HRDF) supaya angka
--  pratonton sepadan dengan slip gaji sebenar (tanpa komisen / OT /
--  tuntutan / cuti tanpa gaji bulan itu).
-- =====================================================================

create or replace function pay_estimate(p_employment uuid, p_items jsonb, p_on date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e record; c companies; umur int; k text; v jsonb; amt numeric; pc pay_components;
        g numeric := 0; ew numeric := 0; sw numeric := 0; tx numeric := 0; ded numeric := 0;
        epf record; so record; ei record; ytd record; v_pcb numeric; v_hrdf numeric; sedia boolean;
        d0 date := date_trunc('month', p_on)::date;
begin
  select em.*, p.marital_status, p.spouse_working, p.children_count into e
    from employments em join persons p on p.id = em.person_id where em.id = p_employment;
  if e.id is null then return null; end if;
  select * into c from companies where id = e.company_id;
  umur := person_age(e.person_id, p_on);
  sedia := stat_params('EPF', p_on) is not null and stat_params('SOCSO', p_on) is not null and stat_params('PCB', p_on) is not null;

  for k, v in select * from jsonb_each(coalesce(p_items, '{}')) loop
    if jsonb_typeof(v) <> 'number' then continue; end if;
    amt := greatest((v #>> '{}')::numeric, 0);
    select * into pc from pay_components where company_id = e.company_id and code = k;
    if pc.id is null then continue; end if;
    if pc.kind = 'earning' then
      g := g + amt;
      if pc.epf_applicable then ew := ew + amt; end if;
      if pc.socso_applicable then sw := sw + amt; end if;
      if pc.taxable then tx := tx + amt; end if;
    else
      ded := ded + amt;
    end if;
  end loop;

  if not sedia then
    return jsonb_build_object('statutory_ready', false, 'gross', g, 'fixed_deduction', ded);
  end if;

  select * into epf from stat_epf(ew, umur, p_on, c.epf_employer_rate);
  select * into so from stat_socso_eis('SOCSO', sw, umur, p_on);
  select * into ei from stat_socso_eis('EIS', sw, umur, p_on);

  -- Data terkumpul tahun ini (sama seperti payroll_calculate) untuk anggaran PCB
  select coalesce(sum(ps.gross - coalesce((select sum(amount) from payslip_lines x where x.payslip_id = ps.id and x.component_code = 'CLAIM'), 0)), 0) g,
         coalesce(sum(ps.epf_employee), 0) k, coalesce(sum(ps.pcb), 0) x
    into ytd
    from payslips ps join payroll_runs pr on pr.id = ps.payroll_run_id
   where ps.employment_id = e.id and pr.period_year = extract(year from d0) and pr.period_month < extract(month from d0)
     and pr.status in ('approved','paid','locked');
  select ytd.g + coalesce(ob.gross, 0) as g, ytd.k + coalesce(ob.epf, 0) as k, ytd.x + coalesce(ob.pcb, 0) as x into ytd
    from (select 1) z left join payroll_opening_balances ob
      on ob.employment_id = e.id and ob.year = extract(year from d0) and ob.up_to_month < extract(month from d0);
  v_pcb := stat_pcb(extract(month from d0)::int, p_on, ytd.g, ytd.k, ytd.x, tx, epf.employee,
                    e.marital_status in ('berkahwin','married'), e.spouse_working, e.children_count);
  v_hrdf := case when c.hrdf_registered then round(ew * coalesce((stat_params('HRDF', p_on)->>'rate')::numeric, 1) / 100, 2) else 0 end;

  return jsonb_build_object(
    'statutory_ready', true,
    'gross', g,
    'fixed_deduction', ded,
    'epf_employee', epf.employee, 'epf_employer', epf.employer,
    'socso_employee', so.employee, 'socso_employer', so.employer,
    'eis_employee', ei.employee, 'eis_employer', ei.employer,
    'pcb', v_pcb,
    'hrdf', v_hrdf,
    'hrdf_registered', coalesce(c.hrdf_registered, false),
    'net', g - ded - epf.employee - so.employee - ei.employee - v_pcb,
    'employer_cost', g + epf.employer + so.employer + ei.employer + v_hrdf
  );
end $$;

-- Pratonton untuk satu pekerja semasa menaip (tiada perubahan data).
create or replace function hr_pay_preview(p_employment uuid, p_items jsonb, p_on date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e employments;
begin
  select * into e from employments where id = p_employment;
  if e.id is null or not has_role(e.company_id, '{hr,finance,admin}') then raise exception 'Tidak dibenarkan'; end if;
  return pay_estimate(e.id, p_items, coalesce(p_on, (now() at time zone 'Asia/Kuala_Lumpur')::date));
end $$;

-- Jadual gaji: tambah kiraan berkanun setiap baris ('calc') dan jumlah syarikat ('totals').
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
               'name', coalesce(p.preferred_name, p.full_name),
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
        from pay_components pc where pc.company_id = p_company and pay_component_is_fixed(pc.code)), '[]'),
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

revoke all on function pay_estimate(uuid, jsonb, date) from public;
revoke all on function hr_pay_preview(uuid, jsonb, date) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function pay_estimate(uuid, jsonb, date) from anon, authenticated;
    revoke all on function hr_pay_preview(uuid, jsonb, date) from anon;
    grant execute on function hr_pay_preview(uuid, jsonb, date) to authenticated, service_role;
    grant execute on function pay_estimate(uuid, jsonb, date) to service_role;
  end if;
end $$;

-- =====================================================================
--  Papan Pemuka "Pusat Tindakan": tambah kehadiran hari ini, status gaji
--  bulan ini, pekerja tanpa gaji pokok, pekerja baharu minggu ini.
-- =====================================================================
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
                             where e.company_id = p_company and a.work_date = today and a.late_minutes > 0), '[]'),
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
revoke all on function hr_dashboard_extra(uuid) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function hr_dashboard_extra(uuid) from anon;
    grant execute on function hr_dashboard_extra(uuid) to authenticated, service_role;
  end if;
end $$;
