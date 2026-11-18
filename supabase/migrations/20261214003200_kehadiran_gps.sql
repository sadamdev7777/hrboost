-- =====================================================================
--  Daftar masuk / keluar melalui telefon (GPS + swafoto)
--   • Pilihan syarikat (companies.gps_attendance), dimatikan secara lalai.
--   • Lokasi pejabat (company_locations) dengan radius. Di luar radius tetap dibenarkan
--     tetapi ditanda "Luar lokasi" (lokasi sebenar & jarak disimpan).
--   • Swafoto wajib (bucket peribadi, folder pekerja sendiri).
--   • Mesin (CrossChex) & telefon aktif serentak: masuk = punch terawal, keluar = punch terakhir.
--   • Masa diambil daripada pelayan, bukan telefon.
--  Tiada data sedia ada diubah.
-- =====================================================================

alter table companies add column if not exists gps_attendance boolean not null default false;

create table if not exists company_locations (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 80),
  lat         numeric(9,6) not null check (lat between -90 and 90),
  lng         numeric(9,6) not null check (lng between -180 and 180),
  radius_m    int not null default 150 check (radius_m between 30 and 2000),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists company_locations_company_idx on company_locations(company_id) where active;
alter table company_locations enable row level security;
drop policy if exists read_member on company_locations;
create policy read_member on company_locations for select using (is_company_member(company_id));

alter table attendance_punches
  add column if not exists source       text not null default 'crosschex' check (source in ('crosschex','gps')),
  add column if not exists kind         text check (kind in ('in','out')),
  add column if not exists lat          numeric(9,6),
  add column if not exists lng          numeric(9,6),
  add column if not exists accuracy_m   numeric(8,1),
  add column if not exists location_id  uuid references company_locations(id) on delete set null,
  add column if not exists distance_m   int,
  add column if not exists outside      boolean,
  add column if not exists selfie_path  text;
create index if not exists attendance_punches_emp_time_idx on attendance_punches(employment_id, punched_at);

-- Jarak (meter) antara dua koordinat (haversine)
create or replace function geo_distance_m(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric) returns int
language sql immutable as $$
  select round(2 * 6371000 * asin(sqrt(
           power(sin(radians((lat2 - lat1)::float8) / 2), 2)
         + cos(radians(lat1::float8)) * cos(radians(lat2::float8)) * power(sin(radians((lng2 - lng1)::float8) / 2), 2))))::int
$$;

-- Bina semula rekod harian daripada semua punch (mesin & telefon): masuk = terawal, keluar = terakhir (≥ 2 punch).
create or replace function rebuild_attendance_day(p_employment uuid, p_date date)
returns void language plpgsql security definer set search_path = public as $$
declare tz text; first_p attendance_punches; last_p attendance_punches; n int; semua_cc boolean; semua_gps boolean; src text; mentah jsonb;
begin
  select c.timezone into tz from employments e join companies c on c.id = e.company_id where e.id = p_employment;
  select count(*), bool_and(source = 'crosschex'), bool_and(source = 'gps') into n, semua_cc, semua_gps
    from attendance_punches
   where employment_id = p_employment and (punched_at at time zone tz)::date = p_date;
  if n = 0 then return; end if;
  select * into first_p from attendance_punches
   where employment_id = p_employment and (punched_at at time zone tz)::date = p_date order by punched_at, id limit 1;
  select * into last_p from attendance_punches
   where employment_id = p_employment and (punched_at at time zone tz)::date = p_date order by punched_at desc, id desc limit 1;
  src := case when semua_cc then 'crosschex' when semua_gps then 'gps' else 'campuran' end;
  mentah := case when src = 'crosschex' then null else jsonb_strip_nulls(jsonb_build_object(
              'in_source', first_p.source, 'in_outside', first_p.outside,
              'out_source', case when n > 1 then last_p.source end, 'out_outside', case when n > 1 then last_p.outside end)) end;
  insert into attendance_records(employment_id, work_date, clock_in, clock_out, source, external_id, raw)
  values (p_employment, p_date, first_p.punched_at, case when n > 1 then last_p.punched_at end, src,
          'cc:' || p_employment || ':' || p_date, mentah)
  on conflict (employment_id, work_date) do update
    set clock_in = excluded.clock_in, clock_out = excluded.clock_out, source = excluded.source, raw = excluded.raw
    where attendance_records.source <> 'correction';
end $$;
revoke execute on function rebuild_attendance_day(uuid, date) from public, anon, authenticated;

-- Pekerja: daftar masuk / keluar melalui telefon
create or replace function attendance_gps_punch(p_employment uuid, p_kind text, p_lat numeric, p_lng numeric,
       p_accuracy numeric, p_selfie_path text, p_via action_channel default 'web')
returns jsonb language plpgsql security definer set search_path = public as $$
declare e employments; c companies; me uuid := current_person_id(); tz text; hari date; lok record; jarak int;
        luar boolean; ada int; akhir timestamptz; pid bigint; masa timestamptz := now();
begin
  select * into e from employments where id = p_employment;
  if me is null or e.id is null or e.person_id <> me or e.status not in ('probation','active') then raise exception 'Bukan rekod anda'; end if;
  select * into c from companies where id = e.company_id;
  if c.status <> 'active' or not c.gps_attendance then raise exception 'Daftar masuk melalui telefon tidak diaktifkan oleh syarikat anda'; end if;
  if p_kind not in ('in','out') then raise exception 'Jenis tidak sah'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Lokasi tidak dapat dikesan. Sila hidupkan GPS dan benarkan akses lokasi.';
  end if;
  if coalesce(p_accuracy, 0) > 1000 then raise exception 'Isyarat GPS terlalu lemah. Cuba di kawasan terbuka.'; end if;
  if coalesce(p_selfie_path, '') = '' or split_part(p_selfie_path, '/', 1) <> me::text then raise exception 'Sila ambil swafoto'; end if;

  tz := c.timezone;
  hari := (masa at time zone tz)::date;
  select count(*), max(punched_at) into ada, akhir from attendance_punches
   where employment_id = e.id and (punched_at at time zone tz)::date = hari;
  if p_kind = 'in' and ada > 0 then
    raise exception 'Anda telah daftar masuk hari ini pada %', to_char((select min(punched_at) from attendance_punches
      where employment_id = e.id and (punched_at at time zone tz)::date = hari) at time zone tz, 'HH24:MI');
  end if;
  if p_kind = 'out' and ada = 0 then raise exception 'Sila daftar masuk dahulu'; end if;
  if akhir is not null and masa - akhir < interval '1 minute' then raise exception 'Kehadiran baru sahaja direkod. Cuba sebentar lagi.'; end if;

  select l.id, l.name, l.radius_m, geo_distance_m(p_lat, p_lng, l.lat, l.lng) as d into lok
    from company_locations l where l.company_id = c.id and l.active
   order by geo_distance_m(p_lat, p_lng, l.lat, l.lng) limit 1;
  jarak := lok.d;
  luar := lok.id is null or jarak > lok.radius_m + least(coalesce(p_accuracy, 0), 100);

  insert into attendance_punches(company_id, employment_id, workno, external_uuid, punched_at, source, kind,
                                 lat, lng, accuracy_m, location_id, distance_m, outside, selfie_path, device_name, raw)
  values (c.id, e.id, 'gps', 'gps:' || gen_random_uuid(), masa, 'gps', p_kind,
          round(p_lat, 6), round(p_lng, 6), p_accuracy, lok.id, jarak, luar, p_selfie_path, 'Telefon',
          jsonb_build_object('via', p_via))
  returning id into pid;
  perform rebuild_attendance_day(e.id, hari);

  return jsonb_build_object('id', pid, 'punched_at', masa, 'kind', p_kind, 'location_name', lok.name,
                            'distance_m', jarak, 'outside', luar);
end $$;

-- Punch hari ini (butang Daftar masuk / keluar di Utama)
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
    'date', hari,
    'punches', coalesce((select jsonb_agg(jsonb_build_object('punched_at', p.punched_at, 'source', p.source, 'kind', p.kind,
                                 'location_name', l.name, 'distance_m', p.distance_m, 'outside', p.outside) order by p.punched_at)
                          from attendance_punches p left join company_locations l on l.id = p.location_id
                         where p.employment_id = e.id and (p.punched_at at time zone c.timezone)::date = hari), '[]'));
end $$;

-- HR / Pentadbir: hidupkan / matikan
create or replace function set_gps_attendance(p_company uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Hanya HR/Pentadbir'; end if;
  update companies set gps_attendance = coalesce(p_on, false) where id = p_company;
  perform log_platform('attendance.gps_toggle', p_company, 'company', p_company, jsonb_build_object('on', coalesce(p_on, false)));
end $$;

create or replace function hr_location_save(p_company uuid, p_data jsonb, p_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid := p_id; nama text := trim(coalesce(p_data->>'name', '')); la numeric; lo numeric; r int;
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Hanya HR/Pentadbir'; end if;
  if nama = '' then raise exception 'Sila isi nama lokasi'; end if;
  begin
    la := (p_data->>'lat')::numeric; lo := (p_data->>'lng')::numeric; r := coalesce((p_data->>'radius_m')::int, 150);
  exception when others then raise exception 'Koordinat tidak sah';
  end;
  if la is null or lo is null or la not between -90 and 90 or lo not between -180 and 180 then raise exception 'Koordinat tidak sah'; end if;
  if r not between 30 and 2000 then raise exception 'Radius mesti antara 30 dan 2,000 meter'; end if;
  if v is null then
    insert into company_locations(company_id, name, lat, lng, radius_m) values (p_company, left(nama, 80), round(la, 6), round(lo, 6), r) returning id into v;
  else
    update company_locations set name = left(nama, 80), lat = round(la, 6), lng = round(lo, 6), radius_m = r
     where id = v and company_id = p_company;
    if not found then raise exception 'Lokasi tidak dijumpai'; end if;
  end if;
  perform log_platform('attendance.location_save', p_company, 'company_location', v, jsonb_build_object('radius_m', r));
  return v;
end $$;

create or replace function hr_location_delete(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare l company_locations;
begin
  select * into l from company_locations where id = p_id;
  if l.id is null or not has_role(l.company_id, '{hr,admin}') then raise exception 'Hanya HR/Pentadbir'; end if;
  -- Punch lama kekal; hanya dinyahaktif supaya nama lokasi masih dipaparkan
  update company_locations set active = false where id = p_id;
  perform log_platform('attendance.location_delete', l.company_id, 'company_location', p_id, '{}');
end $$;

create or replace function hr_gps_settings(p_company uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Hanya HR/Pentadbir'; end if;
  return jsonb_build_object(
    'enabled', (select gps_attendance from companies where id = p_company),
    'locations', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'lat', lat, 'lng', lng, 'radius_m', radius_m) order by name)
                             from company_locations where company_id = p_company and active), '[]'));
end $$;

-- HR: buka swafoto punch (direkod dalam data_access_log); memulangkan laluan fail
create or replace function hr_attendance_selfie(p_punch bigint)
returns text language plpgsql security definer set search_path = public as $$
declare p attendance_punches; e employments;
begin
  select * into p from attendance_punches where id = p_punch;
  select * into e from employments where id = p.employment_id;
  if p.id is null or e.id is null or not has_role(e.company_id, '{hr,admin}') then raise exception 'Tidak dibenarkan'; end if;
  insert into data_access_log(actor_person_id, subject_person_id, resource, via) values (current_person_id(), e.person_id, 'attendance_selfie', 'web');
  return p.selfie_path;
end $$;

-- Paparan harian HR: tambah sumber, luar lokasi & punch telefon
create or replace function hr_attendance_day(p_company uuid, p_date date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  hari date := coalesce(p_date, (now() at time zone 'Asia/Kuala_Lumpur')::date);
  tz text := (select timezone from companies where id = p_company);
begin
  if not has_role(p_company, '{hr,ceo,admin}') then raise exception 'Tidak dibenarkan'; end if;
  return jsonb_build_object(
    'date', hari,
    'working_day', is_working_day(p_company, hari),
    'rows', coalesce((
      select jsonb_agg(r order by r.name) from (
        select e.id as employment_id, coalesce(p.preferred_name, p.full_name) as name, d.name as department,
               e.work_start, ar.clock_in, ar.clock_out, coalesce(ar.late_minutes, 0) as late_minutes,
               ar.source, coalesce((ar.raw->>'in_outside')::boolean, false) as in_outside,
               coalesce((ar.raw->>'out_outside')::boolean, false) as out_outside,
               (select lt.code from leave_requests lr join leave_types lt on lt.id = lr.leave_type_id
                 where lr.employment_id = e.id and lr.status = 'approved'
                   and hari between lr.start_date and lr.end_date limit 1) as leave_code,
               (select fw.id is not null from flexible_work_requests fw
                 where fw.employment_id = e.id and fw.status = 'approved'
                   and hari >= fw.start_date and (fw.end_date is null or hari <= fw.end_date) limit 1) as flexible,
               (select jsonb_agg(jsonb_build_object('id', ap.id, 'punched_at', ap.punched_at, 'kind', ap.kind,
                                   'location_name', l.name, 'distance_m', ap.distance_m, 'outside', ap.outside,
                                   'lat', ap.lat, 'lng', ap.lng, 'has_selfie', ap.selfie_path is not null) order by ap.punched_at)
                  from attendance_punches ap left join company_locations l on l.id = ap.location_id
                 where ap.employment_id = e.id and ap.source = 'gps' and (ap.punched_at at time zone tz)::date = hari) as gps
          from employments e
          join persons p on p.id = e.person_id
          left join departments d on d.id = e.department_id
          left join attendance_records ar on ar.employment_id = e.id and ar.work_date = hari
         where e.company_id = p_company and e.status in ('probation','active') and e.join_date <= hari) r), '[]'::jsonb),
    'corrections', coalesce((
      select jsonb_agg(c order by c.work_date desc) from (
        select ac.id, ac.approval_request_id, ac.employment_id, coalesce(p.preferred_name, p.full_name) as name,
               ac.work_date, ac.requested_clock_in, ac.requested_clock_out, ac.reason, ac.status, ac.created_at
          from attendance_corrections ac
          join employments e on e.id = ac.employment_id
          join persons p on p.id = e.person_id
         where e.company_id = p_company and ac.status = 'pending'
         limit 100) c), '[]'::jsonb)
  );
end $$;

create or replace function company_attendance_connected(p_company uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_company_member(p_company) and (
    exists (select 1 from attendance_integrations i where i.company_id = p_company)
    or exists (select 1 from companies c where c.id = p_company and c.gps_attendance)
    or exists (select 1 from attendance_records a join employments e on e.id = a.employment_id
                where e.company_id = p_company and a.work_date >= (now() at time zone 'Asia/Kuala_Lumpur')::date - 30));
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function attendance_gps_punch(uuid, text, numeric, numeric, numeric, text, action_channel) from public, anon;
    revoke all on function my_attendance_today(uuid) from public, anon;
    revoke all on function set_gps_attendance(uuid, boolean) from public, anon;
    revoke all on function hr_location_save(uuid, jsonb, uuid) from public, anon;
    revoke all on function hr_location_delete(uuid) from public, anon;
    revoke all on function hr_gps_settings(uuid) from public, anon;
    revoke all on function hr_attendance_selfie(bigint) from public, anon;
    grant execute on function attendance_gps_punch(uuid, text, numeric, numeric, numeric, text, action_channel),
                              my_attendance_today(uuid), set_gps_attendance(uuid, boolean), hr_location_save(uuid, jsonb, uuid),
                              hr_location_delete(uuid), hr_gps_settings(uuid), hr_attendance_selfie(bigint)
      to authenticated, service_role;
  end if;
end $$;
