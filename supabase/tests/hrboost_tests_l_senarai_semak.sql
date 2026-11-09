\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian senarai semak pekerja baharu & import pukal gaji / baki cuti.
insert into companies(id,code,name) values ('00000000-0000-0000-0000-0000000000c1','MTB','MTB');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c1');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,9) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','HR','Lily','60110000002'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000a003','KETUA','Zuerin','60110000003'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','AMIN','Amin','60110000004'),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-00000000a005','LAMA','Lama','60110000005');
insert into departments(id,company_id,name,head_person_id) values ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','Operasi','00000000-0000-0000-0000-000000000003');
insert into employments(id,person_id,company_id,employee_no,status,join_date,department_id) values
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB001','active','2020-01-01',null),
 ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1','MTB002','active','2020-01-01','00000000-0000-0000-0000-0000000000d1'),
 ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000c1','MTB005','active','2021-01-01','00000000-0000-0000-0000-0000000000d1');
insert into user_roles(person_id,company_id,role) values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr');
insert into employments(id,person_id,company_id,employee_no,status,join_date,probation_end_date,department_id) values
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','MTB004','probation',current_date + 3,current_date + 93,'00000000-0000-0000-0000-0000000000d1');

\echo '=== L1: templat disalin hanya untuk pekerja baharu ==='
select employment_id = '00000000-0000-0000-0000-0000000000e4' as amin, count(*), count(*) filter (where owner='hr') hr, count(*) filter (where owner='ketua') ketua
  from onboarding_checklist_items group by 1;

\echo '=== L2: ketua jabatan nampak & tanda perkara "ketua" sahaja ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a003';
select owner, title, due_date - current_date as hari from my_onboarding_tasks('00000000-0000-0000-0000-0000000000c1') limit 3;
select onboarding_toggle((select id from onboarding_checklist_items where owner='ketua' order by sort limit 1), true);
\set ON_ERROR_STOP 0
select onboarding_toggle((select id from onboarding_checklist_items where owner='hr' order by sort limit 1), true);
select onboarding_add_item('00000000-0000-0000-0000-0000000000e4','hr','Cuba','2026-12-01');
\set ON_ERROR_STOP 1
select count(*) filter (where can_act) boleh, count(*) filter (where done_at is not null) selesai from onboarding_checklist('00000000-0000-0000-0000-0000000000e4');

\echo '=== L3: HR — tambah perkara khas & lihat tugasan sendiri ==='
set test.uid='00000000-0000-0000-0000-00000000a002';
select onboarding_add_item('00000000-0000-0000-0000-0000000000e4','hr','Tempah kad akses bangunan',current_date + 2) is not null as ditambah;
select count(*) as tugasan_hr from my_onboarding_tasks('00000000-0000-0000-0000-0000000000c1') where owner = 'hr';

\echo '=== L4: pekerja lain tidak boleh melihat senarai semak ==='
\set ON_ERROR_STOP 0
set test.uid='00000000-0000-0000-0000-00000000a005';
select * from onboarding_checklist('00000000-0000-0000-0000-0000000000e4');
\set ON_ERROR_STOP 1
select count(*) as tugasan_pekerja_lain from my_onboarding_tasks('00000000-0000-0000-0000-0000000000c1');

\echo '=== L5: import gaji pokok ==='
set test.uid='00000000-0000-0000-0000-00000000a002';
select * from hr_import_basic_pay('00000000-0000-0000-0000-0000000000c1',
  '[{"employee_no":"mtb001","basic":4200,"effective_from":"2026-01-01"},{"employee_no":"MTB999","basic":3000},{"employee_no":"MTB002","basic":"abc"},{"employee_no":"MTB005","basic":0}]');

\echo '=== L6: import baki cuti awal ==='
select * from hr_import_leave_opening('00000000-0000-0000-0000-0000000000c1', 2026,
  '[{"employee_no":"MTB001","leave_code":"AL","carried_forward":3,"taken":5},{"employee_no":"MTB002","leave_code":"XX","taken":1},{"employee_no":"MTB005","leave_code":"al","carried_forward":-1}]');
reset test.role; reset test.uid;
select b.carried_forward, b.adjustment, b.available from leave_balances b join leave_types t on t.id=b.leave_type_id
 where b.employment_id='00000000-0000-0000-0000-0000000000e2' and t.code='AL' and b.year=2026;
