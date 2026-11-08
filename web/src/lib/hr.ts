"use client";

import { getSupabase } from "./supabase";
import { must } from "./useData";
import type { Database } from "./database.types";

type EmpType = Database["public"]["Enums"]["employment_type"];
type EmpStatus = Database["public"]["Enums"]["employment_status"];

export const JENIS_PEKERJAAN: { value: EmpType; label: string }[] = [
  { value: "permanent", label: "Tetap" },
  { value: "contract", label: "Kontrak" },
  { value: "part_time", label: "Separuh masa" },
  { value: "intern", label: "Pelatih" },
];
export const labelJenis = (t: string) => JENIS_PEKERJAAN.find((j) => j.value === t)?.label ?? t;

export const LABEL_PERANAN: Record<string, string> = {
  hr: "HR",
  finance: "Kewangan",
  ceo: "CEO",
  admin: "Pentadbir",
  dept_head: "Ketua Jabatan",
  staff: "Pekerja",
};

// ---------------------------------------------------------------- Papan pemuka

export type Dashboard = {
  company_code: string;
  on_leave: { employment_id: string; name: string; leave: string; leave_name: string; half_day: string; department: string | null }[];
  late_today: number;
  sla_breached: number;
  attention: { kind: "sla" | "probation" | "bank" | "late"; text: string; request_id?: string; employment_id?: string }[];
  claims_approved_month: number;
  payroll_draft: number | null;
  headcount: number;
};

export async function getDashboard(companyId: string): Promise<Dashboard> {
  return must(await getSupabase().rpc("hr_dashboard", { p_company: companyId })) as unknown as Dashboard;
}

// ---------------------------------------------------------------- Senarai pekerja

export type PekerjaRingkas = {
  id: string;
  personId: string;
  name: string;
  employeeNo: string;
  status: EmpStatus;
  activated: boolean;
  departmentId: string | null;
  department: string | null;
  position: string | null;
  roles: string[];
  isHead: boolean;
};

export async function getSenaraiPekerja(companyId: string, termasukTamat = false): Promise<PekerjaRingkas[]> {
  const sb = getSupabase();
  let q = sb
    .from("employments")
    .select("id, person_id, employee_no, status, department_id, departments(name, head_person_id), positions(title), persons!employments_person_id_fkey(preferred_name, full_name, auth_user_id)")
    .eq("company_id", companyId)
    .order("employee_no");
  if (!termasukTamat) q = q.in("status", ["probation", "active"]);
  const [rows, roles] = await Promise.all([q, sb.from("user_roles").select("person_id, role").eq("company_id", companyId)]);
  const r = must(roles) ?? [];
  return (must(rows) ?? []).map((e) => ({
    id: e.id,
    personId: e.person_id,
    name: e.persons?.preferred_name || e.persons?.full_name || "",
    employeeNo: e.employee_no,
    status: e.status,
    activated: !!e.persons?.auth_user_id,
    departmentId: e.department_id,
    department: e.departments?.name ?? null,
    position: e.positions?.title ?? null,
    roles: r.filter((x) => x.person_id === e.person_id).map((x) => x.role),
    isHead: e.departments?.head_person_id === e.person_id,
  }));
}

export type Jabatan = { id: string; name: string; headPersonId: string | null; headName: string | null };

export async function getJabatan(companyId: string): Promise<Jabatan[]> {
  const sb = getSupabase();
  const d = must(await sb.from("departments").select("id, name, head_person_id").eq("company_id", companyId).order("name")) ?? [];
  const ids = d.map((x) => x.head_person_id).filter(Boolean) as string[];
  const ppl = ids.length ? (must(await sb.from("persons").select("id, preferred_name, full_name").in("id", ids)) ?? []) : [];
  return d.map((x) => {
    const p = ppl.find((y) => y.id === x.head_person_id);
    return { id: x.id, name: x.name, headPersonId: x.head_person_id, headName: p ? p.preferred_name || p.full_name : null };
  });
}

// ---------------------------------------------------------------- Tambah pekerja

export type BorangPekerja = {
  fullName: string;
  preferredName: string;
  phone: string; // 60xxxxxxxxx
  ic: string;
  departmentId: string;
  position: string;
  joinDate: string;
  type: EmpType;
  probationMonths: number;
  basic: string;
};

export async function tambahPekerja(companyId: string, f: BorangPekerja): Promise<string> {
  return must(
    await getSupabase().rpc("add_employee", {
      p_company: companyId,
      p_full_name: f.fullName.trim().toUpperCase(),
      p_preferred: f.preferredName.trim(),
      p_phone: f.phone,
      p_ic: f.ic.trim(),
      p_department: (f.departmentId || null) as string,
      p_position: (f.position.trim() || null) as string,
      p_join: f.joinDate,
      p_type: f.type,
      p_probation_months: f.probationMonths,
      p_basic: (f.basic ? Number(f.basic) : null) as number,
    }),
  ) as string;
}

export async function jemputPekerja(employmentId: string): Promise<string> {
  return must(await getSupabase().rpc("invite_employee", { p_employment: employmentId, p_base_url: window.location.origin })) as string;
}

// ---------------------------------------------------------------- Profil pekerja

export type ButiranPekerja = {
  id: string;
  personId: string;
  name: string;
  fullName: string;
  employeeNo: string;
  status: EmpStatus;
  type: EmpType;
  joinDate: string;
  probationEnd: string | null;
  endDate: string | null;
  endStatus: EmpStatus | null;
  departmentId: string | null;
  department: string | null;
  headName: string | null;
  position: string | null;
  workStart: string | null;
  companyName: string;
  companyWorkStart: string;
  otherCompanies: number;
  activated: boolean;
  inviteSentAt: string | null;
};

export async function getButiranPekerja(employmentId: string): Promise<ButiranPekerja> {
  const sb = getSupabase();
  const e = must(
    await sb
      .from("employments")
      .select(
        "id, person_id, company_id, employee_no, status, employment_type, join_date, probation_end_date, end_date, end_status, department_id, work_start, departments(name, head_person_id), positions(title), companies(name, work_start), persons!employments_person_id_fkey(preferred_name, full_name, auth_user_id)",
      )
      .eq("id", employmentId)
      .maybeSingle(),
  );
  if (!e) throw new Error("Pekerja tidak dijumpai atau anda tidak mempunyai akses.");
  const [head, lain, inv] = await Promise.all([
    e.departments?.head_person_id
      ? sb.from("persons").select("preferred_name, full_name").eq("id", e.departments.head_person_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    sb.rpc("person_other_companies", { p_employment: employmentId }),
    sb.from("employee_invites").select("created_at").eq("employment_id", employmentId).order("created_at", { ascending: false }).limit(1),
  ]);
  const h = must(head);
  return {
    id: e.id,
    personId: e.person_id,
    name: e.persons?.preferred_name || e.persons?.full_name || "",
    fullName: e.persons?.full_name ?? "",
    employeeNo: e.employee_no,
    status: e.status,
    type: e.employment_type,
    joinDate: e.join_date,
    probationEnd: e.probation_end_date,
    endDate: e.end_date,
    endStatus: e.end_status,
    departmentId: e.department_id,
    department: e.departments?.name ?? null,
    headName: h ? h.preferred_name || h.full_name : null,
    position: e.positions?.title ?? null,
    workStart: e.work_start,
    companyName: e.companies?.name ?? "",
    companyWorkStart: e.companies?.work_start ?? "09:00",
    otherCompanies: Number(must(lain) ?? 0),
    activated: !!e.persons?.auth_user_id,
    inviteSentAt: (must(inv) ?? [])[0]?.created_at ?? null,
  };
}

export type MaklumatSensitif = {
  full_name: string;
  ic_no: string | null;
  date_of_birth: string | null;
  gender: string | null;
  marital_status: string | null;
  children_count: number;
  phone: string | null;
  email: string | null;
  address: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  epf_no: string | null;
  socso_no: string | null;
  tax_no: string | null;
  emergency: { name: string; relationship: string | null; phone: string }[] | null;
  bank_change: { id: string; bank_name: string; bank_account_no: string; requested_at: string } | null;
};

export async function bukaMaklumatSensitif(employmentId: string): Promise<MaklumatSensitif> {
  return must(await getSupabase().rpc("hr_view_sensitive", { p_employment: employmentId, p_via: "web" })) as unknown as MaklumatSensitif;
}

export async function putuskanBank(requestId: string, lulus: boolean, nota?: string) {
  must(await getSupabase().rpc("decide_bank_change", { p_request: requestId, p_approve: lulus, p_note: nota ?? "", p_via: "web" }));
}

export async function kemasKiniPekerjaan(employmentId: string, data: Record<string, unknown>) {
  must(await getSupabase().rpc("hr_update_employment", { p_employment: employmentId, p_data: data as never, p_via: "web" }));
}

export async function tamatkanPekerjaan(employmentId: string, status: "resigned" | "terminated" | "retired", tarikh: string, sebab: string) {
  must(
    await getSupabase().rpc("end_employment", {
      p_employment: employmentId,
      p_status: status,
      p_end_date: tarikh,
      p_reason: sebab,
      p_via: "web",
    }),
  );
}

export async function getGajiSemasa(employmentId: string) {
  return must(await getSupabase().rpc("hr_current_pay", { p_employment: employmentId, p_via: "web" })) ?? [];
}

export async function getDokumen(employmentId: string) {
  return (
    must(
      await getSupabase()
        .from("employee_documents")
        .select("id, doc_type, title, storage_path, created_at")
        .eq("employment_id", employmentId)
        .order("created_at", { ascending: false }),
    ) ?? []
  );
}

export async function simpanDokumen(employmentId: string, personId: string, docType: string, title: string, path: string) {
  must(
    await getSupabase().from("employee_documents").insert({
      employment_id: employmentId,
      doc_type: docType,
      title,
      storage_path: path,
      uploaded_by: personId,
    }),
  );
}

export const JENIS_DOKUMEN = [
  { value: "offer_letter", label: "Surat tawaran" },
  { value: "contract", label: "Kontrak" },
  { value: "confirmation_letter", label: "Surat pengesahan" },
  { value: "certificate", label: "Sijil" },
  { value: "warning_letter", label: "Surat amaran" },
  { value: "other", label: "Lain-lain" },
];

export async function batalPenamatan(employmentId: string) {
  must(await getSupabase().rpc("cancel_employment_end", { p_employment: employmentId, p_via: "web" }));
}
