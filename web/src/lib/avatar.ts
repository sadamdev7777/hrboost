"use client";

import { tr } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { getSupabase } from "./supabase";
import { must } from "./useData";

/**
 * Gambar profil (bucket peribadi `avatar`, folder <person_id>/). Rakan sekerja syarikat yang sama boleh melihat,
 * melalui URL bertandatangan (5 minit). Laluan semua gambar syarikat dimuat sekali dan disimpan dalam memori.
 */

const TAMAT = 4 * 60 * 1000; // URL ditandatangani 5 minit; segarkan selepas 4 minit
let laluan: { company: string; map: Map<string, string>; masa: number } | null = null;
let janji: Promise<Map<string, string>> | null = null;
const url = new Map<string, { u: string; masa: number }>();
const pendengar = new Set<() => void>();

async function petaSyarikat(companyId: string): Promise<Map<string, string>> {
  if (laluan && laluan.company === companyId && Date.now() - laluan.masa < TAMAT) return laluan.map;
  janji ??= (async () => {
    const rows = (must(await getSupabase().rpc("company_avatars", { p_company: companyId })) ?? []) as { person_id: string; avatar_path: string }[];
    const map = new Map(rows.map((r) => [r.person_id, r.avatar_path]));
    // Satu panggilan untuk semua URL bertandatangan
    const paths = [...map.values()];
    if (paths.length) {
      const { data } = await getSupabase().storage.from("avatar").createSignedUrls(paths, 300);
      for (const d of data ?? []) if (d.path && d.signedUrl) url.set(d.path, { u: d.signedUrl, masa: Date.now() });
    }
    laluan = { company: companyId, map, masa: Date.now() };
    return map;
  })().finally(() => {
    janji = null;
  });
  return janji;
}

async function urlUntuk(path: string): Promise<string | null> {
  const c = url.get(path);
  if (c && Date.now() - c.masa < TAMAT) return c.u;
  const { data } = await getSupabase().storage.from("avatar").createSignedUrl(path, 300);
  if (data?.signedUrl) url.set(path, { u: data.signedUrl, masa: Date.now() });
  return data?.signedUrl ?? null;
}

/** URL gambar profil seseorang (null jika tiada gambar). `path` boleh diberi terus jika sudah diketahui. */
export function useGambarProfil(personId: string | null | undefined, companyId: string | null | undefined, path?: string | null): string | null {
  const [u, setU] = useState<string | null>(null);
  const [versi, setVersi] = useState(0);
  useEffect(() => {
    const f = () => setVersi((v) => v + 1);
    pendengar.add(f);
    return () => {
      pendengar.delete(f);
    };
  }, []);
  useEffect(() => {
    let batal = false;
    (async () => {
      let p = path ?? null;
      if (p === null && path === undefined && personId && companyId) p = (await petaSyarikat(companyId).catch(() => new Map())).get(personId) ?? null;
      const hasil = p ? await urlUntuk(p).catch(() => null) : null;
      if (!batal) setU(hasil);
    })();
    return () => {
      batal = true;
    };
  }, [personId, companyId, path, versi]);
  return u;
}

/** Potong segi empat di tengah, kecilkan ke 512px, JPEG. */
async function sediakan(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new Error(tr("Fail ini bukan gambar yang sah."));
  const sisi = Math.min(bmp.width, bmp.height);
  const n = Math.min(512, sisi);
  const c = document.createElement("canvas");
  c.width = n;
  c.height = n;
  c.getContext("2d")!.drawImage(bmp, (bmp.width - sisi) / 2, (bmp.height - sisi) / 2, sisi, sisi, 0, 0, n, n);
  bmp.close();
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.85));
  if (!blob) throw new Error(tr("Fail ini bukan gambar yang sah."));
  return blob;
}

/** Simpan gambar profil baharu (gambar lama dibuang). */
export async function simpanGambarProfil(personId: string, file: File, lama: string | null): Promise<string> {
  const blob = await sediakan(file);
  const path = `${personId}/profil-${Date.now()}.jpg`;
  const sb = getSupabase();
  const { error } = await sb.storage.from("avatar").upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(tr("Gambar tidak dapat dimuat naik. Sila cuba lagi."));
  must(await sb.rpc("update_my_profile", { p_data: { avatar_path: path }, p_via: "web" }));
  if (lama) await sb.storage.from("avatar").remove([lama]);
  segarkan();
  return path;
}

export async function buangGambarProfil(lama: string | null) {
  const sb = getSupabase();
  must(await sb.rpc("update_my_profile", { p_data: { avatar_path: "" }, p_via: "web" }));
  if (lama) await sb.storage.from("avatar").remove([lama]);
  segarkan();
}

/** Muat semula semua avatar yang dipaparkan (selepas gambar ditukar). */
export function segarkan() {
  laluan = null;
  url.clear();
  for (const f of pendengar) f();
}
