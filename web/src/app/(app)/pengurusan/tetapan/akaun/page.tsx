"use client";

import { tr, trRalat } from "@/lib/i18n";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { sahkan } from "@/components/Dialog";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { namaJenisTuntutan } from "@/lib/claims";
import { masaPanjang, tarikh } from "@/lib/format";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { HadPeranan, Seksyen, Tag, GrupLajur } from "@/components/Senarai";

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
    <Screen lebar="lebar">
      <BackHeader title={tr("Integrasi perakaunan")} href="/pengurusan/tetapan" />
      <main className="flex grow flex-col gap-2.5 px-4 pt-1 pb-6">
        <GrupLajur>
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
            {d.data.c.accounting_system === "quickbooks" && (
              <Suspense fallback={null}>
                <SambunganQbo cid={cid} onUbah={d.reload} />
              </Suspense>
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
        </GrupLajur>
      </main>
    </Screen>
  );
}

type StatusQbo = { connected: boolean; realm_id: string | null; connected_at: string | null; last_synced_at: string | null; last_error: string | null; pending: number; failed: number; synced: number };
const MESEJ_QBO: Record<string, { t: string; ok: boolean }> = {
  ok: { t: tr("QuickBooks berjaya disambungkan."), ok: true },
  batal: { t: tr("Sambungan QuickBooks dibatalkan."), ok: false },
  tamat: { t: tr("Pautan sambungan tamat tempoh. Sila cuba semula."), ok: false },
  ralat: { t: tr("QuickBooks tidak dapat disambungkan. Sila cuba semula."), ok: false },
};

/** Sambungan QuickBooks Online: OAuth (qbo-oauth), status penyegerakan & "Segerak sekarang" (accounting-sync). */
function SambunganQbo({ cid, onUbah }: { cid: string; onUbah: () => void }) {
  const qbo = useSearchParams().get("qbo");
  const st = useData(async () => must(await getSupabase().rpc("qbo_status", { p_company: cid })) as unknown as StatusQbo | null, [cid]);
  const [busy, setBusy] = useState<string | null>(null);
  const [ralat, setRalat] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function panggil(fn: string, body: Record<string, unknown>) {
    const { data, error } = await getSupabase().functions.invoke(fn, { body });
    if (error) {
      const b = await (error as { context?: Response }).context?.json?.().catch(() => null);
      throw new Error(b?.error ?? error.message);
    }
    return data as Record<string, unknown>;
  }
  async function buat(k: string, f: () => Promise<void>) {
    setBusy(k);
    setRalat(null);
    setInfo(null);
    try {
      await f();
    } catch (e) {
      setRalat(e instanceof Error ? trRalat(e.message) : tr("Ralat"));
    }
    setBusy(null);
  }
  const s = st.data;
  const m = qbo ? MESEJ_QBO[qbo] : null;
  return (
    <div className="flex flex-col gap-2.5 rounded-card bg-surface px-4 py-3">
      {m && <span className={`rounded-[12px] px-3 py-2 text-[13px] font-semibold ${m.ok ? "bg-[#E3F1EE] text-primary" : "bg-warning-soft text-warning"}`}>{m.t}</span>}
      {st.error && <ErrorBox message={st.error} />}
      {s && !s.connected && (
        <>
          <span className="text-[13px] leading-snug text-muted">
            {tr("Sambungkan akaun QuickBooks Online syarikat. Tuntutan yang diluluskan dihantar sebagai Bill dan gaji yang diluluskan sebagai Journal Entry secara automatik setiap 10 minit.")}
          </span>
          <button
            type="button"
            disabled={!!busy}
            onClick={() =>
              buat("sambung", async () => {
                const r = await panggil("qbo-oauth", { company_id: cid });
                window.location.href = String(r.url);
              })
            }
            className="h-11 rounded-[12px] bg-primary text-sm font-extrabold text-white disabled:opacity-60"
          >
            {busy === "sambung" ? tr("Membuka QuickBooks…") : tr("Sambung QuickBooks")}
          </button>
        </>
      )}
      {s && s.connected && (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              [tr("Dihantar"), s.synced],
              [tr("Dalam barisan"), s.pending],
              [tr("Gagal"), s.failed],
            ].map(([l, n]) => (
              <span key={String(l)} className="flex flex-col rounded-[12px] bg-page py-2">
                <b className="text-lg font-extrabold">{n}</b>
                <span className="text-xs text-muted">{l}</span>
              </span>
            ))}
          </div>
          <span className="text-xs text-muted">
            {tr("Syarikat QuickBooks {0}", s.realm_id ?? "-")}
            {s.last_synced_at ? " · " + tr("terakhir disegerak {0}", masaPanjang(s.last_synced_at)) : ""}
          </span>
          {s.last_error && <span className="rounded-[12px] bg-danger-soft px-3 py-2 text-[13px] text-danger">{s.last_error}</span>}
          {info && <span className="text-[13px] font-semibold text-success">{info}</span>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!!busy}
              onClick={() =>
                buat("segerak", async () => {
                  const r = await panggil("accounting-sync", { company_id: cid });
                  setInfo(tr("{0} dihantar, {1} gagal.", Number(r.disegerak ?? 0), Number(r.gagal ?? 0)));
                  st.reload();
                })
              }
              className="h-10 rounded-full bg-primary px-4 text-[13px] font-bold text-white disabled:opacity-60"
            >
              {busy === "segerak" ? tr("Menyegerak…") : tr("Segerak sekarang")}
            </button>
            {s.failed > 0 && (
              <button
                type="button"
                disabled={!!busy}
                onClick={() =>
                  buat("cuba", async () => {
                    must(await getSupabase().rpc("accounting_retry", { p_company: cid }));
                    st.reload();
                  })
                }
                className="h-10 rounded-full border border-primary px-4 text-[13px] font-bold text-primary disabled:opacity-60"
              >
                {tr("Cuba semula yang gagal")}
              </button>
            )}
            <button
              type="button"
              disabled={!!busy}
              onClick={() =>
                buat("putus", async () => {
                  if (!(await sahkan({ tajuk: tr("Putuskan QuickBooks?"), mesej: tr("Tuntutan dan gaji tidak lagi dihantar ke QuickBooks sehingga disambung semula."), ok: tr("Putuskan"), bahaya: true }))) return;
                  must(await getSupabase().rpc("qbo_disconnect", { p_company: cid }));
                  st.reload();
                  onUbah();
                })
              }
              className="h-10 rounded-full px-3 text-[13px] font-bold text-danger disabled:opacity-60"
            >
              {tr("Putuskan")}
            </button>
          </div>
        </>
      )}
      {ralat && <ErrorBox message={ralat} />}
    </div>
  );
}
