"use client";

import { tr, trTajuk } from "@/lib/i18n";
import { getSupabase } from "./supabase";
import { must } from "./useData";
import {
  addDays,
  bilaDihantar,
  dow,
  hari,
  julatTarikh,
  namaPeringkat,
  ringgit,
  tarikh,
  tarikhTempatan,
  todayISO,
  type StatusPermohonan,
} from "./format";
import type { Pekerjaan } from "./me";
import type { Database } from "./database.types";

type RequestType = Database["public"]["Enums"]["request_type"];

// ---------------------------------------------------------------- Baki cuti

export type Baki = {
  code: string;
  name: string;
  leaveTypeId: string;
  entitled: number; // kelayakan + bawa ke hadapan + pelarasan
  used: number;
  pending: number;
  available: number;
};

/** Baki cuti tahun semasa bagi pekerjaan ini (AL, MC dan lain-lain jenis aktif). */
export async function getBaki(emp: Pekerjaan, year = Number(todayISO().slice(0, 4))): Promise<Record<string, Baki>> {
  const sb = getSupabase();
  const types = must(
    await sb
      .from("leave_types")
      .select("id, code, name, deduct_balance")
      .eq("company_id", emp.companyId)
      .eq("active", true)
      .order("sort_order"),
  );
  const bal = must(
    await sb
      .from("leave_balances")
      .select("leave_type_id, entitled, carried_forward, adjustment, used, pending, available")
      .eq("employment_id", emp.id)
      .eq("year", year),
  );
  const out: Record<string, Baki> = {};
  for (const t of types) {
    if (!t.deduct_balance) continue;
    const b = bal.find((x) => x.leave_type_id === t.id);
    if (b) {
      out[t.code] = {
        code: t.code,
        name: t.name,
        leaveTypeId: t.id,
        entitled: Number(b.entitled) + Number(b.carried_forward) + Number(b.adjustment),
        used: Number(b.used),
        pending: Number(b.pending),
        available: Number(b.available ?? 0),
      };
    } else {
      // Rekod baki belum wujud (dicipta semasa permohonan pertama): guna kelayakan.
      const ent = Number(
        must(await sb.rpc("leave_entitlement", { p_employment: emp.id, p_leave_type: t.id, p_year: year })) ?? 0,
      );
      out[t.code] = { code: t.code, name: t.name, leaveTypeId: t.id, entitled: ent, used: 0, pending: 0, available: ent };
    }
  }
  return out;
}

// ---------------------------------------------------------------- Permohonan saya

export type Permohonan = {
  id: string;
  type: RequestType;
  title: string;
  status: StatusPermohonan;
  submittedAt: string;
  completedAt: string | null;
  waitingFor: string | null;
  currentStep: number;
  totalSteps: number;
  context: Record<string, unknown>;
  companyCode: string;
};

export async function getPermohonanSaya(limit?: number): Promise<Permohonan[]> {
  const sb = getSupabase();
  let q = sb.from("v_my_requests").select("*").order("submitted_at", { ascending: false });
  if (limit) q = q.limit(limit);
  const rows = must(await q);
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.request_id!).filter(Boolean);
  const reqs = must(
    await sb.from("approval_requests").select("id, workflow_id, current_step_order, context").in("id", ids),
  );
  const wfIds = [...new Set(reqs.map((r) => r.workflow_id).filter((x): x is string => !!x))];
  const steps = wfIds.length
    ? must(await sb.from("approval_workflow_steps").select("workflow_id").in("workflow_id", wfIds))
    : [];
  return rows.map((r) => {
    const req = reqs.find((x) => x.id === r.request_id);
    const total = steps.filter((s) => s.workflow_id === req?.workflow_id).length;
    return {
      id: r.request_id!,
      type: r.request_type!,
      title: r.title!,
      status: r.status as StatusPermohonan,
      submittedAt: r.submitted_at!,
      completedAt: r.completed_at,
      waitingFor: r.waiting_for,
      currentStep: req?.current_step_order ?? 0,
      totalSteps: total,
      context: (req?.context as Record<string, unknown>) ?? {},
      companyCode: r.company_code!,
    };
  });
}

/** Tajuk ringkas & keterangan untuk kad permohonan (ikut reka bentuk). */
export function paparPermohonan(p: { type: RequestType; title: string; context: Record<string, unknown>; submittedAt: string }) {
  const c = p.context;
  if (p.type === "leave" && typeof c.start_date === "string" && typeof c.end_date === "string") {
    const nama = p.title.split(" " + tarikh(c.start_date))[0];
    return {
      title: trTajuk(`${nama} ${julatTarikh(c.start_date, c.end_date)}`),
      sub: tr("{0} hari · dihantar {1}", hari(Number(c.days ?? 0)), bilaDihantar(p.submittedAt)),
      days: Number(c.days ?? 0),
    };
  }
  if (p.type === "claim") {
    return {
      title: trTajuk(p.title.replace(/^Tuntutan: /, "Tuntutan ").replace(/ \(RM[^)]*\)$/, "")),
      sub: `${ringgit(Number(c.amount ?? 0))} · ${tarikh(tarikhTempatan(p.submittedAt))}`,
      days: null,
    };
  }
  if (p.type === "attendance_correction") {
    return { title: trTajuk(p.title.replace(/^Pembetulan kehadiran/, "Betulkan masa")), sub: tr("Pembetulan kehadiran"), days: null };
  }
  if (p.type === "overtime") {
    const jenis = c.day_type === "holiday" ? tr("cuti umum") : c.day_type === "rest" ? tr("hari rehat") : tr("hari biasa");
    return { title: trTajuk(p.title), sub: `${jenis} · ${String(c.reason ?? "")}`.trim(), days: null };
  }
  return { title: trTajuk(p.title), sub: tr("Dihantar {0}", bilaDihantar(p.submittedAt)), days: null };
}

/** "Kini di HR" daripada nama peringkat yang menunggu. */
export function kiniDi(waitingFor: string | null): string | null {
  if (!waitingFor) return null;
  return tr("Kini di ") + waitingFor.split(", ").map(namaPeringkat).join(", ");
}

/** Bilangan tugasan kelulusan yang menunggu tindakan saya. */
export async function getBilanganTugasan(): Promise<number> {
  const { count, error } = await getSupabase()
    .from("v_my_approval_tasks")
    .select("task_id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// ---------------------------------------------------------------- Kehadiran

export type HariKehadiran = { date: string; clockIn: string | null; late: boolean };

/** Isnin hingga Jumaat minggu ini. */
export function mingguIni(): string[] {
  const t = todayISO();
  const offset = (dow(t) + 6) % 7; // Isnin = 0
  const monday = addDays(t, -offset);
  return [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
}

export async function getKehadiranMinggu(emp: Pekerjaan): Promise<HariKehadiran[]> {
  const days = mingguIni();
  const rows = must(
    await getSupabase()
      .from("attendance_records")
      .select("work_date, clock_in, late_minutes")
      .eq("employment_id", emp.id)
      .gte("work_date", days[0])
      .lte("work_date", days[4]),
  );
  return days.map((d) => {
    const r = rows.find((x) => x.work_date === d);
    return { date: d, clockIn: r?.clock_in ?? null, late: (r?.late_minutes ?? 0) > emp.graceMinutes };
  });
}
