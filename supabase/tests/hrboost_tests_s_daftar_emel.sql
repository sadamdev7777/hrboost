\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian log masuk e-mel: daftar syarikat (register_company_email) & jemputan (invite_check_ic → accept_invite_email).
-- Gunakan stub local_only (test.uid / test.role). Jangan jalankan pada Supabase sebenar tanpa
-- penukaran (lihat supabase/scripts/tests_to_supabase.py).

-- ===== SETUP =====
insert into companies(id,code,name) values ('00000000-0000-0000-0000-0000000000c1','MTB','MUSLIMTRAVELBUG SDN BHD');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c1');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,9) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp,ic_no) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','HR Satu','Lily','60110000002','900202-14-0002'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000a003','Zuerin','Zuerin','60110000003','880303-14-0003');
insert into departments(id,company_id,name,head_person_id) values
 ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','Tour','00000000-0000-0000-0000-000000000003');
insert into employments(id,person_id,company_id,employee_no,department_id,status,join_date) values
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB001',null,'active','2020-01-01'),
 ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1','MTB002','00000000-0000-0000-0000-0000000000d1','active','2019-01-01');
insert into user_roles(person_id,company_id,role) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr');

\echo '=== B1: HR tambah pekerja & jana jemputan ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
select add_employee('00000000-0000-0000-0000-0000000000c1','Nurin Syafiqah binti Ali','Nurin','60110000099','981128-14-5521',
   '00000000-0000-0000-0000-0000000000d1','Eksekutif Tour','2026-12-01','permanent',3,2500) as eid \gset
select create_invite(:'eid') as tok \gset


\echo '=== S1: jemputan — 4 digit IC dahulu (anon), kemudian akaun e-mel ==='
set test.uid=''; set test.role='anon';
select invite_check_ic(:'tok', '0000')->>'ok' as salah, invite_check_ic(:'tok', '0000')->>'attempts_left' as baki;
select invite_check_ic(:'tok', '5521')->>'ok' as betul;
insert into auth.users select '00000000-0000-0000-0000-0000000000f1'::uuid;
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-0000000000f1';
set test.email='';
\set ON_ERROR_STOP 0
-- e-mel belum disahkan (mesti gagal)
select accept_invite_email(:'tok');
\set ON_ERROR_STOP 1
set test.email='nurin@contoh.my';
select accept_invite_email(:'tok')->>'ok' as diaktifkan;
select accept_invite_email(:'tok')->>'ok' as buka_semula_kekal_ok;
reset test.role; reset test.uid; reset test.email;
select p.email, p.auth_user_id is not null as diikat from persons p join employments e on e.person_id = p.id where e.id = :'eid';

\echo '=== S2: jemputan tanpa semakan IC ditolak ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
select add_employee('00000000-0000-0000-0000-0000000000c1','Ahmad bin Abu','Ahmad','60110000098','990101-14-7777',
   '00000000-0000-0000-0000-0000000000d1','Eksekutif','2026-12-01','permanent',3,2500) as eid2 \gset
select create_invite(:'eid2') as tok2 \gset
insert into auth.users select '00000000-0000-0000-0000-0000000000f2'::uuid;
set test.uid='00000000-0000-0000-0000-0000000000f2'; set test.email='ahmad@contoh.my';
select accept_invite_email(:'tok2')->>'error' as tanpa_ic;
reset test.role; reset test.uid; reset test.email;

\echo '=== S3: daftar syarikat dengan e-mel ==='
insert into auth.users select '00000000-0000-0000-0000-0000000000f3'::uuid;
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-0000000000f3';
set test.email='';
\set ON_ERROR_STOP 0
select register_company_email('Kenari Sdn Bhd', '1–10', 'Faizal bin Hashim', null);
\set ON_ERROR_STOP 1
set test.email='faizal@kenari.my';
select register_company_email('Kenari Sdn Bhd', '1–10', 'Faizal bin Hashim', '012-345 6789') as cid \gset
select register_company_email('Kenari Sdn Bhd', '1–10', 'Faizal bin Hashim', null) = :'cid' as tidak_berganda;
reset test.role; reset test.uid; reset test.email;
select c.name, p.email, p.phone_whatsapp, (select string_agg(role::text, ',' order by role) from user_roles r where r.company_id = c.id) as peranan
  from companies c join persons p on p.id = c.created_by where c.id = :'cid';
\echo '>>> LULUS: hrboost_tests_s_daftar_emel'
