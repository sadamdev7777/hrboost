"use client";

import { tr } from "@/lib/i18n";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { addDays, tarikh, todayISO } from "@/lib/format";
import { getFleksibel, LABEL_FLEKSIBEL, mohonFleksibel, STATUS_FLEKSIBEL, tarikBalikFleksibel, type JenisFleksibel } from "@/lib/urusan";
import { BackHeader, ErrorBox, Screen } from "@/components/ui";
import { ButangUtama, Cip, MedanBorang, Seksyen, Tag, inputKecil } from "@/components/Senarai";
import { beritahu } from "@/components/Dialog";

/** Permohonan susunan kerja fleksibel (Akta Kerja 1955 Bahagian XIIC). */
export default function KerjaFleksibelPage() {
  const me = useMe();
  const emp = me.active!;
  const t = todayISO();
  const d = useData(() => getFleksibel(emp.companyId, true), [emp.companyId]);
  const [jenis, setJenis] = useState<JenisFleksibel[]>([]);
  const [butiran, setButiran] = useState("");
  const [mula, setMula] = useState(addDays(t, 14));
  const [tamat, setTamat] = useState("");
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const togol = (k: JenisFleksibel) => setJenis(jenis.includes(k) ? jenis.filter((x) => x !== k) : [...jenis, k]);

  async function hantar() {
    if (!jenis.length) return setRalat(tr("Pilih sekurang-kurangnya satu perubahan."));
    if (butiran.trim().length < 5) return setRalat(tr("Sila terangkan susunan kerja yang dimohon."));
    setBusy(true);
    setRalat(null);
    try {
      await mohonFleksibel(emp.id, jenis, butiran.trim(), mula, tamat || null);
      beritahu(tr("Permohonan dihantar kepada HR."));
      setJenis([]);
      setButiran("");
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
    setBusy(false);
  }

  return (
    <Screen lebar="sederhana">
      <BackHeader title={tr("Kerja fleksibel")} href="/mohon" />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-6">
        <span className="text-sm leading-snug text-subtle">
          {tr("Di bawah Akta Kerja 1955, anda boleh memohon secara bertulis untuk mengubah waktu, hari atau tempat bekerja. Majikan wajib memberi jawapan bertulis dalam tempoh 60 hari, beserta sebab jika tidak diluluskan.")}</span>
        <MedanBorang label={tr("Perkara yang ingin diubah")}>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(LABEL_FLEKSIBEL) as JenisFleksibel[]).map((k) => (
              <Cip key={k} on={jenis.includes(k)} onClick={() => togol(k)}>
                {LABEL_FLEKSIBEL[k]}
              </Cip>
            ))}
          </div>
        </MedanBorang>
        <MedanBorang label={tr("Susunan kerja yang dimohon")}>
          <textarea
            rows={4}
            value={butiran}
            onChange={(e) => setButiran(e.target.value)}
            placeholder={tr("Contoh: Bekerja dari rumah setiap Jumaat, 8 pagi hingga 5 petang, untuk menjaga anak.")}
            className="rounded-[12px] border border-[#D5DEDC] bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary"
          />
        </MedanBorang>
        <div className="grid grid-cols-2 gap-2.5">
          <MedanBorang label={tr("Mula")}>
            <input className={inputKecil} type="date" min={t} value={mula} onChange={(e) => setMula(e.target.value)} />
          </MedanBorang>
          <MedanBorang label={tr("Tamat (pilihan)")}>
            <input className={inputKecil} type="date" min={mula} value={tamat} onChange={(e) => setTamat(e.target.value)} />
          </MedanBorang>
        </div>
        {ralat && <ErrorBox message={ralat} />}
        <ButangUtama onClick={hantar} busy={busy}>
          {tr("Hantar permohonan")}</ButangUtama>

        {(d.data ?? []).length > 0 && (
          <>
            <Seksyen className="pt-2">{tr("PERMOHONAN SAYA")}</Seksyen>
            <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              {(d.data ?? []).map((f) => (
                <div key={f.id} className="flex flex-col gap-1 py-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <b className="font-bold">{f.change_types.map((k) => LABEL_FLEKSIBEL[k]).join(", ")}</b>
                    <Tag tone={STATUS_FLEKSIBEL[f.status].tone}>{STATUS_FLEKSIBEL[f.status].label}</Tag>
                  </div>
                  <span className="leading-snug text-[#33433F]">{f.details}</span>
                  <span className="text-xs text-muted">
                    {tr("Mulai {0}{1}{2}", tarikh(f.start_date), f.end_date ? tr(" hingga {0}", tarikh(f.end_date)) : "", f.status === "pending" ? tr(" · keputusan sebelum {0}", tarikh(f.due_date)) : "")}</span>
                  {f.decision_note && <span className="rounded-[10px] bg-page px-3 py-2 text-[13px]">{tr("HR: {0}", f.decision_note)}</span>}
                  {f.status === "pending" && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await tarikBalikFleksibel(f.id);
                          d.reload();
                        } catch (e) {
                          setRalat(e instanceof Error ? e.message : "Ralat");
                        }
                      }}
                      className="flex min-h-9 items-center self-start text-xs font-bold text-muted"
                    >
                      {tr("Tarik balik")}</button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </Screen>
  );
}
