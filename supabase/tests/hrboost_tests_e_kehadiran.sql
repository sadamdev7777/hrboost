\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian Fasa E: kalendar kehadiran, semakan pembetulan masa, rekod dibetulkan tidak ditulis ganti
-- oleh imbasan, fungsi CrossChex hanya untuk service role.
-- Gunakan stub local_only (test.uid / test.role). Jangan jalankan pada Supabase sebenar tanpa
-- penukaran (lihat supabase/scripts/tests_to_supabase.py).

-- ===== SETUP =====
insert into companies(id,code,name) values ('00000000-0000-0000-0000-0000000000c1','MTB','MUSLIMTRAVELBUG SDN BHD');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c1');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,9) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp,ic_no) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','HR Satu','Lily','60110000002','900202-14-0002'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000a003','Zuerin','Zuerin','60110000003','880303-14-0003'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','AMIN BIN ALI','Amin','60110000004','950505-14-0004'),
 ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-00000000a006','ZULFA','Zulfa','60110000006','960606-14-0006');
insert into departments(id,company_id,name,head_person_id) values
 ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','Tour','00000000-0000-0000-0000-000000000003');
insert into employments(id,person_id,company_id,employee_no,department_id,status,join_date,attendance_workno) values
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB001',null,'active','2020-01-01',null),
 ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1','MTB002','00000000-0000-0000-0000-0000000000d1','active','2019-01-01',null),
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','MTB003','00000000-0000-0000-0000-0000000000d1','active','2025-03-01','1004'),
 ('00000000-0000-0000-0000-0000000000e6','00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-0000000000c1','MTB004','00000000-0000-0000-0000-0000000000d1','active','2024-01-01',null);
insert into user_roles(person_id,company_id,role) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr');
-- hari bekerja terakhir sebelum hari ini
select max(d)::date as hb from generate_series((now() at time zone 'Asia/Kuala_Lumpur')::date - 7,
       (now() at time zone 'Asia/Kuala_Lumpur')::date - 1, interval '1 day') d
 where extract(isodow from d) <= 5 \gset
-- Amin imbas masuk lewat 9:25 pg (melalui CrossChex)
set test.role = 'service_role';
select ingest_punch('00000000-0000-0000-0000-0000000000c1','1004','u1', (:'hb'::date + time '09:25') at time zone 'Asia/Kuala_Lumpur');

\echo '=== K1: kalendar kehadiran ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a004';
select work_date = :'hb' as hari_itu, working_day, late_minutes, clock_out is null as tiada_keluar
  from attendance_month('00000000-0000-0000-0000-0000000000e4', :'hb', :'hb');
\set ON_ERROR_STOP 0
-- Zulfa (rakan, bukan ketua) tidak boleh melihat kehadiran Amin
set test.uid='00000000-0000-0000-0000-00000000a006';
select * from attendance_month('00000000-0000-0000-0000-0000000000e4', :'hb', :'hb');
\set ON_ERROR_STOP 1

\echo '=== K2: semakan permohonan pembetulan ==='
set test.uid='00000000-0000-0000-0000-00000000a004';
\set ON_ERROR_STOP 0
select submit_attendance_correction('00000000-0000-0000-0000-0000000000e4', (now() at time zone 'Asia/Kuala_Lumpur')::date + 1,
  now(), null, 'Masa hadapan');
select submit_attendance_correction('00000000-0000-0000-0000-0000000000e4', :'hb',
  (:'hb'::date + time '18:00') at time zone 'Asia/Kuala_Lumpur', (:'hb'::date + time '09:00') at time zone 'Asia/Kuala_Lumpur', 'Terbalik');
select submit_attendance_correction('00000000-0000-0000-0000-0000000000e4', :'hb', null, null, 'Kosong');
select submit_attendance_correction('00000000-0000-0000-0000-0000000000e4', :'hb',
  (:'hb'::date + time '08:55') at time zone 'Asia/Kuala_Lumpur', null, '  ');
\set ON_ERROR_STOP 1
select (submit_attendance_correction('00000000-0000-0000-0000-0000000000e4', :'hb',
  (:'hb'::date + time '08:55') at time zone 'Asia/Kuala_Lumpur', (:'hb'::date + time '18:05') at time zone 'Asia/Kuala_Lumpur',
  'Bertugas di luar pejabat')).approval_request_id as rid \gset
\set ON_ERROR_STOP 0
select submit_attendance_correction('00000000-0000-0000-0000-0000000000e4', :'hb',
  (:'hb'::date + time '08:50') at time zone 'Asia/Kuala_Lumpur', null, 'Pendua');
\set ON_ERROR_STOP 1

\echo '=== K3: ketua jabatan lulus → rekod dibetulkan, imbasan seterusnya tidak menulis ganti ==='
set test.uid='00000000-0000-0000-0000-00000000a003';
select approval_act((select id from approval_tasks where request_id = :'rid' and status = 'pending'), 'approve', null);
select to_char(clock_in at time zone 'Asia/Kuala_Lumpur', 'HH24:MI') masuk, to_char(clock_out at time zone 'Asia/Kuala_Lumpur', 'HH24:MI') keluar,
       late_minutes, source from attendance_records where employment_id = '00000000-0000-0000-0000-0000000000e4' and work_date = :'hb';
set test.role = 'service_role';
select ingest_punch('00000000-0000-0000-0000-0000000000c1','1004','u2', (:'hb'::date + time '19:30') at time zone 'Asia/Kuala_Lumpur');
select to_char(clock_out at time zone 'Asia/Kuala_Lumpur', 'HH24:MI') keluar_kekal, source
  from attendance_records where employment_id = '00000000-0000-0000-0000-0000000000e4' and work_date = :'hb';
do $$ begin
  assert (select source from attendance_records where employment_id = '00000000-0000-0000-0000-0000000000e4'
           order by work_date desc limit 1) = 'correction';
end $$;

\echo '=== K4: fungsi CrossChex hanya untuk service role ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
\set ON_ERROR_STOP 0
select * from crosschex_targets(null, true);
select crosschex_mark('00000000-0000-0000-0000-0000000000c1', true, 'palsu');
-- URL bukan CrossChex ditolak
select set_attendance_integration('00000000-0000-0000-0000-0000000000c1', 'https://penyerang.example.com', 'k', 's');
-- pekerja biasa tidak boleh
set test.uid='00000000-0000-0000-0000-00000000a004';
select request_attendance_sync('00000000-0000-0000-0000-0000000000c1');
\set ON_ERROR_STOP 1
set test.uid='00000000-0000-0000-0000-00000000a002';
select s->>'configured' disambung, s->>'matched' dipadankan, s->>'employees' pekerja
  from attendance_integration_status('00000000-0000-0000-0000-0000000000c1') s;
