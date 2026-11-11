"use client";

import { tr } from "@/lib/i18n";
import { getSupabase } from "./supabase";
import { must } from "./useData";

// Penilaian prestasi & KPI (migrasi 20261214000600_prestasi_kpi.sql)
export const SKALA_PRESTASI = [tr("Lemah"), tr("Kurang memuaskan"), tr("Memuaskan"), tr("Baik"), tr("Cemerlang")];
export type StatusPenilaian = "self" | "manager" | "hr" | "final";
export const LABEL_STATUS_PENILAIAN: Record<StatusPenilaian, { l: string; tone: "warning" | "neutral" | "success" }> = {
  self: { l: tr("Penilaian kendiri"), tone: "warning" },
  manager: { l: tr("Menunggu pelulus"), tone: "warning" },
  hr: { l: tr("Semakan HR"), tone: "neutral" },
  final: { l: tr("Muktamad"), tone: "success" },
};

export type ItemKpi = {
  id?: string;
  title: string;
  description: string | null;
  target: string | null;
  weight: number;
  self_score?: number | null;
  self_note?: string | null;
  manager_score?: number | null;
  manager_note?: string | null;
};
export type Penilaian = {
  id: string;
  role: "self" | "reviewer" | "hr" | "ceo";
  status: StatusPenilaian;
  cycle: { id: string; name: string; period_start: string; period_end: string; self_due: string | null; manager_due: string | null; status: string };
  employee: { name: string; employee_no: string; position: string | null; department: string | null };
  reviewer: string | null;
  self_comment: string | null;
  manager_comment: string | null;
  manager_rating: number | null;
  final_rating: number | null;
  hr_note: string | null;
  items: ItemKpi[];
};
export type Kitaran = {
  id: string;
  name: string;
  period_start: string;
  period_end: string;
  self_due: string | null;
  manager_due: string | null;
  status: "draft" | "open" | "closed";
  template: ItemKpi[];
  total: number;
  self_done: number;
  manager_done: number;
  final_done: number;
  avg_rating: number | null;
};

export async function getPenilaianSaya(companyId: string) {
  return (must(await getSupabase().rpc("my_appraisals", { p_company: companyId })) ?? []) as {
    id: string;
    role: "self" | "reviewer";
    cycle_name: string;
    period_end: string;
    due: string | null;
    status: StatusPenilaian;
    employee: string | null;
    final_rating: number | null;
  }[];
}
export async function getPenilaian(id: string) {
  return must(await getSupabase().rpc("appraisal_detail", { p_id: id })) as unknown as Penilaian;
}
export async function simpanKpi(id: string, items: ItemKpi[]) {
  must(await getSupabase().rpc("appraisal_set_items", { p_id: id, p_items: items as never }));
}
type Markah = { id: string; score: number | null; note: string | null }[];
export async function simpanKendiri(id: string, markah: Markah, ulasan: string, hantar: boolean) {
  must(await getSupabase().rpc("appraisal_self_save", { p_id: id, p_scores: markah as never, p_comment: ulasan, p_submit: hantar }));
}
export async function simpanPelulus(id: string, markah: Markah, ulasan: string, hantar: boolean) {
  must(await getSupabase().rpc("appraisal_manager_save", { p_id: id, p_scores: markah as never, p_comment: ulasan, p_submit: hantar }));
}
export async function muktamadkan(id: string, markah: number | null, nota: string) {
  must(await getSupabase().rpc("hr_appraisal_finalise", { p_id: id, ...(markah != null ? { p_rating: markah } : {}), p_note: nota }));
}
export async function getKitaran(companyId: string) {
  return (must(await getSupabase().rpc("hr_appraisal_cycles", { p_company: companyId })) ?? []) as unknown as Kitaran[];
}
export async function simpanKitaran(companyId: string, id: string | null, data: Record<string, unknown>) {
  return must(await getSupabase().rpc("hr_appraisal_cycle_save", { p_company: companyId, ...(id ? { p_id: id } : {}), p_data: data as never })) as string;
}
export async function bukaKitaran(id: string) {
  return must(await getSupabase().rpc("hr_appraisal_cycle_open", { p_cycle: id })) as number;
}
export async function tutupKitaran(id: string) {
  must(await getSupabase().rpc("hr_appraisal_cycle_close", { p_cycle: id }));
}
export async function getSenaraiKitaran(id: string) {
  return (must(await getSupabase().rpc("hr_appraisal_list", { p_cycle: id })) ?? []) as {
    id: string;
    employee_no: string;
    name: string;
    department: string | null;
    reviewer: string | null;
    status: StatusPenilaian;
    manager_rating: number | null;
    final_rating: number | null;
  }[];
}
export const markahTeks = (n: number | null | undefined) => (n == null ? "-" : Number(n).toFixed(2));
