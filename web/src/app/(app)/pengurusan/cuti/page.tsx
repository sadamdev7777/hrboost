"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { addDays, julatTarikh } from "@/lib/format";
import { getCutiHr, type PermohonanCutiHr } from "@/lib/modul";
import { ErrorBox, Loading, Screen, StatusPill } from "@/components/ui";
import { PengepalaAkar, TabNav } from "@/components/TabNav";
import { TabModul } from "@/components/TabModul";
import { HadPeranan } from "@/components/Senarai";
import { BarisStat, Cip, KadStat, Kosong, Panel } from "@/components/Modul";

/** Modul Cuti (HR): siapa bercuti, akan datang, menunggu kelulusan dan semua permohonan. */
export default function CutiHrPage() {
  return (
    <HadPeranan roles={["hr", "ceo", "admin"]}>
      <Kandungan />
    </HadPeranan>
  );
}

type Tapis = "semua" | "pending" | "approved" | "rejected";

function Kandungan() {
  const me = useMe();
  const emp = me.active!;
  const d = useData(() => getCutiHr(emp.companyId), [emp.companyId]);
  const [tapis, setTapis] = useState<Tapis>("semua");
  const [cari, setCari] = useState("");

  const hari = d.data?.today ?? "";
  const semua = d.data?.requests ?? [];
  const lulus = semua.filter((r) => r.status === "approved");
  const hariIni = lulus.filter((r) => r.start_date <= hari && r.end_date >= hari);
  const minggu = addDays(hari || "2000-01-01", 7);
  const akanDatang = lulus.filter((r) => r.start_date > hari && r.start_date <= addDays(hari || "2000-01-01", 30)).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const menunggu = semua.filter((r) => r.status === "pending").sort((a, b) => a.start_date.localeCompare(b.start_date));
  const q = cari.trim().toLowerCase();
  const senarai = semua.filter((r) => (tapis === "semua" || r.status === tapis) && (!q || r.name.toLowerCase().includes(q) || (r.department ?? "").toLowerCase().includes(q)));

  return (
    <Screen lebar="lebar">
      <PengepalaAkar title={tr("Cuti")} />
      <TabModul modul="cuti" />
      <main className="flex grow flex-col gap-3 px-4 pt-3 pb-6 lg:px-0">
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data && <Loading />}
        {d.data && (
          <>
            <BarisStat>
              <KadStat label={tr("Bercuti hari ini")} nilai={hariIni.length} tone={hariIni.length ? "warning" : undefined} />
              <KadStat label={tr("7 hari akan datang")} nilai={akanDatang.filter((r) => r.start_date <= minggu).length} />
              <KadStat label={tr("Menunggu kelulusan")} nilai={menunggu.length} tone={menunggu.length ? "danger" : undefined} onClick={() => setTapis("pending")} aktif={tapis === "pending"} />
              <KadStat label={tr("Diluluskan (90 hari)")} nilai={lulus.length} tone="success" onClick={() => setTapis("approved")} aktif={tapis === "approved"} />
            </BarisStat>

            <div className="grid gap-3 lg:grid-cols-2">
              <Panel tajuk={tr("BERCUTI HARI INI")}>
                {hariIni.length === 0 ? <Kosong>{tr("Semua pekerja bekerja hari ini.")}</Kosong> : hariIni.map((r) => <BarisCuti key={r.id} r={r} />)}
              </Panel>
              <Panel tajuk={tr("AKAN DATANG (30 HARI)")}>
                {akanDatang.length === 0 ? <Kosong>{tr("Tiada cuti diluluskan dalam 30 hari akan datang.")}</Kosong> : akanDatang.slice(0, 8).map((r) => <BarisCuti key={r.id} r={r} />)}
                {akanDatang.length > 8 && (
                  <Link href="/kalendar" className="py-2.5 text-[13px] font-bold">
                    {tr("Lihat {0} lagi dalam kalendar ›", akanDatang.length - 8)}</Link>
                )}
              </Panel>
            </div>

            <section className="flex flex-col gap-2 pt-2">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                <h2 className="m-0 grow text-base font-extrabold">{tr("Permohonan cuti")}</h2>
                <input
                  type="search"
                  value={cari}
                  onChange={(e) => setCari(e.target.value)}
                  placeholder={tr("Cari nama atau jabatan")}
                  aria-label={tr("Cari nama atau jabatan")}
                  className="h-10 rounded-[12px] border border-line bg-surface px-3 text-sm lg:w-[260px]"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {(
                  [
                    ["semua", tr("Semua · {0}", semua.length)],
                    ["pending", tr("Menunggu")],
                    ["approved", tr("Diluluskan")],
                    ["rejected", tr("Ditolak")],
                  ] as [Tapis, string][]
                ).map(([t, l]) => (
                  <Cip key={t} on={tapis === t} onClick={() => setTapis(t)}>
                    {l}
                  </Cip>
                ))}
              </div>
              <div className="flex flex-col rounded-card bg-surface px-4 lg:px-5 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
                {senarai.length === 0 ? <Kosong>{tr("Tiada permohonan cuti.")}</Kosong> : senarai.slice(0, 100).map((r) => <BarisCuti key={r.id} r={r} status />)}
              </div>
              <span className="text-xs text-muted">{tr("Memaparkan permohonan dari 90 hari lalu dan akan datang. Laporan penuh di Laporan → Cuti diambil.")}</span>
            </section>
          </>
        )}
      </main>
      <TabNav />
    </Screen>
  );
}

function BarisCuti({ r, status = false }: { r: PermohonanCutiHr; status?: boolean }) {
  const href = r.approval_request_id ? `/kelulusan/${r.approval_request_id}` : `/pengurusan/pekerja/${r.employment_id}`;
  return (
    <Link href={href} className="flex min-h-[52px] items-center gap-3 py-2 text-sm text-ink! hover:bg-[#F7F9F8]">
      <span className="flex min-w-0 grow flex-col">
        <b className="truncate">{r.name}</b>
        <span className="truncate text-xs text-muted">
          {[r.leave_name, r.department].filter(Boolean).join(" · ")}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-[13px] font-semibold whitespace-nowrap">{julatTarikh(r.start_date, r.end_date)}</span>
        <span className="text-xs text-muted">{tr("{0} hari", r.days)}</span>
      </span>
      {status && <StatusPill status={r.status} />}
    </Link>
  );
}
