"use client";

import { BackHeader, ErrorBox, Loading } from "./ui";
import { SlipGaji } from "./SlipGaji";
import type { Slip } from "@/lib/gaji";

/** Paparan slip A4 dengan butang cetak / simpan PDF. Unsur skrin disorok semasa dicetak. */
export function SlipGajiCetak({ d, back }: { d: { data: Slip | null; error: string | null }; back: string }) {
  return (
    <div className="min-h-dvh bg-page print:bg-white">
      <style>{`@media print { @page { size: A4; margin: 12mm } .no-print { display: none !important } .slip { padding: 0 !important; max-width: none !important } }`}</style>
      <div className="no-print mx-auto max-w-[794px]">
        <BackHeader title="Slip gaji" href={back} />
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
            <button type="button" onClick={() => window.print()} className="mx-auto block h-12 w-full max-w-[440px] rounded-button bg-primary text-base font-extrabold text-white">
              Simpan sebagai PDF / Cetak
            </button>
          </div>
        </>
      )}
    </div>
  );
}
