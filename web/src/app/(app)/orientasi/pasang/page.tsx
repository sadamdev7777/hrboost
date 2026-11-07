"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useMe } from "@/lib/me";
import { simpanLangkah } from "@/lib/onboarding";
import { IconChat } from "@/components/icons";
import { NextButton, OnboardingLayout } from "@/components/OnboardingLayout";

// Rujukan reka bentuk: design/OnboardingPasang.dc.html
const LANGKAH = {
  ios: ["Buka pautan HRBoost dalam Safari", "Tekan butang Kongsi di bawah", "Pilih “Tambah ke Skrin Utama”"],
  and: ["Buka pautan HRBoost dalam Chrome", "Tekan menu ⋮ di penjuru kanan atas", "Pilih “Pasang aplikasi”"],
};

// Nombor WhatsApp platform HRBoost (Murpati). Kosong = kad "Simpan nombor" disembunyikan.
const WA_PLATFORM = process.env.NEXT_PUBLIC_HRBOOST_WHATSAPP ?? "";

const noSubscribe = () => () => {};

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function OrientasiPasangPage() {
  const me = useMe();
  const router = useRouter();
  const emp = me.active!;
  const android = useSyncExternalStore(noSubscribe, () => /android/i.test(navigator.userAgent), () => false);
  const [pick, setOs] = useState<"ios" | "and" | null>(null);
  const os = pick ?? (android ? "and" : "ios");
  const [installEvt, setInstallEvt] = useState<InstallEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  async function selesai() {
    setBusy(true);
    setError(null);
    try {
      await simpanLangkah(emp.id, "install");
      router.push("/orientasi/selesai");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const vcf = WA_PLATFORM
    ? "data:text/vcard;charset=utf-8," +
      encodeURIComponent(`BEGIN:VCARD\nVERSION:3.0\nFN:HRBoost\nORG:HRBoost.io\nTEL;TYPE=CELL:+${WA_PLATFORM}\nEND:VCARD\n`)
    : null;

  return (
    <OnboardingLayout
      step={8}
      back="/orientasi/buku-panduan"
      title="Letak HRBoost di skrin telefon"
      sub="Buka dengan sekali tekan, seperti aplikasi biasa. Tidak perlu Play Store atau App Store."
      error={error}
      footer={
        <>
          <NextButton busy={busy} onClick={selesai}>
            Sudah dipasang — selesai
          </NextButton>
          <Link href="/orientasi/selesai" className="flex h-10 items-center justify-center text-sm font-bold">
            Langkau buat masa ini
          </Link>
        </>
      }
    >
      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-[14px] bg-[#E4EAE8] p-1">
        {(
          [
            ["ios", "iPhone"],
            ["and", "Android"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={os === id}
            onClick={() => setOs(id)}
            className={`h-10 rounded-[10px] text-sm ${os === id ? "bg-surface font-extrabold text-ink" : "font-semibold text-subtle"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col rounded-card bg-surface px-4 py-1">
        {LANGKAH[os].map((t, i) => (
          <div key={t} className={`flex min-h-14 items-center gap-3.5 text-[15px] ${i ? "border-t border-[#EEF2F1]" : ""}`}>
            <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-extrabold text-primary">
              {i + 1}
            </span>
            <span>{t}</span>
          </div>
        ))}
      </div>

      {installEvt && (
        <button
          type="button"
          onClick={async () => {
            await installEvt.prompt();
            setInstallEvt(null);
          }}
          className="h-12 rounded-[14px] border-[1.5px] border-primary bg-surface text-[15px] font-bold text-primary"
        >
          Pasang sekarang
        </button>
      )}

      {vcf && (
        <div className="flex items-center gap-3 rounded-card bg-surface px-4 py-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <IconChat size={20} />
          </span>
          <span className="flex grow flex-col gap-0.5">
            <b className="text-sm font-bold">Simpan nombor HRBoost</b>
            <span className="text-xs text-muted">Supaya mesej kelulusan &amp; notis tidak dianggap spam</span>
          </span>
          <a href={vcf} download="HRBoost.vcf" className="text-[13px] font-bold">
            Simpan
          </a>
        </div>
      )}
    </OnboardingLayout>
  );
}
