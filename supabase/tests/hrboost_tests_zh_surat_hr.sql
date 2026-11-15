\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian surat dikeluarkan oleh HR: tawaran, kenaikan gaji, amaran, tunjuk sebab, terima peletakan jawatan, memo pendahuluan gaji.
-- Gunakan stub local_only (test.uid / test.role). Jangan jalankan pada Supabase sebenar.

insert into companies(id,code,name) values ('00000000-0000-0000-0000-0000000000c1','MTB','MUSLIMTRAVELBUG SDN BHD');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,3) g;
insert into persons(id,auth_user_id,full_name,preferred_name,ic_no) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000a001','LILY BINTI HR','Lily','900101101234'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','AMIN BIN ABDULLAH','Amin','950505055555'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000a003','ZUL BIN KEWANGAN','Zul','880808088888');
insert into employments(id,person_id,company_id,employee_no,status,join_date,probation_end_date) values
 ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','MTB001','active','2020-01-01',null),
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB002','probation','2026-09-01','2026-12-01'),
 ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1','MTB003','active','2020-01-01',null);
insert into user_roles(person_id,company_id,role) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','hr'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1','finance');
insert into pay_components(company_id, code, name, kind) values ('00000000-0000-0000-0000-0000000000c1', 'BASIC', 'Gaji Pokok', 'earning')
on conflict do nothing;
insert into employment_compensation(employment_id, component_id, amount, effective_from, effective_to)
select '00000000-0000-0000-0000-0000000000e2', id, 3000, '2026-09-01', '2026-10-31' from pay_components where company_id = '00000000-0000-0000-0000-0000000000c1' and code = 'BASIC';
insert into employment_compensation(employment_id, component_id, amount, effective_from)
select '00000000-0000-0000-0000-0000000000e2', id, 3300, '2026-11-01' from pay_components where company_id = '00000000-0000-0000-0000-0000000000c1' and code = 'BASIC';
create temp table _s(nama text, id uuid);
grant select, insert on _s to public;

\echo '=== S1: HR keluarkan surat tawaran & kenaikan gaji ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a001';
insert into _s select 'tawaran', hr_issue_letter('00000000-0000-0000-0000-0000000000e2', 'offer', '{"accept_by":"2026-09-01"}');
insert into _s select 'kenaikan', hr_issue_letter('00000000-0000-0000-0000-0000000000e2', 'salary_increment', '{"reason":"Prestasi tahunan"}');
do $$ declare v jsonb; k jsonb; begin
  v := letter_view((select id from _s where nama = 'tawaran'));
  assert v->>'kind' = 'offer' and v->>'source' = 'hr', 'jenis & sumber';
  assert v->>'full_name' = 'AMIN BIN ABDULLAH', 'nama penuh ikut IC';
  assert (v->>'basic')::numeric in (3000, 3300), 'gaji pokok dalam tawaran';
  assert v->>'probation_end_date' = '2026-12-01', 'tamat percubaan';
  assert v->'details'->>'accept_by' = '2026-09-01', 'medan HR disimpan';
  assert v->'signatory'->>'name' = 'LILY BINTI HR', 'penandatangan';
  k := letter_view((select id from _s where nama = 'kenaikan'));
  assert (k->>'old_basic')::numeric = 3000 and (k->>'new_basic')::numeric = 3300, 'gaji lama → baharu';
  assert k->>'increment_from' = '2026-11-01', 'tarikh kuat kuasa';
  assert (select count(*) from data_access_log where resource = 'salary_letter') = 2, 'akses gaji direkod';
end $$;
reset test.uid; reset test.role;
do $$ begin
  assert (select count(*) from notifications where person_id = '00000000-0000-0000-0000-000000000002'
           and message ~ '(HR telah mengeluarkan surat tawaran kerja|HR has issued a job offer letter)') = 1, 'Amin dimaklumkan';
end $$;

\echo '=== S2: pekerja tidak boleh mengeluarkan surat HR ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
\set ON_ERROR_STOP 0
select hr_issue_letter('00000000-0000-0000-0000-0000000000e2', 'experience', '{}');
select hr_issue_letter('00000000-0000-0000-0000-0000000000e2', 'warning', '{"description":"Cubaan oleh pekerja sendiri sahaja"}');
\set ON_ERROR_STOP 1
do $$ begin assert (select count(*) from letter_requests) = 2, 'tiada surat baharu oleh pekerja'; end $$;

\echo '=== S3: amaran & tunjuk sebab — syarat medan ==='
set test.uid='00000000-0000-0000-0000-00000000a001';
\set ON_ERROR_STOP 0
select hr_issue_letter('00000000-0000-0000-0000-0000000000e2', 'warning', '{"description":"Lewat"}');                 -- terlalu pendek
select hr_issue_letter('00000000-0000-0000-0000-0000000000e2', 'show_cause', '{"description":"Tidak hadir bekerja tanpa makluman selama tiga hari berturut-turut"}');  -- tiada tarikh jawapan
select hr_issue_letter('00000000-0000-0000-0000-0000000000e2', 'experience', '{}');                                  -- belum berhenti
select hr_issue_letter('00000000-0000-0000-0000-0000000000e2', 'resignation_accept', '{}');                          -- belum berhenti
select hr_issue_letter('00000000-0000-0000-0000-0000000000e2', 'probation_extension', '{}');                         -- tiada tarikh baharu
\set ON_ERROR_STOP 1
insert into _s select 'amaran', hr_issue_letter('00000000-0000-0000-0000-0000000000e2', 'warning',
  '{"description":"Lewat hadir bekerja sebanyak 6 kali dalam bulan Oktober 2026 tanpa sebab munasabah.","incident_date":"2026-10-31","warning_no":"1"}');
insert into _s select 'tunjuk', hr_issue_letter('00000000-0000-0000-0000-0000000000e2', 'show_cause',
  '{"description":"Tidak hadir bekerja tanpa makluman pada 3, 4 dan 5 November 2026.","reply_by":"2026-11-20"}');
insert into _s select 'lanjut', hr_issue_letter('00000000-0000-0000-0000-0000000000e2', 'probation_extension', '{"new_end_date":"2027-03-01","improve":"Ketepatan masa"}');
do $$ begin
  assert (letter_view((select id from _s where nama = 'lanjut'))->'details'->>'old_end_date') = '2026-12-01', 'tarikh asal percubaan disimpan';
  assert (select count(distinct ref_no) from letter_requests) = (select count(*) from letter_requests), 'no. rujukan unik';
  assert (select max(ref_no) from letter_requests) like 'MTB/HR/%/0005', 'no. rujukan berturutan';
end $$;

\echo '=== S4: terima peletakan jawatan menyenaraikan inventori belum dipulangkan ==='
update employments set end_date = '2026-12-31', end_status = 'resigned' where id = '00000000-0000-0000-0000-0000000000e2';
insert into company_assets(employment_id, company_id, name, serial_no, status) values
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c1', 'Laptop Dell Latitude', 'SN-1', 'verified'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c1', 'Kad akses pejabat', null, 'verified');
update company_assets set returned_on = '2026-11-10' where name = 'Kad akses pejabat';
insert into _s select 'berhenti', hr_issue_letter('00000000-0000-0000-0000-0000000000e2', 'resignation_accept', '{"notice_date":"2026-11-30"}');
insert into _s select 'pengalaman', hr_issue_letter('00000000-0000-0000-0000-0000000000e2', 'experience', '{}');
do $$ declare v jsonb; begin
  v := letter_view((select id from _s where nama = 'berhenti'));
  assert v->>'end_date' = '2026-12-31', 'hari bekerja terakhir';
  assert jsonb_array_length(v->'assets') = 1 and v->'assets'->0->>'name' = 'Laptop Dell Latitude', 'hanya item belum dipulangkan';
end $$;

\echo '=== S5: memo pendahuluan gaji — Kewangan sahaja, tidak dilihat pekerja ==='
reset test.uid; reset test.role;
insert into salary_advances(id, employment_id, amount, reason, status, deduct_year, deduct_month) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e2', 500, 'Kecemasan keluarga', 'approved', 2026, 12),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000e2', 300, 'Belum lulus', 'pending', 2026, 12);
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a003';
\set ON_ERROR_STOP 0
select hr_issue_letter('00000000-0000-0000-0000-0000000000e2', 'salary_advance', '{}', null, '00000000-0000-0000-0000-0000000000a2');  -- belum lulus
select hr_issue_letter('00000000-0000-0000-0000-0000000000e2', 'warning', '{"description":"Kewangan tidak boleh mengeluarkan surat amaran"}');
\set ON_ERROR_STOP 1
insert into _s select 'memo', hr_issue_letter('00000000-0000-0000-0000-0000000000e2', 'salary_advance', '{"note":"Bayar melalui pindahan bank"}', null,
                                              '00000000-0000-0000-0000-0000000000a1');
do $$ declare v jsonb; begin
  v := letter_view((select id from _s where nama = 'memo'));
  assert (v->'advance'->>'amount')::numeric = 500 and (v->'advance'->>'deduct_month')::int = 12, 'butiran pendahuluan';
  assert (select count(*) from letter_list_employment('00000000-0000-0000-0000-0000000000e2')) = 1, 'Kewangan nampak memo sahaja';
end $$;
set test.uid='00000000-0000-0000-0000-00000000a002';
do $$ begin
  assert (select count(*) from letter_list('00000000-0000-0000-0000-0000000000c1', true)) = 7, 'Amin nampak 7 surat (tanpa memo)';
  assert not exists (select 1 from letter_list('00000000-0000-0000-0000-0000000000c1', true) where kind = 'salary_advance'), 'memo disorok';
end $$;
\set ON_ERROR_STOP 0
select letter_view((select id from _s where nama = 'memo'));   -- pekerja tidak boleh membuka memo
\set ON_ERROR_STOP 1
set test.uid='00000000-0000-0000-0000-00000000a001';
do $$ begin
  assert (select count(*) from letter_list_employment('00000000-0000-0000-0000-0000000000e2')) = 8, 'HR nampak semua 8 surat';
  assert (select count(*) from employment_history('00000000-0000-0000-0000-0000000000e2') where field = 'letter' and note = 'Surat tawaran kerja') = 1, 'garis masa berlabel';
end $$;
reset test.uid; reset test.role;
\echo 'SELESAI: surat HR'
