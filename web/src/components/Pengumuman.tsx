"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useState } from "react";
import { useData } from "@/lib/useData";
import { getPengumuman, tandaDibaca, type Pengumuman } from "@/lib/urusan";
import { bilaDihantar } from "@/lib/format";

/** Satu pengumuman (kandungan dipendekkan; tekan untuk penuh). */
export function ItemPengumuman({ a, onBaca }: { a: Pengumuman; onBaca?: () => void }) {
  const [penuh, setPenuh] = useState(false);
  const panjang = a.body.length > 220;
  return (
    <article className="flex flex-col gap-1.5 py-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <b className="font-extrabold">{a.title}</b>
        {!a.is_read && <span className="mt-1 size-2 shrink-0 rounded-full bg-danger" aria-label={tr("Belum dibaca")} />}
      </div>
      <p className="m-0 leading-snug whitespace-pre-line text-[#33433F]">{penuh || !panjang ? a.body : a.body.slice(0, 220) + "…"}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>
          {a.author ?? "HR"} · {bilaDihantar(a.created_at)}
        </span>
        {panjang && (
          <button type="button" onClick={() => setPenuh(!penuh)} className="min-h-9 font-bold text-primary">
            {penuh ? tr("Ringkaskan") : tr("Baca penuh")}
          </button>
        )}
        {!a.is_read && onBaca && (
          <button type="button" onClick={onBaca} className="ml-auto flex min-h-9 items-center rounded-full border border-line px-3 font-bold text-primary">
            {tr("Tandakan dibaca")}</button>
        )}
      </div>
    </article>
  );
}

/** Kad Utama: pengumuman yang belum dibaca. */
export function KadPengumuman({ companyId }: { companyId: string }) {
  const d = useData(() => getPengumuman(companyId), [companyId]);
  const baru = (d.data ?? []).filter((a) => !a.is_read);
  if (!baru.length) return null;
  return (
    <section aria-label={tr("Pengumuman")} className="flex flex-col rounded-card border border-[#CFE6E1] bg-surface px-4 pt-3 pb-1">
      <div className="flex items-center justify-between">
        <h2 className="m-0 text-xs font-bold tracking-[0.04em] text-primary">{tr("PENGUMUMAN BAHARU ({0})", baru.length)}</h2>
        <Link href="/pengumuman" className="flex min-h-9 items-center text-[13px] font-bold">
          {tr("Semua")}</Link>
      </div>
      <div className="flex flex-col [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
        {baru.slice(0, 2).map((a) => (
          <ItemPengumuman
            key={a.id}
            a={a}
            onBaca={async () => {
              await tandaDibaca(a.id).catch(() => undefined);
              d.reload();
            }}
          />
        ))}
      </div>
    </section>
  );
}
