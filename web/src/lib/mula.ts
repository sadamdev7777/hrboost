"use client";

import { getSupabase } from "./supabase";
import { must } from "./useData";

export type KeadaanMula = {
  name: string;
  code: string;
  completed_at: string | null;
  steps: string[];
  employees: number;
  activated: number;
  departments: number;
  departments_without_head: number;
  holidays: number;
  invites_pending: number;
};

export const LANGKAH_MULA = [
  { id: "admin", label: "Daftar akaun Pentadbir", href: "/mula", nota: "" },
  { id: "company", label: "Maklumat syarikat", href: "/mula/syarikat", nota: "" },
  { id: "import", label: "Import pekerja", href: "/mula/import", nota: "Excel" },
  { id: "departments", label: "Jabatan & ketua", href: "/mula/jabatan", nota: "Daripada import" },
  { id: "roles", label: "Peranan & kelulusan", href: "/mula/peranan", nota: "HR, CEO" },
  { id: "invite", label: "Jemput pekerja", href: "/mula/jemput", nota: "WhatsApp" },
] as const;

export async function getKeadaanMula(companyId: string): Promise<KeadaanMula> {
  return must(await getSupabase().rpc("company_onboarding_state", { p_company: companyId })) as unknown as KeadaanMula;
}

export async function selesaiLangkah(companyId: string, step: string) {
  return must(await getSupabase().rpc("complete_company_step", { p_company: companyId, p_step: step }));
}

export function langkahSeterusnya(k: KeadaanMula): string {
  const l = LANGKAH_MULA.find((x) => !k.steps.includes(x.id));
  return l ? l.href : "/mula/selesai";
}
