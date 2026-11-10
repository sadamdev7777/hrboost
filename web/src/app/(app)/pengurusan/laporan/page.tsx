"use client";

import { tr } from "@/lib/i18n";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { hasRole, useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getLaporan, type JenisLaporan } from "@/lib/berkanun";
import { todayISO } from "@/lib/format";
import { BULAN_PENUH } from "@/lib/gaji";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { PengepalaAkar, TabNav } from "@/components/TabNav";
import { ButangBantuan, KadPanduan } from "@/components/Panduan";
import { HadPeranan, inputKecil } from "@/components/Senarai";

type Lajur = { k: string; label: string; jenis?: "rm" | "nombor" | "peratus" | "bulan" | "status" };
type Laporan = { id: JenisLaporan; tajuk: string; huraian: string; lajur: Lajur[]; gaji?: boolean };

const LAPORAN: Laporan[] = [
  {
    id: "pekerja",
    tajuk: tr("Bilangan & pusing ganti"),
    huraian: tr("Pekerja aktif, masuk dan keluar mengikut jabatan. Pusing ganti = keluar ÷ purata bilangan pekerja."),
    lajur: [
      { k: "jabatan", label: tr("Jabatan") },
      { k: "aktif", label: tr("Aktif"), jenis: "nombor" },
      { k: "masuk", label: tr("Masuk"), jenis: "nombor" },
      { k: "keluar", label: tr("Keluar"), jenis: "nombor" },
      { k: "keluar_90", label: tr("Keluar < 90 hari"), jenis: "nombor" },
      { k: "pusing_ganti", label: tr("Pusing ganti"), jenis: "peratus" },
    ],
  },
  {
    id: "baki_cuti",
    tajuk: tr("Baki cuti"),
    huraian: tr("Kelayakan, cuti diambil, menunggu kelulusan dan baki bagi setiap pekerja (tahun tarikh akhir)."),
    lajur: [
      { k: "pekerja", label: tr("Pekerja") },
      { k: "no", label: tr("No.") },
      { k: "jabatan", label: tr("Jabatan") },
      { k: "jenis", label: tr("Jenis cuti") },
      { k: "kelayakan", label: tr("Kelayakan"), jenis: "nombor" },
      { k: "diambil", label: tr("Diambil"), jenis: "nombor" },
      { k: "menunggu", label: tr("Menunggu"), jenis: "nombor" },
      { k: "baki", label: tr("Baki"), jenis: "nombor" },
    ],
  },
  {
    id: "cuti_diambil",
    tajuk: tr("Cuti diambil"),
    huraian: tr("Jumlah hari cuti yang diluluskan mengikut jabatan dan jenis cuti."),
    lajur: [
      { k: "jabatan", label: tr("Jabatan") },
      { k: "jenis", label: tr("Jenis cuti") },
      { k: "permohonan", label: tr("Permohonan"), jenis: "nombor" },
      { k: "hari", label: tr("Hari"), jenis: "nombor" },
    ],
  },
  {
    id: "kehadiran",
    tajuk: tr("Kehadiran & lewat"),
    huraian: tr("Hari hadir, kekerapan lewat (selepas tempoh ihsan) dan purata minit lewat bagi setiap pekerja."),
    lajur: [
      { k: "pekerja", label: tr("Pekerja") },
      { k: "no", label: tr("No.") },
      { k: "jabatan", label: tr("Jabatan") },
      { k: "hadir", label: tr("Hadir"), jenis: "nombor" },
      { k: "lewat", label: tr("Lewat"), jenis: "nombor" },
      { k: "purata_lewat_minit", label: tr("Purata lewat (minit)"), jenis: "nombor" },
    ],
  },
  {
    id: "tuntutan",
    tajuk: tr("Tuntutan"),
    huraian: tr("Tuntutan yang diluluskan mengikut jenis dan jabatan (ikut tarikh perbelanjaan)."),
    lajur: [
      { k: "jenis", label: tr("Jenis") },
      { k: "jabatan", label: tr("Jabatan") },
      { k: "bilangan", label: tr("Bilangan"), jenis: "nombor" },
      { k: "jumlah", label: tr("Jumlah"), jenis: "rm" },
    ],
  },
  {
    id: "kos_gaji",
    tajuk: tr("Kos gaji"),
    huraian: tr("Gaji kasar, bersih, caruman majikan dan jumlah kos majikan bagi setiap bulan."),
    gaji: true,
    lajur: [
      { k: "bulan", label: tr("Bulan"), jenis: "bulan" },
      { k: "status", label: tr("Status"), jenis: "status" },
      { k: "pekerja", label: tr("Pekerja"), jenis: "nombor" },
      { k: "kasar", label: tr("Kasar"), jenis: "rm" },
      { k: "bersih", label: tr("Bersih"), jenis: "rm" },
      { k: "caruman_majikan", label: tr("Caruman majikan"), jenis: "rm" },
      { k: "pcb", label: "PCB", jenis: "rm" },
      { k: "kos_majikan", label: tr("Kos majikan"), jenis: "rm" },
    ],
  },
];

const STATUS_GAJI: Record<string, string> = {
  calculated: tr("Dikira"),
  pending: tr("Menunggu kelulusan"),
  approved: tr("Diluluskan"),
  paid: tr("Dibayar"),
  locked: tr("Dikunci"),
  returned: tr("Dikembalikan"),
  rejected: tr("Ditolak"),
};

function papar(v: unknown, jenis?: Lajur["jenis"]): string {
  if (v === null || v === undefined || v === "") return "—";
  if (jenis === "rm") return Number(v).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (jenis === "peratus") return `${Number(v).toLocaleString("en-MY", { maximumFractionDigits: 1 })}%`;
  if (jenis === "nombor") return Number(v).toLocaleString("en-MY", { maximumFractionDigits: 1 });
  if (jenis === "bulan") {
    const s = String(v);
    return `${BULAN_PENUH[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}`;
  }
  if (jenis === "status") return STATUS_GAJI[String(v)] ?? String(v);
  return String(v);
}

function jumlahLajur(baris: Record<string, unknown>[], l: Lajur): string {
  if (l.jenis !== "rm" && !(l.jenis === "nombor" && !l.k.startsWith("purata"))) return "";
  const n = baris.reduce((a, b) => a + (Number(b[l.k]) || 0), 0);
  return papar(n, l.jenis);
}

export default function LaporanPage() {
  return (
    <HadPeranan roles={["hr", "finance", "ceo", "admin"]}>
      <Suspense fallback={<Loading />}>
        <Kandungan />
      </Suspense>
    </HadPeranan>
  );
}

function Kandungan() {
  const me = useMe();
  const emp = me.active!;
  const sp = useSearchParams();
  const router = useRouter();
  const hariIni = todayISO();
  const tersedia = LAPORAN.filter((l) => !l.gaji || hasRole(me, ["hr", "finance", "admin"]));
  const jenis = tersedia.find((l) => l.id === sp.get("jenis")) ?? tersedia[0];
  const [dari, setDari] = useState(`${hariIni.slice(0, 4)}-01-01`);
  const [hingga, setHingga] = useState(hariIni);
  const sah = dari && hingga && dari <= hingga;
  const d = useData(() => (sah ? getLaporan(emp.companyId, jenis.id, dari, hingga) : Promise.resolve([])), [emp.companyId, jenis.id, dari, hingga]);
  const baris = d.data ?? [];

  function pilih(id: JenisLaporan) {
    router.replace(`/pengurusan/laporan?jenis=${id}`, { scroll: false });
  }

  function pratetap(k: "bulan" | "suku" | "tahun" | "12") {
    const y = Number(hariIni.slice(0, 4));
    const m = Number(hariIni.slice(5, 7));
    if (k === "bulan") setDari(`${hariIni.slice(0, 7)}-01`);
    if (k === "suku") setDari(`${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, "0")}-01`);
    if (k === "tahun") setDari(`${y}-01-01`);
    if (k === "12") {
      const t = new Date(Date.UTC(y, m - 12, 1));
      setDari(t.toISOString().slice(0, 10));
    }
    setHingga(hariIni);
  }

  function eksport() {
    const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const kepala = jenis.lajur.map((l) => l.label);
    const isi = baris.map((b) => jenis.lajur.map((l) => (l.jenis === "rm" ? Number(b[l.k] ?? 0).toFixed(2) : l.jenis === "bulan" || l.jenis === "status" ? papar(b[l.k], l.jenis) : String(b[l.k] ?? ""))));
    const teks = [kepala, ...isi].map((r) => r.map(esc).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + teks], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = tr("laporan-{0}-{1}-{2}-{3}.csv", jenis.id.replace("_", "-"), emp.companyCode, dari, hingga);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const adaJumlah = jenis.lajur.some((l) => jumlahLajur(baris, l));

  return (
    <Screen lebar="lebar">
      <PengepalaAkar title={tr("Laporan")} backHr="/pengurusan" action={<ButangBantuan id="laporan" />} />
      <main className="flex grow flex-col gap-4 px-4 pt-2 pb-6 lg:px-0">
        <KadPanduan id="laporan" />
        <div role="tablist" aria-label={tr("Jenis laporan")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
          {tersedia.map((l) => (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={l.id === jenis.id}
              onClick={() => pilih(l.id)}
              className={`flex h-10 shrink-0 items-center rounded-full px-4 text-[13px] font-bold ${l.id === jenis.id ? "bg-primary text-white" : "border border-line bg-surface text-ink"}`}
            >
              {l.tajuk}
            </button>
          ))}
        </div>

        <section className="flex flex-col gap-3 rounded-card bg-surface px-4 py-4 lg:px-5">
          <p className="m-0 text-[13px] leading-snug text-subtle">{jenis.huraian}</p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-bold text-muted">
              {tr("Dari")}<input type="date" className={`${inputKecil} w-[160px]`} value={dari} max={hingga} onChange={(e) => setDari(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-muted">
              {tr("Hingga")}<input type="date" className={`${inputKecil} w-[160px]`} value={hingga} min={dari} onChange={(e) => setHingga(e.target.value)} />
            </label>
            <span className="flex flex-wrap gap-1.5">
              {(
                [
                  ["bulan", tr("Bulan ini")],
                  ["suku", tr("Suku ini")],
                  ["tahun", tr("Tahun ini")],
                  ["12", tr("12 bulan")],
                ] as const
              ).map(([k, t]) => (
                <button key={k} type="button" onClick={() => pratetap(k)} className="flex h-9 items-center rounded-full border border-line px-3 text-xs font-bold">
                  {t}
                </button>
              ))}
            </span>
            <button
              type="button"
              onClick={eksport}
              disabled={!baris.length}
              className="ml-auto flex h-10 items-center rounded-full border border-primary px-4 text-[13px] font-bold text-primary disabled:opacity-50"
            >
              {tr("Eksport CSV")}</button>
          </div>
        </section>

        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data && <Loading />}
        {d.data && baris.length === 0 && <div className="rounded-card bg-surface px-4 py-8 text-center text-sm text-muted">{tr("Tiada data bagi tempoh ini.")}</div>}
        {baris.length > 0 && (
          <div className="overflow-x-auto rounded-card bg-surface">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line-soft text-left text-xs text-muted">
                  {jenis.lajur.map((l) => (
                    <th key={l.k} scope="col" className={`px-4 py-3 font-bold ${l.jenis && l.jenis !== "bulan" && l.jenis !== "status" ? "text-right" : ""}`}>
                      {tr(l.label)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {baris.map((b, i) => (
                  <tr key={i} className="border-b border-[#EEF2F1] last:border-0">
                    {jenis.lajur.map((l) => (
                      <td key={l.k} className={`px-4 py-2.5 ${l.jenis && l.jenis !== "bulan" && l.jenis !== "status" ? "text-right tabular-nums" : ""}`}>
                        {papar(b[l.k], l.jenis)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {adaJumlah && jenis.id !== "pekerja" && jenis.id !== "baki_cuti" && (
                <tfoot>
                  <tr className="border-t border-line-soft font-extrabold">
                    {jenis.lajur.map((l, i) => (
                      <td key={l.k} className={`px-4 py-3 ${l.jenis && l.jenis !== "bulan" && l.jenis !== "status" ? "text-right tabular-nums" : ""}`}>
                        {i === 0 ? tr("Jumlah") : jumlahLajur(baris, l)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
        {jenis.id === "kos_gaji" && <span className="text-xs text-muted">{tr("Hanya bulan yang telah dikira dipaparkan. Akses laporan gaji direkodkan dalam log akses data.")}</span>}
        <span className="text-xs text-muted">
          {sah ? tr("Tempoh: {0} hingga {1}", dari.split("-").reverse().join("/"), hingga.split("-").reverse().join("/")) : tr("Tarikh tidak sah.")}
        </span>
      </main>
      <TabNav />
    </Screen>
  );
}
