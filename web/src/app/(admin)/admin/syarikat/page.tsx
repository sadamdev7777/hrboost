"use client";

import { tr } from "@/lib/i18n";
import { BarisStat, KadStat } from "@/components/Modul";
import Link from "next/link";
import { useState } from "react";
import { useData } from "@/lib/useData";
import { LABEL_STATUS_SYARIKAT, rpc, tarikhPendek } from "@/lib/admin";
import { ErrorBox, Loading } from "@/components/ui";
import { LogoSyarikat } from "@/components/Logo";
import { getLogoSemuaSyarikat } from "@/lib/logo";

type Row = { company_id: string; name: string; code: string; status: string; admins: string | null; staff_active: number; onboarding_steps: number; created_at: string };
const TAPIS = [
  { id: "all", l: tr("Semua") },
  { id: "active", l: tr("Aktif") },
  { id: "onboarding", l: tr("Persediaan") },
  { id: "suspended", l: tr("Dinyahaktif") },
];

// Rujukan reka bentuk: design/SA_Syarikat.dc.html
export default function SaSyarikat() {
  const d = useData(() => rpc<Row[]>("sa_company_overview"), []);
  const logo = useData(() => getLogoSemuaSyarikat().catch(() => ({}) as Record<string, string>), []);
  const [cari, setCari] = useState("");
  const [f, setF] = useState("all");
  const st = (r: Row) => (r.status === "suspended" ? "suspended" : r.onboarding_steps < 6 ? "onboarding" : "active");
  const rows = (d.data ?? []).filter(
    (r) => (f === "all" || st(r) === f) && (!cari.trim() || `${r.name} ${r.code} ${r.admins ?? ""}`.toLowerCase().includes(cari.trim().toLowerCase())),
  );
  return (
    <>
      <h1 className="m-0 text-2xl font-extrabold">{tr("Syarikat")}</h1>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder={tr("Cari nama syarikat, kod atau Pentadbir")}
          aria-label={tr("Cari syarikat")}
          className="h-11 min-w-[260px] grow rounded-[12px] border border-line bg-surface px-3.5 text-sm outline-none focus:border-primary"
        />
        {TAPIS.map((t) => (
          <button key={t.id} type="button" onClick={() => setF(t.id)} className={`h-10 rounded-full px-3.5 text-[13px] font-bold ${f === t.id ? "bg-primary text-white" : "bg-surface text-[#4A5A57]"}`}>
            {t.l}
          </button>
        ))}
      </div>
      {d.error && <ErrorBox message={d.error} />}
      {!d.data && !d.error && <Loading />}
      {d.data && (
        <BarisStat>
          <KadStat label={tr("Syarikat")} nilai={d.data.length} onClick={() => setF("all")} aktif={f === "all"} />
          <KadStat label={tr("Aktif")} nilai={d.data.filter((r) => st(r) === "active").length} tone="success" onClick={() => setF("active")} aktif={f === "active"} />
          <KadStat label={tr("Dalam persediaan")} nilai={d.data.filter((r) => st(r) === "onboarding").length} tone="warning" onClick={() => setF("onboarding")} aktif={f === "onboarding"} />
          <KadStat label={tr("Pekerja aktif (semua syarikat)")} nilai={d.data.reduce((t, r) => t + Number(r.staff_active ?? 0), 0)} />
        </BarisStat>
      )}
      {d.data && (
        <div className="overflow-x-auto rounded-card bg-surface p-4">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs tracking-[0.04em] text-muted">
                <th className="py-2 font-bold">{tr("SYARIKAT")}</th>
                <th className="py-2 font-bold">{tr("PENTADBIR")}</th>
                <th className="py-2 font-bold">{tr("PEKERJA AKTIF")}</th>
                <th className="py-2 font-bold">{tr("PERSEDIAAN")}</th>
                <th className="py-2 font-bold">{tr("TARIKH DAFTAR")}</th>
                <th className="py-2 font-bold">{tr("STATUS")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.company_id} className="border-t border-[#EEF2F1]">
                  <td className="py-3">
                    <span className="flex items-center gap-3">
                      <span className="flex h-9 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#EEF2F1] bg-white">
                        {logo.data?.[r.company_id] ? (
                          <LogoSyarikat path={logo.data[r.company_id]} nama={r.name} className="max-h-full max-w-full" />
                        ) : (
                          <span className="text-[11px] font-extrabold text-muted">{r.code.slice(0, 4)}</span>
                        )}
                      </span>
                      <span>
                        <b>{r.name}</b>
                        <div className="text-xs text-muted">{r.code}</div>
                      </span>
                    </span>
                  </td>
                  <td className="py-3">{r.admins ?? "-"}</td>
                  <td className="py-3">{r.staff_active}</td>
                  <td className="py-3">{r.onboarding_steps >= 6 ? tr("Selesai") : tr("Langkah {0}/6", r.onboarding_steps)}</td>
                  <td className="py-3">{tarikhPendek(r.created_at)}</td>
                  <td className="py-3">
                    <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${LABEL_STATUS_SYARIKAT[st(r)].c}`}>{LABEL_STATUS_SYARIKAT[st(r)].l}</span>
                  </td>
                  <td className="py-3 text-right">
                    <Link href={`/admin/syarikat/${r.company_id}`} className="font-bold">
                      {tr("Lihat")}</Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-muted">
                    {tr("Tiada syarikat sepadan.")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <span className="text-xs text-muted">{tr("Pentadbir platform hanya melihat bilangan dan status — bukan senarai nama pekerja, gaji atau dokumen.")}</span>
    </>
  );
}
