"use client";

import { tr } from "@/lib/i18n";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { panggilAi } from "@/lib/ai";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";

const JENIS_SURAT = [tr("Pengesahan jawatan"), tr("Pengesahan gaji"), tr("Tawaran kerja"), tr("Amaran"), tr("Tamat percubaan"), tr("Pelepasan jawatan")];


// Draf surat AI untuk HR (dari profil pekerja). Sembang Pembantu AI kini di /tanya-hr.
export default function PembantuAiPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Halaman />
    </Suspense>
  );
}

function Halaman() {
  const sp = useSearchParams();
  const pekerja = sp.get("pekerja");
  const router = useRouter();
  const draf = !!(pekerja && sp.get("surat"));
  // Pembantu AI kini sebahagian daripada Tanya HR; pautan lama dialihkan
  useEffect(() => {
    if (!draf) router.replace("/tanya-hr");
  }, [draf, router]);
  return draf ? <DrafSurat employmentId={pekerja!} /> : <Loading />;
}

function DrafSurat({ employmentId }: { employmentId: string }) {
  const p = useData(
    async () =>
      must(await getSupabase().from("employments").select("persons!employments_person_id_fkey(preferred_name, full_name)").eq("id", employmentId).maybeSingle()),
    [employmentId],
  );
  const [jenis, setJenis] = useState(JENIS_SURAT[0]);
  const [nota, setNota] = useState("");
  const [surat, setSurat] = useState("");
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const nama = p.data?.persons?.preferred_name || p.data?.persons?.full_name || "";

  async function jana() {
    setBusy(true);
    setRalat(null);
    try {
      const r = await panggilAi<{ surat: string }>("pembantu-ai", { mode: "surat", employment_id: employmentId, jenis, nota });
      setSurat(r.surat);
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
    setBusy(false);
  }

  return (
    <Screen lebar="sederhana">
      <BackHeader title={tr("Draf surat{0}", nama ? ` · ${nama}` : "")} href={`/pengurusan/pekerja/${employmentId}`} />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-6">
        <label className="flex flex-col gap-1.5 text-[13px] font-bold text-[#4A5A57]">
          {tr("Jenis surat")}<select value={jenis} onChange={(e) => setJenis(e.target.value)} className="h-11 rounded-[12px] border border-line bg-surface px-3 text-sm font-semibold text-ink">
            {JENIS_SURAT.map((j) => (
              <option key={j}>{j}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-bold text-[#4A5A57]">
          {tr("Nota untuk AI (pilihan)")}<textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={3} placeholder={tr("Contoh: berkuat kuasa 1 Disember, gaji baharu RM3,200")} className="rounded-[12px] border border-line bg-surface p-3 text-sm text-ink" />
        </label>
        <button type="button" onClick={jana} disabled={busy} className="h-12 rounded-[14px] bg-ai text-sm font-extrabold text-white disabled:opacity-60">
          {busy ? tr("AI sedang menulis…") : surat ? tr("Jana semula") : tr("Jana draf")}
        </button>
        {ralat && <ErrorBox message={ralat} />}
        {surat && (
          <>
            <textarea value={surat} onChange={(e) => setSurat(e.target.value)} rows={18} aria-label={tr("Draf surat")} className="rounded-[12px] border border-line bg-surface p-4 font-mono text-[13px] leading-relaxed" />
            <span className="text-xs text-muted">{tr("Draf ini dijana oleh AI. Semak dan lengkapkan bahagian bertanda [ ] sebelum ditandatangani.")}</span>
            <button type="button" onClick={() => navigator.clipboard?.writeText(surat)} className="h-11 rounded-[12px] border border-primary text-sm font-bold text-primary">
              {tr("Salin teks")}</button>
          </>
        )}
      </main>
    </Screen>
  );
}
