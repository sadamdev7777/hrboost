"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useState } from "react";
import { BackHeader } from "@/components/ui";
import { EMEL_SAH } from "@/lib/masuk";
import { getSupabase } from "@/lib/supabase";
import { medanMasuk } from "../MedanKataLaluan";

export default function LupaPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dihantar, setDihantar] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!EMEL_SAH.test(email.trim())) return setError(tr("Sila masukkan alamat e-mel yang sah."));
    setBusy(true);
    // Supabase Auth menghantar pautan (tidak mendedahkan sama ada e-mel berdaftar)
    const { error: err } = await getSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/masuk/set-semula`,
    });
    setBusy(false);
    if (err) return setError(err.status === 429 ? tr("Terlalu banyak cubaan. Sila tunggu sebentar dan cuba lagi.") : tr("Permintaan tidak dapat dihantar. Sila cuba lagi."));
    setDihantar(true);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-page text-ink">
      <BackHeader href="/masuk" />
      {dihantar ? (
        <div className="flex flex-col gap-3 px-6 py-4">
          <h1 className="m-0 text-xl font-extrabold">{tr("Semak e-mel anda")}</h1>
          <p className="m-0 text-sm leading-normal text-subtle">
            {tr("Jika")}{" "}<b className="text-ink">{email.trim()}</b> {" "}{tr("berdaftar dengan HRBoost, pautan untuk menetapkan semula kata laluan telah dihantar. Pautan sah selama 1 jam. Semak juga folder spam.")}</p>
          <Link href="/masuk" className="mt-2 flex h-12 items-center justify-center rounded-button bg-primary text-base font-extrabold text-on-primary!">
            {tr("Kembali ke log masuk")}</Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="flex grow flex-col gap-4 px-6 py-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="m-0 text-xl font-extrabold">{tr("Lupa kata laluan")}</h1>
            <span className="text-sm leading-normal text-subtle">
              {tr("Masukkan e-mel akaun anda. Kami akan menghantar pautan untuk menetapkan kata laluan baharu.")}</span>
          </div>
          <label className="flex flex-col gap-2 text-sm font-bold">
            {tr("E-mel")}
            <input type="email" inputMode="email" autoComplete="username" placeholder={tr("nama@contoh.com")} value={email} onChange={(e) => setEmail(e.target.value)} className={medanMasuk} />
          </label>
          {error && (
            <span role="alert" className="text-[13px] font-semibold text-danger">
              {error}
            </span>
          )}
          <button
            type="submit"
            disabled={busy}
            className="flex h-12 items-center justify-center rounded-button bg-primary text-base font-extrabold text-on-primary hover:bg-primary-hover disabled:opacity-60"
          >
            {busy ? tr("Menghantar…") : tr("Hantar pautan")}
          </button>
        </form>
      )}
    </main>
  );
}
