"use client";

// Borang EA (C.P.8A) & Borang E / C.P.8D — data daripada RPC hr_ea / my_ea (migrasi 20261203000200).
import { tr } from "@/lib/i18n";
import { getSupabase } from "./supabase";
import { must } from "./useData";
import { muatTurunCSV } from "./modul";

export type BarisEA = {
  employment_id: string;
  employee_no: string;
  person_id: string;
  full_name: string;
  ic_no: string | null;
  tax_no: string | null;
  epf_no: string | null;
  socso_no: string | null;
  position: string | null;
  join_date: string | null;
  end_date: string | null;
  months: number;
  b1a: number;
  b1b: number;
  total_income: number;
  pcb: number;
  epf: number;
  socso: number;
  has_opening: boolean;
};
export type MajikanEA = {
  name: string;
  reg_no: string | null;
  address: string | null;
  lhdn_employer_no: string | null;
  epf_employer_no: string | null;
  year: number;
  released_at: string | null;
};

const angka = (r: BarisEA): BarisEA => ({
  ...r,
  months: Number(r.months),
  b1a: Number(r.b1a),
  b1b: Number(r.b1b),
  total_income: Number(r.total_income),
  pcb: Number(r.pcb),
  epf: Number(r.epf),
  socso: Number(r.socso),
});

export async function getEaHr(companyId: string, tahun: number): Promise<{ company: MajikanEA; rows: BarisEA[] }> {
  const r = must(await getSupabase().rpc("hr_ea", { p_company: companyId, p_year: tahun })) as unknown as { company: MajikanEA; rows: BarisEA[] };
  return { company: r.company, rows: (r.rows ?? []).map(angka) };
}

export async function getEaSaya(employmentId: string, tahun: number): Promise<{ released: boolean; company?: MajikanEA; row?: BarisEA | null }> {
  const r = must(await getSupabase().rpc("my_ea", { p_employment: employmentId, p_year: tahun })) as unknown as {
    released: boolean;
    company?: MajikanEA;
    row?: BarisEA | null;
  };
  return { ...r, row: r.row ? angka(r.row) : null };
}

export async function keluarkanEa(companyId: string, tahun: number): Promise<number> {
  return Number(must(await getSupabase().rpc("hr_ea_release", { p_company: companyId, p_year: tahun })));
}

/** Ringkasan Borang E (majikan) daripada semua Borang EA tahun itu. */
export function ringkasanBorangE(rows: BarisEA[]) {
  const jum = (k: "total_income" | "pcb" | "epf" | "socso") => rows.reduce((s, r) => s + r[k], 0);
  return {
    pekerja: rows.length,
    pcbPekerja: rows.filter((r) => r.pcb > 0).length,
    saraan: jum("total_income"),
    pcb: jum("pcb"),
    kwsp: jum("epf"),
    perkeso: jum("socso"),
    baru: rows.filter((r) => r.join_date).length,
    berhenti: rows.filter((r) => r.end_date).length,
  };
}

/** C.P.8D: maklumat saraan setiap pekerja (lampiran Borang E) sebagai CSV. */
export function eksportCP8D(m: MajikanEA, rows: BarisEA[]) {
  muatTurunCSV(tr("CP8D-{0}-{1}.csv", m.lhdn_employer_no ?? m.name, m.year), [
    [
      tr("Bil."),
      tr("Nama pekerja"),
      tr("No. cukai pendapatan"),
      tr("No. kad pengenalan"),
      tr("No. pekerja"),
      tr("Tarikh mula"),
      tr("Tarikh berhenti"),
      tr("Jumlah saraan kasar (RM)"),
      tr("Manfaat berupa barangan (RM)"),
      tr("Nilai tempat kediaman (RM)"),
      tr("Elaun dikecualikan cukai (RM)"),
      tr("PCB (RM)"),
      tr("CP38 (RM)"),
      tr("Zakat (RM)"),
      tr("KWSP pekerja (RM)"),
      tr("PERKESO pekerja (RM)"),
    ],
    ...rows.map((r, i) => [
      i + 1,
      r.full_name,
      r.tax_no ?? "",
      r.ic_no ?? "",
      r.employee_no,
      r.join_date ?? "",
      r.end_date ?? "",
      r.total_income.toFixed(2),
      "0.00",
      "0.00",
      "0.00",
      r.pcb.toFixed(2),
      "0.00",
      "0.00",
      r.epf.toFixed(2),
      r.socso.toFixed(2),
    ]),
  ]);
}
