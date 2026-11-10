"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BackHeader, Loading } from "@/components/ui";
import { getSupabase } from "@/lib/supabase";
import { MIN_KATA_LALUAN, destinasiSelepasMasuk } from "@/lib/masuk";
import { MedanKataLaluan } from "../MedanKataLaluan";

/**
 * Tetapkan kata laluan baharu daripada pautan e-mel (Supabase Auth: resetPasswordForEmail).
 * Pautan memasang sesi pemulihan; pengguna terus menetapkan kata laluan baharu.
 */
export default function SetSemulaPage() {
  const router = useRouter();
  const [sesi, setSesi] = useState<"memuat" | "ada" | "tiada">("memuat");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    let selesai = false;
    const semak = async () => {
      const { data } = await sb.auth.getSession();
      if (data.session) {
        selesai = true;
        setSesi("ada");
      }
    };
    const { data: sub } = sb.auth.onAuthStateChange((ev, s) => {
      if (s && (ev === "PASSWORD_RECOVERY" || ev === "SIGNED_IN" || ev === "INITIAL_SESSION")) {
        selesai = true;
        setSesi("ada");
      }
    });
    void semak();
    // Pautan tamat / sudah digunakan: tiada sesi selepas URL diproses
    const t = setTimeout(() => {
      if (!selesai) setSesi("tiada");
    }, 2500);
    return () => {
      clearTimeout(t);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < MIN_KATA_LALUAN) return setError(tr("Kata laluan mestilah sekurang-kurangnya {0} aksara.", MIN_KATA_LALUAN));
    if (pw !== pw2) return setError(tr("Kedua-dua kata laluan tidak sama."));
    setBusy(true);
    const sb = getSupabase();
    const { error: err } = await sb.auth.updateUser({ password: pw });
    if (err) {
      setBusy(false);
      return setError(/different|same/i.test(err.message) ? tr("Kata laluan baharu mesti berbeza daripada kata laluan lama.") : tr("Kata laluan tidak dapat ditukar. Minta pautan baharu dan cuba lagi."));
    }
    // Log keluar sesi lain (peranti lain) selepas kata laluan ditukar
    await sb.auth.signOut({ scope: "others" });
    router.replace(await destinasiSelepasMasuk());
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-page text-ink">
      <BackHeader href="/masuk" />
      {sesi === "memuat" && <Loading />}
      {sesi === "tiada" && (
        <div className="flex flex-col gap-3 px-6 py-4">
          <h1 className="m-0 text-xl font-extrabold">{tr("Pautan tidak sah atau telah tamat")}</h1>
          <p className="m-0 text-sm text-subtle">{tr("Pautan untuk menetapkan semula kata laluan sah selama 1 jam dan hanya boleh digunakan sekali. Minta pautan baharu.")}</p>
          <Link href="/masuk/lupa" className="mt-2 flex h-12 items-center justify-center rounded-button bg-primary text-base font-extrabold text-on-primary!">
            {tr("Minta pautan baharu")}</Link>
        </div>
      )}
      {sesi === "ada" && (
        <form onSubmit={submit} noValidate className="flex grow flex-col gap-4 px-6 py-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="m-0 text-xl font-extrabold">{tr("Tetapkan kata laluan baharu")}</h1>
            <span className="text-sm leading-normal text-subtle">{tr("Selepas disimpan, anda terus log masuk dan semua peranti lain akan dilog keluar.")}</span>
          </div>
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
      )}
    </main>
  );
}
