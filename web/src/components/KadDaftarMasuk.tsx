"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useData } from "@/lib/useData";
import { jam } from "@/lib/format";
import { getKehadiranHariIni } from "@/lib/kehadiranGps";
import { Tag } from "@/components/Senarai";

/** Kad Utama: Daftar masuk / keluar melalui telefon (hanya jika syarikat menghidupkan GPS). */
export function KadDaftarMasuk({ employmentId }: { employmentId: string }) {
  const d = useData(() => getKehadiranHariIni(employmentId).catch(() => null), [employmentId]);
  const x = d.data;
  if (!x?.enabled) return null;
  const p = x.punches;
  const masuk = p[0];
  const akhir = p.length > 1 ? p[p.length - 1] : null;
  const luar = p.some((q) => q.outside);
  return (
    <section aria-label={tr("Kehadiran hari ini")} className="flex items-center gap-3 rounded-card bg-surface px-4 py-3.5">
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <b className="text-sm">{tr("Kehadiran hari ini")}</b>
        <span className="text-[13px] text-subtle">
          {!masuk ? tr("Belum daftar masuk") : akhir ? tr("Masuk {0} · Keluar {1}", jam(masuk.punched_at), jam(akhir.punched_at)) : tr("Masuk {0}", jam(masuk.punched_at))}
        </span>
        {luar && (
          <span>
            <Tag tone="warning">{tr("Luar lokasi")}</Tag>
          </span>
        )}
      </span>
      <Link
        href="/kehadiran/daftar"
        className={`flex h-12 shrink-0 items-center rounded-button px-5 text-sm font-extrabold ${masuk ? "border-2 border-primary text-primary!" : "bg-primary text-white!"}`}
      >
        {masuk ? tr("Daftar keluar") : tr("Daftar masuk")}
      </Link>
    </section>
  );
}
