"use client";

import Link from "next/link";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { BULAN_RINGKAS, getSenaraiSlip, getSlip } from "@/lib/gaji";
import { tarikh } from "@/lib/format";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { Seksyen } from "@/components/Senarai";

const rm = (n: number) => n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Rujukan reka bentuk: design/Gaji.dc.html — jumlah disembunyikan secara lalai (CLAUDE.md §6)
export default function GajiPage() {
  const me = useMe();
  const emp = me.active!;
  const senarai = useData(() => getSenaraiSlip(emp.id), [emp.id]);
  const [pilih, setPilih] = useState<string | null>(null);
  const [tunjuk, setTunjuk] = useState(false);
  const [ea, setEa] = useState(false);
  const list = senarai.data ?? [];
  const id = pilih ?? list[0]?.id ?? null;
  const slip = useData(() => (id ? getSlip(id) : Promise.resolve(null)), [id]);
  const s = slip.data;
  const sorok = (n: number) => (tunjuk ? rm(n) : "••••");
  const tahun = list[0]?.year;

  return (
    <Screen>
      <BackHeader title="Slip Gaji" href="/saya" />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-6">
        {senarai.error && <ErrorBox message={senarai.error} />}
        {senarai.loading && !senarai.data && <Loading />}
        {senarai.data && list.length === 0 && <span className="text-sm text-muted">Belum ada slip gaji untuk {emp.companyCode}.</span>}
        {list.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {list.slice(0, 6).map((x, i) => (
              <button
                key={x.id}
                type="button"
                onClick={() => {
                  setPilih(x.id);
                  setEa(false);
                }}
                className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] font-bold ${!ea && id === x.id ? "bg-primary text-white" : "bg-surface text-[#4A5A57]"}`}
              >
                {BULAN_RINGKAS[x.month - 1]}
                {i === 0 ? ` ${x.year}` : ""}
              </button>
            ))}
            <button type="button" onClick={() => setEa(true)} className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] font-bold ${ea ? "bg-primary text-white" : "bg-surface text-[#4A5A57]"}`}>
              Borang EA
            </button>
          </div>
        )}

        {ea && tahun && (
          <div className="flex flex-col gap-2 rounded-card bg-surface px-4 py-3 text-sm">
            <b className="text-sm font-extrabold">Ringkasan saraan {tahun}</b>
            <span className="text-muted">
              {list.filter((x) => x.year === tahun).length} slip dibayar. Borang EA rasmi disediakan oleh HR selepas akhir tahun (sebelum 28 Februari) daripada data yang sama.
            </span>
          </div>
        )}

        {!ea && slip.error && <ErrorBox message={slip.error} />}
        {!ea && id && !s && <Loading />}
        {!ea && s && (
          <>
            <div className="flex items-center gap-3 rounded-[20px] bg-primary px-4 py-4 text-white">
              <div className="flex grow flex-col gap-0.5">
                <span className="text-xs opacity-80">Gaji bersih · {s.company.code}</span>
                <b className="text-2xl font-extrabold tracking-wide">RM {sorok(s.net)}</b>
                {s.payDate && (
                  <span className="text-xs opacity-80">
                    Dibayar {tarikh(s.payDate)}
                  </span>
                )}
              </div>
              <button type="button" onClick={() => setTunjuk(!tunjuk)} aria-label="Papar atau sembunyikan jumlah" className="flex size-11 items-center justify-center rounded-full bg-white/15">
                <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                  {!tunjuk && <path d="M3 3l18 18" />}
                </svg>
              </button>
            </div>
            <Seksyen className="pt-1">PENDAPATAN</Seksyen>
            <Kotak baris={s.lines.filter((l) => l.kind === "earning").map((l) => [l.description, sorok(l.amount)])} />
            <Seksyen className="pt-1">POTONGAN</Seksyen>
            <Kotak
              baris={s.lines
                .filter((l) => l.kind === "deduction")
                .map((l) => [({ EPF: "KWSP", SOCSO: "PERKESO", EIS: "SIP", PCB: "PCB" } as Record<string, string>)[l.code] ?? l.description, sorok(l.amount)])}
            />
            <span className="text-xs leading-normal text-muted">
              Jumlah disembunyikan secara lalai. Tekan ikon mata untuk memaparkannya. Ada slip daripada syarikat lain? Tukar syarikat di skrin Utama.
            </span>
          </>
        )}
      </main>
      {!ea && s && (
        <div className="sticky bottom-0 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
          <Link href={`/gaji/${s.id}`} className="flex h-12 items-center justify-center gap-2 rounded-button border-2 border-primary text-base font-extrabold text-primary!">
            Muat turun PDF
          </Link>
        </div>
      )}
    </Screen>
  );
}

function Kotak({ baris }: { baris: [string, string][] }) {
  return (
    <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
      {baris.map(([k, v], i) => (
        <div key={i} className="flex min-h-[46px] items-center justify-between text-sm">
          <span className="text-muted">{k}</span>
          <b className="tabular-nums">{v}</b>
        </div>
      ))}
    </div>
  );
}
