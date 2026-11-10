"use client";

import { tr, trRalat } from "@/lib/i18n";
import { Langkah } from "@/components/LangkahDaftar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getSupabase, setKeepSignedIn } from "@/lib/supabase";
import { bacaPendaftaranMentah, padamPendaftaran, type Pendaftaran } from "@/lib/daftar";
import { IconBack } from "@/components/icons";

const noSub = () => () => {};
type Daftar = { company: string; size: string; name: string; phone: string };

/**
 * Langkah 2 pendaftaran syarikat: semak e-mel.
 * - Sebelum pengesahan: arahan "buka pautan dalam e-mel" + hantar semula.
 * - Selepas pautan dibuka (sesi wujud, e-mel disahkan): cipta syarikat daripada maklumat
 *   pendaftaran dalam metadata pengguna, kemudian ke persediaan syarikat (/mula).
 */
export default function SahkanSyarikatPage() {
  const router = useRouter();
  const mentah = useSyncExternalStore(noSub, bacaPendaftaranMentah, () => null);
  const p: Pendaftaran | null = mentah ? (JSON.parse(mentah) as Pendaftaran) : null;
  const [keadaan, setKeadaan] = useState<"semak" | "mencipta" | "ralat">("semak");
  const [ralat, setRalat] = useState<string | null>(null);
  const [baki, setBaki] = useState(60);
  const [dihantar, setDihantar] = useState(false);
  const sedang = useRef(false);

  // Pautan pengesahan: Supabase memasang sesi daripada URL; cipta syarikat sekali sahaja
  useEffect(() => {
    const sb = getSupabase();
    async function cuba() {
      if (sedang.current) return;
      const { data } = await sb.auth.getSession();
      const u = data.session?.user;
      if (!u?.email_confirmed_at) return;
      const d = (u.user_metadata as { daftar?: Daftar } | undefined)?.daftar;
      if (!d) {
        router.replace("/utama");
        return;
      }
      sedang.current = true;
      setKeadaan("mencipta");
      setKeepSignedIn(true);
      const { error } = await sb.rpc("register_company_email", { p_company_name: d.company, p_size: d.size, p_full_name: d.name, p_phone: d.phone || undefined });
      if (error) {
        sedang.current = false;
        setKeadaan("ralat");
        setRalat(trRalat(error.message));
        return;
      }
      await sb.auth.updateUser({ data: { daftar: null } });
      padamPendaftaran();
      router.replace("/mula");
    }
    void cuba();
    const { data: sub } = sb.auth.onAuthStateChange(() => void cuba());
    return () => sub.subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (baki <= 0) return;
    const t = setTimeout(() => setBaki((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [baki]);

  async function hantarSemula() {
    if (!p?.email || baki > 0) return;
    const { error } = await getSupabase().auth.resend({ type: "signup", email: p.email, options: { emailRedirectTo: `${window.location.origin}/daftar/sahkan` } });
    if (error) setRalat(error.status === 429 ? tr("Terlalu banyak cubaan. Sila tunggu sebentar.") : tr("E-mel tidak dapat dihantar. Sila cuba lagi."));
    else setDihantar(true);
    setBaki(60);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-page text-ink">
      <header className="flex items-center px-3 pt-3 pb-1">
        <Link href="/daftar" aria-label={tr("Kembali")} className="flex size-11 items-center justify-center rounded-full text-ink!">
          <IconBack />
        </Link>
      </header>
      <main className="flex grow flex-col gap-5 px-6 pb-8">
        <div className="flex flex-col gap-2">
          <Langkah n={2} />
          {keadaan === "mencipta" ? (
            <>
              <h1 className="m-0 text-[22px] font-extrabold">{tr("E-mel disahkan")}</h1>
              <span className="text-sm text-subtle">{tr("Sedang mencipta syarikat anda…")}</span>
            </>
          ) : (
            <>
              <h1 className="m-0 text-[22px] font-extrabold">{tr("Semak e-mel anda")}</h1>
              <span className="text-sm leading-normal text-subtle">
                {tr("Kami telah menghantar pautan pengesahan ke")}{" "}<b className="text-ink">{p?.email ?? tr("e-mel anda")}</b>
                {tr(". Buka e-mel tersebut dan tekan pautan untuk mengesahkan akaun dan mencipta {0}.", p?.company ?? tr("syarikat anda"))}</span>
            </>
          )}
        </div>
        {keadaan === "semak" && (
          <ol className="m-0 flex flex-col gap-2 rounded-card bg-surface px-5 py-4 text-sm leading-normal">
            <li>{tr("Buka peti masuk e-mel (semak juga folder Spam / Promosi).")}</li>
            <li>{tr("Tekan butang \"Sahkan e-mel\" dalam e-mel daripada HRBoost.")}</li>
            <li>{tr("Anda akan dibawa terus ke persediaan syarikat.")}</li>
          </ol>
        )}
        {ralat && (
          <span role="alert" className="rounded-[12px] bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger">
            {ralat}
          </span>
        )}
        {dihantar && <span className="text-sm font-semibold text-success">{tr("Pautan baharu telah dihantar.")}</span>}
        {keadaan !== "mencipta" && p?.email && (
          <span className="text-sm text-muted">
            {tr("Tidak menerima e-mel?")}{" "}
            <button type="button" onClick={hantarSemula} disabled={baki > 0} className="min-h-11 font-bold text-primary disabled:text-muted">
              {baki > 0 ? tr("Hantar semula ({0})", baki) : tr("Hantar semula")}
            </button>{" "}
            · <Link href="/daftar">{tr("Tukar e-mel")}</Link>
          </span>
        )}
        <span className="grow" />
        <Link href="/masuk" className="text-center text-sm font-bold">
          {tr("Sudah mengesahkan? Log masuk")}</Link>
      </main>
    </div>
  );
}
