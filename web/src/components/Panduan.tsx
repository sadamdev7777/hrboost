"use client";

import { tr } from "@/lib/i18n";
import { useSyncExternalStore } from "react";

/**
 * Panduan ringkas setiap skrin HR.
 * Kali pertama skrin dibuka: kad panduan dipaparkan di atas kandungan (tidak menghalang kerja).
 * Selepas "Faham": kad disorok; butang "?" di pengepala memaparkannya semula.
 */
export const PANDUAN: Record<string, { tajuk: string; langkah: string[] }> = {
  papan: {
    tajuk: tr("Papan Pemuka: mulakan hari anda di sini"),
    langkah: [
      tr("PERLU TINDAKAN ANDA menyenaraikan semua yang menunggu anda: kelulusan, pengesahan jawatan, akaun bank, kontrak dan permit yang hampir tamat."),
      tr("TARIKH AKHIR BERKANUN mengingatkan KWSP, PERKESO, PCB dan Borang EA. Tekan Tanda dihantar selepas anda membuat bayaran."),
      tr("Tekan Ctrl K (atau ikon carian) untuk mencari pekerja atau terus ke mana-mana skrin."),
    ],
  },
  pekerja: {
    tajuk: tr("Pekerja: tambah, cari dan urus"),
    langkah: [
      tr("Tekan Tambah pekerja untuk seorang. Untuk ramai sekali gus, gunakan import Excel dalam persediaan syarikat."),
      tr("Tandakan beberapa pekerja untuk pindah jabatan atau hantar semula jemputan sekali gus. Anda boleh tekan Buat asal jika tersilap."),
      tr("Tekan nama pekerja untuk melihat profil penuh: gaji, cuti, kehadiran, dokumen dan tarikh tamat."),
    ],
  },
  gaji: {
    tajuk: tr("Proses gaji dalam 4 langkah"),
    langkah: [
      tr("Semak data: pastikan setiap pekerja ada gaji pokok. Komisen dan elaun bulan ini ditambah di sini."),
      tr("Kira: semak SEMAKAN PINTAR, iaitu perkara luar biasa seperti perubahan gaji lebih 10% atau akaun bank tiada."),
      tr("Kelulusan: hantar kepada Kewangan dan CEO. Mereka menerima WhatsApp."),
      tr("Bayar: muat turun fail bank, KWSP, PERKESO dan PCB, kemudian tandakan dibayar. Slip dihantar kepada pekerja."),
    ],
  },
  laporan: {
    tajuk: tr("Laporan siap guna"),
    langkah: [
      tr("Pilih laporan di atas, kemudian pilih tempoh (atau tekan Bulan ini, Suku ini, Tahun ini)."),
      tr("Tekan Eksport CSV untuk membuka laporan dalam Excel."),
      tr("Laporan kos gaji hanya untuk HR dan Kewangan; setiap akses direkodkan."),
    ],
  },
  tetapan: {
    tajuk: tr("Tetapan syarikat"),
    langkah: [
      tr("Mulakan dengan Jabatan & Ketua: ketua jabatan menjadi pelulus pertama pasukannya."),
      tr("Aliran Kelulusan menentukan siapa meluluskan cuti, tuntutan dan gaji."),
      tr("Gunakan carian di atas untuk mencari tetapan dengan cepat."),
    ],
  },
};

const kunci = (id: string) => tr("hrb_panduan_{0}", id);
const PERISTIWA = "hrb-panduan";

function baca(id: string): "baru" | "tutup" | "buka" {
  try {
    const v = localStorage.getItem(kunci(id));
    // Pelayar automasi (ujian) tidak dipaparkan panduan kali pertama secara automatik.
    return v === "tutup" ? "tutup" : v === "buka" ? "buka" : navigator.webdriver ? "tutup" : "baru";
  } catch {
    return "tutup";
  }
}
function tulis(id: string, v: "tutup" | "buka") {
  try {
    localStorage.setItem(kunci(id), v);
  } catch {
    /* storan disekat */
  }
  window.dispatchEvent(new Event(PERISTIWA));
}
function langgan(cb: () => void) {
  window.addEventListener(PERISTIWA, cb);
  return () => window.removeEventListener(PERISTIWA, cb);
}

function useKeadaan(id: string) {
  return useSyncExternalStore(
    langgan,
    () => baca(id),
    () => "tutup" as const,
  );
}

/** Butang "?" untuk pengepala. */
export function ButangBantuan({ id }: { id: string }) {
  const k = useKeadaan(id);
  const buka = k !== "tutup";
  return (
    <button
      type="button"
      aria-label={tr("Panduan skrin ini")}
      aria-expanded={buka}
      onClick={() => tulis(id, buka ? "tutup" : "buka")}
      className={`flex size-10 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold ${buka ? "bg-primary text-white" : "bg-surface text-primary"}`}
    >
      ?
    </button>
  );
}

/** Kad panduan (dipaparkan kali pertama, atau selepas butang "?" ditekan). */
export function KadPanduan({ id }: { id: string }) {
  const k = useKeadaan(id);
  const p = PANDUAN[id];
  if (!p || k === "tutup") return null;
  return (
    <section aria-label={tr("Panduan")} className="flex flex-col gap-2 rounded-card border border-[#CFE6E1] bg-[#F1F8F6] px-4 py-3.5 lg:px-5">
      <div className="flex items-start justify-between gap-3">
        <b className="text-sm font-extrabold text-primary">{p.tajuk}</b>
        {k === "baru" && <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-white">{tr("Panduan")}</span>}
      </div>
      <ol className="m-0 flex flex-col gap-1.5 pl-5 text-[13px] leading-snug text-[#33433F]">
        {p.langkah.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ol>
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-[11px] text-muted">{tr("Tekan ? di bahagian atas untuk melihat panduan ini semula.")}</span>
        <button type="button" onClick={() => tulis(id, "tutup")} className="flex min-h-10 shrink-0 items-center rounded-full bg-primary px-4 text-[13px] font-bold text-white">
          {tr("Faham")}</button>
      </div>
    </section>
  );
}
