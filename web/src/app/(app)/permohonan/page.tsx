"use client";

import Link from "next/link";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { useData } from "@/lib/useData";
import { getPermohonanSaya, kiniDi, paparPermohonan } from "@/lib/data";
import { BackHeader, Empty, ErrorBox, Loading, Screen, StatusPill, StepBar } from "@/components/ui";

// Rujukan reka bentuk: design/PermohonanSaya.dc.html
const TABS = [
  { id: "all", label: "Semua" },
  { id: "pending", label: "Menunggu" },
  { id: "done", label: "Selesai" },
] as const;

export default function PermohonanSayaPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const list = useData(() => getPermohonanSaya(), []);
  const [error, setError] = useState<string | null>(null);

  const items = (list.data ?? []).filter(
    (p) => tab === "all" || (tab === "pending" ? p.status === "pending" : p.status !== "pending"),
  );

  async function batal(id: string) {
    if (!window.confirm("Batalkan permohonan ini?")) return;
    setError(null);
    const { error: err } = await getSupabase().rpc("approval_cancel", { p_request: id, p_via: "web" });
    if (err) setError(err.message);
    list.reload();
  }

  return (
    <Screen>
      <BackHeader title="Permohonan saya" href="/utama" />
      <main className="flex grow flex-col gap-2.5 px-4 pt-1 pb-4">
        <div role="tablist" className="grid grid-cols-3 gap-1 rounded-[14px] bg-[#E4EAE8] p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`h-10 rounded-[10px] text-[13px] ${
                tab === t.id ? "bg-surface font-extrabold text-ink" : "bg-transparent font-semibold text-subtle"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && <ErrorBox message={error} />}
        {list.error && <ErrorBox message={list.error} />}
        {list.loading && !list.data && <Loading />}
        {list.data && items.length === 0 && <Empty>Tiada permohonan dalam senarai ini.</Empty>}

        {items.map((p) => {
          const v = paparPermohonan(p);
          return (
            <div key={p.id} className="flex flex-col gap-2 rounded-card bg-surface px-4 py-3">
              <Link href={`/permohonan/${p.id}`} className="flex items-center justify-between gap-2 text-ink!">
                <span className="flex flex-col gap-0.5">
                  <b className="text-sm">{v.title}</b>
                  <span className="text-xs text-muted">{v.sub}</span>
                </span>
                <StatusPill status={p.status} />
              </Link>
              {(p.status === "pending" || p.status === "approved") && p.totalSteps > 0 && (
                <StepBar total={p.totalSteps} current={p.currentStep} status={p.status} />
              )}
              {p.status === "pending" && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-subtle">{kiniDi(p.waitingFor)}</span>
                  <button
                    type="button"
                    onClick={() => batal(p.id)}
                    className="h-[38px] rounded-[10px] border border-line bg-surface px-3.5 text-[13px] font-bold text-danger"
                  >
                    Batal
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </main>
    </Screen>
  );
}
