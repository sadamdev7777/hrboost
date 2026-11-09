"use client";

import { tr, trRalat } from "@/lib/i18n";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { BackHeader, Loading } from "@/components/ui";
import { MIN_KATA_LALUAN, panggilSetSemula } from "@/lib/masuk";
import { MedanKataLaluan, medanMasuk } from "../MedanKataLaluan";

export default function SetSemulaPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-page text-ink">
      <BackHeader href="/masuk" />
      <Suspense fallback={<Loading />}>
        <SetSemula />
      </Suspense>
    </main>
  );
}

function SetSemula() {
  const token = useSearchParams().get("t") ?? "";
  const [ic4, setIc4] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [siap, setSiap] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{4}$/.test(ic4)) return setError(tr("Sila masukkan 4 digit akhir kad pengenalan."));
    if (pw.length < MIN_KATA_LALUAN) return setError(tr("Kata laluan mestilah sekurang-kurangnya {0} aksara.", MIN_KATA_LALUAN));
    if (pw !== pw2) return setError(tr("Kedua-dua kata laluan tidak sama."));
    setBusy(true);
    const r = await panggilSetSemula({ action: "reset", token, ic4, password: pw });
    setBusy(false);
    if (!r.ok) {
      const msg = r.error ? trRalat(r.error) : tr("Kata laluan tidak dapat ditukar.");
      return setError(r.attempts_left !== undefined ? tr("{0}. Baki cubaan: {1}.", msg, r.attempts_left) : msg);
    }
    setSiap(true);
  }

  if (!token)
    return (
      <div className="flex flex-col gap-3 px-6 py-4">
        <h1 className="m-0 text-xl font-extrabold">{tr("Pautan tidak lengkap")}</h1>
        <p className="m-0 text-sm text-subtle">{tr("Buka semula pautan daripada e-mel anda, atau minta pautan baharu.")}</p>
        <Link href="/masuk/lupa" className="font-bold">
          {tr("Minta pautan baharu")}</Link>
      </div>
    );

  if (siap)
    return (
      <div className="flex flex-col gap-3 px-6 py-4">
        <h1 className="m-0 text-xl font-extrabold">{tr("Kata laluan telah ditukar")}</h1>
        <p className="m-0 text-sm leading-normal text-subtle">{tr("Semua sesi lama telah dilog keluar. Log masuk sekarang dengan kata laluan baharu anda.")}</p>
        <Link href="/masuk" className="mt-2 flex h-12 items-center justify-center rounded-button bg-primary text-base font-extrabold text-on-primary!">
          {tr("Log masuk")}</Link>
      </div>
    );

  return (
    <form onSubmit={submit} noValidate className="flex grow flex-col gap-4 px-6 py-4">
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 text-xl font-extrabold">{tr("Tetapkan kata laluan baharu")}</h1>
        <span className="text-sm leading-normal text-subtle">{tr("Untuk keselamatan, sahkan 4 digit akhir kad pengenalan anda.")}</span>
      </div>
      <label className="flex flex-col gap-2 text-sm font-bold">
        {tr("4 digit akhir kad pengenalan")}<input
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          placeholder="••••"
          value={ic4}
          onChange={(e) => setIc4(e.target.value.replace(/\D/g, "").slice(0, 4))}
          className={`${medanMasuk} w-36! tracking-[0.3em]`}
        />
      </label>
      <MedanKataLaluan label={tr("Kata laluan baharu")} value={pw} onChange={setPw} autoComplete="new-password" bantuan={tr("Sekurang-kurangnya {0} aksara.", MIN_KATA_LALUAN)} />
      <MedanKataLaluan label={tr("Sahkan kata laluan")} value={pw2} onChange={setPw2} autoComplete="new-password" />
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
        {busy ? tr("Menyimpan…") : tr("Simpan kata laluan")}
      </button>
    </form>
  );
}
