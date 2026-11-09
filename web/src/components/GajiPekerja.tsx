"use client";

import { tr } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { todayISO } from "@/lib/format";
import { pratontonGaji, setGajiPekerja, tambahKomponen, type Kiraan, type KomponenTetap } from "@/lib/gaji";
import { ErrorBox } from "./ui";
import { beritahu } from "./Dialog";
import { ButangUtama, Lembaran, MedanBorang, inputKecil } from "./Senarai";

/** Tarikh berkuat kuasa lalai: tarikh mula kerja jika gaji belum pernah ditetapkan, selainnya 1hb bulan ini. */
export function mulaiLalai(adaGaji: boolean, tarikhMula: string): string {
  return adaGaji ? `${todayISO().slice(0, 7)}-01` : tarikhMula;
}

export function nilaiInput(v: string): number | null {
  const t = v.replace(/,/g, "").trim();
  if (t === "") return 0;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/** Lembaran ubah gaji seorang pekerja (gaji pokok + elaun / potongan tetap). */
export function UbahGaji({
  employmentId,
  nama,
  komponen,
  items,
  tarikhMula,
  onClose,
  onDone,
}: {
  employmentId: string;
  nama: string;
  komponen: KomponenTetap[];
  items: Record<string, number>;
  tarikhMula: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const adaGaji = (items.BASIC ?? 0) > 0;
  const [nilai, setNilai] = useState<Record<string, string>>(() => Object.fromEntries(komponen.map((c) => [c.code, items[c.code] ? String(items[c.code]) : ""])));
  const [mulai, setMulai] = useState(mulaiLalai(adaGaji, tarikhMula));
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const semua: Record<string, number> | null = (() => {
    const o: Record<string, number> = {};
    for (const c of komponen) {
      const n = nilaiInput(nilai[c.code] ?? "");
      if (n === null) return null;
      if (n > 0) o[c.code] = n;
    }
    return o.BASIC ? o : null;
  })();
  const pr = usePratonton(employmentId, semua, mulai || undefined);

  async function simpan() {
    setRalat(null);
    const out: Record<string, number> = {};
    for (const c of komponen) {
      const n = nilaiInput(nilai[c.code] ?? "");
      if (n === null) return setRalat(tr("Amaun {0} tidak sah.", c.name));
      if (n !== (items[c.code] ?? 0)) out[c.code] = n;
    }
    if ((nilaiInput(nilai.BASIC ?? "") ?? 0) <= 0) return setRalat(tr("Sila isi gaji pokok."));
    if (!Object.keys(out).length) return setRalat(tr("Tiada perubahan untuk disimpan."));
    if (!mulai) return setRalat(tr("Sila pilih tarikh berkuat kuasa."));
    setBusy(true);
    try {
      await setGajiPekerja(employmentId, out, mulai);
      beritahu(tr("Gaji {0} disimpan.", nama));
      onDone();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
      setBusy(false);
    }
  }

  return (
    <Lembaran title={tr("Gaji {0}", nama)} onClose={onClose}>
      <div className="grid grid-cols-2 gap-2.5">
        {komponen.map((c) => (
          <MedanBorang key={c.code} label={tr("{0}{1} (RM)", c.name, c.kind === "deduction" ? " (potongan)" : "")}>
            <input
              className={inputKecil}
              inputMode="decimal"
              placeholder="0.00"
              value={nilai[c.code] ?? ""}
              onChange={(e) => setNilai({ ...nilai, [c.code]: e.target.value.replace(/[^\d.,]/g, "") })}
            />
          </MedanBorang>
        ))}
        <MedanBorang label={tr("Berkuat kuasa mulai")} nota={adaGaji ? tr("Gaji sebelum tarikh ini kekal") : tr("Lalai: tarikh mula bekerja")}>
          <input className={inputKecil} type="date" min={tarikhMula} value={mulai} onChange={(e) => setMulai(e.target.value)} />
        </MedanBorang>
      </div>
      <RingkasanKiraan k={semua ? pr.k : null} mengira={pr.mengira} padat />
      {pr.ralat && <ErrorBox message={pr.ralat} />}
      <span className="text-xs leading-normal text-muted">{tr("Kosongkan atau isi 0 untuk menghentikan elaun mulai tarikh tersebut.")}</span>
      {ralat && <ErrorBox message={ralat} />}
      <ButangUtama onClick={simpan} busy={busy}>
        {tr("Simpan gaji")}</ButangUtama>
    </Lembaran>
  );
}

/** Lembaran tambah jenis elaun / potongan tetap syarikat. */
export function KomponenBaharu({ companyId, onClose, onDone }: { companyId: string; onClose: () => void; onDone: () => void }) {
  const [nama, setNama] = useState("");
  const [jenis, setJenis] = useState<"earning" | "deduction">("earning");
  const [epf, setEpf] = useState(true);
  const [socso, setSocso] = useState(true);
  const [cukai, setCukai] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  async function simpan() {
    setRalat(null);
    if (nama.trim().length < 3) return setRalat(tr("Sila isi nama (sekurang-kurangnya 3 aksara)."));
    setBusy(true);
    try {
      await tambahKomponen(companyId, nama.trim(), jenis, epf, socso, cukai);
      beritahu(tr("{0} ditambah.", nama.trim()));
      onDone();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
      setBusy(false);
    }
  }
  const kotak = (label: string, v: boolean, set: (b: boolean) => void) => (
    <label className="flex min-h-11 items-center gap-2.5 text-sm">
      <input type="checkbox" checked={v} onChange={(e) => set(e.target.checked)} className="size-5 accent-primary" />
      {label}
    </label>
  );
  return (
    <Lembaran title={tr("Jenis elaun / potongan baharu")} onClose={onClose}>
      <MedanBorang label={tr("Nama")}>
        <input className={inputKecil} value={nama} onChange={(e) => setNama(e.target.value)} placeholder={tr("Contoh: Elaun Telefon")} />
      </MedanBorang>
      <MedanBorang label={tr("Jenis")}>
        <select className={inputKecil} value={jenis} onChange={(e) => setJenis(e.target.value as "earning" | "deduction")}>
          <option value="earning">{tr("Elaun (ditambah kepada gaji)")}</option>
          <option value="deduction">{tr("Potongan tetap (ditolak daripada gaji)")}</option>
        </select>
      </MedanBorang>
      <div className="flex flex-col">
        {kotak(tr("Dikenakan caruman KWSP"), epf, setEpf)}
        {kotak(tr("Dikenakan caruman PERKESO & SIP"), socso, setSocso)}
        {kotak(tr("Dikenakan cukai (PCB)"), cukai, setCukai)}
      </div>
      <span className="text-xs leading-normal text-muted">{tr("Kebanyakan elaun tetap dikenakan KWSP, PERKESO dan cukai. Semak dengan penasihat cukai bagi elaun yang dikecualikan.")}</span>
      {ralat && <ErrorBox message={ralat} />}
      <ButangUtama onClick={simpan} busy={busy}>
        {tr("Tambah")}</ButangUtama>
    </Lembaran>
  );
}

/** Pratonton langsung (dinyahlantun 350 ms) setiap kali amaun berubah. */
export function usePratonton(employmentId: string, items: Record<string, number> | null, pada?: string) {
  const kunci = items ? JSON.stringify(items) : "";
  const [hasil, setHasil] = useState<{ kunci: string; k: Kiraan | null; ralat: string | null } | null>(null);
  useEffect(() => {
    if (!kunci) return;
    let batal = false;
    const t = setTimeout(() => {
      pratontonGaji(employmentId, JSON.parse(kunci) as Record<string, number>, pada)
        .then((k) => !batal && setHasil({ kunci, k, ralat: null }))
        .catch((e: unknown) => !batal && setHasil({ kunci, k: null, ralat: e instanceof Error ? e.message : tr("Ralat") }));
    }, 350);
    return () => {
      batal = true;
      clearTimeout(t);
    };
  }, [employmentId, kunci, pada]);
  return { k: hasil?.k ?? null, ralat: hasil?.ralat ?? null, mengira: !!kunci && hasil?.kunci !== kunci };
}

const rm2 = (n: number | undefined) => Number(n ?? 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Baris({ l, v, tebal, tolak }: { l: string; v: number; tebal?: boolean; tolak?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 ${tebal ? "font-extrabold" : ""}`}>
      <span className={tebal ? "" : "text-subtle"}>{l}</span>
      <span className="tabular-nums">
        {tolak && v > 0 ? "−" : ""}
        {rm2(v)}
      </span>
    </div>
  );
}

/** Pecahan gaji: kasar → potongan pekerja → bersih; caruman majikan → kos majikan. */
export function RingkasanKiraan({ k, mengira, padat }: { k: Kiraan | null; mengira?: boolean; padat?: boolean }) {
  if (!k) return <div className="rounded-[14px] bg-[#F7F9F8] px-4 py-3 text-[13px] text-muted">{mengira ? tr("Mengira…") : tr("Isi gaji pokok untuk melihat kiraan KWSP, PERKESO, SIP dan PCB.")}</div>;
  if (!k.statutory_ready) return <div className="rounded-[14px] bg-warning-soft px-4 py-3 text-[13px] text-warning">{tr("Jadual kadar berkanun belum dimuatkan untuk tarikh ini.")}</div>;
  return (
    <div className={`grid gap-3 rounded-[14px] bg-[#F7F9F8] px-4 py-3 text-[13px] ${padat ? "" : "lg:grid-cols-2 lg:gap-6"} ${mengira ? "opacity-60" : ""}`} aria-live="polite">
      <div className="flex flex-col gap-1">
        <b className="text-xs tracking-[0.04em] text-muted">{tr("PEKERJA (SEBULAN)")}</b>
        <Baris l={tr("Gaji kasar")} v={k.gross} tebal />
        <Baris l={tr("KWSP pekerja")} v={k.epf_employee} tolak />
        <Baris l={tr("PERKESO pekerja")} v={k.socso_employee} tolak />
        <Baris l={tr("SIP pekerja")} v={k.eis_employee} tolak />
        <Baris l={tr("PCB (anggaran)")} v={k.pcb} tolak />
        {k.fixed_deduction > 0 && <Baris l={tr("Potongan tetap")} v={k.fixed_deduction} tolak />}
        <div className="mt-1 border-t border-line pt-1.5">
          <Baris l={tr("Gaji bersih")} v={k.net} tebal />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <b className="text-xs tracking-[0.04em] text-muted">{tr("MAJIKAN (SEBULAN)")}</b>
        <Baris l={tr("Gaji kasar")} v={k.gross} />
        <Baris l={tr("KWSP majikan")} v={k.epf_employer} />
        <Baris l={tr("PERKESO majikan")} v={k.socso_employer} />
        <Baris l={tr("SIP majikan")} v={k.eis_employer} />
        <div className="flex items-center justify-between gap-2">
          <span className="text-subtle">{tr("Levi HRD Corp")}</span>
          <span className="tabular-nums">{k.hrdf_registered ? rm2(k.hrdf) : tr("Tidak berdaftar")}</span>
        </div>
        <div className="mt-1 border-t border-line pt-1.5">
          <Baris l={tr("Jumlah kos majikan")} v={k.employer_cost} tebal />
        </div>
      </div>
      <span className="text-[11px] leading-snug text-muted lg:col-span-2">
        {tr("Anggaran gaji tetap sahaja. Komisen, kerja lebih masa, tuntutan dan cuti tanpa gaji ditambah semasa Proses Gaji. PCB bergantung pada data terkumpul tahun ini.")}</span>
    </div>
  );
}
