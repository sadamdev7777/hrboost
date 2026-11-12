\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian Fasa F: kiraan berkanun, larian gaji penuh (sediakan → kira → kelulusan Kewangan & CEO
-- → bayar), tuntutan dibayar bersama gaji, slip hanya kelihatan selepas diluluskan, fail eksport.
-- NOTA: kadar dalam statutory_rates mesti disahkan dengan kalkulator rasmi sebelum gaji sebenar.
-- Gunakan stub local_only (test.uid / test.role). Jangan jalankan pada Supabase sebenar tanpa penukaran.

-- ===== SETUP =====
insert into companies(id,code,name,epf_employer_no) values ('00000000-0000-0000-0000-0000000000c1','MTB','MUSLIMTRAVELBUG SDN BHD','E123');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c1');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,9) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp,ic_no,marital_status,spouse_working,children_count,bank_name,bank_account_no) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000a001','CEO','Sadam','60110000001','800101-14-0001',null,null,0,'Maybank','111'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','HR Satu','Lily','60110000002','900202-14-0002',null,null,0,'Maybank','222'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','AMIN BIN ALI','Amin','60110000004','950505-14-0004','bujang',null,0,'CIMB Bank','444'),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-00000000a005','FARAH','Farah','60110000005','920505-14-5555','berkahwin',false,2,'RHB Bank','555'),
 ('00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-00000000a007','WARGA EMAS','Pak Ali','60110000007','600101-14-0007',null,null,0,'BSN','777');
insert into employments(id,person_id,company_id,employee_no,status,join_date,epf_no) values
 ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','MTB000','active','2018-01-01','K1'),
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB001','active','2020-01-01','K2'),
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','MTB003','active','2025-03-01',null),
 ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000c1','MTB004','active','2020-01-01','K5'),
 ('00000000-0000-0000-0000-0000000000e7','00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-0000000000c1','MTB005','active','2027-01-16','K7');
insert into user_roles(person_id,company_id,role) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','ceo'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr'),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000c1','finance');
insert into employment_compensation(employment_id, component_id, amount, effective_from)
select e, (select id from pay_components where company_id='00000000-0000-0000-0000-0000000000c1' and code='BASIC'), a, '2020-01-01'
  from (values ('00000000-0000-0000-0000-0000000000e1'::uuid, 15000), ('00000000-0000-0000-0000-0000000000e2'::uuid, 6000),
               ('00000000-0000-0000-0000-0000000000e4'::uuid, 3000), ('00000000-0000-0000-0000-0000000000e5'::uuid, 6000),
               ('00000000-0000-0000-0000-0000000000e7'::uuid, 3100)) v(e, a);
insert into employment_compensation(employment_id, component_id, amount, effective_from)
values ('00000000-0000-0000-0000-0000000000e4',(select id from pay_components where company_id='00000000-0000-0000-0000-0000000000c1' and code='ALLOWANCE'),200,'2020-01-01');
-- tuntutan Amin yang telah diluluskan
insert into claims(id, employment_id, title, total_amount, status) values
 ('00000000-0000-0000-0000-00000000cc01','00000000-0000-0000-0000-0000000000e4','Grab ke KLIA',131.50,'approved');
-- cuti tanpa gaji Farah 1 hari pada Januari 2027
insert into leave_requests(employment_id, leave_type_id, start_date, end_date, days, status) values
 ('00000000-0000-0000-0000-0000000000e5',(select id from leave_types where company_id='00000000-0000-0000-0000-0000000000c1' and code='UL'),'2027-01-12','2027-01-12',1,'approved');

\echo '=== G1: kadar berkanun (bandingkan dengan jadual rasmi) ==='
set test.role = 'service_role';
select 3000 gaji, e.employee kwsp_pekerja, e.employer kwsp_majikan from stat_epf(3000, 30, '2027-01-31') e;
select 5020 gaji, e.employee kwsp_pekerja, e.employer kwsp_majikan from stat_epf(5020, 30, '2027-01-31') e;
select 3000 gaji, s.employee perkeso_pekerja, s.employer perkeso_majikan from stat_socso_eis('SOCSO', 3000, 30, '2027-01-31') s;
select 3000 gaji, s.employee sip_pekerja, s.employer sip_majikan from stat_socso_eis('EIS', 3000, 30, '2027-01-31') s;
select 9000 gaji, s.employee perkeso_siling from stat_socso_eis('SOCSO', 9000, 30, '2027-01-31') s;
select stat_tax(59000, '2027-01-31') as cukai_59000;
select stat_pcb(1, '2027-01-31', 0, 0, 0, 6000, 660, false, null, 0) as pcb_6000_bujang,
       stat_pcb(1, '2027-01-31', 0, 0, 0, 6000, 660, true, false, 2) as pcb_6000_kahwin_2anak,
       stat_pcb(1, '2027-01-31', 0, 0, 0, 3000, 330, false, null, 0) as pcb_3000;
-- Pertengahan tahun dengan data terkumpul (Jan–Okt): RM12,000 sebulan, bujang → ~RM1,430
select stat_pcb(11, '2027-11-30', 120000, 13200, 14290, 12000, 1320, false, null, 0) as pcb_nov_dengan_terkumpul,
       stat_pcb(11, '2027-11-30', 0, 0, 0, 12000, 1320, false, null, 0) as pcb_nov_tanpa_terkumpul;
do $$ begin
  assert stat_pcb(11, '2027-11-30', 120000, 13200, 14290, 12000, 1320, false, null, 0) between 1420 and 1440;
  assert (select employee from stat_epf(3000, 30, '2027-01-31')) = 330;
  assert (select employer from stat_epf(3000, 30, '2027-01-31')) = 390;
  assert (select employer from stat_epf(5020, 30, '2027-01-31')) = 612;   -- 5,100 × 12% (jalur RM100)
  assert (select employee from stat_socso_eis('SOCSO', 3000, 30, '2027-01-31')) = 14.75;
  assert (select employer from stat_socso_eis('SOCSO', 3000, 30, '2027-01-31')) = 51.65;
  assert (select employee from stat_socso_eis('EIS', 3000, 30, '2027-01-31')) = 5.90;
  assert stat_tax(59000, '2027-01-31') = 2490;
end $$;

\echo '=== G2: sediakan larian Januari 2027 & semakan ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
select p->'summary' ringkasan, p->'checks' semakan, p->>'statutory_ready' kadar_sedia
  from payroll_prepare('00000000-0000-0000-0000-0000000000c1', 2027, 1) p;
select (payroll_prepare('00000000-0000-0000-0000-0000000000c1', 2027, 1))->>'run_id' as run \gset
select payroll_set_adjustment(:'run','00000000-0000-0000-0000-0000000000e4','COMMISSION',500,'Jualan Disember');
\set ON_ERROR_STOP 0
select payroll_set_adjustment(:'run','00000000-0000-0000-0000-0000000000e4','BASIC',99999);
set test.uid='00000000-0000-0000-0000-00000000a004';
select payroll_prepare('00000000-0000-0000-0000-0000000000c1', 2027, 1);
\set ON_ERROR_STOP 1

\echo '=== G3: kira gaji ==='
set test.uid='00000000-0000-0000-0000-00000000a002';
select t->>'headcount' pekerja, t->>'gross' kasar, t->>'net' bersih, t->>'pcb' pcb, t->>'claims' tuntutan from payroll_calculate(:'run') t;
select e.employee_no, s.gross, s.epf_employee, s.epf_employer, s.socso_employee, s.eis_employee, s.pcb, s.net, s.unpaid_leave_days
  from payslips s join employments e on e.id = s.employment_id where s.payroll_run_id = :'run' order by 1;
select l.description, l.kind, l.amount from payslip_lines l join payslips s on s.id = l.payslip_id
 where s.payroll_run_id = :'run' and s.employment_id = '00000000-0000-0000-0000-0000000000e4' order by l.kind, l.description;
do $$ declare s payslips; begin
  select * into s from payslips where employment_id = '00000000-0000-0000-0000-0000000000e4';
  -- Amin: 3000 + 200 elaun + 500 komisen + 131.50 tuntutan; KWSP atas 3,700 (tuntutan dikecualikan)
  assert s.gross = 3831.50, 'kasar Amin';
  assert s.epf_employee = 407, 'KWSP Amin (3,700 × 11%)';
  select * into s from payslips where employment_id = '00000000-0000-0000-0000-0000000000e5';
  assert s.unpaid_leave_days = 1 and s.gross = round(6000 - 6000/26.0, 2), 'Farah: 1 hari cuti tanpa gaji';
  select * into s from payslips where employment_id = '00000000-0000-0000-0000-0000000000e7';
  assert s.epf_employee = 0 and s.eis_employee = 0, 'Pak Ali (≥ 60 tahun): tiada KWSP pekerja / SIP';
  assert s.gross = round(3100 * 16 / 31.0, 2), 'Pak Ali mula 16 Jan: prorata 16/31';
end $$;
select name, note from payroll_differences(:'run');

-- (Keterlihatan slip mengikut RLS diuji pada Supabase tempatan melalui e2e gaji.cjs — stub tidak menguatkuasakan RLS.)

\echo '=== G4: hantar → CEO → Kewangan lulus ==='
set test.uid='00000000-0000-0000-0000-00000000a002';
select (submit_payroll_run(:'run')).status;
set test.uid='00000000-0000-0000-0000-00000000a001';
select approval_act((select t.id from approval_tasks t join payroll_runs r on r.approval_request_id = t.request_id where r.id = :'run' and t.status = 'pending' and t.approver_person_id = (select id from persons where auth_user_id = current_setting('test.uid')::uuid)), 'approve', null) is not null as ceo_lulus;
set test.uid='00000000-0000-0000-0000-00000000a005';
select approval_act((select t.id from approval_tasks t join payroll_runs r on r.approval_request_id = t.request_id where r.id = :'run' and t.status = 'pending' and t.approver_person_id = (select id from persons where auth_user_id = current_setting('test.uid')::uuid)), 'approve', null) is not null as kewangan_lulus;
select status from payroll_runs where id = :'run';
\set ON_ERROR_STOP 0
set test.uid='00000000-0000-0000-0000-00000000a002';
select payroll_calculate(:'run');
\set ON_ERROR_STOP 1

\echo '=== G5: fail eksport & tanda dibayar ==='
select split_part(payroll_export(:'run','bank'), E'\n', 1) as pengepala_bank, array_length(string_to_array(payroll_export(:'run','bank'), E'\n'), 1) - 1 as baris;
select split_part(payroll_export(:'run','epf'), E'\n', 2) as baris_kwsp_pertama;
select payroll_mark_paid(:'run', '2027-01-28') as slip_dihantar;
select status, pay_date from payroll_runs where id = :'run';
select paid_at is not null as tuntutan_dibayar from claims where id = '00000000-0000-0000-0000-00000000cc01';
select count(*) as mesej_slip, bool_and(message not like '%RM%') as tiada_jumlah from notifications where message like 'Slip gaji Januari 2027%';
set test.uid='00000000-0000-0000-0000-00000000a004';
\set ON_ERROR_STOP 0
select payroll_export(:'run','bank');
\set ON_ERROR_STOP 1
