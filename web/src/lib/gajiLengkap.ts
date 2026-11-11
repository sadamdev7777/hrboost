"use client";

import { tr, trRalat } from "@/lib/i18n";
import { getSupabase } from "./supabase";
import { must } from "./useData";

// ---------------------------------------------------------------------
//  Tetapan Gaji syarikat
// ---------------------------------------------------------------------
export type Asas = "calendar" | "working" | "fixed26" | "fixed";
export type PilihanSlip = { leave_summary: boolean; ytd: boolean; disclaimer: string | null; auto_release: boolean };
export type TetapanGaji = {
  reg_no: string | null;
  lhdn_employer_no: string | null;
  lhdn_c_no: string | null;
  epf_employer_no: string | null;
  socso_employer_no: string | null;
  zakat_no: string | null;
  hrdf_registered: boolean;
  signatory_name: string | null;
  signatory_ic: string | null;
  signatory_position: string | null;
  signatory_email: string | null;
  signatory_phone: string | null;
  company_bank_name: string | null;
  company_bank_account: string | null;
  bank_corporate_id: string | null;
  bank_batch_id: string | null;
  payday: number;
  hours_per_day: number;
  /** Bilangan hari bagi asas "fixed" (cth. 31) */
  fixed_days: number;
  prorate_basis: Asas;
  unpaid_basis: Asas;
  ot_basis: Asas;
  unpaid_items: string[];
  ot_items: string[];
  skbbk_default: boolean;
  payslip_options: PilihanSlip;
  gl_accounts: Record<string, string>;
};

const LAJUR_TETAPAN =
  "reg_no, lhdn_employer_no, lhdn_c_no, epf_employer_no, socso_employer_no, zakat_no, hrdf_registered, signatory_name, signatory_ic, signatory_position, signatory_email, signatory_phone, company_bank_name, company_bank_account, bank_corporate_id, bank_batch_id, payday, hours_per_day, fixed_days, prorate_basis, unpaid_basis, ot_basis, unpaid_items, ot_items, skbbk_default, payslip_options, gl_accounts";

export async function getTetapanGaji(companyId: string): Promise<TetapanGaji> {
  const r = must(await getSupabase().from("companies").select(LAJUR_TETAPAN).eq("id", companyId).single()) as unknown as TetapanGaji;
  return {
    ...r,
    hours_per_day: Number(r.hours_per_day),
    payslip_options: { leave_summary: true, ytd: true, disclaimer: null, auto_release: true, ...((r.payslip_options ?? {}) as Partial<PilihanSlip>) },
    gl_accounts: (r.gl_accounts ?? {}) as Record<string, string>,
  };
}

export async function simpanTetapanGaji(companyId: string, data: Partial<TetapanGaji>) {
  must(await getSupabase().rpc("hr_set_payroll_settings", { p_company: companyId, p_data: data as never }));
}

export const LABEL_ASAS: Record<Asas, string> = {
  calendar: tr("Hari kalendar"),
  working: tr("Hari bekerja"),
  fixed26: tr("Tetap 26 hari"),
  fixed: tr("Tetap (pilih bilangan hari)"),
};

/** Contoh kiraan untuk setiap asas (Februari 2027: 28 hari kalendar, 20 hari bekerja). */
export function contohAsas(asas: Asas, gaji = 3000, hariTetap = 26): string {
  const pembahagi = asas === "calendar" ? 28 : asas === "working" ? 20 : asas === "fixed" ? hariTetap : 26;
  return tr("RM {0} ÷ {1} = RM {2} sehari", gaji.toLocaleString("en-MY"), pembahagi, (gaji / pembahagi).toFixed(2));
}

export const AKAUN_GL: { key: string; label: string; lalai: string }[] = [
  { key: "salary_expense", label: tr("Belanja gaji & upah"), lalai: tr("Gaji & Upah") },
  { key: "employer_expense", label: tr("Belanja caruman majikan"), lalai: tr("Caruman majikan") },
  { key: "epf_payable", label: tr("KWSP perlu dibayar"), lalai: tr("KWSP perlu dibayar") },
  { key: "socso_payable", label: tr("PERKESO & SIP perlu dibayar"), lalai: tr("PERKESO & SIP perlu dibayar") },
  { key: "pcb_payable", label: tr("PCB perlu dibayar"), lalai: tr("PCB perlu dibayar") },
  { key: "zakat_payable", label: tr("Zakat perlu dibayar"), lalai: tr("Zakat perlu dibayar") },
  { key: "hrdf_payable", label: tr("Levi HRD Corp perlu dibayar"), lalai: tr("Levi HRD Corp perlu dibayar") },
  { key: "net_payable", label: tr("Gaji bersih perlu dibayar"), lalai: tr("Gaji bersih perlu dibayar") },
];

// ---------------------------------------------------------------------
//  Katalog item gaji
// ---------------------------------------------------------------------
export type MedanEa = "B1a" | "B1b" | "B1c" | "B2" | "B3" | "B4" | "B6";
export type ItemGaji = {
  id: string;
  code: string;
  name: string;
  /** Nama seperti disimpan (tanpa terjemahan) — untuk borang ubah */
  nameAsal: string;
  kind: "earning" | "deduction" | "benefit";
  category: string | null;
  taxable: boolean;
  epf: boolean;
  socso: boolean;
  eis: boolean;
  hrdf: boolean;
  ea_field: MedanEa | null;
  active: boolean;
  is_system: boolean;
  account_ref: string | null;
  in_table: boolean;
};

export const MEDAN_EA: Record<MedanEa, string> = {
  B1a: tr("B1(a) Gaji kasar, upah, cuti"),
  B1b: tr("B1(b) Fi, komisen, bonus"),
  B1c: tr("B1(c) Elaun, perkuisit"),
  B2: tr("B2 Tunggakan tahun terdahulu"),
  B3: tr("B3 Manfaat berupa barangan (BIK)"),
  B4: tr("B4 Tempat kediaman"),
  B6: tr("B6 Pampasan kehilangan pekerjaan"),
};

export const LABEL_JENIS_ITEM: Record<ItemGaji["kind"], string> = {
  earning: tr("Pendapatan"),
  deduction: tr("Potongan"),
  benefit: tr("Manfaat (BIK)"),
};

/** Kod yang dikira oleh sistem (tidak boleh dimasukkan sebagai item sekali). */
export const KOD_SISTEM_KIRA = ["BASIC", "CLAIM", "UNPAID", "OT_LULUS"];

export async function getKatalog(companyId: string): Promise<ItemGaji[]> {
  const r =
    must(
      await getSupabase()
        .from("pay_components")
        .select("id, code, name, kind, category, taxable, epf_applicable, socso_applicable, eis_applicable, hrdf_applicable, ea_field, active, is_system, account_ref, in_table, sort_order")
        .eq("company_id", companyId)
        .order("sort_order")
        .order("name"),
    ) ?? [];
  return r.map((c) => ({
    id: c.id,
    code: c.code,
    name: trRalat(c.name),
    nameAsal: c.name,
    kind: c.kind as ItemGaji["kind"],
    category: c.category,
    taxable: c.taxable,
    epf: c.epf_applicable,
    socso: c.socso_applicable,
    eis: c.eis_applicable ?? c.socso_applicable,
    hrdf: c.hrdf_applicable ?? c.epf_applicable,
    ea_field: (c.ea_field as MedanEa | null) ?? null,
    active: c.active,
    is_system: c.is_system,
    account_ref: c.account_ref,
    in_table: c.in_table,
  }));
}

export async function simpanItem(companyId: string, code: string | null, data: Record<string, unknown>): Promise<string> {
  return must(await getSupabase().rpc("hr_save_pay_component", { p_company: companyId, p_code: code as string, p_data: data as never })) as string;
}

// ---------------------------------------------------------------------
//  Maklumat berkanun & cukai pekerja
// ---------------------------------------------------------------------
export type Berkanun = {
  resident: boolean;
  disabled: boolean;
  spouse_disabled: boolean;
  child_u18: number;
  child_higher: number;
  child_disabled: number;
  child_disabled_higher: number;
  child_shared: boolean;
  epf_category: "auto" | "citizen" | "foreign" | "none";
  epf_employee_rate: number | null;
  socso_category: "auto" | "cat1" | "cat2" | "foreign" | "none";
  eis: "auto" | "yes" | "no";
  skbbk: "auto" | "yes" | "no";
  ssfw_no: string | null;
  zakat_monthly: number;
  cp38_monthly: number;
  cp38_until: string | null;
};

export const BERKANUN_LALAI: Berkanun = {
  resident: true,
  disabled: false,
  spouse_disabled: false,
  child_u18: 0,
  child_higher: 0,
  child_disabled: 0,
  child_disabled_higher: 0,
  child_shared: false,
  epf_category: "auto",
  epf_employee_rate: null,
  socso_category: "auto",
  eis: "auto",
  skbbk: "auto",
  ssfw_no: null,
  zakat_monthly: 0,
  cp38_monthly: 0,
  cp38_until: null,
};

export async function getBerkanun(employmentId: string): Promise<Berkanun> {
  const r = must(await getSupabase().from("employment_statutory").select("*").eq("employment_id", employmentId).maybeSingle());
  if (!r) return { ...BERKANUN_LALAI };
  return {
    ...BERKANUN_LALAI,
    ...(r as unknown as Berkanun),
    epf_employee_rate: r.epf_employee_rate === null ? null : Number(r.epf_employee_rate),
    zakat_monthly: Number(r.zakat_monthly),
    cp38_monthly: Number(r.cp38_monthly),
  };
}

export async function simpanBerkanun(employmentId: string, b: Berkanun) {
  must(
    await getSupabase()
      .from("employment_statutory")
      .upsert({ employment_id: employmentId, ...b, ssfw_no: b.ssfw_no || null, cp38_until: b.cp38_until || null, updated_at: new Date().toISOString() }),
  );
}

export type Tp1 = { id: string; year: number; month: number; category: string; amount: number; note: string | null };
export async function getTp1(employmentId: string, year: number): Promise<Tp1[]> {
  return (
    must(await getSupabase().from("tp1_reliefs").select("id, year, month, category, amount, note").eq("employment_id", employmentId).eq("year", year).order("month")) ?? []
  ).map((x) => ({ ...x, amount: Number(x.amount) }));
}
export async function tambahTp1(employmentId: string, t: Omit<Tp1, "id">) {
  must(await getSupabase().from("tp1_reliefs").insert({ employment_id: employmentId, ...t }));
}
export async function buangTp1(id: string) {
  must(await getSupabase().from("tp1_reliefs").delete().eq("id", id));
}
export const KATEGORI_TP1 = [
  tr("Insurans hayat & KWSP sukarela"),
  tr("Insurans pendidikan & perubatan"),
  tr("Perbelanjaan perubatan ibu bapa"),
  tr("Yuran pendidikan sendiri"),
  tr("Gaya hidup (buku, peranti, internet)"),
  tr("Simpanan SSPN"),
  tr("PRS / anuiti tertangguh"),
  tr("Lain-lain pelepasan"),
];

// ---------------------------------------------------------------------
//  Kitaran gaji, buka semula, lepas slip
// ---------------------------------------------------------------------
export type Kitaran = { id: string; cycle_no: number; kind: "regular" | "additional"; label: string | null; status: string; payslip_release_at: string | null; pcb_receipt_no: string | null };

export async function getKitaran(companyId: string, y: number, m: number): Promise<Kitaran[]> {
  return (must(
    await getSupabase()
      .from("payroll_runs")
      .select("id, cycle_no, kind, label, status, payslip_release_at, pcb_receipt_no")
      .eq("company_id", companyId)
      .eq("period_year", y)
      .eq("period_month", m)
      .order("cycle_no"),
  ) ?? []) as Kitaran[];
}

export async function tambahKitaran(companyId: string, y: number, m: number, label: string): Promise<string> {
  return must(await getSupabase().rpc("payroll_add_cycle", { p_company: companyId, p_year: y, p_month: m, p_label: label })) as string;
}
export async function bukaSemula(runId: string, sebab: string) {
  must(await getSupabase().rpc("payroll_reopen", { p_run: runId, p_reason: sebab }));
}
export async function lepasSlip(runId: string, pada: string | null) {
  must(await getSupabase().rpc("payroll_release_payslips", { p_run: runId, ...(pada ? { p_at: pada } : {}) }));
}
export async function tarikBalikSlip(runId: string) {
  must(await getSupabase().rpc("payroll_unrelease_payslips", { p_run: runId }));
}
export async function setResitPcb(runId: string, resit: string) {
  must(await getSupabase().rpc("payroll_set_receipt", { p_run: runId, p_receipt: resit }));
}

export type Varians = {
  employment_id: string;
  employee_no: string;
  name: string;
  prev_gross: number | null;
  gross: number | null;
  prev_net: number | null;
  net: number | null;
  prev_epf: number | null;
  epf: number | null;
  prev_pcb: number | null;
  pcb: number | null;
  status: "baharu" | "berhenti" | "berubah" | "sama";
  note: string | null;
};
export async function getVarians(runId: string): Promise<Varians[]> {
  return ((must(await getSupabase().rpc("payroll_variance", { p_run: runId })) ?? []) as unknown as Varians[]).map((v) => ({
    ...v,
    prev_gross: v.prev_gross === null ? null : Number(v.prev_gross),
    gross: v.gross === null ? null : Number(v.gross),
    prev_net: v.prev_net === null ? null : Number(v.prev_net),
    net: v.net === null ? null : Number(v.net),
  }));
}

export async function getKesediaan(companyId: string): Promise<{ employment_id: string; missing: string[] }[]> {
  return ((must(await getSupabase().rpc("payroll_readiness", { p_company: companyId })) ?? []) as { employment_id: string; missing: string[] }[]).filter(
    (x) => x.missing.length > 0,
  );
}

export type BarisPcb = { month: number; cycle_no: number; pcb: number; cp38: number; zakat: number; receipt_no: string | null; pay_date: string | null };
export async function getKenyataanPcb(employmentId: string, year: number): Promise<BarisPcb[]> {
  return ((must(await getSupabase().rpc("pcb_statement", { p_employment: employmentId, p_year: year })) ?? []) as BarisPcb[]).map((x) => ({
    ...x,
    pcb: Number(x.pcb),
    cp38: Number(x.cp38),
    zakat: Number(x.zakat),
  }));
}

// ---------------------------------------------------------------------
//  Fail berkanun
// ---------------------------------------------------------------------
export type JenisFail = "bank" | "epf" | "socso" | "socso_txt" | "pcb" | "pcb_txt" | "gl";

export function muatTurunTeks(kandungan: string, namaFail: string, csv: boolean) {
  const blob = new Blob([csv ? "﻿" + kandungan : kandungan], { type: csv ? "text/csv;charset=utf-8" : "text/plain;charset=us-ascii" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = namaFail;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function eksport(runId: string, jenis: JenisFail, namaFail: string) {
  const isi = must(await getSupabase().rpc("payroll_export", { p_run: runId, p_kind: jenis })) as string;
  muatTurunTeks(isi, namaFail, !jenis.endsWith("_txt"));
}

/** Senarai fail yang boleh dimuat turun untuk satu larian gaji. */
export function senaraiFail(kitaranTambahan: boolean): { jenis: JenisFail; t: string; s: string; fail: (ym: string) => string }[] {
  const semua: { jenis: JenisFail; t: string; s: string; fail: (ym: string) => string }[] = [
    { jenis: "epf", t: tr("Caruman KWSP (CSV)"), s: tr("Untuk i-Akaun Majikan → Muat naik fail"), fail: (ym) => `kwsp-${ym}.csv` },
    { jenis: "socso_txt", t: tr("PERKESO + SIP + SKBBK (fail teks gabungan)"), s: tr("Format gabungan PERKESO mulai Oktober 2026"), fail: (ym) => `perkeso-gabungan-${ym}.txt` },
    { jenis: "socso", t: tr("PERKESO & SIP (CSV)"), s: tr("Ringkasan untuk semakan / ASSIST"), fail: (ym) => `perkeso-sip-${ym}.csv` },
    { jenis: "pcb_txt", t: tr("PCB CP39 (fail teks e-Data PCB)"), s: tr("Untuk e-PCB Plus / e-Data PCB LHDN"), fail: (ym) => `cp39-${ym}.txt` },
    { jenis: "pcb", t: tr("PCB, CP38 & zakat (CSV)"), s: tr("Ringkasan untuk semakan"), fail: (ym) => `pcb-${ym}.csv` },
    { jenis: "gl", t: tr("Jurnal gaji (CSV)"), s: tr("Debit & kredit ikut peta akaun dalam Tetapan Gaji"), fail: (ym) => `jurnal-gaji-${ym}.csv` },
  ];
  return kitaranTambahan ? semua.filter((f) => f.jenis !== "socso_txt" && f.jenis !== "socso") : semua;
}
