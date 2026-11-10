"use client";

import { tr } from "@/lib/i18n";
import { getSupabase } from "./supabase";
import { must } from "./useData";

/** Saiz logo yang dicadangkan (nisbah 3:1, mendatar). Dipaparkan pada skrin. */
export const SAIZ_LOGO = { w: 600, h: 200 };
const MAKS_LEBAR = 1200;
const MAKS_TINGGI = 400;
const MAKS_BAIT = 1024 * 1024;
const JENIS = ["image/png", "image/jpeg", "image/webp"];

/** URL awam logo syarikat (bucket `logo` ialah awam kerana logo bukan data peribadi). */
export function urlLogo(path: string | null | undefined): string | null {
  if (!path) return null;
  return getSupabase().storage.from("logo").getPublicUrl(path).data.publicUrl;
}

/** Kecilkan logo ke ≤ 1200 × 400 px. PNG/WebP kekal lutsinar; JPEG kekal JPEG. */
async function sediakan(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new Error(tr("Fail ini bukan gambar yang sah."));
  const skala = Math.min(1, MAKS_LEBAR / bmp.width, MAKS_TINGGI / bmp.height);
  const w = Math.max(1, Math.round(bmp.width * skala));
  const h = Math.max(1, Math.round(bmp.height * skala));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const jenis = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
  let blob = await new Promise<Blob | null>((res) => c.toBlob(res, jenis, 0.9));
  // PNG yang terlalu besar (cth. gambar foto) → WebP yang masih lutsinar
  if (blob && blob.size > MAKS_BAIT) blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/webp", 0.85));
  if (!blob) throw new Error(tr("Fail ini bukan gambar yang sah."));
  return blob;
}

/** Semak fail logo sebelum dimuat naik. Memulangkan mesej ralat atau null. */
export function semakFailLogo(file: File): string | null {
  if (!JENIS.includes(file.type)) return tr("Gunakan fail PNG, JPG atau WebP.");
  if (file.size > 10 * 1024 * 1024) return tr("Saiz fail melebihi 10 MB.");
  return null;
}

/** Muat naik logo ke folder <company_id>/ dan tetapkan sebagai logo syarikat. Logo lama dibuang. */
export async function muatNaikLogo(companyId: string, file: File, lama: string | null): Promise<string> {
  const salah = semakFailLogo(file);
  if (salah) throw new Error(salah);
  const blob = await sediakan(file);
  if (blob.size > MAKS_BAIT) throw new Error(tr("Logo masih melebihi 1 MB selepas dikecilkan. Sila gunakan fail yang lebih ringkas."));
  const ext = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png";
  const path = `${companyId}/logo-${Date.now()}.${ext}`;
  const sb = getSupabase();
  const { error } = await sb.storage.from("logo").upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw new Error(tr("Logo tidak dapat dimuat naik. Sila cuba lagi."));
  must(await sb.rpc("set_company_logo", { p_company: companyId, p_path: path }));
  if (lama) await sb.storage.from("logo").remove([lama]);
  return path;
}

/** Buang logo syarikat. */
export async function buangLogo(companyId: string, lama: string | null) {
  const sb = getSupabase();
  must(await sb.rpc("set_company_logo", { p_company: companyId, p_path: null as unknown as string }));
  if (lama) await sb.storage.from("logo").remove([lama]);
}

/** Logo setiap syarikat untuk panel Pentadbir Platform. */
export async function getLogoSemuaSyarikat(): Promise<Record<string, string>> {
  const rows = must(await getSupabase().rpc("sa_company_logos")) as { company_id: string; logo_path: string }[];
  return Object.fromEntries(rows.map((r) => [r.company_id, r.logo_path]));
}
