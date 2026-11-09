"use client";

import { getSupabase } from "./supabase";
import { must } from "./useData";

// ---------------------------------------------------------------- Kalendar berkanun

export type KewajipanBerkanun = {
  kind: "epf" | "socso" | "pcb" | "hrdf" | "ea" | "borang_e";
  label: string;
  period_year: number;
  period_month: number; // 0 = tahunan
  due_date: string;
  days_left: number;
  payroll_ready: boolean;
};

export async function getKalendarBerkanun(companyId: string): Promise<KewajipanBerkanun[]> {
  return (must(await getSupabase().rpc("statutory_calendar", { p_company: companyId })) ?? []) as unknown as KewajipanBerkanun[];
}

export async function tandaDihantar(companyId: string, k: KewajipanBerkanun, rujukan?: string) {
  must(
    await getSupabase().rpc("mark_statutory_submitted", {
      p_company: companyId,
      p_kind: k.kind,
      p_year: k.period_year,
      p_month: k.period_month,
      p_reference: rujukan ?? undefined,
    }),
  );
}

// ---------------------------------------------------------------- Tarikh tamat

export type TarikhTamat = { kind: "contract" | "permit" | "passport" | "document"; employment_id: string; name: string; expiry: string; days_left: number; text: string };

export async function getTarikhTamat(companyId: string, hari = 60): Promise<TarikhTamat[]> {
  return (must(await getSupabase().rpc("hr_expiring", { p_company: companyId, p_days: hari })) ?? []) as TarikhTamat[];
}

export async function setTarikhTamat(employmentId: string, kontrak: string | null, pasport: string | null, permit: string | null) {
  must(
    await getSupabase().rpc("hr_set_expiry", {
      p_employment: employmentId,
      p_contract_end: kontrak as string,
      p_passport_expiry: pasport as string,
      p_permit_expiry: permit as string,
    }),
  );
}

// ---------------------------------------------------------------- Bendera semakan gaji

export type BenderaGaji = { employment_id: string; name: string; level: "ralat" | "amaran" | "maklumat"; message: string };

export async function getBenderaGaji(runId: string): Promise<BenderaGaji[]> {
  return (must(await getSupabase().rpc("payroll_flags", { p_run: runId })) ?? []) as BenderaGaji[];
}

// ---------------------------------------------------------------- Laporan

export type JenisLaporan = "pekerja" | "baki_cuti" | "cuti_diambil" | "kehadiran" | "tuntutan" | "kos_gaji";

export async function getLaporan(companyId: string, jenis: JenisLaporan, dari: string, hingga: string): Promise<Record<string, unknown>[]> {
  return (must(await getSupabase().rpc("hr_report", { p_company: companyId, p_kind: jenis, p_from: dari, p_to: hingga })) ?? []) as Record<string, unknown>[];
}

// ---------------------------------------------------------------- Senarai semak pekerja baharu

export type PerkaraSemak = { id: string; owner: "hr" | "ketua"; title: string; due_date: string | null; done_at: string | null; done_by_name: string | null; can_act: boolean };
export type TugasSemak = { id: string; employment_id: string; employee_name: string; owner: "hr" | "ketua"; title: string; due_date: string | null };

export async function getSenaraiSemak(employmentId: string): Promise<PerkaraSemak[]> {
  return (must(await getSupabase().rpc("onboarding_checklist", { p_employment: employmentId })) ?? []) as PerkaraSemak[];
}
export async function getTugasSemakSaya(companyId: string): Promise<TugasSemak[]> {
  return (must(await getSupabase().rpc("my_onboarding_tasks", { p_company: companyId })) ?? []) as TugasSemak[];
}
export async function tandaSemak(id: string, siap: boolean) {
  must(await getSupabase().rpc("onboarding_toggle", { p_item: id, p_done: siap }));
}
export async function tambahSemak(employmentId: string, owner: "hr" | "ketua", tajuk: string, tarikh: string | null) {
  must(await getSupabase().rpc("onboarding_add_item", { p_employment: employmentId, p_owner: owner, p_title: tajuk, p_due: tarikh as string }));
}
export async function padamSemak(id: string) {
  must(await getSupabase().rpc("onboarding_delete_item", { p_item: id }));
}

// ---------------------------------------------------------------- Import pukal

export type HasilImport = { employee_no: string; leave_code?: string; ok: boolean; message: string };

export async function importGajiPokok(companyId: string, baris: { employee_no: string; basic: number | string; effective_from?: string }[]): Promise<HasilImport[]> {
  return (must(await getSupabase().rpc("hr_import_basic_pay", { p_company: companyId, p_rows: baris as never })) ?? []) as HasilImport[];
}
export async function importBakiCuti(
  companyId: string,
  tahun: number,
  baris: { employee_no: string; leave_code: string; carried_forward?: number | string; taken?: number | string }[],
): Promise<HasilImport[]> {
  return (must(await getSupabase().rpc("hr_import_leave_opening", { p_company: companyId, p_year: tahun, p_rows: baris as never })) ?? []) as HasilImport[];
}
