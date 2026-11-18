"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { addDays, hariTarikh, jam, todayISO } from "@/lib/format";
import { getKehadiranHari, muatTurunCSV, statusHadir, type PunchGps, type StatusHadir } from "@/lib/modul";
import { jarakTeks, laluanSwafoto, petaUrl } from "@/lib/kehadiranGps";
import { urlSementara } from "@/lib/upload";
import { beritahu } from "@/components/Dialog";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { PengepalaAkar, TabNav } from "@/components/TabNav";
import { TabModul } from "@/components/TabModul";
import { HadPeranan, Tag } from "@/components/Senarai";
import { BarisStat, Jadual, KadStat, Kosong } from "@/components/Modul";

const LABEL: Record<StatusHadir, { label: string; tone: "success" | "warning" | "primary" | "danger" | "neutral" }> = {
  hadir: { label: tr("Hadir"), tone: "success" },
  lewat: { label: tr("Lewat"), tone: "warning" },
  cuti: { label: tr("Cuti"), tone: "primary" },
  tiada_rekod: { label: tr("Tiada rekod"), tone: "danger" },
  rehat: { label: tr("Hari rehat"), tone: "neutral" },
};

const SUMBER: Record<string, string> = { crosschex: tr("Mesin"), gps: tr("Telefon"), campuran: tr("Mesin & telefon"), correction: tr("Pembetulan") };

/** Daftar masuk / keluar melalui telefon: masa, lokasi, peta & swafoto (akses swafoto direkod). */
function PunchTelefon({ senarai }: { senarai: PunchGps[] }) {
  async function bukaSwafoto(id: number) {
    try {
      const p = await laluanSwafoto(id);
      const u = p ? await urlSementara(p) : null;
      if (!u) throw new Error(tr("Swafoto tidak dapat dibuka."));
      window.open(u, "_blank", "noopener");
    } catch (e) {
      beritahu((e as Error).message, "ralat");
    }
  }
  return (
    <ul className="m-0 mt-1 flex list-none flex-col gap-0.5 p-0 text-xs text-muted">
      {senarai.map((g) => (
        <li key={g.id} className="flex flex-wrap items-center gap-x-1.5">
          <span>
            {g.kind === "out" ? tr("Keluar") : tr("Masuk")} {jam(g.punched_at)} · {g.outside ? <b className="text-warning">{tr("Luar lokasi {0}", jarakTeks(g.distance_m))}</b> : (g.location_name ?? "")}
          </span>
          <a href={petaUrl(g.lat, g.lng)} target="_blank" rel="noreferrer" className="font-bold">
            {tr("Peta")}
          </a>
          {g.has_selfie && (
            <button type="button" onClick={() => bukaSwafoto(g.id)} className="font-bold text-primary">
              {tr("Swafoto")}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Modul Kehadiran (HR): kehadiran harian semua pekerja, lewat, cuti dan tiada rekod. */
export default function KehadiranHrPage() {
  return (
    <HadPeranan roles={["hr", "ceo", "admin"]}>
      <Kandungan />
    </HadPeranan>
  );
}

function Kandungan() {
  const me = useMe();
  const emp = me.active!;
  const [hari, setHari] = useState(todayISO());
  const [tapis, setTapis] = useState<StatusHadir | null>(null);
  const d = useData(() => getKehadiranHari(emp.companyId, hari), [emp.companyId, hari]);
  const kerja = d.data?.working_day ?? true;
  const rows = (d.data?.rows ?? []).map((r) => ({ ...r, s: statusHadir(r, kerja) }));
  const kira = (s: StatusHadir) => rows.filter((r) => r.s === s).length;
  const papar = tapis ? rows.filter((r) => r.s === tapis) : rows;
  const togol = (s: StatusHadir) => setTapis((x) => (x === s ? null : s));

  function eksport() {
    muatTurunCSV(tr("kehadiran-{0}-{1}.csv", emp.companyCode, hari), [
      [tr("Nama"), tr("Jabatan"), tr("Masuk"), tr("Keluar"), tr("Lewat (minit)"), tr("Status"), tr("Sumber"), tr("Luar lokasi")],
      ...rows.map((r) => [
        r.name,
        r.department ?? "",
        r.clock_in ? jam(r.clock_in) : "",
        r.clock_out ? jam(r.clock_out) : "",
        r.late_minutes,
        LABEL[r.s].label,
        SUMBER[r.source ?? ""] ?? "",
        r.in_outside || r.out_outside ? tr("Ya") : "",
      ]),
    ]);
  }

  return (
    <Screen lebar="lebar">
      <PengepalaAkar title={tr("Kehadiran")} />
      <TabModul modul="kehadiran" />
      <main className="flex grow flex-col gap-3 px-4 pt-3 pb-6 lg:px-0">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setHari(addDays(hari, -1))} aria-label={tr("Hari sebelumnya")} className="flex size-10 items-center justify-center rounded-full bg-surface text-lg font-bold">
            ‹
          </button>
          <input type="date" value={hari} max={todayISO()} onChange={(e) => e.target.value && setHari(e.target.value)} aria-label={tr("Tarikh")} className="h-10 rounded-[12px] border border-line bg-surface px-3 text-sm" />
          <button
            type="button"
            onClick={() => setHari(addDays(hari, 1))}
            disabled={hari >= todayISO()}
            aria-label={tr("Hari berikutnya")}
            className="flex size-10 items-center justify-center rounded-full bg-surface text-lg font-bold disabled:opacity-40"
          >
            ›
          </button>
          <b className="grow text-sm">
            {hariTarikh(hari)}
            {!kerja && <span className="font-semibold text-muted"> · {tr("bukan hari bekerja")}</span>}
          </b>
          {rows.length > 0 && (
            <button type="button" onClick={eksport} className="h-10 shrink-0 rounded-full border border-primary px-4 text-[13px] font-bold whitespace-nowrap text-primary">
              {tr("Eksport CSV")}</button>
          )}
        </div>
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data && <Loading />}
        {d.data && (
          <>
            <BarisStat>
              <KadStat label={tr("Hadir")} nilai={`${kira("hadir") + kira("lewat")}/${rows.length}`} tone="success" onClick={() => togol("hadir")} aktif={tapis === "hadir"} />
              <KadStat label={tr("Lewat")} nilai={kira("lewat")} tone={kira("lewat") ? "warning" : undefined} onClick={() => togol("lewat")} aktif={tapis === "lewat"} />
              <KadStat label={tr("Cuti / MC")} nilai={kira("cuti")} onClick={() => togol("cuti")} aktif={tapis === "cuti"} />
              <KadStat label={tr("Tiada rekod")} nilai={kira("tiada_rekod")} tone={kira("tiada_rekod") ? "danger" : undefined} onClick={() => togol("tiada_rekod")} aktif={tapis === "tiada_rekod"} />
            </BarisStat>
            {d.data.corrections.length > 0 && (
              <Link href="/pengurusan/kehadiran/pembetulan" className="rounded-card bg-warning-soft px-4 py-3 text-[13px] font-bold text-warning!">
                {tr("{0} permohonan pembetulan masa menunggu kelulusan ›", d.data.corrections.length)}</Link>
            )}
            {papar.length === 0 ? (
              <div className="rounded-card bg-surface px-4">
                <Kosong>{tr("Tiada pekerja dalam kategori ini.")}</Kosong>
              </div>
            ) : (
              <Jadual kepala={[tr("PEKERJA"), tr("MASUK"), tr("KELUAR"), tr("LEWAT"), tr("STATUS")]}>
                {papar.map((r) => (
                  <tr key={r.employment_id}>
                    <td>
                      <Link href={`/pengurusan/pekerja/${r.employment_id}`} className="flex flex-col text-ink!">
                        <b>{r.name}</b>
                        <span className="text-xs text-muted">{r.department ?? ""}</span>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap">{r.clock_in ? jam(r.clock_in) : "–"}</td>
                    <td className="whitespace-nowrap">{r.clock_out ? jam(r.clock_out) : "–"}</td>
                    <td className={`whitespace-nowrap ${r.late_minutes > 0 ? "font-bold text-warning" : "text-muted"}`}>
                      {r.late_minutes > 0 ? tr("{0} min", r.late_minutes) : "–"}</td>
                    <td>
                      <span className="flex flex-wrap gap-1">
                        <Tag tone={LABEL[r.s].tone === "neutral" ? "neutral" : LABEL[r.s].tone}>{r.s === "cuti" && r.leave_code ? `${LABEL[r.s].label} · ${r.leave_code}` : LABEL[r.s].label}</Tag>
                        {r.flexible && <Tag tone="ai">{tr("Fleksibel")}</Tag>}
                        {(r.in_outside || r.out_outside) && <Tag tone="warning">{tr("Luar lokasi")}</Tag>}
                      </span>
                      {!!r.gps?.length && <PunchTelefon senarai={r.gps} />}
                    </td>
                  </tr>
                ))}
              </Jadual>
            )}
            <span className="text-xs text-muted">{tr("Data daripada mesin kehadiran (dikemas kini setiap 5 minit), daftar masuk melalui telefon dan pembetulan masa yang diluluskan.")}</span>
          </>
        )}
      </main>
      <TabNav />
    </Screen>
  );
}
