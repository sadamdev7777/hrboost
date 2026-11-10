\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian Borang EA & nama panggilan pukal.
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

update persons set ic_no = '900101-14-5678' where id = '00000000-0000-0000-0000-000000000004';
update employments set tax_no = 'SG1234567890', epf_no = 'K123', socso_no = 'S123' where id = '00000000-0000-0000-0000-0000000000e4';
-- Tahun 2025: Okt (lulus) & Nov (dibayar) + Dis draf (tidak dikira); data terkumpul Jan–Sep daripada sistem lama
insert into payroll_runs(id, company_id, period_year, period_month, status) values
 ('00000000-0000-0000-0000-000000000a10','00000000-0000-0000-0000-0000000000c1',2025,10,'approved'),
 ('00000000-0000-0000-0000-000000000a11','00000000-0000-0000-0000-0000000000c1',2025,11,'paid'),
 ('00000000-0000-0000-0000-000000000a12','00000000-0000-0000-0000-0000000000c1',2025,12,'draft');
insert into payslips(id, payroll_run_id, employment_id, gross, total_deduction, net, epf_employee, epf_employer, socso_employee, socso_employer, eis_employee, eis_employer, pcb, hrdf) values
 ('00000000-0000-0000-0000-000000000b10','00000000-0000-0000-0000-000000000a10','00000000-0000-0000-0000-0000000000e4',3600,0,0,385,0,14.75,0,5.90,0,50,0),
 ('00000000-0000-0000-0000-000000000b11','00000000-0000-0000-0000-000000000a11','00000000-0000-0000-0000-0000000000e4',4300,0,0,385,0,14.75,0,5.90,0,120,0),
 ('00000000-0000-0000-0000-000000000b12','00000000-0000-0000-0000-000000000a12','00000000-0000-0000-0000-0000000000e4',9999,0,0,999,0,9,0,9,0,999,0);
insert into payslip_lines(payslip_id, component_code, description, kind, amount) values
 ('00000000-0000-0000-0000-000000000b10','BASIC','Gaji Pokok','earning',3500),
 ('00000000-0000-0000-0000-000000000b10','CLAIM','Bayaran Balik Tuntutan','earning',100),
 ('00000000-0000-0000-0000-000000000b11','BASIC','Gaji Pokok','earning',3500),
 ('00000000-0000-0000-0000-000000000b11','OT','Kerja Lebih Masa','earning',200),
 ('00000000-0000-0000-0000-000000000b11','COMMISSION','Komisen','earning',800),
 ('00000000-0000-0000-0000-000000000b11','UNPAID','Potongan Cuti Tanpa Gaji','deduction',200),
 ('00000000-0000-0000-0000-000000000b12','BASIC','Gaji Pokok','earning',9999);
insert into payroll_opening_balances(employment_id, year, up_to_month, gross, epf, pcb) values
 ('00000000-0000-0000-0000-0000000000e4', 2025, 9, 31500, 3465, 450);

\echo '=== R1: Borang EA (HR) ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
-- B1a = 31500 (sistem lama) + 3500 + 3500 + 200 - 200 = 38500; B1b = 800; tuntutan RM100 & Dis (draf) tidak dikira
select r->>'full_name' nama, r->>'months' bulan, r->>'b1a' b1a, r->>'b1b' b1b, r->>'total_income' jumlah,
       r->>'pcb' pcb, r->>'epf' kwsp, r->>'socso' perkeso
  from jsonb_array_elements(hr_ea('00000000-0000-0000-0000-0000000000c1', 2025)->'rows') r;
do $$ declare r jsonb := hr_ea('00000000-0000-0000-0000-0000000000c1', 2025)->'rows'->0; begin
  assert (r->>'b1a')::numeric = 38500, 'B1a salah: ' || (r->>'b1a');
  assert (r->>'b1b')::numeric = 800, 'B1b salah';
  assert (r->>'pcb')::numeric = 620, 'PCB salah: ' || (r->>'pcb');
  assert (r->>'epf')::numeric = 4235, 'KWSP salah';
  assert (r->>'socso')::numeric = 41.30, 'PERKESO salah: ' || (r->>'socso');
  assert (r->>'months')::int = 11, 'bulan salah';
end $$;
reset test.role; reset test.uid;
select count(*) > 0 as akses_direkod from data_access_log where resource = 'ea';

\echo '=== R2: pekerja hanya melihat selepas dikeluarkan ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a004';
select my_ea('00000000-0000-0000-0000-0000000000e4', 2025)->>'released' as sebelum;
set test.uid='00000000-0000-0000-0000-00000000a002';
select hr_ea_release('00000000-0000-0000-0000-0000000000c1', 2025) as dihantar;
set test.uid='00000000-0000-0000-0000-00000000a004';
select (my_ea('00000000-0000-0000-0000-0000000000e4', 2025)->'row'->>'b1a') as b1a_pekerja;
\set ON_ERROR_STOP 0
-- pekerja lain / tahun semasa (mesti gagal)
select my_ea('00000000-0000-0000-0000-0000000000e3', 2025);
select hr_ea('00000000-0000-0000-0000-0000000000c1', 2025);
set test.uid='00000000-0000-0000-0000-00000000a002';
select hr_ea_release('00000000-0000-0000-0000-0000000000c1', extract(year from now())::int);
\set ON_ERROR_STOP 1
reset test.role; reset test.uid;
select message ~ '(Borang EA 2025|Your 2025 Form EA)' as whatsapp from notifications where person_id = '00000000-0000-0000-0000-000000000004' order by created_at desc limit 1;

\echo '=== R3: nama panggilan pukal ==='
update persons set preferred_name = null where id in ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005');
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
select hr_todo('00000000-0000-0000-0000-0000000000c1')->>'no_nickname' as tanpa_nama;
select hr_set_preferred_names('00000000-0000-0000-0000-0000000000c1',
  '[{"employment_id":"00000000-0000-0000-0000-0000000000e4","name":"  Amin  "},{"employment_id":"00000000-0000-0000-0000-0000000000e5","name":"Hana"}]') as disimpan;
select hr_todo('00000000-0000-0000-0000-0000000000c1')->>'no_nickname' as selepas;
\set ON_ERROR_STOP 0
select hr_set_preferred_names('00000000-0000-0000-0000-0000000000c1', '[{"employment_id":"00000000-0000-0000-0000-0000000000e4","name":"A"}]');
set test.uid='00000000-0000-0000-0000-00000000a004';
select hr_set_preferred_names('00000000-0000-0000-0000-0000000000c1', '[{"employment_id":"00000000-0000-0000-0000-0000000000e4","name":"Bos"}]');
\set ON_ERROR_STOP 1
reset test.role; reset test.uid;
select preferred_name from persons where id = '00000000-0000-0000-0000-000000000004';
\echo '>>> LULUS: hrboost_tests_r_ea_nama'
