-- =====================================================================
--  Gaji lengkap — enjin pengiraan baharu & laporan
--   payroll_calculate_core: asas prorata / cuti tanpa gaji ikut tetapan, item dalam asas cuti tanpa gaji,
--     kategori KWSP/PERKESO/SIP, SKBBK, zakat & CP38, TP1, tunggakan gaji automatik, manfaat (BIK),
--     kitaran tambahan (bonus: KWSP pada jumlah gaji bulan itu, PCB saraan tambahan)
--   payroll_export: + CP39 teks e-Data PCB, PERKESO gabungan 2026, CSV i-Akaun KWSP, jurnal GL
--   payroll_variance: perbandingan setiap pekerja dengan bulan lepas
--   pcb_statement: penyata PCB tahunan (PCB II)
--   ea_compute: + B1c, B2 (tunggakan), B3/B4 (BIK), B6, zakat
-- =====================================================================

-- PCB saraan tambahan (bonus dll): beza cukai setahun dengan & tanpa saraan tambahan
create or replace function stat_pcb_additional(p_month int, p_date date, p_ytd_gross numeric, p_ytd_epf numeric,
                                               p_reg_gross numeric, p_reg_epf numeric, p_add_gross numeric, p_add_epf numeric,
                                               p_married boolean, p_spouse_working boolean, p_child_units numeric, p_extra_relief numeric,
                                               p_lp numeric, p_resident boolean) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare k jsonb := stat_params('PCB', p_date); n int := 12 - p_month; epfmax numeric; spouse boolean; rel numeric;
        epf_tahun numeric; p0 numeric; p1 numeric; t numeric;
begin
  if k is null or p_add_gross <= 0 then return 0; end if;
  if not coalesce(p_resident, true) then
    return round(ceil(p_add_gross * coalesce((k->>'nonresident_rate')::numeric, 30) / 100 * 20) / 20, 2);
  end if;
  epfmax := (k->>'epf_relief_max')::numeric;
  spouse := coalesce(p_married, false) and not coalesce(p_spouse_working, true);
  rel := (k->>'relief_individual')::numeric + case when spouse then (k->>'relief_spouse')::numeric else 0 end
       + coalesce(p_child_units, 0) * (k->>'relief_child')::numeric + coalesce(p_extra_relief, 0) + coalesce(p_lp, 0);
  epf_tahun := least(p_ytd_epf + p_reg_epf * (n + 1), epfmax);
  p0 := p_ytd_gross + p_reg_gross * (n + 1) - epf_tahun - rel;
  p1 := p0 + p_add_gross - (least(p_ytd_epf + p_reg_epf * (n + 1) + p_add_epf, epfmax) - epf_tahun);
  t := greatest(stat_tax(p1, p_date) - stat_tax(greatest(p0, 0), p_date), 0);
  return round(ceil(t * 20) / 20, 2);
end $$;

-- Bahagian gaji (prorata) bagi seorang pekerja dalam satu bulan ikut asas syarikat
create or replace function pay_fraction(p_company uuid, p_basis text, p_d0 date, p_d1 date, p_join date, p_end date) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare a date := greatest(p_d0, p_join); b date := least(p_d1, coalesce(p_end, p_d1));
begin
  if b < a then return 0; end if;
  if a = p_d0 and b = p_d1 then return 1; end if;
  if p_basis = 'calendar' then return (b - a + 1)::numeric / (p_d1 - p_d0 + 1); end if;
  if p_basis = 'working' then return company_working_days(p_company, a, b)::numeric / greatest(company_working_days(p_company, p_d0, p_d1), 1); end if;
  return least(company_working_days(p_company, a, b)::numeric / 26, 1);   -- fixed26
end $$;

create or replace function payroll_calculate_core(p_run uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r payroll_runs; c companies; reg payroll_runs; d0 date; d1 date; e record; pid uuid; st record; regs payslips;
        v_basic numeric; v_frac numeric; v_ul numeric; v_base numeric; v_gross numeric; epf_wage numeric; socso_wage numeric; eis_wage numeric;
        hrdf_wage numeric; v_taxable numeric; v_ded numeric; epf record; so record; ei record; sk record; v_pcb numeric; ytd record; ln record;
        v_totals jsonb; prev uuid; v_tuntutan numeric; lp_now numeric; lp_ytd numeric; zk_ytd numeric; zk_now numeric; cp numeric;
        m date; jangka numeric; dibayar numeric; nama_bulan text[] := array['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogo','Sep','Okt','Nov','Dis'];
        socso_age int; tambahan boolean;
begin
  select * into r from payroll_runs where id = p_run for update;
  if r.id is null or not has_role(r.company_id, '{hr,finance,admin}') then raise exception 'Hanya HR/Kewangan'; end if;
  if r.status not in ('draft','calculated','returned') then raise exception 'Gaji ini telah dihantar untuk kelulusan'; end if;
  select * into c from companies where id = r.company_id;
  d0 := make_date(r.period_year, r.period_month, 1);
  d1 := (d0 + interval '1 month - 1 day')::date;
  tambahan := r.kind = 'additional';
  if tambahan then
    select * into reg from payroll_runs where company_id = r.company_id and period_year = r.period_year and period_month = r.period_month and cycle_no = 1;
  else
    update claims set paid_via_payroll_run = null where paid_via_payroll_run = r.id and paid_at is null;
  end if;
  delete from payslips where payroll_run_id = r.id;

  for e in select em.*, p.marital_status, p.spouse_working, p.full_name
             from employments em join persons p on p.id = em.person_id
            where em.company_id = r.company_id and em.join_date <= d1
              and (em.status in ('probation','active') or em.end_date >= d0)
              and (not tambahan or exists (select 1 from payroll_adjustments a where a.payroll_run_id = r.id and a.employment_id = em.id))
            order by em.employee_no loop
    insert into payslips(payroll_run_id, employment_id) values (r.id, e.id) returning id into pid;
    select * into st from employment_stat_effective(e.id, d1);
    v_ul := 0; lp_now := 0; zk_now := 0; cp := 0;

    if not tambahan then
      -- Gaji pokok, prorata ikut asas syarikat (pekerja mula / tamat pada bulan ini)
      select coalesce(sum(ec.amount), 0) into v_basic from employment_compensation ec join pay_components pc on pc.id = ec.component_id
       where ec.employment_id = e.id and pc.code = 'BASIC' and ec.effective_from <= d1 and (ec.effective_to is null or ec.effective_to >= d1);
      v_frac := pay_fraction(r.company_id, c.prorate_basis, d0, d1, e.join_date, e.end_date);
      if round(v_basic * v_frac, 2) > 0 then
        insert into payslip_lines(payslip_id, component_code, description, kind, amount)
        values (pid, 'BASIC', 'Gaji pokok' || case when v_frac < 1 then ' (prorata ' || round(v_frac * 100) || '%)' else '' end, 'earning', round(v_basic * v_frac, 2));
      end if;

      -- Item tetap (elaun, potongan, BIK) & pelarasan bulan ini
      for ln in select pc.code, pc.name, pc.kind, ec.amount, false as sekali from employment_compensation ec join pay_components pc on pc.id = ec.component_id
                 where ec.employment_id = e.id and pc.code not in ('BASIC','CLAIM','UNPAID','ARREARS')
                   and ec.effective_from <= d1 and (ec.effective_to is null or ec.effective_to >= d1)
                union all
                select a.component_code, coalesce(nullif(a.note, ''), pc.name), pc.kind, a.amount, true from payroll_adjustments a
                  join pay_components pc on pc.company_id = r.company_id and pc.code = a.component_code
                 where a.payroll_run_id = r.id and a.employment_id = e.id loop
        insert into payslip_lines(payslip_id, component_code, description, kind, amount)
        values (pid, ln.code, ln.name, ln.kind, round(ln.amount * case when ln.kind = 'earning' and not ln.sekali then v_frac else 1 end, 2));
      end loop;

      -- Tunggakan gaji: kenaikan gaji pokok berkuat kuasa ke belakang bagi bulan yang telah dibayar (tahun semasa)
      if exists (select 1 from pay_components where company_id = r.company_id and code = 'ARREARS') then
        for m in select make_date(pr.period_year, pr.period_month, 1) from payroll_runs pr
                  where pr.company_id = r.company_id and pr.kind = 'regular' and pr.period_year = r.period_year and pr.period_month < r.period_month
                    and pr.status in ('approved','paid','locked')
                    and exists (select 1 from payslips x where x.payroll_run_id = pr.id and x.employment_id = e.id) loop
          select coalesce(sum(ec.amount), 0) * pay_fraction(r.company_id, c.prorate_basis, m, (m + interval '1 month - 1 day')::date, e.join_date, e.end_date)
            into jangka from employment_compensation ec join pay_components pc on pc.id = ec.component_id
           where ec.employment_id = e.id and pc.code = 'BASIC' and ec.effective_from <= (m + interval '1 month - 1 day')::date
             and (ec.effective_to is null or ec.effective_to >= (m + interval '1 month - 1 day')::date);
          select coalesce(sum(l.amount), 0) into dibayar from payslip_lines l join payslips x on x.id = l.payslip_id join payroll_runs pr on pr.id = x.payroll_run_id
           where x.employment_id = e.id and pr.status in ('approved','paid','locked') and pr.id <> r.id
             and ((l.component_code = 'BASIC' and pr.period_year = extract(year from m) and pr.period_month = extract(month from m) and pr.kind = 'regular')
                  or (l.component_code = 'ARREARS' and l.ref_month = m));
          if round(jangka - dibayar, 2) >= 1 then
            insert into payslip_lines(payslip_id, component_code, description, kind, amount, ref_month)
            values (pid, 'ARREARS', 'Tunggakan gaji ' || nama_bulan[extract(month from m)::int] || ' ' || extract(year from m), 'earning', round(jangka - dibayar, 2), m);
          end if;
        end loop;
      end if;

      -- Cuti tanpa gaji: (gaji pokok + item dipilih) ÷ asas × hari
      select coalesce(sum(lr.days), 0) into v_ul from leave_requests lr join leave_types lt on lt.id = lr.leave_type_id
       where lr.employment_id = e.id and lt.code = 'UL' and lr.status = 'approved' and lr.start_date between d0 and d1;
      if v_ul > 0 then
        select coalesce(sum(ec.amount), 0) into v_base from employment_compensation ec join pay_components pc on pc.id = ec.component_id
         where ec.employment_id = e.id and (pc.code = 'BASIC' or pc.code = any(c.unpaid_items))
           and ec.effective_from <= d1 and (ec.effective_to is null or ec.effective_to >= d1);
        insert into payslip_lines(payslip_id, component_code, description, kind, amount)
        values (pid, 'UNPAID', 'Cuti tanpa gaji (' || v_ul || ' hari)', 'deduction', round(v_base / pay_divisor(r.company_id, c.unpaid_basis, d0, d1) * v_ul, 2));
      end if;

      -- Tuntutan diluluskan yang belum dibayar
      update claims cl set paid_via_payroll_run = r.id
       where cl.employment_id = e.id and cl.status = 'approved' and cl.paid_at is null and cl.paid_via_payroll_run is null;
      select coalesce(sum(total_amount), 0) into v_tuntutan from claims where paid_via_payroll_run = r.id and employment_id = e.id and paid_at is null;
      if v_tuntutan > 0 then
        insert into payslip_lines(payslip_id, component_code, description, kind, amount)
        values (pid, 'CLAIM', 'Bayaran balik tuntutan', 'earning', v_tuntutan);
      end if;
    else
      -- Kitaran tambahan: pelarasan sahaja (bonus, insentif …)
      insert into payslip_lines(payslip_id, component_code, description, kind, amount)
      select pid, a.component_code, coalesce(nullif(a.note, ''), pc.name), pc.kind, a.amount from payroll_adjustments a
        join pay_components pc on pc.company_id = r.company_id and pc.code = a.component_code
       where a.payroll_run_id = r.id and a.employment_id = e.id;
    end if;

    -- Asas caruman & cukai: pendapatan tolak cuti tanpa gaji
    select coalesce(sum(case when l.kind = 'earning' then l.amount when l.component_code = 'UNPAID' then -l.amount else 0 end), 0),
           coalesce(sum(case when pc.epf_applicable then case when l.kind = 'earning' then l.amount when l.component_code = 'UNPAID' then -l.amount else 0 end else 0 end), 0),
           coalesce(sum(case when pc.socso_applicable then case when l.kind = 'earning' then l.amount when l.component_code = 'UNPAID' then -l.amount else 0 end else 0 end), 0),
           coalesce(sum(case when coalesce(pc.eis_applicable, pc.socso_applicable) then case when l.kind = 'earning' then l.amount when l.component_code = 'UNPAID' then -l.amount else 0 end else 0 end), 0),
           coalesce(sum(case when coalesce(pc.hrdf_applicable, pc.epf_applicable) then case when l.kind = 'earning' then l.amount when l.component_code = 'UNPAID' then -l.amount else 0 end else 0 end), 0),
           coalesce(sum(case when pc.taxable then case when l.kind in ('earning','benefit') then l.amount when l.component_code = 'UNPAID' then -l.amount else 0 end else 0 end), 0)
      into v_gross, epf_wage, socso_wage, eis_wage, hrdf_wage, v_taxable
      from payslip_lines l left join pay_components pc on pc.company_id = r.company_id and pc.code = l.component_code
     where l.payslip_id = pid and l.kind in ('earning','deduction','benefit');
    v_gross := greatest(v_gross, 0);

    -- KWSP (kitaran tambahan: caruman atas jumlah gaji bulan ini tolak yang telah dicarum dalam kitaran biasa)
    select * into epf from stat_epf2(greatest(epf_wage, 0), st.age, d1, c.epf_employer_rate, st.epf_category, st.epf_employee_rate);
    if tambahan and reg.id is not null then
      select * into regs from payslips where payroll_run_id = reg.id and employment_id = e.id;
      if regs.id is not null then
        select * into epf from stat_epf2(greatest(epf_wage, 0) + payslip_wage(regs.id, 'epf'), st.age, d1, c.epf_employer_rate, st.epf_category, st.epf_employee_rate);
        epf.employee := greatest(epf.employee - regs.epf_employee, 0);
        epf.employer := greatest(epf.employer - regs.epf_employer, 0);
      end if;
    end if;

    -- PERKESO / SIP / SKBBK (kitaran biasa sahaja; bonus bukan "gaji" bagi PERKESO)
    select 0::numeric as employee, 0::numeric as employer into so;
    select 0::numeric as employee, 0::numeric as employer into ei;
    select 0::numeric as employee, 0::numeric as employer into sk;
    if not tambahan then
      socso_age := case st.socso_category when 'cat2' then 60 when 'foreign' then 60 else 0 end;
      if st.socso_category <> 'none' then select * into so from stat_socso_eis('SOCSO', greatest(socso_wage, 0), socso_age, d1); end if;
      if st.eis then select * into ei from stat_socso_eis('EIS', greatest(eis_wage, 0), 0, d1); end if;
      if st.skbbk then select * into sk from stat_socso_eis('SKBBK', greatest(socso_wage, 0), 0, d1); end if;
    end if;

    -- Data tahun semasa (bulan & kitaran terdahulu yang diluluskan)
    select coalesce(sum(ps.gross - coalesce((select sum(amount) from payslip_lines x where x.payslip_id = ps.id and x.component_code = 'CLAIM'), 0)
                        + coalesce((select sum(amount) from payslip_lines x join pay_components q on q.company_id = r.company_id and q.code = x.component_code
                                     where x.payslip_id = ps.id and x.kind = 'benefit' and q.taxable), 0)), 0) g,
           coalesce(sum(ps.epf_employee), 0) k, coalesce(sum(ps.pcb), 0) x, coalesce(sum(ps.zakat), 0) z
      into ytd
      from payslips ps join payroll_runs pr on pr.id = ps.payroll_run_id
     where ps.employment_id = e.id and pr.period_year = r.period_year and pr.status in ('approved','paid','locked')
       and (pr.period_month < r.period_month or (pr.period_month = r.period_month and pr.cycle_no < r.cycle_no and tambahan));
    select ytd.g + coalesce(ob.gross, 0) as g, ytd.k + coalesce(ob.epf, 0) as k, ytd.x + coalesce(ob.pcb, 0) as x, ytd.z as z into ytd
      from (select 1) z left join payroll_opening_balances ob
        on ob.employment_id = e.id and ob.year = r.period_year and ob.up_to_month < r.period_month;
    select coalesce(sum(amount) filter (where month < r.period_month), 0), coalesce(sum(amount) filter (where month = r.period_month), 0)
      into lp_ytd, lp_now from tp1_reliefs where employment_id = e.id and year = r.period_year;

    if not tambahan then
      zk_now := least(st.zakat, greatest(v_gross, 0));
      cp := st.cp38;
      v_pcb := stat_pcb2(r.period_month, d1, ytd.g, ytd.k, ytd.x, greatest(v_taxable, 0), epf.employee,
                         e.marital_status in ('berkahwin','married'), e.spouse_working, st.child_units, st.extra_relief,
                         lp_ytd, lp_now, ytd.z, zk_now, st.resident);
    else
      v_pcb := stat_pcb_additional(r.period_month, d1, ytd.g - coalesce(regs.gross, 0), ytd.k - coalesce(regs.epf_employee, 0),
                                   coalesce(regs.gross, 0), coalesce(regs.epf_employee, 0), greatest(v_taxable, 0), epf.employee,
                                   e.marital_status in ('berkahwin','married'), e.spouse_working, st.child_units, st.extra_relief,
                                   lp_ytd + lp_now, st.resident);
    end if;

    insert into payslip_lines(payslip_id, component_code, description, kind, amount)
    select pid, v.code, v.descr, v.kind, v.amt from (values
      ('EPF', 'KWSP', 'deduction', epf.employee), ('SOCSO', 'PERKESO', 'deduction', coalesce(so.employee, 0)),
      ('EIS', 'SIP', 'deduction', coalesce(ei.employee, 0)), ('SKBBK', 'Lindung 24 Jam (SKBBK)', 'deduction', coalesce(sk.employee, 0)),
      ('PCB', 'PCB', 'deduction', v_pcb), ('ZAKAT', 'Zakat', 'deduction', zk_now), ('CP38', 'Potongan cukai CP38', 'deduction', cp),
      ('EPF_ER', 'KWSP majikan', 'employer', epf.employer), ('SOCSO_ER', 'PERKESO majikan', 'employer', coalesce(so.employer, 0)),
      ('EIS_ER', 'SIP majikan', 'employer', coalesce(ei.employer, 0)),
      ('HRDF', 'Levi HRD Corp', 'employer', case when c.hrdf_registered and not tambahan then round(greatest(hrdf_wage, 0) * coalesce((stat_params('HRDF', d1)->>'rate')::numeric, 1) / 100, 2) else 0 end)
    ) v(code, descr, kind, amt) where v.amt > 0;

    select coalesce(sum(amount) filter (where kind = 'deduction' and component_code <> 'UNPAID'), 0) into v_ded
      from payslip_lines where payslip_id = pid;
    update payslips set gross = v_gross, total_deduction = v_ded, net = v_gross - v_ded,
           epf_employee = epf.employee, epf_employer = epf.employer, socso_employee = coalesce(so.employee, 0), socso_employer = coalesce(so.employer, 0),
           eis_employee = coalesce(ei.employee, 0), eis_employer = coalesce(ei.employer, 0), pcb = v_pcb,
           skbbk_employee = coalesce(sk.employee, 0), zakat = zk_now, cp38 = cp,
           hrdf = coalesce((select amount from payslip_lines where payslip_id = pid and component_code = 'HRDF'), 0),
           unpaid_leave_days = v_ul
     where id = pid;
  end loop;

  select id into prev from payroll_runs where company_id = r.company_id and cycle_no = 1
     and make_date(period_year, period_month, 1) = (d0 - interval '1 month')::date;
  select jsonb_build_object(
    'headcount', count(*), 'gross', coalesce(sum(gross), 0), 'net', coalesce(sum(net), 0),
    'employer', coalesce(sum(epf_employer + socso_employer + eis_employer + hrdf), 0), 'pcb', coalesce(sum(pcb), 0),
    'epf', coalesce(sum(epf_employee + epf_employer), 0), 'socso', coalesce(sum(socso_employee + socso_employer), 0),
    'eis', coalesce(sum(eis_employee + eis_employer), 0), 'skbbk', coalesce(sum(skbbk_employee), 0),
    'zakat', coalesce(sum(zakat), 0), 'cp38', coalesce(sum(cp38), 0),
    'claims', (select coalesce(sum(amount), 0) from payslip_lines l join payslips x on x.id = l.payslip_id
                where x.payroll_run_id = r.id and l.component_code = 'CLAIM'),
    'previous_run', prev, 'calculated_at', now()
  ) into v_totals from payslips where payroll_run_id = r.id;
  update payroll_runs set status = 'calculated', totals = v_totals where id = r.id;
  perform emit_event(r.company_id, 'payroll.calculated', current_person_id(), null,
                     jsonb_build_object('run_id', r.id, 'gross', v_totals->'gross'));
  return v_totals;
end $$;
revoke all on function payroll_calculate_core(uuid) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function payroll_calculate_core(uuid) from anon, authenticated; end if;
end $$;

-- Ubah pratonton gaji / OT supaya menggunakan asas syarikat
create or replace function approval_extra_outcome() returns trigger
language plpgsql security definer set search_path = public as $$
declare o overtime_requests; asas numeric; kadar numeric; seterusnya date; c companies; d0 date;
begin
  if new.status = old.status then return new; end if;
  if new.request_type = 'overtime' then
    update overtime_requests set status = new.status where id = new.reference_id returning * into o;
    if new.status = 'approved' and o.id is not null then
      select * into c from companies where id = new.company_id;
      d0 := date_trunc('month', o.work_date)::date;
      select coalesce(sum(ec.amount), 0) into asas from employment_compensation ec join pay_components pc on pc.id = ec.component_id
       where ec.employment_id = o.employment_id and (pc.code = 'BASIC' or pc.code = any(c.ot_items))
         and ec.effective_from <= o.work_date and (ec.effective_to is null or ec.effective_to >= o.work_date);
      kadar := case o.day_type when 'rest' then 2.0 when 'holiday' then 3.0 else 1.5 end;
      update overtime_requests set amount = round(asas / pay_divisor(c.id, c.ot_basis, d0, (d0 + interval '1 month - 1 day')::date) / c.hours_per_day * kadar * o.hours, 2),
             monthly_basic = asas where id = o.id;
    end if;
  elsif new.request_type = 'salary_advance' then
    seterusnya := (date_trunc('month', (now() at time zone 'Asia/Kuala_Lumpur')::date) + interval '1 month')::date;
    update salary_advances set status = new.status,
           deduct_year = case when new.status = 'approved' then extract(year from seterusnya)::int end,
           deduct_month = case when new.status = 'approved' then extract(month from seterusnya)::int end
     where id = new.reference_id;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Fail berkanun
-- ---------------------------------------------------------------------------------------------
create or replace function digits(p text) returns text language sql immutable as $$ select regexp_replace(coalesce(p, ''), '\D', '', 'g') $$;
create or replace function sen(p numeric) returns text language sql immutable as $$ select (round(coalesce(p, 0) * 100))::bigint::text $$;

create or replace function payroll_export(p_run uuid, p_kind text) returns text
language plpgsql security definer set search_path = public as $$
declare r payroll_runs; c companies; out text; ehq text; bulan text;
begin
  select * into r from payroll_runs where id = p_run;
  if r.id is null or not has_role(r.company_id, '{hr,finance,admin}') then raise exception 'Hanya HR/Kewangan'; end if;
  if r.status not in ('approved','paid','locked') then raise exception 'Gaji belum diluluskan'; end if;
  select * into c from companies where id = r.company_id;
  insert into data_access_log(actor_person_id, subject_person_id, resource, via)
  select current_person_id(), e.person_id, 'payslip', 'web' from payslips s join employments e on e.id = s.employment_id where s.payroll_run_id = r.id;
  bulan := lpad(r.period_month::text, 2, '0') || r.period_year;

  if p_kind = 'bank' then
    select 'Nama,No. Akaun,Bank,Jumlah,Rujukan' || E'\n' || coalesce(string_agg(
             format('"%s",%s,"%s",%s,GAJI%s%s', p.full_name, coalesce(p.bank_account_no, ''), coalesce(p.bank_name, ''),
                    to_char(s.net, 'FM999999990.00'), r.period_year, lpad(r.period_month::text, 2, '0')), E'\n' order by p.full_name), '')
      into out from payslips s join employments e on e.id = s.employment_id join persons p on p.id = e.person_id
     where s.payroll_run_id = r.id and s.net > 0;
  elsif p_kind = 'epf' then
    -- CSV i-Akaun (Majikan): No. Ahli, No. KP, Nama, Upah, Caruman Majikan, Caruman Pekerja
    select 'No. Ahli KWSP,No. KP,Nama,Upah,Caruman Majikan,Caruman Pekerja' || E'\n' || coalesce(string_agg(
             format('%s,%s,"%s",%s,%s,%s', digits(e.epf_no), digits(coalesce(p.ic_no, p.passport_no)), upper(p.full_name),
                    to_char(payslip_wage(s.id, 'epf'), 'FM999999990.00'), to_char(s.epf_employer, 'FM999999990'), to_char(s.epf_employee, 'FM999999990')),
             E'\n' order by p.full_name), '')
      into out from payslips s join employments e on e.id = s.employment_id join persons p on p.id = e.person_id
     where s.payroll_run_id = r.id and (s.epf_employee > 0 or s.epf_employer > 0);
  elsif p_kind = 'socso' then
    select 'No. Majikan,No. KP,Nama,Gaji,PERKESO Pekerja,PERKESO Majikan,SIP Pekerja,SIP Majikan,SKBBK Pekerja' || E'\n' || coalesce(string_agg(
             format('%s,%s,"%s",%s,%s,%s,%s,%s,%s', coalesce(c.socso_employer_no, ''), coalesce(p.ic_no, ''), p.full_name,
                    to_char(payslip_wage(s.id, 'socso'), 'FM999999990.00'), to_char(s.socso_employee, 'FM999999990.00'), to_char(s.socso_employer, 'FM999999990.00'),
                    to_char(s.eis_employee, 'FM999999990.00'), to_char(s.eis_employer, 'FM999999990.00'), to_char(s.skbbk_employee, 'FM999999990.00')), E'\n' order by p.full_name), '')
      into out from payslips s join employments e on e.id = s.employment_id join persons p on p.id = e.person_id
     where s.payroll_run_id = r.id;
  elsif p_kind = 'socso_txt' then
    -- PERKESO gabungan (PERKESO + SIP + SKBBK) mulai Okt 2026: satu baris setiap pekerja, amaun dalam sen, bulan BBTTTT.
    -- Susunan medan mengikut panduan; sahkan dengan "Combine SOCSO + EIS Contribution Text File Format" v2.1 sebelum digunakan.
    select coalesce(string_agg(
             concat_ws('|', upper(coalesce(c.socso_employer_no, '')),
                       case when coalesce(p.nationality, 'MY') in ('MY', '') then digits(p.ic_no) else coalesce(st.ssfw_no, p.passport_no, '') end,
                       upper(p.full_name), bulan, sen(payslip_wage(s.id, 'socso')),
                       sen(s.socso_employer), sen(s.socso_employee), sen(s.eis_employer), sen(s.eis_employee), sen(s.skbbk_employee)),
             E'\r\n' order by p.full_name), '')
      into out from payslips s join employments e on e.id = s.employment_id join persons p on p.id = e.person_id
      left join employment_statutory st on st.employment_id = e.id
     where s.payroll_run_id = r.id and (s.socso_employer > 0 or s.eis_employee > 0 or s.skbbk_employee > 0);
  elsif p_kind = 'pcb' then
    select 'No. E,No. Cukai,No. KP,Nama,PCB,CP38,Zakat,Bulan,Tahun' || E'\n' || coalesce(string_agg(
             format('%s,%s,%s,"%s",%s,%s,%s,%s,%s', coalesce(c.lhdn_employer_no, ''), coalesce(e.tax_no, ''), coalesce(p.ic_no, ''), p.full_name,
                    to_char(s.pcb, 'FM999999990.00'), to_char(s.cp38, 'FM999999990.00'), to_char(s.zakat, 'FM999999990.00'), r.period_month, r.period_year), E'\n' order by p.full_name), '')
      into out from payslips s join employments e on e.id = s.employment_id join persons p on p.id = e.person_id
     where s.payroll_run_id = r.id and (s.pcb > 0 or s.cp38 > 0);
  elsif p_kind = 'pcb_txt' then
    -- CP39 teks e-Data PCB (LHDN): rekod H (57 aksara) + rekod D (136 aksara), amaun dalam sen.
    -- H: H | No. E ibu pejabat (10) | No. E cawangan (10) | tahun (4) | bulan (2) | jumlah PCB (10) | bil. PCB (5) | jumlah CP38 (10) | bil. CP38 (5)
    -- D: D | no. cukai (10) | kod isteri (1) | nama (60) | KP lama (12) | KP baru (12) | pasport (12) | kod negara (2) | PCB (8) | CP38 (8) | no. pekerja (10)
    ehq := right(lpad(digits(c.lhdn_employer_no), 10, '0'), 10);
    select 'H' || ehq || ehq || r.period_year::text || lpad(r.period_month::text, 2, '0')
           || lpad(sen(sum(s.pcb)), 10, '0') || lpad((count(*) filter (where s.pcb > 0))::text, 5, '0')
           || lpad(sen(sum(s.cp38)), 10, '0') || lpad((count(*) filter (where s.cp38 > 0))::text, 5, '0')
           || coalesce(E'\r\n' || string_agg(
             'D' || right(lpad(digits(e.tax_no), 10, '0'), 10) || '0'
             || rpad(left(upper(regexp_replace(p.full_name, '[^A-Za-z@''/(),.\- ]', '', 'g')), 60), 60)
             || rpad('', 12)
             || rpad(case when coalesce(p.nationality, 'MY') in ('MY', '') then left(digits(p.ic_no), 12) else '' end, 12)
             || rpad(case when coalesce(p.nationality, 'MY') not in ('MY', '') then left(upper(coalesce(p.passport_no, '')), 12) else '' end, 12)
             || rpad(case when coalesce(p.nationality, 'MY') not in ('MY', '') then left(upper(p.nationality), 2) else '' end, 2)
             || lpad(sen(s.pcb), 8, '0') || lpad(sen(s.cp38), 8, '0')
             || rpad(left(coalesce(e.employee_no, ''), 10), 10),
             E'\r\n' order by p.full_name), '')
      into out from payslips s join employments e on e.id = s.employment_id join persons p on p.id = e.person_id
     where s.payroll_run_id = r.id and (s.pcb > 0 or s.cp38 > 0);
    if out is null then
      out := 'H' || ehq || ehq || r.period_year::text || lpad(r.period_month::text, 2, '0') || lpad('0', 10, '0') || lpad('0', 5, '0') || lpad('0', 10, '0') || lpad('0', 5, '0');
    end if;
  elsif p_kind = 'gl' then
    -- Jurnal gaji (debit belanja, kredit liabiliti) mengikut akaun dalam katalog item & Tetapan Gaji
    with l as (
      select l.component_code, l.kind, sum(l.amount) amt from payslip_lines l join payslips s on s.id = l.payslip_id
       where s.payroll_run_id = r.id group by 1, 2
    ), akaun as (
      select coalesce(nullif(pc.account_ref, ''), case when l.kind = 'earning' then coalesce(c.gl_accounts->>'salary_expense', 'Gaji & Upah') else 'Potongan gaji' end) acc,
             case when l.kind = 'earning' then l.amt else 0 end dr, case when l.kind = 'deduction' and l.component_code not in ('EPF','SOCSO','EIS','SKBBK','PCB','ZAKAT','CP38','UNPAID') then l.amt else 0 end cr
        from l left join pay_components pc on pc.company_id = r.company_id and pc.code = l.component_code
       where l.kind in ('earning','deduction') and l.component_code not in ('EPF','SOCSO','EIS','SKBBK','PCB','ZAKAT','CP38')
      union all select coalesce(c.gl_accounts->>'salary_expense', 'Gaji & Upah'), 0, coalesce((select amt from l where component_code = 'UNPAID'), 0)
      union all select coalesce(c.gl_accounts->>'employer_expense', 'Caruman majikan'), coalesce((select sum(amt) from l where kind = 'employer'), 0), 0
      union all select coalesce(c.gl_accounts->>'epf_payable', 'KWSP perlu dibayar'), 0, coalesce((select sum(amt) from l where component_code in ('EPF','EPF_ER')), 0)
      union all select coalesce(c.gl_accounts->>'socso_payable', 'PERKESO & SIP perlu dibayar'), 0, coalesce((select sum(amt) from l where component_code in ('SOCSO','SOCSO_ER','EIS','EIS_ER','SKBBK')), 0)
      union all select coalesce(c.gl_accounts->>'pcb_payable', 'PCB perlu dibayar'), 0, coalesce((select sum(amt) from l where component_code in ('PCB','CP38')), 0)
      union all select coalesce(c.gl_accounts->>'zakat_payable', 'Zakat perlu dibayar'), 0, coalesce((select sum(amt) from l where component_code = 'ZAKAT'), 0)
      union all select coalesce(c.gl_accounts->>'hrdf_payable', 'Levi HRD Corp perlu dibayar'), 0, coalesce((select sum(amt) from l where component_code = 'HRDF'), 0)
      union all select coalesce(c.gl_accounts->>'net_payable', 'Gaji bersih perlu dibayar'), 0, (select coalesce(sum(net), 0) from payslips where payroll_run_id = r.id)
    )
    select 'Tarikh,Akaun,Keterangan,Debit,Kredit' || E'\n' || coalesce(string_agg(
             format('%s,"%s","Gaji %s",%s,%s', to_char(coalesce(r.pay_date, (make_date(r.period_year, r.period_month, 1) + interval '1 month - 1 day')::date), 'YYYY-MM-DD'),
                    acc, bulan, to_char(dr, 'FM999999990.00'), to_char(cr, 'FM999999990.00')), E'\n' order by dr desc, acc), '')
      into out from (select acc, sum(dr) dr, sum(cr) cr from akaun group by acc having sum(dr) <> 0 or sum(cr) <> 0) z;
  else
    raise exception 'Jenis fail tidak sah';
  end if;
  insert into payroll_run_events(run_id, action, note, actor) values (r.id, 'export', p_kind, current_person_id());
  return out;
end $$;

-- Laporan varians: setiap pekerja berbanding kitaran biasa bulan lepas
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
  select coalesce(s.employment_id, l.employment_id), e.employee_no, coalesce(p.preferred_name, p.full_name),
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

-- Penyata PCB tahunan seorang pekerja (PCB II)
create or replace function pcb_statement(p_employment uuid, p_year int)
returns table(month int, cycle_no int, pcb numeric, cp38 numeric, zakat numeric, receipt_no text, pay_date date)
language plpgsql stable security definer set search_path = public as $$
declare e employments;
begin
  select * into e from employments where id = p_employment;
  if e.id is null or not (has_role(e.company_id, '{hr,finance,admin}') or e.person_id = current_person_id()) then raise exception 'Tidak dibenarkan'; end if;
  return query
  select r.period_month, r.cycle_no, s.pcb, s.cp38, s.zakat, r.pcb_receipt_no, r.pay_date
    from payslips s join payroll_runs r on r.id = s.payroll_run_id
   where s.employment_id = p_employment and r.period_year = p_year and r.status in ('approved','paid','locked')
   order by r.period_month, r.cycle_no;
end $$;

create or replace function payroll_set_receipt(p_run uuid, p_receipt text) returns void
language plpgsql security definer set search_path = public as $$
declare r payroll_runs;
begin
  select * into r from payroll_runs where id = p_run;
  if r.id is null or not has_role(r.company_id, '{hr,finance,admin}') then raise exception 'Hanya HR/Kewangan'; end if;
  update payroll_runs set pcb_receipt_no = nullif(trim(p_receipt), '') where id = p_run;
end $$;

-- Kesediaan data gaji setiap pekerja (penanda "maklumat tidak lengkap")
create or replace function payroll_readiness(p_company uuid)
returns table(employment_id uuid, missing text[])
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_role(p_company, '{hr,finance,admin}') then raise exception 'Hanya HR/Kewangan'; end if;
  return query
  select e.id, array_remove(array[
           case when p.ic_no is null and p.passport_no is null then 'no. KP / pasport' end,
           case when p.bank_account_no is null then 'akaun bank' end,
           case when e.epf_no is null and coalesce(s.epf_category, 'auto') <> 'none' then 'no. KWSP' end,
           case when not exists (select 1 from employment_compensation ec join pay_components pc on pc.id = ec.component_id
                                  where ec.employment_id = e.id and pc.code = 'BASIC' and (ec.effective_to is null or ec.effective_to >= current_date)) then 'gaji pokok' end,
           case when p.marital_status is null then 'status perkahwinan (PCB)' end,
           case when coalesce(p.nationality, 'MY') not in ('MY', '') and p.passport_no is null then 'no. pasport' end
         ], null)
    from employments e join persons p on p.id = e.person_id left join employment_statutory s on s.employment_id = e.id
   where e.company_id = p_company and e.status in ('probation','active');
end $$;

-- Borang EA: medan mengikut katalog item (B1a/B1b/B1c/B2/B3/B4/B6) & zakat melalui gaji
create or replace function ea_compute(p_company uuid, p_year int, p_employment uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with runs as (
    select r.id from payroll_runs r
     where r.company_id = p_company and r.period_year = p_year and r.status in ('approved','paid','locked')
  ), ps as (
    select s.* from payslips s where s.payroll_run_id in (select id from runs)
      and (p_employment is null or s.employment_id = p_employment)
  ), ln as (
    select ps.employment_id,
           sum(case when l.kind = 'earning' and coalesce(pc.ea_field, case when l.component_code in ('COMMISSION','BONUS') then 'B1b' else 'B1a' end) = 'B1a' and l.component_code <> 'CLAIM' then l.amount
                    when l.kind = 'deduction' and l.component_code in ('UNPAID','UL') then -l.amount else 0 end) as b1a,
           sum(case when l.kind = 'earning' and (pc.ea_field = 'B1b' or (pc.ea_field is null and l.component_code in ('COMMISSION','BONUS'))) then l.amount else 0 end) as b1b,
           sum(case when l.kind = 'earning' and pc.ea_field = 'B1c' then l.amount else 0 end) as b1c,
           sum(case when l.kind = 'earning' and pc.ea_field = 'B2' then l.amount else 0 end) as b2,
           sum(case when l.kind in ('earning','benefit') and pc.ea_field = 'B3' then l.amount else 0 end) as b3,
           sum(case when l.kind in ('earning','benefit') and pc.ea_field = 'B4' then l.amount else 0 end) as b4,
           sum(case when l.kind = 'earning' and pc.ea_field = 'B6' then l.amount else 0 end) as b6
      from ps join payslip_lines l on l.payslip_id = ps.id
      left join pay_components pc on pc.company_id = p_company and pc.code = l.component_code
     group by ps.employment_id
  ), agg as (
    select ps.employment_id, count(distinct (select r2.period_month from payroll_runs r2 where r2.id = ps.payroll_run_id)) as months,
           sum(ps.pcb) as pcb, sum(ps.cp38) as cp38, sum(ps.zakat) as zakat, sum(ps.epf_employee) as epf,
           sum(ps.socso_employee + ps.eis_employee) as socso
      from ps group by ps.employment_id
  ), ob as (
    select o.* from payroll_opening_balances o
      join employments e on e.id = o.employment_id
     where e.company_id = p_company and o.year = p_year and (p_employment is null or o.employment_id = p_employment)
  ), ids as (
    select employment_id from agg union select employment_id from ob
  )
  select coalesce(jsonb_agg(x order by x.employee_no), '[]'::jsonb) from (
    select e.id as employment_id, e.employee_no, p.id as person_id, p.full_name, p.ic_no, e.tax_no, e.epf_no, e.socso_no,
           ps2.title as position,
           case when extract(year from e.join_date) = p_year then e.join_date end as join_date,
           case when e.end_date is not null and extract(year from e.end_date) = p_year then e.end_date end as end_date,
           coalesce(agg.months, 0) + coalesce(ob.up_to_month, 0) as months,
           round(coalesce(ln.b1a, 0) + coalesce(ob.gross, 0), 2) as b1a,
           round(coalesce(ln.b1b, 0), 2) as b1b,
           round(coalesce(ln.b1c, 0), 2) as b1c,
           round(coalesce(ln.b2, 0), 2) as b2,
           round(coalesce(ln.b3, 0), 2) as b3,
           round(coalesce(ln.b4, 0), 2) as b4,
           round(coalesce(ln.b6, 0), 2) as b6,
           round(coalesce(ln.b1a, 0) + coalesce(ob.gross, 0) + coalesce(ln.b1b, 0) + coalesce(ln.b1c, 0) + coalesce(ln.b2, 0)
                 + coalesce(ln.b3, 0) + coalesce(ln.b4, 0) + coalesce(ln.b6, 0), 2) as total_income,
           round(coalesce(agg.pcb, 0) + coalesce(ob.pcb, 0), 2) as pcb,
           round(coalesce(agg.cp38, 0), 2) as cp38,
           round(coalesce(agg.zakat, 0), 2) as zakat,
           round(coalesce(agg.epf, 0) + coalesce(ob.epf, 0), 2) as epf,
           round(coalesce(agg.socso, 0), 2) as socso,
           (ob.employment_id is not null) as has_opening
      from ids
      join employments e on e.id = ids.employment_id
      join persons p on p.id = e.person_id
      left join positions ps2 on ps2.id = e.position_id
      left join agg on agg.employment_id = e.id
      left join ln on ln.employment_id = e.id
      left join ob on ob.employment_id = e.id
  ) x
$$;

-- Tetapan Gaji: HR / Kewangan / Pentadbir mengemas kini (lajur yang dibenarkan sahaja)
create or replace function hr_set_payroll_settings(p_company uuid, p_data jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare k text;
  dibenar constant text[] := array['reg_no','lhdn_employer_no','lhdn_c_no','epf_employer_no','socso_employer_no','zakat_no','hrdf_registered',
    'signatory_name','signatory_ic','signatory_position','signatory_email','signatory_phone','company_bank_name','company_bank_account',
    'bank_corporate_id','bank_batch_id','payday','hours_per_day','prorate_basis','unpaid_basis','ot_basis','unpaid_items','ot_items',
    'skbbk_default','payslip_options','gl_accounts','epf_employer_rate'];
begin
  if not has_role(p_company, '{hr,finance,admin}') then raise exception 'Hanya HR/Kewangan'; end if;
  for k in select jsonb_object_keys(p_data) loop
    if not k = any(dibenar) then raise exception 'Medan tidak dikenali: %', k; end if;
  end loop;
  update companies c set
    reg_no = case when p_data ? 'reg_no' then nullif(trim(p_data->>'reg_no'), '') else c.reg_no end,
    lhdn_employer_no = case when p_data ? 'lhdn_employer_no' then nullif(trim(p_data->>'lhdn_employer_no'), '') else c.lhdn_employer_no end,
    lhdn_c_no = case when p_data ? 'lhdn_c_no' then nullif(trim(p_data->>'lhdn_c_no'), '') else c.lhdn_c_no end,
    epf_employer_no = case when p_data ? 'epf_employer_no' then nullif(trim(p_data->>'epf_employer_no'), '') else c.epf_employer_no end,
    socso_employer_no = case when p_data ? 'socso_employer_no' then nullif(trim(p_data->>'socso_employer_no'), '') else c.socso_employer_no end,
    zakat_no = case when p_data ? 'zakat_no' then nullif(trim(p_data->>'zakat_no'), '') else c.zakat_no end,
    hrdf_registered = case when p_data ? 'hrdf_registered' then (p_data->>'hrdf_registered')::boolean else c.hrdf_registered end,
    signatory_name = case when p_data ? 'signatory_name' then nullif(trim(p_data->>'signatory_name'), '') else c.signatory_name end,
    signatory_ic = case when p_data ? 'signatory_ic' then nullif(trim(p_data->>'signatory_ic'), '') else c.signatory_ic end,
    signatory_position = case when p_data ? 'signatory_position' then nullif(trim(p_data->>'signatory_position'), '') else c.signatory_position end,
    signatory_email = case when p_data ? 'signatory_email' then nullif(trim(p_data->>'signatory_email'), '') else c.signatory_email end,
    signatory_phone = case when p_data ? 'signatory_phone' then nullif(trim(p_data->>'signatory_phone'), '') else c.signatory_phone end,
    company_bank_name = case when p_data ? 'company_bank_name' then nullif(trim(p_data->>'company_bank_name'), '') else c.company_bank_name end,
    company_bank_account = case when p_data ? 'company_bank_account' then nullif(digits(p_data->>'company_bank_account'), '') else c.company_bank_account end,
    bank_corporate_id = case when p_data ? 'bank_corporate_id' then nullif(trim(p_data->>'bank_corporate_id'), '') else c.bank_corporate_id end,
    bank_batch_id = case when p_data ? 'bank_batch_id' then nullif(trim(p_data->>'bank_batch_id'), '') else c.bank_batch_id end,
    payday = case when p_data ? 'payday' then (p_data->>'payday')::int else c.payday end,
    hours_per_day = case when p_data ? 'hours_per_day' then (p_data->>'hours_per_day')::numeric else c.hours_per_day end,
    prorate_basis = case when p_data ? 'prorate_basis' then p_data->>'prorate_basis' else c.prorate_basis end,
    unpaid_basis = case when p_data ? 'unpaid_basis' then p_data->>'unpaid_basis' else c.unpaid_basis end,
    ot_basis = case when p_data ? 'ot_basis' then p_data->>'ot_basis' else c.ot_basis end,
    unpaid_items = case when p_data ? 'unpaid_items' then array(select jsonb_array_elements_text(p_data->'unpaid_items')) else c.unpaid_items end,
    ot_items = case when p_data ? 'ot_items' then array(select jsonb_array_elements_text(p_data->'ot_items')) else c.ot_items end,
    skbbk_default = case when p_data ? 'skbbk_default' then (p_data->>'skbbk_default')::boolean else c.skbbk_default end,
    payslip_options = case when p_data ? 'payslip_options' then c.payslip_options || (p_data->'payslip_options') else c.payslip_options end,
    gl_accounts = case when p_data ? 'gl_accounts' then p_data->'gl_accounts' else c.gl_accounts end,
    epf_employer_rate = case when p_data ? 'epf_employer_rate' then nullif(p_data->>'epf_employer_rate', '')::numeric else c.epf_employer_rate end
  where c.id = p_company;
end $$;

do $$
declare f text;
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then return; end if;
  foreach f in array array['payroll_variance(uuid)', 'pcb_statement(uuid, int)', 'payroll_set_receipt(uuid, text)', 'payroll_readiness(uuid)',
                           'hr_set_payroll_settings(uuid, jsonb)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
