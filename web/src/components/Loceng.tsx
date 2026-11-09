"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { masa, tarikh, tarikhTempatan, todayISO } from "@/lib/format";
import { IconBell } from "./icons";

type Notis = { id: string; message: string; created_at: string; read_at: string | null };

/** Pemberitahuan dalam aplikasi (mesej yang sama dihantar melalui WhatsApp). */
export function Loceng({ className = "" }: { className?: string }) {
  const d = useData(
    async () =>
      (must(await getSupabase().from("notifications").select("id, message, created_at, read_at").order("created_at", { ascending: false }).limit(20)) ??
        []) as Notis[],
    [],
  );
  const [buka, setBuka] = useState(false);
  const belum = (d.data ?? []).filter((n) => !n.read_at).length;

  async function togol() {
    const b = !buka;
    setBuka(b);
    if (b && belum) {
      await getSupabase().rpc("mark_my_notifications_read", {});
      setTimeout(() => d.reload(), 4000);
    }
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={togol}
        aria-label={belum ? `Pemberitahuan, ${belum} belum dibaca` : "Pemberitahuan"}
        aria-expanded={buka}
        className="relative flex size-10 items-center justify-center rounded-full bg-surface text-ink hover:bg-[#EEF2F1]"
      >
        <IconBell size={20} />
        {belum > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[11px] font-extrabold text-white">
            {belum}
          </span>
        )}
      </button>
      {buka && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setBuka(false)} />
          <div
            role="dialog"
            aria-label="Pemberitahuan"
            className="absolute right-0 z-50 mt-2 flex max-h-[70vh] w-[min(360px,calc(100vw-32px))] flex-col overflow-hidden rounded-[16px] border border-line bg-surface shadow-xl"
          >
            <b className="border-b border-line-soft px-4 py-3 text-sm">Pemberitahuan</b>
            <div className="flex flex-col overflow-y-auto [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              {(d.data ?? []).length === 0 && <span className="px-4 py-4 text-sm text-muted">Tiada pemberitahuan.</span>}
              {(d.data ?? []).map((n) => (
                <div key={n.id} className={`flex flex-col gap-1 px-4 py-3 text-[13px] leading-snug ${n.read_at ? "" : "bg-[#F2F8F7]"}`}>
                  <span className="whitespace-pre-line">{n.message}</span>
                  <span className="text-[11px] text-muted">
                    {tarikhTempatan(n.created_at) === todayISO() ? "Hari ini" : tarikh(tarikhTempatan(n.created_at))}, {masa(n.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
