\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian pengetahuan AI: simpan & pecah dokumen, carian teks penuh (syarikat sendiri sahaja),
-- soalan tidak terjawab, tindakan ejen. Gunakan stub local_only. Logik ejen: ujian-fungsi-ai.cjs.

insert into companies(id,code,name) values ('00000000-0000-0000-0000-0000000000c1','MTB','MTB'), ('00000000-0000-0000-0000-0000000000c2','DOIT','DO IT');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,9) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','HR','Lily','60110000002'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','AMIN','Amin','60110000004'),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-00000000a005','DINA','Dina','60110000005');
insert into employments(person_id,company_id,employee_no,status,join_date) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB001','active','2020-01-01'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','MTB002','active','2020-01-01'),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000c2','DOIT001','active','2020-01-01');
insert into user_roles(person_id,company_id,role) values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr');

\echo '=== A1: simpan dokumen (dipecah) ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
select kb_save_document('00000000-0000-0000-0000-0000000000c1', 'Buku panduan MTB',
  repeat('Waktu bekerja ialah 9 pagi hingga 6 petang dari Isnin hingga Jumaat. ', 20) || E'\n\n' ||
  'Cuti kahwin: pekerja tetap layak 3 hari cuti kahwin sekali sepanjang perkhidmatan.' || E'\n\n' ||
  'Letak kereta di KLIA dan KLIA2 boleh dituntut dengan resit semasa menghantar kumpulan pelanggan.') as doc \gset
select title, chunks, active from kb_documents('00000000-0000-0000-0000-0000000000c1');
\set ON_ERROR_STOP 0
select kb_save_document('00000000-0000-0000-0000-0000000000c1', 'Pendek', 'abc');
set test.uid='00000000-0000-0000-0000-00000000a004';
select kb_save_document('00000000-0000-0000-0000-0000000000c1', 'Cubaan pekerja', repeat('x ', 50));
\set ON_ERROR_STOP 1

\echo '=== A2: carian (pekerja syarikat sendiri) ==='
select title, left(content, 50) petikan from kb_search('00000000-0000-0000-0000-0000000000c1', 'Bolehkah saya tuntut letak kereta di KLIA?', 3);
select count(*) as hasil_kahwin from kb_search('00000000-0000-0000-0000-0000000000c1', 'berapa hari cuti kahwin', 3);
select count(*) as padanan_separa_perkataan_cuti from kb_search('00000000-0000-0000-0000-0000000000c1', 'cuti haji', 3);
do $$ begin
  assert (select count(*) from kb_search('00000000-0000-0000-0000-0000000000c1', 'letak kereta KLIA', 3)) >= 1;
end $$;
\set ON_ERROR_STOP 0
-- pekerja syarikat lain tidak boleh mencari dokumen MTB
set test.uid='00000000-0000-0000-0000-00000000a005';
select kb_search('00000000-0000-0000-0000-0000000000c1', 'letak kereta', 3);
\set ON_ERROR_STOP 1

\echo '=== A3: kemas kini dokumen menggantikan bahagian lama ==='
set test.uid='00000000-0000-0000-0000-00000000a002';
select kb_save_document('00000000-0000-0000-0000-0000000000c1', 'Buku panduan MTB (2027)', 'Cuti haji: 30 hari sekali sepanjang perkhidmatan bagi pekerja Muslim.', :'doc') is not null as dikemas_kini;
select title, chunks from kb_documents('00000000-0000-0000-0000-0000000000c1');
select count(*) as cuti_haji_kini from kb_search('00000000-0000-0000-0000-0000000000c1', 'cuti haji', 3);

\echo '=== A4: soalan tidak terjawab & tindakan ejen ==='
set test.role = 'service_role';
insert into ai_unanswered(company_id, person_id, question) values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000004','Boleh kerja dari rumah?');
insert into ai_action_log(on_behalf_of, action, payload) values ('00000000-0000-0000-0000-000000000004','submit_leave','{"mula":"2026-12-23"}');
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
select question, name from kb_unanswered('00000000-0000-0000-0000-0000000000c1');
select kb_resolve_unanswered(id) from kb_unanswered('00000000-0000-0000-0000-0000000000c1');
select count(*) as tertunggak from kb_unanswered('00000000-0000-0000-0000-0000000000c1');
set test.uid='00000000-0000-0000-0000-00000000a004';
select count(*) as soalan_dilihat_pekerja from kb_unanswered('00000000-0000-0000-0000-0000000000c1');
select action from my_ai_actions(5);
