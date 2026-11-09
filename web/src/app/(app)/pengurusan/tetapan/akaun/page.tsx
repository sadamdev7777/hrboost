"use client";

import { tr } from "@/lib/i18n";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { namaJenisTuntutan } from "@/lib/claims";
import { tarikh } from "@/lib/format";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { HadPeranan, Seksyen, Tag } from "@/components/Senarai";

const SISTEM: Record<string, string> = { quickbooks: tr("QuickBooks Online"), niagawan: tr("Niagawan"), csv: tr("Eksport CSV"), none: tr("Belum dipilih") };
const STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  success: { label: tr("Dihantar"), tone: "success" },
  pending: { label: tr("Dalam barisan"), tone: "warning" },
  failed: { label: tr("Gagal"), tone: "danger" },
  skipped: { label: tr("Dilangkau"), tone: "neutral" },
};

// Rujukan reka bentuk: design/T_IntegrasiAkaun.dc.html
export default function IntegrasiAkaunPage() {
  return (
    <HadPeranan roles={["finance", "admin"]} back="/pengurusan/tetapan">
      <Akaun />
    </HadPeranan>
  );
}

function Akaun() {
  const me = useMe();
  const cid = me.active!.companyId;
  const admin = me.roles.includes("admin");
  const d = useData(async () => {
    const sb = getSupabase();
    const [c, t, q] = await Promise.all([
      sb.from("companies").select("name, accounting_system, accounting_config").eq("id", cid).single(),
      sb.from("claim_types").select("id, name, account_ref").eq("company_id", cid).eq("active", true).order("name"),
      sb.from("accounting_sync_queue").select("id, entity_type, status, error, created_at").eq("company_id", cid).order("created_at", { ascending: false }).limit(5),
    ]);
    return { c: must(c), t: must(t) ?? [], q: must(q) ?? [] };
  }, [cid]);
  const [ralat, setRalat] = useState<string | null>(null);
  const cfg = (d.data?.c.accounting_config ?? {}) as { realm_id?: string; journal?: string };
  const sambung = d.data?.c.accounting_system === "quickbooks" && !!cfg.realm_id;

  async function kemasSyarikat(patch: { accounting_system?: "quickbooks" | "niagawan" | "csv" | "none"; accounting_config?: { [k: string]: string | undefined } }) {
    setRalat(null);
    try {
      must(await getSupabase().from("companies").update(patch).eq("id", cid));
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
  }

  async function akaunTuntutan(id: string, v: string) {
    try {
      must(await getSupabase().from("claim_types").update({ account_ref: v.trim() || null }).eq("id", id));
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
  }

  return (
    <Screen lebar="sederhana">
      <BackHeader title={tr("Integrasi perakaunan")} href="/pengurusan/tetapan" />
      <main className="flex grow flex-col gap-2.5 px-4 pt-1 pb-6">
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data && <Loading />}
        {d.data && (
          <>
            <div className="flex items-center gap-3 rounded-card bg-surface px-4 py-3">
              <span className="flex grow flex-col gap-0.5">
                <b className="text-sm font-extrabold">{SISTEM[d.data.c.accounting_system]}</b>
                <span className="text-xs text-muted uppercase">{d.data.c.name}</span>
              </span>
              <Tag tone={sambung ? "success" : "neutral"}>{sambung ? tr("Bersambung") : tr("Belum disambung")}</Tag>
            </div>
            <label className="flex items-center gap-2 rounded-card bg-surface px-4 py-3 text-sm">
              <span className="grow font-bold">{tr("Sistem perakaunan")}</span>
              <select
                disabled={!admin}
                value={d.data.c.accounting_system}
                onChange={(e) => kemasSyarikat({ accounting_system: e.target.value as "quickbooks" })}
                className="h-10 rounded-[10px] border border-[#D5DEDC] bg-surface px-2 text-sm font-semibold"
              >
                {Object.entries(SISTEM).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            {d.data.c.accounting_system === "quickbooks" && !sambung && (
              <span className="rounded-[14px] bg-warning-soft px-4 py-3 text-[13px] leading-normal text-warning">
                {tr("Sambungan QuickBooks akan diaktifkan oleh Pentadbir Platform HRBoost setelah kunci aplikasi QuickBooks didaftarkan. Kunci tidak pernah dipaparkan di sini.")}</span>
            )}

            <Seksyen className="pt-1">{tr("PADANAN AKAUN TUNTUTAN")}</Seksyen>
            <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              {d.data.t.map((t) => (
                <label key={t.id} className="flex min-h-12 items-center gap-2 py-2 text-sm">
                  <span className="grow font-bold">{namaJenisTuntutan(t.name)}</span>
                  <input
                    className="h-10 w-[150px] rounded-[10px] border border-[#D5DEDC] px-2.5 text-sm font-semibold"
                    placeholder={tr("Kod akaun perbelanjaan")}
                    defaultValue={t.account_ref ?? ""}
                    onBlur={(e) => e.target.value !== (t.account_ref ?? "") && akaunTuntutan(t.id, e.target.value)}
                  />
                </label>
              ))}
            </div>

            <Seksyen className="pt-1">{tr("GAJI")}</Seksyen>
            <label className="flex min-h-12 items-center gap-2 rounded-card bg-surface px-4 py-2 text-sm">
              <span className="grow font-bold">{tr("Jurnal gaji bulanan")}</span>
              <select
                disabled={!admin}
                value={cfg.journal ?? "auto"}
                onChange={(e) => kemasSyarikat({ accounting_config: { ...cfg, journal: e.target.value } })}
                className="h-10 rounded-[10px] border border-[#D5DEDC] bg-surface px-2 text-sm font-semibold"
              >
                <option value="auto">{tr("Hantar apabila gaji diluluskan")}</option>
                <option value="manual">{tr("Manual")}</option>
              </select>
            </label>

            <Seksyen className="pt-1">{tr("TERKINI")}</Seksyen>
            <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              {d.data.q.length === 0 && <span className="py-3 text-sm text-muted">{tr("Belum ada rekod dihantar.")}</span>}
              {d.data.q.map((q) => (
                <div key={q.id} className="flex min-h-[50px] items-center justify-between gap-2 py-2 text-sm">
                  <span className="flex flex-col">
                    <b className="font-bold">{q.entity_type === "claim" ? tr("Tuntutan") : tr("Jurnal gaji")}</b>
                    <span className="text-xs text-muted">{tarikh(q.created_at)}{q.error ? ` · ${q.error}` : ""}</span>
                  </span>
                  <Tag tone={STATUS[q.status].tone}>{STATUS[q.status].label}</Tag>
                </div>
              ))}
            </div>
            {ralat && <ErrorBox message={ralat} />}
            <span className="text-xs text-muted">{tr("Sistem lain (contohnya Niagawan): eksport CSV setiap bulan daripada skrin Proses Gaji.")}</span>
          </>
        )}
      </main>
    </Screen>
  );
}
