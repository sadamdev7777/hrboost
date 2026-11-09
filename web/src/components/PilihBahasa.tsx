"use client";

import { useEffect, useSyncExternalStore } from "react";
import { aturBahasa, bahasa, tetapkanBahasa, type Bahasa } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase";

// Nama bahasa sengaja tidak diterjemah
const PILIHAN: { b: Bahasa; label: string; pendek: string }[] = [
  { b: "en", label: "English", pendek: "EN" },
  { b: "ms", label: "Bahasa Melayu", pendek: "BM" },
];

/**
 * Suis bahasa. `simpan` = simpan juga pada akaun (persons.language) supaya mengikut pengguna
 * di peranti lain dan untuk mesej WhatsApp. Label sengaja tidak diterjemah (nama bahasa).
 */
export function PilihBahasa({ simpan = false, kecil = false }: { simpan?: boolean; kecil?: boolean }) {
  const semasa = useSyncExternalStore(
    () => () => {},
    () => bahasa(),
    () => "en" as Bahasa,
  );
  async function pilih(b: Bahasa) {
    if (b === semasa) return;
    if (simpan) await getSupabase().rpc("set_my_language", { p_lang: b }).then(() => undefined, () => undefined);
    tetapkanBahasa(b);
  }
  return (
    <div role="radiogroup" aria-label="Language / Bahasa" className={`flex shrink-0 rounded-full bg-page p-1 ${kecil ? "text-xs" : "text-[13px]"}`}>
      {PILIHAN.map((p) => (
        <button
          key={p.b}
          type="button"
          role="radio"
          aria-checked={semasa === p.b}
          lang={p.b}
          aria-label={p.label}
          title={p.label}
          onClick={() => pilih(p.b)}
          className={`flex items-center rounded-full font-bold ${kecil ? "h-8 px-3" : "h-9 px-3.5"} ${semasa === p.b ? "bg-primary text-white" : "text-[#4A5A57]"}`}
        >
          {kecil ? p.pendek : p.label}
        </button>
      ))}
    </div>
  );
}

/** Kemas kini <html lang> mengikut bahasa semasa. */
export function LangHtml() {
  const b = useSyncExternalStore(
    () => () => {},
    () => bahasa(),
    () => "en" as Bahasa,
  );
  useEffect(() => {
    document.documentElement.lang = b;
  }, [b]);
  return null;
}

/**
 * Tetapkan bahasa permintaan ini sebelum anak-anak dirender (pelayan & pelayar), berdasarkan kuki
 * yang dibaca oleh susun atur akar. Jika pelayar mempunyai pilihan lama dalam localStorage tetapi
 * tiada kuki, kuki ditetapkan dan halaman dimuat semula sekali.
 */
export function BahasaAwal({ b, children }: { b: Bahasa; children: React.ReactNode }) {
  aturBahasa(b);
  useEffect(() => {
    try {
      const simpanan = localStorage.getItem("hrb_bahasa");
      if ((simpanan === "ms" || simpanan === "en") && simpanan !== b && !/(?:^|; )hrb_bahasa=/.test(document.cookie)) tetapkanBahasa(simpanan);
    } catch {
      /* storan disekat */
    }
  }, [b]);
  return children;
}
