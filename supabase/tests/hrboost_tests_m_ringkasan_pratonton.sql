\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian ringkasan harian HR & pratonton slip oleh pekerja.
insert into companies(id,code,name) values ('00000000-0000-0000-0000-0000000000c1','MTB','MTB');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c1');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,9) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','HR','Lily','60110000002'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','AMIN','Amin','60110000004'),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-00000000a005','HANA','Hana','60110000005');
insert into employments(id,person_id,company_id,employee_no,status,join_date) values
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB001','active','2020-01-01'),
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','MTB002','active','2025-03-01');
insert into user_roles(person_id,company_id,role) values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr');
insert into employments(id,person_id,company_id,employee_no,status,join_date) values
 ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000c1','MTB003','probation',(now() at time zone 'Asia/Kuala_Lumpur')::date + 1);
insert into attendance_records(employment_id, work_date, clock_in, late_minutes)
values ('00000000-0000-0000-0000-0000000000e4', (now() at time zone 'Asia/Kuala_Lumpur')::date, now(), 25);

\echo '=== M1: teks ringkasan harian ==='
select hr_daily_digest_text('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000002');
select hr_daily_digest() >= 0 as dijalankan;

\echo '=== M2: pratonton slip — pekerja nampak slip draf ==='
insert into payroll_runs(id,company_id,period_year,period_month,status) values ('00000000-0000-0000-0000-0000000000fa','00000000-0000-0000-0000-0000000000c1',2026,10,'calculated');
insert into payslips(id,payroll_run_id,employment_id,gross,total_deduction,net) values
 ('00000000-0000-0000-0000-00000000005a','00000000-0000-0000-0000-0000000000fa','00000000-0000-0000-0000-0000000000e4',2500,300,2200),
 ('00000000-0000-0000-0000-00000000005b','00000000-0000-0000-0000-0000000000fa','00000000-0000-0000-0000-0000000000e2',5000,700,4300);
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a004';
select period_month, status, net, draft, issue_open from my_payslips('00000000-0000-0000-0000-0000000000e4');
select payslip_is_mine('00000000-0000-0000-0000-00000000005a') as slip_sendiri, payslip_is_mine('00000000-0000-0000-0000-00000000005b') as slip_orang_lain;
select report_payslip_issue('00000000-0000-0000-0000-00000000005a', 'Elaun perjalanan RM200 tiada') is not null as dilapor;
select draft, issue_open from my_payslips('00000000-0000-0000-0000-0000000000e4');
\set ON_ERROR_STOP 0
select report_payslip_issue('00000000-0000-0000-0000-00000000005b', 'Bukan slip saya');
select * from payroll_issues('00000000-0000-0000-0000-0000000000fa');
\set ON_ERROR_STOP 1

\echo '=== M3: HR menyemak & menyelesaikan ==='
set test.uid='00000000-0000-0000-0000-00000000a002';
select name, message, resolved_at is null as terbuka from payroll_issues('00000000-0000-0000-0000-0000000000fa');
select resolve_payslip_issue((select id from payroll_issues('00000000-0000-0000-0000-0000000000fa') limit 1), 'Elaun ditambah, gaji dikira semula');
select set_payslip_preview('00000000-0000-0000-0000-0000000000c1', false);
reset test.role; reset test.uid;
select message from notifications where person_id = '00000000-0000-0000-0000-000000000004' order by created_at desc limit 1;

\echo '=== M4: pratonton dimatikan — slip draf tidak lagi kelihatan ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a004';
select count(*) as slip_draf from my_payslips('00000000-0000-0000-0000-0000000000e4');
