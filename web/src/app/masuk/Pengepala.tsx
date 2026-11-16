"use client";

import { LogoTeks } from "@/components/LogoTeks";
import { tr } from "@/lib/i18n";
import Link from "next/link";
import { PilihBahasa } from "@/components/PilihBahasa";
import { IconBack } from "@/components/icons";
import type { ReactNode } from "react";

// Fungsi (bukan pemalar) supaya teks mengikut bahasa permintaan semasa
const CIRI = () => [tr("Mohon cuti & tuntutan dari telefon"), tr("Kelulusan dengan satu sentuhan"), tr("Gaji, KWSP, PERKESO & PCB automatik")];

/**
 * Kerangka skrin log masuk (rujukan reka bentuk: design/Login.dc.html).
 * Telefon: pengepala hijau di atas borang. Desktop: panel jenama di kiri, borang di kanan.
 */
export function KerangkaMasuk({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full bg-page text-ink">
      <div className="hidden w-[46%] max-w-[640px] flex-col justify-between bg-primary px-14 py-12 text-on-primary lg:flex">
        <Link href="/" className="flex w-fit items-center">
          <LogoTeks varian="putih" tinggi={28} />
        </Link>
        <div className="flex flex-col gap-6">
          <h1 className="m-0 text-[40px] leading-[1.12] font-extrabold">{tr("Selamat datang.")}</h1>
          <p className="m-0 max-w-[420px] text-lg leading-relaxed opacity-90">{tr("Urusan HR yang lengkap, tanpa pegawai HR.")}</p>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {CIRI().map((c) => (
              <li key={c} className="flex items-center gap-3 text-base font-semibold">
                <span className="flex size-6 items-center justify-center rounded-full bg-white/18 text-sm">✓</span>
                {c}
              </li>
            ))}
          </ul>
        </div>
        <span className="text-sm opacity-75">{tr("Sistem HR percuma untuk syarikat di Malaysia.")}</span>
      </div>

      <main className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col lg:max-w-[440px] lg:justify-center">
        <Link
          href="/"
          aria-label={tr("Kembali ke laman utama")}
          title={tr("Kembali ke laman utama")}
          className="absolute top-3 left-3 z-10 flex size-11 items-center justify-center rounded-full text-white! hover:bg-white/10 lg:top-6 lg:left-0 lg:text-ink! lg:hover:bg-black/5"
        >
          <IconBack size={22} />
        </Link>
        <div className="absolute top-3 right-3 z-10 lg:top-6 lg:right-0">
          <PilihBahasa kecil />
        </div>
        <header className="flex flex-col gap-3 bg-primary px-6 pt-14 pb-8 text-on-primary lg:bg-transparent lg:px-6 lg:pt-0 lg:pb-2 lg:text-ink">
          <LogoTeks varian="putih" tinggi={22} className="mb-1 self-start lg:hidden" />
          <h1 className="m-0 text-[26px] leading-[1.15] font-extrabold lg:hidden">{tr("Selamat datang.")}</h1>
          <span className="text-sm leading-normal opacity-[0.92] lg:hidden">
            {tr("Log masuk ke")} <b>HRBoost.io</b>
          </span>
          <h2 className="m-0 hidden text-2xl font-extrabold lg:block">{tr("Log masuk")}</h2>
        </header>
        {children}
        <div className="pb-8" />
      </main>
    </div>
  );
}
