"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/** Kad statistik ringkas di atas halaman modul (sama gaya dengan Papan Pemuka). */
export function KadStat({ label, nilai, kecil, tone, href, onClick, aktif }: {
  label: string;
  nilai: string | number;
  kecil?: string;
  tone?: "warning" | "danger" | "primary" | "success";
  href?: string;
  onClick?: () => void;
  aktif?: boolean;
}) {
  const warna = { warning: "text-warning", danger: "text-danger", primary: "text-primary", success: "text-success" }[tone ?? "primary"] ?? "";
  const isi = (
    <>
      <span className="text-xs font-semibold text-muted">{label}</span>
      <b className={`text-xl font-extrabold lg:text-[26px] ${tone ? warna : ""}`}>{nilai}</b>
      {kecil && <span className="text-xs font-semibold text-muted">{kecil}</span>}
    </>
  );
  const cls = `flex min-h-[76px] flex-col gap-0.5 rounded-card bg-surface px-4 py-3 text-left lg:px-5 ${aktif ? "ring-2 ring-primary" : ""}`;
  if (href)
    return (
      <Link href={href} className={`${cls} text-ink! hover:bg-[#F7F9F8]`}>
        {isi}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} aria-pressed={aktif} className={`${cls} text-ink hover:bg-[#F7F9F8]`}>
        {isi}
      </button>
    );
  return <div className={cls}>{isi}</div>;
}

export function BarisStat({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">{children}</div>;
}

/** Panel dengan tajuk huruf besar dan senarai berpemisah. */
export function Panel({ tajuk, kanan, children }: { tajuk: string; kanan?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col rounded-card bg-surface px-4 pt-3 pb-1 lg:px-5">
      <div className="flex items-center justify-between gap-2 pb-1">
        <h2 className="m-0 text-xs font-bold tracking-[0.04em] text-[#4A5A57]">{tajuk}</h2>
        {kanan}
      </div>
      <div className="flex flex-col [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">{children}</div>
    </section>
  );
}

/** Baris kosong dalam panel. */
export function Kosong({ children }: { children: ReactNode }) {
  return <p className="m-0 py-3 text-sm text-muted">{children}</p>;
}

/** Cip penapis (status). */
export function Cip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`h-10 shrink-0 rounded-full px-3.5 text-[13px] font-bold whitespace-nowrap ${on ? "bg-primary text-white" : "bg-surface text-[#4A5A57]"}`}
    >
      {children}
    </button>
  );
}

/** Jadual responsif: diskrol mendatar pada telefon. */
export function Jadual({ kepala, children, kanan = [] }: { kepala: string[]; children: ReactNode; kanan?: number[] }) {
  return (
    <div className="overflow-x-auto rounded-card bg-surface">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line-soft text-left text-[11px] font-bold tracking-[0.04em] text-muted">
            {kepala.map((k, i) => (
              <th key={i} className={`px-3 py-3 whitespace-nowrap first:pl-4 last:pr-4 lg:first:pl-5 lg:last:pr-5 ${kanan.includes(i) ? "text-right" : ""}`}>
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr+tr]:border-t [&>tr+tr]:border-[#EEF2F1] [&_td]:px-3 [&_td]:py-2.5 [&_td:first-child]:pl-4 [&_td:last-child]:pr-4 lg:[&_td:first-child]:pl-5 lg:[&_td:last-child]:pr-5">
          {children}
        </tbody>
      </table>
    </div>
  );
}
