\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian rekod dipadam (padam dengan sejarah + pulihkan) dan senarai keputusan Kelulusan (my_action_queue).
-- Gunakan stub local_only (test.uid / test.role). Jangan jalankan pada Supabase sebenar.

insert into companies(id,code,name) values ('00000000-0000-0000-0000-0000000000c1','MTB','MUSLIMTRAVELBUG SDN BHD');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,4) g;
insert into persons(id,auth_user_id,full_name,preferred_name) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000a001','LILY','Lily'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','AMIN','Amin'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000a003','FARAH','Farah'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','ZUL','Zul');
insert into departments(id,company_id,name) values
 ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','Pelancongan'),
 ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000c1','Kosong');
insert into employments(id,person_id,company_id,employee_no,status,join_date,department_id) values
 ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','MTB001','active','2020-01-01','00000000-0000-0000-0000-0000000000d1'),
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB002','active','2020-01-01','00000000-0000-0000-0000-0000000000d1'),
 ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1','MTB003','active','2020-01-01','00000000-0000-0000-0000-0000000000d1'),
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','MTB004','active','2020-01-01','00000000-0000-0000-0000-0000000000d1');
insert into user_roles(person_id,company_id,role) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','hr'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1','finance');

-- Data: surat dikeluarkan, pengumuman dibaca, permintaan surat pekerja, inventori, akaun bank, soalan, laporan slip, draf tuntutan
insert into letter_requests(id,company_id,employment_id,kind,purpose,status,ref_no,issued_at,source) values
 ('00000000-0000-0000-0000-0000000001a1','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e2','warning','-','issued','MTB/HR/'||to_char(now(),'YYYY')||'/0001',now(),'hr'),
 ('00000000-0000-0000-0000-0000000001a2','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e2','employment','Pinjaman bank','pending',null,null,'employee');
insert into announcements(id,company_id,title,body) values ('00000000-0000-0000-0000-0000000002a1','00000000-0000-0000-0000-0000000000c1','Makan malam','12 Disember');
insert into announcement_reads(announcement_id,person_id) values ('00000000-0000-0000-0000-0000000002a1','00000000-0000-0000-0000-000000000002');
insert into company_assets(id,company_id,employment_id,name,status,created_by) values
 ('00000000-0000-0000-0000-0000000003a1','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e2','Laptop','pending','00000000-0000-0000-0000-000000000002');
insert into bank_change_requests(id,person_id,bank_name,bank_account_no) values ('00000000-0000-0000-0000-0000000004a1','00000000-0000-0000-0000-000000000002','Maybank','111122223333');
insert into hr_questions(id,company_id,employment_id,question) values ('00000000-0000-0000-0000-0000000005a1','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e2','Berapa hari cuti haji?');
insert into payroll_runs(id,company_id,period_year,period_month,status) values ('00000000-0000-0000-0000-0000000006a1','00000000-0000-0000-0000-0000000000c1',2026,10,'approved');
insert into payslip_issues(id,payroll_run_id,employment_id,message) values ('00000000-0000-0000-0000-0000000006a2','00000000-0000-0000-0000-0000000006a1','00000000-0000-0000-0000-0000000000e2','OT tidak dimasukkan');
insert into claims(id,employment_id,title,status) values ('00000000-0000-0000-0000-0000000007a1','00000000-0000-0000-0000-0000000000e2','Tol','draft');

\echo '=== P1: pekerja biasa tidak boleh memadam rekod HR ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a004';
do $$ begin
  begin perform record_delete('announcement','00000000-0000-0000-0000-0000000002a1'); raise exception 'patut gagal';
  exception when others then assert sqlerrm = 'Tidak dibenarkan', 'pekerja ditolak: ' || sqlerrm; end;
  begin perform record_delete('claim_draft','00000000-0000-0000-0000-0000000007a1'); raise exception 'patut gagal';
  exception when others then assert sqlerrm = 'Tidak dibenarkan', 'draf orang lain ditolak: ' || sqlerrm; end;
  begin perform record_delete('employments','00000000-0000-0000-0000-0000000000e2'); raise exception 'patut gagal';
  exception when others then assert sqlerrm = 'Jenis rekod tidak boleh dipadam', 'jenis tidak dibenarkan: ' || sqlerrm; end;
end $$;

\echo '=== P2: HR padam surat dikeluarkan (sebab wajib), no. rujukan tidak diulang ==='
set test.uid='00000000-0000-0000-0000-00000000a001';
do $$ declare rid uuid; begin
  begin perform record_delete('letter','00000000-0000-0000-0000-0000000001a1'); raise exception 'patut gagal';
  exception when others then assert sqlerrm like 'Sila nyatakan sebab%', 'sebab wajib: ' || sqlerrm; end;
  rid := record_delete('letter','00000000-0000-0000-0000-0000000001a1','Tersalah pekerja');
  assert not exists (select 1 from letter_requests where id = '00000000-0000-0000-0000-0000000001a1'), 'surat dipadam';
  assert (select reason from deleted_records where id = rid) = 'Tersalah pekerja', 'sebab disimpan';
  assert (select label from deleted_records where id = rid) like 'MTB/HR/%/0001', 'label = no. rujukan';
  assert letter_next_ref('00000000-0000-0000-0000-0000000000c1') like '%/0002', 'no. rujukan seterusnya 0002, bukan 0001: ' || letter_next_ref('00000000-0000-0000-0000-0000000000c1');
end $$;

\echo '=== P3: pengumuman dengan rekod bacaan — padam & pulihkan bersama anak ==='
do $$ declare rid uuid; begin
  rid := record_delete('announcement','00000000-0000-0000-0000-0000000002a1');
  assert not exists (select 1 from announcement_reads where announcement_id = '00000000-0000-0000-0000-0000000002a1'), 'bacaan dipadam';
  perform record_restore(rid);
  assert exists (select 1 from announcements where id = '00000000-0000-0000-0000-0000000002a1' and title = 'Makan malam'), 'pengumuman dipulihkan';
  assert exists (select 1 from announcement_reads where announcement_id = '00000000-0000-0000-0000-0000000002a1'), 'bacaan dipulihkan';
  assert (select restored_at is not null and restored_by = '00000000-0000-0000-0000-000000000001' from deleted_records where id = rid), 'tanda dipulihkan';
  begin perform record_restore(rid); raise exception 'patut gagal';
  exception when others then assert sqlerrm like '%telah dipulihkan%', 'tidak boleh pulih dua kali: ' || sqlerrm; end;
end $$;

\echo '=== P4: jabatan berpekerja tidak boleh dipadam; jabatan kosong boleh; pulih bertembung nama ==='
do $$ declare rid uuid; begin
  begin perform record_delete('department','00000000-0000-0000-0000-0000000000d1'); raise exception 'patut gagal';
  exception when others then assert sqlerrm like '%masih mempunyai pekerja%', 'jabatan berpekerja: ' || sqlerrm; end;
  rid := record_delete('department','00000000-0000-0000-0000-0000000000d2');
  insert into departments(company_id,name) values ('00000000-0000-0000-0000-0000000000c1','Kosong');
  begin perform record_restore(rid);
  exception when others then assert sqlerrm like 'Tidak dapat dipulihkan%' or sqlerrm like '%telah dipulihkan%', 'mesej bertembung: ' || sqlerrm; end;
end $$;

\echo '=== P5: pekerja padam draf tuntutan sendiri & melihat rekodnya sahaja ==='
set test.uid='00000000-0000-0000-0000-00000000a002';
do $$ declare rid uuid; begin
  rid := record_delete('claim_draft','00000000-0000-0000-0000-0000000007a1');
  assert (select count(*) from deleted_records_list('00000000-0000-0000-0000-0000000000c1')) = 1, 'pekerja nampak rekod sendiri sahaja';
  perform record_restore(rid);
  assert exists (select 1 from claims where id = '00000000-0000-0000-0000-0000000007a1'), 'draf dipulihkan';
end $$;
set test.uid='00000000-0000-0000-0000-00000000a001';
do $$ begin
  assert (select count(*) from deleted_records_list('00000000-0000-0000-0000-0000000000c1')) >= 1, 'HR nampak rekod yang belum dipulihkan';
  assert (select count(*) from deleted_records_list('00000000-0000-0000-0000-0000000000c1', true)) >= 4, 'termasuk yang dipulihkan';
end $$;

\echo '=== K1: Kelulusan — HR nampak semua keputusan HR ==='
do $$ declare k text[]; begin
  select array_agg(distinct kind order by kind) into k from my_action_queue('00000000-0000-0000-0000-0000000000c1');
  assert k @> array['letter','asset','bank','question','payslip_issue'], 'HR: ' || k::text;
  assert (select detail from my_action_queue('00000000-0000-0000-0000-0000000000c1') where kind = 'bank') = 'Maybank', 'bank';
  assert (select extra->>'account_tail' from my_action_queue('00000000-0000-0000-0000-0000000000c1') where kind = 'bank') = '3333', 'hanya 4 digit akhir akaun';
end $$;

\echo '=== K2: Kewangan nampak laporan slip sahaja; pekerja biasa tiada ==='
set test.uid='00000000-0000-0000-0000-00000000a003';
do $$ declare k text[]; begin
  select array_agg(distinct kind order by kind) into k from my_action_queue('00000000-0000-0000-0000-0000000000c1');
  assert k = array['payslip_issue'], 'Kewangan: ' || coalesce(k::text, '{}');
end $$;
set test.uid='00000000-0000-0000-0000-00000000a004';
do $$ begin
  assert (select count(*) from my_action_queue('00000000-0000-0000-0000-0000000000c1')) = 0, 'pekerja biasa: tiada';
end $$;
reset test.uid; reset test.role;
\echo 'SELESAI: rekod dipadam & kelulusan'
