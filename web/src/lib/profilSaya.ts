"use client";

import { tr } from "@/lib/i18n";
import { getSupabase } from "./supabase";
import { must } from "./useData";

/** Data untuk halaman Profil Saya (pekerja sendiri, satu syarikat aktif). */
export type ProfilSaya = {
  fullName: string;
  preferredName: string;
  icNo: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  maritalStatus: string | null;
  spouseWorking: boolean;
  childrenCount: number;
  hideBirthday: boolean;
  bankName: string | null;
  bankAccountNo: string | null;
  avatarPath: string | null;
  epfNo: string | null;
  socsoNo: string | null;
  taxNo: string | null;
  position: string | null;
  department: string | null;
  joinDate: string;
  employmentType: string;
  status: string;
  waris: { name: string; relationship: string | null; phone: string } | null;
  /** Permohonan kemas kini profil terakhir (menunggu / ditolak / dihantar balik) */
  permohonan: { id: string; status: string; changes: { field: string; label: string; old: string | null; new: string | null }[]; requestId: string | null; createdAt: string } | null;
};

export async function getProfilSaya(personId: string, employmentId: string): Promise<ProfilSaya> {
  const sb = getSupabase();
  const [p, e, w, r] = await Promise.all([
    sb
      .from("persons")
      .select("full_name, preferred_name, ic_no, phone_whatsapp, email, address, marital_status, spouse_working, children_count, hide_birthday, bank_name, bank_account_no, avatar_path")
      .eq("id", personId)
      .single(),
    sb.from("employments").select("epf_no, socso_no, tax_no, join_date, employment_type, status, positions(title), departments(name)").eq("id", employmentId).single(),
    sb.from("emergency_contacts").select("name, relationship, phone").eq("person_id", personId).limit(1),
    sb
      .from("profile_change_requests")
      .select("id, status, changes, approval_request_id, created_at")
      .eq("employment_id", employmentId)
      .in("status", ["pending", "rejected", "returned"])
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  const o = must(p);
  const k = must(e);
  const x = (must(r) ?? [])[0];
  return {
    fullName: o.full_name,
    preferredName: o.preferred_name ?? o.full_name,
    icNo: o.ic_no,
    phone: o.phone_whatsapp,
    email: o.email,
    address: o.address,
    maritalStatus: o.marital_status,
    spouseWorking: !!o.spouse_working,
    childrenCount: o.children_count ?? 0,
    hideBirthday: !!o.hide_birthday,
    bankName: o.bank_name,
    bankAccountNo: o.bank_account_no,
    avatarPath: o.avatar_path,
    epfNo: k.epf_no,
    socsoNo: k.socso_no,
    taxNo: k.tax_no,
    position: k.positions?.title ?? null,
    department: k.departments?.name ?? null,
    joinDate: k.join_date,
    employmentType: k.employment_type,
    status: k.status,
    waris: (must(w) ?? [])[0] ?? null,
    permohonan: x
      ? { id: x.id, status: x.status, changes: (x.changes ?? []) as NonNullable<ProfilSaya["permohonan"]>["changes"], requestId: x.approval_request_id, createdAt: x.created_at }
      : null,
  };
}

/** Kelengkapan profil (untuk meter & peringatan di Utama). */
export function kelengkapan(p: ProfilSaya): { peratus: number; kurang: string[] } {
  const semak: [boolean, string][] = [
    [!!p.avatarPath, tr("gambar profil")],
    [!!p.icNo, tr("no. kad pengenalan")],
    [!!p.address, tr("alamat")],
    [!!p.email, tr("e-mel peribadi")],
    [!!p.maritalStatus, tr("status perkahwinan")],
    [!!p.bankAccountNo, tr("akaun bank")],
    [!!p.epfNo, tr("no. KWSP")],
    [!!p.waris, tr("waris kecemasan")],
  ];
  const ada = semak.filter(([ok]) => ok).length;
  return { peratus: Math.round((ada / semak.length) * 100), kurang: semak.filter(([ok]) => !ok).map(([, l]) => l) };
}

export async function ubahTerus(data: Record<string, unknown>) {
  must(await getSupabase().rpc("update_my_profile", { p_data: data as never, p_via: "web" }));
}

/** Hantar perubahan yang perlu disahkan HR (melalui Kelulusan). */
export async function mohonKemasKini(employmentId: string, changes: Record<string, string | number | boolean | null>, lampiran: string | null): Promise<string> {
  return must(
    await getSupabase().rpc("submit_profile_change", { p_employment: employmentId, p_changes: changes as never, p_attachment: lampiran as string, p_via: "web" }),
  ) as string;
}

export const LABEL_KAHWIN: Record<string, string> = { bujang: tr("Bujang"), berkahwin: tr("Berkahwin"), duda_janda: tr("Duda / Janda") };
