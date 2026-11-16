"use client";

import { tr, trRalat } from "@/lib/i18n";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { tarikh, tarikhTempatan } from "@/lib/format";
import { getRekodDipadam, LABEL_ENTITI, pulihkanRekod, type EntitiPadam } from "@/lib/padam";
import { beritahu, sahkan } from "@/components/Dialog";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { HadPeranan, inputKecil, Tag } from "@/components/Senarai";

/** Tetapan → Rekod dipadam: semua rekod yang dipadam dalam syarikat, dengan butang Pulihkan. Disimpan kekal. */
export default function RekodDipadamPage() {
  return (
    <HadPeranan roles={["hr", "admin"]} back="/pengurusan/tetapan">
      <Kandungan />
    </HadPeranan>
  );
}

function Kandungan() {
  const me = useMe();
  const cid = me.active!.companyId;
  const [semua, setSemua] = useState(false);
  const [jenis, setJenis] = useState("");
  const [cari, setCari] = useState("");
  const [sibuk, setSibuk] = useState<string | null>(null);
  const d = useData(() => getRekodDipadam(cid, semua), [cid, semua]);
  const label = LABEL_ENTITI();
  const rows = d.data ?? [];
  const jenisAda = [...new Set(rows.map((r) => r.entity))];
  const q = cari.trim().toLowerCase();
  const tapis = rows.filter((r) => (!jenis || r.entity === jenis) && (!q || `${r.label} ${r.detail ?? ""} ${r.reason ?? ""}`.toLowerCase().includes(q)));

  async function pulih(id: string, nama: string) {
    if (!(await sahkan({ tajuk: tr("Pulihkan {0}?", nama), mesej: tr("Rekod dikembalikan seperti sebelum dipadam."), ok: tr("Pulihkan") }))) return;
    setSibuk(id);
    try {
      await pulihkanRekod(id);
      beritahu(tr("Dipulihkan."));
      d.reload();
    } catch (e) {
      beritahu(e instanceof Error ? trRalat(e.message) : tr("Ralat"), "ralat");
    }
    setSibuk(null);
  }

  return (
    <Screen lebar="lebar">
      <BackHeader title={tr("Rekod dipadam")} href="/pengurusan/tetapan" />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-6 lg:px-0">
        <span className="text-sm leading-normal text-subtle">
          {tr("Setiap rekod yang dipadam disimpan di sini bersama siapa yang memadam, bila dan sebabnya. Tekan Pulihkan untuk mengembalikannya. Rekod gaji, pekerja dan permohonan yang telah dihantar tidak boleh dipadam.")}
        </span>
        <div className="flex flex-wrap gap-2">
          <input className={`${inputKecil} min-w-0 grow basis-56`} value={cari} onChange={(e) => setCari(e.target.value)} placeholder={tr("Cari nama, rujukan atau sebab")} aria-label={tr("Cari rekod dipadam")} />
          <select className={`${inputKecil} grow basis-44`} value={jenis} onChange={(e) => setJenis(e.target.value)} aria-label={tr("Jenis rekod")}>
            <option value="">{tr("Semua jenis")}</option>
            {jenisAda.map((k) => (
              <option key={k} value={k}>
                {label[k as EntitiPadam] ?? k}
              </option>
            ))}
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="size-5 accent-primary" checked={semua} onChange={(e) => setSemua(e.target.checked)} />
          {tr("Tunjukkan juga rekod yang telah dipulihkan")}
        </label>
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data && <Loading />}
        {d.data && tapis.length === 0 && <div className="rounded-card bg-surface px-4 py-8 text-center text-sm text-muted">{tr("Tiada rekod dipadam.")}</div>}
        {tapis.length > 0 && (
          <div className="flex flex-col rounded-card bg-surface px-4 lg:px-5 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
            {tapis.map((r) => (
              <div key={r.id} className="flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 py-3 text-sm">
                <span className="flex min-w-0 grow basis-64 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <Tag tone="neutral">{label[r.entity] ?? r.entity}</Tag>
                    <b className="font-bold">{r.label}</b>
                  </span>
                  {r.detail && <span className="text-[13px] text-subtle">{r.detail}</span>}
                  <span className="text-xs text-muted">
                    {tr("Dipadam oleh {0} pada {1}", r.deleted_by ?? "-", tarikh(tarikhTempatan(r.deleted_at)))}
                    {r.reason ? tr(" · Sebab: {0}", r.reason) : ""}
                  </span>
                  {r.restored_at && <span className="text-xs font-bold text-primary">{tr("Dipulihkan oleh {0} pada {1}", r.restored_by ?? "-", tarikh(tarikhTempatan(r.restored_at)))}</span>}
                </span>
                {r.can_restore && (
                  <button
                    type="button"
                    disabled={sibuk === r.id}
                    onClick={() => pulih(r.id, r.label)}
                    className="flex h-10 items-center rounded-full border border-primary px-4 text-[13px] font-bold text-primary disabled:opacity-60"
                  >
                    {sibuk === r.id ? "…" : tr("Pulihkan")}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </Screen>
  );
}
