\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian modul HR (menu baharu): ringkasan Leave, Attendance, Expense claims, Onboarding; kawalan peranan.
insert into companies(id,code,name) values ('00000000-0000-0000-0000-0000000000c1','MTB','MTB');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c1');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,9) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','LILY','Lily','60110000002'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000a003','ZUERIN','Zuerin','60110000003'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','AMIN','Amin','60110000004'),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-00000000a005','HANA','Hana','60110000005'),
 ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-00000000a006','FARAH','Farah','60110000006');
insert into departments(id,company_id,name,head_person_id) values ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','Operasi','00000000-0000-0000-0000-000000000003');
insert into employments(id,person_id,company_id,employee_no,status,join_date,probation_end_date,department_id) values
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB001','active','2020-01-01',null,null),
 ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1','MTB002','active','2020-01-01',null,'00000000-0000-0000-0000-0000000000d1'),
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','MTB003','active','2024-01-01',null,'00000000-0000-0000-0000-0000000000d1'),
 ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000c1','MTB004','probation','2026-06-01',current_date + 14,'00000000-0000-0000-0000-0000000000d1'),
 ('00000000-0000-0000-0000-0000000000e6','00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-0000000000c1','MTB005','active','2024-01-01',null,'00000000-0000-0000-0000-0000000000d1');
insert into user_roles(person_id,company_id,role) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr'),
 ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-0000000000c1','finance');
insert into employment_compensation(employment_id, component_id, amount, effective_from)
select '00000000-0000-0000-0000-0000000000e4', id, 3000, '2024-01-01' from pay_components where company_id='00000000-0000-0000-0000-0000000000c1' and code='BASIC';


-- data: cuti diluluskan hari ini (Amin), cuti menunggu (Farah), kehadiran Zuerin lewat, tuntutan Amin
insert into leave_requests(employment_id, leave_type_id, start_date, end_date, days, status)
select '00000000-0000-0000-0000-0000000000e4', id, current_date, current_date + 1, 2, 'approved' from leave_types where company_id='00000000-0000-0000-0000-0000000000c1' and code='AL';
insert into leave_requests(employment_id, leave_type_id, start_date, end_date, days, status)
select '00000000-0000-0000-0000-0000000000e6', id, current_date + 7, current_date + 7, 1, 'pending' from leave_types where company_id='00000000-0000-0000-0000-0000000000c1' and code='AL';
insert into attendance_records(employment_id, work_date, clock_in, late_minutes, source)
values ('00000000-0000-0000-0000-0000000000e3', current_date, now(), 12, 'manual');
insert into claims(id, employment_id, title, total_amount, status) values
 ('00000000-0000-0000-0000-0000000c1a01','00000000-0000-0000-0000-0000000000e4','Perjalanan ke Melaka',125.50,'pending'),
 ('00000000-0000-0000-0000-0000000c1a02','00000000-0000-0000-0000-0000000000e4','Draf',10,'draft');
insert into claim_items(claim_id, claim_type_id, expense_date, description, amount)
select '00000000-0000-0000-0000-0000000c1a01', id, current_date - 2, 'Tol', 125.50 from claim_types where company_id='00000000-0000-0000-0000-0000000000c1' order by name limit 1;

\echo '=== Q1: Leave (HR) ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
select r->>'name' as nama, r->>'leave_code' as jenis, r->>'status' as status, r->>'days' as hari
  from jsonb_array_elements(hr_leave_overview('00000000-0000-0000-0000-0000000000c1')->'requests') r order by 1;
select jsonb_array_length(hr_leave_overview('00000000-0000-0000-0000-0000000000c1')->'balances') > 0 as ada_baki;

\echo '=== Q2: Attendance (HR) ==='
select r->>'name' as nama, r->>'late_minutes' as lewat, r->>'leave_code' as cuti, (r->>'clock_in') is not null as masuk
  from jsonb_array_elements(hr_attendance_day('00000000-0000-0000-0000-0000000000c1')->'rows') r order by 1;

\echo '=== Q3: Expense claims (HR & Kewangan; draf tidak dipapar) ==='
select c->>'name' as nama, c->>'title' as tajuk, c->>'total_amount' as jumlah, c->>'status' as status
  from jsonb_array_elements(hr_claims('00000000-0000-0000-0000-0000000000c1', current_date - 30, current_date)) c;
set test.uid='00000000-0000-0000-0000-00000000a006';
select jsonb_array_length(hr_claims('00000000-0000-0000-0000-0000000000c1', current_date - 30, current_date)) as kewangan_nampak;

\echo '=== Q4: Onboarding (pekerja baharu / percubaan) ==='
set test.uid='00000000-0000-0000-0000-00000000a002';
select o->>'name' as nama, o->>'status' as status, o->>'steps_done' as langkah
  from jsonb_array_elements(hr_onboarding('00000000-0000-0000-0000-0000000000c1')) o;

\echo '=== Q5: kawalan peranan (mesti gagal) ==='
\set ON_ERROR_STOP 0
set test.uid='00000000-0000-0000-0000-00000000a006';
select hr_leave_overview('00000000-0000-0000-0000-0000000000c1');
set test.uid='00000000-0000-0000-0000-00000000a004';
select hr_claims('00000000-0000-0000-0000-0000000000c1', current_date - 30, current_date);
select hr_attendance_day('00000000-0000-0000-0000-0000000000c1');
select hr_onboarding('00000000-0000-0000-0000-0000000000c1');
\set ON_ERROR_STOP 1
reset test.role; reset test.uid;
do $$ begin
  set local test.role = 'authenticated'; set local test.uid = '00000000-0000-0000-0000-00000000a004';
  begin perform hr_claims('00000000-0000-0000-0000-0000000000c1', current_date - 30, current_date); raise exception 'GAGAL: pekerja biasa boleh melihat tuntutan';
  exception when others then if sqlerrm like 'GAGAL%' then raise; end if; end;
end $$;
\echo '>>> LULUS: hrboost_tests_q_modul_hr'
