"use client";

import { getSupabase } from "./supabase";
import { must } from "./useData";

// Perkataan di hadapan nama yang jarang dipakai sebagai nama panggilan.
const AWALAN = new Set([
  "MOHD", "MOHD.", "MOHAMAD", "MOHAMMAD", "MOHAMED", "MOHAMMED", "MOHAMAD.", "MUHAMMAD", "MUHAMAD", "MUHAMMED", "MUHD", "MD", "MD.", "MHD",
  "NUR", "NURUL", "NOR", "NORUL", "SITI", "WAN", "NIK", "TENGKU", "TUNKU", "SYED", "SHARIFAH", "SHARIFFAH", "PUTERI", "AWANG", "DAYANG", "AB", "AB.", "ABD", "ABD.",
  "HJ", "HJ.", "HAJI", "HAJAH", "HJH", "DR", "DR.", "IR", "IR.",
]);
const PEMISAH = /\s+(BIN|BINTI|BINTE|BT\.?|B\.|A\/L|A\/P|S\/O|D\/O)\s+/i;

const hurufAwal = (w: string) => w.toLowerCase().replace(/(^|[-'’])\p{L}/gu, (c) => c.toUpperCase());

/**
 * Cadangan nama panggilan daripada nama penuh (ikut kad pengenalan).
 * "MOHD SADDAM IRRBAN BIN SHAMSUDDIN" → "Saddam"; "SITI MAHIRAH BINTI HANUDDIN" → "Mahirah";
 * "TAN WEI MING" → "Wei Ming"; "RAJESH A/L KUMAR" → "Rajesh". HR boleh mengubahnya.
 */
export function cadangNamaPanggilan(penuh: string): string {
  const bersih = penuh.trim().replace(/\s+/g, " ");
  if (!bersih) return "";
  const bahagian = bersih.split(PEMISAH);
  const adaPemisah = bahagian.length > 1;
  const nama = bahagian[0].split(" ").filter(Boolean);
  if (!adaPemisah && nama.length === 3 && !AWALAN.has(nama[0].toUpperCase())) {
    // Nama Cina lazim: nama keluarga dahulu ("TAN WEI MING")
    return nama.slice(1).map(hurufAwal).join(" ");
  }
  const calon = nama.find((w) => !AWALAN.has(w.toUpperCase())) ?? nama[nama.length - 1];
  return hurufAwal(calon);
}

export type NamaPekerja = {
  employment_id: string;
  employee_no: string;
  full_name: string;
  preferred_name: string | null;
  department: string | null;
  activated: boolean;
};

export async function getNamaPekerja(companyId: string): Promise<NamaPekerja[]> {
  return (must(await getSupabase().rpc("hr_preferred_names", { p_company: companyId })) ?? []) as NamaPekerja[];
}

export async function simpanNamaPanggilan(companyId: string, items: { employment_id: string; name: string }[]): Promise<number> {
  return Number(must(await getSupabase().rpc("hr_set_preferred_names", { p_company: companyId, p_items: items as never })));
}
