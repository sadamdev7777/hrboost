"use client";

import Link from "next/link";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { tarikh, tarikhTempatan } from "@/lib/format";
import { batalSurat, getSurat, LABEL_SURAT, mohonSurat, STATUS_SURAT, type JenisSurat } from "@/lib/urusan";
import { BackHeader, ErrorBox, Screen } from "@/components/ui";
import { ButangUtama, Cip, MedanBorang, Seksyen, Tag, inputKecil } from "@/components/Senarai";
import { beritahu } from "@/components/Dialog";


/** Permohonan surat oleh pekerja: HR mengeluarkan surat bertandatangan (PDF). */
export default function MohonSuratPage() {
  const me = useMe();
  const emp = me.active!;
  const d = useData(() => getSurat(emp.companyId, true), [emp.companyId]);
  const [jenis, setJenis] = useState<JenisSurat>("employment");
  const [tujuan, setTujuan] = useState("");
  const [kepada, setKepada] = useState("");
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);

  async function hantar() {
    if (!tujuan.trim()) return setRalat("Sila nyatakan tujuan surat.");
    setBusy(true);
    setRalat(null);
    try {
      await mohonSurat(emp.id, jenis, tujuan.trim(), kepada.trim());
      beritahu("Permohonan surat dihantar kepada HR.");
      setTujuan("");
      setKepada("");
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
    }
    setBusy(false);
  }

  async function batal(id: string) {
    try {
      await batalSurat(id);
      beritahu("Permohonan dibatalkan.");
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
    }
  }

  return (
    <Screen lebar="sederhana">
      <BackHeader title="Surat" href="/mohon" />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-6">
        <MedanBorang label="Jenis surat">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(LABEL_SURAT) as JenisSurat[]).map((k) => (
              <Cip key={k} on={jenis === k} onClick={() => setJenis(k)}>
                {LABEL_SURAT[k]}
              </Cip>
            ))}
          </div>
        </MedanBorang>
        <span className="text-xs leading-snug text-muted">
          {jenis === "salary"
            ? "Mengesahkan jawatan, tarikh mula bekerja serta gaji pokok dan elaun tetap anda."
            : "Mengesahkan anda bekerja di syarikat ini: jawatan, jabatan dan tarikh mula bekerja (tanpa maklumat gaji)."}
        </span>
        <MedanBorang label="Tujuan">
          <input className={inputKecil} value={tujuan} onChange={(e) => setTujuan(e.target.value)} placeholder="Contoh: Permohonan pinjaman perumahan" />
        </MedanBorang>
        <MedanBorang label="Ditujukan kepada (pilihan)">
          <input className={inputKecil} value={kepada} onChange={(e) => setKepada(e.target.value)} placeholder="Contoh: Maybank Berhad" />
        </MedanBorang>
        {ralat && <ErrorBox message={ralat} />}
        <ButangUtama onClick={hantar} busy={busy}>
          Mohon surat
        </ButangUtama>

        {(d.data ?? []).length > 0 && (
          <>
            <Seksyen className="pt-3">PERMOHONAN SAYA</Seksyen>
            <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              {(d.data ?? []).map((s) => (
                <div key={s.id} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                  <span className="flex min-w-0 grow basis-48 flex-col gap-0.5">
                    <b className="font-bold">{LABEL_SURAT[s.kind]}</b>
                    <span className="text-xs text-muted">
                      {s.purpose} · {tarikh(tarikhTempatan(s.created_at))}
                      {s.reject_reason ? ` · ${s.reject_reason}` : ""}
                    </span>
                  </span>
                  <Tag tone={STATUS_SURAT[s.status].tone}>{STATUS_SURAT[s.status].label}</Tag>
                  {s.status === "issued" && (
                    <Link href={`/surat/${s.id}`} className="flex h-9 items-center rounded-full bg-primary px-3.5 text-xs font-bold text-white!">
                      Muat turun
                    </Link>
                  )}
                  {s.status === "pending" && (
                    <button type="button" onClick={() => batal(s.id)} className="flex h-9 items-center px-2 text-xs font-bold text-muted">
                      Batal
                    </button>
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
