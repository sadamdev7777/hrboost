"use client";

import { tr } from "@/lib/i18n";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getEaHr } from "@/lib/ea";
import { ErrorBox, Loading } from "@/components/ui";
import { BarDokumen } from "@/components/BarDokumen";
import { HadPeranan } from "@/components/Senarai";
import { BorangEA } from "@/components/BorangEA";

/** Cetak / PDF Borang EA (semua pekerja, satu muka surat A4 setiap pekerja; atau ?id= seorang). */
export default function CetakEaPage() {
  return (
    <HadPeranan roles={["hr", "finance", "admin"]}>
      <Suspense fallback={<Loading />}>
        <Kandungan />
      </Suspense>
    </HadPeranan>
  );
}

function Kandungan() {
  const me = useMe();
  const emp = me.active!;
  const q = useSearchParams();
  const tahun = Number(q.get("tahun")) || new Date().getFullYear() - 1;
  const id = q.get("id");
  const d = useData(() => getEaHr(emp.companyId, tahun), [emp.companyId, tahun]);
  const rows = (d.data?.rows ?? []).filter((r) => !id || r.employment_id === id);
  return (
    <div className="min-h-dvh bg-page print:bg-white">
      <style>{`@media print { @page { size: A4; margin: 12mm } .no-print { display: none !important } }`}</style>
      <BarDokumen title={tr("Borang EA {0}", tahun)} href={"/pengurusan/gaji/ea"} sedia={rows.length > 0} />
      {d.error && <ErrorBox message={d.error} />}
      {d.loading && !d.data && <Loading />}
      {d.data && (
        <div className="flex flex-col gap-4 px-2 pb-28 sm:px-5 min-[700px]:pb-10 print:gap-0 print:p-0">
          {rows.map((r) => (
            <BorangEA key={r.employment_id} m={d.data!.company} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}
