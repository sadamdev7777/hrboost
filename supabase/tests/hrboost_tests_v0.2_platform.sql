\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- ===== SETUP =====
insert into companies(id,code,name,accounting_system) values
 ('00000000-0000-0000-0000-0000000000c1','MTB','MUSLIMTRAVELBUG SDN BHD','quickbooks'),
 ('00000000-0000-0000-0000-0000000000c2','DOIT','DO IT GROUP SDN BHD','niagawan');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c1'), seed_company_defaults('00000000-0000-0000-0000-0000000000c2');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,9) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp,ic_no,date_of_birth) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000a001','Mohd Saddam','Sadam','60110000001','800101-14-0001',null),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','HR Satu','Lily','60110000002','900202-14-0002',null),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000a003','Zuerin','Zuerin','60110000003','880303-14-0003',null),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','Amin bin Ali','Amin','60110000004','951109-14-1234',null),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-00000000a005','Zulfa binti Abu','Zulfa','60110000005','961107-14-5555',null),
 ('00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-00000000a007','Platform Owner','Owner','60110000007',null,null);
insert into platform_admins values ('00000000-0000-0000-0000-000000000007');
insert into departments(id,company_id,name,head_person_id) values
 ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','Tour','00000000-0000-0000-0000-000000000003'),
 ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000c1','CEO Office','00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-0000000000d3','00000000-0000-0000-0000-0000000000c2','IT','00000000-0000-0000-0000-000000000001');
insert into employments(id,person_id,company_id,employee_no,department_id,status,join_date) values
 ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','MTB001','00000000-0000-0000-0000-0000000000d2','active','2015-01-01'),
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB002','00000000-0000-0000-0000-0000000000d2','active','2020-01-01'),
 ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1','MTB003','00000000-0000-0000-0000-0000000000d1','active','2019-01-01'),
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','MTB004','00000000-0000-0000-0000-0000000000d1','active','2025-03-01'),
 ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000c1','MTB005','00000000-0000-0000-0000-0000000000d1','active','2024-01-01'),
 ('00000000-0000-0000-0000-0000000000e8','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c2','DOIT001','00000000-0000-0000-0000-0000000000d3','active','2020-01-01'),
 ('00000000-0000-0000-0000-0000000000e7','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c2','DOIT002','00000000-0000-0000-0000-0000000000d3','active','2026-01-01');
insert into user_roles(person_id,company_id,role) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','ceo'),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','admin'),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c2','admin'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr');

grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;

\echo '=== T1: HR Lily (MTB) TIDAK nampak DO IT ==='
set role authenticated; set test.uid='00000000-0000-0000-0000-00000000a002';
select count(*) filter (where company_id='00000000-0000-0000-0000-0000000000c1') as mtb_nampak,
       count(*) filter (where company_id='00000000-0000-0000-0000-0000000000c2') as doit_nampak from employments;
reset role;

\echo '=== T2: beri peranan kepada orang luar mesti gagal ==='
\set ON_ERROR_STOP 0
insert into user_roles(person_id,company_id,role) values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c2','hr');
\set ON_ERROR_STOP 1

\echo '=== T3: Lily minta akses DOIT, superadmin lulus, lepas tu tarik balik ==='
set test.uid='00000000-0000-0000-0000-00000000a002';
select request_company_access('doit','hr',30,'Bantu gaji Disember') is not null as dihantar;
\set ON_ERROR_STOP 0
select request_company_access('doit','hr',30,'lagi');
\echo '--- bukan superadmin cuba lulus mesti gagal'
select decide_company_access((select id from company_access_grants),true);
\set ON_ERROR_STOP 1
set test.uid='00000000-0000-0000-0000-00000000a007';
select status, (expires_at - decided_at) as tempoh from decide_company_access((select id from company_access_grants), true, 'ok');
set role authenticated; set test.uid='00000000-0000-0000-0000-00000000a002';
select count(*) filter (where company_id='00000000-0000-0000-0000-0000000000c2') as doit_nampak_selepas_lulus from employments;
reset role; set test.uid='00000000-0000-0000-0000-00000000a007';
select revoke_company_access((select id from company_access_grants));
set role authenticated; set test.uid='00000000-0000-0000-0000-00000000a002';
select count(*) filter (where company_id='00000000-0000-0000-0000-0000000000c2') as doit_nampak_selepas_tarik from employments;
reset role;
select action, (select preferred_name from persons where id=actor_person_id) as pelaku from platform_audit_log order by id;
select count(*) as notifikasi_kepada_owner_dan_admin_doit from notifications where message like '%akses%';

\echo '=== T4: superadmin TIDAK nampak data peribadi, tapi nampak agregat ==='
set role authenticated; set test.uid='00000000-0000-0000-0000-00000000a007';
select count(*) as persons_nampak, (select count(*) from employments) as employments_nampak, (select count(*) from leave_balances) as baki_nampak from persons;
reset role; set test.uid='00000000-0000-0000-0000-00000000a007';
select code, status, admins, staff_active from sa_company_overview() order by code;

\echo '=== T5: nyahaktif syarikat DOIT & pengguna ==='
select sa_set_company_status('00000000-0000-0000-0000-0000000000c2','suspended','ujian');
set test.uid='00000000-0000-0000-0000-00000000a001';
select has_role('00000000-0000-0000-0000-0000000000c2','{admin}') as sadam_admin_doit_selepas_nyahaktif,
       has_role('00000000-0000-0000-0000-0000000000c1','{admin}') as sadam_admin_mtb;
set test.uid='00000000-0000-0000-0000-00000000a007';
select sa_set_company_status('00000000-0000-0000-0000-0000000000c2','active',null);
select sa_set_person_active('00000000-0000-0000-0000-000000000005', false, 'ujian');
set test.uid='00000000-0000-0000-0000-00000000a005';
select current_person_id() is null as zulfa_terkunci;
set test.uid='00000000-0000-0000-0000-00000000a007';
select sa_set_person_active('00000000-0000-0000-0000-000000000005', true);

\echo '=== T6: cuti umum pilihan syarikat (2027) ==='
insert into public_holidays(holiday_date,name,is_mandatory,state) values
 ('2027-02-01','Hari Wilayah',true,'WP Kuala Lumpur'),('2027-05-01','Hari Pekerja',true,null),('2027-06-07','Agong',true,null),
 ('2027-08-31','Kebangsaan',true,null),('2027-09-16','Malaysia',true,null);
insert into public_holidays(holiday_date,name,state) values
 ('2027-01-01','Tahun Baru','WP Kuala Lumpur'),('2027-02-08','CNY',null),('2027-02-09','CNY 2',null),
 ('2027-03-10','Raya',null),('2027-03-11','Raya 2',null),('2027-05-17','Haji',null),('2027-12-27','Krismas ganti',null);
set test.uid='00000000-0000-0000-0000-00000000a002';
\set ON_ERROR_STOP 0
select set_company_holidays('00000000-0000-0000-0000-0000000000c1',2027,
  array(select id from public_holidays where name in ('Tahun Baru','Raya')));
\set ON_ERROR_STOP 1
select set_company_holidays('00000000-0000-0000-0000-0000000000c1',2027,
  array(select id from public_holidays where name in ('Tahun Baru','Raya','Raya 2','Haji','CNY','Krismas ganti'))) as jumlah_hari;
select leave_count_days('00000000-0000-0000-0000-0000000000e4','2027-02-08','2027-02-09','full') as cny_hari_bekerja_2_sebab_cny2_tak_dipilih;
select leave_count_days('00000000-0000-0000-0000-0000000000e7','2027-02-08','2027-02-09','full') as doit_belum_pilih_jadi_0;

\echo '=== T7: mohon cuti dengan PIC ganti → WhatsApp kepada PIC & HR ==='
set test.role='service_role'; set test.uid='';
\set ON_ERROR_STOP 0
select submit_leave('00000000-0000-0000-0000-0000000000e4','AL','2026-12-23','2026-12-28','full','Balik kampung',null,'whatsapp','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000007');
\set ON_ERROR_STOP 1
select days, cover_person_id is not null as ada_pic from submit_leave('00000000-0000-0000-0000-0000000000e4','AL','2026-12-23','2026-12-28','full','Balik kampung',null,'whatsapp','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005');
select process_hr_events();
select p.preferred_name as kepada, n.message from notifications n join persons p on p.id=n.person_id
 where n.message like '%PIC%' or n.message like '%memohon Cuti%' order by n.created_at;
\echo '--- lulus semua tier → maklum PIC'
select approval_act(t.id,'approve',null,'web',t.approver_person_id) from approval_tasks t where t.status='pending';
select approval_act(t.id,'approve',null,'web',t.approver_person_id) from approval_tasks t where t.status='pending';
select approval_act(t.id,'approve',null,'web',t.approver_person_id) from approval_tasks t where t.status='pending';
select status from leave_requests;
select process_hr_events();
select p.preferred_name as kepada, n.message from notifications n join persons p on p.id=n.person_id where n.message like 'Makluman: cuti%';

\echo '=== T8: CrossChex punch ==='
update employments set attendance_workno='11808' where id='00000000-0000-0000-0000-0000000000e4';
select ingest_punch('00000000-0000-0000-0000-0000000000c1','11808','u1','2026-11-09 01:31:00+00',0,'SN1','FaceDeep') as padan;
select ingest_punch('00000000-0000-0000-0000-0000000000c1','11808','u2','2026-11-09 10:12:00+00',128,'SN1','FaceDeep');
select ingest_punch('00000000-0000-0000-0000-0000000000c1','11808','u2','2026-11-09 10:12:00+00',128,'SN1','FaceDeep') as duplikat_diabaikan;
select work_date, to_char(clock_in at time zone 'Asia/Kuala_Lumpur','HH24:MI') masuk, to_char(clock_out at time zone 'Asia/Kuala_Lumpur','HH24:MI') keluar, late_minutes from attendance_records;
select ingest_punch('00000000-0000-0000-0000-0000000000c1','99999','u3','2026-11-09 00:55:00+00') as workno_tak_dikenali;
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
select match_attendance_workno('00000000-0000-0000-0000-0000000000e5','99999') as hari_dibina_semula;
select (select preferred_name from persons p join employments e on e.person_id=p.id where e.id=a.employment_id) nama, work_date, late_minutes from attendance_records a order by 1;

\echo '=== T9: tambah pekerja + jemputan + aktifkan ==='
select add_employee('00000000-0000-0000-0000-0000000000c1','NURIN SYAFIQAH','Nurin','60110000099','981128-14-5521',
   '00000000-0000-0000-0000-0000000000d1','Eksekutif Tour','2026-12-01','permanent',3,2500) is not null as ditambah;
select employee_no, status, probation_end_date, (select full_name from persons where id=manager_person_id) ketua from employments where employee_no='MTB006';
select create_invite((select id from employments where employee_no='MTB006')) as tok \gset
set test.uid='00000000-0000-0000-0000-00000000a008';
\set ON_ERROR_STOP 0
select accept_invite(:'tok','0000') as salah, (select attempts from employee_invites order by created_at desc limit 1) as cubaan_disimpan;
\set ON_ERROR_STOP 1
select accept_invite(:'tok','5521') as diaktifkan;
select current_person_id() = (select id from persons where preferred_name='Nurin') as nurin_log_masuk;
select complete_onboarding_step((select id from employments where employee_no='MTB006'),'name') as langkah_siap;
\set ON_ERROR_STOP 0
select accept_invite(:'tok','5521');
\set ON_ERROR_STOP 1

\echo '=== T10: daftar syarikat dari homepage ==='
set test.uid='00000000-0000-0000-0000-00000000a009';
select register_company('Syarikat ABC Sdn Bhd','11-50','Faizal Hamid','60129999999','f@abc.my') as cid \gset
select code, status from companies where id=:'cid';
select string_agg(role::text, ',' order by role) peranan from user_roles where company_id=:'cid';
select count(*) jenis_cuti, (select count(*) from approval_workflows where company_id=:'cid') aliran from leave_types where company_id=:'cid';
reset role;

\echo '=== T11: had penggunaan ==='
set test.role='service_role'; set test.uid='';
update companies set wa_monthly_limit=2 where code='MTB';
select bump_usage('00000000-0000-0000-0000-0000000000c1','wa') a, bump_usage('00000000-0000-0000-0000-0000000000c1','wa') b, bump_usage('00000000-0000-0000-0000-0000000000c1','wa') c_melebihi;

\echo '=== T12: hari jadi (hari & bulan sahaja, ikut IC) ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a003';
select name, department, day, month from team_birthdays('00000000-0000-0000-0000-0000000000c1','2026-11-01','2026-11-30');
update persons set hide_birthday=true where preferred_name='Zulfa';
select count(*) selepas_zulfa_sembunyi from team_birthdays('00000000-0000-0000-0000-0000000000c1','2026-11-01','2026-11-30');
