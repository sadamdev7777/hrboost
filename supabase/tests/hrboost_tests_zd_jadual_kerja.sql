\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian jadual kerja mengikut hari: Isnin–Jumaat 08:00–16:30, Sabtu 08:00–12:30 (separuh hari), Ahad rehat.
-- Gunakan stub local_only (test.uid / test.role). Jangan jalankan pada Supabase sebenar.

insert into companies(id,code,name,state) values ('00000000-0000-0000-0000-0000000000c1','MTB','MUSLIMTRAVELBUG SDN BHD','Selangor');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c1');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,4) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp,ic_no) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','HR SATU','Lily','60110000002','900202-14-0002'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','AMIN BIN ALI','Amin','60110000004','950505-14-0004');
insert into employments(id,person_id,company_id,employee_no,status,join_date) values
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB001','active','2020-01-01'),
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','MTB003','active','2025-03-01');
insert into user_roles(person_id,company_id,role) values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr');

\echo '=== J1: simpan jadual ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
select set_company_schedule('00000000-0000-0000-0000-0000000000c1', '{
  "1":{"start":"08:00","end":"16:30"},"2":{"start":"08:00","end":"16:30"},"3":{"start":"08:00","end":"16:30"},
  "4":{"start":"08:00","end":"16:30"},"5":{"start":"08:00","end":"16:30"},"6":{"start":"08:00","end":"12:30","half":true}}');
\set ON_ERROR_STOP 0
select set_company_schedule('00000000-0000-0000-0000-0000000000c1', '{"1":{"start":"17:00","end":"08:00"}}');
select set_company_schedule('00000000-0000-0000-0000-0000000000c1', '{}');
\set ON_ERROR_STOP 1
set test.uid='00000000-0000-0000-0000-00000000a004';
\set ON_ERROR_STOP 0
select set_company_schedule('00000000-0000-0000-0000-0000000000c1', '{"1":{"start":"08:00","end":"16:30"}}');
\set ON_ERROR_STOP 1
reset test.uid; reset test.role;
select weekend_days, work_start, work_end from companies where id = '00000000-0000-0000-0000-0000000000c1';
do $$ begin
  assert (select weekend_days from companies where id = '00000000-0000-0000-0000-0000000000c1') = '{0}', 'Ahad sahaja hari rehat';
  assert (select work_start from companies where id = '00000000-0000-0000-0000-0000000000c1') = '08:00', 'masuk 8:00';
  assert (select work_end from companies where id = '00000000-0000-0000-0000-0000000000c1') = '16:30', 'keluar 4:30';
end $$;

\echo '=== J2: hari cuti — Isnin 4 Jan 2027 hingga Ahad 10 Jan 2027 = 5 + 0.5 = 5.5 ==='
-- tiada cuti umum dalam minggu itu dalam ujian ini
delete from public_holidays where holiday_date between '2027-01-04' and '2027-01-10';
do $$ begin
  assert leave_count_days('00000000-0000-0000-0000-0000000000e4', '2027-01-04', '2027-01-10', 'full') = 5.5, 'minggu = 5.5 hari';
  assert leave_count_days('00000000-0000-0000-0000-0000000000e4', '2027-01-09', '2027-01-09', 'full') = 0.5, 'Sabtu = 0.5';
  assert leave_count_days('00000000-0000-0000-0000-0000000000e4', '2027-01-10', '2027-01-10', 'full') = 0, 'Ahad = 0';
  assert leave_count_days('00000000-0000-0000-0000-0000000000e4', '2027-01-09', '2027-01-09', 'am') = 0.5, 'separuh hari pada Sabtu = 0.5';
  assert is_working_day('00000000-0000-0000-0000-0000000000c1', '2027-01-09'), 'Sabtu hari bekerja';
end $$;

\echo '=== J3: lewat masuk ikut waktu hari itu ==='
insert into attendance_records(employment_id, work_date, clock_in) values
 ('00000000-0000-0000-0000-0000000000e4', '2027-01-08', '2027-01-08 08:20+08'),
 ('00000000-0000-0000-0000-0000000000e4', '2027-01-09', '2027-01-09 08:05+08');
select work_date, late_minutes from attendance_records where employment_id = '00000000-0000-0000-0000-0000000000e4' order by 1;
do $$ begin
  assert (select late_minutes from attendance_records where work_date = '2027-01-08' and employment_id = '00000000-0000-0000-0000-0000000000e4') = 20, 'Jumaat lewat 20 minit';
  assert (select late_minutes from attendance_records where work_date = '2027-01-09' and employment_id = '00000000-0000-0000-0000-0000000000e4') = 5, 'Sabtu lewat 5 minit';
end $$;

\echo '=== J4: SLA Sabtu — permohonan jam 1:00 petang (selepas 12:30) → Isnin 4:30 petang ==='
do $$ declare w approval_workflows; begin
  select * into w from approval_workflows where company_id = '00000000-0000-0000-0000-0000000000c1' and request_type = 'leave';
  w.sla := 'same_day';
  assert approval_sla_due('00000000-0000-0000-0000-0000000000c1', w, '2027-01-09 13:00+08', false) = '2027-01-11 16:30+08', 'SLA ke Isnin 4:30';
  assert approval_sla_due('00000000-0000-0000-0000-0000000000c1', w, '2027-01-09 09:00+08', false) = '2027-01-09 12:30+08', 'SLA Sabtu 12:30';
end $$;

\echo '=== J5: langkah persediaan (kemas kini terus weekend_days) kembali ke mod lama ==='
update companies set weekend_days = '{0,6}' where id = '00000000-0000-0000-0000-0000000000c1';
do $$ begin
  assert (select work_schedule from companies where id = '00000000-0000-0000-0000-0000000000c1') is null, 'jadual dikosongkan';
  assert leave_count_days('00000000-0000-0000-0000-0000000000e4', '2027-01-04', '2027-01-10', 'full') = 5, 'mod lama: 5 hari';
end $$;
