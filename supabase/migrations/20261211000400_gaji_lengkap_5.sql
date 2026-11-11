-- =====================================================================
--  Gaji lengkap — pratonton gaji (Gaji Pekerja / profil) diselaraskan dengan enjin gaji baharu:
--  kategori KWSP/PERKESO, SIP, SKBBK (Lindung 24 Jam), zakat, CP38, pelepasan anak/OKU, TP1, bukan pemastautin.
--  Angka pratonton kini sama dengan slip sebenar (bagi item tetap).
-- =====================================================================

create or replace function pay_estimate(p_employment uuid, p_items jsonb, p_on date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e record; c companies; st record; k text; v jsonb; amt numeric; pc pay_components;
        g numeric := 0; ew numeric := 0; sw numeric := 0; iw numeric := 0; hw numeric := 0; tx numeric := 0; ded numeric := 0;
        epf record; so record; ei record; sk record; ytd record; v_pcb numeric; v_hrdf numeric; sedia boolean;
        d0 date := date_trunc('month', p_on)::date; d1 date; bln int; lp_ytd numeric; lp_now numeric; zk numeric; socso_age int;
begin
  select em.*, p.marital_status, p.spouse_working into e
    from employments em join persons p on p.id = em.person_id where em.id = p_employment;
  if e.id is null then return null; end if;
  select * into c from companies where id = e.company_id;
  d1 := (d0 + interval '1 month - 1 day')::date;
  bln := extract(month from d0)::int;
  sedia := stat_params('EPF', d1) is not null and stat_params('SOCSO', d1) is not null and stat_params('PCB', d1) is not null;
  select * into st from employment_stat_effective(p_employment, d1);

  for k, v in select * from jsonb_each(coalesce(p_items, '{}')) loop
    if jsonb_typeof(v) <> 'number' then continue; end if;
    amt := greatest((v #>> '{}')::numeric, 0);
    select * into pc from pay_components where company_id = e.company_id and code = k;
    if pc.id is null then continue; end if;
    if pc.kind in ('earning', 'benefit') then
      if pc.kind = 'earning' then g := g + amt; end if;
      if pc.taxable then tx := tx + amt; end if;
      if pc.kind = 'earning' then
        if pc.epf_applicable then ew := ew + amt; end if;
        if pc.socso_applicable then sw := sw + amt; end if;
        if coalesce(pc.eis_applicable, pc.socso_applicable) then iw := iw + amt; end if;
        if coalesce(pc.hrdf_applicable, pc.epf_applicable) then hw := hw + amt; end if;
      end if;
    else
      ded := ded + amt;
    end if;
  end loop;

  if not sedia then
    return jsonb_build_object('statutory_ready', false, 'gross', g, 'fixed_deduction', ded);
  end if;

  select * into epf from stat_epf2(ew, st.age, d1, c.epf_employer_rate, st.epf_category, st.epf_employee_rate);
  select 0::numeric as employee, 0::numeric as employer into so;
  select 0::numeric as employee, 0::numeric as employer into ei;
  select 0::numeric as employee, 0::numeric as employer into sk;
  socso_age := case st.socso_category when 'cat2' then 60 when 'foreign' then 60 else 0 end;
  if st.socso_category <> 'none' then select * into so from stat_socso_eis('SOCSO', sw, socso_age, d1); end if;
  if st.eis then select * into ei from stat_socso_eis('EIS', iw, 0, d1); end if;
  if st.skbbk then select * into sk from stat_socso_eis('SKBBK', sw, 0, d1); end if;

  -- Data terkumpul tahun ini (sama seperti payroll_calculate_core)
  select coalesce(sum(ps.gross - coalesce((select sum(amount) from payslip_lines x where x.payslip_id = ps.id and x.component_code = 'CLAIM'), 0)), 0) g,
         coalesce(sum(ps.epf_employee), 0) k, coalesce(sum(ps.pcb), 0) x, coalesce(sum(ps.zakat), 0) z
    into ytd
    from payslips ps join payroll_runs pr on pr.id = ps.payroll_run_id
   where ps.employment_id = e.id and pr.period_year = extract(year from d0) and pr.period_month < bln
     and pr.status in ('approved','paid','locked');
  select ytd.g + coalesce(ob.gross, 0) as g, ytd.k + coalesce(ob.epf, 0) as k, ytd.x + coalesce(ob.pcb, 0) as x, ytd.z as z into ytd
    from (select 1) z left join payroll_opening_balances ob
      on ob.employment_id = e.id and ob.year = extract(year from d0) and ob.up_to_month < bln;
  select coalesce(sum(amount) filter (where month < bln), 0), coalesce(sum(amount) filter (where month = bln), 0)
    into lp_ytd, lp_now from tp1_reliefs where employment_id = e.id and year = extract(year from d0);
  zk := least(st.zakat, g);
  v_pcb := stat_pcb2(bln, d1, ytd.g, ytd.k, ytd.x, tx, epf.employee, e.marital_status in ('berkahwin','married'), e.spouse_working,
                     st.child_units, st.extra_relief, lp_ytd, lp_now, ytd.z, zk, st.resident);
  v_hrdf := case when c.hrdf_registered then round(hw * coalesce((stat_params('HRDF', d1)->>'rate')::numeric, 1) / 100, 2) else 0 end;

  return jsonb_build_object(
    'statutory_ready', true,
    'gross', g,
    'fixed_deduction', ded,
    'epf_employee', epf.employee, 'epf_employer', epf.employer,
    'socso_employee', so.employee, 'socso_employer', so.employer,
    'eis_employee', ei.employee, 'eis_employer', ei.employer,
    'skbbk_employee', sk.employee, 'zakat', zk, 'cp38', st.cp38,
    'pcb', v_pcb,
    'hrdf', v_hrdf,
    'hrdf_registered', coalesce(c.hrdf_registered, false),
    'net', g - ded - epf.employee - so.employee - ei.employee - sk.employee - v_pcb - zk - st.cp38,
    'employer_cost', g + epf.employer + so.employer + ei.employer + v_hrdf
  );
end $$;
