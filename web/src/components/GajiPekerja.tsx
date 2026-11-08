"use client";

import { useState } from "react";
import { todayISO } from "@/lib/format";
import { setGajiPekerja, tambahKomponen, type KomponenTetap } from "@/lib/gaji";
import { ErrorBox } from "./ui";
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

  async function simpan() {
    setRalat(null);
    const out: Record<string, number> = {};
    for (const c of komponen) {
      const n = nilaiInput(nilai[c.code] ?? "");
      if (n === null) return setRalat(`Amaun ${c.name} tidak sah.`);
      if (n !== (items[c.code] ?? 0)) out[c.code] = n;
    }
    if ((nilaiInput(nilai.BASIC ?? "") ?? 0) <= 0) return setRalat("Sila isi gaji pokok.");
    if (!Object.keys(out).length) return setRalat("Tiada perubahan untuk disimpan.");
    if (!mulai) return setRalat("Sila pilih tarikh berkuat kuasa.");
    setBusy(true);
    try {
      await setGajiPekerja(employmentId, out, mulai);
      onDone();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
      setBusy(false);
    }
  }

  return (
    <Lembaran title={`Gaji ${nama}`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-2.5">
        {komponen.map((c) => (
          <MedanBorang key={c.code} label={`${c.name}${c.kind === "deduction" ? " (potongan)" : ""} (RM)`}>
            <input
              className={inputKecil}
              inputMode="decimal"
              placeholder="0.00"
              value={nilai[c.code] ?? ""}
              onChange={(e) => setNilai({ ...nilai, [c.code]: e.target.value.replace(/[^\d.,]/g, "") })}
            />
          </MedanBorang>
        ))}
        <MedanBorang label="Berkuat kuasa mulai" nota={adaGaji ? "Gaji sebelum tarikh ini kekal" : "Lalai: tarikh mula bekerja"}>
          <input className={inputKecil} type="date" min={tarikhMula} value={mulai} onChange={(e) => setMulai(e.target.value)} />
        </MedanBorang>
      </div>
      <span className="text-xs leading-normal text-muted">Kosongkan atau isi 0 untuk menghentikan elaun mulai tarikh tersebut. Komisen dan kerja lebih masa dimasukkan setiap bulan dalam Proses Gaji.</span>
      {ralat && <ErrorBox message={ralat} />}
      <ButangUtama onClick={simpan} busy={busy}>
        Simpan gaji
      </ButangUtama>
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
    if (nama.trim().length < 3) return setRalat("Sila isi nama (sekurang-kurangnya 3 aksara).");
    setBusy(true);
    try {
      await tambahKomponen(companyId, nama.trim(), jenis, epf, socso, cukai);
      onDone();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
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
    <Lembaran title="Jenis elaun / potongan baharu" onClose={onClose}>
      <MedanBorang label="Nama">
        <input className={inputKecil} value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Contoh: Elaun Telefon" />
      </MedanBorang>
      <MedanBorang label="Jenis">
        <select className={inputKecil} value={jenis} onChange={(e) => setJenis(e.target.value as "earning" | "deduction")}>
          <option value="earning">Elaun (ditambah kepada gaji)</option>
          <option value="deduction">Potongan tetap (ditolak daripada gaji)</option>
        </select>
      </MedanBorang>
      <div className="flex flex-col">
        {kotak("Dikenakan caruman KWSP", epf, setEpf)}
        {kotak("Dikenakan caruman PERKESO & SIP", socso, setSocso)}
        {kotak("Dikenakan cukai (PCB)", cukai, setCukai)}
      </div>
      <span className="text-xs leading-normal text-muted">Kebanyakan elaun tetap dikenakan KWSP, PERKESO dan cukai. Semak dengan penasihat cukai bagi elaun yang dikecualikan.</span>
      {ralat && <ErrorBox message={ralat} />}
      <ButangUtama onClick={simpan} busy={busy}>
        Tambah
      </ButangUtama>
    </Lembaran>
  );
}
