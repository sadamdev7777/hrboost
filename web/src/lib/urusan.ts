"use client";

import { getSupabase } from "./supabase";
import { must } from "./useData";

// ---------------------------------------------------------------- Kalendar pasukan

export type CutiKalendar = {
  employment_id: string;
  name: string;
  department: string | null;
  department_id: string | null;
  start: string;
  end: string;
  half_day: string;
  status: "approved" | "pending";
  type: string | null;
  type_name: string;
};
export type Kalendar = {
  leave: CutiKalendar[];
  holidays: { date: string; name: string }[];
  birthdays: { person_id: string; name: string; day: number; month: number; department: string | null }[];
  headcount: Record<string, number>;
  departments: { id: string; name: string }[];
  full: boolean;
};

export async function getKalendar(companyId: string, dari: string, hingga: string, jabatan?: string | null): Promise<Kalendar> {
  return must(
    await getSupabase().rpc("team_calendar", { p_company: companyId, p_from: dari, p_to: hingga, p_department: (jabatan || null) as string }),
  ) as unknown as Kalendar;
}

// ---------------------------------------------------------------- Kerja lebih masa

export type JenisHari = "normal" | "rest" | "holiday";
export const LABEL_HARI: Record<JenisHari, { label: string; kadar: string }> = {
  normal: { label: "Hari bekerja biasa", kadar: "1.5 kali kadar sejam" },
  rest: { label: "Hari rehat", kadar: "2 kali kadar sejam" },
  holiday: { label: "Cuti umum", kadar: "3 kali kadar sejam" },
};

export async function mohonLebihMasa(employmentId: string, tarikh: string, jam: number, jenis: JenisHari, sebab: string) {
  return must(
    await getSupabase().rpc("submit_overtime", { p_employment: employmentId, p_date: tarikh, p_hours: jam, p_day_type: jenis, p_reason: sebab, p_via: "web" }),
  );
}

export async function getLebihMasaSaya(employmentId: string) {
  return must(await getSupabase().rpc("my_overtime", { p_employment: employmentId })) ?? [];
}

// ---------------------------------------------------------------- Surat

export type JenisSurat = "employment" | "salary";
export const LABEL_SURAT: Record<JenisSurat, string> = { employment: "Surat pengesahan majikan", salary: "Surat pengesahan gaji" };

export type PermohonanSurat = {
  id: string;
  employment_id: string;
  name: string;
  employee_no: string;
  kind: JenisSurat;
  purpose: string;
  addressed_to: string | null;
  status: "pending" | "issued" | "rejected" | "cancelled";
  ref_no: string | null;
  issued_at: string | null;
  reject_reason: string | null;
  created_at: string;
};

export const STATUS_SURAT: Record<PermohonanSurat["status"], { label: string; tone: "warning" | "success" | "danger" | "neutral" }> = {
  pending: { label: "Menunggu HR", tone: "warning" },
  issued: { label: "Dikeluarkan", tone: "success" },
  rejected: { label: "Ditolak", tone: "danger" },
  cancelled: { label: "Dibatalkan", tone: "neutral" },
};

export async function getSurat(companyId: string, milikSaya = false): Promise<PermohonanSurat[]> {
  return (must(await getSupabase().rpc("letter_list", { p_company: companyId, p_mine: milikSaya })) ?? []) as PermohonanSurat[];
}
export async function mohonSurat(employmentId: string, jenis: JenisSurat, tujuan: string, kepada: string) {
  return must(await getSupabase().rpc("request_letter", { p_employment: employmentId, p_kind: jenis, p_purpose: tujuan, p_addressed_to: kepada, p_via: "web" }));
}
export async function batalSurat(id: string) {
  must(await getSupabase().rpc("cancel_letter", { p_id: id }));
}
export async function keluarkanSurat(id: string): Promise<string> {
  return must(await getSupabase().rpc("issue_letter", { p_id: id })) as string;
}
export async function tolakSurat(id: string, sebab: string) {
  must(await getSupabase().rpc("reject_letter", { p_id: id, p_reason: sebab }));
}

export type DataSurat = {
  kind: JenisSurat;
  purpose: string;
  addressed_to: string | null;
  ref_no: string;
  issued_at: string;
  company: { name: string; reg_no: string | null; address: string | null };
  full_name: string;
  ic_no: string | null;
  employee_no: string;
  position: string | null;
  department: string | null;
  join_date: string;
  employment_type: string;
  status: string;
  basic: number | null;
  allowances: number | null;
  signatory: { name: string; position: string } | null;
};
export async function getDataSurat(id: string): Promise<DataSurat> {
  return must(await getSupabase().rpc("letter_view", { p_id: id })) as unknown as DataSurat;
}

// ---------------------------------------------------------------- Pengumuman

export type Pengumuman = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  author: string | null;
  sent_whatsapp: boolean;
  archived: boolean;
  is_read: boolean;
  read_count: number | null;
  audience: number | null;
};

export async function getPengumuman(companyId: string, termasukArkib = false): Promise<Pengumuman[]> {
  return (must(await getSupabase().rpc("company_announcements", { p_company: companyId, p_include_archived: termasukArkib })) ?? []) as Pengumuman[];
}
export async function siarPengumuman(companyId: string, tajuk: string, isi: string, whatsapp: boolean) {
  return must(await getSupabase().rpc("post_announcement", { p_company: companyId, p_title: tajuk, p_body: isi, p_whatsapp: whatsapp }));
}
export async function tandaDibaca(id: string) {
  must(await getSupabase().rpc("mark_announcement_read", { p_id: id }));
}
export async function arkibPengumuman(id: string) {
  must(await getSupabase().rpc("archive_announcement", { p_id: id }));
}
export async function getBelumBaca(id: string) {
  return (must(await getSupabase().rpc("announcement_unread", { p_id: id })) ?? []) as { employment_id: string; name: string; department: string | null }[];
}
