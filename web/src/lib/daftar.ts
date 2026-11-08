"use client";

/** Maklumat pendaftaran syarikat sementara (sessionStorage) antara /daftar dan /daftar/sahkan. */
export type Pendaftaran = { company: string; size: string; name: string; phone: string; email: string };
const KEY = "hrb_daftar_syarikat";

export function simpanPendaftaran(p: Pendaftaran) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* abaikan */
  }
}
export function bacaPendaftaran(): Pendaftaran | null {
  try {
    const s = sessionStorage.getItem(KEY);
    return s ? (JSON.parse(s) as Pendaftaran) : null;
  } catch {
    return null;
  }
}
export function padamPendaftaran() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* abaikan */
  }
}
export function bacaPendaftaranMentah(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
