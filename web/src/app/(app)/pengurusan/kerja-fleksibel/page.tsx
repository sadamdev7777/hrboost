"use client";

import { tr } from "@/lib/i18n";
import { TabModul } from "@/components/TabModul";
import Link from "next/link";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { tarikh } from "@/lib/format";
import { getFleksibel, LABEL_FLEKSIBEL, putuskanFleksibel, STATUS_FLEKSIBEL } from "@/lib/urusan";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { PengepalaAkar, TabNav } from "@/components/TabNav";
import { HadPeranan, Tag } from "@/components/Senarai";
import { beritahu, mintaTeks } from "@/components/Dialog";

/** Permohonan susunan kerja fleksibel: keputusan bertulis dalam 60 hari (Akta Kerja Bahagian XIIC). */
export default function FleksibelHrPage() {
  return (
    <HadPeranan roles={["hr", "admin"]}>
      <Kandungan />
    </HadPeranan>
  );
}

function Kandungan() {
  const me = useMe();
  const emp = me.active!;
  const d = useData(() => getFleksibel(emp.companyId), [emp.companyId]);
  const [ralat, setRalat] = useState<string | null>(null);

  async function putus(id: string, nama: string, lulus: boolean) {
    const nota = await mintaTeks({
      tajuk: lulus ? tr("Luluskan permohonan {0}", nama) : tr("Tidak meluluskan permohonan {0}", nama),
      mesej: lulus ? undefined : tr("Akta Kerja mewajibkan majikan menyatakan sebab penolakan secara bertulis."),
      label: lulus ? tr("Syarat / nota (pilihan)") : tr("Sebab"),
      ok: lulus ? tr("Luluskan") : tr("Tidak lulus"),
      wajib: !lulus,
      bahaya: !lulus,
    });
    if (nota === null) return;
    try {
      await putuskanFleksibel(id, lulus, nota);
      beritahu(tr("Keputusan dihantar kepada {0} melalui WhatsApp.", nama));
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
  }

  return (
    <Screen lebar="lebar">
      <PengepalaAkar title={tr("Kehadiran")} />
      <TabModul modul="kehadiran" />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-6 lg:px-0">
        <span className="text-sm leading-normal text-subtle">
          {tr("Akta Kerja 1955 (Bahagian XIIC): pekerja boleh memohon perubahan waktu, hari atau tempat bekerja. Majikan wajib memberi jawapan bertulis dalam 60 hari dari tarikh permohonan, dan menyatakan sebab jika tidak meluluskan.")}</span>
        {d.error && <ErrorBox message={d.error} />}
        {ralat && <ErrorBox message={ralat} />}
        {d.loading && !d.data && <Loading />}
        {d.data && d.data.length === 0 && <div className="rounded-card bg-surface px-4 py-8 text-center text-sm text-muted">{tr("Tiada permohonan kerja fleksibel.")}</div>}
        {(d.data ?? []).length > 0 && (
          <div className="flex flex-col rounded-card bg-surface px-4 lg:px-5 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
            {(d.data ?? []).map((f) => (
              <div key={f.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 py-3 text-sm">
                <span className="flex min-w-0 grow basis-72 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <Link href={`/pengurusan/pekerja/${f.employment_id}`} className="font-bold text-ink!">
                      {f.name}
                    </Link>
                    <span className="text-xs text-muted">{f.department ?? ""}</span>
                    <Tag tone={STATUS_FLEKSIBEL[f.status].tone}>{STATUS_FLEKSIBEL[f.status].label}</Tag>
                  </span>
                  <b className="text-[13px]">{f.change_types.map((k) => LABEL_FLEKSIBEL[k]).join(", ")}</b>
                  <span className="leading-snug text-[#33433F]">{f.details}</span>
                  <span className="text-xs text-muted">
                    {tr("Mulai {0}{1} · dimohon {2}", tarikh(f.start_date), f.end_date ? tr(" hingga {0}", tarikh(f.end_date)) : "", tarikh(f.created_at.slice(0, 10)))}</span>
                  {f.decision_note && <span className="text-[13px] text-subtle">{tr("Keputusan: {0}", f.decision_note)}</span>}
                </span>
                {f.status === "pending" && (
                  <span className="flex flex-col items-end gap-2">
                    <span className={`text-xs font-bold ${f.days_left <= 7 ? "text-danger" : f.days_left <= 21 ? "text-warning" : "text-subtle"}`}>
                      {f.days_left < 0 ? tr("Melepasi tempoh {0} hari", -f.days_left) : tr("{0} hari lagi untuk memberi jawapan", f.days_left)}
                    </span>
                    <span className="flex gap-2">
                      <button type="button" onClick={() => putus(f.id, f.name, false)} className="flex h-10 items-center rounded-full border border-line px-4 text-[13px] font-bold text-danger">
                        {tr("Tidak lulus")}</button>
                      <button type="button" onClick={() => putus(f.id, f.name, true)} className="flex h-10 items-center rounded-full bg-primary px-4 text-[13px] font-bold text-white">
                        {tr("Luluskan")}</button>
                    </span>
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      <TabNav />
    </Screen>
  );
}
