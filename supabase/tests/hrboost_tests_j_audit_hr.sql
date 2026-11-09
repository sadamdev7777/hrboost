\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian audit HR: data terkumpul (senarai & akses), pemberitahuan dibaca, konteks tugasan hanya milik sendiri.
insert into companies(id,code,name) values ('00000000-0000-0000-0000-0000000000c1','MTB','MTB'), ('00000000-0000-0000-0000-0000000000c2','DOIT','DO IT');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c1');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,9) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','HR','Lily','60110000002'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','AMIN','Amin','60110000004');
insert into employments(id,person_id,company_id,employee_no,status,join_date) values
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB001','active','2020-01-01'),
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','MTB002','active','2026-03-01');
insert into user_roles(person_id,company_id,role) values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr');
insert into notifications(company_id, person_id, message) values
 ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000002','Mesej 1'),
 ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000002','Mesej 2'),
 ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000004','Mesej Amin');

\echo '=== J1: data terkumpul — senarai & simpan ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
select set_payroll_opening('00000000-0000-0000-0000-0000000000e4', 2026, 10, 30000, 3300, 400);
select name, up_to_month, gross, epf, pcb from hr_opening_balances('00000000-0000-0000-0000-0000000000c1', 2026);

\echo '=== J2: pemberitahuan — tanda dibaca hanya milik sendiri ==='
select mark_my_notifications_read() as ditanda;
reset test.role; reset test.uid;
select message, read_at is not null as dibaca from notifications order by message;

\echo '=== J3: akses ditolak ==='
\set ON_ERROR_STOP 0
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a004';
select * from hr_opening_balances('00000000-0000-0000-0000-0000000000c1', 2026);
select * from hr_opening_balances('00000000-0000-0000-0000-0000000000c2', 2026);
\set ON_ERROR_STOP 1
select count(*) as konteks_tugasan_orang_lain from approval_task_context(array[gen_random_uuid()]);
