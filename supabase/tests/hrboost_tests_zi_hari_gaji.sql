\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian peringatan hari gaji: H-5 dan H-1 sahaja, kepada HR & Kewangan; suis mati; hari gaji dikepit ke akhir bulan.
-- Gunakan stub local_only (test.uid / test.role). Jangan jalankan pada Supabase sebenar.

insert into companies(id,code,name,payday) values ('00000000-0000-0000-0000-0000000000c1','MTB','MUSLIMTRAVELBUG SDN BHD', 31);
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,3) g;
insert into persons(id,auth_user_id,full_name,preferred_name) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000a001','LILY','Lily'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','AMIN','Amin'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000a003','FARAH','Farah');
insert into employments(id,person_id,company_id,employee_no,status,join_date) values
 ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','MTB001','active','2020-01-01'),
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB002','active','2020-01-01'),
 ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1','MTB003','active','2020-01-01');
insert into user_roles(person_id,company_id,role) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','hr'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1','finance');

\echo '=== G1: hari gaji 31 dikepit ke 30 November; H-5 = 25 Nov, H-1 = 29 Nov ==='
do $$ begin
  assert payday_reminders('2026-11-24') = 0, 'H-6: tiada peringatan';
  assert payday_reminders('2026-11-25') = 2, 'H-5: HR & Kewangan';
  assert payday_reminders('2026-11-27') = 0, 'H-3: tiada peringatan';
  assert payday_reminders('2026-11-29') = 2, 'H-1: HR & Kewangan';
  assert payday_reminders('2026-11-30') = 0, 'hari gaji: tiada';
  assert (select count(*) from notifications where person_id = '00000000-0000-0000-0000-000000000002') = 0, 'pekerja biasa tidak dimaklumkan';
  assert (select count(*) from notifications where person_id = '00000000-0000-0000-0000-000000000001'
           and message ~ '(hari gaji November 2026 ialah 30/11/2026 \(5 hari lagi\)\. Gaji bulan ini belum diluluskan|November 2026 payday is 30/11/2026 \(5 days left\)\. This month''s payroll has not been approved yet)') = 1, 'mesej H-5';
end $$;

\echo '=== G2: selepas hari gaji → bulan depan (31 Disember); status diluluskan ==='
insert into payroll_runs(company_id, period_year, period_month, status) values ('00000000-0000-0000-0000-0000000000c1', 2026, 12, 'approved');
do $$ begin
  assert payday_reminders('2026-12-26') = 2, 'H-5 Disember';
  assert (select count(*) from notifications where person_id = '00000000-0000-0000-0000-000000000003'
           and message ~ '(31/12/2026 \(5 hari lagi\)\. Gaji bulan ini telah diluluskan|31/12/2026 \(5 days left\)\. This month''s payroll has been approved)') = 1, 'status diluluskan';
end $$;

\echo '=== G3: suis — hanya HR / Kewangan; mati = tiada peringatan ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
\set ON_ERROR_STOP 0
select set_payday_reminder('00000000-0000-0000-0000-0000000000c1', false);   -- pekerja biasa
\set ON_ERROR_STOP 1
set test.uid='00000000-0000-0000-0000-00000000a003';
select set_payday_reminder('00000000-0000-0000-0000-0000000000c1', false);
reset test.uid; reset test.role;
do $$ begin
  assert not (select payday_reminder from companies where id = '00000000-0000-0000-0000-0000000000c1'), 'suis dimatikan';
  assert payday_reminders('2026-11-25') = 0, 'tiada peringatan apabila suis mati';
end $$;
\echo 'SELESAI: peringatan hari gaji'
