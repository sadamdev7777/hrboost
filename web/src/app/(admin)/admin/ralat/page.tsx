"use client";

import { tr } from "@/lib/i18n";
import { useState } from "react";
import { useData } from "@/lib/useData";
import { masaLog, masaRelatif, rpc } from "@/lib/admin";
import { ErrorBox, Loading } from "@/components/ui";

type R = {
  fingerprint: string;
  message: string;
  path: string | null;
  count: number;
  users: number;
  companies: string | null;
  first_at: string;
  last_at: string;
  stack: string | null;
  user_agent: string | null;
  release: string | null;
};

/** Ralat JavaScript daripada pelayar pengguna, dikumpulkan ikut jenis. Agregat sahaja (tiada identiti pengguna). */
export default function SaRalat() {
  const [hari, setHari] = useState(7);
  const [buka, setBuka] = useState<string | null>(null);
  const d = useData(() => rpc<R[]>("sa_client_errors", { p_days: hari }), [hari]);
  return (
    <>
      <h1 className="m-0 text-2xl font-extrabold">{tr("Ralat aplikasi")}</h1>
      <span className="max-w-[720px] text-sm text-muted">
        {tr("Ralat yang berlaku dalam pelayar pengguna direkodkan secara automatik dan dikumpulkan ikut jenis. Hanya bilangan, laluan dan kod syarikat dipaparkan. Rekod dipadam selepas 90 hari.")}
      </span>
      <div className="flex flex-wrap gap-2">
        {[1, 7, 30].map((h) => (
          <button key={h} type="button" onClick={() => setHari(h)} className={`h-10 rounded-full px-3.5 text-[13px] font-bold ${hari === h ? "bg-primary text-white" : "bg-surface text-[#4A5A57]"}`}>
            {h === 1 ? tr("24 jam") : tr("{0} hari", h)}
          </button>
        ))}
      </div>
      {d.error && <ErrorBox message={d.error} />}
      {!d.data && !d.error && <Loading />}
      {d.data && d.data.length === 0 && <span className="rounded-card bg-surface p-4 text-sm text-muted">{tr("Tiada ralat dalam tempoh ini.")}</span>}
      {d.data && d.data.length > 0 && (
        <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
          {d.data.map((r) => (
            <div key={r.fingerprint} className="flex flex-col gap-1 py-3">
              <button type="button" onClick={() => setBuka(buka === r.fingerprint ? null : r.fingerprint)} className="flex items-start gap-3 text-left">
                <span className="flex min-w-14 shrink-0 flex-col items-center rounded-[10px] bg-danger-soft px-2 py-1 text-danger">
                  <b className="text-base font-extrabold">{r.count}</b>
                  <span className="text-[11px]">{tr("kali")}</span>
                </span>
                <span className="flex grow flex-col gap-0.5">
                  <b className="text-sm font-bold break-all">{r.message}</b>
                  <span className="text-xs text-muted">
                    {[r.path, r.companies, tr("{0} pengguna", r.users), tr("terakhir {0}", masaRelatif(r.last_at)), r.release && tr("versi {0}", r.release)].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
              {buka === r.fingerprint && (
                <div className="flex flex-col gap-1 pl-17 text-xs text-muted">
                  <span>{tr("Pertama: {0} · Terakhir: {1}", masaLog(r.first_at), masaLog(r.last_at))}</span>
                  {r.user_agent && <span className="break-all">{r.user_agent}</span>}
                  {r.stack && <pre className="m-0 max-h-60 overflow-auto rounded-[10px] bg-[#F4F6F5] p-2.5 text-[11px] whitespace-pre-wrap text-ink">{r.stack}</pre>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
