\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian Gaji Pekerja: jadual gaji tetap, tetapkan gaji pokok & elaun mengikut tarikh,
-- komponen baharu, kawalan akses (syarikat sendiri sahaja), log akses data.
-- Gunakan stub local_only (test.uid / test.role).

insert into companies(id,code,name) values
 ('00000000-0000-0000-0000-0000000000c1','MTB','MTB'), ('00000000-0000-0000-0000-0000000000c2','DOIT','DO IT');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c1');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c2');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,9) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','HR','Lily','60110000002'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','AMIN','Amin','60110000004'),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-00000000a005','DINA','Dina','60110000005');
insert into employments(id,person_id,company_id,employee_no,status,join_date) values
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB001','active','2020-01-01'),
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','MTB002','active','2026-03-01'),
 ('00000000-0000-0000-0000-0000000000f5','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000c2','DOIT001','active','2026-01-01');
insert into user_roles(person_id,company_id,role) values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr');

\echo '=== G1: HR menetapkan gaji pokok + elaun Amin mulai 1 Mac ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
select hr_set_pay('00000000-0000-0000-0000-0000000000e4', '{"BASIC": 3000, "ALLOWANCE": 200}', '2026-03-01');
select r->>'name' as nama, r->'items' as gaji, r->>'effective_from' as mulai
  from jsonb_array_elements(hr_pay_table('00000000-0000-0000-0000-0000000000c1', '2026-06-01')->'rows') r;
select string_agg(c->>'code', ',') as komponen_tetap
  from jsonb_array_elements(hr_pay_table('00000000-0000-0000-0000-0000000000c1')->'components') c;

\echo '=== G2: kenaikan gaji mulai 1 Jul; elaun dihentikan (0) ==='
select hr_set_pay('00000000-0000-0000-0000-0000000000e4', '{"BASIC": 3300, "ALLOWANCE": 0}', '2026-07-01');
select pc.code, ec.amount, ec.effective_from, ec.effective_to
  from employment_compensation ec join pay_components pc on pc.id = ec.component_id
 where ec.employment_id = '00000000-0000-0000-0000-0000000000e4' order by pc.code, ec.effective_from;
select (hr_pay_table('00000000-0000-0000-0000-0000000000c1', '2026-06-15')->'rows'->1->'items') as jun,
       (hr_pay_table('00000000-0000-0000-0000-0000000000c1', '2026-07-15')->'rows'->1->'items') as jul;

\echo '=== G3: simpan semula nilai sama → tiada rekod baharu ==='
select count(*) as sebelum from employment_compensation where employment_id = '00000000-0000-0000-0000-0000000000e4' \gset
select hr_set_pay('00000000-0000-0000-0000-0000000000e4', '{"BASIC": 3300}', '2026-07-01');
select count(*) = :sebelum as tiada_perubahan from employment_compensation where employment_id = '00000000-0000-0000-0000-0000000000e4';

\echo '=== G4: komponen baharu "Elaun Telefon" ==='
select hr_add_pay_component('00000000-0000-0000-0000-0000000000c1', 'Elaun Telefon', 'earning', false, false, true) as kod \gset
select :'kod' as kod;
select hr_set_pay('00000000-0000-0000-0000-0000000000e4', jsonb_build_object(:'kod', 50), '2026-08-01');
select (hr_pay_table('00000000-0000-0000-0000-0000000000c1', '2026-08-15')->'rows'->1->'items') as ogos;

\echo '=== G5: ralat yang dijangka ==='
\set ON_ERROR_STOP 0
select hr_set_pay('00000000-0000-0000-0000-0000000000e4', '{"BASIC": 0}', '2026-09-01');
select hr_set_pay('00000000-0000-0000-0000-0000000000e4', '{"COMMISSION": 500}', '2026-09-01');
select hr_set_pay('00000000-0000-0000-0000-0000000000e4', '{"BASIC": -1}', '2026-09-01');
select hr_set_pay('00000000-0000-0000-0000-0000000000e4', '{"BASIC": 3000}', '2026-01-01');
select hr_add_pay_component('00000000-0000-0000-0000-0000000000c1', 'Elaun Telefon', 'earning');
\echo '--- HR MTB tidak boleh lihat / ubah gaji DOIT'
select hr_pay_table('00000000-0000-0000-0000-0000000000c2');
select hr_set_pay('00000000-0000-0000-0000-0000000000f5', '{"BASIC": 9999}', '2026-09-01');
\echo '--- pekerja biasa tidak boleh lihat jadual gaji'
set test.uid='00000000-0000-0000-0000-00000000a004';
select hr_pay_table('00000000-0000-0000-0000-0000000000c1');
\set ON_ERROR_STOP 1

\echo '=== G6: akses direkodkan ==='
reset test.role; reset test.uid;
select count(*) > 0 as akses_direkod from data_access_log where resource = 'salary' and actor_person_id = '00000000-0000-0000-0000-000000000002';
select count(*) as gaji_doit_tidak_berubah from employment_compensation where employment_id = '00000000-0000-0000-0000-0000000000f5';
