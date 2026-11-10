"use client";

import { tr } from "@/lib/i18n";
import { todayISO } from "@/lib/format";
import { FailBank } from "@/components/FailBank";
import Link from "next/link";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { BULAN_PENUH, muatTurun } from "@/lib/gaji";
import { ringgit, tarikh } from "@/lib/format";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { HadPeranan, Tag } from "@/components/Senarai";
import { PengepalaAkar, TabNav } from "@/components/TabNav";
import { TabGaji } from "@/components/TabGaji";

const STATUS: Record<string, { l: string; t: "neutral" | "warning" | "primary" | "success" | "danger" }> = {
  draft: { l: tr("Draf"), t: "neutral" },
  calculated: { l: tr("Dikira"), t: "warning" },
  returned: { l: tr("Dikembalikan"), t: "danger" },
  pending: { l: tr("Menunggu kelulusan"), t: "warning" },
  approved: { l: tr("Diluluskan"), t: "primary" },
  rejected: { l: tr("Ditolak"), t: "danger" },
  paid: { l: tr("Dibayar"), t: "success" },
  locked: { l: tr("Dikunci"), t: "success" },
};
const FAIL = [
  ["bank", tr("Bank")],
  ["epf", tr("KWSP")],
  ["socso", tr("PERKESO")],
  ["pcb", "PCB"],
] as const;

export default function SejarahGajiPage() {
  return (
    <HadPeranan roles={["hr", "finance", "admin"]} back="/pengurusan/gaji">
      <Sejarah />
    </HadPeranan>
  );
}

function Sejarah() {
  const me = useMe();
  const emp = me.active!;
  const d = useData(
    async () =>
      must(
        await getSupabase()
          .from("payroll_runs")
          .select("id, period_year, period_month, status, totals, pay_date")
          .eq("company_id", emp.companyId)
          .order("period_year", { ascending: false })
          .order("period_month", { ascending: false }),
      ) ?? [],
    [emp.companyId],
  );
  const [ralat, setRalat] = useState<string | null>(null);

  const [bank, setBank] = useState<{ id: string; tarikh: string } | null>(null);

  async function fail(id: string, jenis: (typeof FAIL)[number][0], y: number, m: number) {
    setRalat(null);
    if (jenis === "bank") {
      const r = (d.data ?? []).find((x) => x.id === id) as { pay_date?: string | null } | undefined;
      setBank({ id, tarikh: r?.pay_date ?? todayISO() });
      return;
    }
    try {
      await muatTurun(id, jenis, tr("{0}-{1}-{2}-{3}.csv", emp.companyCode, jenis, y, String(m).padStart(2, "0")));
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
  }

  return (
    <Screen>
      <PengepalaAkar title={tr("Penggajian")} />
      <TabGaji />
      <main className="flex grow flex-col gap-3 px-4 py-4 lg:px-0">
        {d.error && <ErrorBox message={d.error} />}
        {ralat && <ErrorBox message={ralat} />}
        {d.loading && !d.data && <Loading />}
        {d.data && d.data.length === 0 && <span className="text-sm text-muted">{tr("Belum ada gaji diproses.")}</span>}
        {d.data && d.data.length > 0 && (
          <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
            {d.data.map((r) => {
              const t = (r.totals ?? {}) as Record<string, number>;
              const st = STATUS[r.status] ?? { l: r.status, t: "neutral" as const };
              const siap = ["approved", "paid", "locked"].includes(r.status);
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <span className="flex min-w-[160px] grow flex-col gap-0.5">
                    <b className="text-sm">
                      {BULAN_PENUH[r.period_month - 1]} {r.period_year}
                    </b>
                    <span className="text-xs text-muted">
                      {t.headcount ? tr("{0} pekerja", t.headcount) : tr("Belum dikira")}
                      {r.pay_date ? tr(" · dibayar {0}", tarikh(r.pay_date)) : ""}
                    </span>
                  </span>
                  {t.gross != null && (
                    <span className="flex gap-5 text-sm tabular-nums">
                      <span className="flex flex-col">
                        <span className="text-[11px] text-muted">{tr("Kasar")}</span>
                        <b>{ringgit(t.gross)}</b>
                      </span>
                      <span className="flex flex-col">
                        <span className="text-[11px] text-muted">{tr("Bersih")}</span>
                        <b>{ringgit(t.net)}</b>
                      </span>
                    </span>
                  )}
                  <Tag tone={st.t}>{st.l}</Tag>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {siap &&
                      FAIL.map(([k, l]) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => fail(r.id, k, r.period_year, r.period_month)}
                          className="flex h-9 items-center rounded-full border border-line px-3 text-xs font-bold"
                        >
                          {l}
                        </button>
                      ))}
                    <Link
                      href={`/pengurusan/gaji?y=${r.period_year}&m=${r.period_month}`}
                      className="flex h-9 items-center rounded-full bg-[#E3F1EE] px-3.5 text-xs font-bold text-primary!"
                    >
                      {tr("Buka")}</Link>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <TabNav />
      {bank && <FailBank runId={bank.id} companyId={emp.companyId} companyCode={emp.companyCode} tarikhAwal={bank.tarikh} onClose={() => setBank(null)} />}
    </Screen>
  );
}
