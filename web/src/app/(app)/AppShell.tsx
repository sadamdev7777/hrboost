"use client";

import { getLangganan, type Langganan } from "@/lib/langganan";
import { tr } from "@/lib/i18n";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { MeProvider, useMeContext } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { paparTelefon } from "@/lib/format";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { MenuSisi } from "@/components/TabNav";
import { CariPantas } from "@/components/CariPantas";
import { CadanganPasang } from "@/components/CadanganPasang";
import { CadanganNotifikasi } from "@/components/NotifikasiTelefon";
import { logKeluar } from "@/lib/push";
import { useMod } from "@/lib/mod";

function Guard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { state, reload } = useMeContext();
  const path = usePathname();
  const GATE = "/akaun/kata-laluan";
  const perluKataLaluan = state.status === "ready" && state.me.needsPassword && path !== GATE;

  useEffect(() => {
    if (state.status !== "signed-out") return;
    // Halaman mungkin dipulihkan dengan keadaan lama "log keluar" selepas log masuk semula: semak sesi sebenar dahulu
    let batal = false;
    void getSupabase()
      .auth.getSession()
      .then(({ data }) => {
        if (batal) return;
        if (data.session) reload();
        else router.replace(path && path !== "/utama" ? `/masuk?seterusnya=${encodeURIComponent(path)}` : "/masuk");
      });
    return () => {
      batal = true;
    };
  }, [state.status, router, path, reload]);

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
          <ErrorBox message={tr("Maklumat akaun tidak dapat dimuatkan. {0}", state.message)} />
        </div>
      </Screen>
    );
  }

  if (state.status === "no-person") {
    return (
      <Screen>
        <div className="flex grow flex-col justify-center gap-4 p-6">
          <h1 className="m-0 text-2xl font-extrabold">{tr("Akaun belum diaktifkan")}</h1>
          <p className="m-0 text-sm leading-normal text-subtle">
            {tr("Nombor {0} belum dipautkan kepada mana-mana pekerja. Buka pautan jemputan daripada HR, atau hubungi HR syarikat anda.", state.phone ? paparTelefon(state.phone) : "ini")}</p>
          <button
            type="button"
            onClick={() => void logKeluar()}
            className="h-12 rounded-[14px] border border-line bg-surface text-sm font-bold text-danger"
          >
            {tr("Log keluar")}</button>
        </div>
      </Screen>
    );
  }

  return (
    <>
      <div className="lg:flex">
        <MenuSisi />
        <CariPantas />
        <CadanganPasang />
        <CadanganNotifikasi />
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
  // Banner persediaan boleh disembunyikan selama 7 hari (per pelayar)
  const sorokDisimpan = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return Number(localStorage.getItem("hrb_sorok_mula") ?? 0) > Date.now();
      } catch {
        return false;
      }
    },
    () => false,
  );
  const [sorokBaru, setSorok] = useState(false);
  const sorok = sorokDisimpan || sorokBaru;
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
      <JalurLangganan />
      {n.notis && (
        <div role="status" className="bg-warning-soft px-4 py-2 text-center text-[13px] font-semibold text-warning">
          {n.notis}
        </div>
      )}
      {n.mula && !sorok && !path.startsWith("/mula") && (
        <div className="flex items-center bg-[#E3F1EE]">
          <Link href="/mula" className="flex min-h-9 grow items-center justify-center px-3 py-1.5 text-center text-xs font-bold text-primary!">
            {tr("Persediaan syarikat belum selesai — teruskan")}
          </Link>
          <button
            type="button"
            aria-label={tr("Sembunyikan selama 7 hari")}
            onClick={() => {
              try {
                localStorage.setItem("hrb_sorok_mula", String(Date.now() + 7 * 864e5));
              } catch {}
              setSorok(true);
            }}
            className="flex size-9 shrink-0 items-center justify-center text-lg text-primary"
          >
            ×
          </button>
        </div>
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

/** Jalur langganan: percubaan / tangguh untuk yang boleh membayar; baca sahaja untuk semua. */
function JalurLangganan() {
  const { state } = useMeContext();
  const me = state.status === "ready" ? state.me : null;
  const cid = me?.active?.companyId;
  const path = usePathname();
  const [s, setS] = useState<Langganan | null>(null);
  useEffect(() => {
    let batal = false;
    if (cid) getLangganan(cid).then((x) => !batal && setS(x)).catch(() => {});
    return () => {
      batal = true;
    };
  }, [cid, path]);
  if (!s || s.status === "active" || s.status === "exempt" || path.startsWith("/pengurusan/langganan") || path.startsWith("/langganan")) return null;
  if (s.status === "trial" && !s.can_pay) return null;
  const teks =
    s.status === "trial"
      ? tr("Percubaan percuma: {0} hari lagi — langgan RM{1} setahun", Math.max(0, s.days_left ?? 0), (s.price_sen / 100).toFixed(0))
      : s.status === "grace"
        ? tr("Langganan telah tamat — bayar segera untuk mengelakkan mod baca sahaja")
        : s.can_pay
          ? tr("Langganan tamat: sistem dalam mod baca sahaja — perbaharui sekarang")
          : tr("Langganan syarikat telah tamat. Sila hubungi Pentadbir syarikat.");
  const kelas = s.status === "trial" ? "bg-[#E3F1EE] text-primary!" : "bg-danger text-white!";
  return s.can_pay ? (
    <Link href="/pengurusan/langganan" className={`flex min-h-9 items-center justify-center px-3 py-1.5 text-center text-xs font-bold ${kelas}`}>
      {teks}
    </Link>
  ) : (
    <div role="status" className={`flex min-h-9 items-center justify-center px-3 py-1.5 text-center text-xs font-bold ${kelas}`}>
      {teks}
    </div>
  );
}
