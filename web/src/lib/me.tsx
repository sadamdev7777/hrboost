"use client";

import { bahasa, bahasaDipilih, tetapkanBahasa, tr } from "@/lib/i18n";
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { getSupabase } from "./supabase";
import type { Database } from "./database.types";

type Role = Database["public"]["Enums"]["app_role"];

export type Pekerjaan = {
  id: string;
  companyId: string;
  companyCode: string;
  companyName: string;
  employeeNo: string;
  departmentId: string | null;
  departmentName: string | null;
  position: string | null;
  workStart: string;
  workEnd: string;
  graceMinutes: number;
};

export type Me = {
  userId: string;
  phone: string | null;
  personId: string;
  name: string; // nama panggilan
  fullName: string;
  photoPath: string | null;
  employments: Pekerjaan[];
  active: Pekerjaan | null;
  roles: Role[]; // peranan dalam syarikat aktif
  isHead: boolean; // ketua jabatan dalam syarikat aktif
  headOfDepartmentIds: string[];
  /** Belum menetapkan e-mel & kata laluan (log masuk pertama melalui OTP WhatsApp). */
  needsPassword: boolean;
  loginEmail: string | null;
  /** E-mel dalam rekod pekerja (cth. diisi semasa pendaftaran syarikat). */
  personEmail: string | null;
};

type State =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "no-person"; userId: string; phone: string | null }
  | { status: "ready"; me: Me }
  | { status: "error"; message: string };

type Ctx = {
  state: State;
  reload: () => void;
  setActiveCompany: (companyId: string) => void;
  /** Kemas kini medan Me serta-merta (tanpa memuat semula). */
  patchMe: (p: Partial<Me>) => void;
};

const MeContext = createContext<Ctx | null>(null);
const ACTIVE_KEY = "hrb_syarikat_aktif";

async function loadMe(preferredCompany: string | null): Promise<State> {
  const sb = getSupabase();
  const { data: sess } = await sb.auth.getSession();
  const user = sess.session?.user;
  if (!user) return { status: "signed-out" };

  const { data: person, error: pErr } = await sb
    .from("persons")
    .select("id, full_name, preferred_name, photo_path, email, language")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (pErr) return { status: "error", message: pErr.message };
  if (!person) return { status: "no-person", userId: user.id, phone: user.phone ?? null };
  // Bahasa: pilihan pelayar ini didahulukan; jika belum dipilih, ikut pilihan yang disimpan pada akaun
  if (!bahasaDipilih() && (person.language === "ms" || person.language === "en") && person.language !== bahasa()) {
    tetapkanBahasa(person.language as "ms" | "en");
    return { status: "loading" };
  }

  const loginP = sb.rpc("my_login_status");
  const { data: emps, error: eErr } = await sb
    .from("employments")
    .select(
      "id, company_id, employee_no, department_id, work_start, companies(code, name, work_start, work_end, late_grace_minutes), departments(name), positions(title)",
    )
    .eq("person_id", person.id)
    .in("status", ["probation", "active"])
    .order("join_date");
  if (eErr) return { status: "error", message: eErr.message };

  const employments: Pekerjaan[] = (emps ?? [])
    .filter((e) => e.companies) // syarikat dinyahaktif tidak kelihatan melalui RLS
    .map((e) => ({
      id: e.id,
      companyId: e.company_id,
      companyCode: e.companies!.code,
      companyName: e.companies!.name,
      employeeNo: e.employee_no,
      departmentId: e.department_id,
      departmentName: e.departments?.name ?? null,
      position: e.positions?.title ?? null,
      workStart: (e.work_start ?? e.companies!.work_start).slice(0, 5),
      workEnd: e.companies!.work_end.slice(0, 5),
      graceMinutes: e.companies!.late_grace_minutes,
    }));

  const active = employments.find((e) => e.companyId === preferredCompany) ?? employments[0] ?? null;

  let roles: Role[] = [];
  let headOfDepartmentIds: string[] = [];
  if (active) {
    const [{ data: r }, { data: heads }] = await Promise.all([
      sb.from("user_roles").select("role").eq("person_id", person.id).eq("company_id", active.companyId),
      sb.from("departments").select("id").eq("company_id", active.companyId).eq("head_person_id", person.id),
    ]);
    roles = (r ?? []).map((x) => x.role);
    headOfDepartmentIds = (heads ?? []).map((x) => x.id);
  }

  const { data: login } = await loginP;
  const ls = (login ?? null) as { has_password?: boolean; email?: string | null } | null;

  return {
    status: "ready",
    me: {
      userId: user.id,
      phone: user.phone ?? null,
      personId: person.id,
      name: person.preferred_name || person.full_name,
      fullName: person.full_name,
      photoPath: person.photo_path,
      employments,
      active,
      roles,
      isHead: headOfDepartmentIds.length > 0,
      headOfDepartmentIds,
      needsPassword: ls ? !ls.has_password : false,
      loginEmail: ls?.email ?? null,
      personEmail: person.email ?? null,
    },
  };
}

export function MeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    let preferred: string | null = null;
    try {
      preferred = localStorage.getItem(ACTIVE_KEY);
    } catch {
      /* abaikan */
    }
    loadMe(preferred)
      .then((s) => alive && setState(s))
      .catch((e: unknown) => alive && setState({ status: "error", message: String(e) }));
    return () => {
      alive = false;
    };
  }, [tick]);

  useEffect(() => {
    const { data } = getSupabase().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") setState({ status: "signed-out" });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setActiveCompany = useCallback((companyId: string) => {
    try {
      localStorage.setItem(ACTIVE_KEY, companyId);
    } catch {
      /* abaikan */
    }
    setTick((t) => t + 1);
  }, []);

  const patchMe = useCallback((p: Partial<Me>) => setState((s) => (s.status === "ready" ? { status: "ready", me: { ...s.me, ...p } } : s)), []);
  const value = useMemo(() => ({ state, reload, setActiveCompany, patchMe }), [state, reload, setActiveCompany, patchMe]);
  return <MeContext value={value}>{children}</MeContext>;
}

export function useMeContext(): Ctx {
  const ctx = use(MeContext);
  if (!ctx) throw new Error(tr("useMeContext mesti digunakan dalam MeProvider"));
  return ctx;
}

/** Pengguna semasa (hanya dalam halaman yang dilindungi, selepas status "ready"). */
export function useMe(): Me {
  const { state } = useMeContext();
  if (state.status !== "ready") throw new Error(tr("Pengguna belum dimuatkan"));
  return state.me;
}

export function hasRole(me: Me, roles: Role[]): boolean {
  return me.roles.some((r) => roles.includes(r));
}
