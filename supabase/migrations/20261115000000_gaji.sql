-- =====================================================================
--  Fasa F: Gaji (ProsesGaji → GajiSemak → kelulusan → GajiBayar, Gaji, SlipGaji)
--
--  Enjin pengiraan dalam SQL (payroll_calculate) supaya boleh dipanggil oleh app ATAU agent.
--  Kadar berkanun ialah DATA dalam statutory_rates (CLAUDE.md §1.7). Nilai di bawah ialah
--  kadar umum yang diketahui dan MESTI disahkan dengan jadual/kalkulator rasmi (KWSP,
--  PERKESO, LHDN) selama 2 bulan secara selari sebelum gaji sebenar pertama (CLAUDE.md §7–8).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Kadar berkanun (platform). Dikemas kini oleh Pentadbir Platform sahaja.
-- ---------------------------------------------------------------------
insert into statutory_rates(code, effective_from, params, notes) values
 ('EPF', '2025-01-01', '{
    "employee_rate": 11, "employer_rate_low": 13, "employer_rate_high": 12, "employer_threshold": 5000,
    "band_small": 20, "band_large": 100, "band_switch": 5000,
    "age60_employee_rate": 0, "age60_employer_rate": 4
  }', 'Jadual Ketiga Akta KWSP (pekerja warganegara < 60 tahun). Perlu disahkan dengan jadual rasmi.'),
 ('SOCSO', '2024-10-01', '{
    "employee_rate": 0.5, "employer_rate": 1.75, "ceiling": 6000, "band": 100,
    "age60_employer_rate": 1.25
  }', 'Kategori pertama (bencana pekerjaan & keilatan). Siling RM6,000. Perlu disahkan dengan jadual caruman rasmi PERKESO.'),
 ('EIS', '2024-10-01', '{
    "employee_rate": 0.2, "employer_rate": 0.2, "ceiling": 6000, "band": 100, "max_age": 60
  }', 'Sistem Insurans Pekerjaan. Siling RM6,000. Perlu disahkan dengan jadual caruman rasmi.'),
 ('PCB', '2025-01-01', '{
    "bands": [[0,0],[5000,1],[20000,3],[35000,6],[50000,11],[70000,19],[100000,25],[400000,26],[600000,28],[2000000,30]],
    "relief_individual": 9000, "relief_spouse": 4000, "relief_child": 2000, "epf_relief_max": 4000,
    "rebate_threshold": 35000, "rebate_individual": 400, "rebate_spouse": 400, "min_mtd": 10
  }', 'Kaedah pengiraan berkomputer LHDN (pemastautin, saraan biasa). Perlu disahkan dengan kalkulator PCB LHDN.'),
 ('HRDF', '2025-01-01', '{ "rate": 1 }', 'Levi HRD Corp 1% bagi majikan berdaftar.')
on conflict (code, effective_from) do nothing;

create or replace function stat_params(p_code text, p_date date) returns jsonb
language sql stable security definer set search_path = public as $$
  select params from statutory_rates
   where code = p_code and effective_from <= p_date and (effective_to is null or effective_to >= p_date)
   order by effective_from desc limit 1
$$;

-- Umur pada tarikh tertentu daripada tarikh lahir atau no. kad pengenalan (YYMMDD)
create or replace function person_age(p_person uuid, p_on date) returns int
language sql stable security definer set search_path = public as $$
  select extract(year from age(p_on, coalesce(p.date_of_birth,
           case when p.ic_no ~ '^\d{6}' then
             to_date((case when substr(p.ic_no,1,2)::int > (extract(year from p_on)::int % 100) then '19' else '20' end)
                     || substr(p.ic_no,1,6), 'YYYYMMDD') end)))::int
    from persons p where p.id = p_person
$$;

-- KWSP: caruman dikira pada had atas jalur gaji, dibundarkan ke atas ke ringgit berikutnya
create or replace function stat_epf(p_wage numeric, p_age int, p_date date, p_employer_override numeric default null,
                                    out employee numeric, out employer numeric)
language plpgsql stable security definer set search_path = public as $$
declare k jsonb := stat_params('EPF', p_date); band numeric; atas numeric; re numeric; rr numeric;
begin
  if p_wage <= 0 or k is null then employee := 0; employer := 0; return; end if;
  band := case when p_wage <= (k->>'band_switch')::numeric then (k->>'band_small')::numeric else (k->>'band_large')::numeric end;
  atas := ceil(p_wage / band) * band;
  if coalesce(p_age, 0) >= 60 then
    re := (k->>'age60_employee_rate')::numeric; rr := (k->>'age60_employer_rate')::numeric;
  else
    re := (k->>'employee_rate')::numeric;
    rr := case when p_wage <= (k->>'employer_threshold')::numeric then (k->>'employer_rate_low')::numeric
               else (k->>'employer_rate_high')::numeric end;
    if p_employer_override is not null then rr := greatest(rr, p_employer_override); end if;
  end if;
  employee := ceil(atas * re / 100);
  employer := ceil(atas * rr / 100);
end $$;

-- PERKESO / SIP: kadar × gaji andaian (titik tengah jalur RM100), siling, bundar 5 sen
create or replace function stat_socso_eis(p_code text, p_wage numeric, p_age int, p_date date,
                                          out employee numeric, out employer numeric)
language plpgsql stable security definer set search_path = public as $$
declare k jsonb := stat_params(p_code, p_date); w numeric; band numeric;
begin
  employee := 0; employer := 0;
  if p_wage <= 0 or k is null then return; end if;
  if p_code = 'EIS' and coalesce(p_age, 0) >= coalesce((k->>'max_age')::int, 60) then return; end if;
  band := (k->>'band')::numeric;
  w := least(p_wage, (k->>'ceiling')::numeric);
  w := greatest(ceil(w / band) * band - band / 2, band / 2);
  if p_code = 'SOCSO' and coalesce(p_age, 0) >= 60 then
    employer := round(round(w * (k->>'age60_employer_rate')::numeric / 100 * 20) / 20, 2);
    return;
  end if;
  employee := round(round(w * (k->>'employee_rate')::numeric / 100 * 20) / 20, 2);
  employer := round(round(w * (k->>'employer_rate')::numeric / 100 * 20) / 20, 2);
end $$;

-- Cukai tahunan bagi pendapatan bercukai P mengikut jalur
create or replace function stat_tax(p_chargeable numeric, p_date date) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare k jsonb := stat_params('PCB', p_date); b jsonb; i int; lo numeric; hi numeric; r numeric; t numeric := 0;
begin
  if p_chargeable <= 0 or k is null then return 0; end if;
  b := k->'bands';
  for i in 0 .. jsonb_array_length(b) - 1 loop
    lo := (b->i->>0)::numeric; r := (b->i->>1)::numeric;
    hi := case when i < jsonb_array_length(b) - 1 then (b->(i+1)->>0)::numeric else null end;
    exit when p_chargeable <= lo;
    t := t + (least(p_chargeable, coalesce(hi, p_chargeable)) - lo) * r / 100;
  end loop;
  return round(t, 2);
end $$;

-- PCB (kaedah berkomputer, saraan biasa): [cukai setahun − rebat − PCB terkumpul] / (n + 1)
create or replace function stat_pcb(p_month int, p_date date, p_ytd_gross numeric, p_ytd_epf numeric, p_ytd_pcb numeric,
                                    p_gross numeric, p_epf numeric, p_married boolean, p_spouse_working boolean,
                                    p_children int) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare k jsonb := stat_params('PCB', p_date); n int := 12 - p_month; epfmax numeric; k1 numeric; k2 numeric;
        p numeric; rel numeric; tax numeric; reb numeric := 0; mtd numeric; spouse boolean;
begin
  if k is null or p_gross <= 0 then return 0; end if;
  epfmax := (k->>'epf_relief_max')::numeric;
  k1 := least(p_epf, greatest(epfmax - p_ytd_epf, 0));
  k2 := case when n > 0 then least(k1, greatest(epfmax - p_ytd_epf - k1, 0) / n) else 0 end;
  spouse := coalesce(p_married, false) and not coalesce(p_spouse_working, true);
  rel := (k->>'relief_individual')::numeric
       + case when spouse then (k->>'relief_spouse')::numeric else 0 end
       + coalesce(p_children, 0) * (k->>'relief_child')::numeric;
  p := (p_ytd_gross - least(p_ytd_epf, epfmax)) + (p_gross - k1) + (p_gross - k2) * n - rel;
  tax := stat_tax(p, p_date);
  if p <= (k->>'rebate_threshold')::numeric then
    reb := (k->>'rebate_individual')::numeric + case when spouse then (k->>'rebate_spouse')::numeric else 0 end;
  end if;
  mtd := (greatest(tax - reb, 0) - p_ytd_pcb) / (n + 1);
  if mtd < (k->>'min_mtd')::numeric then return 0; end if;
  return round(ceil(mtd * 20) / 20, 2);   -- bundar ke atas 5 sen
end $$;

-- ---------------------------------------------------------------------
-- 2. Pelarasan bulanan (komisen import, elaun sekali, OT) bagi satu larian
-- ---------------------------------------------------------------------
create table if not exists payroll_adjustments (
  id              uuid primary key default gen_random_uuid(),
  payroll_run_id  uuid not null references payroll_runs(id) on delete cascade,
  employment_id   uuid not null references employments(id) on delete cascade,
  component_code  text not null,
  amount          numeric(12,2) not null check (amount >= 0),
  note            text,
  created_by      uuid references persons(id),
  created_at      timestamptz not null default now(),
  unique (payroll_run_id, employment_id, component_code)
);
alter table payroll_adjustments enable row level security;
drop policy if exists rw_hr on payroll_adjustments;
create policy rw_hr on payroll_adjustments for select using (
  exists (select 1 from payroll_runs r where r.id = payroll_run_id and has_role(r.company_id, '{hr,finance,ceo,admin}')));

-- ---------------------------------------------------------------------
-- 3. Langkah 1: sediakan larian & semakan data (ProsesGaji)
-- ---------------------------------------------------------------------
create or replace function payroll_period(p_run uuid, out p_from date, out p_to date)
language sql stable security definer set search_path = public as $$
  select make_date(period_year, period_month, 1), (make_date(period_year, period_month, 1) + interval '1 month - 1 day')::date
    from payroll_runs where id = p_run
$$;

create or replace function payroll_prepare(p_company uuid, p_year int, p_month int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r payroll_runs; d0 date := make_date(p_year, p_month, 1); d1 date; semak jsonb; ringkas jsonb;
begin
  if not has_role(p_company, '{hr,finance,admin}') then raise exception 'Hanya HR/Kewangan'; end if;
  d1 := (d0 + interval '1 month - 1 day')::date;
  insert into payroll_runs(company_id, period_year, period_month, prepared_by)
  values (p_company, p_year, p_month, current_person_id())
  on conflict (company_id, period_year, period_month) do nothing;
  select * into r from payroll_runs where company_id = p_company and period_year = p_year and period_month = p_month;

  select jsonb_build_object(
    'employees', count(*),
    'claims', (select count(*) from claims c join employments e on e.id = c.employment_id
                where e.company_id = p_company and c.status = 'approved' and c.paid_at is null
                  and (c.paid_via_payroll_run is null or c.paid_via_payroll_run = r.id)),
    'claims_amount', (select coalesce(sum(c.total_amount), 0) from claims c join employments e on e.id = c.employment_id
                where e.company_id = p_company and c.status = 'approved' and c.paid_at is null
                  and (c.paid_via_payroll_run is null or c.paid_via_payroll_run = r.id)),
    'unpaid_leave_people', (select count(distinct lr.employment_id) from leave_requests lr
                join employments e on e.id = lr.employment_id join leave_types lt on lt.id = lr.leave_type_id
               where e.company_id = p_company and lt.code = 'UL' and lr.status = 'approved'
                 and lr.start_date <= d1 and lr.end_date >= d0),
    'adjustment_people', (select count(distinct employment_id) from payroll_adjustments where payroll_run_id = r.id)
  ) into ringkas
  from employments e where e.company_id = p_company and e.join_date <= d1
    and (e.status in ('probation','active') or (e.end_date >= d0));

  -- Semakan sebelum kira (berasaskan peraturan; AI boleh menambah ulasan kemudian)
  select coalesce(jsonb_agg(x), '[]') into semak from (
    select coalesce(p.preferred_name, p.full_name) || ': belum mempunyai no. KWSP.' x
      from employments e join persons p on p.id = e.person_id
     where e.company_id = p_company and e.status in ('probation','active') and e.join_date <= d1 and e.epf_no is null
    union all
    select coalesce(p.preferred_name, p.full_name) || ': akaun bank belum diisi.'
      from employments e join persons p on p.id = e.person_id
     where e.company_id = p_company and e.status in ('probation','active') and e.join_date <= d1 and p.bank_account_no is null
    union all
    select coalesce(p.preferred_name, p.full_name) || ': gaji pokok belum ditetapkan.'
      from employments e join persons p on p.id = e.person_id
     where e.company_id = p_company and e.status in ('probation','active') and e.join_date <= d1
       and not exists (select 1 from employment_compensation ec join pay_components pc on pc.id = ec.component_id
                        where ec.employment_id = e.id and pc.code = 'BASIC' and ec.effective_from <= d1
                          and (ec.effective_to is null or ec.effective_to >= d0))
    union all
    select coalesce(p.preferred_name, p.full_name) || ': tiada data terkumpul Jan–' ||
           (array['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogo','Sep','Okt','Nov'])[p_month - 1] ||
           ' (gaji, KWSP, PCB). Isi di Profil Pekerja → Gaji supaya PCB tepat.'
      from employments e join persons p on p.id = e.person_id
     where e.company_id = p_company and e.status in ('probation','active') and p_month > 1
       and e.join_date < make_date(p_year, 1, 1)
       and not exists (select 1 from payroll_opening_balances ob where ob.employment_id = e.id and ob.year = p_year)
       and not exists (select 1 from payslips ps join payroll_runs pr on pr.id = ps.payroll_run_id
                        where ps.employment_id = e.id and pr.period_year = p_year and pr.period_month < p_month
                          and pr.status in ('approved','paid','locked'))    union all
    select coalesce(p.preferred_name, p.full_name) || ': gaji meningkat ' || round((s.gross / nullif(l.gross, 0) - 1) * 100)
           || '% berbanding bulan lalu — adakah ini betul?'
      from payslips s join employments e on e.id = s.employment_id join persons p on p.id = e.person_id
      join payslips l on l.employment_id = s.employment_id
      join payroll_runs lr on lr.id = l.payroll_run_id
     where s.payroll_run_id = r.id
       and make_date(lr.period_year, lr.period_month, 1) = (d0 - interval '1 month')::date
       and l.gross > 0 and s.gross > l.gross * 1.3
  ) q;

  return jsonb_build_object('run_id', r.id, 'status', r.status, 'summary', ringkas, 'checks', semak,
                            'statutory_ready', (select count(*) from statutory_rates where code in ('EPF','SOCSO','EIS','PCB')
                                                  and effective_from <= d1) >= 4);
end $$;

create or replace function payroll_set_adjustment(p_run uuid, p_employment uuid, p_code text, p_amount numeric, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r payroll_runs;
begin
  select * into r from payroll_runs where id = p_run;
  if r.id is null or not has_role(r.company_id, '{hr,finance,admin}') then raise exception 'Hanya HR/Kewangan'; end if;
  if r.status not in ('draft','calculated','returned') then raise exception 'Gaji ini telah dihantar untuk kelulusan'; end if;
  if not exists (select 1 from pay_components where company_id = r.company_id and code = p_code and code not in ('BASIC','CLAIM','UNPAID')) then
    raise exception 'Komponen tidak sah';
  end if;
  if not exists (select 1 from employments where id = p_employment and company_id = r.company_id) then raise exception 'Pekerja tidak sah'; end if;
  if coalesce(p_amount, 0) = 0 then
    delete from payroll_adjustments where payroll_run_id = p_run and employment_id = p_employment and component_code = p_code;
  else
    insert into payroll_adjustments(payroll_run_id, employment_id, component_code, amount, note, created_by)
    values (p_run, p_employment, p_code, p_amount, p_note, current_person_id())
    on conflict (payroll_run_id, employment_id, component_code) do update set amount = excluded.amount, note = excluded.note;
  end if;
  update payroll_runs set status = 'draft' where id = p_run and status = 'calculated';
end $$;

-- ---------------------------------------------------------------------
-- 4. Langkah 2: kira gaji (payroll-calc)
-- ---------------------------------------------------------------------
create or replace function payroll_calculate(p_run uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r payroll_runs; c companies; d0 date; d1 date; e record; s payslips; pid uuid; hari_bulan int;
        v_basic numeric; hari_kerja numeric; v_prorata numeric; v_ul numeric; v_gross numeric; epf_wage numeric; socso_wage numeric;
        v_taxable numeric; v_ded numeric; epf record; so record; ei record; v_pcb numeric; ytd record; age int; ln record;
        v_totals jsonb; prev uuid; v_tuntutan numeric;
begin
  select * into r from payroll_runs where id = p_run for update;
  if r.id is null or not has_role(r.company_id, '{hr,finance,admin}') then raise exception 'Hanya HR/Kewangan'; end if;
  if r.status not in ('draft','calculated','returned') then raise exception 'Gaji ini telah dihantar untuk kelulusan'; end if;
  select * into c from companies where id = r.company_id;
  d0 := make_date(r.period_year, r.period_month, 1);
  d1 := (d0 + interval '1 month - 1 day')::date;
  hari_bulan := extract(day from d1)::int;

  -- lepaskan v_tuntutan yang pernah dikaitkan dengan larian ini, kemudian kira semula
  update claims set paid_via_payroll_run = null where paid_via_payroll_run = r.id and paid_at is null;
  delete from payslips where payroll_run_id = r.id;

  for e in select em.*, p.marital_status, p.spouse_working, p.children_count, p.full_name
             from employments em join persons p on p.id = em.person_id
            where em.company_id = r.company_id and em.join_date <= d1
              and (em.status in ('probation','active') or em.end_date >= d0)
            order by em.employee_no loop
    insert into payslips(payroll_run_id, employment_id) values (r.id, e.id) returning id into pid;
    age := person_age(e.person_id, d1);

    -- Gaji pokok (v_prorata ikut hari kalendar jika mula/tamat pada bulan ini)
    select coalesce(sum(ec.amount), 0) into v_basic from employment_compensation ec join pay_components pc on pc.id = ec.component_id
     where ec.employment_id = e.id and pc.code = 'BASIC' and ec.effective_from <= d1 and (ec.effective_to is null or ec.effective_to >= d1);
    v_prorata := (least(d1, coalesce(e.end_date, d1)) - greatest(d0, e.join_date) + 1)::numeric / hari_bulan;
    v_basic := round(v_basic * least(v_prorata, 1), 2);
    if v_basic > 0 then
      insert into payslip_lines(payslip_id, component_code, description, kind, amount)
      values (pid, 'BASIC', 'Gaji pokok' || case when v_prorata < 1 then ' (' || round(v_prorata * hari_bulan) || '/' || hari_bulan || ' hari)' else '' end, 'earning', v_basic);
    end if;

    -- Komponen tetap lain (elaun) & pelarasan bulan ini
    for ln in select pc.code, pc.name, pc.kind, ec.amount from employment_compensation ec join pay_components pc on pc.id = ec.component_id
               where ec.employment_id = e.id and pc.code not in ('BASIC','CLAIM','UNPAID')
                 and ec.effective_from <= d1 and (ec.effective_to is null or ec.effective_to >= d1)
              union all
              select a.component_code, pc.name, pc.kind, a.amount from payroll_adjustments a
                join pay_components pc on pc.company_id = r.company_id and pc.code = a.component_code
               where a.payroll_run_id = r.id and a.employment_id = e.id loop
      insert into payslip_lines(payslip_id, component_code, description, kind, amount)
      values (pid, ln.code, ln.name, ln.kind, round(ln.amount * case when ln.kind = 'earning' then least(v_prorata, 1) else 1 end, 2));
    end loop;

    -- Cuti tanpa gaji: gaji pokok penuh / 26 × hari (kadar gaji biasa, Akta Kerja s.60I)
    select coalesce(sum(lr.days), 0) into v_ul from leave_requests lr join leave_types lt on lt.id = lr.leave_type_id
     where lr.employment_id = e.id and lt.code = 'UL' and lr.status = 'approved' and lr.start_date between d0 and d1;
    if v_ul > 0 then
      insert into payslip_lines(payslip_id, component_code, description, kind, amount)
      select pid, 'UNPAID', 'Cuti tanpa gaji (' || v_ul || ' hari)', 'deduction', round(sum(ec.amount) / 26 * v_ul, 2)
        from employment_compensation ec join pay_components pc on pc.id = ec.component_id
       where ec.employment_id = e.id and pc.code = 'BASIC' and ec.effective_from <= d1 and (ec.effective_to is null or ec.effective_to >= d1);
    end if;

    -- Tuntutan diluluskan yang belum dibayar (tidak bercukai, tiada KWSP/PERKESO)
    update claims cl set paid_via_payroll_run = r.id
     where cl.employment_id = e.id and cl.status = 'approved' and cl.paid_at is null and cl.paid_via_payroll_run is null;
    select coalesce(sum(total_amount), 0) into v_tuntutan from claims where paid_via_payroll_run = r.id and employment_id = e.id and paid_at is null;
    if v_tuntutan > 0 then
      insert into payslip_lines(payslip_id, component_code, description, kind, amount)
      values (pid, 'CLAIM', 'Bayaran balik tuntutan', 'earning', v_tuntutan);
    end if;

    -- Asas caruman & cukai: pendapatan tolak cuti tanpa gaji (potongan lain tidak mengurangkan upah)
    select coalesce(sum(case when l.kind = 'earning' then l.amount when l.component_code = 'UNPAID' then -l.amount else 0 end), 0),
           coalesce(sum(case when pc.epf_applicable then case when l.kind = 'earning' then l.amount when l.component_code = 'UNPAID' then -l.amount else 0 end else 0 end), 0),
           coalesce(sum(case when pc.socso_applicable then case when l.kind = 'earning' then l.amount when l.component_code = 'UNPAID' then -l.amount else 0 end else 0 end), 0),
           coalesce(sum(case when pc.taxable then case when l.kind = 'earning' then l.amount when l.component_code = 'UNPAID' then -l.amount else 0 end else 0 end), 0)
      into v_gross, epf_wage, socso_wage, v_taxable
      from payslip_lines l left join pay_components pc on pc.company_id = r.company_id and pc.code = l.component_code
     where l.payslip_id = pid and l.kind in ('earning','deduction');
    v_gross := greatest(v_gross, 0);

    select * into epf from stat_epf(greatest(epf_wage, 0), age, d1, c.epf_employer_rate);
    select * into so from stat_socso_eis('SOCSO', greatest(socso_wage, 0), age, d1);
    select * into ei from stat_socso_eis('EIS', greatest(socso_wage, 0), age, d1);

    -- Data tahun semasa (bulan terdahulu yang telah diluluskan/dibayar)
    select coalesce(sum(ps.gross - coalesce((select sum(amount) from payslip_lines x where x.payslip_id = ps.id and x.component_code = 'CLAIM'), 0)), 0) g,
           coalesce(sum(ps.epf_employee), 0) k, coalesce(sum(ps.pcb), 0) x
      into ytd
      from payslips ps join payroll_runs pr on pr.id = ps.payroll_run_id
     where ps.employment_id = e.id and pr.period_year = r.period_year and pr.period_month < r.period_month
       and pr.status in ('approved','paid','locked');
    select ytd.g + coalesce(ob.gross, 0) as g, ytd.k + coalesce(ob.epf, 0) as k, ytd.x + coalesce(ob.pcb, 0) as x into ytd
      from (select 1) z left join payroll_opening_balances ob
        on ob.employment_id = e.id and ob.year = r.period_year and ob.up_to_month < r.period_month;
    v_pcb := stat_pcb(r.period_month, d1, ytd.g, ytd.k, ytd.x, greatest(v_taxable, 0), epf.employee,
                    e.marital_status in ('berkahwin','married'), e.spouse_working, e.children_count);

    insert into payslip_lines(payslip_id, component_code, description, kind, amount)
    select pid, v.code, v.descr, v.kind, v.amt from (values
      ('EPF', 'KWSP', 'deduction', epf.employee), ('SOCSO', 'PERKESO', 'deduction', so.employee),
      ('EIS', 'SIP', 'deduction', ei.employee), ('PCB', 'PCB', 'deduction', v_pcb),
      ('EPF_ER', 'KWSP majikan', 'employer', epf.employer), ('SOCSO_ER', 'PERKESO majikan', 'employer', so.employer),
      ('EIS_ER', 'SIP majikan', 'employer', ei.employer),
      ('HRDF', 'Levi HRD Corp', 'employer', case when c.hrdf_registered then round(greatest(epf_wage, 0) * coalesce((stat_params('HRDF', d1)->>'rate')::numeric, 1) / 100, 2) else 0 end)
    ) v(code, descr, kind, amt) where v.amt > 0;

    select coalesce(sum(amount) filter (where kind = 'deduction' and component_code <> 'UNPAID'), 0) into v_ded
      from payslip_lines where payslip_id = pid;
    update payslips set gross = v_gross, total_deduction = v_ded, net = v_gross - v_ded,
           epf_employee = epf.employee, epf_employer = epf.employer, socso_employee = so.employee, socso_employer = so.employer,
           eis_employee = ei.employee, eis_employer = ei.employer, pcb = v_pcb,
           hrdf = coalesce((select amount from payslip_lines where payslip_id = pid and component_code = 'HRDF'), 0),
           unpaid_leave_days = v_ul
     where id = pid;
  end loop;

  select id into prev from payroll_runs where company_id = r.company_id
     and make_date(period_year, period_month, 1) = (d0 - interval '1 month')::date;
  select jsonb_build_object(
    'headcount', count(*), 'gross', coalesce(sum(gross), 0), 'net', coalesce(sum(net), 0),
    'employer', coalesce(sum(epf_employer + socso_employer + eis_employer + hrdf), 0), 'pcb', coalesce(sum(pcb), 0),
    'epf', coalesce(sum(epf_employee + epf_employer), 0), 'socso', coalesce(sum(socso_employee + socso_employer), 0),
    'eis', coalesce(sum(eis_employee + eis_employer), 0),
    'claims', (select coalesce(sum(amount), 0) from payslip_lines l join payslips x on x.id = l.payslip_id
                where x.payroll_run_id = r.id and l.component_code = 'CLAIM'),
    'previous_run', prev, 'calculated_at', now()
  ) into v_totals from payslips where payroll_run_id = r.id;
  update payroll_runs set status = 'calculated', totals = v_totals where id = r.id;
  perform emit_event(r.company_id, 'payroll.calculated', current_person_id(), null,
                     jsonb_build_object('run_id', r.id, 'gross', v_totals->'gross'));
  return v_totals;
end $$;

-- Perbezaan berbanding bulan lalu (GajiSemak)
create or replace function payroll_differences(p_run uuid)
returns table(employment_id uuid, name text, note text)
language plpgsql stable security definer set search_path = public as $$
declare r payroll_runs; prev uuid;
begin
  select * into r from payroll_runs where id = p_run;
  if r.id is null or not has_role(r.company_id, '{hr,finance,ceo,admin}') then raise exception 'Tidak dibenarkan'; end if;
  prev := (r.totals->>'previous_run')::uuid;
  return query
  select s.employment_id, coalesce(p.preferred_name, p.full_name),
         case when l.id is null then 'Gaji pertama' || case when exists (select 1 from payslip_lines x where x.payslip_id = s.id and x.component_code = 'BASIC' and x.description like '%hari)%') then ' · prorata' else '' end
         else concat_ws(', ',
           (select string_agg(case when coalesce(n.a,0) > coalesce(o.a,0) then '+ ' else '− ' end || lower(n.d), ', ')
              from (select component_code, max(description) d, sum(amount) a from payslip_lines where payslip_id = s.id and kind = 'earning' group by component_code) n
              full join (select component_code, sum(amount) a from payslip_lines where payslip_id = l.id and kind = 'earning' group by component_code) o using (component_code)
             where coalesce(n.a,0) <> coalesce(o.a,0) and n.d is not null),
           case when s.unpaid_leave_days > 0 then '− ' || s.unpaid_leave_days || ' hari cuti tanpa gaji' end)
         end
    from payslips s join employments e on e.id = s.employment_id join persons p on p.id = e.person_id
    left join payslips l on l.payroll_run_id = prev and l.employment_id = s.employment_id
   where s.payroll_run_id = p_run
     and (l.id is null or s.gross <> l.gross or s.unpaid_leave_days > 0)
   order by 2;
end $$;

-- ---------------------------------------------------------------------
-- 5. Langkah 4: tanda dibayar → slip dihantar, tuntutan dibayar, jurnal perakaunan
-- ---------------------------------------------------------------------
create or replace function payroll_mark_paid(p_run uuid, p_pay_date date default null) returns int
language plpgsql security definer set search_path = public as $$
declare r payroll_runs; n int; bulan text;
begin
  select * into r from payroll_runs where id = p_run for update;
  if r.id is null or not has_role(r.company_id, '{hr,finance,admin}') then raise exception 'Hanya HR/Kewangan'; end if;
  if r.status <> 'approved' then raise exception 'Gaji belum diluluskan'; end if;
  update payroll_runs set status = 'paid', pay_date = coalesce(p_pay_date, (now() at time zone 'Asia/Kuala_Lumpur')::date) where id = r.id;
  update claims set paid_at = now() where paid_via_payroll_run = r.id and paid_at is null;
  bulan := (array['Januari','Februari','Mac','April','Mei','Jun','Julai','Ogos','September','Oktober','November','Disember'])[r.period_month] || ' ' || r.period_year;
  -- Mesej WhatsApp tanpa jumlah (PDPA): slip dibuka dalam aplikasi
  perform notify_person(e.person_id, r.company_id,
            'Slip gaji ' || bulan || ' anda telah tersedia. Buka aplikasi HRBoost → Saya → Slip Gaji untuk melihatnya.')
     from payslips s join employments e on e.id = s.employment_id where s.payroll_run_id = r.id;
  select count(*) into n from payslips where payroll_run_id = r.id;
  perform emit_event(r.company_id, 'payroll.paid', current_person_id(), null, jsonb_build_object('run_id', r.id, 'slips', n));
  return n;
end $$;

-- ---------------------------------------------------------------------
-- 6. Fail berkanun & bank (CSV). Format rasmi (i-Akaun, ASSIST, e-PCB, fail pukal bank)
--    perlu disahkan dengan setiap portal sebelum digunakan.
-- ---------------------------------------------------------------------
-- Upah caruman (KWSP / PERKESO) bagi satu slip: pendapatan berkaitan tolak cuti tanpa gaji
create or replace function payslip_wage(p_payslip uuid, p_kind text) returns numeric
language sql stable security definer set search_path = public as $$
  select greatest(coalesce(sum(case when l.kind = 'earning' then l.amount when l.component_code = 'UNPAID' then -l.amount else 0 end), 0), 0)
    from payslip_lines l join payslips s on s.id = l.payslip_id join payroll_runs r on r.id = s.payroll_run_id
    join pay_components pc on pc.company_id = r.company_id and pc.code = l.component_code
   where l.payslip_id = p_payslip and l.kind in ('earning','deduction')
     and case when p_kind = 'epf' then pc.epf_applicable else pc.socso_applicable end
$$;
revoke execute on function payslip_wage(uuid, text) from public;

create or replace function payroll_export(p_run uuid, p_kind text) returns text
language plpgsql security definer set search_path = public as $$
declare r payroll_runs; c companies; out text;
begin
  select * into r from payroll_runs where id = p_run;
  if r.id is null or not has_role(r.company_id, '{hr,finance,admin}') then raise exception 'Hanya HR/Kewangan'; end if;
  if r.status not in ('approved','paid','locked') then raise exception 'Gaji belum diluluskan'; end if;
  select * into c from companies where id = r.company_id;
  insert into data_access_log(actor_person_id, subject_person_id, resource, via)
  select current_person_id(), e.person_id, 'payslip', 'web' from payslips s join employments e on e.id = s.employment_id where s.payroll_run_id = r.id;

  if p_kind = 'bank' then
    select 'Nama,No. Akaun,Bank,Jumlah,Rujukan' || E'\n' || coalesce(string_agg(
             format('"%s",%s,"%s",%s,GAJI%s%s', p.full_name, coalesce(p.bank_account_no, ''), coalesce(p.bank_name, ''),
                    to_char(s.net, 'FM999999990.00'), r.period_year, lpad(r.period_month::text, 2, '0')), E'\n' order by p.full_name), '')
      into out from payslips s join employments e on e.id = s.employment_id join persons p on p.id = e.person_id
     where s.payroll_run_id = r.id and s.net > 0;
  elsif p_kind = 'epf' then
    select 'No. Majikan,No. Ahli KWSP,No. KP,Nama,Gaji,Caruman Pekerja,Caruman Majikan' || E'\n' || coalesce(string_agg(
             format('%s,%s,%s,"%s",%s,%s,%s', coalesce(c.epf_employer_no, ''), coalesce(e.epf_no, ''), coalesce(p.ic_no, ''), p.full_name,
                    to_char(payslip_wage(s.id, 'epf'), 'FM999999990.00'), to_char(s.epf_employee, 'FM999999990.00'), to_char(s.epf_employer, 'FM999999990.00')),
             E'\n' order by p.full_name), '')
      into out from payslips s join employments e on e.id = s.employment_id join persons p on p.id = e.person_id
     where s.payroll_run_id = r.id;
  elsif p_kind = 'socso' then
    select 'No. Majikan,No. KP,Nama,Gaji,PERKESO Pekerja,PERKESO Majikan,SIP Pekerja,SIP Majikan' || E'\n' || coalesce(string_agg(
             format('%s,%s,"%s",%s,%s,%s,%s,%s', coalesce(c.socso_employer_no, ''), coalesce(p.ic_no, ''), p.full_name,
                    to_char(payslip_wage(s.id, 'socso'), 'FM999999990.00'), to_char(s.socso_employee, 'FM999999990.00'), to_char(s.socso_employer, 'FM999999990.00'),
                    to_char(s.eis_employee, 'FM999999990.00'), to_char(s.eis_employer, 'FM999999990.00')), E'\n' order by p.full_name), '')
      into out from payslips s join employments e on e.id = s.employment_id join persons p on p.id = e.person_id
     where s.payroll_run_id = r.id;
  elsif p_kind = 'pcb' then
    select 'No. E,No. Cukai,No. KP,Nama,PCB,Bulan,Tahun' || E'\n' || coalesce(string_agg(
             format('%s,%s,%s,"%s",%s,%s,%s', coalesce(c.lhdn_employer_no, ''), coalesce(e.tax_no, ''), coalesce(p.ic_no, ''), p.full_name,
                    to_char(s.pcb, 'FM999999990.00'), r.period_month, r.period_year), E'\n' order by p.full_name), '')
      into out from payslips s join employments e on e.id = s.employment_id join persons p on p.id = e.person_id
     where s.payroll_run_id = r.id and s.pcb > 0;
  else
    raise exception 'Jenis fail tidak sah';
  end if;
  return out;
end $$;

-- Pekerja membuka slip sendiri → direkodkan (HR membuka slip orang lain juga direkodkan)
create or replace function payslip_opened(p_payslip uuid) returns void
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select e.person_id into pid from payslips s join employments e on e.id = s.employment_id where s.id = p_payslip;
  if pid is null then return; end if;
  if pid <> current_person_id() then
    if not exists (select 1 from payslips s join payroll_runs r on r.id = s.payroll_run_id
                    where s.id = p_payslip and has_role(r.company_id, '{hr,finance,ceo,admin}')) then
      raise exception 'Tidak dibenarkan';
    end if;
    insert into data_access_log(actor_person_id, subject_person_id, resource, via) values (current_person_id(), pid, 'payslip', 'web');
  end if;
end $$;

-- Kebenaran fungsi
do $$
declare f text;
begin
  foreach f in array array[
    'payroll_prepare(uuid, int, int)', 'payroll_set_adjustment(uuid, uuid, text, numeric, text)',
    'payroll_calculate(uuid)', 'payroll_differences(uuid)', 'payroll_mark_paid(uuid, date)',
    'payroll_export(uuid, text)', 'payslip_opened(uuid)', 'payroll_period(uuid)'] loop
    execute format('revoke execute on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function %s from anon', f);
      execute format('grant execute on function %s to authenticated, service_role', f);
    end if;
  end loop;
  -- Fungsi kiraan dalaman (dibaca juga oleh agent melalui service role)
  foreach f in array array['stat_params(text, date)', 'person_age(uuid, date)', 'stat_epf(numeric, int, date, numeric)',
                           'stat_socso_eis(text, numeric, int, date)', 'stat_tax(numeric, date)',
                           'stat_pcb(int, date, numeric, numeric, numeric, numeric, numeric, boolean, boolean, int)'] loop
    execute format('revoke execute on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function %s from anon, authenticated', f);
      execute format('grant execute on function %s to service_role', f);
    end if;
  end loop;
end $$;

-- Slip pekerja: senarai & maklumat larian tanpa mendedahkan jumlah syarikat (payroll_runs.totals).
create or replace function my_payslips(p_employment uuid)
returns table(id uuid, period_year int, period_month int, pay_date date, status payroll_status, net numeric)
language sql stable security definer set search_path = public as $$
  select s.id, r.period_year, r.period_month, r.pay_date, r.status, s.net
    from payslips s join payroll_runs r on r.id = s.payroll_run_id join employments e on e.id = s.employment_id
   where s.employment_id = p_employment and e.person_id = current_person_id() and r.status in ('paid','locked')
   order by r.period_year desc, r.period_month desc
$$;

create or replace function payslip_meta(p_payslip uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('period_year', r.period_year, 'period_month', r.period_month, 'pay_date', r.pay_date,
           'status', r.status, 'company', jsonb_build_object('name', c.name, 'code', c.code, 'reg_no', c.reg_no,
           'epf', c.epf_employer_no, 'socso', c.socso_employer_no, 'lhdn', c.lhdn_employer_no))
    from payslips s join payroll_runs r on r.id = s.payroll_run_id join companies c on c.id = r.company_id
    join employments e on e.id = s.employment_id
   where s.id = p_payslip
     and ((e.person_id = current_person_id() and r.status in ('approved','paid','locked'))
          or has_role(r.company_id, '{hr,finance,ceo,admin}'))
$$;

-- Jumlah terkumpul tahun semasa hingga bulan slip (untuk slip A4)
create or replace function payslip_ytd(p_payslip uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('gross', coalesce(sum(x.gross), 0), 'epf', coalesce(sum(x.epf_employee), 0),
                            'pcb', coalesce(sum(x.pcb), 0), 'months', count(*))
    from payslips s join payroll_runs r on r.id = s.payroll_run_id
    join payslips x on x.employment_id = s.employment_id
    join payroll_runs xr on xr.id = x.payroll_run_id and xr.period_year = r.period_year and xr.period_month <= r.period_month
                        and (xr.status in ('approved','paid','locked') or xr.id = r.id)
   where s.id = p_payslip and payslip_meta(p_payslip) is not null
$$;

do $$
declare f text;
begin
  foreach f in array array['my_payslips(uuid)', 'payslip_meta(uuid)', 'payslip_ytd(uuid)'] loop
    execute format('revoke execute on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function %s from anon', f);
      execute format('grant execute on function %s to authenticated, service_role', f);
    end if;
  end loop;
end $$;

-- Pembetulan: polisi read_slip asal menyemak payroll_runs melalui RLS, yang tidak boleh dibaca
-- oleh pekerja — pekerja tidak pernah nampak slip sendiri. Semak melalui fungsi security definer.
create or replace function payslip_is_mine(p_payslip uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from payslips s join employments e on e.id = s.employment_id
                   join payroll_runs r on r.id = s.payroll_run_id
                  where s.id = p_payslip and e.person_id = current_person_id()
                    and r.status in ('approved','paid','locked'))
$$;
revoke execute on function payslip_is_mine(uuid) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function payslip_is_mine(uuid) from anon;
    grant execute on function payslip_is_mine(uuid) to authenticated, service_role;
  end if;
end $$;
drop policy if exists read_slip on payslips;
create policy read_slip on payslips for select using (
  exists (select 1 from payroll_runs pr where pr.id = payroll_run_id and has_role(pr.company_id, '{hr,finance,ceo,admin}'))
  or payslip_is_mine(id));

-- ---------------------------------------------------------------------
-- 7. Baki awal tahun (syarikat mula guna HRBoost pada pertengahan tahun).
--    Kaedah PCB berkomputer memerlukan saraan, KWSP dan PCB terkumpul bulan terdahulu;
--    tanpanya PCB akan terkurang. HR mengisi daripada sistem lama / EA sementara.
-- ---------------------------------------------------------------------
create table if not exists payroll_opening_balances (
  employment_id  uuid not null references employments(id) on delete cascade,
  year           int not null,
  up_to_month    int not null check (up_to_month between 1 and 11),
  gross          numeric(12,2) not null default 0 check (gross >= 0),
  epf            numeric(12,2) not null default 0 check (epf >= 0),
  pcb            numeric(12,2) not null default 0 check (pcb >= 0),
  updated_by     uuid references persons(id),
  updated_at     timestamptz not null default now(),
  primary key (employment_id, year)
);
alter table payroll_opening_balances enable row level security;
drop policy if exists read_hr on payroll_opening_balances;
create policy read_hr on payroll_opening_balances for select using (has_role(employment_company(employment_id), '{hr,finance,admin}'));

create or replace function set_payroll_opening(p_employment uuid, p_year int, p_up_to_month int,
                                               p_gross numeric, p_epf numeric, p_pcb numeric)
returns void language plpgsql security definer set search_path = public as $$
declare e employments;
begin
  select * into e from employments where id = p_employment;
  if e.id is null or not has_role(e.company_id, '{hr,finance,admin}') then raise exception 'Hanya HR/Kewangan'; end if;
  insert into payroll_opening_balances(employment_id, year, up_to_month, gross, epf, pcb, updated_by)
  values (p_employment, p_year, p_up_to_month, coalesce(p_gross,0), coalesce(p_epf,0), coalesce(p_pcb,0), current_person_id())
  on conflict (employment_id, year) do update set up_to_month = excluded.up_to_month, gross = excluded.gross,
     epf = excluded.epf, pcb = excluded.pcb, updated_by = excluded.updated_by, updated_at = now();
  insert into data_access_log(actor_person_id, subject_person_id, resource, via) values (current_person_id(), e.person_id, 'salary', 'web');
end $$;
revoke execute on function set_payroll_opening(uuid, int, int, numeric, numeric, numeric) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function set_payroll_opening(uuid, int, int, numeric, numeric, numeric) from anon;
    grant execute on function set_payroll_opening(uuid, int, int, numeric, numeric, numeric) to authenticated, service_role;
  end if;
end $$;
