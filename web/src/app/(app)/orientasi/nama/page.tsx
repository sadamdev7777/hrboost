"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMe, useMeContext } from "@/lib/me";
import { getKemajuan, langkahSeterusnya, simpanLangkah } from "@/lib/onboarding";
import { OnboardingLayout, NextButton, Seksyen } from "@/components/OnboardingLayout";

// Rujukan reka bentuk: design/OnboardingNama.dc.html
export default function OrientasiNamaPage() {
  const me = useMe();
  const { reload } = useMeContext();
  const router = useRouter();
  const emp = me.active!;
  const [full, setFull] = useState(me.fullName);
  const [nick, setNick] = useState(me.name === me.fullName ? "" : me.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const papar = nick.trim() || "…";

  async function simpan() {
    setBusy(true);
    setError(null);
    try {
      await simpanLangkah(emp.id, "name", { full_name: full, preferred_name: nick });
      reload();
      router.push(langkahSeterusnya(await getKemajuan(emp.id), "name"));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <OnboardingLayout
      step={2}
      back="/orientasi"
      title="Nama anda"
      sub="Nama penuh untuk dokumen rasmi. Nama panggilan untuk semua tempat lain."
      error={error}
      footer={<NextButton busy={busy} disabled={!full.trim() || !nick.trim()} onClick={simpan} />}
    >
      <label className="flex flex-col gap-1.5 text-sm font-bold">
        Nama penuh (seperti dalam kad pengenalan)
        <input
          type="text"
          value={full}
          onChange={(e) => setFull(e.target.value)}
          autoComplete="name"
          className="h-[50px] rounded-xl border border-line bg-surface px-3.5 text-sm font-bold tracking-[0.01em] text-ink uppercase"
        />
        <span className="text-xs font-medium text-muted">
          Untuk slip gaji, Borang EA, KWSP dan surat rasmi. Mesti sama seperti dalam kad pengenalan.
        </span>
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-bold">
        Nama panggilan
        <input
          type="text"
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          autoComplete="nickname"
          className="h-12 rounded-xl border-[1.5px] border-primary bg-surface px-3.5 text-lg font-extrabold text-ink"
        />
        <span className="text-xs font-medium text-muted">Nama yang biasa digunakan oleh rakan sekerja untuk memanggil anda.</span>
      </label>

      <div className="flex flex-col gap-2">
        <Seksyen>BEGINI NAMA ANDA AKAN DIPAPARKAN</Seksyen>
        <div className="flex flex-col rounded-card bg-surface px-4 py-1">
          <Contoh label="Skrin Utama">Selamat pagi, {papar}</Contoh>
          <Contoh label="WhatsApp">Assalamualaikum {papar}, …</Contoh>
          <Contoh label="Kelulusan">{papar} · Cuti Tahunan</Contoh>
          <Contoh label="Slip gaji" small>
            {full.trim().toUpperCase() || "…"}
          </Contoh>
        </div>
      </div>
    </OnboardingLayout>
  );
}

function Contoh({ label, children, small }: { label: string; children: React.ReactNode; small?: boolean }) {
  return (
    <div className="flex min-h-12 items-center gap-3 border-t border-[#EEF2F1] text-sm first:border-t-0">
      <span className="w-[92px] shrink-0 text-muted">{label}</span>
      <b className={small ? "text-[13px]" : ""}>{children}</b>
    </div>
  );
}
