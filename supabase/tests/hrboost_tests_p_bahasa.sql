\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian bahasa: mesej WhatsApp mengikut bahasa penerima (persons.language).
insert into companies(id,code,name) values ('00000000-0000-0000-0000-0000000000c1','MTB','MTB');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c1');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,9) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp,language) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','LILY','Lily','60110000002','en'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','AMIN','Amin','60110000004','ms');

\echo '=== P1: lalai bahasa = English ==='
insert into persons(full_name, phone_whatsapp) values ('BARU','60110000099') returning language;

\echo '=== P2: terjemahan mesej ==='
select translate_message(m, 'en') as en from (values
 ('Slip gaji November 2026 anda telah tersedia. Buka aplikasi HRBoost → Saya → Slip Gaji untuk melihatnya.'),
 ('Peringatan: Caruman KWSP bagi gaji Oktober 2026 perlu dihantar sebelum 15/11/2026 (5 hari lagi). Fail boleh dimuat turun di HRBoost → Gaji → Sejarah.'),
 ('Amin, permohonan anda "Cuti Tahunan 23 Dis" telah diluluskan.'),
 ('Terdapat permohonan yang menunggu kelulusan anda: Kerja lebih masa 3 jam · 9 Nov. Sila balas LULUS atau TOLAK <sebab>.'),
 (E'Pengumuman MTB:\n*Cuti umum ganti*\nIsnin 10 Mac ialah cuti umum ganti.'),
 (E'Ringkasan HR Isnin, 9 Nov:\n• 3 permohonan menunggu kelulusan (1 melepasi tempoh)\n• Hari ini: 2 pekerja bercuti / MC, 1 lewat masuk\n• Caruman KWSP perlu dihantar dalam 5 hari\n\nButiran di HRBoost → Papan Pemuka.'),
 ('Mesej yang tiada dalam kamus kekal seperti asal.')
) v(m);
select translate_message('Slip gaji November 2026 anda telah tersedia. Buka aplikasi HRBoost → Saya → Slip Gaji untuk melihatnya.', 'ms') = 'Slip gaji November 2026 anda telah tersedia. Buka aplikasi HRBoost → Saya → Slip Gaji untuk melihatnya.' as ms_kekal;

\echo '=== P3: notify_person ikut bahasa penerima ==='
select notify_person('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c1', 'Permohonan surat anda tidak dapat diproses: Sila lampirkan dokumen.');
select notify_person('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000c1', 'Permohonan surat anda tidak dapat diproses: Sila lampirkan dokumen.');
select p.preferred_name, n.message from notifications n join persons p on p.id = n.person_id order by 1;

\echo '=== P4: set_my_language ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a004';
select set_my_language('en');
\set ON_ERROR_STOP 0
select set_my_language('fr');
\set ON_ERROR_STOP 1
reset test.role; reset test.uid;
select language from persons where id = '00000000-0000-0000-0000-000000000004';
