\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian kawalan PCB (selepas gaji November 2026 keluar dengan PCB RM0 kerana data terkumpul Jan–Okt tiada):
--  P1. Jadual kes stat_pcb2 (disemak manual dengan jadual cukai LHDN 2025)
--  P2. Notis PCB: gaji mula tertakluk PCB (hr_set_pay) → HR, Kewangan & pekerja dimaklumkan sekali sahaja
--  P3. Semakan PCB gaji November tanpa data terkumpul: pekerja ditanda (YTD tiada / PCB RM0)
--  P4. Hantar & lulus disekat sehingga setiap pekerja diberi sebab; sebab direkod (log audit)
--  P5. Data terkumpul diisi → PCB betul, tiada tanda
--  P6. Data cukai tidak lengkap (Papan Pemuka HR) & orientasi: status pekerjaan pasangan wajib
-- Gunakan stub local_only (test.uid / test.role). Jangan jalankan pada Supabase sebenar.

-- ===== SETUP =====
insert into companies(id,code,name,epf_employer_no) values ('00000000-0000-0000-0000-0000000000c1','MTB','MUSLIMTRAVELBUG SDN BHD','E123');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c1');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,9) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp,ic_no,marital_status,spouse_working,children_count,bank_name,bank_account_no) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000a001','SADAM BIN CEO','Sadam','60110000001','800101-14-0001','berkahwin',null,3,'Maybank','111'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','LILY BINTI HR','Lily','60110000002','900202-14-0002',null,null,0,'Maybank','222'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000a003','FARAH BINTI KEWANGAN','Farah','60110000003','920303-14-0003','berkahwin',false,2,'RHB Bank','333'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','AMIN BIN ALI','Amin','60110000004','950505-14-0004','bujang',null,0,'CIMB Bank','444'),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-00000000a005','BADRUL BIN BAKAR','Badrul','60110000005','960606-14-0005','bujang',null,0,'CIMB Bank','555'),
 ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-00000000a006','CHE NAH BINTI BARU','Che Nah','60110000006','970707-14-0006','bujang',null,0,'CIMB Bank','666'),
 ('00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-00000000a007','DANIAL BIN DATA','Danial','60110000007','980808-14-0007','bujang',null,0,'CIMB Bank','777');
update persons set language = 'ms';
insert into employments(id,person_id,company_id,employee_no,status,join_date,epf_no) values
 ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','MTB001','active','2018-01-01','K1'),
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB002','active','2020-01-01','K2'),
 ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1','MTB003','active','2020-01-01','K3'),
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','MTB004','active','2020-01-01','K4'),
 ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000c1','MTB005','active','2020-01-01','K5'),
 ('00000000-0000-0000-0000-0000000000e6','00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-0000000000c1','MTB006','active','2026-11-01','K6'),
 ('00000000-0000-0000-0000-0000000000e7','00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-0000000000c1','MTB007','active','2021-01-01','K7');
insert into user_roles(person_id,company_id,role) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','ceo'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1','finance');
-- Gaji asal diimport (tiada pengguna log masuk → tiada notis)
insert into employment_compensation(employment_id, component_id, amount, effective_from)
select e, (select id from pay_components where company_id='00000000-0000-0000-0000-0000000000c1' and code='BASIC'), a, '2020-01-01'
  from (values ('00000000-0000-0000-0000-0000000000e1'::uuid, 15700), ('00000000-0000-0000-0000-0000000000e2'::uuid, 3000),
               ('00000000-0000-0000-0000-0000000000e3'::uuid, 3000), ('00000000-0000-0000-0000-0000000000e4'::uuid, 5000),
               ('00000000-0000-0000-0000-0000000000e5'::uuid, 3500), ('00000000-0000-0000-0000-0000000000e6'::uuid, 5000),
               ('00000000-0000-0000-0000-0000000000e7'::uuid, 5000)) v(e, a);

\echo '=== P1: jadual kes stat_pcb2 ==='
set test.role = 'service_role';
select stat_pcb2(1, '2026-01-31', 0, 0, 0, 3500, 385, false, null, 0, 0, 0, 0, 0, 0, true) bujang_3500,
       stat_pcb2(1, '2026-01-31', 0, 0, 0, 5000, 550, false, null, 0, 0, 0, 0, 0, 0, true) bujang_5000,
       stat_pcb2(1, '2026-01-31', 0, 0, 0, 5000, 550, true, true, 2, 0, 0, 0, 0, 0, true) kahwin_2anak_pasangan_kerja,
       stat_pcb2(1, '2026-01-31', 0, 0, 0, 5000, 550, true, false, 2, 0, 0, 0, 0, 0, true) kahwin_2anak_pasangan_tak_kerja,
       stat_pcb2(11, '2026-11-30', 50000, 5500, 1100, 5000, 550, false, null, 0, 0, 0, 0, 0, 0, true) nov_dengan_ytd,
       stat_pcb2(11, '2026-11-30', 0, 0, 0, 5000, 550, false, null, 0, 0, 0, 0, 0, 0, true) nov_tanpa_ytd;
do $$ begin
  -- Cukai setahun 420 − rebat 400 = 20 → 1.67 sebulan < minimum RM10 → 0
  assert stat_pcb2(1, '2026-01-31', 0, 0, 0, 3500, 385, false, null, 0, 0, 0, 0, 0, 0, true) = 0, 'bujang 3,500';
  -- 60,000 − 4,000 KWSP − 9,000 diri = 47,000 → 1,320 → 110
  assert stat_pcb2(1, '2026-01-31', 0, 0, 0, 5000, 550, false, null, 0, 0, 0, 0, 0, 0, true) = 110, 'bujang 5,000';
  -- 47,000 − 4,000 anak = 43,000 → 1,080 → 90
  assert stat_pcb2(1, '2026-01-31', 0, 0, 0, 5000, 550, true, true, 2, 0, 0, 0, 0, 0, true) = 90, 'berkahwin 2 anak, pasangan bekerja';
  -- 43,000 − 4,000 pasangan = 39,000 → 840 → 70
  assert stat_pcb2(1, '2026-01-31', 0, 0, 0, 5000, 550, true, false, 2, 0, 0, 0, 0, 0, true) = 70, 'berkahwin 2 anak, pasangan tidak bekerja';
  -- November dengan data terkumpul Jan–Okt = sama seperti sebulan biasa; tanpa data terkumpul = 0 (punca insiden)
  assert stat_pcb2(11, '2026-11-30', 50000, 5500, 1100, 5000, 550, false, null, 0, 0, 0, 0, 0, 0, true) = 110, 'November dengan YTD';
  assert stat_pcb2(11, '2026-11-30', 0, 0, 0, 5000, 550, false, null, 0, 0, 0, 0, 0, 0, true) = 0, 'November tanpa YTD';
  assert stat_pcb2(1, '2026-01-31', 0, 0, 0, 15700, 1727, true, null, 3, 0, 0, 0, 0, 0, true) > 2000, 'MTB001 RM15,700';
end $$;

\echo '=== P2: notis PCB apabila gaji mula tertakluk PCB ==='
-- Keadaan awal direkod tanpa notis (import)
do $$ begin
  assert (select count(*) from notifications where message like 'Perhatian:%') = 0, 'import tidak menghantar notis';
  assert (select liable from pcb_liability_state where employment_id = '00000000-0000-0000-0000-0000000000e4'), 'Amin RM5,000 tertakluk';
  assert not (select liable from pcb_liability_state where employment_id = '00000000-0000-0000-0000-0000000000e5'), 'Badrul RM3,500 tidak tertakluk';
end $$;
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
-- Badrul naik gaji 3,500 → 5,000 (berkuat kuasa 1 Dis): kini tertakluk
select hr_set_pay('00000000-0000-0000-0000-0000000000e5', '{"BASIC": 5000}', '2026-12-01');
select person_id = '00000000-0000-0000-0000-000000000005' as kepada_pekerja, left(message, 120) mesej
  from notifications where message ilike '%Badrul%' or message like 'Gaji anda kini tertakluk%' order by 1;
do $$ begin
  assert (select count(*) from notifications where message =
    'Perhatian: Badrul (MTB005) kini tertakluk kepada Potongan Cukai Bulanan (PCB) berdasarkan gaji terkini. Sila pastikan maklumat cukai (status perkahwinan, bilangan anak dan status pekerjaan pasangan) adalah lengkap sebelum payroll diproses.') = 2,
    'HR (Lily) & Kewangan (Farah) dimaklumkan dengan teks tepat';
  assert (select count(*) from notifications where person_id = '00000000-0000-0000-0000-000000000002' and message like 'Perhatian: Badrul%') = 1, 'Lily';
  assert (select count(*) from notifications where person_id = '00000000-0000-0000-0000-000000000003' and message like 'Perhatian: Badrul%') = 1, 'Farah';
  assert (select count(*) from notifications where person_id = '00000000-0000-0000-0000-000000000005' and message like 'Gaji anda kini tertakluk kepada Potongan Cukai Bulanan (PCB).%TP1%') = 1, 'Badrul dimaklumkan & diminta TP1';
end $$;
-- Naik lagi: masih tertakluk → tiada notis baharu
select hr_set_pay('00000000-0000-0000-0000-0000000000e5', '{"BASIC": 5200}', '2026-12-01');
-- Gaji Lily 3,000 → 3,200: masih tidak tertakluk → tiada notis
select hr_set_pay('00000000-0000-0000-0000-0000000000e2', '{"BASIC": 3200}', '2026-12-01');
do $$ begin
  assert (select count(*) from notifications where message like 'Perhatian: Badrul%') = 2, 'notis sekali sahaja bagi setiap peralihan';
  assert (select count(*) from notifications where message like 'Perhatian: Lily%') = 0, 'gaji tidak tertakluk: tiada notis';
end $$;
-- Mesej diterjemah untuk penerima berbahasa Inggeris
update persons set language = 'en' where id = '00000000-0000-0000-0000-000000000003';
select hr_set_pay('00000000-0000-0000-0000-0000000000e2', '{"BASIC": 6000}', '2026-12-01');
select message en from notifications where person_id = '00000000-0000-0000-0000-000000000003' and message like '%Lily (MTB002)%';
do $$ begin
  assert (select message from notifications where person_id = '00000000-0000-0000-0000-000000000003' and message like '%Lily (MTB002)%')
    = 'Attention: Lily (MTB002) is now subject to Monthly Tax Deduction (PCB) based on the latest salary. Please make sure the tax details (marital status, number of children and spouse employment status) are complete before payroll is processed.',
    'terjemahan English';
end $$;
-- (Kenaikan berkuat kuasa Disember: gaji November dikira dengan gaji asal)

\echo '=== P3: gaji November 2026 tanpa data terkumpul ==='
select (payroll_prepare('00000000-0000-0000-0000-0000000000c1', 2026, 11))->>'run_id' as run \gset
select set_payroll_opening('00000000-0000-0000-0000-0000000000e7', 2026, 10, 50000, 5500, 1100);
select payroll_calculate(:'run') is not null as dikira;
select e.employee_no, s.gross, s.pcb from payslips s join employments e on e.id = s.employment_id where s.payroll_run_id = :'run' order by 1;
select employee_no, gross, pcb, annual_pcb, missing_months, kinds, reason from payroll_pcb_flags(:'run');
do $$
declare r uuid := (select id from payroll_runs where period_year = 2026 and period_month = 11);
begin
  -- Punca insiden dihasilkan semula: PCB RM0 walaupun gaji RM5,000 / RM15,700
  assert (select pcb from payslips where payroll_run_id = r and employment_id = '00000000-0000-0000-0000-0000000000e4') = 0, 'Amin PCB 0 tanpa YTD';
  assert (select pcb from payslips where payroll_run_id = r and employment_id = '00000000-0000-0000-0000-0000000000e7') = 110, 'Danial dengan YTD: PCB 110';
  -- Ditanda
  assert (select kinds from payroll_pcb_flags(r) where employee_no = 'MTB004') = '{ytd,pcb0}', 'Amin: YTD tiada & PCB RM0';
  assert (select missing_months from payroll_pcb_flags(r) where employee_no = 'MTB004') = '{1,2,3,4,5,6,7,8,9,10}', 'Amin: Jan–Okt';
  assert (select annual_pcb from payroll_pcb_flags(r) where employee_no = 'MTB004') = 110, 'Amin: anggaran PCB setahun 110';
  assert (select kinds from payroll_pcb_flags(r) where employee_no = 'MTB001') @> '{pcb0}', 'MTB001 RM15,700 PCB 0 ditanda';
  assert (select kinds from payroll_pcb_flags(r) where employee_no = 'MTB005') = '{ytd}', 'Badrul RM3,500: YTD sahaja (PCB 0 betul)';
  assert (select kinds from payroll_pcb_flags(r) where employee_no = 'MTB006') = '{pcb0}', 'Che Nah (baharu Nov): tiada tanda YTD, PCB 0 ditanda';
  assert not exists (select 1 from payroll_pcb_flags(r) where employee_no = 'MTB007'), 'Danial (data terkumpul diisi): tiada tanda';
  -- Notis selepas kira (≤ 5 pekerja PCB RM0): teks tepat bagi setiap pekerja kepada HR & Kewangan
  assert (select count(*) from payroll_pcb_alerts where payroll_run_id = r) = 3, 'amaran direkod (MTB001, MTB004, MTB006)';
  assert (select count(*) from notifications where message like '%Amin (MTB004)%(PCB)%') = 2, 'Amin: HR & Kewangan';
  assert (select count(*) from notifications where message like '%Che Nah (MTB006)%(PCB)%') = 2, 'Che Nah: HR & Kewangan';
end $$;
-- Kira semula: tiada notis berulang
select count(*) as notis_sebelum from notifications \gset
select payroll_calculate(:'run') is not null as dikira_semula;
select count(*) = :notis_sebelum as tiada_notis_berulang from notifications \gset
\if :tiada_notis_berulang
\else
  \echo 'GAGAL: notis berulang selepas kira semula'
  select 1/0;
\endif

\echo '=== P4: hantar & lulus disekat sehingga setiap pekerja diberi sebab ==='
\set ON_ERROR_STOP 0
select submit_payroll_run(:'run');
-- Pekerja biasa tidak boleh memberi sebab
set test.uid='00000000-0000-0000-0000-00000000a004';
select hr_pcb_exception_save(:'run', '00000000-0000-0000-0000-0000000000e4', 'tp1', null);
set test.uid='00000000-0000-0000-0000-00000000a002';
select hr_pcb_exception_save(:'run', '00000000-0000-0000-0000-0000000000e4', 'entah', null);
select hr_pcb_exception_save(:'run', '00000000-0000-0000-0000-0000000000e4', 'lain', '');
-- Lulus terus (memintas hantar) juga disekat
set test.role = 'service_role';
update payroll_runs set status = 'approved' where id = :'run';
set test.role='authenticated';
\set ON_ERROR_STOP 1
do $$ begin
  assert (select status from payroll_runs where period_year = 2026 and period_month = 11) = 'calculated', 'masih calculated';
  assert not exists (select 1 from approval_requests where request_type = 'payroll_run'), 'tiada permohonan kelulusan dicipta';
end $$;
-- HR memberi sebab satu demi satu (sebahagian)
select hr_pcb_exception_save(:'run', '00000000-0000-0000-0000-0000000000e6', 'staf_baharu', 'Pendapatan majikan terdahulu dalam borang TP3');
select hr_pcb_exception_save(:'run', '00000000-0000-0000-0000-0000000000e4', 'lain', 'Data terkumpul BrioHR belum diterima');
\set ON_ERROR_STOP 0
select submit_payroll_run(:'run');
\set ON_ERROR_STOP 1
-- Tukar sebab: rekod baharu ditambah, rekod lama kekal (log)
select hr_pcb_exception_save(:'run', '00000000-0000-0000-0000-0000000000e4', 'tp1', null);
select f.employee_no, f.reason, f.note, f.reason_by from payroll_pcb_flags(:'run') f order by 1;
select hr_pcb_exception_save(:'run', f.employment_id, 'lain', 'Disemak bersama Kewangan')
  from payroll_pcb_flags(:'run') f where f.reason is null;
select (submit_payroll_run(:'run')).status as selepas_hantar;
do $$
declare r uuid := (select id from payroll_runs where period_year = 2026 and period_month = 11);
begin
  assert (select status from payroll_runs where id = r) = 'pending', 'dihantar selepas semua sebab diisi';
  assert (select count(*) from payroll_pcb_exceptions where payroll_run_id = r and employment_id = '00000000-0000-0000-0000-0000000000e4') = 2, 'log: sebab lama kekal';
  assert (select reason from payroll_pcb_flags(r) where employee_no = 'MTB004') = 'tp1', 'sebab terkini dipaparkan';
  assert (select created_by from payroll_pcb_exceptions where payroll_run_id = r limit 1) = '00000000-0000-0000-0000-000000000002', 'siapa memberi sebab direkod';
  assert (select count(*) from platform_audit_log where action = 'payroll.pcb_exception' and target_id = r) =
         (select count(*) from payroll_pcb_exceptions where payroll_run_id = r), 'log audit platform bagi setiap sebab';
  assert not exists (select 1 from platform_audit_log where action = 'payroll.pcb_exception' and details ? 'note'), 'nota tidak masuk log platform';
end $$;
\set ON_ERROR_STOP 0
-- Sebab tidak boleh diubah selepas dihantar
select hr_pcb_exception_save(:'run', '00000000-0000-0000-0000-0000000000e4', 'zakat', null);
\set ON_ERROR_STOP 1

\echo '=== P5: data terkumpul diisi → PCB betul, tiada tanda (gaji Disember) ==='
select (payroll_prepare('00000000-0000-0000-0000-0000000000c1', 2026, 12))->>'run_id' as run12 \gset
-- November belum diluluskan: Disember tetap memerlukan data terkumpul Jan–Nov
select set_payroll_opening(e, 2026, 11, 55000, 6050, 1210) from (values
  ('00000000-0000-0000-0000-0000000000e1'::uuid), ('00000000-0000-0000-0000-0000000000e2'::uuid), ('00000000-0000-0000-0000-0000000000e3'::uuid),
  ('00000000-0000-0000-0000-0000000000e4'::uuid), ('00000000-0000-0000-0000-0000000000e5'::uuid), ('00000000-0000-0000-0000-0000000000e7'::uuid)) v(e);
select set_payroll_opening('00000000-0000-0000-0000-0000000000e6', 2026, 11, 5000, 550, 0);
select payroll_calculate(:'run12') is not null as dikira;
select e.employee_no, s.gross, s.pcb from payslips s join employments e on e.id = s.employment_id where s.payroll_run_id = :'run12' order by 1;
select employee_no, kinds from payroll_pcb_flags(:'run12');
do $$
declare r uuid := (select id from payroll_runs where period_year = 2026 and period_month = 12);
begin
  assert (select pcb from payslips where payroll_run_id = r and employment_id = '00000000-0000-0000-0000-0000000000e4') > 0, 'Amin PCB > 0 dengan data terkumpul';
  assert not exists (select 1 from payroll_pcb_flags(r) where 'ytd' = any(kinds)), 'tiada tanda YTD';
end $$;

\echo '=== P6: data cukai tidak lengkap & orientasi ==='
select employee_no, name, missing from hr_tax_data_gaps('00000000-0000-0000-0000-0000000000c1');
do $$ begin
  assert (select missing from hr_tax_data_gaps('00000000-0000-0000-0000-0000000000c1') where employee_no = 'MTB001') = '{spouse_working}', 'CEO berkahwin, pasangan tidak diisi';
  assert (select missing from hr_tax_data_gaps('00000000-0000-0000-0000-0000000000c1') where employee_no = 'MTB002') = '{marital_status}', 'Lily tiada status perkahwinan';
  assert not exists (select 1 from hr_tax_data_gaps('00000000-0000-0000-0000-0000000000c1') where employee_no in ('MTB003','MTB004')), 'lengkap tidak disenaraikan';
  assert (select missing from payroll_readiness('00000000-0000-0000-0000-0000000000c1') where employment_id = '00000000-0000-0000-0000-0000000000e1') @> '{"status pekerjaan pasangan (PCB)"}', 'kesediaan gaji';
end $$;
\set ON_ERROR_STOP 0
set test.uid='00000000-0000-0000-0000-00000000a004';
select hr_tax_data_gaps('00000000-0000-0000-0000-0000000000c1');
\set ON_ERROR_STOP 1
-- Orientasi: berkahwin tanpa status pasangan ditolak
set test.uid='00000000-0000-0000-0000-00000000a006';
\set ON_ERROR_STOP 0
select save_onboarding_step('00000000-0000-0000-0000-0000000000e6', 'personal', '{"marital_status":"berkahwin","children_count":1}');
select save_onboarding_step('00000000-0000-0000-0000-0000000000e6', 'personal', '{"marital_status":"berkahwin","spouse_working":true}');
\set ON_ERROR_STOP 1
select save_onboarding_step('00000000-0000-0000-0000-0000000000e6', 'personal', '{"marital_status":"berkahwin","spouse_working":false,"children_count":0}') is not null as disimpan;
do $$ begin
  assert (select spouse_working from persons where id = '00000000-0000-0000-0000-000000000006') = false, 'pasangan tidak bekerja disimpan';
  assert (select children_count from persons where id = '00000000-0000-0000-0000-000000000006') = 0, '0 anak dibenarkan';
end $$;

\echo '>>> SEMUA UJIAN PCB LULUS'
