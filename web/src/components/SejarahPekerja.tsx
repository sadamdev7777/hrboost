"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { masa, tarikh, tarikhTempatan } from "@/lib/format";
import { LABEL_PERANAN, labelJenis } from "@/lib/hr";
import { ErrorBox, Loading } from "./ui";
import { Suis } from "./Senarai";

type Baris = { at: string; kind: "change" | "event" | "access"; field: string; old_value: string | null; new_value: string | null; note: string | null; actor: string | null };

const STATUS: Record<string, string> = { probation: "Percubaan", active: "Aktif", resigned: "Letak jawatan", terminated: "Ditamatkan", retired: "Bersara" };
const CADANGAN: Record<string, string> = { confirm: "sahkan jawatan", extend: "lanjutkan percubaan", terminate: "tamatkan perkhidmatan" };
const AKSES: Record<string, string> = {
  salary: "Melihat / mengubah gaji",
  profile: "Melihat profil & maklumat peribadi",
  sensitive: "Melihat maklumat peribadi",
  payslip: "Membuka slip gaji",
  bank: "Melihat akaun bank",
  ic: "Melihat kad pengenalan",
  mc: "Melihat sijil cuti sakit",
  document: "Membuka dokumen",
  payroll_report: "Laporan kos gaji",
  salary_letter: "Mengeluarkan surat pengesahan gaji",
};
const BLN = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];
const tk = (iso: string | null) => (iso ? `${Number(iso.slice(8, 10))} ${BLN[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : "tiada");

/** Ayat BM bagi satu baris sejarah. */
function ayat(b: Baris): { tajuk: string; butiran?: string } {
  const lama = b.old_value;
  const baru = b.new_value;
  if (b.kind === "access") return { tajuk: AKSES[b.field] ?? `Akses: ${b.field}`, butiran: b.note === "web" ? undefined : `melalui ${b.note}` };
  if (b.kind === "event") {
    if (b.field === "joined") return { tajuk: "Rekod pekerja dicipta", butiran: `Tarikh mula bekerja ${tk(baru)}` };
    if (b.field === "letter") return { tajuk: `${b.note} dikeluarkan`, butiran: `Rujukan ${baru}` };
    if (b.field === "probation_review") return { tajuk: `Penilaian percubaan: cadangan ${CADANGAN[baru ?? ""] ?? baru}`, butiran: b.note ?? undefined };
    if (b.field === "document") return { tajuk: `Dokumen dimuat naik: ${baru}` };
  }
  if (b.field.startsWith("pay:"))
    return { tajuk: lama ? `${b.note?.split(" mulai ")[0]}: RM${lama} → RM${baru}` : `${b.note?.split(" mulai ")[0]} ditetapkan RM${baru}`, butiran: b.note?.includes(" mulai ") ? `Berkuat kuasa ${b.note.split(" mulai ")[1]}` : undefined };
  switch (b.field) {
    case "department":
      return { tajuk: `Jabatan: ${lama ?? "tiada"} → ${baru ?? "tiada"}` };
    case "position":
      return { tajuk: `Jawatan: ${lama ?? "tiada"} → ${baru ?? "tiada"}` };
    case "employment_type":
      return { tajuk: `Jenis pekerjaan: ${lama ? labelJenis(lama) : "-"} → ${baru ? labelJenis(baru) : "-"}` };
    case "status":
      return { tajuk: `Status: ${STATUS[lama ?? ""] ?? lama} → ${STATUS[baru ?? ""] ?? baru}` };
    case "probation_end":
      return { tajuk: `Tamat percubaan: ${tk(lama)} → ${tk(baru)}` };
    case "contract_end":
      return { tajuk: `Tamat kontrak: ${tk(lama)} → ${tk(baru)}` };
    case "end_date":
      return { tajuk: baru ? `Hari bekerja terakhir ditetapkan ${tk(baru)}` : "Penamatan dibatalkan", butiran: baru && b.note ? STATUS[b.note] : undefined };
    case "work_start":
      return { tajuk: `Waktu masuk kerja: ${lama ?? "ikut syarikat"} → ${baru ?? "ikut syarikat"}` };
    case "role":
      return { tajuk: baru ? `Peranan ${LABEL_PERANAN[baru] ?? baru} diberi` : `Peranan ${LABEL_PERANAN[lama ?? ""] ?? lama} ditarik balik` };
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
          <b className="text-sm font-bold">Termasuk log akses data</b>
          <span className="text-xs text-muted">Siapa melihat gaji dan maklumat peribadi pekerja ini (PDPA).</span>
        </span>
        <Suis on={akses} onChange={setAkses} label="Termasuk log akses data" />
      </div>
      {d.error && <ErrorBox message={d.error} />}
      {!d.data && !d.error && <Loading />}
      {d.data && d.data.length === 0 && <span className="text-sm text-muted">Tiada sejarah.</span>}
      {d.data && d.data.length > 0 && (
        <ol aria-label="Sejarah perubahan" className="m-0 flex list-none flex-col rounded-card bg-surface px-4 py-1 lg:px-5">
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
                    {b.actor ? ` · ${b.actor}` : b.kind === "change" ? " · sistem" : ""}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <span className="text-xs text-muted">Sejarah perubahan direkodkan mulai November 2026. Rekod gaji terdahulu dipaparkan daripada data gaji sedia ada.</span>
    </div>
  );
}
