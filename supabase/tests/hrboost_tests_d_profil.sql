\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian Fasa D2: kalendar cuti pasukan, cuti umum syarikat, ubah profil,
-- tukar akaun bank (disahkan HR) dan butang ucapan hari jadi.
-- Gunakan stub local_only (test.uid / test.role). Jangan jalankan pada Supabase sebenar tanpa
-- penukaran (lihat supabase/scripts/tests_to_supabase.py).

-- ===== SETUP =====
insert into companies(id,code,name) values ('00000000-0000-0000-0000-0000000000c1','MTB','MUSLIMTRAVELBUG SDN BHD');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c1');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,9) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp,ic_no,date_of_birth) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','HR Satu','Lily','60110000002','900202-14-0002',null),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000a003','Zuerin','Zuerin','60110000003','880303-14-0003',null),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','AMIN BIN ALI','Amin','60110000004','950505-14-0004',null),
 ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-00000000a006','ZULFA BINTI ABU','Zulfa','60110000006','960606-14-0006',
   (now() at time zone 'Asia/Kuala_Lumpur')::date - interval '30 years'),
 ('00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-00000000a007','ORANG LUAR','Luar','60110000007','970707-14-0007',null);
insert into departments(id,company_id,name,head_person_id) values
 ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','Tour','00000000-0000-0000-0000-000000000003'),
 ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000c1','Kewangan',null);
insert into employments(id,person_id,company_id,employee_no,department_id,status,join_date) values
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB001','00000000-0000-0000-0000-0000000000d2','active','2020-01-01'),
 ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1','MTB002','00000000-0000-0000-0000-0000000000d1','active','2019-01-01'),
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','MTB003','00000000-0000-0000-0000-0000000000d1','active','2025-03-01'),
 ('00000000-0000-0000-0000-0000000000e6','00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-0000000000c1','MTB004','00000000-0000-0000-0000-0000000000d1','active','2024-01-01');
insert into user_roles(person_id,company_id,role) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr');
insert into public_holidays(holiday_date,name,is_mandatory) values ('2026-12-25','Hari Krismas',true);
-- Cuti terus dalam jadual (aliran kelulusan diuji dalam ujian v0.2)
insert into leave_requests(employment_id,leave_type_id,start_date,end_date,days,status) values
 ('00000000-0000-0000-0000-0000000000e4',(select id from leave_types where code='AL' and company_id='00000000-0000-0000-0000-0000000000c1'),'2026-12-23','2026-12-28',3,'pending'),
 ('00000000-0000-0000-0000-0000000000e6',(select id from leave_types where code='AL' and company_id='00000000-0000-0000-0000-0000000000c1'),'2026-12-24','2026-12-24',1,'approved'),
 ('00000000-0000-0000-0000-0000000000e6',(select id from leave_types where code='AL' and company_id='00000000-0000-0000-0000-0000000000c1'),'2026-12-10','2026-12-10',1,'rejected'),
 ('00000000-0000-0000-0000-0000000000e2',(select id from leave_types where code='AL' and company_id='00000000-0000-0000-0000-0000000000c1'),'2026-12-24','2026-12-24',1,'approved');

\echo '=== D1: kalendar cuti pasukan (Amin nampak diri & rakan sejabatan sahaja) ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a004';
select name, start_date, end_date, status, is_me
  from team_leave_calendar('00000000-0000-0000-0000-0000000000c1','2026-12-01','2026-12-31');
do $$ begin
  assert (select count(*) from team_leave_calendar('00000000-0000-0000-0000-0000000000c1','2026-12-01','2026-12-31')) = 2,
    'Amin mesti nampak 2 cuti (diri + Zulfa); cuti ditolak & jabatan lain disembunyikan';
end $$;

\echo '=== D2: orang luar syarikat tidak nampak apa-apa ==='
set test.uid='00000000-0000-0000-0000-00000000a007';
select count(*) as luar_kalendar from team_leave_calendar('00000000-0000-0000-0000-0000000000c1','2026-12-01','2026-12-31');
select count(*) as luar_cuti_umum from company_holidays('00000000-0000-0000-0000-0000000000c1','2026-12-01','2026-12-31');
do $$ begin
  assert (select count(*) from company_holidays('00000000-0000-0000-0000-0000000000c1','2026-12-01','2026-12-31')) = 0;
end $$;

\echo '=== D3: cuti umum syarikat ==='
set test.uid='00000000-0000-0000-0000-00000000a004';
select * from company_holidays('00000000-0000-0000-0000-0000000000c1','2026-12-01','2026-12-31');

\echo '=== D4: ubah profil sendiri ==='
select update_my_profile('{"preferred_name":" Amin Z ","address":"Shah Alam","hide_birthday":true,
  "contact_name":"Ibu Amin","contact_relationship":"Ibu","contact_phone":"0123456789"}');
select preferred_name, address, children_count, hide_birthday from persons where id='00000000-0000-0000-0000-000000000004';
select name, relationship, phone from emergency_contacts where person_id='00000000-0000-0000-0000-000000000004';
\set ON_ERROR_STOP 0
select update_my_profile('{"preferred_name":"  "}');
-- bilangan anak kini perlu disahkan HR (submit_profile_change)
select update_my_profile('{"children_count":"2"}');
select update_my_profile('{"photo_path":"00000000-0000-0000-0000-000000000003/swafoto.jpg"}');
\set ON_ERROR_STOP 1
-- akaun bank & IC tidak boleh dikemas kini terus oleh pekerja (jika peranan Supabase wujud)
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    assert not has_column_privilege('authenticated', 'persons', 'bank_account_no', 'UPDATE');
    assert not has_column_privilege('authenticated', 'persons', 'ic_no', 'UPDATE');
  end if;
end $$;

\echo '=== D5: tukar akaun bank -> HR sahkan ==='
select request_bank_change('Maybank','1234 5678 90') as rid1 \gset
select request_bank_change('CIMB Bank','8000123456') as rid2 \gset
select bank_name, bank_account_no, status from bank_change_requests order by requested_at;
\set ON_ERROR_STOP 0
select request_bank_change('Maybank','abc');
-- pekerja tidak boleh mengesahkan sendiri
select decide_bank_change(:'rid2', true);
-- Zuerin (ketua jabatan, bukan HR) tidak boleh mengesahkan
set test.uid='00000000-0000-0000-0000-00000000a003';
select decide_bank_change(:'rid2', true);
-- HR mesti memberi sebab untuk menolak
set test.uid='00000000-0000-0000-0000-00000000a002';
select decide_bank_change(:'rid2', false, '');
\set ON_ERROR_STOP 1
select decide_bank_change(:'rid2', true);
select bank_name, bank_account_no from persons where id='00000000-0000-0000-0000-000000000004';
select resource, count(*) from data_access_log group by resource;
select message from notifications where person_id='00000000-0000-0000-0000-000000000004';
do $$ begin
  assert (select bank_account_no from persons where id='00000000-0000-0000-0000-000000000004') = '8000123456';
end $$;

\echo '=== D6: butang ucapan hari jadi ==='
set test.uid='00000000-0000-0000-0000-00000000a004';
select birthday_whatsapp('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000006') as zulfa_hari_ini;
select birthday_whatsapp('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000003') as zuerin_bukan_hari_ini;
do $$ begin
  assert birthday_whatsapp('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000006') = '60110000006';
  assert birthday_whatsapp('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000003') is null;
end $$;
-- Zulfa sembunyikan hari jadi -> tiada nombor
set test.uid='00000000-0000-0000-0000-00000000a006';
select update_my_profile('{"hide_birthday":true}');
set test.uid='00000000-0000-0000-0000-00000000a004';
select birthday_whatsapp('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000006') as selepas_sembunyi;

\echo '=== D7: orientasi tidak boleh digunakan untuk menukar bank selepas selesai ==='
insert into onboarding_progress(employment_id, step) values ('00000000-0000-0000-0000-0000000000e4','bank');
\set ON_ERROR_STOP 0
select save_onboarding_step('00000000-0000-0000-0000-0000000000e4','bank',
  '{"bank_name":"Maybank","bank_account_no":"111122223333","contact_name":"X","contact_phone":"0123"}');
\set ON_ERROR_STOP 1
do $$ begin
  assert (select bank_account_no from persons where id='00000000-0000-0000-0000-000000000004') = '8000123456';
end $$;
