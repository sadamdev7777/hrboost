import { getSupabase } from "./supabase";

/** Destinasi selepas log masuk: Pentadbir Platform tanpa pekerjaan → /admin, selainnya /utama. */
export async function destinasiSelepasMasuk(): Promise<string> {
  const sb = getSupabase();
  const { data: sa } = await sb.from("platform_admins").select("person_id").limit(1);
  if (sa && sa.length > 0) {
    const { count } = await sb
      .from("employments")
      .select("id", { count: "exact", head: true })
      .eq("person_id", sa[0].person_id)
      .in("status", ["probation", "active"]);
    if (!count) return "/admin";
  }
  return "/utama";
}

export const MIN_KATA_LALUAN = 8;
export const EMEL_SAH = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Panggil Edge Function password-reset; pulangkan ralat dalam bahasa Melayu jika gagal. */
export async function panggilSetSemula(body: Record<string, string>): Promise<{ ok?: boolean; error?: string; code?: string; attempts_left?: number }> {
  const { data, error } = await getSupabase().functions.invoke("password-reset", { body });
  if (!error) return (data ?? {}) as { ok?: boolean };
  const ctx = (error as { context?: unknown }).context;
  if (ctx instanceof Response) {
    try {
      return (await ctx.json()) as { error?: string };
    } catch {
      /* abaikan */
    }
  }
  return { error: "Permintaan tidak dapat dihantar. Sila cuba lagi." };
}
