import { getSupabase } from "./supabase";
import { kiraLogMasuk } from "@/components/CadanganPasang";

/** Destinasi selepas log masuk: Pentadbir Platform tanpa pekerjaan → /admin, selainnya /utama. */
export async function destinasiSelepasMasuk(): Promise<string> {
  kiraLogMasuk();
  const sb = getSupabase();
  // Pendaftaran syarikat yang belum selesai (e-mel disahkan di peranti lain): cipta syarikat dahulu
  const { data: u } = await sb.auth.getUser();
  if ((u.user?.user_metadata as { daftar?: unknown } | undefined)?.daftar) return "/daftar/sahkan";
  // Kembali ke halaman asal selepas sesi tamat (cth. /masuk?seterusnya=/orientasi/nama); hanya laluan dalaman
  try {
    const seterusnya = new URLSearchParams(window.location.search).get("seterusnya");
    if (seterusnya && /^\/[^/\\]/.test(seterusnya) && !seterusnya.startsWith("/masuk")) return seterusnya;
  } catch {
    /* abaikan */
  }
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

