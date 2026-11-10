"use client";

// Data untuk halaman modul HR (menu baharu): Cuti, Kehadiran, Tuntutan perbelanjaan, Orientasi.
// Setiap RPC menyemak peranan di pangkalan data (lihat migrasi 20261202000000_modul_hr.sql).
import { trRalat, trTajuk } from "@/lib/i18n";
import { getSupabase } from "./supabase";
import { must } from "./useData";
import type { StatusPermohonan } from "./format";

const n = (v: unknown) => Number(v ?? 0);

// ---------------------------------------------------------------- Cuti
export type PermohonanCutiHr = {
  id: string;
  approval_request_id: string | null;
  employment_id: string;
  name: string;
  department: string | null;
  leave_code: string;
  leave_name: string;
  start_date: string;
  end_date: string;
  days: number;
  half_day: string | null;
  status: StatusPermohonan;
  created_at: string;
};
export type BakiPekerja = {
  employment_id: string;
  name: string;
  department: string | null;
  items: Record<string, { entitled: number; used: number; pending: number; available: number }>;
};
export type RingkasanCuti = { today: string; requests: PermohonanCutiHr[]; balances: BakiPekerja[]; types: { code: string; name: string }[] };

export async function getCutiHr(companyId: string): Promise<RingkasanCuti> {
  const r = must(await getSupabase().rpc("hr_leave_overview", { p_company: companyId })) as unknown as RingkasanCuti;
  return {
    today: r.today,
    requests: (r.requests ?? []).map((x) => ({ ...x, days: n(x.days), leave_name: trRalat(x.leave_name) })),
    balances: (r.balances ?? []).map((b) => ({
      ...b,
      items: Object.fromEntries(
        Object.entries(b.items ?? {}).map(([k, v]) => [k, { entitled: n(v.entitled), used: n(v.used), pending: n(v.pending), available: n(v.available) }]),
      ),
    })),
    types: (r.types ?? []).map((t) => ({ ...t, name: trRalat(t.name) })),
  };
}

// ---------------------------------------------------------------- Kehadiran
export type BarisKehadiran = {
  employment_id: string;
  name: string;
  department: string | null;
  work_start: string | null;
  clock_in: string | null;
  clock_out: string | null;
  late_minutes: number;
  leave_code: string | null;
  flexible: boolean | null;
};
export type PembetulanMenunggu = {
  id: string;
  approval_request_id: string | null;
  employment_id: string;
  name: string;
  work_date: string;
  requested_clock_in: string | null;
  requested_clock_out: string | null;
  reason: string;
  created_at: string;
};
export type KehadiranHari = { date: string; working_day: boolean; rows: BarisKehadiran[]; corrections: PembetulanMenunggu[] };

export async function getKehadiranHari(companyId: string, tarikh?: string): Promise<KehadiranHari> {
  const r = must(await getSupabase().rpc("hr_attendance_day", { p_company: companyId, ...(tarikh ? { p_date: tarikh } : {}) })) as unknown as KehadiranHari;
  return { ...r, rows: (r.rows ?? []).map((x) => ({ ...x, late_minutes: n(x.late_minutes) })), corrections: r.corrections ?? [] };
}

/** Status kehadiran seorang pekerja pada hari itu. */
export type StatusHadir = "hadir" | "lewat" | "cuti" | "tiada_rekod" | "rehat";
export function statusHadir(r: BarisKehadiran, hariBekerja: boolean): StatusHadir {
  if (r.leave_code) return "cuti";
  if (r.clock_in) return r.late_minutes > 0 ? "lewat" : "hadir";
  return hariBekerja ? "tiada_rekod" : "rehat";
}

// ---------------------------------------------------------------- Tuntutan
export type TuntutanHr = {
  id: string;
  approval_request_id: string | null;
  employment_id: string;
  name: string;
  department: string | null;
  title: string;
  total_amount: number;
  status: StatusPermohonan;
  created_at: string;
  paid_at: string | null;
  via_payroll: boolean;
  types: string | null;
  expense_date: string | null;
};

export async function getTuntutanHr(companyId: string, dari: string, hingga: string): Promise<TuntutanHr[]> {
  const r = (must(await getSupabase().rpc("hr_claims", { p_company: companyId, p_from: dari, p_to: hingga })) ?? []) as unknown as TuntutanHr[];
  return r.map((x) => ({ ...x, total_amount: n(x.total_amount), types: x.types ? x.types.split(", ").map(trRalat).join(", ") : null }));
}

// ---------------------------------------------------------------- Orientasi
export type PekerjaBaharu = {
  employment_id: string;
  name: string;
  department: string | null;
  position: string | null;
  join_date: string;
  status: "probation" | "active";
  probation_end_date: string | null;
  activated: boolean;
  invite_sent_at: string | null;
  invite_expires_at: string | null;
  invite_accepted_at: string | null;
  steps_done: number;
  checklist_total: number;
  checklist_done: number;
  review: { submitted_at: string | null; recommendation: string | null; hr_decision: string | null } | null;
};

export async function getOrientasiHr(companyId: string): Promise<PekerjaBaharu[]> {
  const r = (must(await getSupabase().rpc("hr_onboarding", { p_company: companyId })) ?? []) as unknown as PekerjaBaharu[];
  return r.map((x) => ({ ...x, steps_done: n(x.steps_done), checklist_total: n(x.checklist_total), checklist_done: n(x.checklist_done) }));
}

// ---------------------------------------------------------------- CSV
/** Muat turun jadual sebagai CSV (UTF-8 dengan BOM supaya Excel membaca betul). */
export function muatTurunCSV(namaFail: string, baris: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const url = URL.createObjectURL(new Blob(["﻿" + baris.map((b) => b.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = namaFail;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------------------------------------------------------------- Tugasan HR & permohonan tersangkut
export type TugasanHr = {
  not_activated: number | null;
  probation_ending: number | null;
  claims_unpaid: { n: number; amount: number };
  questions_open: number | null;
  letters_pending: number | null;
  flexible_pending: number | null;
  stuck: number | null;
  pending_all: number | null;
  no_nickname: number | null;
};
export async function getTugasanHr(companyId: string): Promise<TugasanHr> {
  const r = must(await getSupabase().rpc("hr_todo", { p_company: companyId })) as unknown as TugasanHr;
  return { ...r, claims_unpaid: { n: n(r.claims_unpaid?.n), amount: n(r.claims_unpaid?.amount) } };
}

export type PermohonanTersangkut = {
  id: string;
  request_type: string;
  title: string;
  submitted_at: string;
  sla_due_at: string | null;
  overdue: boolean;
  requester: string;
  step_name: string | null;
  approvers: string | null;
  last_reminded_at: string | null;
};
export async function getPermohonanSyarikat(companyId: string): Promise<PermohonanTersangkut[]> {
  return ((must(await getSupabase().rpc("hr_pending_requests", { p_company: companyId })) ?? []) as unknown as PermohonanTersangkut[]).map((x) => ({
    ...x,
    title: trTajuk(x.title),
    step_name: x.step_name ? x.step_name.split(", ").map(trRalat).join(", ") : null,
  }));
}
/** Peringatan WhatsApp kepada pelulus semasa; memulangkan bilangan pelulus yang diingatkan. */
export async function ingatkanPelulus(requestId: string): Promise<number> {
  return Number(must(await getSupabase().rpc("approval_remind", { p_request: requestId })));
}
