"use client";

import { tr } from "@/lib/i18n";
import { beratSama, labelKepentingan, peratusBerat, TAHAP_KEPENTINGAN } from "@/lib/prestasi";

/** Pilih kepentingan satu KPI: Biasa / Penting / Sangat penting (pemberat relatif 1/2/3). */
export function PilihKepentingan({ nilai, onUbah, label, disabled }: { nilai: number; onUbah: (n: number) => void; label: string; disabled?: boolean }) {
  const tersuai = !TAHAP_KEPENTINGAN.some((t) => t.w === Number(nilai));
  return (
    <div className="flex flex-col gap-1">
      <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-1 rounded-[12px] bg-page p-1">
        {TAHAP_KEPENTINGAN.map((t) => {
          const on = Number(nilai) === t.w;
          return (
            <button
              key={t.w}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              onClick={() => onUbah(t.w)}
              className={`min-h-11 rounded-[10px] px-2 text-[13px] font-bold leading-tight disabled:opacity-60 ${on ? "bg-primary text-white" : "text-muted"}`}
            >
              {tr(t.l)}
            </button>
          );
        })}
      </div>
      {tersuai && <span className="text-xs text-muted">{tr("Pemberat tersuai: {0}. Pilih satu tahap untuk menukar.", nilai)}</span>}
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

/** Teks kepentingan untuk paparan baca sahaja, cth. "Kepentingan: Sangat penting (43%)". */
export function teksKepentingan(w: number, items: { weight: number }[]) {
  const l = labelKepentingan(w);
  const pct = peratusBerat(w, items);
  return l ? tr("Kepentingan: {0} ({1}%)", tr(l), pct) : tr("Kepentingan: {0}%", pct);
}
