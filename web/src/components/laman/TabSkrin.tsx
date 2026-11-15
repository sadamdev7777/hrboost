"use client";

import { bahasa, tr } from "@/lib/i18n";
import Image from "next/image";
import { useRef, useState, type KeyboardEvent } from "react";

const TAB = () => {
  const d = `/skrin/${bahasa()}`;
  return [
    { id: "kelulusan", label: tr("Kelulusan"), tajuk: tr("Ketua Jabatan → Kewangan → CEO, diluluskan dengan satu sentuhan."), img: `${d}/ketua-kelulusan.webp`, alt: tr("Skrin kelulusan tuntutan dengan aliran Ketua Jabatan, Kewangan dan CEO") },
    { id: "tuntutan", label: tr("Tuntutan"), tajuk: tr("Ambil gambar resit, AI mengisi borang."), img: `${d}/pekerja-tuntutan.webp`, alt: tr("Skrin tuntutan baharu: gambar resit, borang diisi oleh AI") },
    { id: "inventori", label: tr("Inventori"), tajuk: tr("Pekerja merekod peralatan, HR mengesahkan."), img: `${d}/pekerja-inventori.webp`, alt: tr("Skrin inventori pekerja: laptop dan telefon syarikat dengan gambar dan status pengesahan HR") },
    { id: "orientasi", label: tr("Orientasi"), tajuk: tr("Pekerja baharu melengkapkan maklumat sendiri."), img: `${d}/pekerja-orientasi.webp`, alt: tr("Skrin orientasi pekerja baharu: 3 daripada 8 langkah selesai") },
  ];
};

/** "Skrin sebenar pada telefon pekerja": senarai tab (anak panah kiri/kanan/atas/bawah, Home, End) + skrin telefon. */
export function TabSkrin() {
  const tab = TAB();
  const [i, setI] = useState(0);
  const rujuk = useRef<(HTMLButtonElement | null)[]>([]);
  const pilih = (k: number) => {
    const n = (k + tab.length) % tab.length;
    setI(n);
    rujuk.current[n]?.focus();
  };
  function kekunci(e: KeyboardEvent<HTMLButtonElement>) {
    const peta: Record<string, number> = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: tab.length - 1 };
    if (e.key in peta) {
      e.preventDefault();
      pilih(peta[e.key]);
    }
  }
  const semasa = tab[i];
  return (
    <div className="grid items-center gap-10 min-[980px]:grid-cols-2">
      <div className="flex flex-col gap-7">
        <h2 className="m-0 text-[23px] leading-[1.15] font-extrabold tracking-[-0.015em] min-[700px]:text-[28px] min-[980px]:text-[36px]">{tr("Skrin sebenar pada telefon pekerja.")}</h2>
        <div role="tablist" aria-label={tr("Pilih ciri")} aria-orientation="vertical" className="flex flex-col">
          {tab.map((t, k) => (
            <button
              key={t.id}
              ref={(el) => {
                rujuk.current[k] = el;
              }}
              id={`tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={k === i}
              aria-controls="panel-skrin"
              tabIndex={k === i ? 0 : -1}
              onClick={() => setI(k)}
              onKeyDown={kekunci}
              className={`flex min-h-11 flex-col items-start gap-1 border-l-[3px] py-4 pl-[18px] text-left ${k === i ? "border-primary text-ink" : "border-[#EEF2F1] text-[#5B6B68]"}`}
            >
              <b className="text-[17px] font-extrabold">{t.label}</b>
              <span className="text-sm leading-snug text-[#5B6B68]">{t.tajuk}</span>
            </button>
          ))}
        </div>
      </div>
      <div id="panel-skrin" role="tabpanel" aria-labelledby={`tab-${semasa.id}`} className="flex justify-center">
        <div className="w-[200px] overflow-hidden rounded-[30px] border-[6px] border-ink bg-ink min-[700px]:w-[250px] min-[700px]:rounded-[36px] min-[700px]:border-8">
          <Image src={semasa.img} alt={semasa.alt} width={780} height={1560} sizes="250px" className="block w-full rounded-[24px] min-[700px]:rounded-[28px]" />
        </div>
      </div>
    </div>
  );
}
