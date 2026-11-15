-- =====================================================================
--  Peringatan hari gaji: HR & Kewangan diingatkan 5 hari dan 1 hari sebelum hari gaji
--  (companies.payday dalam Tetapan Gaji), ikut corak statutory_reminders().
--  Hari gaji melebihi hari terakhir bulan dikepit (cth. 31 → 30 November).
-- =====================================================================

alter table companies add column if not exists payday_reminder boolean not null default true;

create or replace function payday_reminders(p_today date default null) returns int
language plpgsql security definer set search_path = public as $$
declare c record; p record; n int := 0; t date := coalesce(p_today, (now() at time zone 'Asia/Kuala_Lumpur')::date);
        hari int[] := coalesce((select array(select jsonb_array_elements_text(value->'reminder_days')::int) from platform_settings where key = 'statutory_deadlines'), array[5, 1]);
        bln text[] := array['Januari','Februari','Mac','April','Mei','Jun','Julai','Ogos','September','Oktober','November','Disember'];
        bulan date; gajian date; baki int; lulus boolean; status_teks text;
begin
  for c in select id, payday from companies where status = 'active' and payday_reminder loop
    bulan := date_trunc('month', t)::date;
    gajian := bulan + (least(c.payday, extract(day from (bulan + interval '1 month - 1 day'))::int) - 1);
    if gajian < t then
      bulan := (bulan + interval '1 month')::date;
      gajian := bulan + (least(c.payday, extract(day from (bulan + interval '1 month - 1 day'))::int) - 1);
    end if;
    baki := gajian - t;
    continue when not (baki = any(hari));
    lulus := exists (select 1 from payroll_runs r where r.company_id = c.id and r.period_year = extract(year from bulan)::int
                       and r.period_month = extract(month from bulan)::int and r.kind = 'regular'
                       and r.status in ('approved','paid','locked'));
    status_teks := case when lulus then 'Gaji bulan ini telah diluluskan.' else 'Gaji bulan ini belum diluluskan.' end;
    for p in select distinct ur.person_id from user_roles ur join employments e on e.person_id = ur.person_id and e.company_id = c.id
              where ur.company_id = c.id and ur.role in ('hr','finance') and e.status in ('probation','active') loop
      perform notify_person(p.person_id, c.id,
        'Peringatan: hari gaji ' || bln[extract(month from bulan)::int] || ' ' || extract(year from bulan)::int ||
        ' ialah ' || to_char(gajian, 'DD/MM/YYYY') || ' (' || baki || ' hari lagi). ' || status_teks || ' Semak di HRBoost → Gaji.');
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;

-- Suis dalam Tetapan Gaji
create or replace function set_payday_reminder(p_company uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_role(p_company, '{hr,finance,admin}') then raise exception 'Hanya HR / Kewangan / Pentadbir'; end if;
  update companies set payday_reminder = coalesce(p_on, true) where id = p_company;
end $$;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'hrboost-payday-reminders';
    perform cron.schedule('hrboost-payday-reminders', '7 1 * * *', 'select public.payday_reminders()');  -- 9:07 pagi MYT
  end if;
end $$;

insert into message_i18n(kind, ms, en, sort, frasa) values
  ('message', $q$^Peringatan: hari gaji (\S+) (\d{4}) ialah (\S+) \((\d+) hari lagi\)\. Gaji bulan ini telah diluluskan\. Semak di HRBoost → Gaji\.$$q$,
              $q$Reminder: \1 \2 payday is \3 (\4 days left). This month's payroll has been approved. Check it in HRBoost → Payroll.$q$, 690, true),
  ('message', $q$^Peringatan: hari gaji (\S+) (\d{4}) ialah (\S+) \((\d+) hari lagi\)\. Gaji bulan ini belum diluluskan\. Semak di HRBoost → Gaji\.$$q$,
              $q$Reminder: \1 \2 payday is \3 (\4 days left). This month's payroll has not been approved yet. Check it in HRBoost → Payroll.$q$, 691, true)
on conflict (kind, ms) do update set en = excluded.en, sort = excluded.sort, frasa = excluded.frasa;

do $$
declare f text;
begin
  foreach f in array array['payday_reminders(date)', 'set_payday_reminder(uuid, boolean)'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f);
      if f = 'set_payday_reminder(uuid, boolean)' then
        execute format('grant execute on function %s to authenticated, service_role', f);
      else
        execute format('revoke all on function %s from authenticated', f);
        execute format('grant execute on function %s to service_role', f);
      end if;
    end if;
  end loop;
end $$;
