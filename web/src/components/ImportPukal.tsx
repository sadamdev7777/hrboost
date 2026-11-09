"use client";

import { tr } from "@/lib/i18n";
import { useRef, useState } from "react";
import { bacaJadual, tarikhISO, teksSel } from "@/lib/import";
import type { HasilImport } from "@/lib/berkanun";
import { ErrorBox } from "./ui";
import { beritahu } from "./Dialog";
import { ButangUtama, Lembaran } from "./Senarai";

export type LajurImport = { k: string; label: string; alias: RegExp; wajib?: boolean; jenis?: "teks" | "nombor" | "tarikh" };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Import pukal daripada Excel / CSV: muat turun templat → pilih fail → pratonton → simpan.
 * Setiap baris disahkan di pelayan; keputusan dipaparkan baris demi baris.
 */
export function ImportPukal({
  tajuk,
  huraian,
  lajur,
  templat,
  namaTemplat,
  hantar,
  onClose,
  onDone,
}: {
  tajuk: string;
  huraian: string;
  lajur: LajurImport[];
  templat: string;
  namaTemplat: string;
  hantar: (baris: Record<string, string>[]) => Promise<HasilImport[]>;
  onClose: () => void;
  onDone: () => void;
}) {
  const fail = useRef<HTMLInputElement>(null);
  const [baris, setBaris] = useState<Record<string, string>[] | null>(null);
  const [hasil, setHasil] = useState<HasilImport[] | null>(null);
  const [ralat, setRalat] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function muatTemplat() {
    const url = URL.createObjectURL(new Blob(["﻿" + templat], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = namaTemplat;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function baca(f: File | undefined) {
    if (!f) return;
    setRalat(null);
    setHasil(null);
    try {
      const data = await bacaJadual(f);
      const h = data.findIndex((r) => r.some((c) => lajur[0].alias.test(norm(teksSel(c)))));
      if (h < 0) throw new Error(tr("Lajur \"{0}\" tidak ditemui. Gunakan templat yang disediakan.", lajur[0].label));
      const peta = lajur.map((l) => data[h].findIndex((c) => l.alias.test(norm(teksSel(c)))));
      const tiada = lajur.filter((l, i) => l.wajib && peta[i] < 0);
      if (tiada.length) throw new Error(tr("Lajur tiada: {0}.", tiada.map((l) => l.label).join(", ")));
      const out: Record<string, string>[] = [];
      for (const r of data.slice(h + 1)) {
        const o: Record<string, string> = {};
        lajur.forEach((l, i) => {
          const v = peta[i] >= 0 ? r[peta[i]] : "";
          o[l.k] = l.jenis === "tarikh" ? (v ? tarikhISO(v) : "") : l.jenis === "nombor" ? teksSel(v).replace(/[^\d.-]/g, "") : teksSel(v);
        });
        if (!o[lajur[0].k]) continue;
        out.push(o);
      }
      if (!out.length) throw new Error(tr("Tiada baris data ditemui dalam fail."));
      if (out.length > 1000) throw new Error(tr("Maksimum 1,000 baris setiap import."));
      setBaris(out);
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Fail tidak dapat dibaca."));
    }
    if (fail.current) fail.current.value = "";
  }

  async function simpan() {
    if (!baris) return;
    setBusy(true);
    setRalat(null);
    try {
      const r = await hantar(baris);
      setHasil(r);
      const ok = r.filter((x) => x.ok).length;
      beritahu(tr("{0} daripada {1} baris berjaya diimport.", ok, r.length), ok === r.length ? "ok" : "ralat");
      if (ok) onDone();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
    setBusy(false);
  }

  const gagal = hasil?.filter((x) => !x.ok) ?? [];
  return (
    <Lembaran title={tajuk} onClose={onClose}>
      <p className="m-0 text-[13px] leading-snug text-subtle">{huraian}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={muatTemplat} className="flex h-10 items-center rounded-full border border-line px-4 text-[13px] font-bold">
          {tr("Muat turun templat")}</button>
        <button type="button" onClick={() => fail.current?.click()} className="flex h-10 items-center rounded-full border border-primary px-4 text-[13px] font-bold text-primary">
          {baris ? tr("Pilih fail lain") : tr("Pilih fail Excel / CSV")}
        </button>
        <input ref={fail} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" aria-label={tr("Pilih fail import")} onChange={(e) => baca(e.target.files?.[0])} />
      </div>
      {ralat && <ErrorBox message={ralat} />}

      {baris && !hasil && (
        <>
          <span className="text-[13px] font-bold">{tr("{0} baris dibaca. Pratonton:", baris.length)}</span>
          <div className="max-h-[280px] overflow-auto rounded-[12px] border border-line-soft">
            <table className="w-full border-collapse text-[13px]">
              <thead className="sticky top-0 bg-page">
                <tr>
                  {lajur.map((l) => (
                    <th key={l.k} scope="col" className="px-3 py-2 text-left text-xs font-bold text-muted">
                      {tr(l.label)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {baris.slice(0, 50).map((b, i) => (
                  <tr key={i} className="border-t border-[#EEF2F1]">
                    {lajur.map((l) => (
                      <td key={l.k} className={`px-3 py-1.5 ${l.jenis === "nombor" ? "text-right tabular-nums" : ""}`}>
                        {b[l.k] || <span className="text-muted">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {baris.length > 50 && <span className="text-xs text-muted">{tr("dan {0} baris lagi.", baris.length - 50)}</span>}
          <ButangUtama onClick={simpan} busy={busy}>
            {tr("Import {0} baris", baris.length)}</ButangUtama>
        </>
      )}

      {hasil && (
        <div className="flex flex-col gap-2">
          <div className={`rounded-[12px] px-4 py-3 text-[13px] font-semibold ${gagal.length ? "bg-warning-soft text-warning" : "bg-success-soft text-success"}`}>
            {tr("{0} berjaya{1}.", hasil.length - gagal.length, gagal.length ? tr(", {0} tidak berjaya", gagal.length) : "")}</div>
          {gagal.length > 0 && (
            <ul className="m-0 flex max-h-[220px] list-none flex-col gap-1 overflow-auto p-0 text-[13px]">
              {gagal.map((g, i) => (
                <li key={i} className="flex gap-2">
                  <b>
                    {g.employee_no}
                    {g.leave_code ? ` · ${g.leave_code}` : ""}
                  </b>
                  <span className="text-danger">{g.message}</span>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={onClose} className="h-12 rounded-button bg-primary text-base font-extrabold text-white">
            {tr("Selesai")}</button>
        </div>
      )}
    </Lembaran>
  );
}
