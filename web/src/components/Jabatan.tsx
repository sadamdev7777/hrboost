"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { must } from "@/lib/useData";
import { ErrorBox } from "./ui";
import { beritahu } from "./Dialog";
import { ButangUtama, Lembaran, MedanBorang, inputKecil } from "./Senarai";

type Orang = { personId: string; name: string; departmentId: string | null; employeeNo: string };

function ralatJabatan(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/duplicate|unique|departments_company_id_name/i.test(m)) return "Nama jabatan ini sudah wujud.";
  if (/foreign key|violates/i.test(m)) return "Jabatan ini masih dikaitkan dengan rekod pekerja (termasuk bekas pekerja). Pindahkan pekerja ke jabatan lain dahulu.";
  return m || "Ralat";
}

/** Pilih / tukar ketua jabatan (ketua menjadi pelulus pertama pasukannya). */
export function PilihKetua({
  jabatan,
  ppl,
  onClose,
  onDone,
}: {
  jabatan: { id: string; name: string; headPersonId: string | null };
  ppl: Orang[];
  onClose: () => void;
  onDone: () => void;
}) {
  const susun = [...ppl].sort((a, b) => Number(b.departmentId === jabatan.id) - Number(a.departmentId === jabatan.id));
  const [orang, setOrang] = useState(jabatan.headPersonId ?? susun[0]?.personId ?? "");
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  async function simpan() {
    setBusy(true);
    setRalat(null);
    try {
      must(await getSupabase().rpc("set_department_head", { p_department: jabatan.id, p_person: orang || (null as unknown as string) }));
      beritahu(orang ? `Ketua ${jabatan.name} ditetapkan.` : `Ketua ${jabatan.name} dibuang.`);
      onDone();
    } catch (e) {
      setRalat(ralatJabatan(e));
      setBusy(false);
    }
  }
  return (
    <Lembaran title={`Ketua ${jabatan.name}`} onClose={onClose}>
      <MedanBorang label="Pekerja" nota="Ketua jabatan menjadi pelulus pertama bagi cuti, tuntutan dan pembetulan masa pasukannya.">
        <select className={inputKecil} value={orang} onChange={(e) => setOrang(e.target.value)}>
          {jabatan.headPersonId && <option value="">Tiada ketua</option>}
          {susun.map((p) => (
            <option key={p.personId} value={p.personId}>
              {p.name} · {p.employeeNo}
              {p.departmentId === jabatan.id ? "" : " (jabatan lain)"}
            </option>
          ))}
        </select>
      </MedanBorang>
      {ralat && <ErrorBox message={ralat} />}
      <ButangUtama onClick={simpan} busy={busy}>
        Tetapkan ketua
      </ButangUtama>
    </Lembaran>
  );
}

/** Cipta jabatan baharu, atau namakan semula jabatan sedia ada (`jabatan` diberi). */
export function BorangJabatan({
  cid,
  jabatan,
  onClose,
  onDone,
}: {
  cid: string;
  jabatan?: { id: string; name: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const [nama, setNama] = useState(jabatan?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  async function simpan() {
    const n = nama.trim();
    if (!n) return setRalat("Sila isi nama jabatan.");
    if (n.length > 60) return setRalat("Nama jabatan terlalu panjang (maksimum 60 aksara).");
    setBusy(true);
    setRalat(null);
    try {
      const sb = getSupabase();
      if (jabatan) must(await sb.from("departments").update({ name: n }).eq("id", jabatan.id));
      else must(await sb.from("departments").insert({ company_id: cid, name: n }));
      beritahu(jabatan ? "Nama jabatan dikemas kini." : `Jabatan ${n} ditambah.`);
      onDone();
    } catch (e) {
      setRalat(ralatJabatan(e));
      setBusy(false);
    }
  }
  return (
    <Lembaran title={jabatan ? "Namakan semula jabatan" : "Jabatan baharu"} onClose={onClose}>
      <MedanBorang label="Nama jabatan">
        <input className={inputKecil} value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Contoh: Operasi" autoFocus />
      </MedanBorang>
      {ralat && <ErrorBox message={ralat} />}
      <ButangUtama onClick={simpan} busy={busy}>
        {jabatan ? "Simpan" : "Tambah"}
      </ButangUtama>
    </Lembaran>
  );
}

/** Padam jabatan kosong. */
export async function padamJabatan(id: string): Promise<string | null> {
  try {
    must(await getSupabase().from("departments").delete().eq("id", id));
    beritahu("Jabatan dipadam.");
    return null;
  } catch (e) {
    return ralatJabatan(e);
  }
}
