\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian QuickBooks: keadaan OAuth, kelayakan (sandaran tanpa Vault), baris gilir, data Bill & jurnal gaji seimbang.
-- Gunakan stub local_only (test.uid / test.role). Jangan jalankan pada Supabase sebenar.

insert into companies(id,code,name,accounting_system) values ('00000000-0000-0000-0000-0000000000c1','MTB','MUSLIMTRAVELBUG SDN BHD','quickbooks');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c1');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,5) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp,ic_no) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','HR SATU','Lily','60110000002','900202-14-0002'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','AMIN BIN ALI','Amin','60110000004','950505-14-0004'),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-00000000a005','NADIA KEWANGAN','Nadia','60110000005','910101-14-0005');
insert into employments(id,person_id,company_id,employee_no,status,join_date) values
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB001','active','2020-01-01'),
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','MTB003','active','2025-03-01'),
 ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000c1','MTB005','active','2021-01-01');
insert into user_roles(person_id,company_id,role) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr'),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000c1','finance');

\echo '=== Q1: hanya Kewangan/Pentadbir boleh memulakan sambungan ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a004';
\set ON_ERROR_STOP 0
select qbo_connect_start('00000000-0000-0000-0000-0000000000c1');
\set ON_ERROR_STOP 1
set test.uid='00000000-0000-0000-0000-00000000a005';
create temp table _st as select qbo_connect_start('00000000-0000-0000-0000-0000000000c1') as st;
reset test.uid; reset test.role;
do $$ begin
  assert qbo_connect_finish((select st from _st)) = '00000000-0000-0000-0000-0000000000c1', 'state sah';
  begin
    perform qbo_connect_finish((select st from _st));
    assert false, 'state sekali guna sahaja';
  exception when assert_failure then raise; when others then null;
  end;
end $$;

\echo '=== Q2: kelayakan disimpan & dibaca (tanpa didedahkan kepada pengguna) ==='
select integration_secret_set('00000000-0000-0000-0000-0000000000c1','quickbooks','{"realm_id":"123","refresh_token":"r1"}');
select integration_secret_set('00000000-0000-0000-0000-0000000000c1','quickbooks','{"realm_id":"123","refresh_token":"r2"}');
do $$ begin
  assert integration_secret_get('00000000-0000-0000-0000-0000000000c1','quickbooks')::jsonb->>'refresh_token' = 'r2', 'token diputar';
end $$;
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
select qbo_status('00000000-0000-0000-0000-0000000000c1') as status;
do $$ begin
  assert (qbo_status('00000000-0000-0000-0000-0000000000c1')->>'connected')::boolean, 'tersambung';
  assert qbo_status('00000000-0000-0000-0000-0000000000c1')::text not like '%r2%', 'token tidak didedahkan';
end $$;
set test.uid='00000000-0000-0000-0000-00000000a004';
do $$ begin assert qbo_status('00000000-0000-0000-0000-0000000000c1') is null, 'pekerja biasa tiada status'; end $$;
reset test.uid; reset test.role;
do $$ begin
  assert not has_function_privilege('authenticated','integration_secret_get(uuid,text)','execute'), 'rahsia tertutup';
end $$;

\echo '=== Q3: data Bill tuntutan ==='
insert into claims(id,employment_id,title,total_amount,status) values
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000e4','Tuntutan Nov',150.50,'approved');
insert into claim_items(claim_id,claim_type_id,expense_date,description,amount)
 select '00000000-0000-0000-0000-0000000000a1', id, '2026-11-02', 'Tol KL-Ipoh', 150.50 from claim_types where company_id='00000000-0000-0000-0000-0000000000c1' limit 1;
update claim_types set account_ref = '6100' where company_id='00000000-0000-0000-0000-0000000000c1';
select accounting_claim_bill('00000000-0000-0000-0000-0000000000a1') as bill;
do $$ declare b jsonb := accounting_claim_bill('00000000-0000-0000-0000-0000000000a1'); begin
  assert b->>'vendor_name' = 'AMIN BIN ALI (MTB003)', 'pembekal';
  assert (b->'lines'->0->>'amount')::numeric = 150.50 and b->'lines'->0->>'account' = '6100', 'baris';
end $$;

\echo '=== Q4: jurnal gaji seimbang ==='
insert into payroll_runs(id,company_id,period_year,period_month,status) values ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000c1',2026,10,'approved');
insert into payslips(id,payroll_run_id,employment_id,gross,net,epf_employee,epf_employer,socso_employee,socso_employer,eis_employee,eis_employer,pcb) values
 ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000e4',3000,2601.75,330,390,14.75,52.5,5.9,5.9,47.6);
insert into payslip_lines(payslip_id,component_code,description,kind,amount) values
 ('00000000-0000-0000-0000-0000000000b1','BASIC','Gaji pokok','earning',3000),
 ('00000000-0000-0000-0000-0000000000b1','EPF','KWSP','deduction',330),
 ('00000000-0000-0000-0000-0000000000b1','SOCSO','PERKESO','deduction',14.75),
 ('00000000-0000-0000-0000-0000000000b1','EIS','SIP','deduction',5.9),
 ('00000000-0000-0000-0000-0000000000b1','PCB','PCB','deduction',47.6),
 ('00000000-0000-0000-0000-0000000000b1','EPF_ER','KWSP','employer',390),
 ('00000000-0000-0000-0000-0000000000b1','SOCSO_ER','PERKESO','employer',52.5),
 ('00000000-0000-0000-0000-0000000000b1','EIS_ER','SIP','employer',5.9);
select l->>'account' akaun, l->>'debit' dr, l->>'credit' cr from jsonb_array_elements(accounting_payroll_journal('00000000-0000-0000-0000-0000000000f1')->'lines') l;
do $$ declare j jsonb := accounting_payroll_journal('00000000-0000-0000-0000-0000000000f1'); begin
  assert (select sum((l->>'debit')::numeric) from jsonb_array_elements(j->'lines') l)
       = (select sum((l->>'credit')::numeric) from jsonb_array_elements(j->'lines') l), 'jurnal seimbang';
  assert j->>'doc_number' = 'HRB-202610-1', 'no. dokumen';
end $$;

\echo '=== Q5: baris gilir — ambil, gagal, cuba semula, berjaya ==='
insert into accounting_sync_queue(company_id,system,entity_type,entity_id) values
 ('00000000-0000-0000-0000-0000000000c1','quickbooks','claim','00000000-0000-0000-0000-0000000000a1'),
 ('00000000-0000-0000-0000-0000000000c1','quickbooks','payroll_run','00000000-0000-0000-0000-0000000000f1');
select count(*) as diambil from accounting_queue_next(10);
select accounting_queue_done(id, false, null, 'Akaun "6100" tidak dijumpai') from accounting_sync_queue where entity_type='claim';
select accounting_queue_done(id, true, '145', null) from accounting_sync_queue where entity_type='payroll_run';
do $$ begin
  assert (select status from accounting_sync_queue where entity_type='payroll_run') = 'success', 'gaji disegerak';
  assert (select status from accounting_sync_queue where entity_type='claim') = 'failed', 'tuntutan gagal';
  assert (select count(*) from accounting_queue_next(10)) = 1, 'yang gagal dicuba semula';
end $$;
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a005';
select accounting_retry('00000000-0000-0000-0000-0000000000c1') as cuba_semula;
reset test.uid; reset test.role;
do $$ begin
  assert (select status from accounting_sync_queue where entity_type='claim') = 'pending', 'kembali menunggu';
end $$;
