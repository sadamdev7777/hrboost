-- =====================================================================
--  Mesej WhatsApp dalam bahasa penerima (persons.language).
--  Fungsi pangkalan data menulis mesej dalam Bahasa Melayu; sebelum disimpan dalam notifications,
--  mesej kepada penerima English diterjemah melalui jadual message_i18n (data, boleh dikemas kini):
--    message = ungkapan nalar untuk keseluruhan mesej, line = setiap baris (cth. ringkasan harian),
--    phrase  = frasa di dalam nilai (nama cuti, bulan, label berkanun).
--  Templat automasi yang diubah suai oleh HR kekal seperti ditulis jika tiada padanan.
-- =====================================================================
create table if not exists message_i18n (
  id       bigint generated always as identity primary key,
  kind     text not null check (kind in ('message','line','phrase')),
  ms       text not null,
  en       text not null,
  sort     int not null default 0,
  frasa    boolean not null default true,   -- terjemah frasa dalam nilai? (false: mesej membawa teks pengguna)
  unique (kind, ms)
);
alter table message_i18n enable row level security;
create policy read_i18n on message_i18n for select using (is_superadmin());

insert into message_i18n(kind, ms, en, sort) values
  ($q$message$q$, $q$^Permohonan akses baru: (.*) minta akses (\S+) ke (.*) \((\d+) hari\)\.$$q$, $q$New access request: \1 requests \2 access to \3 (\4 days).$q$, 0),
  ($q$message$q$, $q$^Makluman: (.*) memohon akses (\S+) ke syarikat anda\. Superadmin HRBoost akan membuat keputusan\.$$q$, $q$Notice: \1 has requested \2 access to your company. The HRBoost superadmin will decide.$q$, 1),
  ($q$message$q$, $q$^Permohonan akses anda DILULUSKAN sehingga (\S+)\.$$q$, $q$Your access request has been APPROVED until \1.$q$, 2),
  ($q$message$q$, $q$^Permohonan akses anda ditolak\.$$q$, $q$Your access request was rejected.$q$, 3),
  ($q$message$q$, $q$^Akaun syarikat anda di HRBoost telah dinyahaktifkan\. Sebab: (.*)$$q$, $q$Your company's HRBoost account has been deactivated. Reason: \1$q$, 4),
  ($q$message$q$, $q$^Akaun syarikat anda di HRBoost telah diaktifkan semula\.$$q$, $q$Your company's HRBoost account has been reactivated.$q$, 5),
  ($q$message$q$, $q$^Pertukaran akaun bank anda telah disahkan oleh HR\.$$q$, $q$Your bank account change has been confirmed by HR.$q$, 6),
  ($q$message$q$, $q$^Pertukaran akaun bank anda ditolak oleh HR\. Sebab: (.*)$$q$, $q$Your bank account change was rejected by HR. Reason: \1$q$, 7),
  ($q$message$q$, $q$^Assalamualaikum (.*), anda dijemput menyertai (.*) di HRBoost\. Buka pautan ini dan sahkan 4 digit akhir kad pengenalan anda: (\S+) \(sah selama 7 hari\)$$q$, $q$Assalamualaikum \1, you are invited to join \2 on HRBoost. Open this link and confirm the last 4 digits of your IC: \3 (valid for 7 days)$q$, 8),
  ($q$message$q$, $q$^Slip gaji (.*) anda telah tersedia\. Buka aplikasi HRBoost → Saya → Slip Gaji untuk melihatnya\.$$q$, $q$Your \1 payslip is ready. Open the HRBoost app → Me → Payslip to view it.$q$, 9),
  ($q$message$q$, $q$^Makluman HRBoost: had mesej WhatsApp bulan ini untuk syarikat anda telah habis\. Notifikasi seterusnya tidak dihantar sehingga bulan hadapan\. Hubungi HRBoost untuk menambah had\.$$q$, $q$HRBoost notice: your company's WhatsApp message limit for this month has been used up. Further notifications will not be sent until next month. Contact HRBoost to increase the limit.$q$, 10),
  ($q$message$q$, $q$^Mesej daripada Pentadbir Platform HRBoost: (.*)$$q$, $q$Message from the HRBoost Platform Admin: \1$q$, 11),
  ($q$message$q$, $q$^Peringatan: (.*) bagi gaji (\S+) (\d{4}) perlu dihantar sebelum (\S+) \((-?\d+) hari lagi\)\. Fail boleh dimuat turun di HRBoost → Gaji → Sejarah\.$$q$, $q$Reminder: \1 for \2 \3 payroll must be submitted by \4 (\5 days left). Files can be downloaded in HRBoost → Payroll → History.$q$, 12),
  ($q$message$q$, $q$^Peringatan: (.*) (\d{4}) perlu dihantar sebelum (\S+) \((-?\d+) hari lagi\)\. Fail boleh dimuat turun di HRBoost → Gaji → Sejarah\.$$q$, $q$Reminder: \1 \2 must be submitted by \3 (\4 days left). Files can be downloaded in HRBoost → Payroll → History.$q$, 13),
  ($q$message$q$, $q$^(.*) melaporkan kesilapan pada slip gaji (\S+) (\d{4}): "(.*)"\. Semak di HRBoost → Gaji sebelum gaji diluluskan\.$$q$, $q$\1 reported an error on the \2 \3 payslip: "\4". Review it in HRBoost → Payroll before payroll is approved.$q$, 14),
  ($q$message$q$, $q$^HR telah menyemak laporan slip gaji anda\. Lihat slip terkini di HRBoost → Saya → Slip Gaji\.$$q$, $q$HR has reviewed your payslip report. See the latest payslip in HRBoost → Me → Payslip.$q$, 15),
  ($q$message$q$, $q$^HR telah menyemak laporan slip gaji anda: (.*)\. Lihat slip terkini di HRBoost → Saya → Slip Gaji\.$$q$, $q$HR has reviewed your payslip report: \1. See the latest payslip in HRBoost → Me → Payslip.$q$, 16),
  ($q$message$q$, $q$^(.*) memohon surat pengesahan gaji \((.*)\)\. Keluarkan di HRBoost → Surat\.$$q$, $q$\1 has requested a salary confirmation letter (\2). Issue it in HRBoost → Letters.$q$, 17),
  ($q$message$q$, $q$^(.*) memohon surat pengesahan majikan \((.*)\)\. Keluarkan di HRBoost → Surat\.$$q$, $q$\1 has requested an employment confirmation letter (\2). Issue it in HRBoost → Letters.$q$, 18),
  ($q$message$q$, $q$^Surat pengesahan gaji anda telah dikeluarkan \((.*)\)\. Muat turun di HRBoost → Mohon → Surat\.$$q$, $q$Your salary confirmation letter has been issued (\1). Download it in HRBoost → Apply → Letters.$q$, 19),
  ($q$message$q$, $q$^Surat pengesahan majikan anda telah dikeluarkan \((.*)\)\. Muat turun di HRBoost → Mohon → Surat\.$$q$, $q$Your employment confirmation letter has been issued (\1). Download it in HRBoost → Apply → Letters.$q$, 20),
  ($q$message$q$, $q$^Permohonan surat anda tidak dapat diproses: (.*)$$q$, $q$Your letter request could not be processed: \1$q$, 21),
  ($q$message$q$, $q$^Pengumuman ([^\n]*):\n(.*)$$q$, $q$Announcement from \1:
\2$q$, 22),
  ($q$message$q$, $q$^Soalan daripada ([^:]*): "(.*)"\. Jawab di HRBoost → Soalan HR\.$$q$, $q$Question from \1: "\2". Answer it in HRBoost → HR Questions.$q$, 23),
  ($q$message$q$, $q$^Jawapan HR kepada soalan anda: "(.*?)"\n\n(.*)$$q$, $q$HR's answer to your question: "\1"

\2$q$, 24),
  ($q$message$q$, $q$^Pendahuluan gaji RM(\S+) telah dibayar\. Ia akan ditolak daripada gaji (\S+) (\d{4})\.$$q$, $q$Your salary advance of RM\1 has been paid. It will be deducted from your \2 \3 salary.$q$, 25),
  ($q$message$q$, $q$^(.*) memohon susunan kerja fleksibel\. Akta Kerja mewajibkan jawapan bertulis sebelum (\S+)\. Semak di HRBoost → Kerja fleksibel\.$$q$, $q$\1 has requested a flexible working arrangement. The Employment Act requires a written reply by \2. Review it in HRBoost → Flexible work.$q$, 26),
  ($q$message$q$, $q$^Permohonan susunan kerja fleksibel anda TIDAK DILULUSKAN(.*)\. Butiran di HRBoost → Mohon → Kerja fleksibel\.$$q$, $q$Your flexible working arrangement request was NOT APPROVED\1. Details in HRBoost → Apply → Flexible work.$q$, 27),
  ($q$message$q$, $q$^Permohonan susunan kerja fleksibel anda DILULUSKAN(.*)\. Butiran di HRBoost → Mohon → Kerja fleksibel\.$$q$, $q$Your flexible working arrangement request has been APPROVED\1. Details in HRBoost → Apply → Flexible work.$q$, 28),
  ($q$message$q$, $q$^Penilaian percubaan (.*) telah dihantar oleh ketua jabatan: cadangan SAHKAN JAWATAN\. Putuskan di HRBoost → Profil Pekerja\.$$q$, $q$The probation review for \1 has been submitted by the head of department: recommendation CONFIRM EMPLOYMENT. Decide in HRBoost → Employee Profile.$q$, 29),
  ($q$message$q$, $q$^Penilaian percubaan (.*) telah dihantar oleh ketua jabatan: cadangan LANJUT (\d+) BULAN\. Putuskan di HRBoost → Profil Pekerja\.$$q$, $q$The probation review for \1 has been submitted by the head of department: recommendation EXTEND \2 MONTHS. Decide in HRBoost → Employee Profile.$q$, 30),
  ($q$message$q$, $q$^Penilaian percubaan (.*) telah dihantar oleh ketua jabatan: cadangan TAMATKAN\. Putuskan di HRBoost → Profil Pekerja\.$$q$, $q$The probation review for \1 has been submitted by the head of department: recommendation TERMINATE. Decide in HRBoost → Employee Profile.$q$, 31),
  ($q$message$q$, $q$^Tempoh percubaan anda dilanjutkan sehingga (\S+)\. Sila berbincang dengan ketua jabatan anda\.$$q$, $q$Your probation has been extended until \1. Please discuss it with your head of department.$q$, 32),
  ($q$message$q$, $q$^Assalamualaikum (.*?), (.*?) \((.*?)\) memohon (.*?) (.*?) \((.*?) hari\) dan menamakan anda sebagai pengganti tugas\. Sila uruskan serahan tugas dengan (.*?)\. Status: (.*)\.$$q$, $q$Assalamualaikum \1, \2 (\3) has applied for \4 \5 (\6 days) and named you as cover person. Please arrange a handover with \7. Status: \8.$q$, 33),
  ($q$message$q$, $q$^(.*?) \((.*?)\) memohon (.*?) (.*?) \((.*?) hari\)\. Pengganti tugas: (.*)\.$$q$, $q$\1 (\2) has applied for \3 \4 (\5 days). Cover person: \6.$q$, 34),
  ($q$message$q$, $q$^Makluman: cuti (.*?) (.*?) telah diluluskan\. Anda ialah pengganti tugas sepanjang tempoh ini\.$$q$, $q$Notice: \1's leave on \2 has been approved. You are the cover person during this period.$q$, 35),
  ($q$message$q$, $q$^Assalamualaikum (.*?), sistem merekodkan anda mendaftar masuk pada pukul (.*?) hari ini \(lewat (.*?) minit\)\. Ini kali ke-(.*?) bagi bulan ini\. Sekiranya ada sebab, sila balas mesej ini\.$$q$, $q$Assalamualaikum \1, the system recorded your check-in at \2 today (\3 minutes late). This is time no. \4 this month. If there is a reason, please reply to this message.$q$, 36),
  ($q$message$q$, $q$^(.*?) lewat masuk kali ke-(.*?) bulan ini \(hari ini (.*?)\)\.$$q$, $q$\1 was late for the \2th time this month (today at \3).$q$, 37),
  ($q$message$q$, $q$^Terdapat permohonan yang menunggu kelulusan anda: (.*)\. Sila balas LULUS atau TOLAK <sebab>\.$$q$, $q$A request is waiting for your approval: \1. Reply APPROVE or REJECT <reason>.$q$, 38),
  ($q$message$q$, $q$^Peringatan: (.*) masih menunggu kelulusan anda\.$$q$, $q$Reminder: \1 is still waiting for your approval.$q$, 39),
  ($q$message$q$, $q$^(.*?), permohonan anda "(.*)" telah diluluskan\.$$q$, $q$\1, your request "\2" has been approved.$q$, 40),
  ($q$message$q$, $q$^(.*?), permohonan anda "(.*)" telah ditolak\. Sila semak sebabnya dalam aplikasi\.$$q$, $q$\1, your request "\2" has been rejected. Please check the reason in the app.$q$, 41),
  ($q$message$q$, $q$^(.*?), permohonan "(.*)" telah dikembalikan untuk pembetulan\.$$q$, $q$\1, the request "\2" has been returned for correction.$q$, 42),
  ($q$message$q$, $q$^Permohonan "(.*)" tidak selesai dalam tempoh hari yang sama\.$$q$, $q$The request "\1" was not completed on the same day.$q$, 43),
  ($q$line$q$, $q$^Ringkasan HR (\S+), (\d+) (\S+):$$q$, $q$HR summary \1, \2 \3:$q$, 44),
  ($q$line$q$, $q$^• (\d+) permohonan menunggu kelulusan \((\d+) melepasi tempoh\)$$q$, $q$• \1 requests awaiting approval (\2 overdue)$q$, 45),
  ($q$line$q$, $q$^• (\d+) permohonan menunggu kelulusan$$q$, $q$• \1 requests awaiting approval$q$, 46),
  ($q$line$q$, $q$^• Hari ini: (.*)$$q$, $q$• Today: \1$q$, 47),
  ($q$line$q$, $q$^• Pekerja baharu mula esok: (.*)$$q$, $q$• New employees starting tomorrow: \1$q$, 48),
  ($q$line$q$, $q$^• (.*) perlu dihantar hari ini$$q$, $q$• \1 due today$q$, 49),
  ($q$line$q$, $q$^• (.*) perlu dihantar dalam (\d+) hari$$q$, $q$• \1 due in \2 days$q$, 50),
  ($q$line$q$, $q$^• (\d+) perkara senarai semak pekerja baharu perlu disiapkan$$q$, $q$• \1 new-employee checklist items to complete$q$, 51),
  ($q$line$q$, $q$^• (\d+) kontrak / permit / pasport tamat dalam 7 hari$$q$, $q$• \1 contracts / permits / passports expiring within 7 days$q$, 52),
  ($q$line$q$, $q$^Butiran di HRBoost → Papan Pemuka\.$$q$, $q$Details in HRBoost → Dashboard.$q$, 53),
  ($q$phrase$q$, $q$Caruman KWSP$q$, $q$EPF contribution$q$, 54),
  ($q$phrase$q$, $q$Caruman PERKESO & SIP$q$, $q$SOCSO & EIS contribution$q$, 55),
  ($q$phrase$q$, $q$PCB \(CP39\)$q$, $q$PCB (CP39)$q$, 56),
  ($q$phrase$q$, $q$Levi HRD Corp$q$, $q$HRD Corp levy$q$, 57),
  ($q$phrase$q$, $q$Borang EA kepada pekerja$q$, $q$Form EA to employees$q$, 58),
  ($q$phrase$q$, $q$Borang E kepada LHDN$q$, $q$Form E to LHDN$q$, 59),
  ($q$phrase$q$, $q$(\d+) pekerja bercuti / MC$q$, $q$\1 on leave / MC$q$, 60),
  ($q$phrase$q$, $q$(\d+) lewat masuk$q$, $q$\1 late$q$, 61),
  ($q$phrase$q$, $q$Cuti Tahunan$q$, $q$Annual Leave$q$, 62),
  ($q$phrase$q$, $q$Cuti Sakit$q$, $q$Sick Leave$q$, 63),
  ($q$phrase$q$, $q$Cuti Kecemasan$q$, $q$Emergency Leave$q$, 64),
  ($q$phrase$q$, $q$Cuti Hospitalisasi$q$, $q$Hospitalisation Leave$q$, 65),
  ($q$phrase$q$, $q$Cuti Bersalin$q$, $q$Maternity Leave$q$, 66),
  ($q$phrase$q$, $q$Cuti Paterniti$q$, $q$Paternity Leave$q$, 67),
  ($q$phrase$q$, $q$Cuti Tanpa Gaji$q$, $q$Unpaid Leave$q$, 68),
  ($q$phrase$q$, $q$Tuntutan: $q$, $q$Claim: $q$, 69),
  ($q$phrase$q$, $q$Pembetulan kehadiran$q$, $q$Attendance correction$q$, 70),
  ($q$phrase$q$, $q$Kerja lebih masa$q$, $q$Overtime$q$, 71),
  ($q$phrase$q$, $q$Pendahuluan gaji$q$, $q$Salary advance$q$, 72),
  ($q$phrase$q$, $q$jam$q$, $q$hours$q$, 73),
  ($q$phrase$q$, $q$diluluskan$q$, $q$approved$q$, 74),
  ($q$phrase$q$, $q$ditolak$q$, $q$rejected$q$, 75),
  ($q$phrase$q$, $q$dikembalikan$q$, $q$returned$q$, 77),
  ($q$phrase$q$, $q$Isnin$q$, $q$Monday$q$, 78),
  ($q$phrase$q$, $q$Selasa$q$, $q$Tuesday$q$, 79),
  ($q$phrase$q$, $q$Rabu$q$, $q$Wednesday$q$, 80),
  ($q$phrase$q$, $q$Khamis$q$, $q$Thursday$q$, 81),
  ($q$phrase$q$, $q$Jumaat$q$, $q$Friday$q$, 82),
  ($q$phrase$q$, $q$Sabtu$q$, $q$Saturday$q$, 83),
  ($q$phrase$q$, $q$Ahad$q$, $q$Sunday$q$, 84),
  ($q$phrase$q$, $q$Januari$q$, $q$January$q$, 85),
  ($q$phrase$q$, $q$Februari$q$, $q$February$q$, 86),
  ($q$phrase$q$, $q$Mac$q$, $q$March$q$, 87),
  ($q$phrase$q$, $q$Mei$q$, $q$May$q$, 88),
  ($q$phrase$q$, $q$Julai$q$, $q$July$q$, 89),
  ($q$phrase$q$, $q$Ogos$q$, $q$August$q$, 90),
  ($q$phrase$q$, $q$Oktober$q$, $q$October$q$, 91),
  ($q$phrase$q$, $q$Disember$q$, $q$December$q$, 92),
  ($q$phrase$q$, $q$(\d) Ogo$q$, $q$\1 Aug$q$, 93),
  ($q$phrase$q$, $q$(\d) Okt$q$, $q$\1 Oct$q$, 94),
  ($q$phrase$q$, $q$(\d) Dis$q$, $q$\1 Dec$q$, 95),
  ($q$phrase$q$, $q$(\d) Mei$q$, $q$\1 May$q$, 96),
  ($q$phrase$q$, $q$(\d+\.?\d*) pg$q$, $q$\1 am$q$, 97),
  ($q$phrase$q$, $q$(\d+\.?\d*) ptg$q$, $q$\1 pm$q$, 98)
on conflict (kind, ms) do update set en = excluded.en, sort = excluded.sort;
-- Mesej yang mengandungi teks bebas pengguna (pengumuman, soalan, jawapan, sebab, nota): jangan ubah teks itu
update message_i18n set frasa = false where kind = 'message' and (
  ms like '^Pengumuman %' or ms like '^Soalan daripada %' or ms like '^Jawapan HR %' or ms like '^Mesej daripada Pentadbir %'
  or ms like '%Sebab: %' or ms like '^Permohonan surat anda tidak dapat diproses%' or ms like '%melaporkan kesilapan%'
  or ms like '^HR telah menyemak laporan slip gaji anda: %' or ms like '%kerja fleksibel anda %' or ms like '%memohon surat pengesahan%'
  or ms like '^Assalamualaikum (.*), anda dijemput%' or ms like '%Superadmin HRBoost akan membuat keputusan%' or ms like '^Permohonan akses baru%');

create or replace function translate_message(p_msg text, p_lang text) returns text
language plpgsql stable security definer set search_path = public as $$
declare r record; hasil text; padan boolean := false; frasa boolean := true; baris text[]; i int;
begin
  if p_msg is null or coalesce(p_lang, 'ms') <> 'en' then return p_msg; end if;
  for r in select ms, en, m.frasa from message_i18n m where kind = 'message' order by sort loop
    if p_msg ~ r.ms then
      hasil := regexp_replace(p_msg, r.ms, r.en);
      padan := true;
      frasa := r.frasa;
      exit;
    end if;
  end loop;
  if not padan then
    baris := string_to_array(p_msg, E'\n');
    for i in 1 .. coalesce(array_length(baris, 1), 0) loop
      for r in select ms, en from message_i18n where kind = 'line' order by sort loop
        if baris[i] ~ r.ms then
          baris[i] := regexp_replace(baris[i], r.ms, r.en);
          padan := true;
          exit;
        end if;
      end loop;
    end loop;
    if not padan then return p_msg; end if;
    hasil := array_to_string(baris, E'\n');
  end if;
  if not frasa then return hasil; end if;
  for r in select ms, en from message_i18n where kind = 'phrase' order by length(ms) desc, sort loop
    hasil := regexp_replace(hasil, case when r.ms ~ '^[[:alpha:]]' then '\m' else '' end || r.ms
                                   || case when r.ms ~ '[[:alpha:]]$' then '\M' else '' end, r.en, 'g');
  end loop;
  return hasil;
end $$;

create or replace function trg_notifications_i18n() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.person_id is not null then
    new.message := translate_message(new.message, (select language from persons where id = new.person_id));
  end if;
  return new;
end $$;
drop trigger if exists notifications_i18n on notifications;
create trigger notifications_i18n before insert on notifications for each row execute function trg_notifications_i18n();

revoke all on function translate_message(text, text) from public;
revoke all on function trg_notifications_i18n() from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function translate_message(text, text) from anon, authenticated;
    grant execute on function translate_message(text, text) to service_role;
  end if;
end $$;

-- Balasan WhatsApp (bahasa pelulus)
insert into message_i18n(kind, ms, en, sort, frasa) values
  ('message', $q$^Tiada permohonan yang menunggu kelulusan anda\.$$q$, $q$There are no requests waiting for your approval.$q$, 200, true),
  ('line', $q$^Ada (\d+) permohonan menunggu kelulusan anda:$$q$, $q$There are \1 requests waiting for your approval:$q$, 201, true),
  ('line', $q$^Balas LULUS 1 atau TOLAK 1 <sebab> \(tukar nombor mengikut senarai\)\.$$q$, $q$Reply APPROVE 1 or REJECT 1 <reason> (change the number to match the list).$q$, 202, true),
  ('message', $q$^Nombor (\d+) tiada dalam senarai\. Ada (\d+) permohonan menunggu\.$$q$, $q$Number \1 is not in the list. There are \2 pending requests.$q$, 203, true),
  ('message', $q$^Sila nyatakan sebab penolakan\. Contoh: TOLAK (\d+ )?Pasukan tidak mencukupi pada tarikh itu$$q$, $q$Please give a reason for rejecting. Example: REJECT \1Not enough team members on that date$q$, 204, true),
  ('message', $q$^Tindakan tidak berjaya: (.*)$$q$, $q$The action was not successful: \1$q$, 205, false),
  ('message', $q$^Diluluskan: (.*)\. Permohonan diteruskan ke peringkat seterusnya\.$$q$, $q$Approved: \1. The request moves on to the next level.$q$, 206, true),
  ('message', $q$^Diluluskan: (.*)\.$$q$, $q$Approved: \1.$q$, 207, true),
  ('message', $q$^Ditolak: (.*?)\. Sebab: (.*)\. Pemohon akan dimaklumkan\.$$q$, $q$Rejected: \1. Reason: \2. The requester will be notified.$q$, 208, false)
on conflict (kind, ms) do update set en = excluded.en, sort = excluded.sort, frasa = excluded.frasa;

-- Balasan WhatsApp: kata kunci English (APPROVE / REJECT) diterima; balasan dalam bahasa pelulus
create or replace function whatsapp_handle_reply(p_phone text, p_text text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ph text := normalize_msisdn(p_phone);
  p persons;
  t text := regexp_replace(trim(coalesce(p_text, '')), '\s+', ' ', 'g');
  u text;
  verb text; num int; reason text;
  tasks uuid[]; titles text[]; tid uuid; ttl text;
  m text[];
  r approval_requests;
  senarai text := '';
begin
  if not is_service_role() then raise exception 'Tidak dibenarkan'; end if;
  select * into p from persons where phone_whatsapp = ph and is_active;
  if p.id is null then
    return jsonb_build_object('action', 'unknown_sender',
      'reply', ('Nombor ini tidak berdaftar dengan HRBoost. Sila hubungi HR syarikat anda. / This number is not registered with HRBoost. Please contact your company HR.'));
  end if;

  u := upper(t);
  m := regexp_match(u, '^(LULUS|LULUSKAN|SETUJU|APPROVE|APPROVED)(?: +(\d{1,2}))?[.!]?$');
  if m is not null then
    verb := 'approve'; num := m[2]::int;
  else
    m := regexp_match(t, '^(?:[Tt][Oo][Ll][Aa][Kk]|[Rr][Ee][Jj][Ee][Cc][Tt])(?: +(\d{1,2}))?(?: +(.+))?$');
    if m is not null then
      verb := 'reject'; num := m[1]::int; reason := nullif(trim(m[2]), '');
    end if;
  end if;

  if verb is null then
    return jsonb_build_object('action', 'ai', 'person_id', p.id);
  end if;

  select array_agg(tk.id order by tk.created_at), array_agg(rq.title order by tk.created_at)
    into tasks, titles
    from approval_tasks tk join approval_requests rq on rq.id = tk.request_id
   where tk.approver_person_id = p.id and tk.status = 'pending' and rq.status = 'pending';

  if tasks is null then
    return jsonb_build_object('action', 'none', 'reply', translate_message('Tiada permohonan yang menunggu kelulusan anda.', p.language));
  end if;

  if num is null and array_length(tasks, 1) > 1 then
    for i in 1 .. array_length(tasks, 1) loop
      senarai := senarai || E'\n' || i || '. ' || titles[i];
    end loop;
    return jsonb_build_object('action', 'choose', 'reply', translate_message(
      'Ada ' || array_length(tasks, 1) || ' permohonan menunggu kelulusan anda:' || senarai
      || E'\n\nBalas LULUS 1 atau TOLAK 1 <sebab> (tukar nombor mengikut senarai).', p.language));
  end if;

  num := coalesce(num, 1);
  if num < 1 or num > array_length(tasks, 1) then
    return jsonb_build_object('action', 'invalid', 'reply', translate_message(
      'Nombor ' || num || ' tiada dalam senarai. Ada ' || array_length(tasks, 1) || ' permohonan menunggu.', p.language));
  end if;
  tid := tasks[num]; ttl := titles[num];

  if verb = 'reject' and reason is null then
    return jsonb_build_object('action', 'need_reason', 'reply', translate_message(
      'Sila nyatakan sebab penolakan. Contoh: TOLAK ' || case when array_length(tasks, 1) > 1 then num || ' ' else '' end
      || 'Pasukan tidak mencukupi pada tarikh itu', p.language));
  end if;

  begin
    r := approval_act(tid, verb, reason, 'whatsapp', p.id);
  exception when others then
    return jsonb_build_object('action', 'error', 'reply', translate_message('Tindakan tidak berjaya: ' || sqlerrm, p.language));
  end;

  return jsonb_build_object(
    'action', verb, 'task_id', tid, 'request_status', r.status,
    'reply', translate_message(case when verb = 'approve'
                  then 'Diluluskan: ' || ttl || case when r.status = 'pending' then '. Permohonan diteruskan ke peringkat seterusnya.' else '.' end
                  else 'Ditolak: ' || ttl || '. Sebab: ' || reason || '. Pemohon akan dimaklumkan.' end, p.language));
end $$;
