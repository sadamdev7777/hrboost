"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { MeProvider, useMeContext } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { paparTelefon } from "@/lib/format";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { MenuSisi } from "@/components/TabNav";
import { useMod } from "@/lib/mod";

function Guard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { state } = useMeContext();
  const path = usePathname();
  const GATE = "/akaun/kata-laluan";
  const perluKataLaluan = state.status === "ready" && state.me.needsPassword && path !== GATE;

  useEffect(() => {
    if (state.status === "signed-out") router.replace("/masuk");
  }, [state.status, router]);

  // Mod HR: laman utama ialah Papan Pemuka, bukan Utama pekerja.
  const { mod } = useMod();
  const keHr = state.status === "ready" && !perluKataLaluan && mod === "hr" && path === "/utama";
  useEffect(() => {
    if (keHr) router.replace("/pengurusan");
  }, [keHr, router]);

  // Log masuk pertama melalui OTP WhatsApp: wajib tetapkan e-mel & kata laluan dahulu.
  useEffect(() => {
    if (perluKataLaluan) router.replace(`${GATE}?seterusnya=${encodeURIComponent(path)}`);
  }, [perluKataLaluan, path, router]);

  if (state.status === "loading" || state.status === "signed-out" || perluKataLaluan || keHr) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  if (state.status === "error") {
    return (
      <Screen>
        <div className="p-6">
          <ErrorBox message={`Maklumat akaun tidak dapat dimuatkan. ${state.message}`} />
        </div>
      </Screen>
    );
  }

  if (state.status === "no-person") {
    return (
      <Screen>
        <div className="flex grow flex-col justify-center gap-4 p-6">
          <h1 className="m-0 text-2xl font-extrabold">Akaun belum diaktifkan</h1>
          <p className="m-0 text-sm leading-normal text-subtle">
            Nombor {state.phone ? paparTelefon(state.phone) : "ini"} belum dipautkan kepada mana-mana pekerja. Semak
            WhatsApp anda untuk pautan jemputan daripada HR, atau hubungi HR syarikat anda.
          </p>
          <button
            type="button"
            onClick={() => void getSupabase().auth.signOut()}
            className="h-12 rounded-[14px] border border-line bg-surface text-sm font-bold text-danger"
          >
            Log keluar
          </button>
        </div>
      </Screen>
    );
  }

  return (
    <>
      <div className="lg:flex">
        <MenuSisi />
        <div className="min-w-0 lg:flex-1">
          <Notis />
          {children}
        </div>
      </div>
    </>
  );
}

/** Notis penyelenggaraan platform & peringatan persediaan syarikat (Pentadbir). */
function Notis() {
  const { state } = useMeContext();
  const me = state.status === "ready" ? state.me : null;
  const cid = me?.active?.companyId;
  const admin = !!me?.roles.includes("admin");
  const [n, setN] = useState<{ notis: string | null; mula: boolean }>({ notis: null, mula: false });
  const path = usePathname();
  useEffect(() => {
    let batal = false;
    (async () => {
      const sb = getSupabase();
      const [p, c] = await Promise.all([
        sb.from("platform_settings").select("value").eq("key", "maintenance_notice").maybeSingle(),
        admin && cid ? sb.from("companies").select("onboarding_completed_at").eq("id", cid).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      if (batal) return;
      const v = p.data?.value;
      setN({ notis: typeof v === "string" && v.trim() ? v : null, mula: !!(c.data && !c.data.onboarding_completed_at) });
    })();
    return () => {
      batal = true;
    };
  }, [admin, cid]);
  return (
    <>
      {n.notis && (
        <div role="status" className="bg-warning-soft px-4 py-2 text-center text-[13px] font-semibold text-warning">
          {n.notis}
        </div>
      )}
      {n.mula && !path.startsWith("/mula") && (
        <Link href="/mula" className="block bg-[#E3F1EE] px-4 py-2.5 text-center text-[13px] font-bold text-primary!">
          Persediaan syarikat belum selesai — teruskan
        </Link>
      )}
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <MeProvider>
      <Suspense
        fallback={
          <Screen>
            <Loading />
          </Screen>
        }
      >
        <Guard>{children}</Guard>
      </Suspense>
    </MeProvider>
  );
}
