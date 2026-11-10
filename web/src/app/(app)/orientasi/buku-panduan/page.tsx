"use client";

import { tr } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { getKemajuan, langkahSeterusnya, simpanLangkah } from "@/lib/onboarding";
import { hari } from "@/lib/format";
import { IconDocument, IconSparkle } from "@/components/icons";
import { NextButton, OnboardingLayout } from "@/components/OnboardingLayout";

// Rujukan reka bentuk: design/OnboardingHandbook.dc.html
const HARI = [tr("Ahad"), tr("Isnin"), tr("Selasa"), tr("Rabu"), tr("Khamis"), tr("Jumaat"), tr("Sabtu")];

export default function OrientasiBukuPanduanPage() {
  const me = useMe();
  const router = useRouter();
  const emp = me.active!;
  const [faham, setFaham] = useState(false);
  const [soalan, setSoalan] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const info = useData(async () => {
    const sb = getSupabase();
    const c = must(await sb.from("companies").select("weekend_days").eq("id", emp.companyId).single());
    const al = must(
      await sb
        .from("leave_types")
        .select("leave_entitlement_rules(min_service_months, days_per_year)")
        .eq("company_id", emp.companyId)
        .eq("code", "AL")
        .maybeSingle(),
    );
    const doc = must(
      await sb
        .from("ai_knowledge_docs")
        .select("title, source_path")
        .eq("company_id", emp.companyId)
        .eq("active", true)
        .not("source_path", "is", null)
        .limit(1),
    );
    const rules = (al?.leave_entitlement_rules ?? []).sort((a, b) => a.min_service_months - b.min_service_months);
    return { weekend: c.weekend_days, alDays: rules[0]?.days_per_year ?? null, doc: doc[0] ?? null };
  }, [emp.companyId]);

  const kerja = info.data
    ? [0, 1, 2, 3, 4, 5, 6].filter((d) => !info.data!.weekend.includes(d))
    : [1, 2, 3, 4, 5];
  const hariKerja = kerja.length ? `${HARI[kerja[0]]} – ${HARI[kerja[kerja.length - 1]]}` : "";
  const docUrl = info.data?.doc?.source_path?.startsWith("http") ? info.data.doc.source_path : null;

  async function simpan() {
    setBusy(true);
    setError(null);
    try {
      await simpanLangkah(emp.id, "handbook");
      router.push(langkahSeterusnya(await getKemajuan(emp.id), "handbook"));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <OnboardingLayout
      step={7}
      back="/orientasi/peribadi"
      title={tr("Perkara penting di {0}", emp.companyCode)}
      sub={tr("Ringkasan buku panduan syarikat — 3 minit.")}
      error={error}
      footer={
        <NextButton busy={busy} disabled={!faham} onClick={simpan}>
          {faham ? tr("Seterusnya") : tr("Sila tandakan dahulu untuk meneruskan")}
        </NextButton>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        <Perkara tajuk={tr("WAKTU KERJA")} isi={`${emp.workStart.replace(/^0/, "")} – ${tukar12(emp.workEnd)}`} nota={hariKerja} />
        <Perkara tajuk={tr("CUTI TAHUNAN")} isi={info.data?.alDays != null ? tr("{0} hari", hari(info.data.alDays)) : "—"} nota={tr("tahun pertama")} />
        <Perkara tajuk={tr("SAKIT (MC)")} isi={tr("Ambil gambar sijil di aplikasi")} nota={tr("pada hari yang sama")} />
        <Perkara tajuk={tr("TUNTUTAN")} isi={tr("Hantar resit")} nota={tr("mengikut tempoh polisi syarikat")} />
      </div>

      {docUrl && (
        <a href={docUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-[14px] bg-surface px-3.5 py-3 text-ink!">
          <IconDocument size={22} className="text-primary" />
          <span className="grow text-sm font-bold">{tr("Baca buku panduan penuh")}</span>
          <span className="text-xs text-muted">PDF</span>
        </a>
      )}

      <form
        className="flex flex-col gap-2 rounded-[14px] bg-ai-soft px-3.5 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          router.push("/tanya-hr");
        }}
      >
        <span className="flex items-center gap-2 text-[13px] font-extrabold text-ai-hover">
          <IconSparkle size={18} className="text-ai" />
          {tr("Ada soalan? Tanya AI")}</span>
        <label className="flex">
          <span className="sr-only">{tr("Soalan tentang polisi")}</span>
          <input
            type="text"
            value={soalan}
            onChange={(e) => setSoalan(e.target.value)}
            placeholder={tr("Contoh: Bolehkah saya menuntut bayaran letak kereta di KLIA?")}
            className="h-11 grow rounded-xl border border-[#D9D2F1] bg-surface px-3 text-sm text-ink"
          />
        </label>
      </form>

      <label className="mt-0.5 flex items-start gap-2.5 text-sm leading-[1.45] font-semibold">
        <input type="checkbox" checked={faham} onChange={(e) => setFaham(e.target.checked)} className="mt-px size-[22px] shrink-0 accent-primary" />
        {tr("Saya telah membaca dan memahami polisi syarikat.")}</label>
    </OnboardingLayout>
  );
}

function tukar12(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}`;
}

function Perkara({ tajuk, isi, nota }: { tajuk: string; isi: string; nota: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[14px] bg-surface px-3.5 py-3">
      <span className="text-xs font-bold text-subtle">{tajuk}</span>
      <b className="text-sm font-extrabold">{isi}</b>
      <span className="text-xs font-medium text-muted">{nota}</span>
    </div>
  );
}
