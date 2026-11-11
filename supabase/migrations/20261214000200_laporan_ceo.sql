-- =====================================================================
--  Laporan bulanan WhatsApp untuk CEO (1 haribulan, 9:07 pagi waktu Malaysia)
--  Agregat sahaja: bilangan pekerja, kos gaji, cuti, tuntutan, kelewatan, kelulusan.
--  Tiada nama pekerja, IC atau gaji individu.
-- =====================================================================

alter table companies add column if not exists ceo_monthly_report boolean not null default true;

create or replace function fmt_rm(n numeric) returns text language sql immutable as $$
  select 'RM' || to_char(coalesce(n, 0), 'FM999,999,990.00')
$$;

create or replace function ceo_monthly_report_text(p_company uuid, p_month date) returns text
language plpgsql stable security definer set search_path = public as $$
declare m0 date := date_trunc('month', p_month)::date; m1 date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
        p0 date := (date_trunc('month', p_month) - interval '1 month')::date;
        bln text[] := array['Januari','Februari','Mac','April','Mei','Jun','Julai','Ogos','September','Oktober','November','Disember'];
        grace int; n_akhir int; n_baru int; n_henti int;
        kos numeric; kos_lepas numeric; bersih numeric; n_slip int;
        hari_cuti numeric; hari_mc numeric; rm_tuntut numeric; n_tuntut int; n_lewat int;
        n_lulus int; n_sla int; n_pending int;
        baris text[] := array[]::text[]; beza text;
begin
  select late_grace_minutes into grace from companies where id = p_company;

  select count(*) filter (where e.join_date <= m1 and (e.end_date is null or e.end_date > m1)),
         count(*) filter (where e.join_date between m0 and m1),
         count(*) filter (where e.end_date between m0 and m1)
    into n_akhir, n_baru, n_henti
    from employments e where e.company_id = p_company;

  -- Kos gaji (kasar + caruman majikan) bagi gaji yang diluluskan / dibayar untuk bulan itu
  select sum(s.gross + s.epf_employer + s.socso_employer + s.eis_employer + s.hrdf), sum(s.net), count(distinct s.employment_id)
    into kos, bersih, n_slip
    from payroll_runs r join payslips s on s.payroll_run_id = r.id
   where r.company_id = p_company and r.status in ('approved','paid')
     and r.period_year = extract(year from m0) and r.period_month = extract(month from m0);
  select sum(s.gross + s.epf_employer + s.socso_employer + s.eis_employer + s.hrdf) into kos_lepas
    from payroll_runs r join payslips s on s.payroll_run_id = r.id
   where r.company_id = p_company and r.status in ('approved','paid')
     and r.period_year = extract(year from p0) and r.period_month = extract(month from p0);

  -- Cuti diluluskan yang bermula dalam bulan itu
  select coalesce(sum(lr.days) filter (where lt.code <> 'MC'), 0), coalesce(sum(lr.days) filter (where lt.code = 'MC'), 0)
    into hari_cuti, hari_mc
    from leave_requests lr join employments e on e.id = lr.employment_id join leave_types lt on lt.id = lr.leave_type_id
   where e.company_id = p_company and lr.status = 'approved' and lr.start_date between m0 and m1;

  -- Tuntutan diluluskan dalam bulan itu
  select coalesce(sum(c.total_amount), 0), count(*) into rm_tuntut, n_tuntut
    from claims c join approval_requests r on r.id = c.approval_request_id
   where r.company_id = p_company and c.status = 'approved'
     and (r.completed_at at time zone 'Asia/Kuala_Lumpur')::date between m0 and m1;

  select count(*) into n_lewat from attendance_records a join employments e on e.id = a.employment_id
   where e.company_id = p_company and a.work_date between m0 and m1 and a.late_minutes > coalesce(grace, 0);

  select count(*) filter (where r.status = 'approved' and (r.completed_at at time zone 'Asia/Kuala_Lumpur')::date between m0 and m1),
         count(*) filter (where r.sla_breached and (r.submitted_at at time zone 'Asia/Kuala_Lumpur')::date between m0 and m1),
         count(*) filter (where r.status = 'pending')
    into n_lulus, n_sla, n_pending
    from approval_requests r where r.company_id = p_company;

  baris := baris || ('• Pekerja: ' || n_akhir || ' (' || n_baru || ' baharu, ' || n_henti || ' berhenti)');
  if kos is not null then
    beza := case when coalesce(kos_lepas, 0) > 0 then
              ' (' || case when kos >= kos_lepas then '+' else '' end || to_char(round((kos - kos_lepas) / kos_lepas * 100, 1), 'FM990.0') || '% berbanding bulan lepas)'
            else '' end;
    baris := baris || ('• Kos gaji: ' || fmt_rm(kos) || beza);
    baris := baris || ('• Gaji bersih dibayar: ' || fmt_rm(bersih) || ' kepada ' || n_slip || ' pekerja');
  else
    baris := baris || '• Gaji bulan ini belum diluluskan'::text;
  end if;
  baris := baris || ('• Cuti: ' || fmt_num(hari_cuti) || ' hari · MC: ' || fmt_num(hari_mc) || ' hari');
  baris := baris || ('• Tuntutan diluluskan: ' || fmt_rm(rm_tuntut) || ' (' || n_tuntut || ' tuntutan)');
  if n_lewat > 0 then baris := baris || ('• Lewat masuk: ' || n_lewat || ' kali'); end if;
  baris := baris || ('• Kelulusan: ' || n_lulus || ' diluluskan, ' || n_sla || ' melepasi tempoh, ' || n_pending || ' masih menunggu');

  return 'Laporan bulanan ' || bln[extract(month from m0)::int] || ' ' || extract(year from m0) || E':\n'
         || array_to_string(baris, E'\n') || E'\n\nButiran di HRBoost → Laporan.';
end $$;

create or replace function ceo_monthly_report() returns int
language plpgsql security definer set search_path = public as $$
declare c record; p record; msg text; n int := 0;
        bulan date := ((now() at time zone 'Asia/Kuala_Lumpur')::date - interval '1 month')::date;
begin
  for c in select id from companies where status = 'active' and ceo_monthly_report loop
    msg := ceo_monthly_report_text(c.id, bulan);
    for p in select distinct ur.person_id from user_roles ur
               join employments e on e.person_id = ur.person_id and e.company_id = c.id and e.status in ('probation','active')
              where ur.company_id = c.id and ur.role = 'ceo' loop
      perform notify_person(p.person_id, c.id, msg);
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'hrboost-ceo-monthly';
    perform cron.schedule('hrboost-ceo-monthly', '7 1 1 * *', 'select public.ceo_monthly_report()');  -- 1hb, 9:07 pagi MYT
  end if;
end $$;

-- Pratonton (Tetapan → Automasi): laporan bulan lepas
create or replace function ceo_monthly_report_preview(p_company uuid) returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_role(p_company, '{ceo,hr,admin}') then raise exception 'Tidak dibenarkan'; end if;
  return ceo_monthly_report_text(p_company, ((now() at time zone 'Asia/Kuala_Lumpur')::date - interval '1 month')::date);
end $$;

create or replace function set_ceo_monthly_report(p_company uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_role(p_company, '{ceo,hr,admin}') then raise exception 'Tidak dibenarkan'; end if;
  update companies set ceo_monthly_report = coalesce(p_on, true) where id = p_company;
end $$;

revoke all on function ceo_monthly_report_text(uuid, date) from public;
revoke all on function ceo_monthly_report() from public;
revoke all on function ceo_monthly_report_preview(uuid) from public;
revoke all on function set_ceo_monthly_report(uuid, boolean) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function ceo_monthly_report_text(uuid, date) from anon, authenticated;
    revoke all on function ceo_monthly_report() from anon, authenticated;
    grant execute on function ceo_monthly_report_preview(uuid) to authenticated;
    grant execute on function set_ceo_monthly_report(uuid, boolean) to authenticated;
  end if;
end $$;

-- Terjemahan WhatsApp (English)
insert into message_i18n(kind, ms, en, sort) values
  ('line', $q$^Laporan bulanan Januari (\d+):$$q$, $q$Monthly report January \1:$q$, 580),
  ('line', $q$^Laporan bulanan Februari (\d+):$$q$, $q$Monthly report February \1:$q$, 581),
  ('line', $q$^Laporan bulanan Mac (\d+):$$q$, $q$Monthly report March \1:$q$, 582),
  ('line', $q$^Laporan bulanan April (\d+):$$q$, $q$Monthly report April \1:$q$, 583),
  ('line', $q$^Laporan bulanan Mei (\d+):$$q$, $q$Monthly report May \1:$q$, 584),
  ('line', $q$^Laporan bulanan Jun (\d+):$$q$, $q$Monthly report June \1:$q$, 585),
  ('line', $q$^Laporan bulanan Julai (\d+):$$q$, $q$Monthly report July \1:$q$, 586),
  ('line', $q$^Laporan bulanan Ogos (\d+):$$q$, $q$Monthly report August \1:$q$, 587),
  ('line', $q$^Laporan bulanan September (\d+):$$q$, $q$Monthly report September \1:$q$, 588),
  ('line', $q$^Laporan bulanan Oktober (\d+):$$q$, $q$Monthly report October \1:$q$, 589),
  ('line', $q$^Laporan bulanan November (\d+):$$q$, $q$Monthly report November \1:$q$, 590),
  ('line', $q$^Laporan bulanan Disember (\d+):$$q$, $q$Monthly report December \1:$q$, 591),
  ('line', $q$^• Pekerja: (\d+) \((\d+) baharu, (\d+) berhenti\)$$q$, $q$• Employees: \1 (\2 new, \3 left)$q$, 601),
  ('line', $q$^• Kos gaji: (\S+) \(([+-]?[\d.]+)% berbanding bulan lepas\)$$q$, $q$• Payroll cost: \1 (\2% vs last month)$q$, 602),
  ('line', $q$^• Kos gaji: (\S+)$$q$, $q$• Payroll cost: \1$q$, 603),
  ('line', $q$^• Gaji bersih dibayar: (\S+) kepada (\d+) pekerja$$q$, $q$• Net pay: \1 to \2 employees$q$, 604),
  ('line', $q$^• Gaji bulan ini belum diluluskan$$q$, $q$• This month's payroll is not approved yet$q$, 605),
  ('line', $q$^• Cuti: (\S+) hari · MC: (\S+) hari$$q$, $q$• Leave: \1 days · MC: \2 days$q$, 606),
  ('line', $q$^• Tuntutan diluluskan: (\S+) \((\d+) tuntutan\)$$q$, $q$• Claims approved: \1 (\2 claims)$q$, 607),
  ('line', $q$^• Lewat masuk: (\d+) kali$$q$, $q$• Late arrivals: \1$q$, 608),
  ('line', $q$^• Kelulusan: (\d+) diluluskan, (\d+) melepasi tempoh, (\d+) masih menunggu$$q$, $q$• Approvals: \1 approved, \2 overdue, \3 still pending$q$, 609),
  ('line', $q$^Butiran di HRBoost → Laporan\.$$q$, $q$Details in HRBoost → Reports.$q$, 610)
on conflict (kind, ms) do nothing;
