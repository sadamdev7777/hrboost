-- =====================================================================
--  DATA DEMO — TEMPATAN SAHAJA
--  Dijalankan oleh `supabase db reset` pada pangkalan data tempatan.
--  Jangan jalankan pada staging / produksi. Semua nama, nombor telefon dan
--  nombor IC di bawah ialah rekaan.
--
--  Log masuk di http://localhost:3000/masuk dengan nombor di bawah
--  (tanpa 60 di hadapan) dan kod 123456 (lihat [auth.sms.test_otp] dalam config.toml).
--    10 000 0001  Sadam  — CEO + Pentadbir
--    10 000 0002  Lily   — HR
--    10 000 0003  Zuerin — Ketua Jabatan Pelancongan
--    10 000 0004  Amin   — Pekerja, Pelancongan
--    10 000 0005  Farah  — Kewangan
--    10 000 0006  Zulfa  — Pekerja, Pelancongan
--    10 000 0007  Owner  — Pentadbir Platform (bukan pekerja)
--    10 000 0008/9     — dikhaskan untuk pekerja baharu dalam ujian jemputan (e2e)
-- =====================================================================

-- Pengguna auth (telefon sahaja). Lajur token mesti '' (bukan NULL) untuk GoTrue.
insert into auth.users (id, instance_id, aud, role, phone, phone_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change,
                        phone_change, phone_change_token, reauthentication_token, email_change_token_current)
select ('00000000-0000-0000-0000-00000000a00' || g)::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', '6010000000' || g, now(),
       '{"provider":"phone","providers":["phone"]}', '{}', now(), now(),
       '', '', '', '', '', '', '', ''
  from generate_series(1, 7) g;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'phone',
       jsonb_build_object('sub', u.id::text, 'phone', u.phone, 'phone_verified', true), now(), now(), now()
  from auth.users u where u.phone like '6010000000_';

insert into companies (id, code, name, accounting_system) values
  ('00000000-0000-0000-0000-0000000000c1', 'DEMO', 'SYARIKAT DEMO SDN BHD', 'none');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c1');

insert into persons (id, auth_user_id, full_name, preferred_name, phone_whatsapp, ic_no, gender) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000a001', 'Mohd Sadam bin Demo',   'Sadam',  '60100000001', '800101-14-0001', 'L'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000a002', 'Lily binti Demo',       'Lily',   '60100000002', '900202-14-0002', 'P'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000a003', 'Zuerin binti Demo',     'Zuerin', '60100000003', '880303-14-0003', 'P'),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000a004', 'Amin bin Demo',         'Amin',   '60100000004', '951109-14-1234', 'L'),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-00000000a005', 'Farah binti Demo',      'Farah',  '60100000005', '920505-14-5555', 'P'),
  ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-00000000a006', 'Zulfa binti Demo',      'Zulfa',  '60100000006', '961107-14-6666', 'P'),
  ('00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-00000000a007', 'Pemilik Platform Demo', 'Owner',  '60100000007', null,             null);

insert into platform_admins values ('00000000-0000-0000-0000-000000000007');

insert into departments (id, company_id, name, head_person_id) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'Pelancongan', '00000000-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c1', 'Pengurusan',  '00000000-0000-0000-0000-000000000001');

insert into employments (id, person_id, company_id, employee_no, department_id, status, join_date) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'DEMO001', '00000000-0000-0000-0000-0000000000d2', 'active', '2015-01-01'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c1', 'DEMO002', '00000000-0000-0000-0000-0000000000d2', 'active', '2020-01-01'),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000c1', 'DEMO003', '00000000-0000-0000-0000-0000000000d1', 'active', '2019-01-01'),
  ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000c1', 'DEMO004', '00000000-0000-0000-0000-0000000000d1', 'active', '2025-03-01'),
  ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-0000000000c1', 'DEMO005', '00000000-0000-0000-0000-0000000000d2', 'active', '2021-01-01'),
  ('00000000-0000-0000-0000-0000000000e6', '00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-0000000000c1', 'DEMO006', '00000000-0000-0000-0000-0000000000d1', 'active', '2024-01-01');

insert into user_roles (person_id, company_id, role) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'ceo'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'admin'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c1', 'hr'),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-0000000000c1', 'finance');

-- Pekerja demo sedia ada dianggap telah melengkapkan orientasi (8 langkah)
insert into onboarding_progress (employment_id, step)
select e.id, s from employments e
 cross join unnest(array['activate','name','selfie','bank','ic','personal','handbook','install']) s;

-- Cuti umum contoh (tarikh sebenar perlu diimport daripada sumber rasmi — lihat CLAUDE.md §8)
insert into public_holidays (holiday_date, name, is_mandatory) values
  ('2026-12-25', 'Hari Krismas', false);

-- Kehadiran minggu ini untuk Amin (contoh paparan tab Utama)
insert into attendance_records (employment_id, work_date, clock_in, source)
select '00000000-0000-0000-0000-0000000000e4', d::date,
       (d::date + time '08:50' + (random() * interval '25 minutes')) at time zone 'Asia/Kuala_Lumpur', 'demo'
  from generate_series(date_trunc('week', current_date), current_date - 1, interval '1 day') d
 where extract(isodow from d) <= 5;

-- ---------------------------------------------------------------------
-- Hook "Send SMS" TEMPATAN: simpan kod OTP dalam dev.sms_outbox, tiada mesej dihantar.
-- Di staging/produksi hook ini ialah Edge Function auth-sms-hook (WhatsApp melalui Murpati).
-- Baca kod terkini:  select * from dev.sms_outbox order by created_at desc limit 5;
-- ---------------------------------------------------------------------
create schema if not exists dev;
create table if not exists dev.sms_outbox (
  id         bigint generated always as identity primary key,
  phone      text not null,
  otp        text not null,
  created_at timestamptz not null default now()
);
create or replace function dev.send_sms_hook(event jsonb) returns jsonb
language plpgsql as $$
begin
  insert into dev.sms_outbox(phone, otp) values (event #>> '{user,phone}', event #>> '{sms,otp}');
  return '{}'::jsonb;
end $$;
grant usage on schema dev to supabase_auth_admin;
grant insert, select on dev.sms_outbox to supabase_auth_admin;
grant execute on function dev.send_sms_hook(jsonb) to supabase_auth_admin;
revoke execute on function dev.send_sms_hook(jsonb) from public, anon, authenticated;
