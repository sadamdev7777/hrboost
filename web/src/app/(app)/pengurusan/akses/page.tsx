"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { tarikh } from "@/lib/format";
import { LABEL_PERANAN } from "@/lib/hr";
import { BackHeader, ErrorBox, Screen } from "@/components/ui";
import { ButangUtama, Seksyen, Tag, inputKecil } from "@/components/Senarai";
import type { Database } from "@/lib/database.types";

type Role = Database["public"]["Enums"]["app_role"];
const PERANAN: { id: Role; label: string }[] = [
  { id: "staff", label: tr("Lihat sahaja") },
  { id: "hr", label: "HR" },
  { id: "ceo", label: tr("Paparan CEO") },
];
const HARI = [7, 30, 90];
const STATUS: Record<string, { label: string; tone: "warning" | "success" | "danger" | "neutral" }> = {
  pending: { label: tr("Menunggu"), tone: "warning" },
  approved: { label: tr("Diluluskan"), tone: "success" },
  rejected: { label: tr("Ditolak"), tone: "danger" },
  revoked: { label: tr("Ditarik balik"), tone: "neutral" },
};

// Rujukan reka bentuk: design/AksesSyarikat.dc.html
export default function AksesSyarikatPage() {
  const sejarah = useData(async () => must(await getSupabase().rpc("my_access_requests")) ?? [], []);
  const [kod, setKod] = useState("");
  const [peranan, setPeranan] = useState<Role>("hr");
  const [hari, setHari] = useState(30);
  const [sebab, setSebab] = useState("");
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const [dihantar, setDihantar] = useState<string | null>(null);

  async function hantar() {
    setRalat(null);
    if (!kod.trim()) return setRalat(tr("Sila isi kod syarikat."));
    if (!sebab.trim()) return setRalat(tr("Sila nyatakan sebab."));
    setBusy(true);
    try {
      must(await getSupabase().rpc("request_company_access", { p_company_code: kod.trim().toUpperCase(), p_role: peranan, p_days: hari, p_reason: sebab.trim() }));
      setDihantar(kod.trim().toUpperCase());
      sejarah.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
    setBusy(false);
  }

  return (
    <Screen lebar="sederhana">
      <BackHeader title={tr("Mohon akses ke syarikat lain")} href="/pengurusan" />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-6">
        {dihantar ? (
          <div className="flex flex-col items-center gap-3 rounded-card bg-surface px-4 py-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning">
              <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </span>
            <b className="text-lg font-extrabold">{tr("Menunggu kelulusan")}</b>
            <span className="text-sm leading-normal text-[#4A5A57]">
              {tr("Akses {0} ke {1} selama {2} hari. Anda akan dimaklumkan apabila Pentadbir Platform membuat keputusan.", PERANAN.find((p) => p.id === peranan)?.label, dihantar, hari)}</span>
            <Link href="/pengurusan" className="pt-2 text-sm font-bold">
              {tr("Kembali ke Papan Pemuka")}</Link>
          </div>
        ) : (
          <>
            <div className="rounded-[14px] bg-[#E3F1EE] px-4 py-3 text-[13px] leading-normal text-primary">
              {tr("Anda hanya boleh mengurus syarikat tempat anda bekerja. Akses ke syarikat lain memerlukan kelulusan Pentadbir Platform HRBoost dan akan tamat secara automatik.")}</div>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-bold text-[#4A5A57]">{tr("Kod syarikat")}</span>
              <input className={`${inputKecil} uppercase`} value={kod} onChange={(e) => setKod(e.target.value)} placeholder={tr("Contoh: DOIT")} />
              <span className="text-xs text-muted">{tr("Dapatkan kod daripada Pentadbir syarikat tersebut.")}</span>
            </label>
            <Seksyen>{tr("AKSES DIPERLUKAN")}</Seksyen>
            <div className="grid grid-cols-3 gap-2">
              {PERANAN.map((p) => (
                <Pilih key={p.id} on={peranan === p.id} onClick={() => setPeranan(p.id)}>
                  {tr(p.label)}
                </Pilih>
              ))}
            </div>
            <Seksyen>{tr("TEMPOH")}</Seksyen>
            <div className="grid grid-cols-3 gap-2">
              {HARI.map((h) => (
                <Pilih key={h} on={hari === h} onClick={() => setHari(h)}>
                  {tr("{0} hari", h)}</Pilih>
              ))}
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-bold text-[#4A5A57]">{tr("Sebab")}</span>
              <textarea rows={3} className={`${inputKecil} h-auto py-2.5`} value={sebab} onChange={(e) => setSebab(e.target.value)} />
            </label>
            {ralat && <ErrorBox message={ralat} />}
            <ButangUtama onClick={hantar} busy={busy}>
              {tr("Hantar permohonan")}</ButangUtama>
            <span className="text-center text-xs text-muted">{tr("Pentadbir syarikat tersebut juga akan dimaklumkan.")}</span>
          </>
        )}

        {(sejarah.data ?? []).length > 0 && (
          <>
            <Seksyen className="pt-2">{tr("PERMOHONAN SAYA")}</Seksyen>
            <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              {sejarah.data!.map((g) => (
                <div key={g.id} className="flex min-h-12 items-center justify-between gap-2 py-2 text-sm">
                  <span className="flex flex-col">
                    <b className="font-bold">
                      {g.company_code} · {LABEL_PERANAN[g.role] === "Pekerja" ? tr("Lihat sahaja") : LABEL_PERANAN[g.role]}
                    </b>
                    <span className="text-xs text-muted">
                      {tr("{0} hari · {1}{2}", g.days, tarikh(g.created_at), g.status === "approved" && g.expires_at ? tr(" · tamat {0}", tarikh(g.expires_at)) : "")}</span>
                  </span>
                  <Tag tone={STATUS[g.status]?.tone ?? "neutral"}>{STATUS[g.status]?.label ?? g.status}</Tag>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </Screen>
  );
}

function Pilih({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`h-[46px] rounded-[12px] text-[13px] font-bold ${on ? "border-[1.5px] border-primary bg-[#E3F1EE] text-primary" : "border border-[#D5DEDC] bg-surface text-ink"}`}
    >
      {children}
    </button>
  );
}
