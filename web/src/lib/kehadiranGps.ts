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

/** Lokasi semasa telefon (GPS ketepatan tinggi). Mesej ralat dalam BM rasmi. */
export function dapatkanLokasi(): Promise<Lokasi> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error(tr("Telefon atau pelayar ini tidak menyokong lokasi.")));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      (e) =>
        reject(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? tr("Akses lokasi ditolak. Benarkan lokasi untuk HRBoost dalam tetapan telefon, kemudian cuba lagi.")
              : e.code === e.TIMEOUT
                ? tr("Lokasi mengambil masa terlalu lama. Cuba di kawasan terbuka.")
                : tr("Lokasi tidak dapat dikesan. Sila hidupkan GPS dan cuba lagi."),
          ),
        ),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
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
