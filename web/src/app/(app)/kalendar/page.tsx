"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { addDays, dow, todayISO } from "@/lib/format";
import { BULAN_PENUH } from "@/lib/gaji";
import { getKalendar, type CutiKalendar, type Kalendar } from "@/lib/urusan";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { PengepalaAkar } from "@/components/TabNav";
import { useSkrinLebar } from "@/lib/skrin";

const HARI = ["Isn", "Sel", "Rab", "Kha", "Jum", "Sab", "Ahd"];
const HARI_PENUH = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
/** Amaran "ramai bercuti": sekurang-kurangnya 2 orang dan ≥ 30% jabatan pada hari yang sama. */
const HAD = 0.3;

type Hari = { iso: string; cuti: CutiKalendar[]; cutiUmum: string | null; jadi: string[]; amaran: string[] };

function binaHari(k: Kalendar, dari: string, hingga: string): Hari[] {
  const out: Hari[] = [];
  for (let d = dari; d <= hingga; d = addDays(d, 1)) {
    const cuti = k.leave.filter((c) => c.start <= d && c.end >= d);
    const bulan = Number(d.slice(5, 7));
    const tarikh = Number(d.slice(8, 10));
    const kiraan = new Map<string, { n: number; nama: string }>();
    for (const c of cuti.filter((x) => x.status === "approved")) {
      const k2 = c.department_id ?? "-";
      kiraan.set(k2, { n: (kiraan.get(k2)?.n ?? 0) + 1, nama: c.department ?? "Tiada jabatan" });
    }
    const amaran = [...kiraan.entries()]
      .filter(([id, v]) => v.n >= 2 && v.n / Math.max(k.headcount[id] ?? 1, 1) >= HAD)
      .map(([id, v]) => `${v.nama}: ${v.n}/${k.headcount[id]} bercuti`);
    out.push({
      iso: d,
      cuti,
      cutiUmum: k.holidays.find((h) => h.date === d)?.name ?? null,
      jadi: k.birthdays.filter((b) => b.month === bulan && b.day === tarikh).map((b) => b.name),
      amaran,
    });
  }
  return out;
}

/** Kalendar cuti pasukan: siapa bercuti, cuti umum dan hari jadi dalam satu bulan. */
export default function KalendarPage() {
  const me = useMe();
  const emp = me.active!;
  const t = todayISO();
  const lebar = useSkrinLebar();
  const [bulan, setBulan] = useState(t.slice(0, 7));
  const [jabatan, setJabatan] = useState("");
  const dari = `${bulan}-01`;
  const hingga = addDays(`${new Date(Date.UTC(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)), 1)).toISOString().slice(0, 7)}-01`, -1);
  const d = useData(() => getKalendar(emp.companyId, dari, hingga, jabatan), [emp.companyId, dari, jabatan]);
  const hari = useMemo(() => (d.data ? binaHari(d.data, dari, hingga) : []), [d.data, dari, hingga]);
  const geser = (n: number) => {
    const x = new Date(Date.UTC(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)) - 1 + n, 1));
    setBulan(x.toISOString().slice(0, 7));
  };
  const tajuk = `${BULAN_PENUH[Number(bulan.slice(5, 7)) - 1]} ${bulan.slice(0, 4)}`;
  const amaranBulan = hari.filter((h) => h.amaran.length).length;

  return (
    <Screen lebar="lebar">
      <PengepalaAkar title="Kalendar pasukan" back="/saya" />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-6 lg:px-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-surface p-1">
            <button type="button" aria-label="Bulan sebelumnya" onClick={() => geser(-1)} className="flex size-9 items-center justify-center rounded-full text-lg">
              ‹
            </button>
            <b className="min-w-[132px] text-center text-sm font-extrabold">{tajuk}</b>
            <button type="button" aria-label="Bulan seterusnya" onClick={() => geser(1)} className="flex size-9 items-center justify-center rounded-full text-lg">
              ›
            </button>
          </div>
          {bulan !== t.slice(0, 7) && (
            <button type="button" onClick={() => setBulan(t.slice(0, 7))} className="flex h-9 items-center rounded-full border border-line px-3 text-[13px] font-bold">
              Bulan ini
            </button>
          )}
          {(d.data?.departments.length ?? 0) > 1 && (
            <select
              aria-label="Jabatan"
              value={jabatan}
              onChange={(e) => setJabatan(e.target.value)}
              className="h-9 rounded-full border border-line bg-surface px-3 text-[13px] font-bold"
            >
              <option value="">Semua jabatan</option>
              {d.data!.departments.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
          )}
          <span className="flex flex-wrap items-center gap-3 text-xs text-muted lg:ml-auto">
            <Petunjuk cls="bg-[#E3F1EE] text-primary">Cuti</Petunjuk>
            <Petunjuk cls="border border-dashed border-primary text-primary">Menunggu kelulusan</Petunjuk>
            <Petunjuk cls="bg-[#FDEBD7] text-warning">Cuti umum</Petunjuk>
          </span>
        </div>
        {amaranBulan > 0 && (
          <div className="rounded-card bg-warning-soft px-4 py-3 text-[13px] text-warning">
            <b>Perhatian:</b> {amaranBulan} hari dalam bulan ini, ramai pekerja sejabatan bercuti serentak (sekurang-kurangnya {Math.round(HAD * 100)}% jabatan).
          </div>
        )}
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data && <Loading />}
        {d.data && (lebar ? <Grid hari={hari} t={t} full={d.data.full} /> : <Senarai hari={hari} t={t} full={d.data.full} />)}
        {d.data && !d.data.full && <span className="text-xs text-muted">Anda melihat cuti jabatan anda sahaja. Jenis cuti hanya dipaparkan kepada HR.</span>}
      </main>
    </Screen>
  );
}

function Petunjuk({ cls, children }: { cls: string; children: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-3 w-5 rounded ${cls}`} />
      {children}
    </span>
  );
}

function Lencana({ c, full }: { c: CutiKalendar; full: boolean }) {
  const label = `${c.name}${full && c.type ? ` · ${c.type}` : ""}${c.half_day !== "full" ? " (½)" : ""}`;
  const isi = (
    <span
      title={`${c.name} — ${c.type_name}${c.status === "pending" ? " (menunggu kelulusan)" : ""}`}
      className={`block truncate rounded-[6px] px-1.5 py-0.5 text-[11px] font-semibold ${c.status === "pending" ? "border border-dashed border-primary text-primary" : "bg-[#E3F1EE] text-primary"}`}
    >
      {label}
    </span>
  );
  return full ? (
    <Link href={`/pengurusan/pekerja/${c.employment_id}`} className="block">
      {isi}
    </Link>
  ) : (
    isi
  );
}

function Grid({ hari, t, full }: { hari: Hari[]; t: string; full: boolean }) {
  const kosong = (dow(hari[0].iso) + 6) % 7; // Isnin = 0
  return (
    <div className="overflow-hidden rounded-card bg-surface">
      <div className="grid grid-cols-7 border-b border-line-soft text-center text-xs font-bold text-muted">
        {HARI.map((h) => (
          <span key={h} className="py-2">
            {h}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: kosong }).map((_, i) => (
          <span key={"k" + i} className="min-h-[112px] border-r border-b border-[#EEF2F1] bg-page/40" />
        ))}
        {hari.map((h) => {
          const hujung = [0, 6].includes(dow(h.iso));
          return (
            <div
              key={h.iso}
              className={`flex min-h-[112px] flex-col gap-1 border-r border-b border-[#EEF2F1] p-1.5 ${h.amaran.length ? "bg-warning-soft/60" : hujung ? "bg-page/50" : ""}`}
              title={h.amaran.join("\n") || undefined}
            >
              <span className="flex items-center justify-between gap-1">
                <span className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${h.iso === t ? "bg-primary text-white" : hujung ? "text-muted" : ""}`}>
                  {Number(h.iso.slice(8, 10))}
                </span>
                {h.jadi.length > 0 && (
                  <span className="truncate text-[10px] font-semibold text-ai" title={`Hari jadi: ${h.jadi.join(", ")}`}>
                    Hari jadi: {h.jadi.join(", ")}
                  </span>
                )}
              </span>
              {h.cutiUmum && <span className="truncate rounded-[6px] bg-[#FDEBD7] px-1.5 py-0.5 text-[11px] font-semibold text-warning">{h.cutiUmum}</span>}
              {h.cuti.slice(0, 3).map((c) => (
                <Lencana key={c.employment_id + c.start} c={c} full={full} />
              ))}
              {h.cuti.length > 3 && <span className="px-1 text-[11px] font-bold text-muted">+{h.cuti.length - 3} lagi</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Senarai({ hari, t, full }: { hari: Hari[]; t: string; full: boolean }) {
  const ada = hari.filter((h) => h.cuti.length || h.cutiUmum || h.jadi.length);
  if (!ada.length) return <div className="rounded-card bg-surface px-4 py-8 text-center text-sm text-muted">Tiada cuti atau cuti umum bulan ini.</div>;
  return (
    <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
      {ada.map((h) => (
        <div key={h.iso} className={`flex gap-3 py-2.5 ${h.amaran.length ? "-mx-4 bg-warning-soft/60 px-4" : ""}`}>
          <span className={`flex w-11 shrink-0 flex-col items-center rounded-[10px] py-1 ${h.iso === t ? "bg-primary text-white" : "bg-page"}`}>
            <b className="text-base leading-tight">{Number(h.iso.slice(8, 10))}</b>
            <span className="text-[10px] font-semibold">{HARI_PENUH[dow(h.iso)].slice(0, 3)}</span>
          </span>
          <span className="flex min-w-0 grow flex-col gap-1">
            {h.cutiUmum && <span className="text-[13px] font-bold text-warning">{h.cutiUmum}</span>}
            {h.jadi.length > 0 && <span className="text-xs font-semibold text-ai">Hari jadi: {h.jadi.join(", ")}</span>}
            {h.cuti.length > 0 && (
              <span className="flex flex-wrap gap-1">
                {h.cuti.map((c) => (
                  <span key={c.employment_id + c.start} className="max-w-full">
                    <Lencana c={c} full={full} />
                  </span>
                ))}
              </span>
            )}
            {h.amaran.map((a) => (
              <span key={a} className="text-xs font-bold text-warning">
                {a}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}
