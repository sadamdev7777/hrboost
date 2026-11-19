"use client";

import { tr } from "@/lib/i18n";
import { getSupabase } from "./supabase";
import { must } from "./useData";
import { muatNaikPeribadi } from "./upload";

export type PunchHariIni = {
  punched_at: string;
  source: "crosschex" | "gps";
  kind: "in" | "out" | null;
  location_name: string | null;
  distance_m: number | null;
  outside: boolean | null;
};
export type KehadiranHariIni = { enabled: boolean; date: string; punches: PunchHariIni[] };

/** Status daftar masuk hari ini (butang Utama). */
export async function getKehadiranHariIni(employmentId: string): Promise<KehadiranHariIni> {
  return must(await getSupabase().rpc("my_attendance_today", { p_employment: employmentId })) as unknown as KehadiranHariIni;
}

export type Lokasi = { lat: number; lng: number; accuracy: number };

function cubaLokasi(opsyen: PositionOptions): Promise<Lokasi> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      reject,
      opsyen,
    ),
  );
}

/**
 * Lokasi semasa peranti. Cuba GPS ketepatan tinggi dahulu; jika gagal (cth. komputer riba tanpa GPS),
 * cuba semula dengan ketepatan biasa (Wi-Fi / rangkaian). Mesej ralat dalam BM rasmi.
 */
export async function dapatkanLokasi(): Promise<Lokasi> {
  if (typeof navigator === "undefined" || !navigator.geolocation) throw new Error(tr("Telefon atau pelayar ini tidak menyokong lokasi."));
  let e: GeolocationPositionError;
  try {
    return await cubaLokasi({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  } catch (x) {
    e = x as GeolocationPositionError;
  }
  if (e.code !== e.PERMISSION_DENIED) {
    try {
      return await cubaLokasi({ enableHighAccuracy: false, timeout: 20000, maximumAge: 300000 });
    } catch (x) {
      e = x as GeolocationPositionError;
    }
  }
  const komputer = typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches;
  throw new Error(
    e.code === e.PERMISSION_DENIED
      ? komputer
        ? tr("Akses lokasi ditolak. Benarkan lokasi untuk HRBoost pada ikon di bar alamat pelayar, kemudian cuba lagi.")
        : tr("Akses lokasi ditolak. Benarkan lokasi untuk HRBoost dalam tetapan telefon, kemudian cuba lagi.")
      : komputer
        ? tr("Lokasi tidak dapat dikesan oleh komputer ini. Hidupkan Perkhidmatan Lokasi (Location Services) untuk pelayar dalam tetapan sistem, atau tampal pautan Google Maps lokasi pejabat.")
        : e.code === e.TIMEOUT
          ? tr("Lokasi mengambil masa terlalu lama. Cuba di kawasan terbuka.")
          : tr("Lokasi tidak dapat dikesan. Sila hidupkan GPS dan cuba lagi."),
  );
}

/**
 * Koordinat daripada pautan Google Maps atau teks "lat, lng".
 * Menyokong: "3.0738, 101.5183", ".../@3.0738,101.5183,17z", "?q=3.0738,101.5183", "!3d3.0738!4d101.5183".
 */
export function koordinatDaripadaTeks(t: string): { lat: number; lng: number } | null {
  const s = decodeURIComponent(t.trim());
  const cuba = [/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /@(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/];
  for (const r of cuba) {
    const m = s.match(r);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}

export type HasilDaftar = { id: number; punched_at: string; kind: "in" | "out"; location_name: string | null; distance_m: number | null; outside: boolean };

/** Muat naik swafoto, kemudian rekod daftar masuk / keluar (masa diambil oleh pelayan). */
export async function daftarKehadiran(
  personId: string,
  employmentId: string,
  jenis: "in" | "out",
  lokasi: Lokasi,
  swafoto: File,
): Promise<HasilDaftar> {
  const path = await muatNaikPeribadi(personId, `kehadiran-${jenis}`, swafoto);
  return must(
    await getSupabase().rpc("attendance_gps_punch", {
      p_employment: employmentId,
      p_kind: jenis,
      p_lat: lokasi.lat,
      p_lng: lokasi.lng,
      p_accuracy: lokasi.accuracy,
      p_selfie_path: path,
      p_via: "web",
    }),
  ) as unknown as HasilDaftar;
}

export const jarakTeks = (m: number | null | undefined) =>
  m == null ? "" : m >= 1000 ? tr("{0} km", (m / 1000).toLocaleString("en-MY", { maximumFractionDigits: 1 })) : tr("{0} m", m);

// ---------------------------------------------------------------- HR
export type LokasiPejabat = { id: string; name: string; lat: number; lng: number; radius_m: number };
export type TetapanGps = { enabled: boolean; locations: LokasiPejabat[] };

export async function getTetapanGps(companyId: string): Promise<TetapanGps> {
  const d = must(await getSupabase().rpc("hr_gps_settings", { p_company: companyId })) as unknown as TetapanGps;
  return { enabled: !!d.enabled, locations: (d.locations ?? []).map((l) => ({ ...l, lat: Number(l.lat), lng: Number(l.lng) })) };
}
export async function setGps(companyId: string, on: boolean) {
  must(await getSupabase().rpc("set_gps_attendance", { p_company: companyId, p_on: on }));
}
export async function simpanLokasi(companyId: string, data: { name: string; lat: number; lng: number; radius_m: number }, id?: string) {
  must(await getSupabase().rpc("hr_location_save", { p_company: companyId, p_data: data, p_id: id }));
}
export async function padamLokasi(id: string) {
  must(await getSupabase().rpc("hr_location_delete", { p_id: id }));
}
/** Laluan swafoto punch (akses direkod dalam log akses data). */
export async function laluanSwafoto(punchId: number): Promise<string | null> {
  return (must(await getSupabase().rpc("hr_attendance_selfie", { p_punch: punchId })) as unknown as string) ?? null;
}
export const petaUrl = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`;
