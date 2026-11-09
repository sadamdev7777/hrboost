"use client";

import { tr } from "@/lib/i18n";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { tarikh } from "@/lib/format";
import { ASPEK_PENILAIAN, getPenilaianPerlu, hantarPenilaian, LABEL_CADANGAN, type CadanganPercubaan } from "@/lib/urusan";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { ButangUtama, Cip, MedanBorang } from "@/components/Senarai";
import { beritahu } from "@/components/Dialog";

const SKALA = [tr("Lemah"), tr("Kurang memuaskan"), tr("Memuaskan"), tr("Baik"), tr("Cemerlang")];

/** Borang penilaian akhir tempoh percubaan oleh ketua jabatan → keputusan HR. */
export default function PenilaianPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const emp = me.active!;
  const router = useRouter();
  const d = useData(() => getPenilaianPerlu(emp.companyId), [emp.companyId]);
  const orang = d.data?.find((x) => x.employment_id === id);
  const [markah, setMarkah] = useState<Record<string, number>>({});
  const [cadangan, setCadangan] = useState<CadanganPercubaan>("confirm");
  const [bulan, setBulan] = useState(3);
  const [ulasan, setUlasan] = useState("");
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);

  async function hantar() {
    if (ASPEK_PENILAIAN.some((a) => !markah[a.k])) return setRalat(tr("Sila beri penilaian bagi setiap aspek."));
    if (cadangan !== "confirm" && ulasan.trim().length < 5) return setRalat(tr("Sila nyatakan sebab cadangan anda."));
    setBusy(true);
    setRalat(null);
    try {
      await hantarPenilaian(id, markah, cadangan, cadangan === "extend" ? bulan : null, ulasan.trim());
      beritahu(tr("Penilaian dihantar kepada HR."));
      router.push("/utama");
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
      setBusy(false);
    }
  }

  return (
    <Screen lebar="sederhana">
      <BackHeader title={tr("Penilaian percubaan")} href="/utama" />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-4">
        {d.error && <ErrorBox message={d.error} />}
        {!d.data && !d.error && <Loading />}
        {d.data && !orang && <div className="rounded-card bg-surface px-4 py-6 text-sm text-muted">{tr("Penilaian ini telah dihantar atau tidak lagi diperlukan.")}</div>}
        {orang && (
          <>
            <div className="flex flex-col gap-0.5 rounded-card bg-surface px-4 py-3">
              <b className="text-base font-extrabold">{orang.name}</b>
              <span className="text-[13px] text-muted">
                {tr("Tempoh percubaan tamat {0} ({1})", tarikh(orang.probation_end), orang.days_left < 0 ? tr("lewat {0} hari", -orang.days_left) : tr("{0} hari lagi", orang.days_left))}</span>
            </div>
            {ASPEK_PENILAIAN.map((a) => (
              <MedanBorang key={a.k} label={a.label}>
                <div role="radiogroup" aria-label={a.label} className="grid grid-cols-5 gap-1.5">
                  {SKALA.map((s, i) => {
                    const n = i + 1;
                    const on = markah[a.k] === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        aria-label={`${tr(a.label)}: ${n} ${s}`}
                        onClick={() => setMarkah({ ...markah, [a.k]: n })}
                        className={`flex min-h-12 flex-col items-center justify-center rounded-[12px] border text-[11px] leading-tight font-semibold ${on ? "border-primary bg-primary text-white" : "border-line bg-surface text-subtle"}`}
                      >
                        <b className="text-base">{n}</b>
                        <span className="hidden sm:block">{s}</span>
                      </button>
                    );
                  })}
                </div>
              </MedanBorang>
            ))}
            <MedanBorang label={tr("Cadangan anda")}>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(LABEL_CADANGAN) as CadanganPercubaan[]).map((k) => (
                  <Cip key={k} on={cadangan === k} onClick={() => setCadangan(k)}>
                    {LABEL_CADANGAN[k]}
                  </Cip>
                ))}
              </div>
            </MedanBorang>
            {cadangan === "extend" && (
              <MedanBorang label={tr("Lanjutkan selama")}>
                <div className="flex gap-2">
                  {[1, 2, 3, 6].map((n) => (
                    <Cip key={n} on={bulan === n} onClick={() => setBulan(n)}>
                      {tr("{0} bulan", n)}
                    </Cip>
                  ))}
                </div>
              </MedanBorang>
            )}
            <MedanBorang label={cadangan === "confirm" ? tr("Ulasan (pilihan)") : tr("Sebab cadangan")}>
              <textarea
                rows={3}
                value={ulasan}
                onChange={(e) => setUlasan(e.target.value)}
                className="rounded-[12px] border border-[#D5DEDC] bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary"
              />
            </MedanBorang>
            <span className="text-xs leading-snug text-muted">{tr("Penilaian ini dihantar kepada HR untuk keputusan muktamad. Pekerja tidak melihat penilaian ini.")}</span>
            {ralat && <ErrorBox message={ralat} />}
          </>
        )}
      </main>
      {orang && (
        <div className="bar-bawah sticky bottom-0 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
          <ButangUtama onClick={hantar} busy={busy}>
            {tr("Hantar penilaian")}</ButangUtama>
        </div>
      )}
    </Screen>
  );
}
