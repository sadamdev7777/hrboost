"use client";

import { getSupabase } from "./supabase";
import { must } from "./useData";
import type { Json } from "./database.types";

/** Lapan langkah orientasi pekerja (CLAUDE.md §5, onboarding_progress.step). */
export const LANGKAH = [
  { key: "activate", label: "Aktifkan akaun", href: null, masa: "" },
  { key: "name", label: "Nama & nama panggilan", href: "/orientasi/nama", masa: "1 min" },
  { key: "selfie", label: "Swafoto untuk gambar profil", href: "/orientasi/swafoto", masa: "Kamera" },
  { key: "bank", label: "Bank & waris", href: "/orientasi/bank", masa: "2 min" },
  { key: "ic", label: "Gambar kad pengenalan", href: "/orientasi/kad-pengenalan", masa: "Kamera" },
  { key: "personal", label: "Peribadi, KWSP & cukai", href: "/orientasi/peribadi", masa: "2 min" },
  { key: "handbook", label: "Baca buku panduan syarikat", href: "/orientasi/buku-panduan", masa: "3 min" },
  { key: "install", label: "Pasang aplikasi di telefon", href: "/orientasi/pasang", masa: "30 saat" },
] as const;

export type KunciLangkah = (typeof LANGKAH)[number]["key"];

export async function getKemajuan(employmentId: string): Promise<Set<string>> {
  const rows = must(await getSupabase().from("onboarding_progress").select("step").eq("employment_id", employmentId));
  return new Set(rows.map((r) => r.step));
}

/** Langkah seterusnya yang belum selesai selepas `selepas` (atau dari awal). */
export function langkahSeterusnya(done: Set<string>, selepas?: KunciLangkah): string {
  const start = selepas ? LANGKAH.findIndex((l) => l.key === selepas) + 1 : 0;
  const next = LANGKAH.slice(start).find((l) => l.href && !done.has(l.key));
  return next?.href ?? "/orientasi/selesai";
}

/** Simpan satu langkah melalui RPC save_onboarding_step (medan disemak oleh pangkalan data). */
export async function simpanLangkah(employmentId: string, step: KunciLangkah, data: Record<string, Json> = {}) {
  const { data: n, error } = await getSupabase().rpc("save_onboarding_step", {
    p_employment: employmentId,
    p_step: step,
    p_data: data,
  });
  if (error) throw new Error(error.message);
  return n as number;
}
