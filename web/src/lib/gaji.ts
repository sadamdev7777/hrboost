"use client";

import { getSupabase } from "./supabase";
import { must } from "./useData";

export const BULAN_PENUH = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];
export const BULAN_RINGKAS = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];
export const namaBulan = (y: number, m: number) => `${BULAN_RINGKAS[m - 1]} ${y}`;

export type Jumlah = {
  headcount: number;
  gross: number;
  net: number;
  employer: number;
  pcb: number;
  epf: number;
  socso: number;
  eis: number;
  claims: number;
  previous_run: string | null;
};

export type Persediaan = {
  run_id: string;
  status: string;
  summary: { employees: number; claims: number; claims_amount: number; unpaid_leave_people: number; adjustment_people: number };
  checks: string[];
  statutory_ready: boolean;
};

export async function sediakanGaji(companyId: string, y: number, m: number): Promise<Persediaan> {
  return must(await getSupabase().rpc("payroll_prepare", { p_company: companyId, p_year: y, p_month: m })) as unknown as Persediaan;
}

export async function getLarian(runId: string) {
  return must(
    await getSupabase()
      .from("payroll_runs")
      .select("id, company_id, period_year, period_month, status, totals, pay_date, approval_request_id")
      .eq("id", runId)
      .single(),
  );
}

export async function kiraGaji(runId: string): Promise<Jumlah> {
  return must(await getSupabase().rpc("payroll_calculate", { p_run: runId })) as unknown as Jumlah;
}

export async function getPerbezaan(runId: string) {
  return must(await getSupabase().rpc("payroll_differences", { p_run: runId })) ?? [];
}

export async function hantarKelulusan(runId: string) {
  must(await getSupabase().rpc("submit_payroll_run", { p_run: runId }));
}

export async function tandaDibayar(runId: string, tarikh: string) {
  return must(await getSupabase().rpc("payroll_mark_paid", { p_run: runId, p_pay_date: tarikh }));
}

export async function setPelarasan(runId: string, employmentId: string, code: string, amount: number, note?: string) {
  must(await getSupabase().rpc("payroll_set_adjustment", { p_run: runId, p_employment: employmentId, p_code: code, p_amount: amount, p_note: note ?? "" }));
}

export async function getPelarasan(runId: string) {
  return must(await getSupabase().from("payroll_adjustments").select("id, employment_id, component_code, amount, note").eq("payroll_run_id", runId)) ?? [];
}

/** Muat turun fail CSV (bank, KWSP, PERKESO/SIP, PCB). */
export async function muatTurun(runId: string, jenis: "bank" | "epf" | "socso" | "pcb", namaFail: string) {
  const csv = must(await getSupabase().rpc("payroll_export", { p_run: runId, p_kind: jenis })) as string;
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = namaFail;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------------------------------------------------------------- Slip gaji

export type Slip = {
  id: string;
  year: number;
  month: number;
  payDate: string | null;
  status: string;
  gross: number;
  net: number;
  totalDeduction: number;
  unpaidDays: number;
  lines: { code: string; description: string; kind: "earning" | "deduction" | "employer"; amount: number }[];
  company: { name: string; code: string; reg_no: string | null; epf: string | null; socso: string | null; lhdn: string | null };
  employee: {
    fullName: string;
    employeeNo: string;
    ic: string | null;
    department: string | null;
    position: string | null;
    epfNo: string | null;
    taxNo: string | null;
    socsoNo: string | null;
    bank: string | null;
    account: string | null;
  };
  ytd: { gross: number; epf: number; pcb: number; months: number };
  alBalance: number | null;
};

export async function getSenaraiSlip(employmentId: string) {
  return (must(await getSupabase().rpc("my_payslips", { p_employment: employmentId })) ?? []).map((s) => ({
    id: s.id,
    net: Number(s.net),
    year: s.period_year,
    month: s.period_month,
    payDate: s.pay_date,
  }));
}

export async function getSlip(id: string): Promise<Slip> {
  const sb = getSupabase();
  const s = must(
    await sb
      .from("payslips")
      .select(
        "id, employment_id, gross, net, total_deduction, unpaid_leave_days, payslip_lines(component_code, description, kind, amount)",
      )
      .eq("id", id)
      .maybeSingle(),
  );
  if (!s) throw new Error("Slip gaji tidak dijumpai.");
  void sb.rpc("payslip_opened", { p_payslip: id });
  const meta = must(await sb.rpc("payslip_meta", { p_payslip: id })) as unknown as {
    period_year: number;
    period_month: number;
    pay_date: string | null;
    status: string;
    company: Slip["company"];
  } | null;
  if (!meta) throw new Error("Slip gaji tidak dijumpai.");
  const r = meta;
  const [emp, ytd, bal] = await Promise.all([
    sb
      .from("employments")
      .select("employee_no, epf_no, tax_no, socso_no, person_id, departments(name), positions(title), persons!employments_person_id_fkey(full_name, ic_no, bank_name, bank_account_no)")
      .eq("id", s.employment_id)
      .single(),
    sb.rpc("payslip_ytd", { p_payslip: id }),
    sb
      .from("leave_balances")
      .select("available, leave_types!inner(code)")
      .eq("employment_id", s.employment_id)
      .eq("year", r.period_year)
      .eq("leave_types.code", "AL")
      .maybeSingle(),
  ]);
  const e = must(emp);
  const y = (must(ytd) ?? {}) as unknown as { gross: number; epf: number; pcb: number; months: number };
  const b = (bal.data ?? null) as { available: number } | null;
  return {
    id: s.id,
    year: r.period_year,
    month: r.period_month,
    payDate: r.pay_date,
    status: r.status,
    gross: Number(s.gross),
    net: Number(s.net),
    totalDeduction: Number(s.total_deduction),
    unpaidDays: Number(s.unpaid_leave_days),
    lines: s.payslip_lines.map((l) => ({ code: l.component_code, description: l.description, kind: l.kind as Slip["lines"][number]["kind"], amount: Number(l.amount) })),
    company: r.company,
    employee: {
      fullName: e.persons?.full_name ?? "",
      employeeNo: e.employee_no,
      ic: e.persons?.ic_no ?? null,
      department: e.departments?.name ?? null,
      position: e.positions?.title ?? null,
      epfNo: e.epf_no,
      taxNo: e.tax_no,
      socsoNo: e.socso_no,
      bank: e.persons?.bank_name ?? null,
      account: e.persons?.bank_account_no ?? null,
    },
    ytd: { gross: Number(y.gross ?? 0), epf: Number(y.epf ?? 0), pcb: Number(y.pcb ?? 0), months: Number(y.months ?? 0) },
    alBalance: b ? Number(b.available) : null,
  };
}

// ---------------------------------------------------------------------
//  Gaji Pekerja: gaji pokok & elaun / potongan tetap
// ---------------------------------------------------------------------
export type KomponenTetap = { code: string; name: string; kind: "earning" | "deduction"; epf: boolean; socso: boolean; taxable: boolean };
export type BarisGaji = {
  employment_id: string;
  name: string;
  employee_no: string;
  department: string | null;
  status: string;
  join_date: string;
  items: Record<string, number>;
  effective_from: string | null;
  upcoming: boolean;
  calc: Kiraan | null;
};
/** Anggaran gaji sebulan (gaji tetap sahaja) dengan caruman berkanun — sama seperti Proses Gaji. */
export type Kiraan = {
  statutory_ready: boolean;
  gross: number;
  fixed_deduction: number;
  epf_employee: number;
  epf_employer: number;
  socso_employee: number;
  socso_employer: number;
  eis_employee: number;
  eis_employer: number;
  pcb: number;
  hrdf: number;
  hrdf_registered: boolean;
  net: number;
  employer_cost: number;
};
export type JadualGaji = { on: string; components: KomponenTetap[]; rows: BarisGaji[]; totals: Partial<Record<keyof Kiraan, number>> | null };

const nombor = (o: Record<string, unknown> | null) =>
  o ? (Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "string" && v !== "" && !isNaN(Number(v)) ? Number(v) : v])) as never) : null;

export async function pratontonGaji(employmentId: string, items: Record<string, number>, pada?: string): Promise<Kiraan | null> {
  return nombor(must(await getSupabase().rpc("hr_pay_preview", { p_employment: employmentId, p_items: items, ...(pada ? { p_on: pada } : {}) })) as Record<string, unknown> | null);
}

export async function getJadualGaji(companyId: string, pada?: string): Promise<JadualGaji> {
  const r = must(await getSupabase().rpc("hr_pay_table", { p_company: companyId, ...(pada ? { p_on: pada } : {}), p_via: "web" })) as unknown as JadualGaji;
  return {
    ...r,
    totals: nombor(r.totals as Record<string, unknown> | null),
    rows: r.rows.map((x) => ({ ...x, calc: nombor(x.calc as Record<string, unknown> | null), items: Object.fromEntries(Object.entries(x.items).map(([k, v]) => [k, Number(v)])) })),
  };
}

export async function setGajiPekerja(employmentId: string, items: Record<string, number>, mulai: string) {
  must(await getSupabase().rpc("hr_set_pay", { p_employment: employmentId, p_items: items, p_effective_from: mulai, p_via: "web" }));
}

export async function tambahKomponen(companyId: string, nama: string, jenis: "earning" | "deduction", epf: boolean, socso: boolean, cukai: boolean): Promise<string> {
  return must(
    await getSupabase().rpc("hr_add_pay_component", { p_company: companyId, p_name: nama, p_kind: jenis, p_epf: epf, p_socso: socso, p_taxable: cukai }),
  ) as string;
}

/** Jumlah bulanan tetap (elaun ditambah, potongan ditolak). */
export function jumlahTetap(items: Record<string, number>, komponen: KomponenTetap[]): number {
  return komponen.reduce((s, c) => s + (c.kind === "deduction" ? -1 : 1) * (items[c.code] ?? 0), 0);
}
