-- =====================================================================
--  Gaji lengkap — Fasa 1 (berbanding modul Payroll BrioHR):
--   1. Tetapan Gaji syarikat: nombor majikan lengkap, pegawai penandatangan, akaun bank syarikat,
--      asas pengiraan (prorata, cuti tanpa gaji, OT) & item dalam asas, pilihan slip
--   2. Maklumat berkanun & cukai setiap pekerja: pemastautin, OKU, pasangan, anak ikut kategori,
--      kategori KWSP / PERKESO, SIP, SKBBK (Lindung 24 Jam), zakat, CP38, TP1 (pelepasan bulanan)
--   3. Kadar: SKBBK (Jun 2026: 0.75% pekerja), KWSP pekerja asing 2%/2% (gaji Okt 2025),
--      PERKESO dibundarkan mengikut jadual rasmi (separuh → ganjil, 5 sen)
--   4. PCB: pelepasan OKU/pasangan OKU, anak mengikut kategori, TP1, zakat (mengurangkan PCB), bukan pemastautin 30%
--   5. Enjin gaji ditulis semula dengan semua di atas; fail berkanun format teks (CP39 e-Data PCB,
--      PERKESO gabungan 2026, CSV i-Akaun KWSP); laporan varians
--  Semua kadar ialah DATA (statutory_rates) dan mesti disahkan dengan jadual/kalkulator rasmi.
-- =====================================================================

-- 1. Tetapan Gaji syarikat ---------------------------------------------------------------
alter table companies
  add column if not exists lhdn_c_no            text,
  add column if not exists zakat_no             text,
  add column if not exists signatory_name       text,
  add column if not exists signatory_ic         text,
  add column if not exists signatory_position   text,
  add column if not exists signatory_email      text,
  add column if not exists signatory_phone      text,
  add column if not exists company_bank_name    text,
  add column if not exists company_bank_account text,
  add column if not exists bank_corporate_id    text,
  add column if not exists bank_batch_id        text,
  add column if not exists payday               int not null default 25 check (payday between 1 and 31),
  add column if not exists hours_per_day        numeric not null default 8 check (hours_per_day between 1 and 24),
  add column if not exists prorate_basis        text not null default 'calendar' check (prorate_basis in ('calendar','working','fixed26')),
  add column if not exists unpaid_basis         text not null default 'fixed26' check (unpaid_basis in ('calendar','working','fixed26')),
  add column if not exists ot_basis             text not null default 'fixed26' check (ot_basis in ('calendar','working','fixed26')),
  add column if not exists unpaid_items         text[] not null default '{}',
  add column if not exists ot_items             text[] not null default '{}',
  add column if not exists skbbk_default        boolean not null default true,
  add column if not exists payslip_options      jsonb not null default '{"leave_summary": true, "ytd": true, "disclaimer": null, "auto_release": true}';

-- 2. Maklumat berkanun & cukai pekerja -----------------------------------------------------
create table if not exists employment_statutory (
  employment_id     uuid primary key references employments(id) on delete cascade,
  resident          boolean not null default true,
  disabled          boolean not null default false,
  spouse_disabled   boolean not null default false,
  -- anak layak pelepasan (bilangan). separuh = pelepasan dikongsi dengan pasangan (50%)
  child_u18         int not null default 0 check (child_u18 between 0 and 30),
  child_higher      int not null default 0 check (child_higher between 0 and 30),   -- 18+ diploma/ijazah (RM8,000)
  child_disabled    int not null default 0 check (child_disabled between 0 and 30), -- OKU (RM8,000)
  child_disabled_higher int not null default 0 check (child_disabled_higher between 0 and 30), -- OKU & belajar (RM16,000)
  child_shared      boolean not null default false,
  epf_category      text not null default 'auto' check (epf_category in ('auto','citizen','foreign','none')),
  epf_employee_rate numeric check (epf_employee_rate between 0 and 20),     -- kadar pekerja pilihan (cth. 9%)
  socso_category    text not null default 'auto' check (socso_category in ('auto','cat1','cat2','foreign','none')),
  eis               text not null default 'auto' check (eis in ('auto','yes','no')),
  skbbk             text not null default 'auto' check (skbbk in ('auto','yes','no')),
  ssfw_no           text,                                                     -- no. PERKESO pekerja asing
  zakat_monthly     numeric not null default 0 check (zakat_monthly >= 0),
  cp38_monthly      numeric not null default 0 check (cp38_monthly >= 0),
  cp38_until        date,
  updated_at        timestamptz not null default now()
);
alter table employment_statutory enable row level security;
drop policy if exists stat_read on employment_statutory;
drop policy if exists stat_write on employment_statutory;
create policy stat_read on employment_statutory for select to authenticated
  using (own_or_hr_employment(employment_id) or has_role(employment_company(employment_id), '{finance}'));
create policy stat_write on employment_statutory for all to authenticated
  using (has_role(employment_company(employment_id), '{hr,admin}')) with check (has_role(employment_company(employment_id), '{hr,admin}'));

-- Pelepasan TP1 bulanan (cth. insurans, yuran pendidikan, perubatan ibu bapa)
create table if not exists tp1_reliefs (
  id             uuid primary key default gen_random_uuid(),
  employment_id  uuid not null references employments(id) on delete cascade,
  year           int not null,
  month          int not null check (month between 1 and 12),
  category       text not null,
  amount         numeric not null check (amount > 0),
  note           text,
  created_at     timestamptz not null default now()
);
create index if not exists tp1_emp on tp1_reliefs(employment_id, year, month);
alter table tp1_reliefs enable row level security;
drop policy if exists tp1_read on tp1_reliefs;
drop policy if exists tp1_write on tp1_reliefs;
create policy tp1_read on tp1_reliefs for select to authenticated using (own_or_hr_employment(employment_id));
create policy tp1_write on tp1_reliefs for all to authenticated
  using (has_role(employment_company(employment_id), '{hr,admin}')) with check (has_role(employment_company(employment_id), '{hr,admin}'));

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select, insert, update, delete on employment_statutory, tp1_reliefs to authenticated;
  end if;
end $$;

-- Lajur tambahan slip
alter table payslips
  add column if not exists skbbk_employee numeric not null default 0,
  add column if not exists zakat numeric not null default 0,
  add column if not exists cp38 numeric not null default 0;

-- 3. Kadar ----------------------------------------------------------------------------------
insert into statutory_rates(code, effective_from, params, notes) values
 ('SKBBK', '2026-06-01', '{"employee_rate": 0.75, "ceiling": 6000, "band": 100}', 'Lindung 24 Jam (SKBBK) Fasa 1, ditanggung pekerja. Sukarela bagi pekerja tempatan, wajib bagi pekerja asing. Perlu disahkan dengan jadual rasmi PERKESO.'),
 ('SKBBK', '2028-06-01', '{"employee_rate": 1.00, "ceiling": 6000, "band": 100}', 'Lindung 24 Jam Fasa 2.'),
 ('SKBBK', '2031-06-01', '{"employee_rate": 1.25, "ceiling": 6000, "band": 100}', 'Lindung 24 Jam Fasa 3.')
on conflict (code, effective_from) do nothing;
update statutory_rates set params = params || '{"foreign_employee_rate": 2, "foreign_employer_rate": 2}'
 where code = 'EPF' and not params ? 'foreign_employee_rate';
update statutory_rates set params = params || '{"relief_disabled": 6000, "relief_spouse_disabled": 5000, "relief_child_higher": 8000, "relief_child_disabled": 8000, "relief_child_disabled_higher": 16000, "nonresident_rate": 30}'
 where code = 'PCB' and not params ? 'relief_disabled';

-- Bundar ke 5 sen terdekat; separuh tepat dibundarkan ke unit GANJIL (sepadan dengan jadual caruman PERKESO:
-- cth. RM1,000.01–1,100 majikan 18.35, RM900.01–1,000 majikan 16.65)
create or replace function round5_odd(p numeric) returns numeric
language sql immutable as $$
  select case when (p * 20) - floor(p * 20) = 0.5
              then (case when floor(p * 20)::bigint % 2 = 0 then floor(p * 20) + 1 else floor(p * 20) end) / 20
              else round(p * 20) / 20 end
$$;

-- PERKESO / SIP / SKBBK: kadar × gaji andaian (titik tengah jalur RM100), siling
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
    -- Kategori 2 (Bencana Pekerjaan sahaja): jadual rasmi = caruman majikan K1 − caruman pekerja K1
    employer := round5_odd(w * (k->>'employer_rate')::numeric / 100) - round5_odd(w * (k->>'employee_rate')::numeric / 100);
    return;
  end if;
  employee := round5_odd(w * (k->>'employee_rate')::numeric / 100);
  employer := round5_odd(w * coalesce((k->>'employer_rate')::numeric, 0) / 100);
end $$;

-- KWSP dengan kategori (warganegara / asing / tiada) & kadar pekerja pilihan
create or replace function stat_epf2(p_wage numeric, p_age int, p_date date, p_employer_override numeric, p_category text,
                                     p_employee_rate numeric, out employee numeric, out employer numeric)
language plpgsql stable security definer set search_path = public as $$
declare k jsonb := stat_params('EPF', p_date); band numeric; atas numeric;
begin
  employee := 0; employer := 0;
  if p_wage <= 0 or k is null or p_category = 'none' then return; end if;
  if p_category = 'foreign' then
    band := case when p_wage <= (k->>'band_switch')::numeric then (k->>'band_small')::numeric else (k->>'band_large')::numeric end;
    atas := ceil(p_wage / band) * band;
    employee := ceil(atas * coalesce((k->>'foreign_employee_rate')::numeric, 2) / 100);
    employer := ceil(atas * coalesce((k->>'foreign_employer_rate')::numeric, 2) / 100);
    return;
  end if;
  select * into employee, employer from stat_epf(p_wage, p_age, p_date, p_employer_override);
  if p_employee_rate is not null and coalesce(p_age, 0) < 60 then
    band := case when p_wage <= (k->>'band_switch')::numeric then (k->>'band_small')::numeric else (k->>'band_large')::numeric end;
    employee := ceil(ceil(p_wage / band) * band * p_employee_rate / 100);
  end if;
end $$;

-- 4. PCB (kaedah berkomputer LHDN) dengan pelepasan penuh, TP1 & zakat
create or replace function stat_pcb2(p_month int, p_date date, p_ytd_gross numeric, p_ytd_epf numeric, p_ytd_pcb numeric,
                                     p_gross numeric, p_epf numeric, p_married boolean, p_spouse_working boolean,
                                     p_child_units numeric, p_extra_relief numeric, p_lp_ytd numeric, p_lp_now numeric,
                                     p_zakat_ytd numeric, p_zakat_now numeric, p_resident boolean) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare k jsonb := stat_params('PCB', p_date); n int := 12 - p_month; epfmax numeric; k1 numeric; k2 numeric;
        p numeric; rel numeric; tax numeric; reb numeric := 0; mtd numeric; spouse boolean;
begin
  if k is null or p_gross <= 0 then return 0; end if;
  if not coalesce(p_resident, true) then
    return round(ceil(p_gross * coalesce((k->>'nonresident_rate')::numeric, 30) / 100 * 20) / 20, 2);
  end if;
  epfmax := (k->>'epf_relief_max')::numeric;
  k1 := least(p_epf, greatest(epfmax - p_ytd_epf, 0));
  k2 := case when n > 0 then least(k1, greatest(epfmax - p_ytd_epf - k1, 0) / n) else 0 end;
  spouse := coalesce(p_married, false) and not coalesce(p_spouse_working, true);
  rel := (k->>'relief_individual')::numeric
       + case when spouse then (k->>'relief_spouse')::numeric else 0 end
       + coalesce(p_child_units, 0) * (k->>'relief_child')::numeric
       + coalesce(p_extra_relief, 0);
  p := (p_ytd_gross - least(p_ytd_epf, epfmax)) + (p_gross - k1) + (p_gross - k2) * n - rel
       - coalesce(p_lp_ytd, 0) - coalesce(p_lp_now, 0);
  tax := stat_tax(p, p_date);
  if p <= (k->>'rebate_threshold')::numeric then
    reb := (k->>'rebate_individual')::numeric + case when spouse then (k->>'rebate_spouse')::numeric else 0 end;
  end if;
  mtd := (greatest(tax - reb, 0) - p_ytd_pcb - coalesce(p_zakat_ytd, 0)) / (n + 1) - coalesce(p_zakat_now, 0);
  if mtd < (k->>'min_mtd')::numeric then return 0; end if;
  return round(ceil(mtd * 20) / 20, 2);
end $$;

-- Pembungkus lama (pratonton gaji) kekal serasi
create or replace function stat_pcb(p_month int, p_date date, p_ytd_gross numeric, p_ytd_epf numeric, p_ytd_pcb numeric,
                                    p_gross numeric, p_epf numeric, p_married boolean, p_spouse_working boolean,
                                    p_children int) returns numeric
language sql stable security definer set search_path = public as $$
  select stat_pcb2(p_month, p_date, p_ytd_gross, p_ytd_epf, p_ytd_pcb, p_gross, p_epf, p_married, p_spouse_working,
                   coalesce(p_children, 0), 0, 0, 0, 0, 0, true)
$$;

-- Maklumat berkanun berkesan seorang pekerja pada tarikh (kategori 'auto' diselesaikan)
create or replace function employment_stat_effective(p_employment uuid, p_on date)
returns table(epf_category text, epf_employee_rate numeric, socso_category text, eis boolean, skbbk boolean,
              resident boolean, child_units numeric, extra_relief numeric, zakat numeric, cp38 numeric, age int, foreign_worker boolean)
language plpgsql stable security definer set search_path = public as $$
declare e employments; p persons; s employment_statutory; c companies; k jsonb := stat_params('PCB', p_on);
        asing boolean; umur int; unit numeric;
begin
  select * into e from employments where id = p_employment;
  select * into p from persons where id = e.person_id;
  select * into c from companies where id = e.company_id;
  select * into s from employment_statutory where employment_id = p_employment;
  asing := coalesce(p.nationality, 'MY') not in ('MY', '') ;
  umur := person_age(p.id, p_on);
  epf_category := case when coalesce(s.epf_category, 'auto') <> 'auto' then s.epf_category when asing then 'foreign' else 'citizen' end;
  epf_employee_rate := s.epf_employee_rate;
  socso_category := case when coalesce(s.socso_category, 'auto') <> 'auto' then s.socso_category
                         when asing then 'foreign' when coalesce(umur, 0) >= 60 then 'cat2' else 'cat1' end;
  eis := case coalesce(s.eis, 'auto') when 'yes' then true when 'no' then false else not asing and coalesce(umur, 0) < 60 end;
  skbbk := case coalesce(s.skbbk, 'auto') when 'yes' then true when 'no' then false else asing or c.skbbk_default end;
  resident := coalesce(s.resident, true);
  unit := coalesce(s.child_u18, 0)
        + coalesce(s.child_higher, 0) * coalesce((k->>'relief_child_higher')::numeric, 8000) / (k->>'relief_child')::numeric
        + coalesce(s.child_disabled, 0) * coalesce((k->>'relief_child_disabled')::numeric, 8000) / (k->>'relief_child')::numeric
        + coalesce(s.child_disabled_higher, 0) * coalesce((k->>'relief_child_disabled_higher')::numeric, 16000) / (k->>'relief_child')::numeric;
  if s.employment_id is null then unit := coalesce(p.children_count, 0); end if;   -- belum diisi: bilangan anak asas
  child_units := case when coalesce(s.child_shared, false) then unit / 2 else unit end;
  extra_relief := case when coalesce(s.disabled, false) then coalesce((k->>'relief_disabled')::numeric, 6000) else 0 end
                + case when coalesce(s.spouse_disabled, false) then coalesce((k->>'relief_spouse_disabled')::numeric, 5000) else 0 end;
  zakat := coalesce(s.zakat_monthly, 0);
  cp38 := case when coalesce(s.cp38_monthly, 0) > 0 and (s.cp38_until is null or s.cp38_until >= date_trunc('month', p_on)::date) then s.cp38_monthly else 0 end;
  age := umur;
  foreign_worker := asing;
  return next;
end $$;

-- Hari bekerja dalam julat (ikut hujung minggu & cuti umum syarikat)
create or replace function company_working_days(p_company uuid, p_from date, p_to date) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from generate_series(p_from, p_to, interval '1 day') d
   where is_working_day(p_company, d::date)
$$;

-- Pembahagi harian ikut asas: 26 tetap / hari kalendar bulan / hari bekerja bulan
create or replace function pay_divisor(p_company uuid, p_basis text, p_from date, p_to date) returns numeric
language sql stable security definer set search_path = public as $$
  select case p_basis when 'calendar' then (p_to - p_from + 1)::numeric
                      when 'working' then greatest(company_working_days(p_company, p_from, p_to), 1)::numeric
                      else 26 end
$$;
