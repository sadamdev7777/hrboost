"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { hasRole, useMe } from "@/lib/me";
import type { Database } from "@/lib/database.types";
import { BackHeader, Screen } from "./ui";

type Role = Database["public"]["Enums"]["app_role"];

/** Label seksyen huruf besar: "PERLU PERHATIAN" */
export function Seksyen({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`text-xs font-bold tracking-[0.04em] text-[#4A5A57] ${className}`}>{children}</span>;
}

/** Kotak putih dengan baris dipisahkan garis halus. */
export function Kotak({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-col rounded-card bg-surface px-4 py-1 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1] ${className}`}>{children}</div>;
}

/** Baris label kiri / nilai kanan. */
export function Medan({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-[50px] items-center justify-between gap-3 py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right font-bold">{children}</span>
    </div>
  );
}

/** Baris pautan dengan ikon/teks dan anak panah. */
export function BarisPautan({ href, children, kanan, roles }: { href: string; children: ReactNode; kanan?: ReactNode; roles?: Role[] }) {
  const me = useMe();
  // Pautan ke skrin yang tiada akses tidak dipaparkan langsung (elak halaman "Tiada akses").
  if (roles && !hasRole(me, roles)) return null;
  return (
    <Link href={href} className="flex min-h-12 items-center gap-3 py-2 text-sm font-semibold text-ink!">
      <span className="grow">{children}</span>
      {kanan}
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9AA8A5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warning" | "danger" | "ai" | "success" | "primary" }) {
  const cls = {
    neutral: "bg-[#E9EEED] text-subtle",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    ai: "bg-[#EDE9F8] text-[#4A3B8C]",
    success: "bg-success-soft text-success",
    primary: "bg-[#E3F1EE] text-primary",
  }[tone];
  return <span className={`shrink-0 rounded-lg px-2 py-[3px] text-[11px] font-bold whitespace-nowrap ${cls}`}>{children}</span>;
}

/** Hadkan skrin pengurusan kepada peranan tertentu dalam syarikat aktif (RLS tetap menjadi kawalan sebenar). */
export function HadPeranan({ roles, children, back = "/saya" }: { roles: Role[]; children: ReactNode; back?: string }) {
  const me = useMe();
  if (!me.active || !hasRole(me, roles)) {
    return (
      <Screen lebar="sederhana">
        <BackHeader title={tr("Tiada akses")} href={back} />
        <main className="px-4 pt-2 text-sm text-muted">{tr("Skrin ini hanya untuk {0} syarikat ini.", roles.map((r) => ({ hr: "HR", finance: tr("Kewangan"), ceo: "CEO", admin: tr("Pentadbir") })[r as string] ?? r).join(", "))}</main>
      </Screen>
    );
  }
  return <>{children}</>;
}

export const inputKecil =
  "h-11 w-full rounded-[12px] border border-[#D5DEDC] bg-surface px-3 text-sm font-semibold text-ink outline-none focus:border-primary";

export function MedanBorang({ label, children, nota }: { label: string; children: ReactNode; nota?: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-bold text-[#4A5A57]">{label}</span>
      {children}
      {nota && <span className="text-xs text-muted">{nota}</span>}
    </label>
  );
}

/** Lembaran bawah generik (borang ringkas dalam skrin yang sama). */
export function Lembaran({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 lg:items-center lg:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[90dvh] w-full max-w-[480px] flex-col gap-3 overflow-y-auto rounded-t-[20px] bg-surface px-4 pt-5 pb-5 lg:max-w-[560px] lg:rounded-[20px] lg:px-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2">
          <h2 className="m-0 grow pt-2 text-lg font-extrabold">{title}</h2>
          <button type="button" aria-label={tr("Tutup")} onClick={onClose} className="-mt-1 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-muted">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Suis hidup/mati (≥ 44px kawasan sentuh). */
export function Suis({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="flex h-11 w-[52px] shrink-0 items-center justify-end disabled:opacity-50"
    >
      <span className={`relative block h-7 w-[46px] rounded-full transition-colors ${on ? "bg-primary" : "bg-[#C9D3D1]"}`}>
        <span className={`absolute top-[3px] size-[22px] rounded-full bg-white transition-all ${on ? "right-[3px]" : "left-[3px]"}`} />
      </span>
    </button>
  );
}

/** Butang pilihan berbentuk cip. */
export function Cip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`h-10 rounded-full px-3.5 text-[13px] font-bold ${on ? "border-[1.5px] border-primary bg-[#E3F1EE] text-primary" : "border border-[#D5DEDC] bg-surface text-[#4A5A57]"}`}
    >
      {children}
    </button>
  );
}

export function ButangUtama({ children, onClick, busy, disabled, danger }: { children: ReactNode; onClick: () => void; busy?: boolean; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className={`h-12 w-full rounded-button text-base font-extrabold text-white disabled:opacity-60 ${danger ? "bg-danger" : "bg-primary"}`}
    >
      {busy ? tr("Menyimpan…") : children}
    </button>
  );
}

/** Input sempit untuk nilai di hujung baris (tanpa w-full). */
export const inputSempit =
  "h-10 shrink-0 rounded-[10px] border border-[#D5DEDC] bg-surface px-2.5 text-sm font-semibold text-ink outline-none focus:border-primary disabled:bg-page";
