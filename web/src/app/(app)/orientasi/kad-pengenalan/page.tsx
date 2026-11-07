"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { getKemajuan, langkahSeterusnya, simpanLangkah } from "@/lib/onboarding";
import { muatNaikPeribadi } from "@/lib/upload";
import { tarikh } from "@/lib/format";
import { IconCheck, IconDocument } from "@/components/icons";
import { NextButton, OnboardingLayout } from "@/components/OnboardingLayout";

// Rujukan reka bentuk: design/OnboardingDokumen.dc.html — kamera belakang (capture="environment")
export default function OrientasiKadPengenalanPage() {
  const me = useMe();
  const router = useRouter();
  const emp = me.active!;
  const [depan, setDepan] = useState<File | null>(null);
  const [belakang, setBelakang] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rekod = useData(async () => {
    return must(await getSupabase().from("persons").select("full_name, ic_no, date_of_birth").eq("id", me.personId).single());
  }, [me.personId]);

  async function simpan() {
    if (!depan || !belakang) return;
    setBusy(true);
    setError(null);
    try {
      const [front_path, back_path] = await Promise.all([
        muatNaikPeribadi(me.personId, "ic-hadapan", depan),
        muatNaikPeribadi(me.personId, "ic-belakang", belakang),
      ]);
      await simpanLangkah(emp.id, "ic", { front_path, back_path });
      router.push(langkahSeterusnya(await getKemajuan(emp.id), "ic"));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const r = rekod.data;
  const ic = (r?.ic_no ?? "").replace(/\D/g, "");
  const icMask = ic.length === 12 ? `••••••-••-${ic.slice(8)}` : "—";
  const lahir = r?.date_of_birth
    ? tarikh(r.date_of_birth)
    : ic.length === 12
      ? tarikh(`2000-${ic.slice(2, 4)}-${ic.slice(4, 6)}`)
      : "—";

  return (
    <OnboardingLayout
      step={5}
      back="/orientasi/bank"
      title="Gambar kad pengenalan"
      sub="Ambil gambar terus dengan kamera, bahagian hadapan dan belakang."
      error={error}
      footer={<NextButton busy={busy} disabled={!depan || !belakang} onClick={simpan} />}
    >
      <div className="grid grid-cols-2 gap-2.5">
        <Ambil label="Hadapan" file={depan} onFile={setDepan} />
        <Ambil label="Belakang" file={belakang} onFile={setBelakang} />
      </div>

      <div className="flex flex-col gap-1 rounded-card bg-surface px-3.5 py-3">
        <span className="pb-1 text-[13px] font-extrabold">Maklumat dalam rekod HR</span>
        <Baris label="Nama" value={r?.full_name ?? "—"} />
        <Baris label="No. kad pengenalan" value={icMask} />
        <Baris label="Hari jadi" value={lahir} />
        <span className="pt-1 text-xs text-muted">
          Pastikan maklumat ini sama dengan kad pengenalan anda. Jika berbeza, maklumkan kepada HR.
        </span>
      </div>

      <div className="flex items-center gap-3 rounded-[14px] bg-surface px-3.5 py-3">
        <span className="flex grow flex-col gap-0.5">
          <b className="text-sm font-bold">Sijil &amp; dokumen lain</b>
          <span className="text-xs text-muted">Pilihan — boleh ditambah kemudian di Profil</span>
        </span>
        <Link href="/profil" className="text-[13px] font-bold">
          Tambah
        </Link>
      </div>
    </OnboardingLayout>
  );
}

function Ambil({ label, file, onFile }: { label: string; file: File | null; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-label={`Gambar ${label.toLowerCase()} kad pengenalan`}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className={`relative flex h-[120px] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[14px] ${
          file ? "border-[1.5px] border-primary bg-primary-soft text-primary" : "border-2 border-dashed border-line-strong bg-surface text-ink"
        }`}
      >
        {url && (
          // eslint-disable-next-line @next/next/no-img-element -- pratonton fail tempatan (blob:)
          <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        )}
        <span className="relative flex flex-col items-center gap-1.5">
          {file ? <IconCheck size={22} /> : <IconDocument size={22} />}
          <span className="text-[13px] font-bold">{file ? `${label} ✓` : `Ambil bahagian ${label.toLowerCase()}`}</span>
        </span>
      </button>
    </>
  );
}

function Baris({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2.5 border-t border-[#EEF2F1] py-1.5 text-[13px] first-of-type:border-t-0">
      <span className="text-subtle">{label}</span>
      <b className="text-right font-bold">{value}</b>
    </div>
  );
}
