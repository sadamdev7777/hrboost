"use client";

import Link from "next/link";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getBaki } from "@/lib/data";
import { getKalendarCuti, getSejarahCuti, namaCutiRingkas, type HariKalendar } from "@/lib/profil";
import { hari, julatTarikh, namaPeringkat, todayISO } from "@/lib/format";
import { IconBack, IconChevronRight } from "@/components/icons";
import { BackHeader, ErrorBox, Loading, Screen, StatusPill } from "@/components/ui";

const BULAN_PENUH = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];
const HARI_SINGKAT = ["I", "S", "R", "K", "J", "S", "A"];

function geserBulan(b: string, n: number) {
  const [y, m] = b.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

const GAYA: Record<NonNullable<HariKalendar["jenis"]>, string> = {
  me: "bg-primary text-white",
  ot: "bg-[#FDEBD7] text-warning",
  ph: "bg-[#FBE4E2] text-danger",
};

// Rujukan reka bentuk: design/Cuti.dc.html
export default function CutiPage() {
  const me = useMe();
  const emp = me.active!;
  const [bulan, setBulan] = useState(() => todayISO().slice(0, 7));
  const baki = useData(() => getBaki(emp), [emp.id]);
  const kal = useData(() => getKalendarCuti(emp, bulan), [emp.id, bulan]);
  const sejarah = useData(() => getSejarahCuti(emp), [emp.id]);
  const tahun = todayISO().slice(0, 4);

  const kad = Object.values(baki.data ?? {}).slice(0, 3);
  const [y, m] = bulan.split("-").map(Number);
  const pad = ((new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7) as number; // Isnin dahulu

  return (
    <Screen>
      <BackHeader title="Cuti" href="/saya" />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-4">
        {baki.error && <ErrorBox message={baki.error} />}
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          {kad.map((b) => (
            <div key={b.code} className="flex flex-col gap-0.5 rounded-[14px] bg-surface px-3.5 py-3">
              <b className="text-xl font-extrabold">{Number.isInteger(b.available) ? b.available : b.available.toFixed(1)}</b>
              <span className="text-xs text-muted">{namaCutiRingkas(b.code, b.name)}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 rounded-card bg-surface px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="-ml-3 flex shrink-0 items-center">
              <button type="button" aria-label="Bulan sebelumnya" onClick={() => setBulan(geserBulan(bulan, -1))} className="flex size-11 items-center justify-center rounded-full text-ink">
                <IconBack size={18} />
              </button>
              <h2 className="m-0 text-base font-extrabold whitespace-nowrap">
                {BULAN_PENUH[m - 1]} {y}
              </h2>
              <button type="button" aria-label="Bulan seterusnya" onClick={() => setBulan(geserBulan(bulan, 1))} className="flex size-11 items-center justify-center rounded-full text-ink">
                <IconChevronRight size={18} />
              </button>
            </div>
            {emp.departmentName && <span className="min-w-0 truncate text-xs font-bold text-muted">Pasukan {emp.departmentName}</span>}
          </div>
          {kal.error && <ErrorBox message={kal.error} />}
          <div className="grid grid-cols-7 gap-1 text-center" aria-label="Kalendar cuti pasukan">
            {HARI_SINGKAT.map((h, i) => (
              <span key={i} className="flex h-5 items-center justify-center text-[11px] font-bold text-muted">
                {h}
              </span>
            ))}
            {Array.from({ length: pad }, (_, i) => (
              <span key={`p${i}`} />
            ))}
            {(kal.data?.bulan === bulan ? kal.data.hari : []).map((d) => (
              <span
                key={d.date}
                title={d.label ?? undefined}
                className={`flex h-[34px] items-center justify-center rounded-[9px] text-[13px] font-semibold ${
                  d.jenis ? GAYA[d.jenis] : d.weekend ? "text-[#9AA8A5]" : ""
                } ${d.date === todayISO() && !d.jenis ? "ring-1 ring-primary" : ""}`}
              >
                {Number(d.date.slice(8))}
              </span>
            ))}
          </div>
          {kal.loading && !kal.data && <Loading />}
          <div className="flex flex-wrap gap-3 text-xs text-[#4A5A57]">
            <Petunjuk warna="bg-primary">Saya</Petunjuk>
            {(kal.data?.rakan ?? []).length > 0 && <Petunjuk warna="bg-[#F2B266]">{kal.data!.rakan.join(", ")}</Petunjuk>}
            <Petunjuk warna="bg-[#E8857C]">Cuti umum</Petunjuk>
          </div>
        </div>

        </div>
        <div className="flex flex-col gap-2">
          <h2 className="m-0 text-base font-extrabold whitespace-nowrap">Sejarah {tahun}</h2>
          {sejarah.error && <ErrorBox message={sejarah.error} />}
          {sejarah.loading && !sejarah.data && <Loading />}
          {sejarah.data?.length === 0 && <span className="text-sm text-muted">Belum ada permohonan cuti tahun ini.</span>}
          {(sejarah.data ?? []).map((s) => {
            const isi = (
              <>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold">
                    {s.jenis} · {julatTarikh(s.start, s.end)}
                  </span>
                  <span className="text-xs text-muted">{hari(s.days)} hari</span>
                </div>
                <StatusPill
                  status={s.status}
                  label={s.status === "pending" && s.waitingFor ? `Di peringkat ${s.waitingFor.split(", ").map(namaPeringkat).join(", ")}` : undefined}
                />
              </>
            );
            return s.approvalRequestId ? (
              <Link key={s.id} href={`/permohonan/${s.approvalRequestId}`} className="flex items-center justify-between gap-2 rounded-card bg-surface px-4 py-3 text-ink!">
                {isi}
              </Link>
            ) : (
              <div key={s.id} className="flex items-center justify-between gap-2 rounded-card bg-surface px-4 py-3">
                {isi}
              </div>
            );
          })}
        </div>
        </div>
      </main>

      <div className="bar-bawah sticky bottom-0 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
        <Link href="/mohon/cuti" className="flex h-12 items-center justify-center rounded-button bg-primary text-base font-extrabold text-white!">
          Mohon Cuti
        </Link>
      </div>
    </Screen>
  );
}

function Petunjuk({ warna, children }: { warna: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2.5 rounded-[3px] ${warna}`} />
      {children}
    </span>
  );
}
