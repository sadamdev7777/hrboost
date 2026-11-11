"use client";

import { tr } from "@/lib/i18n";
import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { BULAN_PENUH } from "@/lib/gaji";
import { tarikh } from "@/lib/format";
import { BackHeader, ErrorBox, Loading } from "@/components/ui";
import { HadPeranan } from "@/components/Senarai";
import { LogoSyarikat } from "@/components/Logo";

type PcbII = {
  employee: { full_name: string; ic_no: string | null; passport_no: string | null; tax_no: string | null; employee_no: string };
  employer: { name: string; lhdn: string | null; address: string | null; signatory_name: string | null; signatory_position: string | null; logo_path: string | null };
  rows: { month: number; cycle_no: number; label: string | null; pcb: number; cp38: number; zakat: number; receipt_no: string | null; pay_date: string | null }[];
};

const rm = (n: number) => Number(n).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Penyata potongan PCB setahun (PCB II) — diberi kepada pekerja apabila diminta (cth. untuk e-Filing atau pinjaman). */
export default function PcbIIPage() {
  return (
    <HadPeranan roles={["hr", "finance", "admin"]}>
      <Suspense fallback={<Loading />}>
        <Kandungan />
      </Suspense>
    </HadPeranan>
  );
}

function Kandungan() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const tahun = Number(sp.get("y")) || new Date().getFullYear();
  const d = useData(async () => must(await getSupabase().rpc("pcb_ii_data", { p_employment: id, p_year: tahun })) as unknown as PcbII, [id, tahun]);
  const x = d.data;
  const jum = (k: "pcb" | "cp38" | "zakat") => (x?.rows ?? []).reduce((s, r) => s + Number(r[k]), 0);
  return (
    <div className="min-h-dvh bg-page print:bg-white">
      <style>{`@media print { @page { size: A4; margin: 14mm } .no-print { display: none !important } }`}</style>
      <div className="no-print mx-auto flex max-w-[794px] items-center">
        <div className="grow">
          <BackHeader title={tr("Penyata PCB {0}", tahun)} href={`/pengurusan/pekerja/${id}`} />
        </div>
        <div className="flex gap-1 pr-3">
          {[tahun - 1, tahun + 1].map((y) => (
            <a key={y} href={`?y=${y}`} className="flex h-10 items-center rounded-full border border-line px-3 text-[13px] font-bold text-ink!">
              {y}
            </a>
          ))}
        </div>
      </div>
      {d.error && <ErrorBox message={d.error} />}
      {d.loading && !x && <Loading />}
      {x && (
        <div className="px-2 pb-28 sm:px-5 print:p-0">
          <article className="mx-auto w-full max-w-[794px] bg-white px-8 py-7 text-[12px] text-ink print:px-0 print:py-0">
            <header className="flex items-start justify-between gap-4 border-b-2 border-ink pb-3">
              <div className="flex flex-col gap-0.5">
                {x.employer.logo_path && <LogoSyarikat path={x.employer.logo_path} nama={x.employer.name} className="mb-1 h-10 max-w-[180px] object-left" />}
                <b className="text-[14px] font-extrabold uppercase">{x.employer.name}</b>
                <span className="text-muted">{tr("No. majikan (E): {0}", x.employer.lhdn ?? "—")}</span>
                {x.employer.address && <span className="whitespace-pre-line text-muted">{x.employer.address}</span>}
              </div>
              <div className="flex shrink-0 flex-col items-end text-right">
                <b className="text-base">PCB II</b>
                <span className="font-bold">{tr("PENYATA POTONGAN CUKAI BULANAN {0}", tahun)}</span>
              </div>
            </header>
            <section className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
              <Row k={tr("Nama")} v={x.employee.full_name} />
              <Row k={tr("No. pekerja")} v={x.employee.employee_no} />
              <Row k={tr("No. kad pengenalan / pasport")} v={x.employee.ic_no ?? x.employee.passport_no ?? "—"} />
              <Row k={tr("No. cukai pendapatan")} v={x.employee.tax_no ?? "—"} />
            </section>
            <table className="mt-4 w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-ink text-left [&>th]:py-1.5 [&>th]:pr-2">
                  <th>{tr("Bulan")}</th>
                  <th className="text-right!">{tr("PCB (RM)")}</th>
                  <th className="text-right!">{tr("CP38 (RM)")}</th>
                  <th className="text-right!">{tr("Zakat (RM)")}</th>
                  <th>{tr("No. resit")}</th>
                  <th>{tr("Tarikh bayar")}</th>
                </tr>
              </thead>
              <tbody>
                {x.rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-3 text-muted">
                      {tr("Tiada gaji yang diluluskan bagi tahun ini.")}
                    </td>
                  </tr>
                )}
                {x.rows.map((r, i) => (
                  <tr key={i} className="border-b border-[#EEF2F1] [&>td]:py-1.5 [&>td]:pr-2">
                    <td>
                      {BULAN_PENUH[r.month - 1]}
                      {r.label ? ` (${r.label})` : ""}
                    </td>
                    <td className="text-right tabular-nums">{rm(r.pcb)}</td>
                    <td className="text-right tabular-nums">{rm(r.cp38)}</td>
                    <td className="text-right tabular-nums">{rm(r.zakat)}</td>
                    <td>{r.receipt_no ?? "—"}</td>
                    <td>{r.pay_date ? tarikh(r.pay_date) : "—"}</td>
                  </tr>
                ))}
                <tr className="font-extrabold [&>td]:py-2 [&>td]:pr-2">
                  <td>{tr("Jumlah")}</td>
                  <td className="text-right tabular-nums">{rm(jum("pcb"))}</td>
                  <td className="text-right tabular-nums">{rm(jum("cp38"))}</td>
                  <td className="text-right tabular-nums">{rm(jum("zakat"))}</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
            <footer className="mt-10 grid grid-cols-2 gap-8 text-[11px]">
              <div className="flex flex-col gap-0.5">
                <span className="text-muted">{tr("Disahkan oleh")}</span>
                <b>{x.employer.signatory_name ?? "……………………………"}</b>
                <span>{x.employer.signatory_position ?? ""}</span>
              </div>
              <div className="flex flex-col justify-end">
                <span className="border-t border-ink pt-1">{tr("Tandatangan & cop syarikat")}</span>
              </div>
            </footer>
            <p className="m-0 mt-5 text-[9px] text-muted">{tr("Dijana oleh HRBoost daripada gaji yang diluluskan. No. resit diisi oleh HR selepas bayaran PCB kepada LHDN.")}</p>
          </article>
        </div>
      )}
      {x && (
        <div className="no-print fixed inset-x-0 bottom-0 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
          <button type="button" onClick={() => window.print()} className="mx-auto block h-12 w-full max-w-[440px] rounded-button bg-primary text-base font-extrabold text-white">
            {tr("Simpan sebagai PDF / Cetak")}
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-[#EEF2F1] py-1">
      <span className="text-muted">{k}</span>
      <b className="text-right font-bold">{v}</b>
    </div>
  );
}
