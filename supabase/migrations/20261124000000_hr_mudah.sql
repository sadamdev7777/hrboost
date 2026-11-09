-- =====================================================================
--  HR lebih mudah (berdasarkan kajian amalan sistem HR & keperluan berkanun)
--  1. Kalendar berkanun: KWSP / PERKESO & SIP / PCB / HRDF (15hb bulan
--     berikutnya), Borang EA & Borang E (tahunan) + peringatan WhatsApp.
--     Tarikh akhir disimpan sebagai DATA (platform_settings) — CLAUDE.md §1.7.
--  2. Laporan HR siap (bilangan & pusing ganti, baki cuti, cuti diambil,
--     kehadiran, tuntutan, kos gaji 12 bulan).
--  3. Bendera semakan gaji dengan penjelasan (sebelum hantar kelulusan).
--  4. Tarikh tamat: kontrak, pasport, permit kerja, dokumen.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Kalendar berkanun
-- ---------------------------------------------------------------------
insert into platform_settings(key, value)
values ('statutory_deadlines', '{"monthly_day": 15, "ea": "02-28", "borang_e": "03-31", "reminder_days": [5, 1]}')
on conflict (key) do nothing;

create table if not exists statutory_submissions (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  kind          text not null check (kind in ('epf','socso','pcb','hrdf','ea','borang_e')),
  period_year   int not null,
  period_month  int not null default 0,          -- 0 = tahunan
  submitted_at  timestamptz not null default now(),
  submitted_by  uuid references persons(id),
  reference     text,
  unique (company_id, kind, period_year, period_month)
);
alter table statutory_submissions enable row level security;
create policy read_mgmt on statutory_submissions for select using (has_role(company_id, '{hr,finance,ceo,admin}'));

-- Senarai kewajipan yang belum selesai (tertunggak ≤ 60 hari atau tiba ≤ 45 hari lagi)
create or replace function statutory_due_items(p_company uuid, p_today date default null)
returns table(kind text, label text, period_year int, period_month int, due_date date, days_left int, payroll_ready boolean)
language plpgsql stable security definer set search_path = public as $$
declare t date := coalesce(p_today, (now() at time zone 'Asia/Kuala_Lumpur')::date);
        cfg jsonb := coalesce((select value from platform_settings where key = 'statutory_deadlines'), '{}');
        hari int := coalesce((cfg->>'monthly_day')::int, 15);
        c companies; w date; due date; k text; y int;
begin
  select * into c from companies where id = p_company;
  if c.id is null then return; end if;
  -- Bulanan: gaji bulan W → tarikh akhir hari ke-15 bulan W+1
  for w in select (date_trunc('month', t) - make_interval(months => i))::date from generate_series(0, 2) i loop
    due := (w + interval '1 month')::date + (hari - 1);
    continue when due < t - 60 or due > t + 45;
    foreach k in array array['epf','socso','pcb'] || case when c.hrdf_registered then array['hrdf'] else array[]::text[] end loop
      continue when exists (select 1 from statutory_submissions s where s.company_id = c.id and s.kind = k
                              and s.period_year = extract(year from w) and s.period_month = extract(month from w));
      kind := k;
      label := case k when 'epf' then 'Caruman KWSP' when 'socso' then 'Caruman PERKESO & SIP' when 'pcb' then 'PCB (CP39)' else 'Levi HRD Corp' end;
      period_year := extract(year from w); period_month := extract(month from w);
      due_date := due; days_left := due - t;
      payroll_ready := exists (select 1 from payroll_runs r where r.company_id = c.id and r.period_year = extract(year from w)
                                 and r.period_month = extract(month from w) and r.status in ('approved','paid','locked'));
      -- Bulan tanpa gaji dalam HRBoost: hanya dipaparkan sebagai peringatan menjelang tarikh akhir
      continue when not payroll_ready and (due > t + 20 or due < t);
      return next;
    end loop;
  end loop;
  -- Tahunan: Borang EA (kepada pekerja) & Borang E (kepada LHDN) bagi tahun lepas
  y := extract(year from t)::int - 1;
  foreach k in array array['ea','borang_e'] loop
    due := make_date(y + 1, split_part(cfg->>k, '-', 1)::int, split_part(cfg->>k, '-', 2)::int);
    continue when due < t - 30 or due > t + 60;
    continue when exists (select 1 from statutory_submissions s where s.company_id = c.id and s.kind = k and s.period_year = y and s.period_month = 0);
    continue when not exists (select 1 from payroll_runs r where r.company_id = c.id and r.period_year = y and r.status in ('paid','locked'));
    kind := k;
    label := case k when 'ea' then 'Borang EA kepada pekerja' else 'Borang E kepada LHDN' end;
    period_year := y; period_month := 0; due_date := due; days_left := due - t; payroll_ready := true;
    return next;
  end loop;
end $$;

create or replace function statutory_calendar(p_company uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_role(p_company, '{hr,finance,ceo,admin}') then raise exception 'Tidak dibenarkan'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.due_date, x.kind) from statutory_due_items(p_company) x), '[]');
end $$;

create or replace function mark_statutory_submitted(p_company uuid, p_kind text, p_year int, p_month int, p_reference text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_role(p_company, '{hr,finance,admin}') then raise exception 'Hanya HR / Kewangan'; end if;
  insert into statutory_submissions(company_id, kind, period_year, period_month, submitted_by, reference)
  values (p_company, p_kind, p_year, coalesce(p_month, 0), current_person_id(), nullif(trim(coalesce(p_reference, '')), ''))
  on conflict (company_id, kind, period_year, period_month) do update set reference = excluded.reference, submitted_at = now(), submitted_by = excluded.submitted_by;
end $$;

-- Peringatan WhatsApp kepada HR & Kewangan (5 hari dan 1 hari sebelum tarikh akhir)
create or replace function statutory_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare c record; x record; p record; n int := 0;
        hari int[] := coalesce((select array(select jsonb_array_elements_text(value->'reminder_days')::int) from platform_settings where key = 'statutory_deadlines'), array[5, 1]);
        bln text[] := array['Januari','Februari','Mac','April','Mei','Jun','Julai','Ogos','September','Oktober','November','Disember'];
begin
  for c in select id from companies where status = 'active' loop
    for x in select * from statutory_due_items(c.id) d where d.days_left = any(hari) loop
      for p in select distinct ur.person_id from user_roles ur join employments e on e.person_id = ur.person_id and e.company_id = c.id
                where ur.company_id = c.id and ur.role in ('hr','finance') and e.status in ('probation','active') loop
        perform notify_person(p.person_id, c.id,
          'Peringatan: ' || x.label || case when x.period_month > 0 then ' bagi gaji ' || bln[x.period_month] || ' ' || x.period_year else ' ' || x.period_year end ||
          ' perlu dihantar sebelum ' || to_char(x.due_date, 'DD/MM/YYYY') || ' (' || x.days_left || ' hari lagi). Fail boleh dimuat turun di HRBoost → Gaji → Sejarah.');
        n := n + 1;
      end loop;
    end loop;
  end loop;
  return n;
end $$;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'hrboost-statutory-reminders';
    perform cron.schedule('hrboost-statutory-reminders', '7 1 * * *', 'select public.statutory_reminders()');  -- 9:07 pagi MYT
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Laporan HR
-- ---------------------------------------------------------------------
create or replace function hr_report(p_company uuid, p_kind text, p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare res jsonb; grace int;
begin
  if not has_role(p_company, '{hr,finance,ceo,admin}') then raise exception 'Tidak dibenarkan'; end if;
  select late_grace_minutes into grace from companies where id = p_company;

  if p_kind = 'pekerja' then
    with d as (
      select coalesce(dp.name, 'Tiada jabatan') jab,
             count(*) filter (where e.status in ('probation','active') and e.join_date <= p_to) aktif,
             count(*) filter (where e.join_date between p_from and p_to) masuk,
             count(*) filter (where e.end_date between p_from and p_to) keluar,
             count(*) filter (where e.end_date between p_from and p_to and e.end_date - e.join_date < 90) keluar_90,
             count(*) filter (where e.join_date <= p_from and (e.end_date is null or e.end_date >= p_from)) awal
        from employments e left join departments dp on dp.id = e.department_id
       where e.company_id = p_company
       group by 1)
    select jsonb_agg(jsonb_build_object('jabatan', jab, 'aktif', aktif, 'masuk', masuk, 'keluar', keluar, 'keluar_90', keluar_90,
             'pusing_ganti', case when (awal + aktif) > 0 then round(keluar * 200.0 / (awal + aktif), 1) else 0 end) order by jab)
      into res from d;
  elsif p_kind = 'baki_cuti' then
    select jsonb_agg(jsonb_build_object('pekerja', coalesce(p.preferred_name, p.full_name), 'no', e.employee_no, 'jabatan', dp.name,
             'jenis', lt.name, 'kelayakan', b.entitled + b.carried_forward + b.adjustment, 'diambil', b.used, 'menunggu', b.pending, 'baki', b.available)
             order by e.employee_no, lt.name) into res
      from leave_balances b join employments e on e.id = b.employment_id join persons p on p.id = e.person_id
      join leave_types lt on lt.id = b.leave_type_id left join departments dp on dp.id = e.department_id
     where e.company_id = p_company and e.status in ('probation','active') and b.year = extract(year from p_to);
  elsif p_kind = 'cuti_diambil' then
    select jsonb_agg(jsonb_build_object('jabatan', jab, 'jenis', jenis, 'permohonan', n, 'hari', hari) order by jab, jenis) into res from (
      select coalesce(dp.name, 'Tiada jabatan') jab, lt.name jenis, count(*) n, sum(lr.days) hari
        from leave_requests lr join employments e on e.id = lr.employment_id join leave_types lt on lt.id = lr.leave_type_id
        left join departments dp on dp.id = e.department_id
       where e.company_id = p_company and lr.status = 'approved' and lr.start_date between p_from and p_to
       group by 1, 2) z;
  elsif p_kind = 'kehadiran' then
    select jsonb_agg(jsonb_build_object('pekerja', nm, 'no', no, 'jabatan', jab, 'hadir', hadir, 'lewat', lewat, 'purata_lewat_minit', purata) order by no) into res from (
      select coalesce(p.preferred_name, p.full_name) nm, e.employee_no no, dp.name jab,
             count(a.id) filter (where a.clock_in is not null) hadir,
             count(a.id) filter (where a.late_minutes > grace) lewat,
             coalesce(round(avg(a.late_minutes) filter (where a.late_minutes > grace)), 0) purata
        from employments e join persons p on p.id = e.person_id left join departments dp on dp.id = e.department_id
        left join attendance_records a on a.employment_id = e.id and a.work_date between p_from and p_to
       where e.company_id = p_company and e.status in ('probation','active')
       group by 1, 2, 3) z;
  elsif p_kind = 'tuntutan' then
    select jsonb_agg(jsonb_build_object('jenis', jenis, 'jabatan', jab, 'bilangan', n, 'jumlah', jumlah) order by jumlah desc) into res from (
      select coalesce(ct.name, 'Lain-lain') jenis, coalesce(dp.name, 'Tiada jabatan') jab, count(distinct cl.id) n, sum(ci.amount) jumlah
        from claims cl join claim_items ci on ci.claim_id = cl.id join employments e on e.id = cl.employment_id
        left join claim_types ct on ct.id = ci.claim_type_id
        left join departments dp on dp.id = e.department_id
       where e.company_id = p_company and cl.status = 'approved' and ci.expense_date between p_from and p_to
       group by 1, 2) z;
  elsif p_kind = 'kos_gaji' then
    if not has_role(p_company, '{hr,finance,admin}') then raise exception 'Laporan gaji hanya untuk HR / Kewangan'; end if;
    insert into data_access_log(actor_person_id, subject_person_id, resource, via) values (current_person_id(), null, 'payroll_report', 'web');
    select jsonb_agg(jsonb_build_object('bulan', make_date(r.period_year, r.period_month, 1), 'status', r.status,
             'pekerja', (r.totals->>'headcount')::int, 'kasar', (r.totals->>'gross')::numeric, 'bersih', (r.totals->>'net')::numeric,
             'caruman_majikan', (r.totals->>'employer')::numeric, 'pcb', (r.totals->>'pcb')::numeric,
             'kos_majikan', coalesce((r.totals->>'gross')::numeric, 0) + coalesce((r.totals->>'employer')::numeric, 0))
             order by r.period_year, r.period_month) into res
      from payroll_runs r
     where r.company_id = p_company and r.totals is not null
       and make_date(r.period_year, r.period_month, 1) between date_trunc('month', p_from) and p_to;
  else
    raise exception 'Jenis laporan tidak sah';
  end if;
  return coalesce(res, '[]');
end $$;

-- ---------------------------------------------------------------------
-- 3. Bendera semakan gaji (bulan ini berbanding bulan lepas), dengan penjelasan
-- ---------------------------------------------------------------------
create or replace function payroll_flags(p_run uuid)
returns table(employment_id uuid, name text, level text, message text)
language plpgsql stable security definer set search_path = public as $$
declare r payroll_runs; prev uuid; d0 date; d1 date;
begin
  select * into r from payroll_runs where id = p_run;
  if r.id is null or not has_role(r.company_id, '{hr,finance,ceo,admin}') then raise exception 'Tidak dibenarkan'; end if;
  d0 := make_date(r.period_year, r.period_month, 1); d1 := (d0 + interval '1 month - 1 day')::date;
  select id into prev from payroll_runs where company_id = r.company_id and make_date(period_year, period_month, 1) = (d0 - interval '1 month')::date;
  return query
  select z.eid, z.nm, z.lv, z.msg from (
  with s as (
    select ps.*, e.join_date, e.end_date, e.person_id, coalesce(p.preferred_name, p.full_name) nm, p.bank_account_no,
           (select x.gross from payslips x where x.payroll_run_id = prev and x.employment_id = ps.employment_id) gross_lalu,
           (select x.net from payslips x where x.payroll_run_id = prev and x.employment_id = ps.employment_id) net_lalu
      from payslips ps join employments e on e.id = ps.employment_id join persons p on p.id = e.person_id
     where ps.payroll_run_id = p_run)
  select s.employment_id eid, s.nm, 'ralat'::text lv, 'Gaji bersih ' || case when s.net < 0 then 'negatif' else 'RM0' end || ' — potongan melebihi pendapatan. Semak potongan dan cuti tanpa gaji.' msg
    from s where s.net <= 0
  union all
  select s.employment_id, s.nm, 'ralat', 'Akaun bank tiada — gaji tidak boleh dimasukkan dalam fail bayaran bank.'
    from s where coalesce(s.bank_account_no, '') = '' and s.net > 0
  union all
  select s.employment_id, s.nm, 'amaran',
         'Gaji kasar ' || case when s.gross > s.gross_lalu then 'naik' else 'turun' end || ' ' ||
         round(abs(s.gross - s.gross_lalu) * 100 / nullif(s.gross_lalu, 0)) || '% berbanding bulan lepas (RM' ||
         to_char(s.gross_lalu, 'FM999,999,990.00') || ' → RM' || to_char(s.gross, 'FM999,999,990.00') || ').'
    from s where s.gross_lalu > 0 and abs(s.gross - s.gross_lalu) / s.gross_lalu > 0.10
  union all
  select s.employment_id, s.nm, 'maklumat', 'Pekerja baharu bulan ini (mula ' || to_char(s.join_date, 'DD/MM') || ') — gaji pertama, semak prorata.'
    from s where s.join_date between d0 and d1
  union all
  select s.employment_id, s.nm, 'maklumat', 'Hari terakhir bekerja ' || to_char(s.end_date, 'DD/MM') || ' — gaji akhir, semak baki cuti & notis.'
    from s where s.end_date between d0 and d1
  union all
  select s.employment_id, s.nm, 'amaran', 'PCB RM0 walaupun gaji kasar RM' || to_char(s.gross, 'FM999,999,990') || ' — semak data terkumpul tahun ini dan status cukai pekerja.'
    from s where s.pcb = 0 and s.gross >= 5000
  union all
  select s.employment_id, s.nm, 'maklumat', rtrim(rtrim(s.unpaid_leave_days::text, '0'), '.') || ' hari cuti tanpa gaji ditolak.'
    from s where s.unpaid_leave_days > 0
  ) z order by case z.lv when 'ralat' then 0 when 'amaran' then 1 else 2 end, z.nm;
end $$;

-- ---------------------------------------------------------------------
-- 4. Tarikh tamat: kontrak, pasport, permit kerja, dokumen
-- ---------------------------------------------------------------------
alter table persons add column if not exists passport_expiry date;
alter table persons add column if not exists permit_expiry date;
alter table employee_documents add column if not exists expiry_date date;

create or replace function hr_set_expiry(p_employment uuid, p_contract_end date, p_passport_expiry date, p_permit_expiry date)
returns void language plpgsql security definer set search_path = public as $$
declare e employments;
begin
  select * into e from employments where id = p_employment;
  if e.id is null or not has_role(e.company_id, '{hr,admin}') then raise exception 'Hanya HR / Pentadbir'; end if;
  update employments set contract_end_date = p_contract_end where id = e.id;
  update persons set passport_expiry = p_passport_expiry, permit_expiry = p_permit_expiry where id = e.person_id;
end $$;

create or replace function hr_expiring(p_company uuid, p_days int default 60)
returns table(kind text, employment_id uuid, name text, expiry date, days_left int, text text)
language plpgsql stable security definer set search_path = public as $$
declare t date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
begin
  if not has_role(p_company, '{hr,admin}') then return; end if;
  return query
  select 'contract', e.id, coalesce(p.preferred_name, p.full_name), e.contract_end_date, (e.contract_end_date - t)::int,
         'Kontrak ' || coalesce(p.preferred_name, p.full_name) || ' tamat ' || to_char(e.contract_end_date, 'DD/MM/YYYY')
    from employments e join persons p on p.id = e.person_id
   where e.company_id = p_company and e.status in ('probation','active') and e.contract_end_date between t - 7 and t + least(p_days, 30)
  union all
  select 'permit', e.id, coalesce(p.preferred_name, p.full_name), p.permit_expiry, (p.permit_expiry - t)::int,
         'Permit kerja ' || coalesce(p.preferred_name, p.full_name) || ' tamat ' || to_char(p.permit_expiry, 'DD/MM/YYYY')
    from employments e join persons p on p.id = e.person_id
   where e.company_id = p_company and e.status in ('probation','active') and p.permit_expiry between t - 30 and t + p_days
  union all
  select 'passport', e.id, coalesce(p.preferred_name, p.full_name), p.passport_expiry, (p.passport_expiry - t)::int,
         'Pasport ' || coalesce(p.preferred_name, p.full_name) || ' tamat ' || to_char(p.passport_expiry, 'DD/MM/YYYY')
    from employments e join persons p on p.id = e.person_id
   where e.company_id = p_company and e.status in ('probation','active') and p.passport_expiry between t - 30 and t + p_days
  union all
  select 'document', e.id, coalesce(p.preferred_name, p.full_name), d.expiry_date, (d.expiry_date - t)::int,
         d.title || ' (' || coalesce(p.preferred_name, p.full_name) || ') tamat ' || to_char(d.expiry_date, 'DD/MM/YYYY')
    from employee_documents d join employments e on e.id = d.employment_id join persons p on p.id = e.person_id
   where e.company_id = p_company and e.status in ('probation','active') and d.expiry_date between t - 30 and t + least(p_days, 30)
  order by 5;
end $$;

-- ---------------------------------------------------------------------
-- Kebenaran
-- ---------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array['statutory_due_items(uuid, date)', 'statutory_calendar(uuid)', 'mark_statutory_submitted(uuid, text, int, int, text)',
    'statutory_reminders()', 'hr_report(uuid, text, date, date)', 'payroll_flags(uuid)', 'hr_set_expiry(uuid, date, date, date)',
    'hr_expiring(uuid, int)'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f);
      if f in ('statutory_due_items(uuid, date)', 'statutory_reminders()') then
        execute format('grant execute on function %s to service_role', f);
      else
        execute format('grant execute on function %s to authenticated, service_role', f);
      end if;
    end if;
  end loop;
end $$;
