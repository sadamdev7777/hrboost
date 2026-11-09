\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian HR mudah II (2): soalan HR, pendahuluan gaji → potongan, kerja fleksibel, penilaian percubaan.
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

\echo '=== O1: soalan HR ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a004';
select ask_hr('00000000-0000-0000-0000-0000000000e4', 'Berapa hari cuti haji?', 'Menurut buku panduan: 40 hari sekali seumur hidup.', false) is not null as ai_cukup;
select ask_hr('00000000-0000-0000-0000-0000000000e4', 'Bolehkah saya bawa cuti tahunan ke tahun depan?', null, true) is not null as kepada_hr;
set test.uid='00000000-0000-0000-0000-00000000a002';
select name, status from hr_question_list('00000000-0000-0000-0000-0000000000c1');
select answer_hr_question((select id from hr_questions where status = 'open'), 'Boleh, maksimum 5 hari.');
select hr_question_stats('00000000-0000-0000-0000-0000000000c1') - 'avg_hours' as statistik;
reset test.role; reset test.uid;
select message like 'Jawapan HR%' as dimaklumkan from notifications where person_id = '00000000-0000-0000-0000-000000000004' order by created_at desc limit 1;

\echo '=== O2: pendahuluan gaji (jumlah bebas, CEO meluluskan) ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a004';
\set ON_ERROR_STOP 0
-- tiada CEO dalam syarikat → ditolak (tiada lulus automatik)
select submit_salary_advance('00000000-0000-0000-0000-0000000000e4', 2000, 'Kecemasan keluarga');
\set ON_ERROR_STOP 1
reset test.role; reset test.uid;
insert into user_roles(person_id,company_id,role) values ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-0000000000c1','ceo');
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a004';
select amount, status from submit_salary_advance('00000000-0000-0000-0000-0000000000e4', 2000, 'Kecemasan keluarga');
\set ON_ERROR_STOP 0
select submit_salary_advance('00000000-0000-0000-0000-0000000000e4', 100, 'Kedua');
\set ON_ERROR_STOP 1
select s.name, s.approver_role from approval_workflow_steps s join approval_workflows w on w.id = s.workflow_id where w.request_type = 'salary_advance';
set test.uid='00000000-0000-0000-0000-00000000a006';
select (approval_act(t.id, 'approve')).status from approval_tasks t join approval_requests r on r.id = t.request_id where r.request_type = 'salary_advance' and t.status = 'pending';
reset test.role; reset test.uid;
select status, make_date(deduct_year, deduct_month, 1) = (date_trunc('month', current_date) + interval '1 month')::date as bulan_depan from salary_advances;
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
select finance_mark_advance_paid((select id from salary_advances));
-- gaji bulan depan menolak pendahuluan
select payroll_prepare('00000000-0000-0000-0000-0000000000c1', extract(year from current_date + interval '1 month')::int, extract(month from current_date + interval '1 month')::int) is not null as sedia;
select payroll_calculate((select id from payroll_runs limit 1)) is not null as dikira;
reset test.role; reset test.uid;
select l.component_code, l.kind, l.amount from payslip_lines l join payslips s on s.id = l.payslip_id
 where s.employment_id = '00000000-0000-0000-0000-0000000000e4' and l.component_code = 'ADVANCE';

\echo '=== O3: susunan kerja fleksibel ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a004';
select submit_flexible_work('00000000-0000-0000-0000-0000000000e4', array['place','hours'], 'Bekerja dari rumah setiap Jumaat, 8 pagi hingga 5 petang.', current_date + 14) is not null as dimohon;
set test.uid='00000000-0000-0000-0000-00000000a002';
select name, change_types, days_left from flexible_work_list('00000000-0000-0000-0000-0000000000c1');
\set ON_ERROR_STOP 0
select decide_flexible_work((select id from flexible_work_requests), false, '');
\set ON_ERROR_STOP 1
select decide_flexible_work((select id from flexible_work_requests), false, 'Peranan memerlukan kehadiran di pejabat pada hari Jumaat.');
select status, decision_note is not null as ada_sebab from flexible_work_requests;

\echo '=== O4: penilaian percubaan ==='
set test.uid='00000000-0000-0000-0000-00000000a003';
select name, days_left from my_probation_reviews_due('00000000-0000-0000-0000-0000000000c1');
\set ON_ERROR_STOP 0
select submit_probation_review('00000000-0000-0000-0000-0000000000e5', '{"kualiti":4,"kehadiran":6,"sikap":4,"kerjasama":4}', 'confirm', null, null);
\set ON_ERROR_STOP 1
select submit_probation_review('00000000-0000-0000-0000-0000000000e5', '{"kualiti":3,"kehadiran":2,"sikap":4,"kerjasama":4}', 'extend', 2, 'Kehadiran perlu diperbaiki.') is not null as dinilai;
select count(*) as masih_perlu_dinilai from my_probation_reviews_due('00000000-0000-0000-0000-0000000000c1');
set test.uid='00000000-0000-0000-0000-00000000a004';
\set ON_ERROR_STOP 0
select submit_probation_review('00000000-0000-0000-0000-0000000000e5', '{"kualiti":5,"kehadiran":5,"sikap":5,"kerjasama":5}', 'confirm', null, null);
\set ON_ERROR_STOP 1
set test.uid='00000000-0000-0000-0000-00000000a002';
select x->>'recommendation' cadangan, x->>'reviewer' penilai from probation_review_latest('00000000-0000-0000-0000-0000000000e5') x;
select decide_probation('00000000-0000-0000-0000-0000000000e5', 'extended', 2);
reset test.role; reset test.uid;
select probation_end_date - current_date > 60 as dilanjut, (select hr_decision from probation_reviews order by submitted_at desc limit 1) from employments where id = '00000000-0000-0000-0000-0000000000e5';

\echo '=== O5: sejarah perubahan ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
select hr_update_employment('00000000-0000-0000-0000-0000000000e4', '{"department_id": null, "basic": "3500", "effective_from": "2026-12-01"}'::jsonb, 'web');
insert into user_roles(person_id, company_id, role) values ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','finance');
select kind, field, old_value, new_value, actor from employment_history('00000000-0000-0000-0000-0000000000e4') where kind = 'change' order by field;
set test.uid='00000000-0000-0000-0000-00000000a004';
\set ON_ERROR_STOP 0
select * from employment_history('00000000-0000-0000-0000-0000000000e4');
