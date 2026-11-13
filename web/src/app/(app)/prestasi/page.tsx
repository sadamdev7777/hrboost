"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { tarikh } from "@/lib/format";
import { getPenilaianSaya, LABEL_STATUS_PENILAIAN, markahTeks } from "@/lib/prestasi";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { Seksyen, Tag } from "@/components/Senarai";

/** Penilaian prestasi: penilaian saya sendiri & pekerja yang perlu saya nilai. */
export default function PrestasiPage() {
  const me = useMe();
  const cid = me.active!.companyId;
  const d = useData(() => getPenilaianSaya(cid), [cid]);
  const sendiri = (d.data ?? []).filter((x) => x.role === "self");
  const nilai = (d.data ?? []).filter((x) => x.role === "reviewer");
  const baris = (x: (typeof sendiri)[number]) => {
    const st = LABEL_STATUS_PENILAIAN[x.status];
    const perlu = (x.role === "self" && x.status === "self") || (x.role === "reviewer" && x.status === "manager");
    return (
      <Link key={x.id} href={`/prestasi/${x.id}`} className="flex min-h-[60px] items-center gap-3 py-2.5 text-ink!">
        <span className="flex grow flex-col gap-0.5">
          <b className="text-sm font-bold">{x.role === "reviewer" ? x.employee : x.cycle_name}</b>
          <span className="text-xs text-muted">
            {x.role === "reviewer" ? x.cycle_name : tr("Tempoh hingga {0}", tarikh(x.period_end))}
            {perlu && x.due ? " · " + tr("sebelum {0}", tarikh(x.due)) : ""}
            {x.status === "final" && x.final_rating != null ? " · " + tr("Markah {0}/5", markahTeks(x.final_rating)) : ""}
          </span>
        </span>
        <Tag tone={perlu ? "warning" : st.tone}>{perlu ? tr("Perlu diisi") : st.l}</Tag>
      </Link>
    );
  };
  return (
    <Screen lebar="sederhana">
      <BackHeader title={tr("Penilaian prestasi")} href="/saya" />
      <main className="flex grow flex-col gap-2.5 px-4 pt-1 pb-6">
        {d.error && <ErrorBox message={d.error} />}
        {!d.data && !d.error && <Loading />}
        {d.data && d.data.length === 0 && (
          <div className="rounded-card bg-surface px-4 py-6 text-sm text-muted">{tr("Tiada penilaian prestasi buat masa ini. Anda akan dimaklumkan apabila kitaran penilaian dibuka.")}</div>
        )}
        {nilai.length > 0 && (
          <>
            <Seksyen>{tr("PERLU SAYA NILAI")}</Seksyen>
            <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">{nilai.map(baris)}</div>
          </>
        )}
        {sendiri.length > 0 && (
          <>
            <Seksyen className="pt-1">{tr("PENILAIAN SAYA")}</Seksyen>
            <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">{sendiri.map(baris)}</div>
          </>
        )}
      </main>
    </Screen>
  );
}
