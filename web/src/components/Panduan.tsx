"use client";

import { tr } from "@/lib/i18n";
import { useSyncExternalStore } from "react";

/**
 * Panduan ringkas setiap skrin HR.
 * Kali pertama skrin dibuka: kad panduan dipaparkan di atas kandungan (tidak menghalang kerja).
 * Selepas "Faham" atau ×: kad disorok, dan panduan skrin lain juga tidak lagi dipaparkan secara automatik
 * (pengguna sudah tahu tentang butang "?"). Butang "?" di pengepala memaparkannya semula.
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
      tr("Pilih laporan di bawah, kemudian pilih tempoh (atau tekan Bulan ini, Suku ini, Tahun ini)."),
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

const kunci = (id: string) => `hrb_panduan_${id}`;
const KUNCI_SEMUA = "hrb_panduan_semua";
const PERISTIWA = "hrb-panduan";

function baca(id: string): "baru" | "tutup" | "buka" {
  try {
    const v = localStorage.getItem(kunci(id));
    // Pelayar automasi (ujian) tidak dipaparkan panduan kali pertama secara automatik.
    if (v === "tutup" || v === "buka") return v;
    return navigator.webdriver || localStorage.getItem(KUNCI_SEMUA) === "tutup" ? "tutup" : "baru";
  } catch {
    return "tutup";
  }
}
function tulis(id: string, v: "tutup" | "buka") {
  try {
    localStorage.setItem(kunci(id), v);
    if (v === "tutup") localStorage.setItem(KUNCI_SEMUA, "tutup");
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
    <section aria-label={tr("Panduan")} className="relative flex flex-col gap-3 rounded-card border border-[#CFE6E1] bg-[#F1F8F6] px-4 py-4 lg:px-5">
      <div className="flex items-center gap-2 pr-10">
        <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-white">{tr("Panduan")}</span>
        <b className="text-sm font-extrabold text-primary">{p.tajuk}</b>
      </div>
      <button
        type="button"
        aria-label={tr("Tutup panduan")}
        onClick={() => tulis(id, "tutup")}
        className="absolute top-2 right-2 flex size-10 items-center justify-center rounded-full text-xl leading-none text-muted hover:bg-white"
      >
        ×
      </button>
      <ol className="m-0 grid list-none grid-cols-1 gap-2 p-0 lg:grid-cols-2 xl:grid-cols-3">
        {p.langkah.map((l, i) => (
          <li key={i} className="flex items-start gap-2.5 rounded-[12px] bg-white/70 px-3 py-2.5 text-[13px] leading-snug text-[#33433F]">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#E3F1EE] text-xs font-extrabold text-primary">{i + 1}</span>
            <span>{l}</span>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-muted">{tr("Panduan skrin lain tidak akan dipaparkan lagi selepas ini. Tekan ? di bahagian atas untuk melihatnya semula.")}</span>
        <button type="button" onClick={() => tulis(id, "tutup")} className="flex min-h-10 shrink-0 items-center rounded-full bg-primary px-4 text-[13px] font-bold text-white">
          {tr("Faham")}</button>
      </div>
    </section>
  );
}
