\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian daftar masuk / keluar melalui telefon (GPS + swafoto):
--  G1. HR urus tetapan & lokasi; pekerja tidak boleh
--  G2. GPS dimatikan → ditolak; swafoto wajib (folder sendiri); GPS lemah ditolak
--  G3. Dalam radius vs luar lokasi; masa pelayan; rekod harian & lewat dikira
--  G4. Mesin + telefon: masuk = terawal, keluar = terakhir (sumber 'campuran')
--  G5. Tidak boleh daftar untuk orang lain; masuk berganda / keluar sebelum masuk / < 1 minit ditolak
--  G6. Rekod pembetulan tidak ditimpa; paparan HR & log akses swafoto
-- Gunakan stub local_only (test.uid / test.role). Jangan jalankan pada Supabase sebenar.

-- ===== SETUP =====
insert into companies(id,code,name) values ('00000000-0000-0000-0000-0000000000c1','MTB','MUSLIMTRAVELBUG SDN BHD');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c1');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,9) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp,ic_no) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','HR Satu','Lily','60110000002','900202-14-0002'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','AMIN BIN ALI','Amin','60110000004','950505-14-0004'),
 ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-00000000a006','ZULFA','Zulfa','60110000006','960606-14-0006');
insert into employments(id,person_id,company_id,employee_no,status,join_date,attendance_workno) values
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB001','active','2020-01-01',null),
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','MTB003','active','2025-03-01','1004'),
 ('00000000-0000-0000-0000-0000000000e6','00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-0000000000c1','MTB004','active','2024-01-01',null);
insert into user_roles(person_id,company_id,role) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr');
select (now() at time zone 'Asia/Kuala_Lumpur')::date as hari \gset

\echo '=== G1: tetapan & lokasi ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a006';
\set ON_ERROR_STOP 0
select set_gps_attendance('00000000-0000-0000-0000-0000000000c1', true);
select hr_location_save('00000000-0000-0000-0000-0000000000c1', '{"name":"HQ","lat":2.994,"lng":101.7}');
\set ON_ERROR_STOP 1
select (my_attendance_today('00000000-0000-0000-0000-0000000000e6'))->>'enabled' as dihidupkan_sebelum;
set test.uid='00000000-0000-0000-0000-00000000a002';
\set ON_ERROR_STOP 0
select hr_location_save('00000000-0000-0000-0000-0000000000c1', '{"name":"Salah","lat":95,"lng":101.7}');
select hr_location_save('00000000-0000-0000-0000-0000000000c1', '{"name":"Kecil","lat":2.99,"lng":101.7,"radius_m":5}');
\set ON_ERROR_STOP 1
select hr_location_save('00000000-0000-0000-0000-0000000000c1', '{"name":"Pejabat HQ","lat":2.994,"lng":101.7,"radius_m":150}') as hq \gset
select hr_location_save('00000000-0000-0000-0000-0000000000c1', '{"name":"Gudang","lat":3.2,"lng":101.6}') as gudang \gset
select hr_location_delete(:'gudang');
select set_gps_attendance('00000000-0000-0000-0000-0000000000c1', true);
select hr_gps_settings('00000000-0000-0000-0000-0000000000c1') tetapan;
do $$ begin
  assert (select (hr_gps_settings('00000000-0000-0000-0000-0000000000c1')->>'enabled')::boolean), 'dihidupkan';
  assert jsonb_array_length(hr_gps_settings('00000000-0000-0000-0000-0000000000c1')->'locations') = 1, 'Gudang dinyahaktif';
  assert (select count(*) from platform_audit_log where action like 'attendance.%') = 4, 'log audit';
end $$;

\echo '=== G2: pengesahan ==='
set test.uid='00000000-0000-0000-0000-00000000a006';
\set ON_ERROR_STOP 0
-- tiada swafoto / swafoto orang lain
select attendance_gps_punch('00000000-0000-0000-0000-0000000000e6','in',2.9945,101.7001,15,null);
select attendance_gps_punch('00000000-0000-0000-0000-0000000000e6','in',2.9945,101.7001,15,'00000000-0000-0000-0000-000000000004/swafoto.jpg');
-- GPS lemah
select attendance_gps_punch('00000000-0000-0000-0000-0000000000e6','in',2.9945,101.7001,1500,'00000000-0000-0000-0000-000000000006/s.jpg');
-- keluar sebelum masuk
select attendance_gps_punch('00000000-0000-0000-0000-0000000000e6','out',2.9945,101.7001,15,'00000000-0000-0000-0000-000000000006/s.jpg');
-- daftar untuk orang lain
select attendance_gps_punch('00000000-0000-0000-0000-0000000000e4','in',2.9945,101.7001,15,'00000000-0000-0000-0000-000000000006/s.jpg');
\set ON_ERROR_STOP 1
do $$ begin assert not exists (select 1 from attendance_punches), 'tiada punch direkod'; end $$;

\echo '=== G3: dalam radius & luar lokasi ==='
select attendance_gps_punch('00000000-0000-0000-0000-0000000000e6','in',2.9945,101.7001,15,'00000000-0000-0000-0000-000000000006/s1.jpg') as masuk;
\set ON_ERROR_STOP 0
-- masuk berganda, dan keluar < 1 minit
select attendance_gps_punch('00000000-0000-0000-0000-0000000000e6','in',2.9945,101.7001,15,'00000000-0000-0000-0000-000000000006/s2.jpg');
select attendance_gps_punch('00000000-0000-0000-0000-0000000000e6','out',2.9945,101.7001,15,'00000000-0000-0000-0000-000000000006/s2.jpg');
\set ON_ERROR_STOP 1
-- (ujian sahaja) undurkan punch 3 minit supaya keluar boleh direkod
reset test.uid; reset test.role;
update attendance_punches set punched_at = punched_at - interval '3 minutes' where employment_id = '00000000-0000-0000-0000-0000000000e6';
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a006';
select attendance_gps_punch('00000000-0000-0000-0000-0000000000e6','out',3.139,101.6869,20,'00000000-0000-0000-0000-000000000006/s3.jpg') as keluar;
select my_attendance_today('00000000-0000-0000-0000-0000000000e6') hari_ini;
do $$
declare r attendance_records;
begin
  select * into r from attendance_records where employment_id = '00000000-0000-0000-0000-0000000000e6';
  assert (select outside from attendance_punches where employment_id = '00000000-0000-0000-0000-0000000000e6' and kind = 'in') = false, 'masuk dalam radius';
  assert (select distance_m from attendance_punches where employment_id = '00000000-0000-0000-0000-0000000000e6' and kind = 'in') between 40 and 80, 'jarak ~56 m';
  assert (select outside from attendance_punches where employment_id = '00000000-0000-0000-0000-0000000000e6' and kind = 'out'), 'keluar luar lokasi';
  assert (select distance_m from attendance_punches where employment_id = '00000000-0000-0000-0000-0000000000e6' and kind = 'out') > 15000, 'jarak ~16 km';
  assert r.source = 'gps' and r.clock_in is not null and r.clock_out > r.clock_in, 'rekod harian GPS';
  assert (r.raw->>'out_outside')::boolean and not (r.raw->>'in_outside')::boolean, 'tanda luar lokasi dalam rekod';
  assert r.late_minutes is not null, 'lewat dikira';
  assert jsonb_array_length(my_attendance_today('00000000-0000-0000-0000-0000000000e6')->'punches') = 2, 'punch hari ini';
end $$;

\echo '=== G4: mesin + telefon ==='
set test.role = 'service_role';
select ingest_punch('00000000-0000-0000-0000-0000000000c1','1004','u1', (:'hari'::date + time '00:01') at time zone 'Asia/Kuala_Lumpur');
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a004';
\set ON_ERROR_STOP 0
select attendance_gps_punch('00000000-0000-0000-0000-0000000000e4','in',3.139,101.6869,20,'00000000-0000-0000-0000-000000000004/s1.jpg');
\set ON_ERROR_STOP 1
select attendance_gps_punch('00000000-0000-0000-0000-0000000000e4','out',2.994,101.7,10,'00000000-0000-0000-0000-000000000004/s1.jpg') as keluar_amin;
do $$
declare r attendance_records;
begin
  select * into r from attendance_records where employment_id = '00000000-0000-0000-0000-0000000000e4';
  assert r.source = 'campuran', 'sumber campuran';
  assert (r.clock_in at time zone 'Asia/Kuala_Lumpur')::time = '00:01', 'masuk = punch mesin terawal';
  assert r.clock_out = (select max(punched_at) from attendance_punches where employment_id = '00000000-0000-0000-0000-0000000000e4'), 'keluar = punch telefon terakhir';
  assert r.raw->>'in_source' = 'crosschex' and r.raw->>'out_source' = 'gps', 'sumber masuk/keluar';
end $$;

\echo '=== G6: pembetulan & paparan HR ==='
reset test.uid; reset test.role;
update attendance_records set source = 'correction', clock_out = clock_in + interval '9 hours' where employment_id = '00000000-0000-0000-0000-0000000000e6';
update attendance_punches set punched_at = punched_at - interval '3 minutes' where employment_id = '00000000-0000-0000-0000-0000000000e6';
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a006';
select attendance_gps_punch('00000000-0000-0000-0000-0000000000e6','out',2.994,101.7,10,'00000000-0000-0000-0000-000000000006/s4.jpg') is not null as keluar_lagi;
do $$ begin
  assert (select source from attendance_records where employment_id = '00000000-0000-0000-0000-0000000000e6') = 'correction', 'rekod pembetulan tidak ditimpa';
end $$;
\set ON_ERROR_STOP 0
select hr_attendance_day('00000000-0000-0000-0000-0000000000c1');
select hr_attendance_selfie((select min(id) from attendance_punches where source = 'gps'));
\set ON_ERROR_STOP 1
set test.uid='00000000-0000-0000-0000-00000000a002';
select x->>'name' nama, x->>'source' sumber, x->>'out_outside' keluar_luar, jsonb_array_length(coalesce(nullif(x->'gps','null'::jsonb),'[]')) punch_gps
  from jsonb_array_elements(hr_attendance_day('00000000-0000-0000-0000-0000000000c1')->'rows') x order by 1;
select hr_attendance_selfie((select min(id) from attendance_punches where source = 'gps')) as laluan;
do $$ begin
  assert (select count(*) from data_access_log where resource = 'attendance_selfie') = 1, 'akses swafoto direkod';
  assert (select jsonb_array_length(x->'gps') from jsonb_array_elements(hr_attendance_day('00000000-0000-0000-0000-0000000000c1')->'rows') x where x->>'name' = 'Zulfa') = 3, 'HR nampak punch telefon';
  assert company_attendance_connected('00000000-0000-0000-0000-0000000000c1'), 'kehadiran disambung';
end $$;
-- GPS dimatikan → ditolak
select set_gps_attendance('00000000-0000-0000-0000-0000000000c1', false);
set test.uid='00000000-0000-0000-0000-00000000a006';
\set ON_ERROR_STOP 0
select attendance_gps_punch('00000000-0000-0000-0000-0000000000e6','out',2.994,101.7,10,'00000000-0000-0000-0000-000000000006/s5.jpg');
\set ON_ERROR_STOP 1

\echo '>>> SEMUA UJIAN KEHADIRAN GPS LULUS'
