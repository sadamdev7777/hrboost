"use client";

import { lokal, tr } from "@/lib/i18n";
import { getSupabase } from "./supabase";
import { must } from "./useData";

export async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return must(await (getSupabase().rpc as any)(fn, args)) as T;
}

export const masaRelatif = (iso: string | null) => {
  if (!iso) return "-";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return tr("{0} minit", Math.max(1, Math.round(s / 60)));
  if (s < 86400) return tr("{0} jam", Math.round(s / 3600));
  return tr("{0} hari", Math.round(s / 86400));
};

export const tarikhPendek = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(lokal(), { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" }) : "-";

export const masaLog = (iso: string) =>
  new Date(iso).toLocaleString(lokal(), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" });

export const LABEL_STATUS_SYARIKAT: Record<string, { l: string; c: string }> = {
  active: { l: tr("Aktif"), c: "bg-success-soft text-success" },
  onboarding: { l: tr("Persediaan"), c: "bg-warning-soft text-warning" },
  suspended: { l: tr("Dinyahaktif"), c: "bg-danger-soft text-danger" },
};
