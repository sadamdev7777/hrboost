"use client";

import { getSupabase } from "./supabase";
import { must } from "./useData";

export async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return must(await (getSupabase().rpc as any)(fn, args)) as T;
}

export const masaRelatif = (iso: string | null) => {
  if (!iso) return "-";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} minit`;
  if (s < 86400) return `${Math.round(s / 3600)} jam`;
  return `${Math.round(s / 86400)} hari`;
};

export const tarikhPendek = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("ms-MY", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" }) : "-";

export const masaLog = (iso: string) =>
  new Date(iso).toLocaleString("ms-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" });

export const LABEL_STATUS_SYARIKAT: Record<string, { l: string; c: string }> = {
  active: { l: "Aktif", c: "bg-success-soft text-success" },
  onboarding: { l: "Persediaan", c: "bg-warning-soft text-warning" },
  suspended: { l: "Dinyahaktif", c: "bg-danger-soft text-danger" },
};
