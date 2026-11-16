"use client";

import { tr, trRalat } from "@/lib/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { must } from "@/lib/useData";
import { tarikh, tarikhTempatan } from "@/lib/format";
import { keluarkanSurat, labelSurat, tolakSurat, jawabSoalan } from "@/lib/urusan";
import { sahkanInventori } from "@/lib/inventori";
import { putuskanBank } from "@/lib/hr";
import { tandaSemak } from "@/lib/berkanun";
import { beritahu, mintaTeks, sahkan } from "@/components/Dialog";
import { Avatar } from "@/components/ui";

/** Keputusan di luar enjin kelulusan (my_action_queue): surat, inventori, akaun bank, soalan HR, dan lain-lain. */
export type JenisTindakan =
  | "letter" | "asset" | "bank" | "flexible" | "probation_review" | "probation_decision"
  | "appraisal_review" | "appraisal_final" | "question" | "payslip_issue" | "checklist";

export type Tindakan = {
  kind: JenisTindakan;
  id: string;
  employment_id: string | null;
  name: string | null;
  detail: string | null;
  extra: Record<string, unknown>;
  created_at: string | null;
  due_date: string | null;
};

export async function getTindakanLain(companyId: string): Promise<Tindakan[]> {
  return (must(await getSupabase().rpc("my_action_queue", { p_company: companyId })) ?? []) as unknown as Tindakan[];
}

/** Label cip penapis */
export const LABEL_TINDAKAN = (): Record<JenisTindakan, string> => ({
  letter: tr("Surat"),
  asset: tr("Inventori"),
  bank: tr("Akaun bank"),
  flexible: tr("Kerja fleksibel"),
  probation_review: tr("Penilaian percubaan"),
  probation_decision: tr("Keputusan percubaan"),
  appraisal_review: tr("Penilaian prestasi"),
  appraisal_final: tr("Muktamad prestasi"),
  question: tr("Soalan HR"),
  payslip_issue: tr("Laporan slip"),
  checklist: tr("Senarai semak"),
});

/** Tajuk satu tindakan */
function tajuk(t: Tindakan): string {
  switch (t.kind) {
    case "letter":
      return tr("Memohon {0}", labelSurat(t.detail ?? "").toLowerCase());
    case "asset":
      return tr("Inventori baharu: {0}", t.detail ?? "");
    case "bank":
      return tr("Tukar akaun bank: {0} (…{1})", t.detail ?? "", String(t.extra.account_tail ?? ""));
    case "flexible":
      return tr("Permohonan kerja fleksibel");
    case "probation_review":
      return tr("Isi penilaian percubaan");
    case "probation_decision":
      return tr("Putuskan tempoh percubaan");
    case "appraisal_review":
      return tr("Semak penilaian prestasi: {0}", t.detail ?? "");
    case "appraisal_final":
      return tr("Muktamadkan penilaian prestasi: {0}", t.detail ?? "");
    case "question":
      return t.detail ?? "";
    case "payslip_issue":
      return tr("Laporan kesilapan slip gaji: {0}", t.detail ?? "");
    case "checklist":
      return t.detail ?? "";
  }
}

/** Halaman untuk semakan penuh */
function pautan(t: Tindakan): string {
  const e = t.employment_id;
  switch (t.kind) {
    case "letter":
      return "/pengurusan/surat/permintaan";
    case "asset":
      return "/pengurusan/inventori";
    case "flexible":
      return "/pengurusan/kerja-fleksibel";
    case "probation_review":
      return `/penilaian/${e}`;
    case "appraisal_review":
    case "appraisal_final":
      return `/prestasi/${t.id}`;
    case "question":
      return "/pengurusan/soalan";
    case "payslip_issue":
      return "/pengurusan/gaji";
    default:
      return e ? `/pengurusan/pekerja/${e}` : "/pengurusan";
  }
}

function keterangan(t: Tindakan): string | null {
  const bahagian: string[] = [];
  if (t.kind === "letter" && t.extra.purpose) bahagian.push(String(t.extra.purpose));
  if (t.kind === "flexible" && t.detail) bahagian.push(t.detail);
  if (t.kind === "probation_decision" && t.detail) bahagian.push(tr("Cadangan ketua: {0}", t.detail));
  if (t.kind === "checklist") bahagian.push(t.extra.owner === "ketua" ? tr("Tugas ketua") : tr("Tugas HR"));
  if (t.due_date) bahagian.push(t.kind === "flexible" ? tr("Jawab sebelum {0}", tarikh(t.due_date)) : tr("Tarikh akhir {0}", tarikh(t.due_date)));
  if (t.created_at) bahagian.push(tarikh(tarikhTempatan(t.created_at)));
  return bahagian.length ? bahagian.join(" · ") : null;
}

const garis = "flex h-10 items-center justify-center rounded-xl border-[1.5px] border-line bg-surface px-4 text-[13px] font-bold";
const utama = "flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-[13px] font-extrabold text-white disabled:opacity-60";

export function SenaraiTindakanLain({ senarai, onSelesai }: { senarai: Tindakan[]; onSelesai: () => void }) {
  const router = useRouter();
  const [sibuk, setSibuk] = useState<string | null>(null);

  async function buat(id: string, f: () => Promise<string | void>) {
    setSibuk(id);
    try {
      const mesej = await f();
      if (mesej) beritahu(mesej);
      onSelesai();
    } catch (e) {
      beritahu(e instanceof Error ? trRalat(e.message) : tr("Ralat"), "ralat");
    }
    setSibuk(null);
  }

  function butang(t: Tindakan) {
    const b = sibuk === t.id;
    switch (t.kind) {
      case "letter":
        return (
          <>
            <button type="button" disabled={b} className={`${garis} text-danger`} onClick={async () => {
              const sebab = await mintaTeks({ tajuk: tr("Tolak permohonan surat"), label: tr("Sebab (dihantar kepada pekerja)"), ok: tr("Tolak"), wajib: true, bahaya: true });
              if (sebab) await buat(t.id, async () => { await tolakSurat(t.id, sebab); return tr("Permohonan ditolak."); });
            }}>{tr("Tolak")}</button>
            <button type="button" disabled={b} className={utama} onClick={async () => {
              if (!(await sahkan({ tajuk: tr("Keluarkan surat untuk {0}?", t.name ?? ""), mesej: tr("Surat dijana dengan nama anda sebagai penandatangan. Pekerja dimaklumkan."), ok: tr("Keluarkan surat") }))) return;
              await buat(t.id, async () => { await keluarkanSurat(t.id); router.push(`/surat/${t.id}`); });
            }}>{b ? "…" : tr("Keluarkan")}</button>
          </>
        );
      case "asset":
        return (
          <>
            <button type="button" disabled={b} className={`${garis} text-danger`} onClick={async () => {
              const sebab = await mintaTeks({ tajuk: tr("Kembalikan kepada pekerja"), label: tr("Apa yang perlu dibetulkan?"), ok: tr("Kembalikan"), wajib: true });
              if (sebab) await buat(t.id, async () => { await sahkanInventori(t.id, false, sebab); return tr("Dikembalikan kepada pekerja."); });
            }}>{tr("Kembalikan")}</button>
            <button type="button" disabled={b} className={utama} onClick={() => buat(t.id, async () => { await sahkanInventori(t.id, true); return tr("Inventori disahkan."); })}>
              {b ? "…" : tr("Sahkan")}
            </button>
          </>
        );
      case "bank":
        return (
          <>
            <button type="button" disabled={b} className={`${garis} text-danger`} onClick={async () => {
              const nota = await mintaTeks({ tajuk: tr("Tolak pertukaran akaun bank"), label: tr("Sebab (dihantar kepada pekerja)"), ok: tr("Tolak"), wajib: true, bahaya: true });
              if (nota) await buat(t.id, async () => { await putuskanBank(t.id, false, nota); return tr("Ditolak. Pekerja dimaklumkan."); });
            }}>{tr("Tolak")}</button>
            <button type="button" disabled={b} className={utama} onClick={async () => {
              if (!(await sahkan({ tajuk: tr("Sahkan akaun bank baharu {0}?", t.name ?? ""), mesej: tr("Gaji seterusnya dibayar ke akaun ini. Semak penyata bank atau dokumen sokongan dahulu."), ok: tr("Sahkan") }))) return;
              await buat(t.id, async () => { await putuskanBank(t.id, true); return tr("Akaun bank disahkan."); });
            }}>{b ? "…" : tr("Sahkan")}</button>
          </>
        );
      case "question":
        return (
          <button type="button" disabled={b} className={utama} onClick={async () => {
            const jawapan = await mintaTeks({ tajuk: tr("Jawab soalan {0}", t.name ?? ""), mesej: t.detail ?? "", label: tr("Jawapan"), ok: tr("Hantar jawapan"), wajib: true });
            if (jawapan) await buat(t.id, async () => { await jawabSoalan(t.id, jawapan); return tr("Jawapan dihantar kepada {0}.", t.name ?? ""); });
          }}>{b ? "…" : tr("Jawab")}</button>
        );
      case "checklist":
        return (
          <button type="button" disabled={b} className={utama} onClick={() => buat(t.id, async () => { await tandaSemak(t.id, true); return tr("Ditanda selesai."); })}>
            {b ? "…" : tr("Tanda selesai")}
          </button>
        );
      default:
        return (
          <Link href={pautan(t)} className={utama}>
            {t.kind === "probation_review" ? tr("Isi penilaian") : tr("Semak")}
          </Link>
        );
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      {senarai.map((t, i) => (
        <div key={`${t.kind}-${t.id}`} className="flex flex-col gap-2.5 rounded-[18px] bg-surface px-4 py-3">
          <Link href={pautan(t)} className="flex gap-3 text-ink!">
            <Avatar name={t.name ?? "?"} index={i} />
            <div className="flex min-w-0 grow flex-col gap-[3px]">
              <div className="flex justify-between gap-2">
                <span className="truncate text-sm font-extrabold">{t.name ?? "-"}</span>
                <span className="shrink-0 rounded-full bg-page px-2 py-0.5 text-[11px] font-bold text-subtle">{LABEL_TINDAKAN()[t.kind]}</span>
              </div>
              <span className="text-sm font-semibold break-words">{tajuk(t)}</span>
              {keterangan(t) && <span className="text-xs text-muted">{keterangan(t)}</span>}
            </div>
          </Link>
          <div className="flex flex-wrap justify-end gap-2">{butang(t)}</div>
        </div>
      ))}
    </div>
  );
}
