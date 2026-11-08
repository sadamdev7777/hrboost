\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian Fasa G: daftar syarikat (nombor disahkan OTP), persediaan 6 langkah, import pukal,
-- ketua jabatan, jemputan pukal (dijadualkan), konsol Pentadbir Platform (agregat sahaja).
-- Gunakan stub local_only (test.uid / test.role). Jangan jalankan pada Supabase sebenar tanpa penukaran.

-- Stub auth.users hanya mempunyai id: tambah lajur yang digunakan (dalam pangkalan data ujian ini sahaja)
alter table auth.users add column if not exists phone text, add column if not exists last_sign_in_at timestamptz;
insert into auth.users(id, phone, last_sign_in_at) select ('00000000-0000-0000-0000-00000000a00'||g)::uuid, '6010000000'||g, now()
  from generate_series(1,9) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp) values
 ('00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-00000000a007','PEMILIK PLATFORM','Owner','60100000007'),
 ('00000000-0000-0000-0000-000000000005',null,'MANGSA','Mangsa','60100000005');
insert into platform_admins values ('00000000-0000-0000-0000-000000000007');

\echo '=== G1: daftar syarikat menggunakan nombor yang disahkan OTP ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a008';
-- cubaan memautkan rekod orang lain dengan menghantar nombornya: diabaikan, nombor OTP digunakan
select register_company('Syarikat Kenari Sdn Bhd','1–10','Faizal bin Hashim','60100000005','faizal@kenari.my') as cid \gset
select p.full_name, p.phone_whatsapp, p.auth_user_id = '00000000-0000-0000-0000-00000000a008' as milik_pemanggil
  from persons p where p.auth_user_id = '00000000-0000-0000-0000-00000000a008';
select auth_user_id is null as mangsa_tidak_disentuh from persons where id = '00000000-0000-0000-0000-000000000005';
select code, name, size_band from companies where id = :'cid';
select array_agg(role order by role) as peranan from user_roles where company_id = :'cid';
\set ON_ERROR_STOP 0
select register_company('','1–10','X','601','');
\set ON_ERROR_STOP 1

\echo '=== G2: persediaan — kod, import pukal, ketua ==='
select set_company_code(:'cid', 'knr');
select s->>'code' kod, s->'steps' langkah from company_onboarding_state(:'cid') s;
select import_employees(:'cid', '[
  {"full_name":"Siti Aminah binti Ali","phone":"012-3456781","ic":"900101145678","department":"operasi","position":"Pengurus","join_date":"2020-03-01","basic":"4500","is_head":true},
  {"full_name":"Ahmad Firdaus","phone":"0198765432","ic":"950505101234","department":"Operasi","position":"Eksekutif","basic":"3000"},
  {"full_name":"Kamal","phone":"011-2222 3333","department":"Tiket"},
  {"full_name":"Aisyah","phone":"","department":"Akaun"},
  {"full_name":"Pendua","phone":"0198765432"},
  {"full_name":"Telefon Salah","phone":"12345"},
  {"full_name":""}
]') as hasil;
select e.employee_no, p.full_name, p.preferred_name, p.phone_whatsapp, d.name jabatan, (e.manager_person_id is not null) ada_pengurus
  from employments e join persons p on p.id = e.person_id left join departments d on d.id = e.department_id
 where e.company_id = :'cid' order by e.employee_no;
select name, head_person_id is not null as ada_ketua from departments where company_id = :'cid' order by name;
\set ON_ERROR_STOP 0
select complete_company_step(:'cid', 'departments');
\set ON_ERROR_STOP 1
select set_department_head(d.id, (select e.person_id from employments e where e.department_id = d.id limit 1))
  from departments d where d.company_id = :'cid' and d.head_person_id is null;
select (complete_company_step(:'cid', 'departments'))->>'departments_without_head' as tanpa_ketua;
select complete_company_step(:'cid', 'company') is not null, complete_company_step(:'cid', 'roles') is not null;

\echo '=== G3: jemputan pukal dijadualkan (Isnin 9 pagi) ==='
select name, has_whatsapp, token is not null as pautan_disalin
  from invite_pending(:'cid', 'https://hrboost.io', now() + interval '2 days') order by name;
select count(*) filter (where send_after > now()) as dijadualkan, count(*) filter (where to_address is null) as tanpa_wa from notifications;
select s->>'completed_at' is not null as persediaan_selesai, jsonb_array_length(s->'steps') langkah
  from company_onboarding_state(:'cid') s;
\set ON_ERROR_STOP 0
select set_company_code(:'cid', 'ABC');
\set ON_ERROR_STOP 1

\echo '=== G4: notify_next tidak mengambil mesej yang dijadualkan ==='
set test.role = 'service_role';
select count(*) as diambil_sekarang from notify_next(50);

\echo '=== G5: konsol Pentadbir Platform (agregat sahaja) ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a007';
select d->>'companies_active' aktif, d->>'staff_active' pekerja, d->>'onboarding_incomplete' belum_siap from sa_dashboard() d;
select d->>'name' nama, d->>'staff_total' jumlah, d->'admins' pentadbir from sa_company_detail(:'cid') d;
select d::text !~ '(900101|4500|bank)' as tiada_data_peribadi from sa_company_detail(:'cid') d;
select name, whatsapp, companies from sa_users('siti');
select sa_set_company_status(:'cid','suspended','Penyalahgunaan / spam');
select is_company_member(:'cid') as ahli_selepas_nyahaktif;
select sa_set_company_status(:'cid','active',null);
select sa_set_setting('warn_pct', '90');
select action from sa_audit_log('platform', 10) order by at;
\set ON_ERROR_STOP 0
select sa_set_setting('warn_pct', '5');
select sa_set_setting('kunci_rahsia', '"x"');
set test.uid='00000000-0000-0000-0000-00000000a008';
select sa_dashboard();
select sa_users('');
select sa_audit_log('all', 10);
\set ON_ERROR_STOP 1
