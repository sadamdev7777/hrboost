"use client";

import { LogoTeks } from "@/components/LogoTeks";
import { tr } from "@/lib/i18n";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Kerangka halaman awam berborang (daftar syarikat, sahkan e-mel, lupa / set semula kata laluan).
 * Telefon: lajur tunggal. Desktop (≥ 1024px): panel jenama di kiri, borang di tengah ruang kanan.
 */
export function KerangkaAwam({ children, tajuk, kecil, ciri }: { children: ReactNode; tajuk: string; kecil: string; ciri: string[] }) {
  return (
    <div className="flex min-h-dvh w-full bg-page text-ink">
      <aside className="sticky top-0 hidden h-dvh w-[42%] max-w-[600px] shrink-0 flex-col justify-between bg-primary px-14 py-12 text-on-primary lg:flex">
        <Link href="/" className="flex w-fit items-center">
          <LogoTeks varian="putih" tinggi={28} />
        </Link>
        <div className="flex flex-col gap-6">
          <h1 className="m-0 text-[36px] leading-[1.15] font-extrabold">{tajuk}</h1>
          <p className="m-0 max-w-[420px] text-lg leading-relaxed opacity-90">{kecil}</p>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {ciri.map((c) => (
              <li key={c} className="flex items-center gap-3 text-base font-semibold">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/18 text-sm">✓</span>
                {c}
              </li>
            ))}
          </ul>
        </div>
        <span className="text-sm opacity-75">{tr("Sistem HR untuk syarikat di Malaysia.")}</span>
      </aside>
      <div className="flex min-h-dvh grow justify-center">
        <div className="flex w-full max-w-[480px] flex-col lg:max-w-[540px] lg:justify-center lg:py-10">{children}</div>
      </div>
    </div>
  );
}

/** Teks panel jenama bagi pendaftaran syarikat. */
export const CIRI_DAFTAR = () => [
  tr("Cuba percuma 5 hari"),
  tr("Cuti, tuntutan, kehadiran & gaji dalam satu sistem"),
  tr("Kelulusan terus dari WhatsApp"),
  tr("KWSP, PERKESO, SIP & PCB dikira automatik"),
];
