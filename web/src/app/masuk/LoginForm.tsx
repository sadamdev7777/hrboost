"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { telefonPenuh } from "@/lib/format";

export const PHONE_KEY = "hrb_telefon_otp";

export function LoginForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const full = telefonPenuh(phone);
    if (!full) {
      setError(tr("Sila masukkan nombor telefon bimbit Malaysia yang sah, contohnya 12 345 6789."));
      return;
    }
    setBusy(true);
    const { error: err } = await getSupabase().auth.signInWithOtp({ phone: full, options: { channel: "sms" } });
    setBusy(false);
    if (err) {
      setError(
        err.status === 429
          ? tr("Terlalu banyak cubaan. Sila tunggu sebentar sebelum meminta kod baharu.")
          : tr("Kod tidak dapat dihantar. Sila cuba lagi."),
      );
      return;
    }
    try {
      sessionStorage.setItem(PHONE_KEY, full);
    } catch {
      /* abaikan */
    }
    router.push("/masuk/kod");
  }

  return (
    <form onSubmit={submit} className="flex grow flex-col gap-4 px-6 pt-7 pb-4 lg:grow-0" noValidate>
      <label className="flex flex-col gap-2 text-sm leading-[normal] font-bold">
        {tr("No. telefon WhatsApp")}<div className="flex gap-2">
          <span className="box-content flex h-12 items-center rounded-field border border-line bg-surface px-[14px] text-base font-bold">
            +60
          </span>
          <input
            type="tel"
            name="phone"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="12 345 6789"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-invalid={error ? true : undefined}
            className="h-12 min-w-0 grow rounded-field border-[1.5px] border-primary bg-surface px-4 text-lg font-semibold tracking-[0.02em] text-ink outline-none"
          />
        </div>
      </label>
      <span className="text-[13px] leading-normal text-muted">
        {tr("Kami akan menghantar kod 6 digit ke WhatsApp anda untuk mengesahkan nombor telefon. Selepas itu anda akan menetapkan e-mel dan kata laluan.")}</span>
      {error && (
        <span role="alert" className="text-[13px] font-semibold text-danger">
          {error}
        </span>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-2 flex h-12 items-center justify-center rounded-button bg-primary text-base font-extrabold text-on-primary hover:bg-primary-hover disabled:opacity-60"
      >
        {busy ? tr("Menghantar…") : tr("Hantar kod")}
      </button>
      <Link href="/masuk" className="flex h-touch items-center justify-center text-sm font-bold">
        {tr("Log masuk dengan e-mel & kata laluan")}</Link>
    </form>
  );
}
