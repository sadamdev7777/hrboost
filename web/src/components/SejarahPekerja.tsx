"use client";

import { tr } from "@/lib/i18n";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { masa, tarikh, tarikhTempatan } from "@/lib/format";
import { LABEL_PERANAN, labelJenis } from "@/lib/hr";
import { ErrorBox, Loading } from "./ui";
import { Suis } from "./Senarai";

type Baris = { at: string; kind: "change" | "event" | "access"; field: string; old_value: string | null; new_value: string | null; note: string | null; actor: string | null };

const STATUS: Record<string, string> = { probation: tr("Percubaan"), active: tr("Aktif"), resigned: tr("Letak jawatan"), terminated: tr("Ditamatkan"), retired: tr("Bersara") };
const CADANGAN: Record<string, string> = { confirm: tr("sahkan jawatan"), extend: tr("lanjutkan percubaan"), terminate: tr("tamatkan perkhidmatan") };
const AKSES: Record<string, string> = {
  salary: tr("Melihat / mengubah gaji"),
  profile: tr("Melihat profil & maklumat peribadi"),
  sensitive: tr("Melihat maklumat peribadi"),
  payslip: tr("Membuka slip gaji"),
  bank: tr("Melihat akaun bank"),
  ic: tr("Melihat kad pengenalan"),
  mc: tr("Melihat sijil cuti sakit"),
  document: tr("Membuka dokumen"),
  payroll_report: tr("Laporan kos gaji"),
  salary_letter: tr("Mengeluarkan surat pengesahan gaji"),
};
const BLN = [tr("Jan"), tr("Feb"), tr("Mac"), tr("Apr"), tr("Mei"), tr("Jun"), tr("Jul"), tr("Ogo"), tr("Sep"), tr("Okt"), tr("Nov"), tr("Dis")];
const tk = (iso: string | null) => (iso ? `${Number(iso.slice(8, 10))} ${BLN[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : "tiada");

/** Ayat BM bagi satu baris sejarah. */
function ayat(b: Baris): { tajuk: string; butiran?: string } {
  const lama = b.old_value;
  const baru = b.new_value;
  if (b.kind === "access") return { tajuk: AKSES[b.field] ?? tr("Akses: {0}", b.field), butiran: b.note === "web" ? undefined : tr("melalui {0}", b.note) };
  if (b.kind === "event") {
    if (b.field === "joined") return { tajuk: tr("Rekod pekerja dicipta"), butiran: tr("Tarikh mula bekerja {0}", tk(baru)) };
    if (b.field === "letter") return { tajuk: tr("{0} dikeluarkan", b.note), butiran: tr("Rujukan {0}", baru) };
    if (b.field === "probation_review") return { tajuk: tr("Penilaian percubaan: cadangan {0}", CADANGAN[baru ?? ""] ?? baru), butiran: b.note ?? undefined };
    if (b.field === "document") return { tajuk: tr("Dokumen dimuat naik: {0}", baru) };
  }
  if (b.field.startsWith("pay:"))
    return { tajuk: lama ? tr("{0}: RM{1} → RM{2}", b.note?.split(" mulai ")[0], lama, baru) : tr("{0} ditetapkan RM{1}", b.note?.split(" mulai ")[0], baru), butiran: b.note?.includes(" mulai ") ? tr("Berkuat kuasa {0}", b.note.split(" mulai ")[1]) : undefined };
  switch (b.field) {
    case "department":
      return { tajuk: tr("Jabatan: {0} → {1}", lama ?? "tiada", baru ?? "tiada") };
    case "position":
      return { tajuk: tr("Jawatan: {0} → {1}", lama ?? "tiada", baru ?? "tiada") };
    case "employment_type":
      return { tajuk: tr("Jenis pekerjaan: {0} → {1}", lama ? labelJenis(lama) : "-", baru ? labelJenis(baru) : "-") };
    case "status":
      return { tajuk: tr("Status: {0} → {1}", STATUS[lama ?? ""] ?? lama, STATUS[baru ?? ""] ?? baru) };
    case "probation_end":
      return { tajuk: tr("Tamat percubaan: {0} → {1}", tk(lama), tk(baru)) };
    case "contract_end":
      return { tajuk: tr("Tamat kontrak: {0} → {1}", tk(lama), tk(baru)) };
    case "end_date":
      return { tajuk: baru ? tr("Hari bekerja terakhir ditetapkan {0}", tk(baru)) : tr("Penamatan dibatalkan"), butiran: baru && b.note ? STATUS[b.note] : undefined };
    case "work_start":
      return { tajuk: tr("Waktu masuk kerja: {0} → {1}", lama ?? tr("ikut syarikat"), baru ?? tr("ikut syarikat")) };
    case "role":
      return { tajuk: baru ? tr("Peranan {0} diberi", LABEL_PERANAN[baru] ?? baru) : tr("Peranan {0} ditarik balik", LABEL_PERANAN[lama ?? ""] ?? lama) };
  }
  return { tajuk: `${b.field}: ${lama ?? "-"} → ${baru ?? "-"}` };
}

/** Tab Sejarah dalam Profil Pekerja: garis masa perubahan rekod (HR sahaja). */
export function SejarahPekerja({ employmentId }: { employmentId: string }) {
  const [akses, setAkses] = useState(false);
  const d = useData(
    async () => (must(await getSupabase().rpc("employment_history", { p_employment: employmentId, p_include_access: akses })) ?? []) as Baris[],
    [employmentId, akses],
  );
  return (
    <div className="flex flex-col gap-3 lg:max-w-[760px]">
      <div className="flex items-center gap-3 rounded-card bg-surface px-4 py-2">
        <span className="flex grow flex-col gap-0.5">
          <b className="text-sm font-bold">{tr("Termasuk log akses data")}</b>
          <span className="text-xs text-muted">{tr("Siapa melihat gaji dan maklumat peribadi pekerja ini (PDPA).")}</span>
        </span>
        <Suis on={akses} onChange={setAkses} label={tr("Termasuk log akses data")} />
      </div>
      {d.error && <ErrorBox message={d.error} />}
      {!d.data && !d.error && <Loading />}
      {d.data && d.data.length === 0 && <span className="text-sm text-muted">{tr("Tiada sejarah.")}</span>}
      {d.data && d.data.length > 0 && (
        <ol aria-label={tr("Sejarah perubahan")} className="m-0 flex list-none flex-col rounded-card bg-surface px-4 py-1 lg:px-5">
          {d.data.map((b, i) => {
            const a = ayat(b);
            return (
              <li key={i} className="relative flex gap-3 py-2.5 text-sm [&+&]:border-t [&+&]:border-[#EEF2F1]">
                <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${b.kind === "access" ? "bg-[#C9D3D1]" : b.kind === "event" ? "bg-ai" : "bg-primary"}`} />
                <span className="flex min-w-0 grow flex-col gap-0.5">
                  <b className={`font-semibold ${b.kind === "access" ? "text-subtle" : ""}`}>{a.tajuk}</b>
                  {a.butiran && <span className="text-xs text-subtle">{a.butiran}</span>}
                  <span className="text-xs text-muted">
                    {tarikh(tarikhTempatan(b.at))}, {masa(b.at)}
                    {b.actor ? ` · ${b.actor}` : b.kind === "change" ? tr(" · sistem") : ""}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <span className="text-xs text-muted">{tr("Sejarah perubahan direkodkan mulai November 2026. Rekod gaji terdahulu dipaparkan daripada data gaji sedia ada.")}</span>
    </div>
  );
}
