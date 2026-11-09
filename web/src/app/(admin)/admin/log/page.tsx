"use client";

import { tr } from "@/lib/i18n";
import { useState } from "react";
import { useData } from "@/lib/useData";
import { masaLog, rpc } from "@/lib/admin";
import { ErrorBox, Loading } from "@/components/ui";

type L = { at: string; actor: string; kind: string; action: string; target: string | null };
const TAPIS = [
  { id: "all", l: tr("Semua") },
  { id: "platform", l: tr("Pentadbir Platform") },
  { id: "access", l: tr("Akses syarikat") },
  { id: "sensitive", l: tr("Data sensitif") },
];
const TINDAKAN: Record<string, string> = {
  "company.suspend": tr("Nyahaktifkan syarikat"),
  "company.restore": tr("Aktifkan semula syarikat"),
  "company.register": tr("Daftar syarikat"),
  "company.message": tr("Mesej kepada Pentadbir"),
  "person.deactivate": tr("Nyahaktifkan pengguna"),
  "person.activate": tr("Aktifkan pengguna"),
  "person.force_logout": tr("Paksa log keluar"),
  "grant.request": tr("Mohon akses"),
  "grant.approve": tr("Lulus akses"),
  "grant.reject": tr("Tolak akses"),
  "grant.revoke": tr("Tarik balik akses"),
  "limits.update": tr("Tukar had penggunaan"),
  "platform_admin.add": tr("Tambah Pentadbir Platform"),
  "data.profile": tr("Buka data sensitif · profil"),
  "data.bank": tr("Buka data sensitif · akaun bank"),
  "data.salary": tr("Buka data sensitif · gaji"),
  "data.payslip": tr("Buka data sensitif · slip gaji"),
};
const label = (a: string) => TINDAKAN[a] ?? (a.startsWith("settings.") ? tr("Tetapan platform · {0}", a.slice(9)) : a);

// Rujukan reka bentuk: design/SA_Log.dc.html — log tidak boleh diubah atau dipadam
export default function SaLog() {
  const [k, setK] = useState("all");
  const d = useData(() => rpc<L[]>("sa_audit_log", { p_kind: k, p_limit: 300 }), [k]);

  function eksport() {
    const rows = [[tr("Masa"), tr("Pelaku"), tr("Tindakan"), tr("Sasaran")], ...(d.data ?? []).map((l) => [new Date(l.at).toISOString(), l.actor, label(l.action), l.target ?? ""])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = tr("log-audit-hrboost-{0}.csv", new Date().toISOString().slice(0, 10));
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return (
    <>
      <h1 className="m-0 text-2xl font-extrabold">{tr("Log audit")}</h1>
      <span className="max-w-[720px] text-sm text-muted">{tr("Setiap tindakan Pentadbir Platform, kelulusan akses dan akses data sensitif direkod. Log tidak boleh diubah atau dipadam.")}</span>
      <div className="flex flex-wrap gap-2">
        {TAPIS.map((t) => (
          <button key={t.id} type="button" onClick={() => setK(t.id)} className={`h-10 rounded-full px-3.5 text-[13px] font-bold ${k === t.id ? "bg-primary text-white" : "bg-surface text-[#4A5A57]"}`}>
            {t.l}
          </button>
        ))}
        <span className="grow" />
        <button type="button" onClick={eksport} disabled={!d.data?.length} className="h-10 rounded-full border border-primary px-3.5 text-[13px] font-bold text-primary disabled:opacity-50">
          {tr("Eksport CSV")}</button>
      </div>
      {d.error && <ErrorBox message={d.error} />}
      {!d.data && !d.error && <Loading />}
      {d.data && (
        <div className="overflow-x-auto rounded-card bg-surface p-4">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs tracking-[0.04em] text-muted">
                <th className="py-2 font-bold">{tr("MASA")}</th>
                <th className="py-2 font-bold">{tr("PELAKU")}</th>
                <th className="py-2 font-bold">{tr("TINDAKAN")}</th>
                <th className="py-2 font-bold">{tr("SASARAN")}</th>
              </tr>
            </thead>
            <tbody>
              {d.data.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-muted">
                    {tr("Tiada rekod.")}</td>
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
