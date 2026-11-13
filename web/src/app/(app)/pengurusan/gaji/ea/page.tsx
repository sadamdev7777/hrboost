"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useState } from "react";
import { hasRole, useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { ringgit, tarikh, tarikhTempatan, todayISO } from "@/lib/format";
import { eksportCP8D, getEaHr, keluarkanEa, ringkasanBorangE } from "@/lib/ea";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { PengepalaAkar, TabNav } from "@/components/TabNav";
import { TabModul } from "@/components/TabModul";
import { HadPeranan, Tag } from "@/components/Senarai";
import { BarisStat, Jadual, KadStat, Kosong } from "@/components/Modul";
import { beritahu, sahkan } from "@/components/Dialog";

/**
 * Borang EA (kepada pekerja, sebelum 28 Februari) dan Borang E + C.P.8D (kepada LHDN, sebelum 31 Mac).
 * Angka daripada slip gaji yang diluluskan + data terkumpul sistem lama.
 */
export default function BorangEaPage() {
  return (
    <HadPeranan roles={["hr", "finance", "admin"]}>
      <Kandungan />
    </HadPeranan>
  );
}

function Kandungan() {
  const me = useMe();
  const emp = me.active!;
  const tahunIni = Number(todayISO().slice(0, 4));
  const [tahun, setTahun] = useState(tahunIni - 1);
  const d = useData(() => getEaHr(emp.companyId, tahun), [emp.companyId, tahun]);
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const rows = d.data?.rows ?? [];
  const m = d.data?.company;
  const e = ringkasanBorangE(rows);
  const bolehKeluar = hasRole(me, ["hr", "admin"]) && tahun < tahunIni;
  const tiadaCukai = rows.filter((r) => !r.tax_no).length;
  const tiadaIc = rows.filter((r) => !r.ic_no).length;

  async function keluar() {
    if (!(await sahkan({
      tajuk: tr("Keluarkan Borang EA {0}?", tahun),
      mesej: tr("{0} pekerja akan dimaklumkan dan boleh melihat serta memuat turun Borang EA di Saya → Slip Gaji. Pastikan angka telah disemak.", rows.length),
      ok: tr("Keluarkan"),
    }))) return;
    setBusy(true);
    setRalat(null);
    try {
      const n = await keluarkanEa(emp.companyId, tahun);
      beritahu(tr("Borang EA {0} dikeluarkan kepada {1} pekerja.", tahun, n));
      d.reload();
    } catch (x) {
      setRalat(x instanceof Error ? x.message : tr("Ralat"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen lebar="lebar">
      <PengepalaAkar title={tr("Penggajian")} />
      <TabModul modul="gaji" />
      <main className="flex grow flex-col gap-3 px-4 pt-3 pb-6 lg:px-0">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm font-bold">
            {tr("Tahun")}
            <select value={tahun} onChange={(x) => setTahun(Number(x.target.value))} className="h-10 rounded-[12px] border border-line bg-surface px-3 text-sm">
              {[tahunIni, tahunIni - 1, tahunIni - 2, tahunIni - 3].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <span className="grow text-[13px] text-subtle">
            {tahun >= tahunIni
              ? tr("Tahun {0} belum berakhir — angka setakat gaji yang telah diluluskan (pratonton).", tahun)
              : tr("Borang EA kepada pekerja sebelum 28 Februari {0}; Borang E kepada LHDN sebelum 31 Mac {0}.", tahun + 1)}</span>
        </div>
        {d.error && <ErrorBox message={d.error} />}
        {ralat && <ErrorBox message={ralat} />}
        {d.loading && !d.data && <Loading />}
        {d.data && m && (
          <>
            <BarisStat>
              <KadStat label={tr("Pekerja (Borang EA)")} nilai={e.pekerja} kecil={tr("{0} baharu · {1} berhenti", e.baru, e.berhenti)} />
              <KadStat label={tr("Jumlah saraan")} nilai={ringgit(e.saraan)} />
              <KadStat label={tr("Jumlah PCB")} nilai={ringgit(e.pcb)} kecil={tr("{0} pekerja dipotong PCB", e.pcbPekerja)} />
              <KadStat label={tr("KWSP + PERKESO pekerja")} nilai={ringgit(e.kwsp + e.perkeso)} />
            </BarisStat>

            {(tiadaCukai > 0 || tiadaIc > 0 || !m.lhdn_employer_no) && (
              <div className="flex flex-col gap-1 rounded-card bg-warning-soft px-4 py-3 text-[13px] text-warning">
                <b>{tr("Semak sebelum dikeluarkan")}</b>
                {!m.lhdn_employer_no && (
                  <span>
                    {tr("No. Majikan E (LHDN) syarikat belum diisi.")}{" "}
                    <Link href="/pengurusan/tetapan/syarikat" className="font-bold text-warning!">
                      {tr("Isi di Tetapan → Syarikat ›")}</Link>
                  </span>
                )}
                {tiadaCukai > 0 && <span>{tr("{0} pekerja belum mempunyai no. cukai pendapatan.", tiadaCukai)}</span>}
                {tiadaIc > 0 && <span>{tr("{0} pekerja belum mempunyai no. kad pengenalan.", tiadaIc)}</span>}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/pengurusan/gaji/ea/cetak?tahun=${tahun}`}
                className={`flex h-11 items-center rounded-full bg-primary px-5 text-sm font-bold whitespace-nowrap text-white! ${rows.length ? "" : "pointer-events-none opacity-50"}`}
              >
                {tr("Cetak / PDF semua Borang EA")}</Link>
              <button type="button" disabled={!rows.length} onClick={() => eksportCP8D(m, rows)} className="h-11 rounded-full border border-primary px-5 text-sm font-bold whitespace-nowrap text-primary disabled:opacity-50">
                {tr("Muat turun C.P.8D (CSV)")}</button>
              {bolehKeluar && (
                <button type="button" disabled={busy || !rows.length} onClick={keluar} className="h-11 rounded-full border border-line bg-surface px-5 text-sm font-bold whitespace-nowrap text-ink disabled:opacity-50">
                  {m.released_at ? tr("Hantar semula kepada pekerja") : tr("Keluarkan kepada pekerja")}</button>
              )}
              {m.released_at && <Tag tone="success">{tr("Dikeluarkan {0}", tarikh(tarikhTempatan(m.released_at)))}</Tag>}
            </div>

            {rows.length === 0 ? (
              <div className="rounded-card bg-surface px-4">
                <Kosong>{tr("Tiada gaji yang diluluskan bagi tahun {0}.", tahun)}</Kosong>
              </div>
            ) : (
              <Jadual kepala={[tr("PEKERJA"), tr("BULAN"), tr("SARAAN (B)"), tr("PCB (D1)"), tr("KWSP (E1)"), tr("PERKESO (E2)"), ""]} kanan={[1, 2, 3, 4, 5]}>
                {rows.map((r) => (
                  <tr key={r.employment_id}>
                    <td>
                      <span className="flex flex-col">
                        <b>{r.full_name}</b>
                        <span className="text-xs text-muted">
                          {[r.employee_no, r.tax_no ? tr("No. cukai {0}", r.tax_no) : tr("Tiada no. cukai")].join(" · ")}</span>
                      </span>
                    </td>
                    <td className="text-right">{r.months}</td>
                    <td className="text-right font-bold whitespace-nowrap">{ringgit(r.total_income)}</td>
                    <td className="text-right whitespace-nowrap">{ringgit(r.pcb)}</td>
                    <td className="text-right whitespace-nowrap">{ringgit(r.epf)}</td>
                    <td className="text-right whitespace-nowrap">{ringgit(r.socso)}</td>
                    <td className="text-right">
                      <Link href={`/pengurusan/gaji/ea/cetak?tahun=${tahun}&id=${r.employment_id}`} className="text-[13px] font-bold whitespace-nowrap">
                        {tr("Lihat EA ›")}</Link>
                    </td>
                  </tr>
                ))}
              </Jadual>
            )}

            <section className="flex flex-col gap-1.5 rounded-card bg-surface px-4 py-3 text-sm lg:px-5">
              <h2 className="m-0 text-xs font-bold tracking-[0.04em] text-[#4A5A57]">{tr("BORANG E {0} (RINGKASAN MAJIKAN)", tahun)}</h2>
              <span className="text-subtle">
                {tr("Isi Borang E melalui e-Borang di MyTax (LHDN) menggunakan angka di bawah dan muat naik C.P.8D. Tarikh akhir: 31 Mac {0}.", tahun + 1)}</span>
              <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-1 text-[13px] lg:grid-cols-4">
                <dt className="text-muted">{tr("No. Majikan E")}</dt>
                <dd className="m-0 font-bold">{m.lhdn_employer_no ?? "—"}</dd>
                <dt className="text-muted">{tr("Bilangan pekerja")}</dt>
                <dd className="m-0 font-bold">{e.pekerja}</dd>
                <dt className="text-muted">{tr("Pekerja dikenakan PCB")}</dt>
                <dd className="m-0 font-bold">{e.pcbPekerja}</dd>
                <dt className="text-muted">{tr("Jumlah saraan kasar")}</dt>
                <dd className="m-0 font-bold">{ringgit(e.saraan)}</dd>
                <dt className="text-muted">{tr("Jumlah PCB")}</dt>
                <dd className="m-0 font-bold">{ringgit(e.pcb)}</dd>
                <dt className="text-muted">{tr("Pekerja baharu / berhenti")}</dt>
                <dd className="m-0 font-bold">
                  {e.baru} / {e.berhenti}
                </dd>
              </dl>
            </section>
          </>
        )}
      </main>
      <TabNav />
    </Screen>
  );
}
