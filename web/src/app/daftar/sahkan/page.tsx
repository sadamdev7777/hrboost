"use client";

import { tr } from "@/lib/i18n";
import { Langkah } from "@/components/LangkahDaftar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getSupabase, setKeepSignedIn } from "@/lib/supabase";
import { paparTelefon } from "@/lib/format";
import { bacaPendaftaranMentah, padamPendaftaran, type Pendaftaran } from "@/lib/daftar";
import { IconBack } from "@/components/icons";

const noSub = () => () => {};

// Rujukan reka bentuk: design/OTPSyarikat.dc.html
export default function SahkanSyarikatPage() {
  const router = useRouter();
  const mentah = useSyncExternalStore(noSub, bacaPendaftaranMentah, () => null);
  const p: Pendaftaran | null = mentah ? (JSON.parse(mentah) as Pendaftaran) : null;
  const [kod, setKod] = useState("");
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const [baki, setBaki] = useState(60);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mentah === "") router.replace("/daftar");
  }, [mentah, router]);
  useEffect(() => {
    if (baki <= 0) return;
    const t = setTimeout(() => setBaki((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [baki]);

  async function sahkan(token: string) {
    if (!p || token.length !== 6) return;
    setBusy(true);
    setRalat(null);
    setKeepSignedIn(true);
    const sb = getSupabase();
    const { error } = await sb.auth.verifyOtp({ phone: p.phone, token, type: "sms" });
    if (error) {
      setBusy(false);
      setKod("");
      ref.current?.focus();
      return setRalat(tr("Kod tidak sah atau telah tamat tempoh. Sila semak dan cuba lagi."));
    }
    const { error: e2 } = await sb.rpc("register_company", { p_company_name: p.company, p_size: p.size, p_full_name: p.name, p_phone: p.phone, p_email: p.email });
    if (e2) {
      setBusy(false);
      return setRalat(e2.message);
    }
    padamPendaftaran();
    // MeProvider dalam (app) dimuatkan semula semasa masuk, jadi peranan baharu terus kelihatan
    router.replace("/mula");
  }

  async function hantarSemula() {
    if (!p || baki > 0) return;
    await getSupabase().auth.signInWithOtp({ phone: p.phone, options: { channel: "sms" } });
    setBaki(60);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-page text-ink">
      <header className="flex items-center px-3 pt-3 pb-1">
        <Link href="/daftar" aria-label={tr("Kembali")} className="flex size-11 items-center justify-center rounded-full text-ink!">
          <IconBack />
        </Link>
      </header>
      <form
        className="flex grow flex-col gap-5 px-6 pb-8"
        onSubmit={(e) => {
          e.preventDefault();
          void sahkan(kod);
        }}
      >
        <div className="flex flex-col gap-2">
          <Langkah n={2} />
          <h1 className="m-0 text-[22px] font-extrabold">{tr("Sahkan nombor anda")}</h1>
          <span className="text-sm leading-normal text-subtle">
            {tr("Kod 6 digit dihantar ke WhatsApp")}{" "}<b className="text-ink">{p ? paparTelefon(p.phone) : ""}</b>{tr(". Ini memastikan hanya anda yang boleh mengurus {0}.", p?.company)}</span>
        </div>
        <input
          ref={ref}
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label={tr("Kod 6 digit")}
          value={kod}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, "").slice(0, 6);
            setKod(d);
          }}
          className="h-16 rounded-field border-[1.5px] border-primary bg-surface text-center text-2xl font-extrabold tracking-[0.5em] outline-none"
        />
        {ralat && (
          <span role="alert" className="text-[13px] font-semibold text-danger">
            {ralat}
          </span>
        )}
        <span className="text-sm text-muted">
          {tr("Tidak menerima kod?")}{" "}
          <button type="button" onClick={hantarSemula} disabled={baki > 0} className="font-bold text-primary disabled:text-muted">
            {baki > 0 ? tr("Hantar semula ({0})", baki) : tr("Hantar semula")}
          </button>{" "}
          · <Link href="/daftar">{tr("Tukar nombor")}</Link>
        </span>
        <span className="grow" />
        <button type="submit" disabled={busy || kod.length !== 6} className="flex h-12 items-center justify-center rounded-button bg-primary text-base font-extrabold text-white disabled:opacity-60">
          {busy ? tr("Mencipta syarikat…") : tr("Sahkan & cipta syarikat")}
        </button>
      </form>
    </div>
  );
}
