\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian notifikasi telefon (Web Push): langgan / nyahlanggan peranti sendiri sahaja, kunci VAPID sekali,
-- push_next hanya notifikasi selepas langganan & < 3 hari & sekali sahaja, push_mark memadam langganan tamat.
-- Gunakan stub local_only (test.uid / test.role / service role). Jangan jalankan pada Supabase sebenar.

insert into companies(id,code,name) values ('00000000-0000-0000-0000-0000000000c1','ABC','ABC SDN BHD');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,3) g;
insert into persons(id,auth_user_id,full_name,preferred_name,email,language) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000a001','ALI','Ali','ali@abc.my','ms'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','BADRUL','Badrul','b@abc.my','en'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000a003','SA','Sadam','sa@hrboost.io','en');
insert into employments(id,person_id,company_id,employee_no,status,join_date) values
 ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','ABC001','active','2020-01-01'),
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','ABC002','active','2020-01-01');
insert into platform_admins(person_id) values ('00000000-0000-0000-0000-000000000003');

-- Notifikasi lama (sebelum langganan) tidak dihantar sebagai push
insert into notifications(company_id, person_id, message, created_at)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000001', 'Notifikasi lama', now() - interval '1 hour');

\echo '=== P1: kunci VAPID belum ada; pengguna tanpa log masuk ditolak ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a001';
do $$ begin
  assert (push_status('https://push.example/ali')->>'available')::boolean = false, 'VAPID belum dijana';
  begin perform push_vapid_init(repeat('A', 87), repeat('B', 43)); raise exception 'patut gagal';
  exception when others then assert sqlerrm = 'Tidak dibenarkan', 'pengguna tidak boleh menetapkan VAPID: ' || sqlerrm; end;
end $$;

\echo '=== P2: service role menjana VAPID sekali sahaja ==='
set test.role='service_role'; set test.uid='';
do $$ begin
  assert push_vapid_init(repeat('A', 87), repeat('B', 43)) = true, 'disimpan';
  assert push_vapid_init(repeat('C', 87), repeat('D', 43)) = false, 'tidak ditulis ganti';
  assert push_public_key() = repeat('A', 87), 'kunci awam kekal';
  assert push_vapid()->>'private' = repeat('B', 43), 'kunci peribadi dalam rahsia platform';
  begin perform push_vapid_init('x', 'y'); exception when others then null; end;
end $$;

\echo '=== P3: langgan peranti; endpoint tidak sah ditolak ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a001';
select push_subscribe('https://push.example/ali', 'kunciP', 'kunciA', 'Telefon Ali');
do $$ begin
  begin perform push_subscribe('http://tidak-selamat', 'a', 'b'); raise exception 'patut gagal';
  exception when others then assert sqlerrm = 'Langganan notifikasi tidak sah', sqlerrm; end;
  assert (push_status('https://push.example/ali')->>'this_device')::boolean, 'peranti ini dilanggan';
  assert (push_status('https://push.example/ali')->>'devices')::int = 1, '1 peranti';
end $$;
set test.uid='00000000-0000-0000-0000-00000000a002';
do $$ begin
  assert not (push_status('https://push.example/ali')->>'this_device')::boolean, 'Badrul tidak melihat peranti Ali';
  perform push_unsubscribe('https://push.example/ali');
end $$;
select count(*) = 1 as ali_masih_dilanggan from push_subscriptions;

\echo '=== P4: push_next — notifikasi baharu sahaja, sekali, bahasa penerima ==='
insert into notifications(company_id, person_id, message)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000001', 'Permohonan cuti anda telah diluluskan.'),
       ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000002', 'Badrul tiada peranti');
insert into notifications(company_id, person_id, message, send_after)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000001', 'Ditangguhkan', now() + interval '1 hour');
set test.role='service_role'; set test.uid='';
do $$ declare n int; m text; b text; begin
  select count(*), max(message), max(language) into n, m, b from push_next(50);
  assert n = 1, 'satu push (lama, tiada peranti & ditangguh dilangkau): ' || n;
  assert m like 'Permohonan cuti anda telah diluluskan%' and b = 'ms', 'mesej & bahasa: ' || m || ' ' || b;
  select count(*) into n from push_next(50);
  assert n = 0, 'tidak dihantar semula';
end $$;

\echo '=== P5: push_mark — berjaya, gagal 5 kali, 410 dipadam ==='
select push_mark('https://push.example/ali', true);
do $$ begin
  assert (select last_ok_at is not null and failures = 0 from push_subscriptions where endpoint = 'https://push.example/ali'), 'berjaya';
end $$;
select push_mark('https://push.example/ali', false) from generate_series(1, 4);
select count(*) = 1 as masih_ada_selepas_4_gagal from push_subscriptions;
select push_mark('https://push.example/ali', false);
select count(*) = 0 as dipadam_selepas_5_gagal from push_subscriptions;
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a001';
select push_subscribe('https://push.example/ali2', 'p', 'a');
set test.role='service_role'; set test.uid='';
select push_mark('https://push.example/ali2', false, true);
do $$ begin assert (select count(*) from push_subscriptions) = 0, '410 → dipadam'; end $$;

\echo '=== P6: Pentadbir Platform — agregat sahaja; kunci CHIP kini boleh disimpan ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a003';
do $$ begin
  assert (sa_push_overview()->>'vapid')::boolean, 'VAPID ditetapkan';
  assert (sa_push_overview()->>'sent_24h')::int = 1, 'satu push 24 jam';
  perform sa_platform_secret_set('chip_brand_id', 'jenama-ujian-123');
  assert (select is_set from sa_platform_secrets() where name = 'chip_brand_id'), 'kunci CHIP disimpan';
end $$;
set test.uid='00000000-0000-0000-0000-00000000a001';
do $$ begin assert sa_push_overview() is null, 'bukan superadmin: tiada data'; end $$;
reset test.role; reset test.uid;
\echo 'SELESAI: web push'
