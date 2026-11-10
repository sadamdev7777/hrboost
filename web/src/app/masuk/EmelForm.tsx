"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabase, setKeepSignedIn } from "@/lib/supabase";
import { EMEL_SAH, destinasiSelepasMasuk } from "@/lib/masuk";
import { MedanKataLaluan, medanMasuk } from "./MedanKataLaluan";

export function EmelForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keep, setKeep] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [belumSah, setBelumSah] = useState(false);
  const [dihantar, setDihantar] = useState(false);

  async function hantarPengesahan() {
    const { error: err } = await getSupabase().auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/daftar/sahkan` } });
    if (err) setError(err.status === 429 ? tr("Terlalu banyak cubaan. Sila tunggu sebentar dan cuba lagi.") : tr("E-mel tidak dapat dihantar. Sila cuba lagi."));
    else setDihantar(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!EMEL_SAH.test(email.trim())) return setError(tr("Sila masukkan alamat e-mel yang sah."));
    if (!password) return setError(tr("Sila masukkan kata laluan."));
    setBusy(true);
    setKeepSignedIn(keep);
    const { error: err } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
    if (err) {
      setBusy(false);
      if (/not confirmed/i.test(err.message)) {
        setBelumSah(true);
        setError(tr("E-mel anda belum disahkan. Buka pautan pengesahan dalam e-mel anda."));
        return;
      }
      setError(err.status === 429 ? tr("Terlalu banyak cubaan. Sila tunggu sebentar dan cuba lagi.") : tr("E-mel atau kata laluan tidak betul."));
      return;
    }
    router.replace(await destinasiSelepasMasuk());
  }

  return (
    <form onSubmit={submit} className="flex grow flex-col gap-4 px-6 pt-7 pb-4 lg:grow-0" noValidate>
      <label className="flex flex-col gap-2 text-sm font-bold">
        {tr("E-mel")}
        <input
          type="email"
          name="email"
          inputMode="email"
          autoComplete="username"
          placeholder={tr("nama@contoh.com")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={medanMasuk}
        />
      </label>
      <MedanKataLaluan label={tr("Kata laluan")} value={password} onChange={setPassword} autoComplete="current-password" />
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2.5 text-sm font-semibold">
          <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} className="size-5 accent-primary" />
          {tr("Kekalkan log masuk")}</label>
        <Link href="/masuk/lupa" className="flex min-h-11 items-center text-sm font-bold">
          {tr("Lupa kata laluan?")}</Link>
      </div>
      {error && (
        <span role="alert" className="text-[13px] font-semibold text-danger">
          {error}
        </span>
      )}
      {belumSah && (
        <button type="button" onClick={hantarPengesahan} disabled={dihantar} className="min-h-11 self-start text-sm font-bold text-primary disabled:text-success">
          {dihantar ? tr("Pautan pengesahan telah dihantar semula.") : tr("Hantar semula pautan pengesahan")}</button>
      )}
      <button
        type="submit"
        disabled={busy}
        className="mt-1 flex h-12 items-center justify-center rounded-button bg-primary text-base font-extrabold text-on-primary hover:bg-primary-hover disabled:opacity-60"
      >
        {busy ? tr("Log masuk…") : tr("Log masuk")}
      </button>
      <div className="flex flex-col items-center gap-1 rounded-[14px] bg-surface px-4 py-3 text-center text-[13px] leading-normal text-muted">
        <span>{tr("Pekerja baharu? Buka pautan jemputan yang dihantar oleh HR melalui WhatsApp untuk mengaktifkan akaun.")}</span>
        <span>
          {tr("Syarikat baharu?")}{" "}
          <Link href="/daftar" className="font-bold">
            {tr("Daftar percuma")}</Link>
        </span>
      </div>
    </form>
  );
}
