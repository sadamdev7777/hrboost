\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian Fasa D3: pengurusan HR (papan pemuka, jemputan, maklumat sensitif, ubah & tamat pekerjaan)
-- Gunakan stub local_only (test.uid / test.role). Jangan jalankan pada Supabase sebenar tanpa
-- penukaran (lihat supabase/scripts/tests_to_supabase.py).

-- ===== SETUP =====
insert into companies(id,code,name) values
 ('00000000-0000-0000-0000-0000000000c1','MTB','MUSLIMTRAVELBUG SDN BHD'),
 ('00000000-0000-0000-0000-0000000000c2','DOIT','DO IT GROUP');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c1');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c2');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,9) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp,ic_no) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','HR Satu','Lily','60110000002','900202-14-0002'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000a003','Zuerin','Zuerin','60110000003','880303-14-0003'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','AMIN BIN ALI','Amin','60110000004','950505-14-0004'),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-00000000a005','HR DOIT','Dina','60110000005','910101-14-0005');
insert into departments(id,company_id,name,head_person_id) values
 ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','Tour','00000000-0000-0000-0000-000000000003'),
 ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000c1','Ticketing',null);
insert into employments(id,person_id,company_id,employee_no,department_id,status,join_date,probation_end_date) values
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB001',null,'active','2020-01-01',null),
 ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1','MTB002','00000000-0000-0000-0000-0000000000d1','active','2019-01-01',null),
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','MTB003','00000000-0000-0000-0000-0000000000d1','probation','2026-09-01',
   (now() at time zone 'Asia/Kuala_Lumpur')::date + 10),
 ('00000000-0000-0000-0000-0000000000f4','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c2','DOIT001',null,'active','2026-01-01',null),
 ('00000000-0000-0000-0000-0000000000f5','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000c2','DOIT002',null,'active','2026-01-01',null);
insert into user_roles(person_id,company_id,role) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr'),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000c2','hr');

\echo '=== H1: papan pemuka HR ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
select d->>'company_code' syarikat, d->>'headcount' pekerja, jsonb_array_length(d->'attention') perhatian,
       d->'attention'->0->>'text' perkara
  from hr_dashboard('00000000-0000-0000-0000-0000000000c1') d;
\set ON_ERROR_STOP 0
set test.uid='00000000-0000-0000-0000-00000000a004';
select hr_dashboard('00000000-0000-0000-0000-0000000000c1');
-- HR syarikat lain tidak boleh melihat MTB
set test.uid='00000000-0000-0000-0000-00000000a005';
select hr_dashboard('00000000-0000-0000-0000-0000000000c1');
select hr_view_sensitive('00000000-0000-0000-0000-0000000000e4');
\set ON_ERROR_STOP 1

\echo '=== H2: tambah pekerja & jemputan WhatsApp beratur ==='
set test.uid='00000000-0000-0000-0000-00000000a002';
select add_employee('00000000-0000-0000-0000-0000000000c1','NURIN BINTI ALI','Nurin','60110000099','981128-14-5521',
  '00000000-0000-0000-0000-0000000000d1','Eksekutif Tour','2026-12-01','permanent',3,2500) as nid \gset
select length(invite_employee(:'nid','https://hrboost.io')) > 10 as token_dijana;
select to_address, message like '%https://hrboost.io/jemputan/%' as ada_pautan, bypass_limit from notifications;
\set ON_ERROR_STOP 0
select invite_employee(:'nid','javascript:alert(1)');
-- Zuerin (ketua jabatan, bukan HR) tidak boleh menjemput
set test.uid='00000000-0000-0000-0000-00000000a003';
select invite_employee(:'nid','https://hrboost.io');
\set ON_ERROR_STOP 1

\echo '=== H3: maklumat sensitif direkodkan ==='
set test.uid='00000000-0000-0000-0000-00000000a002';
select hr_view_sensitive('00000000-0000-0000-0000-0000000000e4')->>'ic_no' as ic;
select resource, count(*) from data_access_log group by resource;
select person_other_companies('00000000-0000-0000-0000-0000000000e4') as syarikat_lain;

\echo '=== H4: ubah jawatan, jabatan, gaji & sahkan jawatan ==='
select hr_update_employment(:'nid', '{"basic":"2800","effective_from":"2027-03-01"}');
select hr_update_employment('00000000-0000-0000-0000-0000000000e4',
  '{"department_id":"00000000-0000-0000-0000-0000000000d2","position":"Eksekutif Kanan","work_start":"08:30","confirm":true}');
select e.status, d.name jabatan, ps.title jawatan, e.work_start, e.manager_person_id is null tiada_ketua, e.confirm_date is not null disahkan
  from employments e left join departments d on d.id = e.department_id left join positions ps on ps.id = e.position_id
 where e.id = '00000000-0000-0000-0000-0000000000e4';
select amount, effective_from, effective_to from employment_compensation where employment_id = :'nid' order by effective_from;
select code, amount from hr_current_pay(:'nid');
\set ON_ERROR_STOP 0
select hr_update_employment('00000000-0000-0000-0000-0000000000e4', '{"department_id":"00000000-0000-0000-0000-0000000000c2"}');
\set ON_ERROR_STOP 1

\echo '=== H5: tamatkan pekerjaan ketua jabatan ==='
insert into user_roles(person_id,company_id,role) values ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1','finance');
\set ON_ERROR_STOP 0
select end_employment('00000000-0000-0000-0000-0000000000e2','resigned','2026-12-31');
select end_employment('00000000-0000-0000-0000-0000000000e3','resigned','2018-01-01');
\set ON_ERROR_STOP 1
-- tarikh akhir pada masa hadapan: masih aktif hingga hari itu
select end_employment('00000000-0000-0000-0000-0000000000e3','resigned',(now() at time zone 'Asia/Kuala_Lumpur')::date + 20,'Sambung belajar');
select status, end_status from employments where id = '00000000-0000-0000-0000-0000000000e3';
select cancel_employment_end('00000000-0000-0000-0000-0000000000e3');
select status, end_status from employments where id = '00000000-0000-0000-0000-0000000000e3';
-- tarikh akhir semalam: berkuat kuasa serta-merta
select end_employment('00000000-0000-0000-0000-0000000000e3','resigned',(now() at time zone 'Asia/Kuala_Lumpur')::date - 1,'Sambung belajar');
select status, end_status from employments where id = '00000000-0000-0000-0000-0000000000e3';
select head_person_id is null as jabatan_tiada_ketua from departments where id = '00000000-0000-0000-0000-0000000000d1';
select count(*) as peranan_berbaki from user_roles where person_id = '00000000-0000-0000-0000-000000000003';
select event_type from hr_events where event_type like 'employment.%' order by id;
do $$ begin
  assert (select count(*) from user_roles where person_id = '00000000-0000-0000-0000-000000000003') = 0;
  assert (select head_person_id from departments where id = '00000000-0000-0000-0000-0000000000d1') is null;
end $$;

\echo '=== Bahasa pekerja ditetapkan oleh HR (lalai English) ==='
reset test.uid; reset test.role;
do $$ declare e uuid; hr_uid text; luar_uid text; begin
  select em.id into e from employments em where em.person_id not in (select person_id from user_roles) limit 1;
  assert (select p.language from persons p join employments em on em.person_id = p.id where em.id = e) = 'en', 'lalai English';
  select p.auth_user_id::text into hr_uid from persons p join user_roles r on r.person_id = p.id
   where r.role = 'hr' and r.company_id = (select company_id from employments where id = e) and p.auth_user_id is not null limit 1;
  perform set_config('test.uid', hr_uid, true); perform set_config('test.role', 'authenticated', true);
  perform hr_set_person_language(e, 'ms');
  assert (select p.language from persons p join employments em on em.person_id = p.id where em.id = e) = 'ms', 'ditukar ke BM';
  begin perform hr_set_person_language(e, 'fr'); assert false, 'bahasa tidak sah ditolak';
  exception when assert_failure then raise; when others then null; end;
end $$;
