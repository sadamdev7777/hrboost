\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian Fasa B: jemputan (invite_preview, accept_invite) & orientasi (save_onboarding_step)
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

\echo '=== B2: paparan jemputan tanpa log masuk (anon) ==='
set test.uid='';
select p->>'ok' ok, p->>'name' nama, p->>'company_code' syarikat, p->>'position' jawatan, p->>'department' jabatan,
       p->>'head' ketua, p->>'join_date' mula, p->>'probation_months' percubaan_bulan, p->>'phone' telefon
  from invite_preview(:'tok') p;
select invite_preview('token-palsu')->>'error' as token_salah;

\echo '=== B3: aktifkan akaun (IC salah, kemudian betul) ==='
set test.uid='00000000-0000-0000-0000-00000000a008';
select accept_invite(:'tok','0000')->>'error' as ic_salah;
select (invite_preview(:'tok')->>'attempts_left')::int as cubaan_berbaki;
select accept_invite(:'tok','5521')->>'ok' as diaktifkan;
select invite_preview(:'tok')->>'accepted' as sudah_diaktifkan;

\echo '=== B4: langkah orientasi ==='
select save_onboarding_step(:'eid','name','{"full_name":"Nurin Syafiqah binti Ali","preferred_name":"Nurin"}') as selepas_nama;
select full_name, preferred_name from persons where phone_whatsapp='60110000099';
select save_onboarding_step(:'eid','selfie',
  jsonb_build_object('photo_path', (select id from persons where phone_whatsapp='60110000099')::text || '/swafoto.jpg')) as selepas_swafoto;
select save_onboarding_step(:'eid','bank','{"bank_name":"Maybank","bank_account_no":"1234 5678 9012","contact_name":"Ali bin Abu","contact_relationship":"Bapa","contact_phone":"0123456789"}') as selepas_bank;
select bank_name, bank_account_no, (select name||' / '||relationship from emergency_contacts e where e.person_id=p.id) waris
  from persons p where phone_whatsapp='60110000099';
select save_onboarding_step(:'eid','ic', jsonb_build_object(
  'front_path', (select id from persons where phone_whatsapp='60110000099')::text || '/ic-hadapan.jpg',
  'back_path',  (select id from persons where phone_whatsapp='60110000099')::text || '/ic-belakang.jpg')) as selepas_ic;
select string_agg(doc_type, ',' order by doc_type) dokumen from employee_documents where employment_id=:'eid';
select save_onboarding_step(:'eid','personal','{"address":"Kuala Lumpur","marital_status":"berkahwin","spouse_working":false,"children_count":2,"epf_no":"12345678","tax_no":"IG123","need_help":false}') as selepas_peribadi;
select marital_status, spouse_working, children_count, (select epf_no||'/'||tax_no from employments where id=:'eid') berkanun
  from persons where phone_whatsapp='60110000099';
select save_onboarding_step(:'eid','handbook') as selepas_buku;
select save_onboarding_step(:'eid','install') as selepas_pasang;
select count(*) as event_orientasi_selesai from hr_events where event_type='onboarding.completed';

\echo '=== B5: semakan keselamatan (mesti gagal) ==='
\set ON_ERROR_STOP 0
-- orang lain tidak boleh menyimpan langkah untuk Nurin
set test.uid='00000000-0000-0000-0000-00000000a003';
select save_onboarding_step(:'eid','handbook');
-- swafoto mesti dalam folder sendiri
set test.uid='00000000-0000-0000-0000-00000000a008';
select save_onboarding_step(:'eid','selfie','{"photo_path":"00000000-0000-0000-0000-000000000003/x.jpg"}');
-- langkah tidak dikenali
select save_onboarding_step(:'eid','gaji');
-- pekerja tidak boleh menukar telefon / status aktif sendiri secara terus
grant usage on schema public to authenticated; grant select on all tables in schema public to authenticated;
set role authenticated;
update persons set phone_whatsapp='60119999999' where phone_whatsapp='60110000099';
update persons set is_active=false where phone_whatsapp='60110000099';
reset role;
\set ON_ERROR_STOP 1
\echo '--- lajur profil masih boleh dikemas kini sendiri'
set role authenticated;
update persons set hide_birthday=true where id = current_person_id();
select count(*) as kemas_kini_profil_berjaya from persons where id = current_person_id() and hide_birthday;
reset role;
select phone_whatsapp, is_active from persons where preferred_name='Nurin';
