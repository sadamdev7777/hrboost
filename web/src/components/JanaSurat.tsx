"use client";

import { tr, trRalat } from "@/lib/i18n";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useData } from "@/lib/useData";
import { addDays, tarikh, tarikhTempatan, todayISO } from "@/lib/format";
import { getSuratPekerja, keluarkanSuratHr, LABEL_SURAT_HR, labelSurat, MEDAN_SURAT_HR, type JenisSuratHr } from "@/lib/urusan";
import { ErrorBox } from "@/components/ui";
import { ButangUtama, inputKecil, Lembaran, MedanBorang, Seksyen } from "@/components/Senarai";
import { beritahu } from "@/components/Dialog";

/** Jenis surat yang boleh dijana dari profil pekerja (memo pendahuluan dijana dari Penggajian → Pendahuluan). */
export const JENIS_DARI_PROFIL: JenisSuratHr[] = [
  "offer",
  "confirmation",
  "probation_extension",
  "salary_increment",
  "resignation_accept",
  "experience",
  "warning",
  "show_cause",
];

const HURAIAN: Record<JenisSuratHr, string> = {
  offer: tr("Jawatan, gaji, tarikh mula, tempoh percubaan dan kelayakan cuti diambil daripada rekod pekerja."),
  confirmation: tr("Mengesahkan pekerja dalam jawatan selepas tempoh percubaan."),
  probation_extension: tr("Melanjutkan tempoh percubaan dengan perkara yang perlu diperbaiki."),
  salary_increment: tr("Gaji pokok lama dan baharu diambil daripada rekod gaji pekerja."),
  resignation_accept: tr("Hari bekerja terakhir dan senarai inventori yang belum dipulangkan dimasukkan secara automatik."),
  experience: tr("Tempoh perkhidmatan dan jawatan terakhir untuk rujukan majikan baharu."),
  warning: tr("Amaran bertulis atas salah laku."),
  show_cause: tr("Meminta penjelasan bertulis daripada pekerja sebelum sebarang tindakan."),
  salary_advance: tr("Memo dalaman kepada Kewangan untuk rekod."),
};

/** Nilai lalai medan tarikh */
function lalai(jenis: JenisSuratHr, probationEnd: string | null | undefined): Record<string, string> {
  const hari = todayISO();
  switch (jenis) {
    case "offer":
      return { accept_by: addDays(hari, 7) };
    case "confirmation":
      return { effective_date: probationEnd ?? hari };
    case "probation_extension": {
      const asas = probationEnd && probationEnd > hari ? probationEnd : hari;
      const d = new Date(asas + "T00:00:00");
      d.setMonth(d.getMonth() + 3);
      return { new_end_date: d.toISOString().slice(0, 10) };
    }
    case "resignation_accept":
      return { notice_date: hari };
    case "warning":
      return { warning_no: "1", incident_date: hari };
    case "show_cause":
      return { incident_date: hari, reply_by: addDays(hari, 7) };
    default:
      return {};
  }
}

/**
 * HR: jana surat untuk seorang pekerja. Data pekerja (nama penuh, jawatan, gaji, tarikh) diambil oleh sistem;
 * HR hanya mengisi medan khusus bagi jenis surat itu.
 */
export function JanaSurat({
  employmentId,
  nama,
  jenisAwal,
  jenisBoleh = JENIS_DARI_PROFIL,
  probationEnd,
  sudahBerhenti,
  pendahuluanId,
  onClose,
}: {
  employmentId: string;
  nama: string;
  jenisAwal?: JenisSuratHr;
  jenisBoleh?: JenisSuratHr[];
  probationEnd?: string | null;
  /** false = pekerja belum ada hari bekerja terakhir (surat berhenti dimatikan); undefined = tidak diketahui */
  sudahBerhenti?: boolean;
  pendahuluanId?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [jenis, setJenis] = useState<JenisSuratHr | null>(jenisAwal ?? null);
  const [nilai, setNilai] = useState<Record<string, string>>(() => (jenisAwal ? lalai(jenisAwal, probationEnd) : {}));
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const medan = useMemo(() => (jenis ? MEDAN_SURAT_HR[jenis] : []), [jenis]);
  const perluBerhenti = (j: JenisSuratHr) => (j === "resignation_accept" || j === "experience") && sudahBerhenti === false;

  function pilih(j: JenisSuratHr) {
    setJenis(j);
    setNilai(lalai(j, probationEnd));
    setRalat(null);
  }

  async function keluarkan() {
    if (!jenis) return;
    const kosong = medan.find((m) => m.wajib && !(nilai[m.k] ?? "").trim());
    if (kosong) return setRalat(tr("Sila isi: {0}", kosong.label));
    setBusy(true);
    setRalat(null);
    try {
      const id = await keluarkanSuratHr(employmentId, jenis, nilai, pendahuluanId);
      beritahu(tr("{0} dikeluarkan.", LABEL_SURAT_HR[jenis]));
      router.push(`/surat/${id}`);
    } catch (e) {
      setRalat(e instanceof Error ? trRalat(e.message) : tr("Ralat"));
      setBusy(false);
    }
  }

  return (
    <Lembaran title={jenis ? LABEL_SURAT_HR[jenis] : tr("Jana surat untuk {0}", nama)} onClose={onClose} besar>
      {!jenis ? (
        <div className="flex flex-col gap-2" role="list" aria-label={tr("Jenis surat")}>
          {jenisBoleh.map((j) => {
            const mati = perluBerhenti(j);
            return (
              <button
                key={j}
                type="button"
                role="listitem"
                disabled={mati}
                onClick={() => pilih(j)}
                className="flex min-h-14 flex-col items-start gap-0.5 rounded-[14px] border border-line bg-surface px-4 py-3 text-left hover:border-primary disabled:opacity-50"
              >
                <b className="text-sm font-bold">{LABEL_SURAT_HR[j]}</b>
                <span className="text-xs leading-snug text-muted">{mati ? tr("Tetapkan hari bekerja terakhir dahulu (Tamatkan pekerjaan).") : HURAIAN[j]}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <span className="text-[13px] leading-snug text-subtle">
            {tr("Untuk {0}.", nama)} {HURAIAN[jenis]}
          </span>
          {(jenis === "warning" || jenis === "show_cause") && (
            <div role="note" className="rounded-[12px] bg-warning-soft px-3.5 py-3 text-[13px] leading-snug text-warning">
              <b className="font-bold">{tr("Penting:")}</b>{" "}
              {tr("Akta Kerja 1955 s.14 — tindakan tatatertib memerlukan siasatan wajar dan peluang untuk pekerja memberi penjelasan. Templat ini ialah draf; semak dengan penasihat undang-undang sebelum digunakan.")}
            </div>
          )}
          {medan.map((m) => (
            <MedanBorang key={m.k} label={m.label} nota={m.nota}>
              {m.jenis === "textarea" ? (
                <textarea
                  className={`${inputKecil} min-h-24 py-2 leading-snug`}
                  rows={4}
                  value={nilai[m.k] ?? ""}
                  onChange={(e) => setNilai({ ...nilai, [m.k]: e.target.value })}
                />
              ) : m.jenis === "select" ? (
                <select className={inputKecil} value={nilai[m.k] ?? ""} onChange={(e) => setNilai({ ...nilai, [m.k]: e.target.value })}>
                  {m.pilihan?.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={m.jenis === "date" ? "date" : "text"}
                  className={inputKecil}
                  value={nilai[m.k] ?? ""}
                  onChange={(e) => setNilai({ ...nilai, [m.k]: e.target.value })}
                />
              )}
            </MedanBorang>
          ))}
          <span className="text-xs leading-snug text-muted">
            {jenis === "salary_advance"
              ? tr("Memo dijana dengan nama anda dan nombor rujukan baharu. Kewangan dimaklumkan; memo ini tidak dipaparkan kepada pekerja.")
              : tr("Surat dijana dengan nama anda sebagai penandatangan dan nombor rujukan baharu. Pekerja dimaklumkan dan boleh memuat turun surat di Mohon → Surat.")}
          </span>
          {ralat && <ErrorBox message={ralat} />}
          <div className="flex gap-2">
            {!jenisAwal && (
              <button type="button" onClick={() => setJenis(null)} className="h-12 shrink-0 rounded-button border border-line bg-surface px-5 text-sm font-bold">
                {tr("Kembali")}
              </button>
            )}
            <span className="grow">
              <ButangUtama onClick={keluarkan} busy={busy}>
                {tr("Keluarkan surat")}
              </ButangUtama>
            </span>
          </div>
        </div>
      )}
    </Lembaran>
  );
}

/** Senarai surat seorang pekerja (profil pekerja — HR). */
export function SenaraiSuratPekerja({ employmentId, kunci }: { employmentId: string; kunci?: number }) {
  const d = useData(() => getSuratPekerja(employmentId), [employmentId, kunci]);
  const senarai = (d.data ?? []).filter((s) => s.status === "issued");
  if (!senarai.length) return null;
  return (
    <section aria-label={tr("Surat")} className="flex flex-col gap-2">
      <Seksyen>{tr("SURAT · {0}", senarai.length)}</Seksyen>
      <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
        {senarai.slice(0, 8).map((s) => (
          <Link key={s.id} href={`/surat/${s.id}`} className="flex min-h-12 items-center gap-3 py-2.5 text-sm text-ink!">
            <span className="flex min-w-0 grow flex-col">
              <b className="truncate font-bold">{labelSurat(s.kind)}</b>
              <span className="text-xs text-muted">
                {[s.ref_no, s.issued_at ? tarikh(tarikhTempatan(s.issued_at)) : null, s.source === "hr" ? s.issued_by : tr("Atas permintaan pekerja")].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span aria-hidden="true" className="text-muted">›</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
