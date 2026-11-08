"use client";

import { getSupabase } from "./supabase";
import { must } from "./useData";
import { addDays, dow, todayISO, type StatusPermohonan } from "./format";
import type { Pekerjaan } from "./me";

// ---------------------------------------------------------------- Kalendar cuti

export type HariKalendar = { date: string; jenis: "me" | "ot" | "ph" | null; weekend: boolean; label: string | null };

export type DataCuti = {
  bulan: string; // YYYY-MM
  hari: HariKalendar[];
  rakan: string[]; // nama rakan yang bercuti bulan ini (untuk petunjuk)
  adaCutiUmum: boolean;
};

/** Kalendar bulanan: cuti saya, cuti rakan sejabatan dan cuti umum syarikat. */
export async function getKalendarCuti(emp: Pekerjaan, bulan: string): Promise<DataCuti> {
  const sb = getSupabase();
  const mula = `${bulan}-01`;
  const [y, m] = bulan.split("-").map(Number);
  const akhir = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const [cuti, umum, syarikat] = await Promise.all([
    sb.rpc("team_leave_calendar", { p_company: emp.companyId, p_from: mula, p_to: akhir }),
    sb.rpc("company_holidays", { p_company: emp.companyId, p_from: mula, p_to: akhir }),
    sb.from("companies").select("weekend_days").eq("id", emp.companyId).maybeSingle(),
  ]);
  const senarai = must(cuti) ?? [];
  const cu = must(umum) ?? [];
  const weekend = must(syarikat)?.weekend_days ?? [0, 6];

  const hari: HariKalendar[] = [];
  for (let d = mula; d <= akhir; d = addDays(d, 1)) {
    const ph = cu.find((h) => h.holiday_date === d);
    const saya = senarai.find((c) => c.is_me && c.start_date <= d && c.end_date >= d);
    const lain = senarai.filter((c) => !c.is_me && c.start_date <= d && c.end_date >= d);
    hari.push({
      date: d,
      weekend: weekend.includes(dow(d)),
      jenis: ph ? "ph" : saya ? "me" : lain.length ? "ot" : null,
      label: ph ? ph.name : saya ? "Saya" : lain.length ? lain.map((c) => c.name).join(", ") : null,
    });
  }
  return {
    bulan,
    hari,
    rakan: [...new Set(senarai.filter((c) => !c.is_me).map((c) => c.name))],
    adaCutiUmum: cu.length > 0,
  };
}

export type SejarahCuti = {
  id: string;
  jenis: string;
  start: string;
  end: string;
  days: number;
  status: StatusPermohonan;
  approvalRequestId: string | null;
  waitingFor: string | null;
};

/** Nama ringkas jenis cuti untuk kad baki & sejarah (reka bentuk Cuti). */
export function namaCutiRingkas(code: string, name: string): string {
  return ({ AL: "Tahunan", MC: "Sakit (MC)", HL: "Hospital" } as Record<string, string>)[code] ?? name.replace(/^Cuti\s+/i, "");
}

export async function getSejarahCuti(emp: Pekerjaan, year = Number(todayISO().slice(0, 4))): Promise<SejarahCuti[]> {
  const sb = getSupabase();
  const rows = must(
    await sb
      .from("leave_requests")
      .select("id, start_date, end_date, days, status, approval_request_id, leave_types(code, name)")
      .eq("employment_id", emp.id)
      .neq("status", "draft")
      .gte("end_date", `${year}-01-01`)
      .lte("start_date", `${year}-12-31`)
      .order("start_date", { ascending: false }),
  );
  const req = must(await sb.from("v_my_requests").select("request_id, waiting_for").eq("request_type", "leave"));
  return rows.map((r) => ({
    id: r.id,
    jenis: r.leave_types?.code === "MC" ? "MC" : namaCutiRingkas(r.leave_types?.code ?? "", r.leave_types?.name ?? "Cuti"),
    start: r.start_date,
    end: r.end_date,
    days: Number(r.days),
    status: r.status as StatusPermohonan,
    approvalRequestId: r.approval_request_id,
    waitingFor: req.find((x) => x.request_id === r.approval_request_id)?.waiting_for ?? null,
  }));
}

// ---------------------------------------------------------------- Profil

export type Profil = {
  fullName: string;
  preferredName: string;
  icNo: string | null;
  phone: string | null;
  address: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  childrenCount: number;
  hideBirthday: boolean;
  photoPath: string | null;
  waris: { name: string; relationship: string | null; phone: string } | null;
  pekerjaan: { company: string; position: string | null; department: string | null; joinDate: string }[];
  bankMenunggu: { bankName: string; bankAccountNo: string; requestedAt: string } | null;
  bankDitolak: { note: string | null; decidedAt: string } | null;
};

export async function getProfil(personId: string): Promise<Profil> {
  const sb = getSupabase();
  const [person, waris, emp, bank] = await Promise.all([
    sb
      .from("persons")
      .select("full_name, preferred_name, ic_no, phone_whatsapp, address, bank_name, bank_account_no, children_count, hide_birthday, photo_path")
      .eq("id", personId)
      .single(),
    sb.from("emergency_contacts").select("name, relationship, phone").eq("person_id", personId).limit(1),
    sb
      .from("employments")
      .select("join_date, status, companies(code), positions(title), departments(name)")
      .eq("person_id", personId)
      .in("status", ["probation", "active"])
      .order("join_date"),
    sb
      .from("bank_change_requests")
      .select("bank_name, bank_account_no, status, requested_at, decided_at, note")
      .eq("person_id", personId)
      .in("status", ["pending", "rejected"])
      .order("requested_at", { ascending: false })
      .limit(1),
  ]);
  const p = must(person);
  const w = (must(waris) ?? [])[0] ?? null;
  const b = (must(bank) ?? [])[0] ?? null;
  return {
    fullName: p.full_name,
    preferredName: p.preferred_name ?? p.full_name,
    icNo: p.ic_no,
    phone: p.phone_whatsapp,
    address: p.address,
    bankName: p.bank_name,
    bankAccountNo: p.bank_account_no,
    childrenCount: p.children_count,
    hideBirthday: p.hide_birthday,
    photoPath: p.photo_path,
    waris: w,
    pekerjaan: (must(emp) ?? []).map((e) => ({
      company: e.companies?.code ?? "",
      position: e.positions?.title ?? null,
      department: e.departments?.name ?? null,
      joinDate: e.join_date,
    })),
    bankMenunggu: b?.status === "pending" ? { bankName: b.bank_name, bankAccountNo: b.bank_account_no, requestedAt: b.requested_at } : null,
    bankDitolak: b?.status === "rejected" ? { note: b.note, decidedAt: b.decided_at ?? b.requested_at } : null,
  };
}

/** "••••••-••-1234" */
export function sorokIC(ic: string | null): string {
  if (!ic) return "Belum diisi";
  const d = ic.replace(/\D/g, "");
  return `••••••-••-${d.slice(-4)}`;
}

/** "•••• •••• 5678" */
export function sorokAkaun(no: string | null): string {
  if (!no) return "Belum diisi";
  return `•••• •••• ${no.replace(/\D/g, "").slice(-4)}`;
}

/** "011-•••• 0004" daripada 601100000004 */
export function sorokTelefon(full: string | null): string {
  if (!full) return "Belum diisi";
  const local = full.replace(/\D/g, "").replace(/^6/, "");
  return `${local.slice(0, 3)}-•••• ${local.slice(-4)}`;
}

export async function simpanProfil(data: {
  preferred_name: string;
  address: string;
  children_count: string;
  hide_birthday: boolean;
  contact_name: string;
  contact_relationship: string;
  contact_phone: string;
}) {
  const d: Record<string, unknown> = { ...data };
  if (!data.contact_name.trim() && !data.contact_phone.trim()) {
    delete d.contact_name;
    delete d.contact_relationship;
    delete d.contact_phone;
  }
  must(await getSupabase().rpc("update_my_profile", { p_data: d as never, p_via: "web" }));
}

export async function mohonTukarBank(bankName: string, accountNo: string) {
  must(await getSupabase().rpc("request_bank_change", { p_bank_name: bankName, p_account_no: accountNo, p_via: "web" }));
}

// ---------------------------------------------------------------- Hari jadi

export type HariJadi = { personId: string; name: string; department: string | null; date: string };

/** Hari jadi rakan sesyarikat antara dua tarikh, disusun mengikut tarikh terdekat. */
export async function getHariJadi(companyId: string, dari: string, hingga: string): Promise<HariJadi[]> {
  const rows = must(await getSupabase().rpc("team_birthdays", { p_company: companyId, p_from: dari, p_to: hingga })) ?? [];
  const y0 = Number(dari.slice(0, 4));
  return rows
    .map((r) => {
      const mmdd = `${String(r.month).padStart(2, "0")}-${String(r.day).padStart(2, "0")}`;
      let date = `${y0}-${mmdd}`;
      if (date < dari) date = `${y0 + 1}-${mmdd}`;
      return { personId: r.person_id, name: r.name, department: r.department, date };
    })
    .filter((r) => r.date >= dari && r.date <= hingga)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function nomborUcapan(companyId: string, personId: string): Promise<string | null> {
  return must(await getSupabase().rpc("birthday_whatsapp", { p_company: companyId, p_person: personId })) ?? null;
}
