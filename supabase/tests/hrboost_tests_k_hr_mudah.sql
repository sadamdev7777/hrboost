\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian HR mudah: kalendar berkanun, laporan, bendera semakan gaji, tarikh tamat.
insert into companies(id,code,name) values ('00000000-0000-0000-0000-0000000000c1','MTB','MTB'), ('00000000-0000-0000-0000-0000000000c2','DOIT','DO IT');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c1');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,9) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp,bank_account_no) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','HR','Lily','60110000002','111'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','AMIN','Amin','60110000004',null),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-00000000a005','FARAH','Farah','60110000005','555');
insert into employments(id,person_id,company_id,employee_no,status,join_date) values
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB001','active','2020-01-01'),
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','MTB002','active','2026-03-01'),
 ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000c1','MTB003','active','2026-10-06');
insert into user_roles(person_id,company_id,role) values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr');

-- Gaji September (dibayar) & Oktober (dikira)
insert into payroll_runs(id,company_id,period_year,period_month,status,totals) values
 ('00000000-0000-0000-0000-0000000000f9','00000000-0000-0000-0000-0000000000c1',2026,9,'paid','{"headcount":2,"gross":7000,"net":6000,"employer":900,"pcb":100}'),
 ('00000000-0000-0000-0000-0000000000fa','00000000-0000-0000-0000-0000000000c1',2026,10,'calculated','{"headcount":3,"gross":9000,"net":7800,"employer":1100,"pcb":0}');
insert into payslips(payroll_run_id,employment_id,gross,total_deduction,net,pcb,unpaid_leave_days) values
 ('00000000-0000-0000-0000-0000000000f9','00000000-0000-0000-0000-0000000000e2',5000,700,4300,100,0),
 ('00000000-0000-0000-0000-0000000000f9','00000000-0000-0000-0000-0000000000e4',2000,300,1700,0,0),
 ('00000000-0000-0000-0000-0000000000fa','00000000-0000-0000-0000-0000000000e2',5000,700,4300,0,0),
 ('00000000-0000-0000-0000-0000000000fa','00000000-0000-0000-0000-0000000000e4',2500,300,2200,0,2),
 ('00000000-0000-0000-0000-0000000000fa','00000000-0000-0000-0000-0000000000e5',1500,1600,-100,0,0);

\echo '=== K1: tarikh akhir berkanun (hari ini 10/11/2026) ==='
select kind, period_year, period_month, due_date, days_left, payroll_ready from statutory_due_items('00000000-0000-0000-0000-0000000000c1', '2026-11-10') order by due_date, kind;
\echo '--- selepas KWSP Oktober ditanda dihantar'
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
select mark_statutory_submitted('00000000-0000-0000-0000-0000000000c1','epf',2026,10,'KWSP-123');
reset test.role; reset test.uid;
select kind, period_month from statutory_due_items('00000000-0000-0000-0000-0000000000c1', '2026-11-10') order by kind;
\echo '--- Borang EA (Februari tahun depan; tahun 2026 ada gaji dibayar)'
select kind, period_year, due_date, days_left from statutory_due_items('00000000-0000-0000-0000-0000000000c1', '2027-02-01') where period_month = 0 order by kind;

\echo '=== K2: laporan ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
select hr_report('00000000-0000-0000-0000-0000000000c1','pekerja','2026-01-01','2026-12-31');
select jsonb_array_length(hr_report('00000000-0000-0000-0000-0000000000c1','kos_gaji','2026-01-01','2026-12-31')) as bulan_kos_gaji;
select hr_report('00000000-0000-0000-0000-0000000000c1','tuntutan','2026-01-01','2026-12-31') as tuntutan,
       hr_report('00000000-0000-0000-0000-0000000000c1','cuti_diambil','2026-01-01','2026-12-31') as cuti;

\echo '=== K3: bendera semakan gaji Oktober ==='
select name, level, message from payroll_flags('00000000-0000-0000-0000-0000000000fa');

\echo '=== K4: tarikh tamat ==='
select hr_set_expiry('00000000-0000-0000-0000-0000000000e4', current_date + 20, current_date + 200, current_date + 10);
select kind, name, days_left from hr_expiring('00000000-0000-0000-0000-0000000000c1', 60) order by kind;

\echo '=== K5: akses ditolak ==='
\set ON_ERROR_STOP 0
set test.uid='00000000-0000-0000-0000-00000000a004';
select hr_report('00000000-0000-0000-0000-0000000000c1','pekerja','2026-01-01','2026-12-31');
select mark_statutory_submitted('00000000-0000-0000-0000-0000000000c1','pcb',2026,10,null);
select * from payroll_flags('00000000-0000-0000-0000-0000000000fa');
select hr_set_expiry('00000000-0000-0000-0000-0000000000e4', null, null, null);
\set ON_ERROR_STOP 1
select count(*) as tamat_tempoh_bukan_hr from hr_expiring('00000000-0000-0000-0000-0000000000c1', 60);
