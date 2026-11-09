"use client";

import { tr } from "@/lib/i18n";
/** Penunjuk langkah pendaftaran: 1 Maklumat → 2 Sahkan WhatsApp. */
export function Langkah({ n }: { n: 1 | 2 }) {
  return (
    <div className="flex items-center gap-2 pb-1 text-xs font-bold text-muted" aria-label={tr("Langkah {0} daripada 2", n)}>
      {[tr("Maklumat"), tr("Sahkan WhatsApp")].map((l, i) => (
        <span key={l} className="flex items-center gap-2">
          {i > 0 && <span className="h-px w-6 bg-line" />}
          <span className={`flex size-5 items-center justify-center rounded-full text-[11px] ${i + 1 <= n ? "bg-primary text-white" : "bg-[#E4EAE8] text-[#4A5A57]"}`}>{i + 1 < n ? "✓" : i + 1}</span>
          <span className={i + 1 === n ? "text-ink" : ""}>{l}</span>
        </span>
      ))}
    </div>
  );
}

