"use client";

import { tr } from "@/lib/i18n";
import { useState } from "react";
import { KADAR_SISTEM_LAIN, KALKULATOR } from "@/lib/laman";

const rm = (v: number) => "RM" + v.toLocaleString("en-MY");

/** Kalkulator penjimatan: bilangan pekerja × kadar sistem lain. */
export function Kalkulator() {
  const [n, setN] = useState(KALKULATOR.lalai);
  const kurang = () => setN((x) => Math.max(KALKULATOR.min, x - KALKULATOR.langkah));
  const tambah = () => setN((x) => Math.min(KALKULATOR.maks, x + KALKULATOR.langkah));
  const btn =
    "flex size-11 items-center justify-center rounded-[10px] border-[1.5px] border-[#E2E8E6] bg-[#F4F6F5] text-xl font-bold text-ink disabled:opacity-40";
  return (
    <div className="grid items-center gap-7 rounded-[20px] bg-[#F4F6F5] px-[18px] py-6 min-[700px]:rounded-[24px] min-[700px]:px-8 min-[700px]:py-9 min-[980px]:grid-cols-2">
      <div className="flex flex-col gap-3">
        <h2 className="m-0 text-[23px] leading-[1.15] font-extrabold tracking-[-0.015em] min-[700px]:text-[28px] min-[980px]:text-[36px]">{tr("Berapa banyak yang boleh anda jimatkan?")}</h2>
        <p className="m-0 text-base leading-relaxed text-[#5B6B68]">{tr("Sistem lain mengenakan bayaran bagi setiap pekerja, setiap bulan. HRBoost RM499 setahun bagi seluruh syarikat.")}</p>
        <div className="mt-1.5 flex items-center justify-between gap-3 rounded-[14px] bg-white py-2 pr-2 pl-4">
          <span id="kalk-label" className="text-sm font-bold">
            {tr("Bilangan pekerja")}
          </span>
          <span className="flex items-center gap-1">
            <button type="button" onClick={kurang} disabled={n <= KALKULATOR.min} aria-label={tr("Kurangkan bilangan pekerja")} className={btn}>
              −
            </button>
            <output aria-labelledby="kalk-label" aria-live="polite" className="min-w-12 text-center text-[22px] font-extrabold">
              {n}
            </output>
            <button type="button" onClick={tambah} disabled={n >= KALKULATOR.maks} aria-label={tr("Tambah bilangan pekerja")} className={btn}>
              +
            </button>
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-0.5 rounded-[14px] bg-white p-3.5">
            <span className="text-xs font-bold text-[#5B6B68]">{tr("Sistem lain")}</span>
            <b className="text-[17px] leading-tight font-extrabold text-[#92400E] min-[700px]:text-[19px]">
              {rm(n * KADAR_SISTEM_LAIN.min)}–{rm(n * KADAR_SISTEM_LAIN.maks)}
            </b>
            <span className="text-xs text-[#5B6B68]">{tr("sebulan")}</span>
          </div>
          <div className="flex flex-col gap-0.5 rounded-[14px] bg-primary p-3.5 text-white">
            <span className="text-xs font-bold text-[#D7ECE7]">HRBoost</span>
            <b className="text-[17px] leading-tight font-extrabold min-[700px]:text-[19px]">RM499</b>
            <span className="text-xs text-[#D7ECE7]">{tr("setahun, seluruh syarikat")}</span>
          </div>
        </div>
        <p className="m-0 text-[15px] font-bold text-[#0A4F46]" aria-live="polite">
          {tr("Jimat sehingga {0} setahun.", rm(Math.max(0, n * KADAR_SISTEM_LAIN.maks * 12 - 499)))}
        </p>
        <span className="text-xs leading-normal text-[#5B6B68]">
          {tr("Anggaran RM{0}–RM{1} seorang sebulan untuk HR dan gaji, berdasarkan harga umum yang diterbitkan.", KADAR_SISTEM_LAIN.min, KADAR_SISTEM_LAIN.maks)}
        </span>
      </div>
    </div>
  );
}
