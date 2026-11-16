"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  IconBack,
  IconDownload,
  IconPrinter,
  IconShare,
} from "@/components/icons";

type Props = {
  title: string;
  href: string;
  /** Muat turun PDF (dijana dalam pelayar). Tiada = butang Cetak menjadi tindakan utama (Simpan sebagai PDF melalui pelayar). */
  onMuatTurun?: () => void;
  onKongsi?: () => void;
  onCetak?: () => void;
  sibuk?: "muat" | "kongsi" | null;
  /** false semasa dokumen belum dimuatkan: tajuk sahaja, tiada butang */
  sedia?: boolean;
  /** Kawalan tambahan di pengepala (cth. pilih tahun) */
  tambahan?: ReactNode;
};

const garis =
  "flex items-center justify-center gap-2 rounded-button border border-line bg-surface font-bold text-ink hover:border-primary disabled:opacity-60";
const utama =
  "flex items-center justify-center gap-2 rounded-button bg-primary font-extrabold text-white disabled:opacity-60";

/**
 * Pengepala & tindakan bagi dokumen A4 (surat, Borang EA, PCB II, CP22).
 * Desktop/tablet: tindakan di sebelah kanan tajuk, melekat di atas, sejajar dengan kertas.
 * Telefon: bar bawah satu baris — tindakan utama melebar, Kongsi & Cetak sebagai butang ikon.
 */
export function BarDokumen({
  title,
  href,
  onMuatTurun,
  onKongsi,
  onCetak = () => window.print(),
  sibuk = null,
  sedia = true,
}: Props) {
  const labelUtama = onMuatTurun
    ? sibuk === "muat"
      ? tr("Menyediakan PDF…")
      : tr("Muat turun PDF")
    : tr("Simpan sebagai PDF / Cetak");
  const tekanUtama = onMuatTurun ?? onCetak;
  return (
    <>
      <header className="no-print sticky top-0 z-20 bg-page/95 backdrop-blur">
        <div className="mx-auto flex max-w-[794px] items-center gap-2 px-3 py-2 sm:px-5">
          <Link
            href={href}
            aria-label={tr("Kembali")}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink!"
          >
            <IconBack />
          </Link>
          <h1 className="m-0 min-w-0 grow truncate text-lg font-extrabold">
            {title}
          </h1>
          <div
            className={`hidden items-center gap-2 ${sedia ? "min-[700px]:flex" : ""}`}
          >
            {onMuatTurun && onKongsi && (
              <button
                type="button"
                onClick={onKongsi}
                disabled={!!sibuk}
                className={`${garis} h-11 px-4 text-sm`}
              >
                <IconShare size={18} />
                {sibuk === "kongsi" ? "…" : tr("Kongsi")}
              </button>
            )}
            {onMuatTurun && (
              <button
                type="button"
                onClick={onCetak}
                className={`${garis} h-11 px-4 text-sm`}
              >
                <IconPrinter size={18} />
                {tr("Cetak")}
              </button>
            )}
            <button
              type="button"
              onClick={tekanUtama}
              disabled={!!sibuk}
              className={`${utama} h-11 px-5 text-sm`}
            >
              {onMuatTurun ? (
                <IconDownload size={18} />
              ) : (
                <IconPrinter size={18} />
              )}
              {labelUtama}
            </button>
          </div>
        </div>
      </header>
      {sedia && (
        <div className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-line-soft bg-surface/95 px-4 pt-3 pb-[max(14px,env(safe-area-inset-bottom))] backdrop-blur min-[700px]:hidden">
          <div className="mx-auto flex max-w-[480px] items-stretch gap-2">
            <button
              type="button"
              onClick={tekanUtama}
              disabled={!!sibuk}
              className={`${utama} h-12 min-w-0 grow px-3 text-[15px]`}
            >
              {onMuatTurun ? (
                <IconDownload size={20} />
              ) : (
                <IconPrinter size={20} />
              )}
              <span className="truncate">{labelUtama}</span>
            </button>
            {onMuatTurun && onKongsi && (
              <button
                type="button"
                onClick={onKongsi}
                disabled={!!sibuk}
                aria-label={tr("Kongsi")}
                className={`${garis} h-12 w-14 shrink-0 flex-col gap-0 text-[11px]`}
              >
                <IconShare size={18} />
                {tr("Kongsi")}
              </button>
            )}
            {onMuatTurun && (
              <button
                type="button"
                onClick={onCetak}
                aria-label={tr("Cetak")}
                className={`${garis} h-12 w-14 shrink-0 flex-col gap-0 text-[11px]`}
              >
                <IconPrinter size={18} />
                {tr("Cetak")}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
