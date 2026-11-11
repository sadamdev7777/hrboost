\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian my_context(): konteks pengguna dalam satu panggilan (peranan ikut syarikat aktif, syarikat digantung tersembunyi).
-- Gunakan stub local_only (test.uid / test.role). Jangan jalankan pada Supabase sebenar.

insert into companies(id,code,name) values
 ('00000000-0000-0000-0000-0000000000c1','MTB','MUSLIMTRAVELBUG SDN BHD'),
 ('00000000-0000-0000-0000-0000000000c2','DOIT','DO IT SDN BHD');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,3) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp,ic_no) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','LILY BINTI ALI','Lily','60110000002','900202-14-0002');
insert into departments(id,company_id,name,head_person_id) values
 ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000c2','Ops','00000000-0000-0000-0000-000000000002');
insert into employments(id,person_id,company_id,employee_no,department_id,status,join_date) values
 ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB001',null,'active','2020-01-01'),
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c2','DOIT01','00000000-0000-0000-0000-0000000000d2','active','2022-01-01');
insert into user_roles(person_id,company_id,role) values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr');

\echo '=== K1: syarikat lalai = pekerjaan pertama ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
select my_context()->>'active_company' as aktif, my_context()->'roles' as peranan, jsonb_array_length(my_context()->'employments') as n;
do $$ declare c jsonb := my_context(); begin
  assert c->>'active_company' = '00000000-0000-0000-0000-0000000000c1', 'aktif lalai';
  assert c->'roles' = '["hr"]'::jsonb, 'peranan MTB';
  assert c->'heads' = '[]'::jsonb, 'bukan ketua di MTB';
  assert jsonb_array_length(c->'employments') = 2, 'dua pekerjaan';
  assert c->'person'->>'preferred_name' = 'Lily', 'nama panggilan';
end $$;

\echo '=== K2: syarikat pilihan → peranan & ketua ikut syarikat itu ==='
do $$ declare c jsonb := my_context('00000000-0000-0000-0000-0000000000c2'); begin
  assert c->>'active_company' = '00000000-0000-0000-0000-0000000000c2', 'aktif pilihan';
  assert c->'roles' = '[]'::jsonb, 'tiada peranan DOIT';
  assert c->'heads' = '["00000000-0000-0000-0000-0000000000d2"]'::jsonb, 'ketua Ops';
end $$;
-- syarikat bukan milik pengguna → kembali kepada lalai
do $$ begin
  assert my_context(gen_random_uuid())->>'active_company' = '00000000-0000-0000-0000-0000000000c1', 'pilihan tidak sah';
end $$;

\echo '=== K3: tiada rekod orang → null ==='
set test.uid='00000000-0000-0000-0000-00000000a003';
do $$ begin assert my_context() is null, 'null'; end $$;
