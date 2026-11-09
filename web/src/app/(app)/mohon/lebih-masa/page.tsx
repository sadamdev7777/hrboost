"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { addDays, hari, ringgit, tarikh, todayISO } from "@/lib/format";
import { getLebihMasaSaya, getOtDigunakan, LABEL_HARI, mohonLebihMasa, type JenisHari } from "@/lib/urusan";
import { BackHeader, ErrorBox, Screen, StatusPill } from "@/components/ui";
import { ButangUtama, Cip, MedanBorang, Seksyen, inputKecil } from "@/components/Senarai";
import { beritahu } from "@/components/Dialog";
import type { StatusPermohonan } from "@/lib/format";

/** Mohon bayaran kerja lebih masa (Akta Kerja 1955 s.60A). */
export default function LebihMasaPage() {
  const me = useMe();
  const emp = me.active!;
  const router = useRouter();
  const t = todayISO();
  const [tarikhOT, setTarikhOT] = useState(addDays(t, -1));
  const [jam, setJam] = useState("2");
  const [jenis, setJenis] = useState<JenisHari>("normal");
  const [sebab, setSebab] = useState("");
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const sejarah = useData(() => getLebihMasaSaya(emp.id), [emp.id]);
  const digunakan = useData(() => getOtDigunakan(emp.companyId), [emp.companyId]);

  async function hantar() {
    const j = Number(jam);
    if (!(j > 0 && j <= 12)) return setRalat(tr("Jam kerja lebih masa mesti antara 0.5 dan 12."));
    if (!sebab.trim()) return setRalat(tr("Sila nyatakan kerja yang dilakukan."));
    setBusy(true);
    setRalat(null);
    try {
      const o = (await mohonLebihMasa(emp.id, tarikhOT, j, jenis, sebab.trim())) as { approval_request_id?: string };
      beritahu(tr("Permohonan kerja lebih masa dihantar kepada ketua jabatan."));
      router.push(o.approval_request_id ? `/permohonan/${o.approval_request_id}` : "/permohonan");
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
      setBusy(false);
    }
  }

  return (
    <Screen lebar="sederhana">
      <BackHeader title={tr("Kerja lebih masa")} href="/mohon" />
      {digunakan.data === false && (
        <main className="flex grow flex-col gap-3 px-4 pt-1 pb-4">
          <div className="rounded-card bg-surface px-4 py-6 text-sm text-muted">{tr("Kerja lebih masa tidak digunakan di syarikat ini. Hubungi HR jika anda perlu bekerja lebih masa.")}</div>
        </main>
      )}
      {digunakan.data && (
      <>
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-4">
        <MedanBorang label={tr("Tarikh")}>
          <input className={inputKecil} type="date" value={tarikhOT} max={t} min={addDays(t, -60)} onChange={(e) => setTarikhOT(e.target.value)} />
        </MedanBorang>
        <MedanBorang label={tr("Jenis hari")}>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(LABEL_HARI) as JenisHari[]).map((k) => (
              <Cip key={k} on={jenis === k} onClick={() => setJenis(k)}>
                {LABEL_HARI[k].label}
              </Cip>
            ))}
          </div>
        </MedanBorang>
        <MedanBorang label={tr("Bilangan jam")} nota={tr("Dibayar {0} (gaji pokok ÷ 26 ÷ 8 jam).", LABEL_HARI[jenis].kadar)}>
          <input className={`${inputKecil} w-28`} inputMode="decimal" value={jam} onChange={(e) => setJam(e.target.value.replace(/[^\d.]/g, ""))} aria-label={tr("Bilangan jam")} />
        </MedanBorang>
        <MedanBorang label={tr("Kerja yang dilakukan")}>
          <textarea
            rows={3}
            value={sebab}
            onChange={(e) => setSebab(e.target.value)}
            placeholder={tr("Contoh: Menyambut kumpulan pelancong di KLIA sehingga 11 malam")}
            className="rounded-[12px] border border-[#D5DEDC] bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary"
          />
        </MedanBorang>
        {ralat && <ErrorBox message={ralat} />}
        <span className="text-xs leading-snug text-muted">
          {tr("Selepas diluluskan oleh ketua jabatan, bayaran dimasukkan secara automatik ke dalam gaji bulan tersebut. Tuntutan mesti dibuat dalam tempoh 60 hari.")}</span>

        {(sejarah.data ?? []).length > 0 && (
          <>
            <Seksyen className="pt-2">{tr("PERMOHONAN TERDAHULU")}</Seksyen>
            <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              {(sejarah.data ?? []).slice(0, 8).map((o) => (
                <Link key={o.id} href={o.approval_request_id ? `/permohonan/${o.approval_request_id}` : "#"} className="flex min-h-12 items-center gap-3 py-2 text-sm text-ink!">
                  <span className="flex grow flex-col gap-0.5">
                    <b className="font-bold">
                      {tr("{0} · {1} jam", tarikh(o.work_date), hari(Number(o.hours)))}</b>
                    <span className="text-xs text-muted">
                      {LABEL_HARI[o.day_type as JenisHari]?.label}
                      {o.amount != null ? ` · ${ringgit(Number(o.amount))}` : ""}
                    </span>
                  </span>
                  <StatusPill status={o.status as StatusPermohonan} />
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
      <div className="bar-bawah sticky bottom-0 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
        <ButangUtama onClick={hantar} busy={busy}>
          {tr("Hantar permohonan")}</ButangUtama>
      </div>
      </>
      )}
    </Screen>
  );
}
