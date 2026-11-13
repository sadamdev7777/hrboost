"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useData } from "@/lib/useData";
import { tarikh } from "@/lib/format";
import { ASPEK_PENILAIAN, getPenilaianPerlu, getPenilaianTerkini, LABEL_CADANGAN, putuskanPercubaan } from "@/lib/urusan";
import { Tag } from "./Senarai";
import { beritahu, sahkan } from "./Dialog";

/** Kad Utama ketua jabatan: pekerja percubaan yang perlu dinilai. */
export function KadPenilaianKetua({ companyId }: { companyId: string }) {
  const d = useData(() => getPenilaianPerlu(companyId), [companyId]);
  const xs = d.data ?? [];
  if (!xs.length) return null;
  return (
    <section aria-label={tr("Penilaian percubaan")} className="flex flex-col gap-1 rounded-card bg-surface px-4 py-3">
      <h2 className="m-0 pb-1 text-xs font-bold tracking-[0.04em] text-[#4A5A57]">{tr("PENILAIAN TEMPOH PERCUBAAN")}</h2>
      {xs.map((x) => (
        <div key={x.employment_id} className="flex min-h-12 items-center gap-3 text-sm">
          <span className="flex min-w-0 grow flex-col">
            <b className="font-bold">{x.name}</b>
            <span className={`text-xs ${x.days_left <= 7 ? "font-bold text-danger" : "text-muted"}`}>
              {tr("Tamat {0} · {1}", tarikh(x.probation_end), x.days_left < 0 ? tr("lewat {0} hari", -x.days_left) : tr("{0} hari lagi", x.days_left))}</span>
          </span>
          <Link href={`/penilaian/${x.employment_id}`} className="flex h-10 items-center rounded-full bg-primary px-4 text-[13px] font-bold text-white!">
            {tr("Nilai")}</Link>
        </div>
      ))}
    </section>
  );
}

/** Profil Pekerja (HR): penilaian ketua terkini & keputusan. */
export function PanelPercubaan({ employmentId, onTamatkan, onUbah }: { employmentId: string; onTamatkan: () => void; onUbah: () => void }) {
  const d = useData(() => getPenilaianTerkini(employmentId), [employmentId]);
  const r = d.data;
  async function putus(k: "confirmed" | "extended", bulan?: number) {
    const ok = await sahkan(
      k === "confirmed"
        ? { tajuk: tr("Sahkan jawatan?"), mesej: tr("Tempoh percubaan tamat dan jawatan disahkan mulai hari ini."), ok: tr("Sahkan jawatan") }
        : { tajuk: tr("Lanjutkan tempoh percubaan {0} bulan?", bulan), mesej: tr("Pekerja dimaklumkan."), ok: tr("Lanjutkan") },
    );
    if (!ok) return;
    try {
      await putuskanPercubaan(employmentId, k, bulan);
      beritahu(k === "confirmed" ? tr("Jawatan disahkan.") : tr("Tempoh percubaan dilanjutkan."));
      onUbah();
      d.reload();
    } catch (e) {
      beritahu(e instanceof Error ? e.message : tr("Ralat"), "ralat");
    }
  }
  return (
    <section aria-label={tr("Tempoh percubaan")} className="flex flex-col gap-2 rounded-card bg-surface px-4 py-3">
      <h2 className="m-0 text-xs font-bold tracking-[0.04em] text-[#4A5A57]">{tr("TEMPOH PERCUBAAN")}</h2>
      {!r ? (
        <span className="text-[13px] text-muted">{tr("Ketua jabatan belum menghantar penilaian. Ketua akan diingatkan 30 hari sebelum tempoh percubaan tamat.")}</span>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>
              {tr("Penilaian")}{" "}<b>{r.reviewer}</b> · {tarikh(r.submitted_at.slice(0, 10))}
            </span>
            <Tag tone={r.recommendation === "confirm" ? "success" : r.recommendation === "extend" ? "warning" : "danger"}>
              {LABEL_CADANGAN[r.recommendation]}
              {r.extend_months ? tr(" {0} bulan", r.extend_months) : ""}
            </Tag>
            {r.hr_decision && <span className="text-xs text-muted">{tr("Keputusan HR: {0}", r.hr_decision === "confirmed" ? "disahkan" : r.hr_decision === "extended" ? "dilanjutkan" : "ditamatkan")}</span>}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
            {ASPEK_PENILAIAN.map((a) => (
              <span key={a.k} className="flex justify-between gap-2">
                <span className="text-muted">{tr(a.label)}</span>
                <b>{r.ratings[a.k]}/5</b>
              </span>
            ))}
          </div>
          {r.comments && <p className="m-0 rounded-[10px] bg-page px-3 py-2 text-[13px]">{r.comments}</p>}
        </>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" onClick={() => putus("confirmed")} className="flex h-10 items-center rounded-full bg-primary px-4 text-[13px] font-bold text-white">
          {tr("Sahkan jawatan")}</button>
        <button type="button" onClick={() => putus("extended", r?.extend_months ?? 3)} className="flex h-10 items-center rounded-full border border-line px-4 text-[13px] font-bold">
          {tr("Lanjut {0} bulan", r?.extend_months ?? 3)}</button>
        <button type="button" onClick={onTamatkan} className="flex h-10 items-center rounded-full border border-line px-4 text-[13px] font-bold text-danger">
          {tr("Tamatkan")}</button>
      </div>
    </section>
  );
}
