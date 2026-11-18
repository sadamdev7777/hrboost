"use client";

import { KerangkaAwam, CIRI_DAFTAR } from "@/components/KerangkaAwam";
import { tr, trRalat } from "@/lib/i18n";
import { Langkah } from "@/components/LangkahDaftar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getSupabase, setKeepSignedIn } from "@/lib/supabase";
import { bacaPendaftaranMentah, padamPendaftaran, type Pendaftaran } from "@/lib/daftar";
import { IconBack } from "@/components/icons";

const noSub = () => () => {};

// Ralat pautan e-mel daripada Supabase (cth. #error_code=otp_expired apabila pautan sudah digunakan atau
// digantikan oleh e-mel yang lebih baharu). Dibaca sekali, kemudian dibuang daripada URL.
let ralatPautan: string | null = null;
function bacaRalatPautan(): string {
  if (ralatPautan === null) {
    try {
      const h = new URLSearchParams(window.location.hash.slice(1));
      const q = new URLSearchParams(window.location.search);
      ralatPautan = h.get("error_code") ?? h.get("error") ?? q.get("error_code") ?? q.get("error") ?? "";
      if (ralatPautan) window.history.replaceState(null, "", window.location.pathname);
    } catch {
      ralatPautan = "";
    }
  }
  return ralatPautan;
}
type Daftar = { company: string; size: string; name: string; phone: string; pelan?: "percubaan" | "tahunan" };

/**
 * Langkah 2 pendaftaran syarikat: semak e-mel.
 * - Sebelum pengesahan: arahan "buka pautan dalam e-mel" + hantar semula.
 * - Selepas pautan dibuka (sesi wujud, e-mel disahkan): cipta syarikat daripada maklumat
 *   pendaftaran dalam metadata pengguna, kemudian ke persediaan syarikat (/mula), atau terus ke
 *   halaman bayaran bagi pelan "Langgan terus" (/pengurusan/langganan?bayar=1).
 */
export default function SahkanSyarikatPage() {
  const router = useRouter();
  const mentah = useSyncExternalStore(noSub, bacaPendaftaranMentah, () => null);
  const p: Pendaftaran | null = mentah ? (JSON.parse(mentah) as Pendaftaran) : null;
  const [keadaan, setKeadaan] = useState<"semak" | "mencipta" | "ralat">("semak");
  const [ralat, setRalat] = useState<string | null>(null);
  const [baki, setBaki] = useState(60);
  const [dihantar, setDihantar] = useState(false);
  const pautanTamat = useSyncExternalStore(noSub, bacaRalatPautan, () => "") !== "";
  const [emelBaru, setEmelBaru] = useState("");
  const emel = (emelBaru || p?.email || "").trim().toLowerCase();
  // Pautan tamat: boleh terus minta pautan baharu (tiada tunggu 60 saat sehingga dihantar sekali)
  const [sudahCuba, setSudahCuba] = useState(false);
  const tunggu = pautanTamat && !sudahCuba ? 0 : baki;
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
      router.replace(d.pelan === "tahunan" ? "/pengurusan/langganan?bayar=1" : "/mula");
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
    if (!emel || tunggu > 0) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emel)) return setRalat(tr("Sila masukkan alamat e-mel yang sah."));
    setRalat(null);
    setSudahCuba(true);
    const { error } = await getSupabase().auth.resend({ type: "signup", email: emel, options: { emailRedirectTo: `${window.location.origin}/daftar/sahkan` } });
    if (error) setRalat(error.status === 429 ? tr("Terlalu banyak cubaan. Sila tunggu sebentar.") : tr("E-mel tidak dapat dihantar. Sila cuba lagi."));
    else setDihantar(true);
    setBaki(60);
  }

  return (
    <KerangkaAwam tajuk={tr("Hampir siap.")} kecil={tr("Sahkan e-mel anda untuk mengaktifkan akaun syarikat.")} ciri={CIRI_DAFTAR()}>
    <div className="flex w-full flex-col bg-page text-ink lg:rounded-[20px] lg:bg-surface lg:py-4 lg:shadow-sm">
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
          ) : pautanTamat ? (
            <>
              <h1 className="m-0 text-[22px] font-extrabold">{tr("Pautan pengesahan telah tamat atau digunakan")}</h1>
              <span className="text-sm leading-normal text-subtle">
                {tr("Setiap pautan hanya sah sekali dan digantikan apabila e-mel baharu dihantar. Gunakan e-mel pengesahan yang terbaharu, atau hantar pautan baharu di bawah.")}
              </span>
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
        {keadaan === "semak" && pautanTamat && (
          <div className="flex flex-col gap-3 rounded-card bg-surface px-5 py-4">
            <label className="flex flex-col gap-1.5 text-sm font-bold">
              {tr("E-mel")}
              <input
                className="h-12 rounded-field border border-line bg-surface px-4 text-base font-semibold text-ink outline-none focus:border-primary"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={emelBaru || p?.email || ""}
                onChange={(e) => setEmelBaru(e.target.value)}
                placeholder={tr("nama@syarikat.com")}
              />
            </label>
            <button type="button" onClick={hantarSemula} disabled={tunggu > 0 || !emel} className="h-12 rounded-button bg-primary text-base font-extrabold text-white disabled:opacity-60">
              {tunggu > 0 ? tr("Hantar pautan baharu ({0})", tunggu) : tr("Hantar pautan baharu")}
            </button>
          </div>
        )}
        {keadaan === "semak" && !pautanTamat && (
          <ol className="m-0 flex flex-col gap-2 rounded-card bg-surface px-5 py-4 text-sm leading-normal">
            <li>{tr("Buka peti masuk e-mel (semak juga folder Spam / Promosi).")}</li>
            <li>{tr("Tekan butang \"Sahkan e-mel\" dalam e-mel daripada HRBoost.")}</li>
            <li>{p?.pelan === "tahunan" ? tr("Anda akan dibawa terus ke halaman bayaran langganan RM499 setahun.") : tr("Anda akan dibawa terus ke persediaan syarikat.")}</li>
            <li>{tr("Jika anda menerima lebih daripada satu e-mel, gunakan yang terbaharu sahaja.")}</li>
          </ol>
        )}
        {ralat && (
          <span role="alert" className="rounded-[12px] bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger">
            {ralat}
          </span>
        )}
        {keadaan === "ralat" && (
          <button type="button" onClick={() => window.location.reload()} className="h-12 rounded-button bg-primary text-base font-extrabold text-white">
            {tr("Cuba lagi")}
          </button>
        )}
        {dihantar && <span className="text-sm font-semibold text-success">{tr("Pautan baharu telah dihantar.")}</span>}
        {keadaan !== "mencipta" && !pautanTamat && p?.email && (
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
    </KerangkaAwam>
  );
}
