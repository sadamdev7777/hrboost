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
  logoPath: string | null;
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

type KonteksDb = {
  person: { id: string; full_name: string; preferred_name: string | null; photo_path: string | null; email: string | null; language: string | null };
  employments: {
    id: string;
    company_id: string;
    company_code: string;
    company_name: string;
    logo_path: string | null;
    employee_no: string;
    department_id: string | null;
    department_name: string | null;
    position: string | null;
    work_start: string;
    work_end: string;
    late_grace_minutes: number;
  }[];
  active_company: string | null;
  roles: Role[];
  heads: string[];
  login: { has_password?: boolean; email?: string | null } | null;
};

async function loadMe(preferredCompany: string | null): Promise<State> {
  const sb = getSupabase();
  const { data: sess } = await sb.auth.getSession();
  const user = sess.session?.user;
  if (!user) return { status: "signed-out" };

  // Satu panggilan: orang, pekerjaan, peranan, ketua jabatan & status log masuk (my_context)
  const { data: ctxData, error: cErr } = await sb.rpc("my_context", preferredCompany ? { p_company: preferredCompany } : {});
  if (cErr) return { status: "error", message: cErr.message };
  const c = ctxData as unknown as KonteksDb | null;
  if (!c) return { status: "no-person", userId: user.id, phone: user.phone ?? null };
  const person = c.person;
  // Bahasa: pilihan pelayar ini didahulukan; jika belum dipilih, ikut pilihan yang disimpan pada akaun
  if (!bahasaDipilih() && (person.language === "ms" || person.language === "en") && person.language !== bahasa()) {
    tetapkanBahasa(person.language as "ms" | "en");
    return { status: "loading" };
  }

  const employments: Pekerjaan[] = c.employments.map((e) => ({
    id: e.id,
    companyId: e.company_id,
    companyCode: e.company_code,
    companyName: e.company_name,
    logoPath: e.logo_path ?? null,
    employeeNo: e.employee_no,
    departmentId: e.department_id,
    departmentName: e.department_name ?? null,
    position: e.position ?? null,
    workStart: e.work_start,
    workEnd: e.work_end,
    graceMinutes: e.late_grace_minutes,
  }));
  const active = employments.find((e) => e.companyId === c.active_company) ?? null;
  const roles = active ? c.roles : [];
  const headOfDepartmentIds = active ? c.heads : [];
  const ls = c.login;

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
      .then((s) => {
        if (alive) setState(s);
      })
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
