"use client";

import { tr } from "@/lib/i18n";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getEaSaya } from "@/lib/ea";
import { ErrorBox, Loading } from "@/components/ui";
import { BarDokumen } from "@/components/BarDokumen";
import { BorangEA } from "@/components/BorangEA";

/** Pekerja: Borang EA sendiri (selepas HR mengeluarkannya). */
export default function EaSayaPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Kandungan />
    </Suspense>
  );
}

function Kandungan() {
  const me = useMe();
  const emp = me.active!;
  const sp = useSearchParams();
  const tahun = Number(sp.get("tahun")) || new Date().getFullYear() - 1;
  const d = useData(() => getEaSaya(emp.id, tahun), [emp.id, tahun]);
  const x = d.data;
  return (
    <div className="min-h-dvh bg-page print:bg-white">
      <style>{`@media print { @page { size: A4; margin: 12mm } .no-print { display: none !important } }`}</style>
      <BarDokumen title={tr("Borang EA {0}", tahun)} href={"/gaji"} sedia={!!(x?.released && x.row && x.company)} />
      {d.error && <ErrorBox message={d.error} />}
      {d.loading && !x && <Loading />}
      {x && (!x.released || !x.row) && (
        <div className="mx-4 rounded-card bg-surface px-4 py-3 text-sm text-muted">
          {tr("Borang EA {0} belum dikeluarkan oleh HR. Anda akan dimaklumkan apabila ia tersedia (sebelum 28 Februari).", tahun)}</div>
      )}
      {x?.released && x.row && x.company && (
        <>
          <div className="px-2 pb-28 sm:px-5 min-[700px]:pb-10 print:p-0">
            <BorangEA m={x.company} r={x.row} />
          </div>
        </>
      )}
    </div>
  );
}
