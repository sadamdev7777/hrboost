\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian peringatan daftar masuk / keluar (5 minit sebelum waktu kerja bermula & tamat):
--  R1. Dimatikan secara lalai: tiada peringatan
--  R2. Daftar masuk: hanya pekerja yang belum daftar masuk & tidak bercuti; sekali sahaja
--  R3. Daftar keluar: hanya pekerja yang sudah daftar masuk & belum daftar keluar
--  R4. Teks ikut mesin kehadiran; terjemahan English; my_attendance_today.machine
-- Gunakan stub local_only (test.uid / test.role). Jangan jalankan pada Supabase sebenar.
-- Nota: waktu kerja ditetapkan relatif kepada masa sekarang (tidak sah antara 23:50–00:10 MYT).

insert into companies(id,code,name,weekend_days) values ('00000000-0000-0000-0000-0000000000c1','MTB','MUSLIMTRAVELBUG SDN BHD','{}');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c1');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,9) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp,language) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','HR Satu','Lily','60110000002','ms'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','AMIN BIN ALI','Amin','60110000004','ms'),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-00000000a005','BADRUL','Badrul','60110000005','en'),
 ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-00000000a006','ZULFA','Zulfa','60110000006','ms');
insert into employments(id,person_id,company_id,employee_no,status,join_date) values
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB001','active','2020-01-01'),
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','MTB003','active','2025-03-01'),
 ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000c1','MTB005','active','2025-03-01'),
 ('00000000-0000-0000-0000-0000000000e6','00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-0000000000c1','MTB004','active','2024-01-01');
insert into user_roles(person_id,company_id,role) values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr');
select (now() at time zone 'Asia/Kuala_Lumpur')::date as hari \gset
-- Waktu masuk 3 minit dari sekarang; Zulfa bercuti penuh hari ini
update companies set work_start = ((now() at time zone 'Asia/Kuala_Lumpur') + interval '3 minutes')::time,
                     work_end = ((now() at time zone 'Asia/Kuala_Lumpur') + interval '9 hours')::time
 where id = '00000000-0000-0000-0000-0000000000c1';
insert into leave_requests(employment_id, leave_type_id, start_date, end_date, days, status) values
 ('00000000-0000-0000-0000-0000000000e6',(select id from leave_types where company_id='00000000-0000-0000-0000-0000000000c1' and code='AL'),:'hari',:'hari',1,'approved');
-- Badrul sudah daftar masuk
insert into attendance_records(employment_id, work_date, clock_in, source) values ('00000000-0000-0000-0000-0000000000e5', :'hari', now() - interval '5 minutes', 'crosschex');

\echo '=== R1: dimatikan secara lalai ==='
set test.role = 'service_role';
select attendance_reminder_tick() as dihantar;
do $$ begin assert (select count(*) from notifications where message like 'Peringatan: waktu kerja%') = 0, 'tiada peringatan'; end $$;

\echo '=== R2: peringatan daftar masuk ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a004';
\set ON_ERROR_STOP 0
select set_attendance_reminders('00000000-0000-0000-0000-0000000000c1', true);
\set ON_ERROR_STOP 1
set test.uid='00000000-0000-0000-0000-00000000a002';
select set_attendance_reminders('00000000-0000-0000-0000-0000000000c1', true);
set test.role = 'service_role';
select attendance_reminder_tick() as dihantar;
select attendance_reminder_tick() as kali_kedua;
select p.preferred_name, n.message from notifications n join persons p on p.id = n.person_id where n.message like 'Peringatan: waktu kerja%' order by 1;
do $$ begin
  assert (select count(*) from notifications where message like 'Peringatan: waktu kerja bermula pada %. Sila daftar masuk melalui HRBoost.') = 2, 'Lily & Amin (tiada mesin)';
  assert not exists (select 1 from notifications where person_id = '00000000-0000-0000-0000-000000000006' and message like '%waktu kerja%'), 'Zulfa bercuti: tiada';
  assert not exists (select 1 from notifications where person_id = '00000000-0000-0000-0000-000000000005' and message like '%waktu kerja%' or message like '%work starts%'), 'Badrul sudah daftar masuk: tiada';
  assert (select count(*) from attendance_reminders_sent where kind = 'in') = 2, 'sekali sahaja';
end $$;

\echo '=== R3: peringatan daftar keluar ==='
reset test.role;
update companies set work_end = ((now() at time zone 'Asia/Kuala_Lumpur') + interval '2 minutes')::time where id = '00000000-0000-0000-0000-0000000000c1';
set test.role = 'service_role';
select attendance_reminder_tick() as dihantar;
select attendance_reminder_tick() as kali_kedua;
select p.preferred_name, n.message from notifications n join persons p on p.id = n.person_id where n.message like '%work ends%' or n.message like '%waktu kerja tamat%';
do $$ begin
  assert (select count(*) from notifications where message like '%work ends at%' or message like '%waktu kerja tamat%') = 1, 'hanya Badrul (sudah masuk, belum keluar)';
  assert (select message from notifications where person_id = '00000000-0000-0000-0000-000000000005') like 'Reminder: work ends at %. Do not forget to check out before you leave.', 'terjemahan English untuk Badrul';
end $$;

\echo '=== R4: syarikat dengan mesin kehadiran ==='
reset test.role;
insert into attendance_integrations(company_id, provider) values ('00000000-0000-0000-0000-0000000000c1', 'crosschex');
delete from attendance_reminders_sent;
update companies set work_start = ((now() at time zone 'Asia/Kuala_Lumpur') + interval '3 minutes')::time where id = '00000000-0000-0000-0000-0000000000c1';
set test.role = 'service_role';
select attendance_reminder_tick() as dihantar;
do $$ begin
  assert (select count(*) from notifications where message like '%Sila daftar masuk di mesin kehadiran, atau melalui HRBoost jika anda bekerja di luar pejabat.') = 2, 'teks dengan mesin';
end $$;
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a004';
select my_attendance_today('00000000-0000-0000-0000-0000000000e4')->>'machine' as mesin;
do $$ begin assert (my_attendance_today('00000000-0000-0000-0000-0000000000e4')->>'machine')::boolean, 'machine = true'; end $$;
\set ON_ERROR_STOP 0
select attendance_reminder_tick();
\set ON_ERROR_STOP 1

\echo '>>> SEMUA UJIAN PERINGATAN KEHADIRAN LULUS'
