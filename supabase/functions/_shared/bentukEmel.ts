// =====================================================================
//  Bentuk e-mel notifikasi daripada teks notifikasi (yang ditulis untuk WhatsApp & loceng aplikasi).
//  - Subjek yang jelas mengikut jenis notifikasi (BM / English ikut bahasa penerima)
//  - Arahan khusus WhatsApp ("Sila balas LULUS atau TOLAK <sebab>") ditukar kepada arahan membuka aplikasi
//  - Butang terus ke halaman berkaitan dalam aplikasi
//  Teks notifikasi sudah diterjemah ke bahasa penerima (message_i18n), jadi corak padanan meliputi BM & English.
//  Modul tulen (tiada API Deno) supaya boleh diuji dengan Node.
// =====================================================================

export type EmelBentuk = { subjek: string; mesej: string; butang: string; laluan: string };

type Peraturan = {
  /** Padanan pada teks notifikasi (BM atau English) */
  corak: RegExp;
  ms: string;
  en: string;
  /** Laluan aplikasi bagi butang */
  laluan: string;
  /** Label butang (lalai: Buka HRBoost) */
  butang?: [string, string];
};

const BUKA: [string, string] = ["Buka HRBoost", "Open HRBoost"];
const LULUS: [string, string] = ["Lihat & luluskan", "Review & approve"];

// Disusun daripada yang paling khusus. Peraturan pertama yang sepadan digunakan.
const PERATURAN: Peraturan[] = [
  // Kelulusan
  { corak: /menunggu kelulusan anda|waiting for your approval/i, ms: "Permohonan menunggu kelulusan anda", en: "A request is waiting for your approval", laluan: "/kelulusan", butang: LULUS },
  { corak: /tidak selesai dalam tempoh hari yang sama|was not completed on the same day/i, ms: "Permohonan belum selesai hari ini", en: "Request not completed today", laluan: "/kelulusan", butang: LULUS },
  { corak: /dikembalikan untuk pembetulan|returned for correction/i, ms: "Permohonan dikembalikan untuk pembetulan", en: "Request returned for correction", laluan: "/permohonan" },
  { corak: /permohonan anda ".*" telah ditolak|your request ".*" has been rejected/i, ms: "Permohonan anda ditolak", en: "Your request was rejected", laluan: "/permohonan" },
  { corak: /permohonan anda ".*" telah diluluskan|your request ".*" has been approved/i, ms: "Permohonan anda diluluskan", en: "Your request has been approved", laluan: "/permohonan" },

  // Cuti & pengganti tugas
  { corak: /menamakan anda sebagai pengganti tugas|named you as (the )?cover person/i, ms: "Anda dinamakan sebagai pengganti tugas", en: "You have been named as cover person", laluan: "/utama" },
  { corak: /Anda ialah pengganti tugas|You are the cover person/i, ms: "Cuti diluluskan: anda pengganti tugas", en: "Leave approved: you are the cover person", laluan: "/utama" },
  { corak: /Pengganti tugas:|Cover person:/i, ms: "Permohonan cuti baharu", en: "New leave application", laluan: "/kelulusan" },

  // Kehadiran
  { corak: /mendaftar masuk pada pukul|recorded your check-in at/i, ms: "Rekod lewat masuk hari ini", en: "Late check-in recorded today", laluan: "/kehadiran" },
  { corak: /lewat masuk kali ke-|was late for the/i, ms: "Pekerja lewat masuk", en: "Employee late check-in", laluan: "/pengurusan/kehadiran" },

  // Gaji
  { corak: /waktu kerja bermula pada|work starts at/i, ms: "Peringatan daftar masuk", en: "Check-in reminder", laluan: "/utama" },
  { corak: /waktu kerja tamat pada|work ends at/i, ms: "Peringatan daftar keluar", en: "Check-out reminder", laluan: "/utama" },
  { corak: /hari gaji|payday is/i, ms: "Peringatan hari gaji", en: "Payday reminder", laluan: "/pengurusan/gaji" },
  { corak: /perlu dihantar sebelum|must be submitted by/i, ms: "Peringatan tarikh akhir caruman berkanun", en: "Statutory submission deadline reminder", laluan: "/pengurusan/gaji" },
  { corak: /melaporkan kesilapan pada slip gaji|reported an error on the/i, ms: "Laporan kesilapan slip gaji", en: "Payslip error reported", laluan: "/pengurusan/gaji" },
  { corak: /menyemak laporan slip gaji anda|reviewed your payslip report/i, ms: "Laporan slip gaji anda telah disemak", en: "Your payslip report has been reviewed", laluan: "/gaji" },
  { corak: /Borang EA .* tersedia|Form EA is now available/i, ms: "Borang EA anda telah tersedia", en: "Your Form EA is available", laluan: "/gaji" },
  { corak: /Slip gaji .* tersedia|payslip is ready/i, ms: "Slip gaji anda telah tersedia", en: "Your payslip is ready", laluan: "/gaji" },
  { corak: /Memo pendahuluan gaji|Salary advance memo/i, ms: "Memo pendahuluan gaji", en: "Salary advance memo", laluan: "/pengurusan/gaji/pendahuluan" },
  { corak: /Pendahuluan gaji RM.* dibayar|salary advance of RM.* has been paid/i, ms: "Pendahuluan gaji telah dibayar", en: "Your salary advance has been paid", laluan: "/gaji" },

  // Surat
  { corak: /memohon surat pengesahan|requested an? (salary|employment) confirmation letter/i, ms: "Permohonan surat daripada pekerja", en: "Letter request from an employee", laluan: "/pengurusan/surat/permintaan" },
  { corak: /Permohonan surat anda tidak dapat diproses|letter request could not be processed/i, ms: "Permohonan surat tidak dapat diproses", en: "Letter request could not be processed", laluan: "/mohon/surat" },
  { corak: /HR telah mengeluarkan|HR has issued/i, ms: "HR telah mengeluarkan surat untuk anda", en: "HR has issued a letter for you", laluan: "/mohon/surat" },
  { corak: /Surat pengesahan .* telah dikeluarkan|confirmation letter has been issued/i, ms: "Surat anda telah dikeluarkan", en: "Your letter has been issued", laluan: "/mohon/surat" },

  // Komunikasi
  { corak: /^(Pengumuman|Announcement from) /i, ms: "Pengumuman syarikat", en: "Company announcement", laluan: "/pengumuman" },
  { corak: /^(Soalan daripada|Question from) /i, ms: "Soalan baharu daripada pekerja", en: "New question from an employee", laluan: "/pengurusan/soalan" },
  { corak: /^(Jawapan HR|HR's answer)/i, ms: "Jawapan HR kepada soalan anda", en: "HR has answered your question", laluan: "/tanya-hr" },

  // Kerja fleksibel, percubaan, prestasi
  { corak: /memohon susunan kerja fleksibel|requested a flexible working arrangement/i, ms: "Permohonan kerja fleksibel", en: "Flexible working request", laluan: "/pengurusan/kerja-fleksibel" },
  { corak: /susunan kerja fleksibel anda|flexible working arrangement request (was|has been)/i, ms: "Keputusan permohonan kerja fleksibel", en: "Flexible working request decision", laluan: "/mohon/kerja-fleksibel" },
  { corak: /Penilaian percubaan|probation review for/i, ms: "Penilaian percubaan perlu keputusan HR", en: "Probation review needs HR decision", laluan: "/pengurusan/orientasi" },
  { corak: /percubaan anda dilanjutkan|probation has been extended/i, ms: "Tempoh percubaan anda dilanjutkan", en: "Your probation has been extended", laluan: "/utama" },
  { corak: /telah dimuktamadkan|has been finalised/i, ms: "Keputusan penilaian prestasi anda", en: "Your performance review result", laluan: "/prestasi" },
  { corak: /menghantar penilaian kendiri|submitted a self-assessment/i, ms: "Penilaian kendiri perlu disemak", en: "Self-assessment ready for your review", laluan: "/prestasi" },
  { corak: /Penilaian prestasi .* dibuka|Performance review .* is open/i, ms: "Penilaian prestasi telah dibuka", en: "Performance review is open", laluan: "/prestasi" },

  // Inventori
  { corak: /merekod item inventori|recorded an inventory item/i, ms: "Item inventori perlu disemak", en: "Inventory item to review", laluan: "/pengurusan/inventori" },
  { corak: /Item inventori .* disahkan|Inventory item .* has been verified/i, ms: "Item inventori disahkan", en: "Inventory item verified", laluan: "/inventori" },
  { corak: /Item inventori .* dikembalikan|Inventory item .* was returned/i, ms: "Item inventori perlu dibetulkan", en: "Inventory item needs correction", laluan: "/inventori" },

  // Profil
  { corak: /akaun bank|bank account change/i, ms: "Pertukaran akaun bank", en: "Bank account change", laluan: "/profil" },
  { corak: /mengemas kini maklumat peribadi|updated your personal details/i, ms: "Maklumat peribadi anda dikemas kini", en: "Your personal details were updated", laluan: "/profil" },

  // Jemputan (pautan jemputan dalam teks menjadi butang)
  { corak: /dijemput menyertai|invited to join/i, ms: "Jemputan menyertai HRBoost", en: "Invitation to join HRBoost", laluan: "/masuk", butang: ["Aktifkan akaun", "Activate account"] },

  // Platform
  { corak: /akses .* (DILULUSKAN|ditolak)|access request (has been APPROVED|was rejected)/i, ms: "Keputusan permohonan akses", en: "Access request decision", laluan: "/utama" },
  { corak: /(minta|memohon) akses|requests? .* access/i, ms: "Permohonan akses syarikat", en: "Company access request", laluan: "/admin/akses" },
  { corak: /dinyahaktifkan|has been deactivated/i, ms: "Akaun syarikat dinyahaktifkan", en: "Company account deactivated", laluan: "/masuk" },
  { corak: /diaktifkan semula|has been reactivated/i, ms: "Akaun syarikat diaktifkan semula", en: "Company account reactivated", laluan: "/utama" },
  { corak: /had mesej|message limit/i, ms: "Had mesej bulanan telah habis", en: "Monthly message limit reached", laluan: "/pengurusan/tetapan" },
  { corak: /^(Mesej daripada Pentadbir Platform|Message from the HRBoost Platform Admin)/i, ms: "Mesej daripada HRBoost", en: "Message from HRBoost", laluan: "/utama" },
  { corak: /Ujian e-mel HRBoost|HRBoost email test/i, ms: "Ujian e-mel HRBoost", en: "HRBoost email test", laluan: "/admin/tetapan" },
];

/** Arahan WhatsApp yang tidak sah dalam e-mel → arahan membuka aplikasi */
function tukarArahanWhatsApp(t: string): string {
  return t
    .replace(/\s*Sila balas LULUS atau TOLAK\s*<sebab>\.?/gi, " Buka HRBoost untuk meluluskan atau menolak.")
    .replace(/\s*Reply APPROVE or REJECT\s*<reason>\.?/gi, " Open HRBoost to approve or reject.")
    .replace(/\s*Balas LULUS atau TOLAK[^.]*\.?/gi, " Buka HRBoost untuk meluluskan atau menolak.")
    .replace(/\s*Reply APPROVE or REJECT[^.]*\.?/gi, " Open HRBoost to approve or reject.");
}

/** "Assalamualaikum Ali, teks" → salam pada baris sendiri (gaya e-mel) */
function salamBarisSendiri(t: string): string {
  const m = /^(Assalamualaikum [^,\n]{1,60}),\s*(.+)$/s.exec(t);
  if (!m) return t;
  return `${m[1]},\n\n${m[2].charAt(0).toUpperCase()}${m[2].slice(1)}`;
}

/** Pautan pertama dalam teks (cth. pautan jemputan), jika ada */
function pautanDalam(t: string): string | null {
  return /(https?:\/\/[^\s<>"]+)/.exec(t)?.[1]?.replace(/[.,)]+$/, "") ?? null;
}

/**
 * Bentuk e-mel bagi satu notifikasi.
 * @param mesej teks notifikasi (bahasa penerima)
 * @param bahasa 'ms' | 'en'
 * @param app alamat aplikasi, cth. https://hrboost.io
 */
export function bentukEmel(mesej: string, bahasa: string, app: string): EmelBentuk {
  const en = bahasa !== "ms";
  const asas = app.replace(/\/$/, "");
  const p = PERATURAN.find((x) => x.corak.test(mesej));
  const teks = salamBarisSendiri(tukarArahanWhatsApp(mesej.trim()));
  const subjek = p ? (en ? p.en : p.ms) : en ? "HRBoost notification" : "Pemberitahuan HRBoost";
  const label = (p?.butang ?? BUKA)[en ? 1 : 0];
  // Jemputan: butang terus ke pautan jemputan dalam teks (pautan pada domain aplikasi sahaja)
  const dalam = pautanDalam(mesej);
  const laluan = p?.laluan === "/masuk" && dalam && dalam.startsWith(asas) ? dalam : asas + (p?.laluan ?? "/utama");
  return { subjek: `${subjek} · HRBoost`, mesej: teks, butang: label, laluan };
}
