"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMe } from "@/lib/me";
import { getKemajuan, langkahSeterusnya, simpanLangkah } from "@/lib/onboarding";
import { muatNaikPeribadi } from "@/lib/upload";
import { IconCheck } from "@/components/icons";
import { NextButton, OnboardingLayout } from "@/components/OnboardingLayout";

// Rujukan reka bentuk: design/OnboardingSelfie.dc.html — kamera hadapan (capture="user")
export default function OrientasiSwafotoPage() {
  const me = useMe();
  const router = useRouter();
  const emp = me.active!;
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function gunakan() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const path = await muatNaikPeribadi(me.personId, "swafoto", file);
      await simpanLangkah(emp.id, "selfie", { photo_path: path });
      router.push(langkahSeterusnya(await getKemajuan(emp.id), "selfie"));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <OnboardingLayout
      step={3}
      back="/orientasi/nama"
      title="Ambil swafoto"
      sub="Untuk gambar profil. Rakan sekerja dan ketua akan melihat gambar ini."
      error={error}
      footer={
        file ? (
          <div className="grid grid-cols-[1fr_1.6fr] gap-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => input.current?.click()}
              className="h-12 rounded-button border-[1.5px] border-line bg-surface text-sm font-bold text-ink disabled:opacity-60"
            >
              Ambil semula
            </button>
            <NextButton busy={busy} onClick={gunakan}>
              Gunakan gambar ini
            </NextButton>
          </div>
        ) : (
          <NextButton onClick={() => input.current?.click()}>
            <span className="flex items-center gap-2.5">
              <CameraIcon />
              Ambil swafoto
            </span>
          </NextButton>
        )
      }
    >
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setFile(f);
          e.target.value = "";
        }}
      />

      {!file || !preview ? (
        <div
          role="img"
          aria-label="Paparan kamera hadapan dengan panduan bujur untuk muka"
          className="relative flex h-[360px] items-center justify-center overflow-hidden rounded-3xl bg-[#1E2B29]"
        >
          <div className="h-[260px] w-[200px] rounded-[50%] border-[3px] border-dashed border-white/85" />
          <span className="absolute inset-x-0 bottom-4 text-center text-sm font-semibold text-white">
            Letakkan muka dalam bulatan
          </span>
          <span className="absolute top-3.5 left-3.5 rounded-[10px] bg-white/18 px-2.5 py-1 text-xs font-bold text-white">
            Kamera hadapan
          </span>
        </div>
      ) : (
        <div className="flex h-[360px] flex-col items-center justify-center gap-4 rounded-3xl bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element -- pratonton fail tempatan (blob:) */}
          <img src={preview} alt="Swafoto yang diambil" className="size-[200px] rounded-full object-cover" />
          <span className="flex items-center gap-2 text-sm font-bold text-subtle">
            <span className="flex size-5 items-center justify-center rounded-full bg-primary-soft text-primary">
              <IconCheck size={12} />
            </span>
            Pastikan muka jelas dan tidak kabur
          </span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Tip>Pencahayaan mencukupi, menghadap tingkap atau lampu</Tip>
        <Tip>Muka penuh, tanpa cermin mata hitam</Tip>
      </div>
    </OnboardingLayout>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2 text-[13px] text-[#33504B]">
      <i className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary not-italic">
        <IconCheck size={11} />
      </i>
      {children}
    </span>
  );
}

function CameraIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
