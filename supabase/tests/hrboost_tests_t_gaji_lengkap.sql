\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian enjin gaji lengkap (Fasa 1–3): SKBBK, zakat, CP38, KWSP pekerja asing, PERKESO kategori 2,
-- kadar KWSP pilihan, tunggakan gaji, kitaran tambahan (bonus), buka semula, lepas slip,
-- fail CP39 (panjang rekod), laporan varians, kenyataan PCB, kesediaan maklumat & Borang EA.
-- Gunakan stub local_only (test.uid / test.role). Jangan jalankan pada Supabase sebenar.

insert into companies(id,code,name,epf_employer_no,lhdn_employer_no) values ('00000000-0000-0000-0000-0000000000c1','MTB','MUSLIMTRAVELBUG SDN BHD','E123','E 1234567-08');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c1');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,9) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp,ic_no,nationality,passport_no,marital_status,children_count,bank_name,bank_account_no) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000a001','CEO','Sadam','60110000001','800101-14-0001','MY',null,null,0,'Maybank','111'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','HR SATU','Lily','60110000002','900202-14-0002','MY',null,null,0,'Maybank','222'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000a003','KEWANGAN','Zul','60110000003','900303-14-0003','MY',null,null,0,'Maybank','333'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','AMIN BIN ALI','Amin','60110000004','950505-14-0004','MY',null,'bujang',0,'CIMB Bank','444'),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-00000000a005','RAHUL KUMAR','Rahul','60110000005',null,'IN','P1234567','bujang',0,'RHB Bank','555'),
 ('00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-00000000a007','WARGA EMAS','Pak Ali','60110000007','600101-14-0007','MY',null,null,0,'BSN','777');
insert into employments(id,person_id,company_id,employee_no,status,join_date,epf_no,tax_no) values
 ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','MTB000','active','2018-01-01','K1','SG111'),
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB001','active','2020-01-01','K2','SG222'),
 ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1','MTB002','active','2020-01-01','K3','SG333'),
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','MTB003','active','2025-03-01','K4','SG4444'),
 ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000c1','MTB004','active','2025-01-01','K5','SG555'),
 ('00000000-0000-0000-0000-0000000000e7','00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-0000000000c1','MTB005','active','2020-01-01','K7',null);
insert into user_roles(person_id,company_id,role) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','ceo'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1','finance');
insert into employment_compensation(employment_id, component_id, amount, effective_from)
select e, (select id from pay_components where company_id='00000000-0000-0000-0000-0000000000c1' and code='BASIC'), a, '2020-01-01'
  from (values ('00000000-0000-0000-0000-0000000000e1'::uuid, 15000), ('00000000-0000-0000-0000-0000000000e2'::uuid, 6000),
               ('00000000-0000-0000-0000-0000000000e3'::uuid, 5000), ('00000000-0000-0000-0000-0000000000e4'::uuid, 3000),
               ('00000000-0000-0000-0000-0000000000e5'::uuid, 3800), ('00000000-0000-0000-0000-0000000000e7'::uuid, 3000)) v(e, a);

\echo '=== T1: katalog item & kesediaan maklumat ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
do $$ begin
  assert (select count(*) from pay_components where company_id='00000000-0000-0000-0000-0000000000c1' and code in ('BONUS','ARREARS','BIK_CAR','ZAKAT','PTPTN')) >= 4, 'katalog lalai';
  assert (select ea_field from pay_components where company_id='00000000-0000-0000-0000-0000000000c1' and code='BIK_CAR') = 'B3', 'BIK → B3';
  assert not (select in_table from pay_components where company_id='00000000-0000-0000-0000-0000000000c1' and code='BONUS'), 'katalog tidak jadi lajur jadual';
end $$;
select hr_save_pay_component('00000000-0000-0000-0000-0000000000c1', null, '{"name":"Elaun Syif Malam","kind":"earning","taxable":true,"epf":true,"socso":true}'::jsonb) as kod_baharu;
select (select ea_field from pay_components where company_id='00000000-0000-0000-0000-0000000000c1' and name='Elaun Syif Malam') as medan_ea_lalai;
select e.employee_no, r.missing from payroll_readiness('00000000-0000-0000-0000-0000000000c1') r join employments e on e.id = r.employment_id order by 1;
do $$ begin
  assert exists (select 1 from payroll_readiness('00000000-0000-0000-0000-0000000000c1') where employment_id = '00000000-0000-0000-0000-0000000000e7'), 'Pak Ali tiada no. cukai → tidak lengkap';
end $$;

\echo '=== T2: tetapan gaji & maklumat berkanun pekerja ==='
select hr_set_payroll_settings('00000000-0000-0000-0000-0000000000c1', '{"lhdn_employer_no":"E 1234567-08","payday":28,"prorate_basis":"calendar","signatory_name":"Sadam"}'::jsonb);
insert into employment_statutory(employment_id, zakat_monthly, cp38_monthly, cp38_until) values ('00000000-0000-0000-0000-0000000000e4', 50, 100, '2027-12-31');
insert into employment_statutory(employment_id, epf_category, socso_category) values ('00000000-0000-0000-0000-0000000000e5', 'foreign', 'foreign');
insert into employment_statutory(employment_id, epf_employee_rate) values ('00000000-0000-0000-0000-0000000000e3', 9);

\echo '=== T3: gaji Januari 2027 ==='
select (payroll_prepare('00000000-0000-0000-0000-0000000000c1', 2027, 1))->>'run_id' as jan \gset
select payroll_calculate(:'jan') is not null as dikira;
select e.employee_no, s.gross, s.epf_employee, s.epf_employer, s.socso_employee, s.socso_employer, s.eis_employee, s.skbbk_employee, s.pcb, s.zakat, s.cp38, s.net
  from payslips s join employments e on e.id = s.employment_id where s.payroll_run_id = :'jan' order by 1;
do $$ declare a payslips; f payslips; k payslips; z payslips; begin
  select * into a from payslips where employment_id = '00000000-0000-0000-0000-0000000000e4';
  select * into f from payslips where employment_id = '00000000-0000-0000-0000-0000000000e5';
  select * into k from payslips where employment_id = '00000000-0000-0000-0000-0000000000e7';
  select * into z from payslips where employment_id = '00000000-0000-0000-0000-0000000000e3';
  assert a.skbbk_employee = 22.15, 'SKBBK RM3,000 = 22.15 (0.75% × 2,950, ganjil)';
  assert a.zakat = 50 and a.cp38 = 100, 'zakat & CP38 dipotong';
  assert a.socso_employee = 14.75 and a.socso_employer = 51.65, 'PERKESO kategori 1';
  assert f.epf_employee = 76 and f.epf_employer = 76, 'KWSP pekerja asing 2%/2%';
  assert f.eis_employee = 0, 'pekerja asing tiada SIP';
  assert k.socso_employee = 0 and k.socso_employer = 36.90, 'PERKESO kategori 2 (60+) = K1 majikan − K1 pekerja';
  assert k.epf_employee = 0, 'KWSP pekerja 60+ = 0';
  assert z.epf_employee = 450, 'kadar KWSP pekerja pilihan 9%';
  assert a.net = a.gross - a.epf_employee - a.socso_employee - a.eis_employee - a.skbbk_employee - a.pcb - a.zakat - a.cp38, 'bersih';
end $$;
set test.uid='00000000-0000-0000-0000-00000000a002';
select (submit_payroll_run(:'jan')).status;
set test.uid='00000000-0000-0000-0000-00000000a001';
select (approval_act((select t.id from approval_tasks t join payroll_runs r on r.approval_request_id = t.request_id where r.id = :'jan' and t.status = 'pending' and t.approver_person_id = (select id from persons where auth_user_id = current_setting('test.uid')::uuid)), 'approve', null)).status as ceo;
set test.uid='00000000-0000-0000-0000-00000000a003';
select (approval_act((select t.id from approval_tasks t join payroll_runs r on r.approval_request_id = t.request_id where r.id = :'jan' and t.status = 'pending' and t.approver_person_id = (select id from persons where auth_user_id = current_setting('test.uid')::uuid)), 'approve', null)).status as kewangan;
select status, payslip_release_at is null as slip_belum_dilepas from payroll_runs where id = :'jan';

\echo '=== T4: fail berkanun ==='
set test.uid='00000000-0000-0000-0000-00000000a002';
select payroll_set_receipt(:'jan', 'RCP-2027-01');
do $$ declare t text; baris text[]; b text; begin
  t := payroll_export((select id from payroll_runs where period_month = 1), 'pcb_txt');
  baris := string_to_array(t, E'\r\n');
  assert length(baris[1]) = 57, 'CP39 H = 57 aksara: ' || length(baris[1]);
  foreach b in array baris[2:] loop assert length(b) = 136, 'CP39 D = 136 aksara: ' || length(b); end loop;
  assert t like '%P1234567%', 'pekerja asing: pasport dalam CP39';
  assert array_length(string_to_array(payroll_export((select id from payroll_runs where period_month = 1), 'socso_txt'), E'\n'), 1) >= 5, 'fail gabungan PERKESO';
  assert payroll_export((select id from payroll_runs where period_month = 1), 'gl') like '%Kredit%' or payroll_export((select id from payroll_runs where period_month = 1), 'gl') like '%credit%', 'jurnal GL';
end $$;
select split_part(payroll_export(:'jan','pcb_txt'), E'\r\n', 1) as cp39_h;
select split_part(payroll_export(:'jan','gl'), E'\n', 1) as gl_pengepala;
do $$ declare dr numeric; cr numeric; begin
  select sum(split_part(x, ',', 4)::numeric), sum(split_part(x, ',', 5)::numeric) into dr, cr
    from unnest((string_to_array(payroll_export((select id from payroll_runs where period_month = 1), 'gl'), E'\n'))[2:]) x;
  assert dr = cr and dr > 0, format('jurnal GL seimbang: debit %s, kredit %s', dr, cr);
end $$;

\echo '=== T5: lepas slip, buka semula ==='
select payroll_release_payslips(:'jan', null);
select payslip_release_at is not null as dilepas from payroll_runs where id = :'jan';
select payroll_unrelease_payslips(:'jan');
\set ON_ERROR_STOP 0
select payroll_reopen(:'jan', '');
\set ON_ERROR_STOP 1
select payroll_reopen(:'jan', 'Silap elaun');
select status from payroll_runs where id = :'jan';
select payroll_calculate(:'jan') is not null as dikira_semula;
select (submit_payroll_run(:'jan')).status;
set test.uid='00000000-0000-0000-0000-00000000a001';
select (approval_act((select t.id from approval_tasks t join payroll_runs r on r.approval_request_id = t.request_id where r.id = :'jan' and t.status = 'pending' and t.approver_person_id = (select id from persons where auth_user_id = current_setting('test.uid')::uuid)), 'approve', null)).status as ceo;
set test.uid='00000000-0000-0000-0000-00000000a003';
select (approval_act((select t.id from approval_tasks t join payroll_runs r on r.approval_request_id = t.request_id where r.id = :'jan' and t.status = 'pending' and t.approver_person_id = (select id from persons where auth_user_id = current_setting('test.uid')::uuid)), 'approve', null)).status as kewangan;
select array_agg(action order by at) as sejarah from payroll_run_events where run_id = :'jan';

\echo '=== T6: Februari — tunggakan gaji (kenaikan berkuat kuasa 1 Jan) & varians ==='
set test.role = 'service_role';
update employment_compensation set effective_to = '2026-12-31'
 where employment_id = '00000000-0000-0000-0000-0000000000e4' and component_id = (select id from pay_components where company_id='00000000-0000-0000-0000-0000000000c1' and code='BASIC');
insert into employment_compensation(employment_id, component_id, amount, effective_from)
values ('00000000-0000-0000-0000-0000000000e4', (select id from pay_components where company_id='00000000-0000-0000-0000-0000000000c1' and code='BASIC'), 3300, '2027-01-01');
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
select (payroll_prepare('00000000-0000-0000-0000-0000000000c1', 2027, 2))->>'run_id' as feb \gset
select payroll_set_adjustment(:'feb', '00000000-0000-0000-0000-0000000000e2', 'TRAVEL_DUTY', 250, 'Elaun luar kawasan Johor');
select payroll_calculate(:'feb') is not null as dikira;
select l.description, l.amount, l.ref_month from payslip_lines l join payslips s on s.id = l.payslip_id
 where s.payroll_run_id = :'feb' and l.kind = 'earning' order by 1;
do $$ begin
  assert (select l.amount from payslip_lines l join payslips s on s.id = l.payslip_id
           where s.employment_id = '00000000-0000-0000-0000-0000000000e4' and l.component_code = 'ARREARS'
             and s.payroll_run_id = (select id from payroll_runs where period_month = 2)) = 300, 'tunggakan Jan RM300';
  assert exists (select 1 from payslip_lines l join payslips s on s.id = l.payslip_id where l.description like '%: Elaun luar kawasan Johor'), 'item sekali dengan nota';
end $$;
select name, prev_gross, gross, status, note from payroll_variance(:'feb') order by name;

\echo '=== T7: kitaran tambahan (bonus) ==='
\set ON_ERROR_STOP 0
select payroll_add_cycle('00000000-0000-0000-0000-0000000000c1', 2027, 2, ' ');
\set ON_ERROR_STOP 1
select payroll_add_cycle('00000000-0000-0000-0000-0000000000c1', 2027, 2, 'Bonus Tahunan') as bonus \gset
select payroll_set_adjustment(:'bonus', '00000000-0000-0000-0000-0000000000e4', 'BONUS', 3000, 'Bonus prestasi 2026');
select payroll_calculate(:'bonus') is not null as dikira;
select e.employee_no, s.gross, s.epf_employee, s.socso_employee, s.pcb, s.net from payslips s join employments e on e.id = s.employment_id where s.payroll_run_id = :'bonus';
do $$ declare b payslips; begin
  select * into b from payslips where payroll_run_id = (select id from payroll_runs where kind = 'additional');
  assert (select count(*) from payslips where payroll_run_id = (select id from payroll_runs where kind = 'additional')) = 1, 'hanya pekerja dengan bonus';
  assert b.gross = 3000, 'kasar bonus';
  assert b.socso_employee = 0 and b.eis_employee = 0, 'bonus tiada PERKESO/SIP';
  assert b.epf_employee > 0, 'KWSP atas bonus';
  assert b.pcb > 0, 'PCB saraan tambahan';
end $$;

\echo '=== T8: kenyataan PCB (PCB II) & Borang EA ==='
select * from pcb_statement('00000000-0000-0000-0000-0000000000e4', 2027);
select j->'b1a' b1a, j->'b1b' b1b, j->'b2' b2, j->'zakat' zakat, j->'cp38' cp38
  from jsonb_array_elements(ea_compute('00000000-0000-0000-0000-0000000000c1', 2027, '00000000-0000-0000-0000-0000000000e4')) j;
do $$ begin
  assert (select count(*) from pcb_statement('00000000-0000-0000-0000-0000000000e4', 2027) where receipt_no = 'RCP-2027-01') = 1, 'no. resit PCB';
end $$;

\echo '=== T9: kebenaran ==='
set test.uid='00000000-0000-0000-0000-00000000a004';
\set ON_ERROR_STOP 0
select payroll_add_cycle('00000000-0000-0000-0000-0000000000c1', 2027, 3, 'X');
select payroll_reopen(:'jan', 'cuba');
select hr_set_payroll_settings('00000000-0000-0000-0000-0000000000c1', '{"payday":1}'::jsonb);
\set ON_ERROR_STOP 1

\echo '=== Buka semula gaji yang sedang menunggu kelulusan (tarik balik) ==='
reset test.uid; reset test.role;
do $$ declare r uuid; req uuid; begin
  select id into r from payroll_runs where status = 'calculated' order by created_at desc limit 1;
  if r is null then raise notice 'tiada gaji dikira — langkau'; return; end if;
  perform set_config('test.uid', (select p.auth_user_id::text from persons p join user_roles ur on ur.person_id = p.id
                                    where ur.role = 'hr' and p.auth_user_id is not null limit 1), true);
  perform set_config('test.role', 'authenticated', true);
  perform submit_payroll_run(r);
  select approval_request_id into req from payroll_runs where id = r;
  assert (select status from payroll_runs where id = r) = 'pending', 'menunggu kelulusan';
  perform payroll_reopen(r, 'Silap jumlah');
  assert (select status from payroll_runs where id = r) = 'calculated', 'kembali ke langkah 2';
  assert (select status from approval_requests where id = req) = 'cancelled', 'permohonan dibatalkan';
  assert not exists (select 1 from approval_tasks where request_id = req and status = 'pending'), 'tiada tugasan pelulus tertinggal';
end $$;
