"use client";

import { useState } from "react";
import { useData } from "@/lib/useData";
import { masaLog, rpc } from "@/lib/admin";
import { ErrorBox, Loading } from "@/components/ui";

type L = { at: string; actor: string; kind: string; action: string; target: string | null };
const TAPIS = [
  { id: "all", l: "Semua" },
  { id: "platform", l: "Pentadbir Platform" },
  { id: "access", l: "Akses syarikat" },
  { id: "sensitive", l: "Data sensitif" },
];
const TINDAKAN: Record<string, string> = {
  "company.suspend": "Nyahaktifkan syarikat",
  "company.restore": "Aktifkan semula syarikat",
  "company.register": "Daftar syarikat",
  "company.message": "Mesej kepada Pentadbir",
  "person.deactivate": "Nyahaktifkan pengguna",
  "person.activate": "Aktifkan pengguna",
  "person.force_logout": "Paksa log keluar",
  "grant.request": "Mohon akses",
  "grant.approve": "Lulus akses",
  "grant.reject": "Tolak akses",
  "grant.revoke": "Tarik balik akses",
  "limits.update": "Tukar had penggunaan",
  "platform_admin.add": "Tambah Pentadbir Platform",
  "data.profile": "Buka data sensitif · profil",
  "data.bank": "Buka data sensitif · akaun bank",
  "data.salary": "Buka data sensitif · gaji",
  "data.payslip": "Buka data sensitif · slip gaji",
};
const label = (a: string) => TINDAKAN[a] ?? (a.startsWith("settings.") ? `Tetapan platform · ${a.slice(9)}` : a);

// Rujukan reka bentuk: design/SA_Log.dc.html — log tidak boleh diubah atau dipadam
export default function SaLog() {
  const [k, setK] = useState("all");
  const d = useData(() => rpc<L[]>("sa_audit_log", { p_kind: k, p_limit: 300 }), [k]);

  function eksport() {
    const rows = [["Masa", "Pelaku", "Tindakan", "Sasaran"], ...(d.data ?? []).map((l) => [new Date(l.at).toISOString(), l.actor, label(l.action), l.target ?? ""])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `log-audit-hrboost-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return (
    <>
      <h1 className="m-0 text-2xl font-extrabold">Log audit</h1>
      <span className="max-w-[720px] text-sm text-muted">Setiap tindakan Pentadbir Platform, kelulusan akses dan akses data sensitif direkod. Log tidak boleh diubah atau dipadam.</span>
      <div className="flex flex-wrap gap-2">
        {TAPIS.map((t) => (
          <button key={t.id} type="button" onClick={() => setK(t.id)} className={`h-10 rounded-full px-3.5 text-[13px] font-bold ${k === t.id ? "bg-primary text-white" : "bg-surface text-[#4A5A57]"}`}>
            {t.l}
          </button>
        ))}
        <span className="grow" />
        <button type="button" onClick={eksport} disabled={!d.data?.length} className="h-10 rounded-full border border-primary px-3.5 text-[13px] font-bold text-primary disabled:opacity-50">
          Eksport CSV
        </button>
      </div>
      {d.error && <ErrorBox message={d.error} />}
      {!d.data && !d.error && <Loading />}
      {d.data && (
        <div className="overflow-x-auto rounded-card bg-surface p-4">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs tracking-[0.04em] text-muted">
                <th className="py-2 font-bold">MASA</th>
                <th className="py-2 font-bold">PELAKU</th>
                <th className="py-2 font-bold">TINDAKAN</th>
                <th className="py-2 font-bold">SASARAN</th>
              </tr>
            </thead>
            <tbody>
              {d.data.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-muted">
                    Tiada rekod.
                  </td>
                </tr>
              )}
              {d.data.map((l, i) => (
                <tr key={i} className="border-t border-[#EEF2F1] align-top">
                  <td className="py-2.5 whitespace-nowrap text-muted">{masaLog(l.at)}</td>
                  <td className="py-2.5">{l.actor}</td>
                  <td className="py-2.5 font-bold">{label(l.action)}</td>
                  <td className="py-2.5">{l.target ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
