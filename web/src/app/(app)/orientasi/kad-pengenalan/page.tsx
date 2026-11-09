"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { getKemajuan, langkahSeterusnya, simpanLangkah } from "@/lib/onboarding";
import { muatNaikPeribadi } from "@/lib/upload";
import { panggilAi } from "@/lib/ai";
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
  // Amaran AI: no. kad pengenalan dalam gambar berbeza daripada rekod HR (pekerja boleh teruskan)
  const [amaran, setAmaran] = useState<{ paths: { front_path: string; back_path: string } } | null>(null);
  const rekod = useData(async () => {
    return must(await getSupabase().from("persons").select("full_name, ic_no, date_of_birth").eq("id", me.personId).single());
  }, [me.personId]);

  async function simpan() {
    if (!depan || !belakang) return;
    setBusy(true);
    setError(null);
    try {
      const paths = amaran?.paths ?? await (async () => {
        const [front_path, back_path] = await Promise.all([
          muatNaikPeribadi(me.personId, "ic-hadapan", depan),
          muatNaikPeribadi(me.personId, "ic-belakang", belakang),
        ]);
        return { front_path, back_path };
      })();
      if (!amaran) {
        // AI membaca bahagian hadapan dan memadankan dengan rekod HR (dilangkau jika AI tidak tersedia)
        const h = await Promise.race([
          panggilAi<{ readable: boolean; ic_matches: boolean }>("ai-ic", { path: paths.front_path, company_id: emp.companyId }).catch(() => null),
          new Promise<null>((r) => setTimeout(() => r(null), 25000)),
        ]);
        if (h && h.readable && !h.ic_matches) {
          setAmaran({ paths });
          setBusy(false);
          return;
        }
      }
      await simpanLangkah(emp.id, "ic", paths);
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
      title={tr("Gambar kad pengenalan")}
      sub={tr("Ambil gambar terus dengan kamera, bahagian hadapan dan belakang.")}
      error={error}
      footer={<NextButton busy={busy} disabled={!depan || !belakang} onClick={simpan} />}
    >
      <div className="grid grid-cols-2 gap-2.5">
        <Ambil label={tr("Hadapan")} file={depan} onFile={(f) => { setAmaran(null); setDepan(f); }} />
        <Ambil label={tr("Belakang")} file={belakang} onFile={(f) => { setAmaran(null); setBelakang(f); }} />
      </div>

      {amaran && (
        <div role="alert" className="rounded-[14px] bg-warning-soft px-3.5 py-3 text-[13px] leading-normal text-warning">
          {tr("AI mendapati no. kad pengenalan dalam gambar berbeza daripada rekod HR. Semak gambar anda, atau tekan butang sekali lagi untuk meneruskan — HR akan menyemaknya.")}</div>
      )}
      <div className="flex flex-col gap-1 rounded-card bg-surface px-3.5 py-3">
        <span className="pb-1 text-[13px] font-extrabold">{tr("Maklumat dalam rekod HR")}</span>
        <Baris label={tr("Nama")} value={r?.full_name ?? "—"} />
        <Baris label={tr("No. kad pengenalan")} value={icMask} />
        <Baris label={tr("Hari jadi")} value={lahir} />
        <span className="pt-1 text-xs text-muted">
          {tr("Pastikan maklumat ini sama dengan kad pengenalan anda. Jika berbeza, maklumkan kepada HR.")}</span>
      </div>

      <div className="flex items-center gap-3 rounded-[14px] bg-surface px-3.5 py-3">
        <span className="flex grow flex-col gap-0.5">
          <b className="text-sm font-bold">{tr("Sijil & dokumen lain")}</b>
          <span className="text-xs text-muted">{tr("Pilihan — boleh ditambah kemudian di Profil")}</span>
        </span>
        <Link href="/profil" className="text-[13px] font-bold">
          {tr("Tambah")}</Link>
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
        aria-label={tr("Gambar {0} kad pengenalan", label.toLowerCase())}
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
          <span className="text-[13px] font-bold">{file ? `${label} ✓` : tr("Ambil bahagian {0}", label.toLowerCase())}</span>
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
