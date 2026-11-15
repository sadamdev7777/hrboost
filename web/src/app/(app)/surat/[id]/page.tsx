"use client";

import { LogoSyarikat } from "@/components/Logo";
import { tr } from "@/lib/i18n";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getDataSurat, type DataSurat } from "@/lib/urusan";
import { binaSurat, suratSulit, tarikhSurat, teksKaki, type Blok, type Seg } from "@/lib/suratKandungan";
import { simpanAtauKongsiSurat } from "@/lib/suratPdf";
import { bolehKongsiFail } from "@/lib/slipPdf";
import { beritahu } from "@/components/Dialog";
import { BackHeader, ErrorBox, Loading } from "@/components/ui";

/** Surat (A4): muat turun PDF, kongsi (cth. WhatsApp) atau cetak. */
export default function SuratPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const d = useData(() => getDataSurat(id), [id]);
  const [sibuk, setSibuk] = useState<"muat" | "kongsi" | null>(null);
  const hr = me.roles.includes("hr") || me.roles.includes("admin");
  const balik = d.data?.kind === "salary_advance" ? "/pengurusan/gaji/pendahuluan" : hr ? "/pengurusan/surat" : "/mohon/surat";
  const kongsi = bolehKongsiFail();

  async function pdf(cara: "muat" | "kongsi") {
    if (!d.data) return;
    setSibuk(cara);
    try {
      const h = await simpanAtauKongsiSurat(d.data, cara === "kongsi");
      if (h === "dimuat-turun") beritahu(tr("PDF dimuat turun."));
    } catch (e) {
      beritahu(e instanceof Error ? e.message : tr("Ralat"), "ralat");
    }
    setSibuk(null);
  }

  return (
    <div className="min-h-dvh bg-page print:bg-white">
      <style>{`@media print { @page { size: A4; margin: 18mm } .no-print { display: none !important } .kertas { box-shadow: none !important; padding: 0 !important; max-width: none !important } }`}</style>
      <div className="no-print mx-auto max-w-[794px]">
        <BackHeader title={tr("Surat")} href={balik} />
      </div>
      {d.error && (
        <div className="px-4">
          <ErrorBox message={d.error} />
        </div>
      )}
      {!d.data && !d.error && <Loading />}
      {d.data && (
        <>
          <div className="px-2 pb-36 sm:px-5 print:p-0">
            <Kertas s={d.data} />
          </div>
          <div className="no-print fixed inset-x-0 bottom-0 border-t border-line-soft bg-surface px-4 pt-3 pb-4">
            <div className="mx-auto flex max-w-[440px] flex-col gap-1">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => pdf("muat")}
                  disabled={!!sibuk}
                  className="h-12 grow rounded-button bg-primary text-base font-extrabold text-white disabled:opacity-60"
                >
                  {sibuk === "muat" ? tr("Menyediakan PDF…") : tr("Muat turun PDF")}
                </button>
                {kongsi && (
                  <button
                    type="button"
                    onClick={() => pdf("kongsi")}
                    disabled={!!sibuk}
                    className="h-12 shrink-0 rounded-button border border-primary bg-surface px-5 text-base font-extrabold text-primary disabled:opacity-60"
                  >
                    {tr("Kongsi")}
                  </button>
                )}
              </div>
              <button type="button" onClick={() => window.print()} className="min-h-11 text-sm font-bold text-primary">
                {tr("Cetak")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Teks({ isi }: { isi: Seg[] }) {
  return (
    <>
      {isi.map((x, i) => (typeof x === "string" ? <span key={i}>{x}</span> : <b key={i}>{x.b}</b>))}
    </>
  );
}

function PaparBlok({ b }: { b: Blok }) {
  switch (b.t) {
    case "penerima":
      return (
        <p className="m-0">
          <b>{b.nama}</b>
          <br />
          {b.ic}
          {b.alamat && (
            <>
              <br />
              <span className="whitespace-pre-line">{b.alamat}</span>
            </>
          )}
        </p>
      );
    case "p":
      return (
        <p className="m-0 whitespace-pre-line">
          <Teks isi={b.isi} />
        </p>
      );
    case "tajuk":
      return <p className="m-0 font-bold uppercase underline">{b.teks}</p>;
    case "pusat":
      return <b className="text-center text-base tracking-wide">{b.teks}</b>;
    case "jadual":
      return (
        <table className={`border-collapse text-[14px] ${b.kanan ? "w-full max-w-[420px]" : "w-full"}`}>
          <tbody>
            {b.baris.map((r) => (
              <tr key={r.k} className={`align-top ${r.garis ? "border-t border-black" : ""} ${r.tebal ? "font-bold" : ""}`}>
                <td className={`py-1 pr-3 ${b.kanan ? "" : "w-[42%]"}`}>{r.k}</td>
                <td className={`py-1 ${b.kanan ? "text-right" : ""}`}>
                  {!b.kanan && ": "}
                  <Teks isi={r.v} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "senarai":
      return (
        <ol className="m-0 pl-6">
          {b.item.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ol>
      );
    case "tandatangan":
      return (
        <div className="flex flex-col gap-0.5 pt-10">
          <span className="w-56 border-t border-black pt-1 font-bold">{b.nama}</span>
          <span>{b.jawatan}</span>
          <span>{b.syarikat}</span>
        </div>
      );
    case "akuan":
      return (
        <div className="mt-4 flex flex-col gap-3 border-t border-dashed border-black pt-4">
          <b className="text-[13px] uppercase">{tr("Akuan penerimaan")}</b>
          <p className="m-0">{b.teks}</p>
          <div className="grid grid-cols-2 gap-6 pt-8 text-[13px]">
            <span className="border-t border-black pt-1">
              {b.nama}
              <br />
              {b.ic}
            </span>
            <span className="border-t border-black pt-1">{tr("Tarikh")}</span>
          </div>
        </div>
      );
  }
}

function Kertas({ s }: { s: DataSurat }) {
  return (
    <article className="kertas mx-auto flex max-w-[794px] flex-col gap-5 bg-white px-8 py-10 font-serif text-[14px] leading-relaxed text-black shadow-sm sm:px-14">
      <header className="flex flex-col gap-0.5 border-b-2 border-black pb-3 text-center">
        {s.logo_path && (
          <span className="mb-2 flex justify-center">
            <LogoSyarikat path={s.logo_path} nama={s.company.name} className="h-16 max-w-[260px]" />
          </span>
        )}
        <b className="text-lg tracking-wide uppercase">{s.company.name}</b>
        {s.company.reg_no && <span className="text-xs">({s.company.reg_no})</span>}
        {s.company.address && <span className="text-xs">{s.company.address}</span>}
      </header>
      {s.kind === "salary_advance" && <b className="text-center text-base tracking-wide">{tr("MEMO DALAMAN")}</b>}
      <div className="flex justify-between gap-4 text-[13px]">
        <span>
          {tr("Rujukan: {0}", s.ref_no)}
          {suratSulit(s) && <b className="ml-3">{tr("SULIT")}</b>}
        </span>
        <span>{tr("Tarikh: {0}", tarikhSurat(s.issued_at.slice(0, 10)))}</span>
      </div>
      {binaSurat(s).map((b, i) => (
        <PaparBlok key={i} b={b} />
      ))}
      <footer className="mt-6 border-t border-[#ccc] pt-2 text-center text-[11px] text-[#555]">{teksKaki(s)}</footer>
    </article>
  );
}
