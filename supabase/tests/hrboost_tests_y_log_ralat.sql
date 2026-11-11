\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian log ralat aplikasi: had kadar, pengumpulan ikut cap jari, Pentadbir Platform sahaja.
-- Gunakan stub local_only (test.uid / test.role). Jangan jalankan pada Supabase sebenar.

insert into companies(id,code,name) values ('00000000-0000-0000-0000-0000000000c1','MTB','MUSLIMTRAVELBUG SDN BHD');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,4) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp,ic_no) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000a001','SADAM','Sadam','60110000001','800101-14-0001'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','AMIN BIN ALI','Amin','60110000004','950505-14-0004');
insert into employments(id,person_id,company_id,employee_no,status,join_date) values
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','MTB003','active','2025-03-01');
insert into platform_admins(person_id) values ('00000000-0000-0000-0000-000000000001');

\echo '=== R1: pekerja melaporkan ralat (laluan tanpa query string) ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a004';
select log_client_error('TypeError: x is undefined at row 12', E'TypeError\n    at f (app.js:1:2)', '/kelulusan?token=rahsia', 'Mozilla', 'abc123', '00000000-0000-0000-0000-0000000000c1');
select log_client_error('TypeError: x is undefined at row 13', E'TypeError\n    at f (app.js:1:2)', '/kelulusan', 'Mozilla', 'abc123', '00000000-0000-0000-0000-0000000000c1');
-- ralat sama berulang: dihadkan 5 sejam
select log_client_error('Ralat berulang', null, '/utama') from generate_series(1, 10);
\set ON_ERROR_STOP 0
select * from client_errors;
select sa_client_errors(7);
\set ON_ERROR_STOP 1
reset test.uid; reset test.role;
do $$ begin
  assert (select count(*) from client_errors) = 7, 'dua ralat + 5 ralat berulang';
  assert not exists (select 1 from client_errors where path like '%token%'), 'query string dibuang';
  assert (select count(distinct fingerprint) from client_errors) = 2, 'ralat dengan nombor berbeza dikumpulkan';
end $$;

\echo '=== R2: tanpa log masuk (anon) ==='
set test.role='anon';
select log_client_error('ChunkLoadError', null, '/masuk', 'Safari', null, '00000000-0000-0000-0000-0000000000c1');
reset test.role;
do $$ begin
  assert (select company_id from client_errors where message = 'ChunkLoadError') is null, 'syarikat tidak disimpan bagi bukan ahli';
end $$;

\echo '=== R3: Pentadbir Platform melihat ringkasan ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a001';
select message, path, count, users, companies from sa_client_errors(7);
do $$ begin
  assert (select count from sa_client_errors(7) where message like 'TypeError%') = 2, 'dikumpulkan';
  assert (select companies from sa_client_errors(7) where message like 'TypeError%') = 'MTB', 'kod syarikat';
end $$;
