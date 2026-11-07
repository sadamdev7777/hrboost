"use client";

import { getSupabase } from "./supabase";

const MAX_SIDE = 1600;
const QUALITY = 0.8;
const MAX_BYTES = 10 * 1024 * 1024;

/** Mampatkan gambar di telefon sebelum muat naik (CLAUDE.md §6: ≤ 1600px, JPEG ~0.8). PDF tidak diubah. */
export async function mampatkanGambar(file: File): Promise<Blob> {
  if (file.type === "application/pdf") return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", QUALITY));
  return blob ?? file;
}

/**
 * Muat naik fail peribadi ke bucket `peribadi` di bawah folder orang itu sendiri
 * (polisi storan hanya membenarkan folder <person_id>/). Memulangkan laluan fail.
 */
export async function muatNaikPeribadi(personId: string, nama: string, file: File): Promise<string> {
  const blob = await mampatkanGambar(file);
  if (blob.size > MAX_BYTES) throw new Error("Saiz fail melebihi 10 MB.");
  const ext = blob.type === "application/pdf" ? "pdf" : "jpg";
  const path = `${personId}/${nama}-${Date.now()}.${ext}`;
  const { error } = await getSupabase()
    .storage.from("peribadi")
    .upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
  if (error) throw new Error("Fail tidak dapat dimuat naik. Sila cuba lagi.");
  return path;
}

/** URL bertandatangan sementara (≤ 5 minit, CLAUDE.md §6) untuk memaparkan fail peribadi. */
export async function urlSementara(path: string): Promise<string | null> {
  const { data } = await getSupabase().storage.from("peribadi").createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}
