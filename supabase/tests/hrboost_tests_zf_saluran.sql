\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian saluran notifikasi: WhatsApp pilihan, e-mel sebagai ganti, dalam aplikasi sahaja jika tiada saluran.
-- Gunakan stub local_only (test.uid / test.role). Jangan jalankan pada Supabase sebenar.

insert into companies(id,code,name) values ('00000000-0000-0000-0000-0000000000c1','MTB','MUSLIMTRAVELBUG SDN BHD');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,4) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp,email) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000a001','HR','Lily','60110000001','lily@contoh.my'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','AMIN','Amin','60110000002','amin@contoh.my'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000a003','ZUL','Zul',null,'zul@contoh.my'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','TIADA','Tiada',null,null);
insert into employments(id,person_id,company_id,employee_no,status,join_date) values
 ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','MTB001','active','2020-01-01'),
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB002','active','2020-01-01');
insert into user_roles(person_id,company_id,role) values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','hr');

create temp table _n(nama text, id uuid);
grant select on _n to public;
create function pg_temp.baru(nama text, orang text, saluran text default 'whatsapp', bila interval default '0') returns void language sql as $$
  insert into notifications(company_id, person_id, channel, to_address, message, created_at)
  select '00000000-0000-0000-0000-0000000000c1', ('00000000-0000-0000-0000-00000000000' || orang)::uuid, saluran,
         case when saluran = 'whatsapp' then (select phone_whatsapp from persons where id = ('00000000-0000-0000-0000-00000000000' || orang)::uuid) end,
         'Ujian ' || nama, now() - bila;
  insert into _n select nama, (select id from notifications where message = 'Ujian ' || nama);
$$;

\echo '=== S1: tiada saluran dikonfigurasi → dalam aplikasi sahaja (tiada longgokan) ==='
select pg_temp.baru('a', '2');
select pg_temp.baru('lama', '2', 'whatsapp', '5 days');
set test.role = 'service_role';
select count(*) as diambil from notify_next2(50, false, false);
do $$ begin
  assert (select status from notifications where id = (select id from _n where nama = 'a')) = 'skipped', 'tiada saluran → skipped';
  assert (select error from notifications where id = (select id from _n where nama = 'lama')) like 'Tamat tempoh%', 'notifikasi lama tidak dihantar';
end $$;

\echo '=== S2: e-mel sahaja → WhatsApp dihantar sebagai e-mel; tiada e-mel → dalam aplikasi ==='
reset test.role;
select pg_temp.baru('b', '2'); select pg_temp.baru('c', '3'); select pg_temp.baru('d', '4');
set test.role = 'service_role';
create temp table _r as select * from notify_next2(50, false, true);
grant select on _r to public;
select channel, to_address, language from _r;
do $$ begin
  assert (select channel from _r where id = (select id from _n where nama = 'b')) = 'email', 'Amin melalui e-mel';
  assert (select to_address from _r where id = (select id from _n where nama = 'b')) = 'amin@contoh.my', 'alamat e-mel Amin';
  assert (select channel from notifications where id = (select id from _n where nama = 'b')) = 'email', 'saluran dikemas kini';
  assert (select to_address from _r where id = (select id from _n where nama = 'c')) = 'zul@contoh.my', 'tanpa WhatsApp → e-mel';
  assert (select status from notifications where id = (select id from _n where nama = 'd')) = 'skipped', 'tiada telefon & e-mel → dalam aplikasi';
end $$;

\echo '=== S3: WhatsApp & e-mel → WhatsApp diutamakan; tanpa telefon → e-mel ==='
reset test.role;
select pg_temp.baru('e', '2'); select pg_temp.baru('f', '3');
set test.role = 'service_role';
create temp table _r3 as select * from notify_next2(50, true, true);
grant select on _r3 to public;
do $$ begin
  assert (select channel from _r3 where id = (select id from _n where nama = 'e')) = 'whatsapp', 'WhatsApp diutamakan';
  assert (select channel from _r3 where id = (select id from _n where nama = 'f')) = 'email', 'tanpa WhatsApp → e-mel';
end $$;

\echo '=== S4: syarikat matikan WhatsApp → e-mel; HR sahaja boleh ubah ==='
reset test.role;
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
\set ON_ERROR_STOP 0
select set_notify_channels('00000000-0000-0000-0000-0000000000c1', false, true);   -- Amin bukan HR
\set ON_ERROR_STOP 1
set test.uid='00000000-0000-0000-0000-00000000a001';
select set_notify_channels('00000000-0000-0000-0000-0000000000c1', false, true);
reset test.uid; reset test.role;
select pg_temp.baru('g', '2');
set test.role = 'service_role';
select notify_set_channels(true, true);
create temp table _r4 as select * from notify_next2(50, true, true);
grant select on _r4 to public;
do $$ begin
  assert (select channel from _r4 where id = (select id from _n where nama = 'g')) = 'email', 'WhatsApp dimatikan syarikat → e-mel';
end $$;

\echo '=== S5: notify_channels untuk ahli syarikat ==='
reset test.role;
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
select notify_channels('00000000-0000-0000-0000-0000000000c1');
do $$ begin
  assert (notify_channels('00000000-0000-0000-0000-0000000000c1')->>'whatsapp')::boolean = false, 'WhatsApp tidak aktif (dimatikan syarikat)';
  assert (notify_channels('00000000-0000-0000-0000-0000000000c1')->>'email')::boolean = true, 'e-mel aktif';
  assert (notify_channels('00000000-0000-0000-0000-0000000000c1')->>'whatsapp_ready')::boolean = true, 'Murpati dikonfigurasi pada platform';
end $$;
set test.uid='00000000-0000-0000-0000-00000000a003';   -- bukan ahli syarikat
do $$ begin assert notify_channels('00000000-0000-0000-0000-0000000000c1') is null, 'bukan ahli → tiada'; end $$;
\set ON_ERROR_STOP 0
select notify_next2(1, true, true);   -- bukan service role
\set ON_ERROR_STOP 1
reset test.uid; reset test.role;
