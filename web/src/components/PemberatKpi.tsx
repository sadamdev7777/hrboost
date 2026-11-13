"use client";

import { tr } from "@/lib/i18n";
import { inputKecil } from "@/components/Senarai";

/** Jumlah peratus pemberat sah? (setiap KPI ≥ 1% dan jumlah tepat 100%) */
export const pemberatSah = (items: { weight: number }[]) =>
  items.every((x) => Number(x.weight) >= 1) && items.reduce((a, x) => a + (Number(x.weight) || 0), 0) === 100;

/** Suis "Beri pemberat berbeza" + jumlah semasa. Mati = semua KPI sama berat. */
export function SuisPemberat({ berbeza, onUbah, items, disabled }: { berbeza: boolean; onUbah: (v: boolean) => void; items: { weight: number }[]; disabled?: boolean }) {
  const jumlah = items.reduce((a, x) => a + (Number(x.weight) || 0), 0);
  return (
    <div className="flex flex-col gap-1">
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" className="size-5 accent-primary" disabled={disabled} checked={berbeza} onChange={(e) => onUbah(e.target.checked)} />
        <span className="flex flex-col">
          <b className="font-bold">{tr("Beri pemberat berbeza")}</b>
          <span className="text-xs text-muted">
            {berbeza ? tr("Tetapkan peratus bagi setiap KPI. Jumlah mesti 100%.") : tr("Semua KPI sama penting. Hidupkan jika sesetengah KPI lebih penting.")}
          </span>
        </span>
      </label>
      {berbeza && (
        <span className={`text-[13px] font-bold ${jumlah === 100 ? "text-primary" : "text-warning"}`}>
          {jumlah === 100 ? tr("Jumlah: 100%") : tr("Jumlah: {0}% — perlu tepat 100%", jumlah)}
        </span>
      )}
    </div>
  );
}

/** Medan peratus pemberat satu KPI. */
export function InputPeratus({ nilai, onUbah, label, disabled }: { nilai: number; onUbah: (n: number) => void; label: string; disabled?: boolean }) {
  return (
    <span className="relative flex items-center">
      <input
        className={`${inputKecil} w-full pr-7`}
        inputMode="numeric"
        disabled={disabled}
        aria-label={label}
        value={nilai ? String(nilai) : ""}
        onChange={(e) => onUbah(Math.min(100, Number(e.target.value.replace(/\D/g, "")) || 0))}
      />
      <span className="pointer-events-none absolute right-3 text-sm text-muted">%</span>
    </span>
  );
}
