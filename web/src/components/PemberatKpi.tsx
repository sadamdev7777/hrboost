"use client";

import { tr } from "@/lib/i18n";
import { beratSama, peratusBerat, SKALA_KEPENTINGAN } from "@/lib/prestasi";

/** Pilih kepentingan satu KPI pada skala 1–5 (pemberat relatif). */
export function PilihKepentingan({ nilai, onUbah, label, disabled }: { nilai: number; onUbah: (n: number) => void; label: string; disabled?: boolean }) {
  const tersuai = !SKALA_KEPENTINGAN.some((n) => n === Number(nilai));
  return (
    <div className="flex flex-col gap-1">
      <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-1 rounded-[12px] bg-page p-1">
        {SKALA_KEPENTINGAN.map((n) => {
          const on = Number(nilai) === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              onClick={() => onUbah(n)}
              className={`min-h-11 rounded-[10px] px-2 text-[15px] font-bold leading-tight disabled:opacity-60 ${on ? "bg-primary text-white" : "text-muted"}`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <span className="text-xs text-muted">{tersuai ? tr("Pemberat tersuai: {0}. Pilih satu tahap untuk menukar.", nilai) : tr("1 = Kurang penting · 5 = Paling penting")}</span>
    </div>
  );
}

/** Ringkasan automatik: sumbangan setiap KPI kepada markah akhir. */
export function RingkasanSumbangan({ items }: { items: { title: string; weight: number }[] }) {
  const isi = items.filter((x) => x.title.trim());
  if (!isi.length) return null;
  if (beratSama(isi)) return <span className="text-xs leading-snug text-muted">{tr("Semua KPI sama penting.")}</span>;
  return (
    <span className="rounded-[12px] bg-[#E3F1EE] px-3 py-2 text-xs leading-snug text-primary">
      <b className="font-bold">{tr("Sumbangan kepada markah akhir:")}</b> {isi.map((x) => `${x.title} ${peratusBerat(x.weight, isi)}%`).join(" · ")}
    </span>
  );
}

/** Teks kepentingan untuk paparan baca sahaja, cth. "Kepentingan 5/5 (50%)". */
export function teksKepentingan(w: number, items: { weight: number }[]) {
  const pct = peratusBerat(w, items);
  return SKALA_KEPENTINGAN.some((n) => n === Number(w)) ? tr("Kepentingan {0}/5 ({1}%)", w, pct) : tr("Kepentingan: {0}%", pct);
}
