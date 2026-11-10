"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { addDays, LABEL_STATUS, ringgit, tarikh, tarikhTempatan, todayISO } from "@/lib/format";
import { BULAN_PENUH } from "@/lib/gaji";
import { getTuntutanHr, muatTurunCSV, type TuntutanHr } from "@/lib/modul";
import { ErrorBox, Loading, Screen, StatusPill } from "@/components/ui";
import { PengepalaAkar, TabNav } from "@/components/TabNav";
import { HadPeranan, Tag } from "@/components/Senarai";
import { BarisStat, Cip, Jadual, KadStat, Kosong } from "@/components/Modul";

type Tapis = "semua" | "pending" | "approved" | "dibayar" | "rejected";

/** Modul Tuntutan perbelanjaan (HR / Kewangan): semua tuntutan syarikat bagi satu bulan. */
export default function TuntutanHrPage() {
  return (
    <HadPeranan roles={["hr", "finance", "ceo", "admin"]}>
      <Kandungan />
    </HadPeranan>
  );
}

function Kandungan() {
  const me = useMe();
  const emp = me.active!;
  const [bulan, setBulan] = useState(todayISO().slice(0, 7));
  const [tapis, setTapis] = useState<Tapis>("semua");
  const [cari, setCari] = useState("");
  const [y, m] = bulan.split("-").map(Number);
  const dari = `${bulan}-01`;
  const hingga = addDays(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`, -1);
  const d = useData(() => getTuntutanHr(emp.companyId, dari, hingga), [emp.companyId, dari, hingga]);
  const semua = d.data ?? [];
  const dibayar = (t: TuntutanHr) => !!t.paid_at;
  const padan = (t: TuntutanHr) =>
    tapis === "semua" || (tapis === "dibayar" ? dibayar(t) : tapis === "approved" ? t.status === "approved" && !dibayar(t) : t.status === tapis);
  const q = cari.trim().toLowerCase();
  const senarai = semua.filter((t) => padan(t) && (!q || t.name.toLowerCase().includes(q) || t.title.toLowerCase().includes(q) || (t.types ?? "").toLowerCase().includes(q)));
  const jumlah = (xs: TuntutanHr[]) => xs.reduce((s, t) => s + t.total_amount, 0);
  const menunggu = semua.filter((t) => t.status === "pending");
  const lulusBelumBayar = semua.filter((t) => t.status === "approved" && !dibayar(t));
  const sudahBayar = semua.filter(dibayar);

  function tukarBulan(n: number) {
    const t = new Date(Date.UTC(y, m - 1 + n, 1));
    setBulan(t.toISOString().slice(0, 7));
  }
  function eksport() {
    muatTurunCSV(tr("tuntutan-{0}-{1}.csv", emp.companyCode, bulan), [
      [tr("Tarikh hantar"), tr("Nama"), tr("Jabatan"), tr("Tajuk"), tr("Jenis"), tr("Jumlah (RM)"), tr("Status"), tr("Dibayar")],
      ...senarai.map((t) => [
        tarikhTempatan(t.created_at),
        t.name,
        t.department ?? "",
        t.title,
        t.types ?? "",
        t.total_amount.toFixed(2),
        LABEL_STATUS[t.status],
        t.paid_at ? (t.via_payroll ? tr("Melalui gaji") : tarikhTempatan(t.paid_at)) : "",
      ]),
    ]);
  }

  return (
    <Screen lebar="lebar">
      <PengepalaAkar title={tr("Tuntutan perbelanjaan")} />
      <main className="flex grow flex-col gap-3 px-4 pt-3 pb-6 lg:px-0">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => tukarBulan(-1)} aria-label={tr("Bulan sebelumnya")} className="flex size-10 items-center justify-center rounded-full bg-surface text-lg font-bold">
            ‹
          </button>
          <b className="min-w-[130px] text-center text-sm">
            {BULAN_PENUH[m - 1]} {y}
          </b>
          <button
            type="button"
            onClick={() => tukarBulan(1)}
            disabled={bulan >= todayISO().slice(0, 7)}
            aria-label={tr("Bulan berikutnya")}
            className="flex size-10 items-center justify-center rounded-full bg-surface text-lg font-bold disabled:opacity-40"
          >
            ›
          </button>
          <span className="grow" />
          <input
            type="search"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder={tr("Cari nama, tajuk atau jenis")}
            aria-label={tr("Cari nama, tajuk atau jenis")}
            className="h-10 w-full rounded-[12px] border border-line bg-surface px-3 text-sm lg:w-[260px]"
          />
          {senarai.length > 0 && (
            <button type="button" onClick={eksport} className="h-10 shrink-0 rounded-full border border-primary px-4 text-[13px] font-bold whitespace-nowrap text-primary">
              {tr("Eksport CSV")}</button>
          )}
        </div>
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data && <Loading />}
        {d.data && (
          <>
            <BarisStat>
              <KadStat label={tr("Jumlah dihantar")} nilai={ringgit(jumlah(semua))} kecil={tr("{0} tuntutan", semua.length)} onClick={() => setTapis("semua")} aktif={tapis === "semua"} />
              <KadStat label={tr("Menunggu kelulusan")} nilai={ringgit(jumlah(menunggu))} kecil={tr("{0} tuntutan", menunggu.length)} tone={menunggu.length ? "warning" : undefined} onClick={() => setTapis("pending")} aktif={tapis === "pending"} />
              <KadStat label={tr("Lulus, belum dibayar")} nilai={ringgit(jumlah(lulusBelumBayar))} kecil={tr("{0} tuntutan", lulusBelumBayar.length)} tone={lulusBelumBayar.length ? "primary" : undefined} onClick={() => setTapis("approved")} aktif={tapis === "approved"} />
              <KadStat label={tr("Sudah dibayar")} nilai={ringgit(jumlah(sudahBayar))} kecil={tr("{0} tuntutan", sudahBayar.length)} tone="success" onClick={() => setTapis("dibayar")} aktif={tapis === "dibayar"} />
            </BarisStat>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(
                [
                  ["semua", tr("Semua")],
                  ["pending", LABEL_STATUS.pending],
                  ["approved", tr("Lulus, belum dibayar")],
                  ["dibayar", tr("Sudah dibayar")],
                  ["rejected", LABEL_STATUS.rejected],
                ] as [Tapis, string][]
              ).map(([k, l]) => (
                <Cip key={k} on={tapis === k} onClick={() => setTapis(k)}>
                  {l}
                </Cip>
              ))}
            </div>
            {senarai.length === 0 ? (
              <div className="rounded-card bg-surface px-4">
                <Kosong>{tr("Tiada tuntutan untuk bulan ini.")}</Kosong>
              </div>
            ) : (
              <Jadual kepala={[tr("PEKERJA"), tr("TUNTUTAN"), tr("DIHANTAR"), tr("JUMLAH"), tr("STATUS")]} kanan={[3]}>
                {senarai.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <span className="flex flex-col">
                        <b>{t.name}</b>
                        <span className="text-xs text-muted">{t.department ?? ""}</span>
                      </span>
                    </td>
                    <td>
                      <Link href={t.approval_request_id ? `/kelulusan/${t.approval_request_id}` : "#"} className="flex flex-col text-ink!">
                        <b className="font-semibold">{t.title}</b>
                        <span className="text-xs text-muted">{t.types ?? ""}</span>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap text-subtle">{tarikh(tarikhTempatan(t.created_at))}</td>
                    <td className="text-right font-bold whitespace-nowrap">{ringgit(t.total_amount)}</td>
                    <td>
                      <span className="flex flex-wrap gap-1">
                        <StatusPill status={t.status} />
                        {t.paid_at && <Tag tone="success">{t.via_payroll ? tr("Dibayar melalui gaji") : tr("Dibayar")}</Tag>}
                      </span>
                    </td>
                  </tr>
                ))}
              </Jadual>
            )}
            <span className="text-xs text-muted">{tr("Tuntutan yang diluluskan dibayar bersama gaji bulan berikutnya (Gaji → Bulan ini). Draf yang belum dihantar tidak dipaparkan.")}</span>
          </>
        )}
      </main>
      <TabNav />
    </Screen>
  );
}
