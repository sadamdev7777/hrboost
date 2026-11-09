"use client";

import { tr } from "@/lib/i18n";
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

/** Kerja lebih masa ialah pilihan setiap syarikat (lalai: tidak digunakan). */
export async function getOtDigunakan(companyId: string): Promise<boolean> {
  const r = must(await getSupabase().from("companies").select("overtime_enabled").eq("id", companyId).maybeSingle()) as { overtime_enabled?: boolean } | null;
  return !!r?.overtime_enabled;
}
export async function setOtDigunakan(companyId: string, on: boolean) {
  must(await getSupabase().rpc("set_overtime_enabled", { p_company: companyId, p_on: on }));
}

export type JenisHari = "normal" | "rest" | "holiday";
export const LABEL_HARI: Record<JenisHari, { label: string; kadar: string }> = {
  normal: { label: tr("Hari bekerja biasa"), kadar: tr("1.5 kali kadar sejam") },
  rest: { label: tr("Hari rehat"), kadar: tr("2 kali kadar sejam") },
  holiday: { label: tr("Cuti umum"), kadar: tr("3 kali kadar sejam") },
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
export const LABEL_SURAT: Record<JenisSurat, string> = { employment: tr("Surat pengesahan majikan"), salary: tr("Surat pengesahan gaji") };

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
  pending: { label: tr("Menunggu HR"), tone: "warning" },
  issued: { label: tr("Dikeluarkan"), tone: "success" },
  rejected: { label: tr("Ditolak"), tone: "danger" },
  cancelled: { label: tr("Dibatalkan"), tone: "neutral" },
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

// ---------------------------------------------------------------- Soalan HR

export type SoalanHr = {
  id: string;
  employment_id: string;
  name: string;
  question: string;
  ai_answer: string | null;
  status: "open" | "answered" | "ai_resolved";
  answer: string | null;
  answered_by_name: string | null;
  answered_at: string | null;
  created_at: string;
};
export async function tanyaHr(employmentId: string, soalan: string, jawapanAi: string | null, kepadaHr: boolean) {
  return must(await getSupabase().rpc("ask_hr", { p_employment: employmentId, p_question: soalan, p_ai_answer: jawapanAi as string, p_to_hr: kepadaHr }));
}
export async function getSoalan(companyId: string, milikSaya = false): Promise<SoalanHr[]> {
  return (must(await getSupabase().rpc("hr_question_list", { p_company: companyId, p_mine: milikSaya })) ?? []) as SoalanHr[];
}
export async function jawabSoalan(id: string, jawapan: string) {
  must(await getSupabase().rpc("answer_hr_question", { p_id: id, p_answer: jawapan }));
}
export async function getStatistikSoalan(companyId: string) {
  return must(await getSupabase().rpc("hr_question_stats", { p_company: companyId })) as { total: number; ai_resolved: number; open: number; avg_hours: number | null };
}

// ---------------------------------------------------------------- Pendahuluan gaji

export async function getPendahuluanSaya(employmentId: string) {
  return must(await getSupabase().rpc("my_salary_advances", { p_employment: employmentId })) ?? [];
}
export async function mohonPendahuluan(employmentId: string, jumlah: number, sebab: string) {
  return must(await getSupabase().rpc("submit_salary_advance", { p_employment: employmentId, p_amount: jumlah, p_reason: sebab, p_via: "web" }));
}
export async function getPendahuluanHr(companyId: string) {
  return must(await getSupabase().rpc("hr_salary_advances", { p_company: companyId })) ?? [];
}
export async function tandaPendahuluanDibayar(id: string) {
  must(await getSupabase().rpc("finance_mark_advance_paid", { p_id: id }));
}

// ---------------------------------------------------------------- Kerja fleksibel

export type JenisFleksibel = "hours" | "days" | "place";
export const LABEL_FLEKSIBEL: Record<JenisFleksibel, string> = { hours: tr("Waktu bekerja"), days: tr("Hari bekerja"), place: tr("Tempat bekerja") };
export type PermohonanFleksibel = {
  id: string;
  employment_id: string;
  name: string;
  department: string | null;
  change_types: JenisFleksibel[];
  details: string;
  start_date: string;
  end_date: string | null;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  decision_note: string | null;
  decided_at: string | null;
  due_date: string;
  days_left: number;
  created_at: string;
};
export const STATUS_FLEKSIBEL: Record<PermohonanFleksibel["status"], { label: string; tone: "warning" | "success" | "danger" | "neutral" }> = {
  pending: { label: tr("Menunggu keputusan"), tone: "warning" },
  approved: { label: tr("Diluluskan"), tone: "success" },
  rejected: { label: tr("Tidak diluluskan"), tone: "danger" },
  withdrawn: { label: tr("Ditarik balik"), tone: "neutral" },
};
export async function getFleksibel(companyId: string, milikSaya = false): Promise<PermohonanFleksibel[]> {
  return (must(await getSupabase().rpc("flexible_work_list", { p_company: companyId, p_mine: milikSaya })) ?? []) as PermohonanFleksibel[];
}
export async function mohonFleksibel(employmentId: string, jenis: JenisFleksibel[], butiran: string, mula: string, tamat: string | null) {
  return must(
    await getSupabase().rpc("submit_flexible_work", { p_employment: employmentId, p_types: jenis, p_details: butiran, p_start: mula, p_end: tamat as string }),
  );
}
export async function putuskanFleksibel(id: string, lulus: boolean, nota: string) {
  must(await getSupabase().rpc("decide_flexible_work", { p_id: id, p_approve: lulus, p_note: nota }));
}
export async function tarikBalikFleksibel(id: string) {
  must(await getSupabase().rpc("withdraw_flexible_work", { p_id: id }));
}

// ---------------------------------------------------------------- Penilaian percubaan

export const ASPEK_PENILAIAN = [
  { k: "kualiti", label: "Kualiti kerja" },
  { k: "kehadiran", label: "Kehadiran & ketepatan masa" },
  { k: "sikap", label: "Sikap & disiplin" },
  { k: "kerjasama", label: "Kerjasama berpasukan" },
] as const;
export type CadanganPercubaan = "confirm" | "extend" | "terminate";
export const LABEL_CADANGAN: Record<CadanganPercubaan, string> = { confirm: tr("Sahkan jawatan"), extend: tr("Lanjutkan tempoh percubaan"), terminate: tr("Tamatkan perkhidmatan") };

export async function getPenilaianPerlu(companyId: string) {
  return (must(await getSupabase().rpc("my_probation_reviews_due", { p_company: companyId })) ?? []) as {
    employment_id: string;
    name: string;
    probation_end: string;
    days_left: number;
  }[];
}
export async function hantarPenilaian(employmentId: string, markah: Record<string, number>, cadangan: CadanganPercubaan, bulan: number | null, ulasan: string) {
  return must(
    await getSupabase().rpc("submit_probation_review", {
      p_employment: employmentId,
      p_ratings: markah,
      p_recommendation: cadangan,
      p_extend_months: bulan as number,
      p_comments: ulasan,
    }),
  );
}
export type PenilaianTerkini = {
  id: string;
  ratings: Record<string, number>;
  recommendation: CadanganPercubaan;
  extend_months: number | null;
  comments: string | null;
  submitted_at: string;
  hr_decision: string | null;
  decided_at: string | null;
  reviewer: string;
} | null;
export async function getPenilaianTerkini(employmentId: string): Promise<PenilaianTerkini> {
  return must(await getSupabase().rpc("probation_review_latest", { p_employment: employmentId })) as unknown as PenilaianTerkini;
}
export async function putuskanPercubaan(employmentId: string, keputusan: "confirmed" | "extended" | "terminated", bulan?: number) {
  must(await getSupabase().rpc("decide_probation", { p_employment: employmentId, p_decision: keputusan, p_months: (bulan ?? null) as number }));
}
