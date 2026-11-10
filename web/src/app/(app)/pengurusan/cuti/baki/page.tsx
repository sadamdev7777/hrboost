"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getCutiHr, muatTurunCSV } from "@/lib/modul";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { PengepalaAkar, TabNav } from "@/components/TabNav";
import { TabModul } from "@/components/TabModul";
import { HadPeranan } from "@/components/Senarai";
import { Jadual, Kosong } from "@/components/Modul";

const fmt = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));

/** Baki cuti tahun semasa bagi setiap pekerja aktif. */
export default function BakiCutiPage() {
  return (
    <HadPeranan roles={["hr", "ceo", "admin"]}>
      <Kandungan />
    </HadPeranan>
  );
}

function Kandungan() {
  const me = useMe();
  const emp = me.active!;
  const d = useData(() => getCutiHr(emp.companyId), [emp.companyId]);
  const [cari, setCari] = useState("");
  const jenis = d.data?.types ?? [];
  const q = cari.trim().toLowerCase();
  const baris = (d.data?.balances ?? []).filter((b) => !q || b.name.toLowerCase().includes(q) || (b.department ?? "").toLowerCase().includes(q));
  const tahun = (d.data?.today ?? "").slice(0, 4);

  function eksport() {
    muatTurunCSV(tr("baki-cuti-{0}-{1}.csv", emp.companyCode, tahun), [
      [tr("Nama"), tr("Jabatan"), ...jenis.flatMap((t) => [tr("{0} baki", t.name), tr("{0} kelayakan", t.name)])],
      ...baris.map((b) => [b.name, b.department ?? "", ...jenis.flatMap((t) => [b.items[t.code]?.available ?? "", b.items[t.code]?.entitled ?? ""])]),
    ]);
  }

  return (
    <Screen lebar="lebar">
      <PengepalaAkar title={tr("Cuti")} />
      <TabModul modul="cuti" />
      <main className="flex grow flex-col gap-3 px-4 pt-3 pb-6 lg:px-0">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <span className="grow text-sm text-subtle">
            {tr("Baki cuti {0} bagi setiap pekerja: baki / kelayakan. Angka dalam kurungan = sedang menunggu kelulusan.", tahun)}</span>
          <input
            type="search"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder={tr("Cari nama atau jabatan")}
            aria-label={tr("Cari nama atau jabatan")}
            className="h-10 rounded-[12px] border border-line bg-surface px-3 text-sm lg:w-[260px]"
          />
          {baris.length > 0 && (
            <button type="button" onClick={eksport} className="h-10 shrink-0 rounded-full border border-primary px-4 text-[13px] font-bold whitespace-nowrap text-primary">
              {tr("Eksport CSV")}</button>
          )}
        </div>
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data && <Loading />}
        {d.data && baris.length === 0 && (
          <div className="rounded-card bg-surface px-4">
            <Kosong>{tr("Tiada baki cuti untuk dipaparkan.")}</Kosong>
          </div>
        )}
        {baris.length > 0 && (
          <Jadual kepala={[tr("PEKERJA"), ...jenis.map((t) => t.name.toUpperCase())]} kanan={jenis.map((_, i) => i + 1)}>
            {baris.map((b) => (
              <tr key={b.employment_id}>
                <td>
                  <Link href={`/pengurusan/pekerja/${b.employment_id}`} className="flex flex-col text-ink!">
                    <b>{b.name}</b>
                    <span className="text-xs text-muted">{b.department ?? ""}</span>
                  </Link>
                </td>
                {jenis.map((t) => {
                  const x = b.items[t.code];
                  return (
                    <td key={t.code} className={`text-right whitespace-nowrap ${x && x.available <= 0 && x.entitled > 0 ? "text-danger" : ""}`}>
                      {x ? (
                        <>
                          <b>{fmt(x.available)}</b>
                          <span className="text-muted"> / {fmt(x.entitled)}</span>
                          {x.pending > 0 && <span className="text-xs text-warning"> ({fmt(x.pending)})</span>}
                        </>
                      ) : (
                        <span className="text-muted">–</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </Jadual>
        )}
      </main>
      <TabNav />
    </Screen>
  );
}
