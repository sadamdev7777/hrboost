"use client";

import { tr } from "@/lib/i18n";

/** Pilihan bahasa pekerja (English lalai / Bahasa Melayu) — dua butang, ≥ 44px. */
export function PilihBahasaPekerja({ nilai, onChange, disabled }: { nilai: "en" | "ms"; onChange: (v: "en" | "ms") => void; disabled?: boolean }) {
  return (
    <div role="radiogroup" aria-label={tr("Bahasa")} className="grid grid-cols-2 gap-2">
      {(
        [
          ["en", "English"],
          ["ms", "Bahasa Melayu"],
        ] as const
      ).map(([k, l]) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={nilai === k}
          disabled={disabled}
          onClick={() => onChange(k)}
          className={`h-11 rounded-[12px] text-sm font-bold disabled:opacity-60 ${nilai === k ? "border-[1.5px] border-primary bg-[#E3F1EE] text-primary" : "border border-[#D5DEDC] bg-surface"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
