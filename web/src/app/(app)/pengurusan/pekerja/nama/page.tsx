"use client";

import { tr } from "@/lib/i18n";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { cadangNamaPanggilan, getNamaPekerja, simpanNamaPanggilan, type NamaPekerja } from "@/lib/nama";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { PengepalaAkar, TabNav } from "@/components/TabNav";
import { TabModul } from "@/components/TabModul";
import { HadPeranan } from "@/components/Senarai";
import { Cip, Kosong } from "@/components/Modul";
import { beritahu } from "@/components/Dialog";

/**
 * Nama panggilan secara pukal. Nama panggilan dipakai di semua skrin dan mesej WhatsApp;
 * nama penuh (ikut kad pengenalan) hanya untuk slip gaji, KWSP, EA dan surat rasmi.
 */
export default function NamaPanggilanPage() {
  return (
    <HadPeranan roles={["hr", "admin"]}>
      <Kandungan />
    </HadPeranan>
  );
}

function Kandungan() {
  const me = useMe();
  const emp = me.active!;
  const d = useData(() => getNamaPekerja(emp.companyId), [emp.companyId]);
  const [nilai, setNilai] = useState<Record<string, string>>({});
  const [tapis, setTapis] = useState<"belum" | "semua">("belum");
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);

  const semua = d.data ?? [];
  const belum = semua.filter((p) => !p.preferred_name);
  const papar = tapis === "belum" ? belum : semua;
  // Nilai dalam kotak: suntingan HR → nama panggilan sedia ada → cadangan automatik
  const v = (p: NamaPekerja) => nilai[p.employment_id] ?? p.preferred_name ?? cadangNamaPanggilan(p.full_name);
  const berubah = semua.filter((p) => (v(p) || null) !== (p.preferred_name || null) && (tapis === "semua" || !p.preferred_name));

  async function simpan() {
    setRalat(null);
    if (!berubah.length) return setRalat(tr("Tiada perubahan untuk disimpan."));
    setBusy(true);
    try {
      const n = await simpanNamaPanggilan(
        emp.companyId,
        berubah.map((p) => ({ employment_id: p.employment_id, name: v(p) })),
      );
      beritahu(tr("{0} nama panggilan disimpan.", n));
      setNilai({});
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen lebar="lebar">
      <PengepalaAkar title={tr("Pekerja")} />
      <TabModul modul="pekerja" />
      <main className="flex grow flex-col gap-3 px-4 pt-3 pb-24 lg:px-0">
        <span className="text-sm leading-normal text-subtle">
          {tr("Nama panggilan dipaparkan di semua skrin dan mesej WhatsApp. Nama penuh ikut kad pengenalan hanya digunakan untuk slip gaji, KWSP, Borang EA dan surat rasmi. Cadangan diisi secara automatik daripada nama penuh — semak dan ubah jika perlu, kemudian simpan.")}</span>
        <div className="flex gap-2">
          <Cip on={tapis === "belum"} onClick={() => setTapis("belum")}>
            {tr("Belum ada nama panggilan · {0}", belum.length)}</Cip>
          <Cip on={tapis === "semua"} onClick={() => setTapis("semua")}>
            {tr("Semua · {0}", semua.length)}</Cip>
        </div>
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data && <Loading />}
        {d.data && papar.length === 0 && (
          <div className="rounded-card bg-surface px-4">
            <Kosong>{tr("Semua pekerja sudah mempunyai nama panggilan.")}</Kosong>
          </div>
        )}
        {papar.length > 0 && (
          <div className="flex flex-col rounded-card bg-surface px-4 lg:px-5 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
            {papar.map((p) => {
              const x = v(p);
              const ubah = (x || null) !== (p.preferred_name || null);
              return (
                <label key={p.employment_id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-2.5 text-sm">
                  <span className="flex min-w-0 grow basis-72 flex-col">
                    <b className="truncate">{p.full_name}</b>
                    <span className="text-xs text-muted">{[p.employee_no, p.department].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <input
                      value={x}
                      maxLength={30}
                      aria-label={tr("Nama panggilan {0}", p.full_name)}
                      onChange={(e) => setNilai((s) => ({ ...s, [p.employment_id]: e.target.value }))}
                      className={`h-11 w-48 rounded-[12px] border bg-surface px-3 text-sm outline-none focus:border-primary ${ubah ? "border-primary" : "border-line"}`}
                    />
                    <span className={`w-16 text-xs font-bold ${ubah ? "text-primary" : "text-transparent"}`}>{tr("Baharu")}</span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
        {ralat && <ErrorBox message={ralat} />}
      </main>
      {d.data && papar.length > 0 && (
        <div className="sticky bottom-0 z-10 flex items-center gap-3 border-t border-line-soft bg-surface px-4 py-3 lg:bottom-4 lg:rounded-card lg:border lg:shadow-lg">
          <span className="grow text-sm text-subtle">{tr("{0} nama akan disimpan", berubah.length)}</span>
          <button type="button" disabled={busy || !berubah.length} onClick={simpan} className="h-11 rounded-full bg-primary px-6 text-sm font-bold whitespace-nowrap text-white disabled:opacity-50">
            {busy ? tr("Menyimpan…") : tr("Simpan semua")}</button>
        </div>
      )}
      <TabNav />
    </Screen>
  );
}
