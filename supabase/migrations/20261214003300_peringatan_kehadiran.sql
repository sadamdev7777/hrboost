-- =====================================================================
--  Peringatan daftar masuk / keluar (5 minit sebelum waktu kerja bermula & tamat)
--   • Pilihan syarikat (companies.attendance_reminders), dimatikan secara lalai.
--   • Hanya pada hari bekerja pekerja itu, bukan semasa cuti, dan hanya jika belum daftar masuk /
--     belum daftar keluar. Waktu ikut jadual kerja syarikat (atau waktu masuk khas pekerja).
--   • Sekali sahaja bagi setiap pekerja, hari & jenis (attendance_reminders_sent).
--   • my_attendance_today memberitahu sama ada syarikat menggunakan mesin kehadiran
--     (teks panduan di Utama: "daftar masuk di sini hanya jika bekerja di luar pejabat").
-- =====================================================================
alter table companies add column if not exists attendance_reminders boolean not null default false;

create table if not exists attendance_reminders_sent (
  employment_id uuid not null references employments(id) on delete cascade,
  work_date     date not null,
  kind          text not null check (kind in ('in','out')),
  sent_at       timestamptz not null default now(),
  primary key (employment_id, work_date, kind)
);
alter table attendance_reminders_sent enable row level security;

-- Waktu masuk & tamat pekerja pada tarikh itu (null jika bukan hari bekerja)
create or replace function _waktu_kerja(p_employment uuid, p_date date)
returns table(start_time time, end_time time)
language sql stable security definer set search_path = public as $$
  select coalesce(e.work_start, h.start_time), h.end_time
    from employments e cross join lateral company_day_hours(e.company_id, p_date) h
   where e.id = p_employment and is_working_day(e.company_id, p_date, e.work_state);
$$;

-- Dijalankan setiap minit (pg_cron). Menghantar peringatan dalam tempoh 5 minit sebelum waktu masuk / tamat.
create or replace function attendance_reminder_tick() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; mesin boolean;
begin
  for r in
    select e.id as eid, e.person_id, e.company_id, c.timezone tz, w.start_time, w.end_time,
           (now() at time zone c.timezone) as kini, (now() at time zone c.timezone)::date as hari,
           ar.clock_in, ar.clock_out,
           (select lr.half_day from leave_requests lr where lr.employment_id = e.id and lr.status = 'approved'
             and (now() at time zone c.timezone)::date between lr.start_date and lr.end_date limit 1) as cuti
      from companies c
      join employments e on e.company_id = c.id and e.status in ('probation','active')
      join persons p on p.id = e.person_id and p.is_active
      cross join lateral _waktu_kerja(e.id, (now() at time zone c.timezone)::date) w
      left join attendance_records ar on ar.employment_id = e.id and ar.work_date = (now() at time zone c.timezone)::date
     where c.attendance_reminders and c.status = 'active'
       and e.join_date <= (now() at time zone c.timezone)::date
       and (e.end_date is null or e.end_date >= (now() at time zone c.timezone)::date)
  loop
    if r.start_time is null or r.end_time is null then continue; end if;
    mesin := exists (select 1 from attendance_integrations i where i.company_id = r.company_id);
    -- Daftar masuk: 5 minit sebelum waktu masuk, belum daftar masuk, tiada cuti penuh / pagi
    if r.kini >= r.hari + r.start_time - interval '5 minutes' and r.kini < r.hari + r.start_time
       and r.clock_in is null and coalesce(r.cuti::text, '') not in ('full','am') then
      insert into attendance_reminders_sent(employment_id, work_date, kind) values (r.eid, r.hari, 'in') on conflict do nothing;
      if found then
        perform notify_person(r.person_id, r.company_id, case when mesin
          then format('Peringatan: waktu kerja bermula pada %s. Sila daftar masuk di mesin kehadiran, atau melalui HRBoost jika anda bekerja di luar pejabat.', to_char(r.start_time, 'FMHH24:MI'))
          else format('Peringatan: waktu kerja bermula pada %s. Sila daftar masuk melalui HRBoost.', to_char(r.start_time, 'FMHH24:MI')) end);
        n := n + 1;
      end if;
    end if;
    -- Daftar keluar: 5 minit sebelum waktu tamat, sudah daftar masuk tetapi belum daftar keluar, tiada cuti petang
    if r.kini >= r.hari + r.end_time - interval '5 minutes' and r.kini < r.hari + r.end_time
       and r.clock_in is not null and r.clock_out is null and coalesce(r.cuti::text, '') not in ('full','pm') then
      insert into attendance_reminders_sent(employment_id, work_date, kind) values (r.eid, r.hari, 'out') on conflict do nothing;
      if found then
        perform notify_person(r.person_id, r.company_id,
          format('Peringatan: waktu kerja tamat pada %s. Jangan lupa daftar keluar sebelum pulang.', to_char(r.end_time, 'FMHH24:MI')));
        n := n + 1;
      end if;
    end if;
  end loop;
  return n;
end $$;
revoke execute on function attendance_reminder_tick() from public, anon, authenticated;
revoke execute on function _waktu_kerja(uuid, date) from public, anon, authenticated;

create or replace function set_attendance_reminders(p_company uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Hanya HR/Pentadbir'; end if;
  update companies set attendance_reminders = coalesce(p_on, false) where id = p_company;
  perform log_platform('attendance.reminders_toggle', p_company, 'company', p_company, jsonb_build_object('on', coalesce(p_on, false)));
end $$;

create or replace function hr_gps_settings(p_company uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Hanya HR/Pentadbir'; end if;
  return jsonb_build_object(
    'enabled', (select gps_attendance from companies where id = p_company),
    'reminders', (select attendance_reminders from companies where id = p_company),
    'locations', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'lat', lat, 'lng', lng, 'radius_m', radius_m) order by name)
                             from company_locations where company_id = p_company and active), '[]'));
end $$;

create or replace function my_attendance_today(p_employment uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e employments; c companies; hari date;
begin
  select * into e from employments where id = p_employment;
  if e.id is null or e.person_id is distinct from current_person_id() then raise exception 'Bukan rekod anda'; end if;
  select * into c from companies where id = e.company_id;
  hari := (now() at time zone c.timezone)::date;
  return jsonb_build_object(
    'enabled', c.gps_attendance and c.status = 'active',
    'machine', exists (select 1 from attendance_integrations i where i.company_id = c.id),
    'date', hari,
    'punches', coalesce((select jsonb_agg(jsonb_build_object('punched_at', p.punched_at, 'source', p.source, 'kind', p.kind,
                                 'location_name', l.name, 'distance_m', p.distance_m, 'outside', p.outside) order by p.punched_at)
                          from attendance_punches p left join company_locations l on l.id = p.location_id
                         where p.employment_id = e.id and (p.punched_at at time zone c.timezone)::date = hari), '[]'));
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function set_attendance_reminders(uuid, boolean) from public, anon;
    grant execute on function set_attendance_reminders(uuid, boolean) to authenticated, service_role;
    grant execute on function attendance_reminder_tick() to service_role;
  end if;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'hrboost-attendance-reminders';
    perform cron.schedule('hrboost-attendance-reminders', '* * * * *', 'select public.attendance_reminder_tick()');
  end if;
end $$;

insert into message_i18n(kind, ms, en, sort, frasa) values
  ('message', $q$^Peringatan: waktu kerja bermula pada (\S+)\. Sila daftar masuk di mesin kehadiran, atau melalui HRBoost jika anda bekerja di luar pejabat\.$$q$,
              $q$Reminder: work starts at \1. Please check in at the attendance machine, or through HRBoost if you are working outside the office.$q$, 720, false),
  ('message', $q$^Peringatan: waktu kerja bermula pada (\S+)\. Sila daftar masuk melalui HRBoost\.$$q$,
              $q$Reminder: work starts at \1. Please check in through HRBoost.$q$, 721, false),
  ('message', $q$^Peringatan: waktu kerja tamat pada (\S+)\. Jangan lupa daftar keluar sebelum pulang\.$$q$,
              $q$Reminder: work ends at \1. Do not forget to check out before you leave.$q$, 722, false)
on conflict (kind, ms) do update set en = excluded.en, sort = excluded.sort, frasa = excluded.frasa;
