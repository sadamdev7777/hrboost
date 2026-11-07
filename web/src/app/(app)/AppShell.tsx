"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { MeProvider, useMeContext } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { paparTelefon } from "@/lib/format";
import { ErrorBox, Loading, Screen } from "@/components/ui";

function Guard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { state } = useMeContext();

  useEffect(() => {
    if (state.status === "signed-out") router.replace("/masuk");
  }, [state.status, router]);

  if (state.status === "loading" || state.status === "signed-out") {
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
          <p className="m-0 text-[15px] leading-normal text-subtle">
            Nombor {state.phone ? paparTelefon(state.phone) : "ini"} belum dipautkan kepada mana-mana pekerja. Semak
            WhatsApp anda untuk pautan jemputan daripada HR, atau hubungi HR syarikat anda.
          </p>
          <button
            type="button"
            onClick={() => void getSupabase().auth.signOut()}
            className="h-12 rounded-[14px] border border-line bg-surface text-[15px] font-bold text-danger"
          >
            Log keluar
          </button>
        </div>
      </Screen>
    );
  }

  return <>{children}</>;
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <MeProvider>
      <Guard>{children}</Guard>
    </MeProvider>
  );
}
