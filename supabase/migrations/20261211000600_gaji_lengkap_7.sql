-- Keterangan item bulan ini pada slip: "Nama item: nota" (cth. "Bonus: Bonus prestasi 2026", "Kerja Lebih Masa (diluluskan): 3 jam …")
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
                select a.component_code, pc.name || coalesce(': ' || nullif(trim(a.note), ''), ''), pc.kind, a.amount, true from payroll_adjustments a
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
