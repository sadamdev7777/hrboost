\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian Fasa D3: Tetapan (aliran kelulusan, minimum cuti berkanun, tempoh tuntutan,
-- wakil kelulusan automatik, akses luar). Gunakan stub local_only (test.uid / test.role).
-- Jangan jalankan pada Supabase sebenar tanpa penukaran (lihat supabase/scripts/tests_to_supabase.py).

-- ===== SETUP =====
insert into companies(id,code,name) values
 ('00000000-0000-0000-0000-0000000000c1','MTB','MUSLIMTRAVELBUG SDN BHD'),
 ('00000000-0000-0000-0000-0000000000c2','DOIT','DO IT GROUP');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c1');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,9) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp,ic_no) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000a001','CEO','Sadam','60110000001','800101-14-0001'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','HR Satu','Lily','60110000002','900202-14-0002'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000a003','Zuerin','Zuerin','60110000003','880303-14-0003'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','AMIN BIN ALI','Amin','60110000004','950505-14-0004'),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-00000000a005','LUAR','Hasif','60110000005','910101-14-0005');
insert into departments(id,company_id,name,head_person_id) values
 ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','Tour','00000000-0000-0000-0000-000000000003');
insert into employments(id,person_id,company_id,employee_no,department_id,status,join_date) values
 ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','MTB000',null,'active','2018-01-01'),
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB001',null,'active','2020-01-01'),
 ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1','MTB002','00000000-0000-0000-0000-0000000000d1','active','2019-01-01'),
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','MTB003','00000000-0000-0000-0000-0000000000d1','active','2025-03-01'),
 ('00000000-0000-0000-0000-0000000000f5','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000c2','DOIT001',null,'active','2026-01-01');
insert into user_roles(person_id,company_id,role) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','ceo'),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','admin'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr');

\echo '=== S1: teks lalai dalam bahasa Melayu rasmi ==='
select name from automation_rules where company_id = '00000000-0000-0000-0000-0000000000c1' order by created_at, name limit 4;
select count(*) as teks_tidak_rasmi from automation_rules
 where name ~* '(staff|PIC ganti|SLA|maklum )' or message_template ~ '(PIC ganti|handover|clock-in|DILULUSKAN)';
select name from approval_workflow_steps where name in ('Finance','Kewangan');

\echo '=== S2: simpan aliran kelulusan (HR) ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
select save_workflow('00000000-0000-0000-0000-0000000000c1','leave',
  '[{"name":"Ketua Jabatan","approver":"dept_head"},
    {"name":"HR","approver":"role","approver_role":"hr"},
    {"name":"CEO","approver":"role","approver_role":"ceo","condition":{"field":"days","op":">","value":3}}]', '16:30', 3) is not null as disimpan;
select s.step_order, s.name, s.approver, s.approver_role, s.condition from approval_workflow_steps s
  join approval_workflows w on w.id = s.workflow_id
 where w.company_id = '00000000-0000-0000-0000-0000000000c1' and w.request_type = 'leave' order by 1;
select cutoff_time, reminder_every_hours from approval_workflows
 where company_id = '00000000-0000-0000-0000-0000000000c1' and request_type = 'leave';
\set ON_ERROR_STOP 0
select save_workflow('00000000-0000-0000-0000-0000000000c1','leave','[]');
select save_workflow('00000000-0000-0000-0000-0000000000c1','leave',
  '[{"name":"Orang luar","approver":"specific_person","approver_person_id":"00000000-0000-0000-0000-000000000005"}]');
set test.uid='00000000-0000-0000-0000-00000000a004';
select save_workflow('00000000-0000-0000-0000-0000000000c1','leave','[{"name":"HR","approver":"role","approver_role":"hr"}]');
\set ON_ERROR_STOP 1

\echo '=== S3: kelayakan cuti tidak boleh kurang daripada minimum ==='
\set ON_ERROR_STOP 0
update leave_entitlement_rules set days_per_year = 7
 where leave_type_id = (select id from leave_types where company_id = '00000000-0000-0000-0000-0000000000c1' and code = 'AL')
   and min_service_months = 0;
update leave_types set active = false where company_id = '00000000-0000-0000-0000-0000000000c1' and code = 'MC';
delete from leave_types where company_id = '00000000-0000-0000-0000-0000000000c1' and code = 'ML';
\set ON_ERROR_STOP 1
update leave_entitlement_rules set days_per_year = 10
 where leave_type_id = (select id from leave_types where company_id = '00000000-0000-0000-0000-0000000000c1' and code = 'AL')
   and min_service_months = 0;
update leave_types set active = false where company_id = '00000000-0000-0000-0000-0000000000c1' and code = 'EL';
select code, active from leave_types where company_id = '00000000-0000-0000-0000-0000000000c1' and code in ('MC','EL') order by 1;

\echo '=== S4: tempoh hantar tuntutan ==='
update companies set claim_submit_days = 30 where id = '00000000-0000-0000-0000-0000000000c1';
set test.uid='00000000-0000-0000-0000-00000000a004';
insert into claims(id, employment_id, title, status) values
 ('00000000-0000-0000-0000-00000000cc01','00000000-0000-0000-0000-0000000000e4','Resit lama','draft'),
 ('00000000-0000-0000-0000-00000000cc02','00000000-0000-0000-0000-0000000000e4','Resit baru','draft');
insert into claim_items(claim_id, claim_type_id, expense_date, amount, description, receipt_path, receipt_paths) values
 ('00000000-0000-0000-0000-00000000cc01',(select id from claim_types where company_id='00000000-0000-0000-0000-0000000000c1' and name='Lain-lain'),
   (now() at time zone 'Asia/Kuala_Lumpur')::date - 45, 20, 'Lama', 'x/r.jpg', '{x/r.jpg}'),
 ('00000000-0000-0000-0000-00000000cc02',(select id from claim_types where company_id='00000000-0000-0000-0000-0000000000c1' and name='Lain-lain'),
   (now() at time zone 'Asia/Kuala_Lumpur')::date - 3, 20, 'Baru', 'x/r.jpg', '{x/r.jpg}');
\set ON_ERROR_STOP 0
select submit_claim('00000000-0000-0000-0000-00000000cc01');
\set ON_ERROR_STOP 1
select submit_claim('00000000-0000-0000-0000-00000000cc02');
select title, status from claims order by title;

\echo '=== S5: wakil kelulusan automatik apabila ketua jabatan bercuti ==='
set test.uid='00000000-0000-0000-0000-00000000a003';
select (submit_leave('00000000-0000-0000-0000-0000000000e3','AL',
  next_working_day('00000000-0000-0000-0000-0000000000c1', (now() at time zone 'Asia/Kuala_Lumpur')::date + 20),
  next_working_day('00000000-0000-0000-0000-0000000000c1', (now() at time zone 'Asia/Kuala_Lumpur')::date + 20),
  'full','Urusan keluarga',null,'web',null,'00000000-0000-0000-0000-000000000004')).id as lid \gset
select p1.preferred_name dari, p2.preferred_name kepada, request_types from approval_delegations d
  join persons p1 on p1.id = d.from_person_id join persons p2 on p2.id = d.to_person_id;
select approval_cancel((select approval_request_id from leave_requests where id = :'lid'));
select count(*) as wakil_selepas_batal from approval_delegations;
\set ON_ERROR_STOP 0
set test.uid='00000000-0000-0000-0000-00000000a002';
insert into approval_delegations(company_id, from_person_id, to_person_id, start_date, end_date)
values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000005', current_date, current_date + 3);
\set ON_ERROR_STOP 1

\echo '=== S6: cuti umum & ringkasan tetapan ==='
insert into public_holidays(holiday_date,name,is_mandatory) values
 ('2027-02-01','Hari Wilayah Persekutuan',true),('2027-05-01','Hari Pekerja',true),('2027-06-07','Hari Keputeraan Agong',true),
 ('2027-08-31','Hari Kebangsaan',true),('2027-09-16','Hari Malaysia',true),('2027-01-01','Tahun Baru',false),
 ('2027-02-06','Tahun Baru Cina',false),('2027-02-07','Tahun Baru Cina (Hari Kedua)',false),('2027-03-10','Hari Raya Aidilfitri',false),
 ('2027-03-11','Hari Raya Aidilfitri (Hari Kedua)',false),('2027-05-17','Hari Raya Haji',false),('2027-12-25','Hari Krismas',false);
select count(*) filter (where chosen) dipilih, count(*) jumlah from company_holiday_options('00000000-0000-0000-0000-0000000000c1', 2027);
select set_company_holidays('00000000-0000-0000-0000-0000000000c1', 2027,
  array(select id from public_holidays where extract(year from holiday_date) = 2027 and name not like 'Hari Krismas'));
select count(*) filter (where chosen) dipilih from company_holiday_options('00000000-0000-0000-0000-0000000000c1', 2027);
select s->>'workflows' aliran, s->>'automations' automasi, s->>'code' kod from settings_summary('00000000-0000-0000-0000-0000000000c1') s;

\echo '=== S7: akses dari luar ==='
set test.uid='00000000-0000-0000-0000-00000000a005';
select request_company_access('MTB','hr',30,'Bantu proses gaji') is not null as dimohon;
select company_code, role, status from my_access_requests();
set test.uid='00000000-0000-0000-0000-00000000a001';
select name, home_company, role, status from company_external_access('00000000-0000-0000-0000-0000000000c1');
set test.uid='00000000-0000-0000-0000-00000000a002';
select count(*) as hr_bukan_pentadbir from company_external_access('00000000-0000-0000-0000-0000000000c1');
