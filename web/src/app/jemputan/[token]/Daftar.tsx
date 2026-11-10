"use client";

import { tr, trRalat } from "@/lib/i18n";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getSupabase, setKeepSignedIn } from "@/lib/supabase";
import { mesejRalat, useData } from "@/lib/useData";
import { tarikh } from "@/lib/format";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { MedanKataLaluan, medanMasuk } from "../../masuk/MedanKataLaluan";


type Preview = {
  ok: boolean;
  error?: string;
  accepted?: boolean;
  name?: string;
  phone?: string;
  company_code?: string;
  company_name?: string;
  position?: string | null;
  department?: string | null;
  head?: string | null;
  join_date?: string;
  status?: string;
  probation_months?: number | null;
  expires_at?: string;
  days_left?: number;
  attempts_left?: number;
};

// Rujukan reka bentuk: design/Daftar.dc.html
// Pengaktifan dengan e-mel: (1) sahkan 4 digit akhir kad pengenalan → (2) e-mel + kata laluan →
// (3) pautan pengesahan dalam e-mel → kembali ke halaman ini → akaun diikat (accept_invite_email).
type Langkah = "ic" | "akaun" | "log-masuk" | "semak";

export function Daftar() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const preview = useData(async () => {
    const { data, error } = await getSupabase().rpc("invite_preview", { p_token: token });
    if (error) throw new Error(error.message);
    return data as unknown as Preview;
  }, [token]);
  const [langkah, setLangkah] = useState<Langkah>("ic");
  const [ic4, setIc4] = useState("");
  const [consent, setConsent] = useState(true);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adaSesi, setAdaSesi] = useState(false);
  const [dihantar, setDihantar] = useState(false);
  const p = preview.data;
  const pautan = () => `${window.location.origin}/jemputan/${token}`;

  const aktifkan = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    setError(null);
    const { data, error: err } = await getSupabase().rpc("accept_invite_email", { p_token: token });
    setBusy(false);
    if (err) {
      setError(mesejRalat(err.message, err.code));
      return false;
    }
    const r = data as unknown as { ok: boolean; error?: string };
    if (!r.ok) {
      setError(r.error ? trRalat(r.error) : tr("Tidak berjaya."));
      return false;
    }
    setKeepSignedIn(true);
    router.replace("/orientasi");
    return true;
  }, [token, router]);

  // Kembali daripada pautan pengesahan e-mel (atau sudah log masuk): terus aktifkan
  useEffect(() => {
    const sb = getSupabase();
    let dah = false;
    async function cuba() {
      const { data } = await sb.auth.getSession();
      if (dah || !data.session?.user.email_confirmed_at) return;
      dah = true;
      setAdaSesi(true);
      const { data: r } = await sb.rpc("accept_invite_email", { p_token: token });
      const x = r as unknown as { ok: boolean } | null;
      if (x?.ok) router.replace("/orientasi");
    }
    void cuba();
    const { data: sub } = sb.auth.onAuthStateChange(() => void cuba());
    return () => sub.subscription.unsubscribe();
  }, [token, router]);

  async function semakIc(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{4}$/.test(ic4)) return setError(tr("Sila masukkan 4 digit terakhir no. kad pengenalan anda."));
    if (!consent) return setError(tr("Sila tandakan pengesahan notis privasi untuk meneruskan."));
    setBusy(true);
    const { data, error: err } = await getSupabase().rpc("invite_check_ic", { p_token: token, p_ic_last4: ic4 });
    setBusy(false);
    if (err) return setError(mesejRalat(err.message, err.code));
    const r = data as unknown as { ok: boolean; error?: string; attempts_left?: number; email?: string | null };
    if (!r.ok) {
      setError(r.attempts_left !== undefined ? tr("{0}. Baki cubaan: {1}.", trRalat(r.error ?? ""), r.attempts_left) : r.error ? trRalat(r.error) : tr("Tidak berjaya."));
      preview.reload();
      return;
    }
    if (adaSesi) {
      await aktifkan();
      return;
    }
    if (r.email) setEmail(r.email);
    setLangkah("akaun");
  }

  async function daftar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const em = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return setError(tr("Sila masukkan alamat e-mel yang sah."));
    if (pw.length < 8) return setError(tr("Kata laluan mesti sekurang-kurangnya 8 aksara."));
    setBusy(true);
    const sb = getSupabase();
    const { data, error: err } = await sb.auth.signUp({ email: em, password: pw, options: { emailRedirectTo: pautan() } });
    setBusy(false);
    if (err && !/already|registered|exists/i.test(err.message)) {
      return setError(err.status === 429 ? tr("Terlalu banyak cubaan. Sila tunggu sebentar.") : tr("Pendaftaran tidak berjaya. Sila cuba lagi."));
    }
    // E-mel telah mempunyai akaun: log masuk dengan kata laluan sedia ada
    if (err || (data.user && (data.user.identities ?? []).length === 0)) {
      setLangkah("log-masuk");
      setError(tr("E-mel ini sudah mempunyai akaun HRBoost. Masukkan kata laluan akaun tersebut."));
      return;
    }
    if (data.session) {
      await aktifkan();
      return;
    }
    setLangkah("semak");
  }

  async function logMasuk(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await getSupabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pw });
    setBusy(false);
    if (err) {
      if (/not confirmed/i.test(err.message)) {
        setLangkah("semak");
        return;
      }
      return setError(tr("E-mel atau kata laluan tidak betul."));
    }
    await aktifkan();
  }

  async function hantarSemula() {
    const { error: err } = await getSupabase().auth.resend({ type: "signup", email: email.trim().toLowerCase(), options: { emailRedirectTo: pautan() } });
    if (err) setError(err.status === 429 ? tr("Terlalu banyak cubaan. Sila tunggu sebentar.") : tr("E-mel tidak dapat dihantar. Sila cuba lagi."));
    else setDihantar(true);
  }

  if (preview.loading && !p) {
    return (
      <Screen lebar="sempit">
        <Loading />
      </Screen>
    );
  }

  if (!p?.ok) {
    return (
      <Screen lebar="sempit">
        <div className="flex grow flex-col justify-center gap-4 p-6">
          <h1 className="m-0 text-2xl font-extrabold">{p?.accepted ? tr("Akaun sudah aktif") : tr("Pautan tidak sah")}</h1>
          <p className="m-0 text-sm leading-normal text-subtle">{p?.error ? trRalat(p.error) : preview.error}</p>
          <Link href="/masuk" className="flex h-12 items-center justify-center rounded-button bg-primary text-base font-extrabold text-white!">
            {tr("Log masuk")}</Link>
        </div>
      </Screen>
    );
  }

  const syarikat = (p.company_name ?? "").replace(/\s+SDN\.?\s*BHD\.?$/i, "");
  const status =
    p.status === "probation" && p.probation_months ? tr("Percubaan {0} bulan", p.probation_months) : p.status === "probation" ? tr("Percubaan") : tr("Tetap");
  const hariLagi = p.days_left ?? 7;
  const butang = "flex h-12 items-center justify-center rounded-button bg-primary text-base font-extrabold text-white hover:bg-primary-hover disabled:opacity-60";

  return (
    <Screen lebar="sempit">
      <div className="flex grow flex-col gap-[18px] px-6 pt-12 pb-8">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold tracking-[0.04em] text-primary">{tr("JEMPUTAN DARIPADA HR")}</span>
          <h1 className="m-0 text-[22px] leading-[1.2] font-extrabold">
            {tr("Selamat datang ke {0}, {1}", p.company_code, p.name)}</h1>
          <span className="text-xs font-bold text-muted">
            {tr("Langkah {0} daripada 2 · {1}", langkah === "ic" ? 1 : 2, langkah === "ic" ? tr("Sahkan identiti") : tr("Akaun log masuk"))}</span>
        </div>

        {langkah === "ic" && (
          <form onSubmit={semakIc} className="flex flex-col gap-[18px]" noValidate>
            <div className="flex flex-col gap-3 rounded-[18px] bg-surface p-4">
              <div className="grid grid-cols-2 gap-3">
                <Info label={tr("Syarikat")} value={syarikat} />
                <Info label={tr("Jawatan")} value={p.position ?? "—"} />
                <Info label={tr("Jabatan")} value={p.department ?? "—"} />
                <Info label={tr("Ketua")} value={p.head ?? "—"} />
                <Info label={tr("Tarikh mula")} value={p.join_date ? `${tarikh(p.join_date)} ${p.join_date.slice(0, 4)}` : "—"} />
                <Info label={tr("Status")} value={status} />
              </div>
              <span className="text-xs text-muted">{tr("Terdapat kesilapan? Maklumkan kepada HR sebelum meneruskan.")}</span>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-bold">
              {tr("Sahkan identiti: 4 digit terakhir no. kad pengenalan")}
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                placeholder="••••"
                value={ic4}
                onChange={(e) => setIc4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="h-12 rounded-[14px] border-[1.5px] border-primary bg-surface px-4 text-base font-semibold tracking-[0.3em] text-ink"
              />
            </label>
            <label className="flex items-start gap-2.5 text-[13px] leading-normal text-[#33504B]">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-px size-5 shrink-0 accent-primary" />
              <span>
                {tr("Saya faham bahawa maklumat peribadi saya disimpan untuk urusan HR dan gaji sahaja, mengikut")}{" "}
                <Link href="/privasi" className="font-bold">
                  {tr("notis privasi")}</Link>{" "}
                {tr("syarikat.")}
              </span>
            </label>
            {error && <ErrorBox message={error} />}
            <button type="submit" disabled={busy} className={butang}>
              {busy ? tr("Memproses…") : adaSesi ? tr("Aktifkan akaun") : tr("Seterusnya")}
            </button>
            <span className="text-center text-xs text-muted">{tr("Pautan ini akan tamat tempoh dalam {0} hari.", hariLagi)}</span>
          </form>
        )}

        {(langkah === "akaun" || langkah === "log-masuk") && (
          <form onSubmit={langkah === "akaun" ? daftar : logMasuk} className="flex flex-col gap-4" noValidate>
            <span className="text-sm leading-normal text-subtle">
              {langkah === "akaun"
                ? tr("Anda akan log masuk ke HRBoost dengan e-mel dan kata laluan ini. Kami akan menghantar pautan pengesahan ke e-mel anda.")
                : tr("Log masuk dengan akaun sedia ada untuk menyambung pekerjaan baharu ini.")}</span>
            <label className="flex flex-col gap-2 text-sm font-bold">
              {tr("E-mel")}
              <input type="email" inputMode="email" autoComplete="email" placeholder={tr("nama@contoh.com")} value={email} onChange={(e) => setEmail(e.target.value)} className={medanMasuk} />
            </label>
            <MedanKataLaluan
              label={tr("Kata laluan")}
              value={pw}
              onChange={setPw}
              autoComplete={langkah === "akaun" ? "new-password" : "current-password"}
              bantuan={langkah === "akaun" ? tr("Sekurang-kurangnya 8 aksara.") : undefined}
            />
            {error && <ErrorBox message={error} />}
            <button type="submit" disabled={busy} className={butang}>
              {busy ? tr("Memproses…") : langkah === "akaun" ? tr("Cipta akaun & sahkan e-mel") : tr("Log masuk & aktifkan")}
            </button>
            {langkah === "log-masuk" && (
              <Link href="/masuk/lupa" className="flex min-h-11 items-center justify-center text-sm font-bold">
                {tr("Lupa kata laluan?")}</Link>
            )}
          </form>
        )}

        {langkah === "semak" && (
          <div className="flex flex-col gap-4">
            <h2 className="m-0 text-lg font-extrabold">{tr("Semak e-mel anda")}</h2>
            <span className="text-sm leading-normal text-subtle">
              {tr("Kami telah menghantar pautan pengesahan ke")}{" "}<b className="text-ink">{email.trim().toLowerCase()}</b>
              {tr(". Buka e-mel tersebut dan tekan pautan — akaun anda akan terus diaktifkan.")}</span>
            <span className="text-xs text-muted">{tr("Tidak menerima e-mel? Semak folder Spam / Promosi.")}</span>
            {error && <ErrorBox message={error} />}
            <button type="button" onClick={hantarSemula} disabled={dihantar} className="min-h-11 self-start text-sm font-bold text-primary disabled:text-success">
              {dihantar ? tr("Pautan baharu telah dihantar.") : tr("Hantar semula pautan")}</button>
          </div>
        )}
      </div>
    </Screen>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted">{label}</span>
      <b className="text-sm font-bold">{value}</b>
    </div>
  );
}
