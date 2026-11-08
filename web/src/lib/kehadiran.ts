"use client";

import { getSupabase } from "./supabase";
import { must } from "./useData";
import type { StatusPermohonan } from "./format";

export type HariHadir = {
  date: string;
  working: boolean;
  clockIn: string | null;
  clockOut: string | null;
  late: number;
  source: string | null;
  leave: string | null;
  holiday: string | null;
  correction: StatusPermohonan | null;
  correctionRequest: string | null;
};

export async function getKehadiranBulan(employmentId: string, bulan: string): Promise<HariHadir[]> {
  const [y, m] = bulan.split("-").map(Number);
  const akhir = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const rows = must(await getSupabase().rpc("attendance_month", { p_employment: employmentId, p_from: `${bulan}-01`, p_to: akhir })) ?? [];
  return rows.map((r) => ({
    date: r.work_date,
    working: r.working_day,
    clockIn: r.clock_in,
    clockOut: r.clock_out,
    late: r.late_minutes,
    source: r.source,
    leave: r.leave_code,
    holiday: r.holiday,
    correction: r.correction_status as StatusPermohonan | null,
    correctionRequest: r.correction_request,
  }));
}

export const SEBAB_PEMBETULAN = [
  { id: "lupa", label: "Terlupa mengimbas" },
  { id: "mesin", label: "Mesin rosak" },
  { id: "luar", label: "Bertugas di luar pejabat" },
  { id: "lain", label: "Lain-lain" },
];

/** "2026-11-06" + "08:55" (waktu Malaysia) → ISO UTC */
export function masaKeISO(date: string, hhmm: string): string | null {
  if (!/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [h, mi] = hhmm.split(":").map(Number);
  if (h > 23 || mi > 59) return null;
  return new Date(`${date}T${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:00+08:00`).toISOString();
}

export async function hantarPembetulan(employmentId: string, date: string, masuk: string | null, keluar: string | null, sebab: string) {
  must(
    await getSupabase().rpc("submit_attendance_correction", {
      p_employment: employmentId,
      p_date: date,
      p_in: masuk as string,
      p_out: keluar as string,
      p_reason: sebab,
      p_via: "web",
    }),
  );
}
