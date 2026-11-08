\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian Fasa C: balasan WhatsApp (LULUS / TOLAK), giliran notifikasi & had penggunaan.

-- ===== SETUP =====
insert into companies(id,code,name) values ('00000000-0000-0000-0000-0000000000c1','MTB','MUSLIMTRAVELBUG SDN BHD');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c1');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,6) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000a001','Mohd Saddam','Sadam','60110000001'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','HR Satu','Lily','60110000002'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000a003','Zuerin','Zuerin','60110000003'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','Amin','Amin','60110000004'),
 ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-00000000a006','Zulfa','Zulfa','60110000006');
insert into departments(id,company_id,name,head_person_id) values
 ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','Tour','00000000-0000-0000-0000-000000000003'),
 ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000c1','CEO Office','00000000-0000-0000-0000-000000000001');
insert into employments(id,person_id,company_id,employee_no,department_id,status,join_date) values
 ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','MTB001','00000000-0000-0000-0000-0000000000d2','active','2015-01-01'),
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB002','00000000-0000-0000-0000-0000000000d2','active','2020-01-01'),
 ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1','MTB003','00000000-0000-0000-0000-0000000000d1','active','2019-01-01'),
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','MTB004','00000000-0000-0000-0000-0000000000d1','active','2025-03-01'),
 ('00000000-0000-0000-0000-0000000000e6','00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-0000000000c1','MTB006','00000000-0000-0000-0000-0000000000d1','active','2024-01-01');
insert into user_roles(person_id,company_id,role) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','ceo'),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','admin'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr');
insert into public_holidays(holiday_date,name) values ('2026-12-25','Krismas');

\echo '=== C1: format nombor ==='
select normalize_msisdn('+60 11-000 0003') a, normalize_msisdn('011-000 0003') b, normalize_msisdn('110000003') c;

\echo '=== C2: Amin mohon cuti (PIC: Zulfa) dan Zulfa mohon cuti -> Zuerin ada 2 tugasan ==='
set test.role = 'service_role';
select status from submit_leave('00000000-0000-0000-0000-0000000000e4','AL','2026-12-23','2026-12-28','full','Balik kampung',null,'whatsapp','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000006');
select status from submit_leave('00000000-0000-0000-0000-0000000000e6','AL','2027-01-11','2027-01-12','full',null,null,'web','00000000-0000-0000-0000-000000000006');
select process_hr_events() as event_diproses;
select p.preferred_name kepada, n.message from notifications n join persons p on p.id=n.person_id
 where n.message like 'Terdapat permohonan%' or n.message like '%pengganti tugas%' order by p.preferred_name, n.message;

\echo '=== C3: balasan WhatsApp ==='
select whatsapp_handle_reply('60119999999','LULUS')->>'action' as nombor_asing;
select whatsapp_handle_reply('+60 11-000 0003','Berapa baki cuti saya?')->>'action' as teks_bebas;
select r->>'action' tindakan, r->>'reply' balasan from whatsapp_handle_reply('011-000 0003','lulus') r;
select r->>'action' tindakan, r->>'reply' balasan from whatsapp_handle_reply('60110000003','TOLAK 2') r;
select r->>'action' tindakan, r->>'reply' balasan from whatsapp_handle_reply('60110000003','TOLAK 9 sebab') r;
select r->>'action' tindakan, r->>'reply' balasan from whatsapp_handle_reply('60110000003','TOLAK 2 Pasukan tidak mencukupi minggu itu') r;
select r->>'action' tindakan, r->>'reply' balasan from whatsapp_handle_reply('60110000003','LULUS') r;
select r->>'action' tindakan, r->>'reply' balasan from whatsapp_handle_reply('60110000003','LULUS') r;

\echo '--- HR & CEO lulus melalui WhatsApp -> Amin diluluskan, PIC dimaklumkan'
select whatsapp_handle_reply('60110000002','Lulus')->>'action' as hr;
select whatsapp_handle_reply('60110000001','LULUS.')->>'reply' as ceo;
select lr.status, (select string_agg(distinct a.via::text, ',') from approval_actions a where a.request_id = lr.approval_request_id and a.action='approved') saluran
  from leave_requests lr where lr.employment_id='00000000-0000-0000-0000-0000000000e4';
select status from leave_requests where employment_id='00000000-0000-0000-0000-0000000000e6';
select process_hr_events() >= 1 as event_diproses;
select p.preferred_name kepada, n.message from notifications n join persons p on p.id=n.person_id
 where n.message like 'Makluman: cuti%' or n.message like '%ditolak%' order by 1;

\echo '=== C4: giliran notify-sender ==='
select count(*) as menunggu from notifications where status='pending';
update companies set wa_monthly_limit = 3 where code='MTB';
select count(*) as diambil from notify_next(50);
select status, count(*) from notifications group by 1 order by 1;
select p.preferred_name kepada, n.bypass_limit, left(n.message, 60) mesej from notifications n join persons p on p.id=n.person_id
 where n.message like 'Makluman HRBoost%';
\echo '--- notis had hanya sekali sebulan'
select count(*) as diambil_lagi from notify_next(50);
select count(*) as notis_had from notifications where message like 'Makluman HRBoost%';
\echo '--- tanda dihantar / gagal (cuba semula maksimum 3 kali)'
select notify_mark(id, true, 'msg-1') from notifications where status='pending' and claimed_at is not null and not bypass_limit limit 1;
select notify_mark(id, false, null, 'Ralat rangkaian') from notifications where message like 'Makluman HRBoost%';
select status, attempts, claimed_at is null as boleh_cuba_lagi, error from notifications where message like 'Makluman HRBoost%';
select count(*) as dihantar from notifications where status='sent';

\echo '=== C5: keselamatan (mesti gagal tanpa service role) ==='
\set ON_ERROR_STOP 0
set test.role = 'authenticated'; set test.uid = '00000000-0000-0000-0000-00000000a003';
select whatsapp_handle_reply('60110000003','LULUS');
select notify_next(1);
\set ON_ERROR_STOP 1
