"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { kehadiranDisambung, getKehadiranBulan, type HariHadir } from "@/lib/kehadiran";
import { hariPendek, jam, todayISO } from "@/lib/format";
import { IconBack, IconChevronRight } from "@/components/icons";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { Tag } from "@/components/Senarai";

const BULAN = [tr("Jan"), tr("Feb"), tr("Mac"), tr("Apr"), tr("Mei"), tr("Jun"), tr("Jul"), tr("Ogo"), tr("Sep"), tr("Okt"), tr("Nov"), tr("Dis")];
const CUTI: Record<string, string> = { AL: tr("Cuti tahunan"), MC: tr("Cuti sakit"), HL: tr("Hospital"), EL: tr("Kecemasan"), UL: tr("Tanpa gaji"), ML: tr("Bersalin"), PL: tr("Paterniti") };

function geser(b: string, n: number) {
  const [y, m] = b.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

// Rujukan reka bentuk: design/Kehadiran.dc.html
export default function KehadiranPage() {
  const me = useMe();
  const emp = me.active!;
  const kini = todayISO().slice(0, 7);
  const [bulan, setBulan] = useState(kini);
  const d = useData(() => getKehadiranBulan(emp.id, bulan), [emp.id, bulan]);
  const sambung = useData(() => kehadiranDisambung(emp.companyId), [emp.companyId]);
  // Seperti reka bentuk: hari bekerja sahaja (hujung minggu dipaparkan jika ada imbasan)
  const hari = (d.data ?? []).filter((h) => h.working || h.clockIn || h.holiday);
  const today = todayISO();
  const kerja = hari.filter((h) => h.working && !h.holiday);
  const hadir = kerja.filter((h) => h.clockIn).length;
  const lewat = kerja.filter((h) => h.late > emp.graceMinutes && h.correction !== "approved").length;
  const tidakHadir = kerja.filter((h) => !h.clockIn && !h.leave && h.date !== today && h.correction !== "approved").length;
  const [y, m] = bulan.split("-").map(Number);

  return (
    <Screen>
      <BackHeader
        title={tr("Kehadiran")}
        href="/saya"
        action={
          <div className="mr-1 flex items-center">
            <button type="button" aria-label={tr("Bulan sebelumnya")} onClick={() => setBulan(geser(bulan, -1))} className="flex size-11 items-center justify-center rounded-full">
              <IconBack size={18} />
            </button>
            <span className="text-sm font-bold whitespace-nowrap">
              {BULAN[m - 1]} {y}
            </span>
            <button
              type="button"
              aria-label={tr("Bulan seterusnya")}
              disabled={bulan >= kini}
              onClick={() => setBulan(geser(bulan, 1))}
              className="flex size-11 items-center justify-center rounded-full disabled:opacity-30"
            >
              <IconChevronRight size={18} />
            </button>
          </div>
        }
      />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-6">
        {sambung.data === false ? (
          <div className="flex flex-col gap-1.5 rounded-card bg-surface px-4 py-4">
            <b className="text-sm">{tr("Kehadiran belum disambung")}</b>
            <span className="text-[13px] leading-normal text-subtle">
              {tr("Syarikat anda belum menyambungkan mesin atau sistem kehadiran ke HRBoost. Rekod masuk dan keluar akan dipaparkan di sini selepas HR menyambungkannya.")}</span>
          </div>
        ) : (
          <>
        <div className="grid grid-cols-3 gap-2">
          <Kad n={hadir} label={tr("Hari hadir")} />
          <Kad n={lewat} label={tr("Kali lewat")} tone={lewat ? "warning" : undefined} />
          <Kad n={tidakHadir} label={tr("Tidak hadir")} tone={tidakHadir ? "danger" : undefined} />
        </div>

        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data && <Loading />}
        {d.data && (
          <div className="flex flex-col rounded-card bg-surface px-4 py-1">
            <div className="grid grid-cols-[1.1fr_1fr_1fr_auto] items-center gap-2 py-2 text-xs font-bold text-muted">
              <span>{tr("Hari")}</span>
              <span>{tr("Masuk")}</span>
              <span>{tr("Keluar")}</span>
              <span className="w-[70px]" />
            </div>
            {hari.length === 0 && <span className="border-t border-[#EEF2F1] py-3 text-sm text-muted">{tr("Tiada rekod bagi bulan ini.")}</span>}
            {hari.map((h) => (
              <Baris key={h.date} h={h} today={today} grace={emp.graceMinutes} />
            ))}
          </div>
        )}
          </>
        )}
        <span className="text-xs leading-normal text-muted">
          {tr("Data daripada sistem kehadiran syarikat. Waktu masuk {0}, kelonggaran {1} minit. Terlupa mendaftar masuk? Tekan “Betulkan” untuk kelulusan ketua.", emp.workStart.slice(0, 5).replace(/^0/, ""), emp.graceMinutes)}</span>
      </main>
    </Screen>
  );
}

function Baris({ h, today, grace }: { h: HariHadir; today: string; grace: number }) {
  const tarikhLabel = `${hariPendek(h.date)} ${Number(h.date.slice(8))}`;
  const rehat = !h.working || h.holiday || h.leave;
  const bolehBetul = h.working && !h.holiday && !h.leave && h.correction !== "pending" && h.correction !== "approved" && (h.late > grace || !h.clockIn || (!h.clockOut && h.date !== today));
  return (
    <div className="grid grid-cols-[1.1fr_1fr_1fr_auto] items-center gap-2 border-t border-[#EEF2F1] py-2.5 text-sm">
      <span className="flex flex-col">
        <b className="font-bold">{tarikhLabel}</b>
        {h.date === today && <span className="text-[11px] text-muted">{tr("hari ini")}</span>}
      </span>
      {rehat && !h.clockIn ? (
        <span className="col-span-2 text-[13px] text-muted">{h.holiday ?? (h.leave ? (CUTI[h.leave] ?? tr("Cuti")) : tr("Hujung minggu"))}</span>
      ) : (
        <>
          <span className={`font-semibold ${h.late > grace && h.correction !== "approved" ? "text-warning" : ""}`}>{h.clockIn ? jam(h.clockIn) : "—"}</span>
          <span className="font-semibold">{h.clockOut ? jam(h.clockOut) : "—"}</span>
        </>
      )}
      <span className="flex w-[70px] justify-end">
        {h.correction === "pending" ? (
          <Tag tone="warning">{tr("Menunggu")}</Tag>
        ) : h.correction === "approved" ? (
          <Tag tone="success">{tr("Dibetulkan")}</Tag>
        ) : bolehBetul ? (
          <Link href={`/kehadiran/betulkan?tarikh=${h.date}`} className="flex min-h-11 items-center text-[13px] font-bold">
            {tr("Betulkan")}</Link>
        ) : null}
      </span>
    </div>
  );
}

function Kad({ n, label, tone }: { n: number; label: string; tone?: "warning" | "danger" }) {
  const c = tone === "warning" ? "bg-warning-soft text-warning" : tone === "danger" ? "bg-danger-soft text-danger" : "bg-surface";
  return (
    <div className={`flex flex-col gap-0.5 rounded-[14px] px-3.5 py-3 ${c}`}>
      <b className="text-xl font-extrabold">{n}</b>
      <span className={`text-xs ${tone ? "" : "text-muted"}`}>{label}</span>
    </div>
  );
}
