"use client";

import { tr } from "@/lib/i18n";
import { useState, useSyncExternalStore } from "react";
import { bolehKongsiFail, simpanAtauKongsiSlip } from "@/lib/slipPdf";
import { beritahu } from "./Dialog";
import { BackHeader, ErrorBox, Loading } from "./ui";
import { SlipGaji } from "./SlipGaji";
import type { Slip } from "@/lib/gaji";

/** Paparan slip A4 dengan butang cetak / simpan PDF. Unsur skrin disorok semasa dicetak. */
export function SlipGajiCetak({ d, back }: { d: { data: Slip | null; error: string | null }; back: string }) {
  const [busy, setBusy] = useState<"pdf" | "kongsi" | null>(null);
  const kongsiOk = useSyncExternalStore(
    () => () => {},
    bolehKongsiFail,
    () => false,
  );
  async function jana(kongsi: boolean) {
    if (!d.data) return;
    setBusy(kongsi ? "kongsi" : "pdf");
    try {
      await simpanAtauKongsiSlip(d.data, kongsi);
    } catch (e) {
      beritahu(e instanceof Error ? e.message : tr("Ralat"), "ralat");
    }
    setBusy(null);
  }
  return (
    <div className="min-h-dvh bg-page print:bg-white">
      <style>{`@media print { @page { size: A4; margin: 12mm } .no-print { display: none !important } .slip { padding: 0 !important; max-width: none !important } }`}</style>
      <div className="no-print mx-auto max-w-[794px]">
        <BackHeader title={tr("Slip gaji")} href={back} />
      </div>
      {d.error && (
        <div className="px-4">
          <ErrorBox message={d.error} />
        </div>
      )}
      {!d.data && !d.error && <Loading />}
      {d.data && (
        <>
          <div className="px-2 pb-28 sm:px-5 print:p-0">
            <SlipGaji s={d.data} />
          </div>
          <div className="no-print fixed inset-x-0 bottom-0 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
            <div className="mx-auto flex w-full max-w-[440px] flex-col gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => jana(false)}
                  disabled={!!busy}
                  className="h-12 grow rounded-button bg-primary text-base font-extrabold text-white disabled:opacity-60"
                >
                  {busy === "pdf" ? tr("Menjana…") : tr("Muat turun PDF")}
                </button>
                {kongsiOk && (
                  <button
                    type="button"
                    onClick={() => jana(true)}
                    disabled={!!busy}
                    className="h-12 grow rounded-button border-[1.5px] border-primary bg-surface text-base font-extrabold text-primary disabled:opacity-60"
                  >
                    {busy === "kongsi" ? tr("Menjana…") : tr("Kongsi")}
                  </button>
                )}
              </div>
              <button type="button" onClick={() => window.print()} className="flex min-h-11 items-center justify-center text-[13px] font-bold text-primary">
                {tr("Cetak")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
