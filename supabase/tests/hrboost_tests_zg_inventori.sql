\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian inventori: pekerja rekod (pending) → HR sahkan / tolak; lokasi tanpa pemegang; had akses & fail.
-- Gunakan stub local_only (test.uid / test.role). Jangan jalankan pada Supabase sebenar.

insert into companies(id,code,name) values ('00000000-0000-0000-0000-0000000000c1','MTB','MUSLIMTRAVELBUG SDN BHD'),
                                           ('00000000-0000-0000-0000-0000000000c2','LAIN','SYARIKAT LAIN');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,4) g;
insert into persons(id,auth_user_id,full_name,preferred_name) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000a001','HR','Lily'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','AMIN','Amin'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000a003','ZUL','Zul'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','LUAR','Luar');
insert into employments(id,person_id,company_id,employee_no,status,join_date) values
 ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','MTB001','active','2020-01-01'),
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB002','active','2020-01-01'),
 ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1','MTB003','active','2020-01-01'),
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c2','LAIN01','active','2020-01-01');
insert into user_roles(person_id,company_id,role) values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','hr');
create temp table _i(nama text, id uuid);
grant select, insert on _i to public;

\echo '=== I1: Amin rekod laptop yang dipegangnya (pending) + item pejabat (lokasi sahaja) ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
insert into _i select 'laptop', inventory_save('00000000-0000-0000-0000-0000000000c1', '{
  "name":"Laptop Dell Latitude","category":"Komputer riba","brand_model":"Dell 5440","serial_no":"SN123","price":"4299.00",
  "issued_on":"2026-11-01","employment_id":"00000000-0000-0000-0000-0000000000e2",
  "photo_paths":["00000000-0000-0000-0000-000000000002/inventori-1.jpg"],"receipt_paths":["00000000-0000-0000-0000-000000000002/resit-1.pdf"]}'::jsonb);
insert into _i select 'printer', inventory_save('00000000-0000-0000-0000-0000000000c1', '{"name":"Printer Epson L3210","price":"650","location":"Pejabat Seri Kembangan"}'::jsonb);
do $$ begin
  assert (select status from company_assets where id = (select id from _i where nama = 'laptop')) = 'pending', 'rekod pekerja menunggu semakan';
  assert (select company_id from company_assets where id = (select id from _i where nama = 'printer')) = '00000000-0000-0000-0000-0000000000c1', 'syarikat diisi';
  assert (select count(*) from inventory_list('00000000-0000-0000-0000-0000000000c1', 'mine')) = 2, 'Amin nampak 2 item';
end $$;
reset test.uid; reset test.role;
do $$ begin
  assert (select count(*) from notifications where person_id = '00000000-0000-0000-0000-000000000001' and message ~ 'Amin (merekod item inventori|recorded an inventory item)') = 2, 'HR dimaklumkan';
end $$;

\echo '=== I2: sekatan pekerja ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
\set ON_ERROR_STOP 0
select inventory_save('00000000-0000-0000-0000-0000000000c1', '{"name":"Telefon Zul","employment_id":"00000000-0000-0000-0000-0000000000e3"}'::jsonb);  -- pemegang orang lain
select inventory_save('00000000-0000-0000-0000-0000000000c1', '{"name":"Tanpa pemegang & lokasi"}'::jsonb);
select inventory_save('00000000-0000-0000-0000-0000000000c1', '{"name":"X","location":"Pejabat","photo_paths":["00000000-0000-0000-0000-000000000003/a.jpg"]}'::jsonb);  -- fail orang lain
select inventory_list('00000000-0000-0000-0000-0000000000c1', 'all');      -- bukan HR
select inventory_save('00000000-0000-0000-0000-0000000000c2', '{"name":"Y","location":"Z"}'::jsonb);  -- syarikat lain
\set ON_ERROR_STOP 1
set test.uid='00000000-0000-0000-0000-00000000a003';
do $$ begin assert (select count(*) from inventory_list('00000000-0000-0000-0000-0000000000c1', 'mine')) = 0, 'Zul tidak nampak item Amin'; end $$;
set test.uid='00000000-0000-0000-0000-00000000a004';
do $$ begin
  execute 'set local role authenticated';
  assert (select count(*) from company_assets) = 0, 'syarikat lain tidak nampak (RLS)';
end $$;

\echo '=== I3: HR senarai, tolak printer, sahkan laptop ==='
set test.uid='00000000-0000-0000-0000-00000000a001';
select name, holder, location, status, price from inventory_list('00000000-0000-0000-0000-0000000000c1', 'all');
\set ON_ERROR_STOP 0
select hr_inventory_verify((select id from _i where nama = 'printer'), false, '');   -- tanpa sebab
\set ON_ERROR_STOP 1
select hr_inventory_verify((select id from _i where nama = 'printer'), false, 'Sila lampirkan gambar');
select hr_inventory_verify((select id from _i where nama = 'laptop'), true);
do $$ begin
  assert (select count(*) from inventory_list('00000000-0000-0000-0000-0000000000c1', 'all')) = 2, 'HR nampak semua';
  assert (select sum(price) from inventory_list('00000000-0000-0000-0000-0000000000c1', 'all') where status = 'verified') = 4299.00, 'nilai disahkan';
end $$;

\echo '=== I4: Amin betulkan printer (kembali pending); laptop disahkan tidak boleh diubah ==='
set test.uid='00000000-0000-0000-0000-00000000a002';
select inventory_save('00000000-0000-0000-0000-0000000000c1', '{"name":"Printer Epson L3210","price":"650","location":"Pejabat Seri Kembangan","photo_paths":["00000000-0000-0000-0000-000000000002/p.jpg"]}'::jsonb,
                      (select id from _i where nama = 'printer'));
do $$ begin
  assert (select status from company_assets where id = (select id from _i where nama = 'printer')) = 'pending', 'dihantar semula';
  assert (select reject_reason from company_assets where id = (select id from _i where nama = 'printer')) is null, 'sebab dibersihkan';
end $$;
\set ON_ERROR_STOP 0
select inventory_save('00000000-0000-0000-0000-0000000000c1', '{"name":"Ubah","employment_id":"00000000-0000-0000-0000-0000000000e2"}'::jsonb, (select id from _i where nama = 'laptop'));
select inventory_delete((select id from _i where nama = 'laptop'));
\set ON_ERROR_STOP 1

\echo '=== I5: HR tambah item terus disahkan, tanda dipulangkan, padam ==='
set test.uid='00000000-0000-0000-0000-00000000a001';
insert into _i select 'kad', inventory_save('00000000-0000-0000-0000-0000000000c1', '{"name":"Kad akses","employment_id":"00000000-0000-0000-0000-0000000000e3"}'::jsonb);
select hr_inventory_return((select id from _i where nama = 'kad'), '2026-11-30');
do $$ begin
  assert (select status from company_assets where id = (select id from _i where nama = 'kad')) = 'verified', 'rekod HR terus disahkan';
  assert (select returned_on from company_assets where id = (select id from _i where nama = 'kad')) = '2026-11-30', 'dipulangkan';
end $$;
-- Rekod lama dari profil pekerja (HR, sisipan terus) masih berfungsi
insert into company_assets(employment_id, name, category) values ('00000000-0000-0000-0000-0000000000e3', 'Telefon syarikat', 'Telefon');
do $$ begin assert (select status from company_assets where name = 'Telefon syarikat') = 'verified', 'sisipan HR terus = disahkan'; end $$;
set test.uid='00000000-0000-0000-0000-00000000a003';
do $$ begin assert (select count(*) from inventory_list('00000000-0000-0000-0000-0000000000c1', 'mine')) = 2, 'Zul nampak item yang dipegangnya'; end $$;
reset test.uid; reset test.role;

\echo '=== I6: pekerja berhenti → item belum dipulangkan dikesan ==='
update employments set status = 'resigned', end_date = '2026-11-30' where id = '00000000-0000-0000-0000-0000000000e2';
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a001';
select name, holder, holder_active, holder_end_date, returned_on from inventory_list('00000000-0000-0000-0000-0000000000c1', 'all') where employment_id is not null;
do $$ begin
  assert (select count(*) from inventory_list('00000000-0000-0000-0000-0000000000c1', 'all')
           where holder_active = false and returned_on is null) = 1, 'laptop Amin perlu dipulangkan';
  assert (select holder_end_date from inventory_list('00000000-0000-0000-0000-0000000000c1', 'all') where name = 'Laptop Dell Latitude') = '2026-11-30', 'tarikh akhir pemegang';
  assert (select holder_active from inventory_list('00000000-0000-0000-0000-0000000000c1', 'all') where name = 'Printer Epson L3210') is null, 'item lokasi tiada status pemegang';
end $$;
reset test.uid; reset test.role;
