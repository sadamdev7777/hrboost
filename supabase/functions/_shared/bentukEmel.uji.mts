// Ujian pembentuk e-mel notifikasi. Jalankan: node supabase/functions/_shared/bentukEmel.uji.mts
import { bentukEmel } from "./bentukEmel.ts";
const kes: [string, string, string, string][] = [
  ["Terdapat permohonan yang menunggu kelulusan anda: Cuti Tahunan Amin 3–4 Dis. Sila balas LULUS atau TOLAK <sebab>.", "ms", "Permohonan menunggu kelulusan anda", "/kelulusan"],
  ["A request is waiting for your approval: Annual leave Amin. Reply APPROVE or REJECT <reason>.", "en", "A request is waiting for your approval", "/kelulusan"],
  ['Peringatan: permohonan "Cuti" daripada Amin masih menunggu kelulusan anda. Sila balas LULUS atau TOLAK <sebab>.', "ms", "Permohonan menunggu kelulusan anda", "/kelulusan"],
  ['Amin, permohonan anda "Cuti Tahunan" telah diluluskan.', "ms", "Permohonan anda diluluskan", "/permohonan"],
  ['Amin, your request "Annual leave" has been rejected. Please check the reason in the app.', "en", "Your request was rejected", "/permohonan"],
  ["Assalamualaikum Farah, Amin (Pelancongan) memohon Cuti Tahunan 3 Dis (1 hari) dan menamakan anda sebagai pengganti tugas. Sila atur serah tugas.", "ms", "Anda dinamakan sebagai pengganti tugas", "/utama"],
  ["Amin (Pelancongan) memohon Cuti Tahunan 3 Dis (1 hari). Pengganti tugas: Farah.", "ms", "Permohonan cuti baharu", "/kelulusan"],
  ["Slip gaji November 2026 anda telah tersedia. Buka aplikasi HRBoost → Saya → Slip Gaji untuk melihat.", "ms", "Slip gaji anda telah tersedia", "/gaji"],
  ["Your November 2026 payslip is ready. Open the HRBoost app → Me → Payslip to view it.", "en", "Your payslip is ready", "/gaji"],
  ["Pengumuman SYARIKAT DEMO:\nMajlis makan malam", "ms", "Pengumuman syarikat", "/pengumuman"],
  ["Assalamualaikum Amin, anda dijemput menyertai SYARIKAT DEMO di HRBoost. Buka pautan ini dan sahkan 4 digit akhir kad pengenalan anda: https://hrboost.io/jemputan/abc123", "ms", "Jemputan menyertai HRBoost", "https://hrboost.io/jemputan/abc123"],
  ["Peringatan: hari gaji November 2026 ialah 28 Nov (3 hari lagi). Gaji bulan ini belum diluluskan.", "ms", "Peringatan hari gaji", "/pengurusan/gaji"],
  ["Peringatan: KWSP bagi gaji Oktober 2026 perlu dihantar sebelum 15 Nov (2 hari lagi).", "ms", "Peringatan tarikh akhir caruman berkanun", "/pengurusan/gaji"],
  ["Ujian e-mel HRBoost: jika anda menerima mesej ini, notifikasi e-mel berfungsi dengan baik.", "en", "Ujian", "/admin/tetapan"],
  ["HR telah mengeluarkan Surat amaran untuk anda (DEMO/HR/2026/0002). Lihat di HRBoost → Mohon → Surat.", "ms", "HR telah mengeluarkan surat untuk anda", "/mohon/surat"],
  ["Mesej rawak tanpa padanan", "ms", "Pemberitahuan HRBoost", "/utama"],
];
let gagal = 0;
for (const [m, b, s, l] of kes) {
  const e = bentukEmel(m, b, "https://hrboost.io");
  const ok = (e.subjek.startsWith(s) || (s === "Ujian" && e.subjek.startsWith("HRBoost email test"))) && e.laluan.endsWith(l) && !/LULUS atau TOLAK|APPROVE or REJECT/.test(e.mesej);
  if (!ok) gagal++;
  console.log(ok ? "✔" : "✘", e.subjek, "→", e.laluan, "|", e.butang, "|", e.mesej.replace(/\n/g, "⏎").slice(0, 110));
}
console.log(gagal ? `GAGAL ${gagal}` : "LULUS semua");
if (gagal) process.exit(1);
