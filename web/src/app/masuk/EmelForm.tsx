"use client";

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!EMEL_SAH.test(email.trim())) return setError("Sila masukkan alamat e-mel yang sah.");
    if (!password) return setError("Sila masukkan kata laluan.");
    setBusy(true);
    setKeepSignedIn(keep);
    const { error: err } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
    if (err) {
      setBusy(false);
      setError(err.status === 429 ? "Terlalu banyak cubaan. Sila tunggu sebentar dan cuba lagi." : "E-mel atau kata laluan tidak betul.");
      return;
    }
    router.replace(await destinasiSelepasMasuk());
  }

  return (
    <form onSubmit={submit} className="flex grow flex-col gap-4 px-6 pt-7 pb-4" noValidate>
      <label className="flex flex-col gap-2 text-sm font-bold">
        E-mel
        <input
          type="email"
          name="email"
          inputMode="email"
          autoComplete="username"
          placeholder="nama@contoh.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={medanMasuk}
        />
      </label>
      <MedanKataLaluan label="Kata laluan" value={password} onChange={setPassword} autoComplete="current-password" />
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2.5 text-sm font-semibold">
          <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} className="size-5 accent-primary" />
          Kekalkan log masuk
        </label>
        <Link href="/masuk/lupa" className="flex min-h-11 items-center text-sm font-bold">
          Lupa kata laluan?
        </Link>
      </div>
      {error && (
        <span role="alert" className="text-[13px] font-semibold text-danger">
          {error}
        </span>
      )}
      <button
        type="submit"
        disabled={busy}
        className="mt-1 flex h-12 items-center justify-center rounded-button bg-primary text-base font-extrabold text-on-primary hover:bg-primary-hover disabled:opacity-60"
      >
        {busy ? "Log masuk…" : "Log masuk"}
      </button>
      <div className="flex flex-col items-center gap-0.5 rounded-[14px] bg-surface px-4 py-3 text-center text-[13px] leading-normal text-muted">
        <span>Kali pertama log masuk? Sahkan nombor telefon anda dahulu.</span>
        <Link href="/masuk/telefon" className="flex min-h-11 items-center font-bold">
          Log masuk dengan kod WhatsApp
        </Link>
      </div>
    </form>
  );
}
