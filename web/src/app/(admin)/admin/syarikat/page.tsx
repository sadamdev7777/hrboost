"use client";

import Link from "next/link";
import { useState } from "react";
import { useData } from "@/lib/useData";
import { LABEL_STATUS_SYARIKAT, rpc, tarikhPendek } from "@/lib/admin";
import { ErrorBox, Loading } from "@/components/ui";

type Row = { company_id: string; name: string; code: string; status: string; admins: string | null; staff_active: number; onboarding_steps: number; created_at: string };
const TAPIS = [
  { id: "all", l: "Semua" },
  { id: "active", l: "Aktif" },
  { id: "onboarding", l: "Persediaan" },
  { id: "suspended", l: "Dinyahaktif" },
];

// Rujukan reka bentuk: design/SA_Syarikat.dc.html
export default function SaSyarikat() {
  const d = useData(() => rpc<Row[]>("sa_company_overview"), []);
  const [cari, setCari] = useState("");
  const [f, setF] = useState("all");
  const st = (r: Row) => (r.status === "suspended" ? "suspended" : r.onboarding_steps < 6 ? "onboarding" : "active");
  const rows = (d.data ?? []).filter(
    (r) => (f === "all" || st(r) === f) && (!cari.trim() || `${r.name} ${r.code} ${r.admins ?? ""}`.toLowerCase().includes(cari.trim().toLowerCase())),
  );
  return (
    <>
      <h1 className="m-0 text-2xl font-extrabold">Syarikat</h1>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari nama syarikat, kod atau Pentadbir"
          aria-label="Cari syarikat"
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
        <div className="overflow-x-auto rounded-card bg-surface p-4">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs tracking-[0.04em] text-muted">
                <th className="py-2 font-bold">SYARIKAT</th>
                <th className="py-2 font-bold">PENTADBIR</th>
                <th className="py-2 font-bold">PEKERJA AKTIF</th>
                <th className="py-2 font-bold">PERSEDIAAN</th>
                <th className="py-2 font-bold">TARIKH DAFTAR</th>
                <th className="py-2 font-bold">STATUS</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.company_id} className="border-t border-[#EEF2F1]">
                  <td className="py-3">
                    <b>{r.name}</b>
                    <div className="text-xs text-muted">{r.code}</div>
                  </td>
                  <td className="py-3">{r.admins ?? "-"}</td>
                  <td className="py-3">{r.staff_active}</td>
                  <td className="py-3">{r.onboarding_steps >= 6 ? "Selesai" : `Langkah ${r.onboarding_steps}/6`}</td>
                  <td className="py-3">{tarikhPendek(r.created_at)}</td>
                  <td className="py-3">
                    <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${LABEL_STATUS_SYARIKAT[st(r)].c}`}>{LABEL_STATUS_SYARIKAT[st(r)].l}</span>
                  </td>
                  <td className="py-3 text-right">
                    <Link href={`/admin/syarikat/${r.company_id}`} className="font-bold">
                      Lihat
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-muted">
                    Tiada syarikat sepadan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <span className="text-xs text-muted">Pentadbir platform hanya melihat bilangan dan status — bukan senarai nama pekerja, gaji atau dokumen.</span>
    </>
  );
}
