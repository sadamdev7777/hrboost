"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { IconBack } from "@/components/icons";
import { getSupabase, setKeepSignedIn } from "@/lib/supabase";
import { paparTelefon } from "@/lib/format";
import { bacaJemputan, padamJemputan, simpanJemputan } from "@/lib/invite";
import { PHONE_KEY } from "../LoginForm";
import { destinasiSelepasMasuk } from "@/lib/masuk";

const RESEND_SECONDS = 60;

const noSubscribe = () => () => {};
function readPhone(): string {
  try {
    return sessionStorage.getItem(PHONE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function OtpForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  // null = belum diketahui (pelayan), "" = tiada nombor (kembali ke /masuk)
  const phone = useSyncExternalStore(noSubscribe, readPhone, () => null);
  const [code, setCode] = useState("");
  const [keep, setKeep] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(RESEND_SECONDS);
  const [focused, setFocused] = useState(true);

  useEffect(() => {
    if (phone === "") router.replace("/masuk/telefon");
  }, [phone, router]);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  async function verify(token: string) {
    if (!phone || token.length !== 6) return;
    setBusy(true);
    setError(null);
    setKeepSignedIn(keep);
    const { error: err } = await getSupabase().auth.verifyOtp({ phone, token, type: "sms" });
    setBusy(false);
    if (err) {
      setError(tr("Kod tidak sah atau telah tamat tempoh. Sila semak dan cuba lagi."));
      setCode("");
      inputRef.current?.focus();
      return;
    }
    // Nombor dalam sessionStorage tidak dipadam di sini: memadamnya mencetuskan
    // lencongan ke /masuk sebelum navigasi ke /utama selesai. Ia hilang bila tab ditutup.
    // Datang daripada pautan jemputan: aktifkan akaun (sahkan 4 digit IC) sekarang.
    const jemputan = bacaJemputan();
    if (jemputan) {
      const { data, error: aErr } = await getSupabase().rpc("accept_invite", {
        p_token: jemputan.token,
        p_ic_last4: jemputan.ic4,
      });
      const r = data as unknown as { ok?: boolean; error?: string; attempts_left?: number } | null;
      if (!aErr && r?.ok) {
        padamJemputan();
        router.replace("/orientasi");
        return;
      }
      const msg = aErr?.message ?? r?.error ?? tr("Akaun tidak dapat diaktifkan.");
      simpanJemputan({
        ...jemputan,
        error: r?.attempts_left !== undefined ? tr("{0}. Baki cubaan: {1}.", msg, r.attempts_left) : msg,
      });
      router.replace(`/jemputan/${jemputan.token}`);
      return;
    }
    router.replace(await destinasiSelepasMasuk());
  }

  async function resend() {
    if (!phone || left > 0) return;
    setError(null);
    const { error: err } = await getSupabase().auth.signInWithOtp({ phone, options: { channel: "sms" } });
    if (err) setError(tr("Kod tidak dapat dihantar semula. Sila cuba sebentar lagi."));
    setLeft(RESEND_SECONDS);
  }

  function onChange(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (digits.length === 6) void verify(digits);
  }

  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  return (
    <>
      <header className="flex items-center px-3 pt-3 pb-1">
        <Link href="/masuk/telefon" aria-label={tr("Kembali")} className="flex size-11 items-center justify-center rounded-full text-ink!">
          <IconBack />
        </Link>
      </header>

      <form
        className="flex grow flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          void verify(code);
        }}
      >
        <div className="flex grow flex-col gap-5 px-6 py-4">
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-[22px] font-extrabold">{tr("Masukkan kod")}</h1>
            <span className="text-sm leading-normal text-subtle">
              {tr("Kod 6 digit dihantar ke WhatsApp")}{" "}<b className="text-ink">{phone ? paparTelefon(phone) : ""}</b>
            </span>
          </div>

          <label className="relative block cursor-text" aria-label={tr("Kod 6 digit")}>
            <input
              ref={inputRef}
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="absolute inset-0 h-full w-full opacity-0"
            />
            <div aria-hidden="true" className="grid grid-cols-6 gap-2">
              {Array.from({ length: 6 }, (_, i) => {
                const filled = i < code.length;
                const current = focused && i === Math.min(code.length, 5) && code.length < 6;
                return (
                  <span
                    key={i}
                    className={`flex h-[60px] items-center justify-center rounded-field bg-surface text-[22px] font-extrabold ${
                      current
                        ? "border-[2.5px] border-primary"
                        : filled
                          ? "border-[1.5px] border-primary"
                          : "border-[1.5px] border-line"
                    }`}
                  >
                    {code[i] ?? ""}
                  </span>
                );
              })}
            </div>
          </label>

          {error && (
            <span role="alert" className="text-[13px] font-semibold text-danger">
              {error}
            </span>
          )}

          <span className="text-sm text-muted">
            {tr("Tidak menerima kod?")}{" "}
            {left > 0 ? (
              <>
                <b className="text-primary">{tr("Hantar semula")}</b> {" "}{tr("dalam {0}", mmss)}</>
            ) : (
              <button type="button" onClick={resend} className="font-bold text-primary">
                {tr("Hantar semula")}</button>
            )}
          </span>

          <label className="flex items-center gap-2.5 text-sm font-semibold">
            <input
              type="checkbox"
              checked={keep}
              onChange={(e) => setKeep(e.target.checked)}
              className="size-5 accent-primary"
            />
            {tr("Kekalkan log masuk di telefon ini")}</label>
        </div>

        <div className="px-6 pt-3 pb-8">
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="flex h-12 w-full items-center justify-center rounded-button bg-primary text-base font-extrabold text-on-primary hover:bg-primary-hover disabled:opacity-60"
          >
            {busy ? tr("Mengesahkan…") : tr("Sahkan")}
          </button>
        </div>
      </form>
    </>
  );
}
