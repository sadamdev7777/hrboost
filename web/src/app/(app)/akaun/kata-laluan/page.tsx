"use client";

import { tr } from "@/lib/i18n";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useMe, useMeContext } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { EMEL_SAH, MIN_KATA_LALUAN } from "@/lib/masuk";
import { BackHeader, Loading, Screen } from "@/components/ui";
import { MedanKataLaluan, medanMasuk } from "@/app/masuk/MedanKataLaluan";

/** Tetapkan (wajib selepas OTP pertama) atau tukar e-mel & kata laluan log masuk. */
export default function KataLaluanPage() {
  return (
    <Screen lebar="sederhana">
      <Suspense fallback={<Loading />}>
        <KataLaluan />
      </Suspense>
    </Screen>
  );
}

function ralatAuth(e: { code?: string; message?: string }): string {
  const m = `${e.code ?? ""} ${e.message ?? ""}`.toLowerCase();
  if (m.includes("email_exists") || m.includes("already been registered") || m.includes("already registered")) return tr("E-mel ini telah digunakan oleh akaun lain.");
  if (m.includes("same_password") || m.includes("should be different")) return tr("Kata laluan baharu mesti berbeza daripada kata laluan semasa.");
  if (m.includes("weak_password") || m.includes("password should")) return tr("Kata laluan terlalu lemah. Gunakan sekurang-kurangnya {0} aksara.", MIN_KATA_LALUAN);
  if (m.includes("email_address_invalid") || m.includes("invalid")) return tr("Alamat e-mel tidak sah.");
  return tr("Maklumat log masuk tidak dapat disimpan. Sila cuba lagi.");
}

function KataLaluan() {
  const me = useMe();
  const ctx = useMeContext();
  const router = useRouter();
  const sp = useSearchParams().get("seterusnya") ?? "";
  const seterusnya = sp.startsWith("/") && !sp.startsWith("//") ? sp : null;
  const pertama = me.needsPassword;
  const [email, setEmail] = useState(me.loginEmail ?? me.personEmail ?? "");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disimpan, setDisimpan] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDisimpan(false);
    const em = email.trim().toLowerCase();
    if (!EMEL_SAH.test(em)) return setError(tr("Sila masukkan alamat e-mel yang sah."));
    const tukarEmel = em !== (me.loginEmail ?? "").toLowerCase();
    const perluPw = pertama || pw.length > 0;
    if (perluPw && pw.length < MIN_KATA_LALUAN) return setError(tr("Kata laluan mestilah sekurang-kurangnya {0} aksara.", MIN_KATA_LALUAN));
    if (perluPw && pw !== pw2) return setError(tr("Kedua-dua kata laluan tidak sama."));
    if (!tukarEmel && !perluPw) return setError(tr("Tiada perubahan untuk disimpan."));
    setBusy(true);
    const sb = getSupabase();
    let emBaru = me.loginEmail;
    if (tukarEmel) {
      const { data, error: eErr } = await sb.rpc("set_my_login_email", { p_email: em });
      if (eErr) {
        setBusy(false);
        return setError(eErr.code === "23505" ? tr("E-mel ini telah digunakan oleh akaun lain.") : eErr.code === "22023" ? tr("Alamat e-mel tidak sah.") : ralatAuth(eErr));
      }
      emBaru = (data as string | null) ?? em;
    }
    if (perluPw) {
      const { error: err } = await sb.auth.updateUser({ password: pw });
      if (err) {
        setBusy(false);
        if (tukarEmel) ctx.patchMe({ loginEmail: emBaru });
        return setError(ralatAuth(err));
      }
    }
    setBusy(false);
    ctx.patchMe({ needsPassword: false, loginEmail: emBaru ?? em });
    if (pertama || seterusnya) {
      router.replace(seterusnya ?? "/utama");
      return;
    }
    setPw("");
    setPw2("");
    setDisimpan(true);
  }

  return (
    <>
      {pertama ? <div className="h-6" /> : <BackHeader title={tr("E-mel & kata laluan")} href="/profil" />}
      <form onSubmit={submit} noValidate className="flex grow flex-col gap-4 px-4 py-3">
        {pertama && (
          <div className="flex flex-col gap-1.5">
            <h1 className="m-0 text-xl font-extrabold">{tr("Tetapkan e-mel & kata laluan")}</h1>
            <span className="text-sm leading-normal text-subtle">
              {tr("Nombor telefon anda telah disahkan. Mulai sekarang, log masuk dengan e-mel dan kata laluan ini — kod WhatsApp tidak diperlukan lagi.")}</span>
          </div>
        )}
        <label className="flex flex-col gap-2 text-sm font-bold">
          E-mel
          <input type="email" inputMode="email" autoComplete="username" placeholder={tr("nama@contoh.com")} value={email} onChange={(e) => setEmail(e.target.value)} className={medanMasuk} />
          <span className="text-xs font-normal text-muted">{tr("Pautan untuk menetapkan semula kata laluan akan dihantar ke e-mel ini. Pastikan ejaannya betul.")}</span>
        </label>
        <MedanKataLaluan
          label={pertama ? tr("Kata laluan") : tr("Kata laluan baharu")}
          value={pw}
          onChange={setPw}
          autoComplete="new-password"
          bantuan={pertama ? tr("Sekurang-kurangnya {0} aksara.", MIN_KATA_LALUAN) : tr("Biarkan kosong jika tidak mahu menukar. Sekurang-kurangnya {0} aksara.", MIN_KATA_LALUAN)}
        />
        <MedanKataLaluan label={tr("Sahkan kata laluan")} value={pw2} onChange={setPw2} autoComplete="new-password" />
        {error && (
          <span role="alert" className="text-[13px] font-semibold text-danger">
            {error}
          </span>
        )}
        {disimpan && (
          <span role="status" className="rounded-[14px] bg-[#E3F1EE] px-4 py-3 text-[13px] font-semibold text-primary">
            {tr("Maklumat log masuk telah dikemas kini.")}</span>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-1 flex h-12 items-center justify-center rounded-button bg-primary text-base font-extrabold text-on-primary hover:bg-primary-hover disabled:opacity-60"
        >
          {busy ? tr("Menyimpan…") : pertama ? tr("Simpan & teruskan") : tr("Simpan")}
        </button>
        {pertama && (
          <button type="button" onClick={() => void getSupabase().auth.signOut()} className="flex min-h-11 items-center justify-center text-sm font-bold text-muted">
            {tr("Log keluar")}</button>
        )}
      </form>
    </>
  );
}
