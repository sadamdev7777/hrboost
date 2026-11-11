\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian laporan bulanan WhatsApp untuk CEO (agregat sahaja) + terjemahan English.
-- Gunakan stub local_only (test.uid / test.role). Jangan jalankan pada Supabase sebenar.

insert into companies(id,code,name) values ('00000000-0000-0000-0000-0000000000c1','MTB','MUSLIMTRAVELBUG SDN BHD');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c1');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,4) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp,ic_no,language) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000a001','SADAM CEO','Sadam','60110000001','800101-14-0001','en'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','HR SATU','Lily','60110000002','900202-14-0002','ms'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','AMIN BIN ALI','Amin','60110000004','950505-14-0004','ms');
insert into employments(id,person_id,company_id,employee_no,status,join_date,end_date) values
 ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','MTB000','active','2019-01-01',null),
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB001','active','2020-01-01',null),
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','MTB003','active','2026-10-05',null);
insert into user_roles(person_id,company_id,role) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','ceo'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr');

-- Gaji Oktober 2026 (diluluskan) & September 2026
insert into payroll_runs(id,company_id,period_year,period_month,status) values
 ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000c1',2026,10,'approved'),
 ('00000000-0000-0000-0000-0000000000f0','00000000-0000-0000-0000-0000000000c1',2026,9,'paid');
insert into payslips(payroll_run_id,employment_id,gross,net,epf_employer,socso_employer,eis_employer) values
 ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000e1',5000,4400,650,87.5,10),
 ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000e2',3000,2700,390,52.5,6),
 ('00000000-0000-0000-0000-0000000000f0','00000000-0000-0000-0000-0000000000e1',5000,4400,650,87.5,10);
-- Cuti tahunan 2 hari & MC 1 hari, Oktober
insert into leave_requests(employment_id,leave_type_id,start_date,end_date,days,status)
 select '00000000-0000-0000-0000-0000000000e2', id, '2026-10-13','2026-10-14',2,'approved' from leave_types where company_id='00000000-0000-0000-0000-0000000000c1' and code='AL';
insert into leave_requests(employment_id,leave_type_id,start_date,end_date,days,status)
 select '00000000-0000-0000-0000-0000000000e4', id, '2026-10-20','2026-10-20',1,'approved' from leave_types where company_id='00000000-0000-0000-0000-0000000000c1' and code='MC';

\echo '=== L1: teks laporan Oktober 2026 ==='
select ceo_monthly_report_text('00000000-0000-0000-0000-0000000000c1','2026-10-15') as teks \gset
\echo :teks
do $$ declare t text := ceo_monthly_report_text('00000000-0000-0000-0000-0000000000c1','2026-10-15'); begin
  assert t like 'Laporan bulanan Oktober 2026:%', 'tajuk';
  assert t like '%• Pekerja: 3 (1 baharu, 0 berhenti)%', 'pekerja';
  assert t like '%• Kos gaji: RM9,196.00 (+60.0% berbanding bulan lepas)%', 'kos gaji';
  assert t like '%• Gaji bersih dibayar: RM7,100.00 kepada 2 pekerja%', 'bersih';
  assert t like '%• Cuti: 2 hari · MC: 1 hari%', 'cuti';
  assert t not like '%Amin%' and t not like '%Lily%', 'tiada nama individu';
end $$;

\echo '=== L2: hantar kepada CEO sahaja, dalam bahasa CEO ==='
select ceo_monthly_report() as dihantar;
select person_id, left(message, 60) as mesej from notifications order by created_at;
do $$ begin
  assert (select count(*) from notifications) = 1, 'satu notifikasi (CEO)';
  assert (select person_id from notifications) = '00000000-0000-0000-0000-000000000001', 'kepada CEO';
end $$;

\echo '=== L3: terjemahan English ==='
select translate_message(ceo_monthly_report_text('00000000-0000-0000-0000-0000000000c1','2026-10-15'), 'en') as en \gset
\echo :en
do $$ declare t text := translate_message(ceo_monthly_report_text('00000000-0000-0000-0000-0000000000c1','2026-10-15'), 'en'); begin
  assert t like 'Monthly report October 2026:%', 'tajuk en';
  assert t like '%• Payroll cost: RM9,196.00 (+60.0% vs last month)%', 'kos en';
  assert t like '%• Leave: 2 days · MC: 1 days%', 'cuti en';
  assert t like '%Details in HRBoost → Reports.%', 'kaki en';
end $$;

\echo '=== L4: pratonton & suis hanya untuk CEO/HR/Pentadbir ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a004';
\set ON_ERROR_STOP 0
select ceo_monthly_report_preview('00000000-0000-0000-0000-0000000000c1');
select set_ceo_monthly_report('00000000-0000-0000-0000-0000000000c1', false);
\set ON_ERROR_STOP 1
set test.uid='00000000-0000-0000-0000-00000000a002';
select set_ceo_monthly_report('00000000-0000-0000-0000-0000000000c1', false);
reset test.uid; reset test.role;
do $$ begin
  assert not (select ceo_monthly_report from companies where id='00000000-0000-0000-0000-0000000000c1'), 'dimatikan';
  assert ceo_monthly_report() = 0, 'tiada hantaran apabila dimatikan';
end $$;

\echo '=== L5: bulan tanpa gaji diluluskan ==='
do $$ declare t text := ceo_monthly_report_text('00000000-0000-0000-0000-0000000000c1','2026-08-15'); begin
  assert t like '%• Gaji bulan ini belum diluluskan%', 'tiada gaji';
  assert translate_message(t, 'en') like '%This month''s payroll is not approved yet%', 'tiada gaji en';
end $$;
