"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { IconBack } from "./icons";
import { LABEL_STATUS, inisial, type StatusPermohonan } from "@/lib/format";

const LEBAR = {
  sempit: "lg:max-w-[560px]",
  sederhana: "lg:max-w-[760px]",
  lebar: "lg:max-w-[1240px]",
} as const;

/**
 * Bingkai skrin: lajur telefon (≤ 480px) pada telefon; pada skrin lebar (≥ 1024px)
 * kandungan dilebarkan (lalai "lebar") dan dijajarkan ke kiri bersebelahan menu sisi.
 */
export function Screen({ children, lebar = "lebar" }: { children: ReactNode; lebar?: keyof typeof LEBAR }) {
  // "sempit" = halaman awam / di luar aplikasi (tanpa menu sisi): kekal di tengah.
  const kiri = lebar === "sempit" ? "" : "lg:mx-0 lg:px-8";
  return <div className={`mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-page text-ink ${kiri} ${LEBAR[lebar]}`}>{children}</div>;
}

/** Pengepala dengan butang kembali (44px) dan tajuk. */
export function BackHeader({ title, href, action }: { title?: string; href?: string; action?: ReactNode }) {
  const router = useRouter();
  const cls = "flex size-11 items-center justify-center rounded-full text-ink!";
  return (
    <header className="flex items-center gap-2 px-3 pt-3 pb-1">
      {href ? (
        <Link href={href} aria-label="Kembali" className={cls}>
          <IconBack />
        </Link>
      ) : (
        <button type="button" aria-label="Kembali" className={cls} onClick={() => router.back()}>
          <IconBack />
        </button>
      )}
      {title && <h1 className="m-0 grow text-lg font-extrabold">{title}</h1>}
      {action}
    </header>
  );
}

const PILL: Record<StatusPermohonan, string> = {
  draft: "text-subtle bg-[#E9EEED]",
  pending: "text-warning bg-warning-soft",
  approved: "text-success bg-success-soft",
  rejected: "text-danger bg-danger-soft",
  returned: "text-warning bg-warning-soft",
  cancelled: "text-subtle bg-[#E9EEED]",
};

export function StatusPill({ status, label }: { status: StatusPermohonan; label?: string }) {
  return (
    <span className={`rounded-[10px] px-2.5 py-1 text-xs font-bold whitespace-nowrap ${PILL[status]}`}>
      {label ?? LABEL_STATUS[status]}
    </span>
  );
}

/** Bar kemajuan peringkat kelulusan (segmen). */
export function StepBar({ total, current, status }: { total: number; current: number; status: StatusPermohonan }) {
  const n = Math.max(total, 1);
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: n }, (_, i) => {
        const step = i + 1;
        const color =
          status === "approved" || step < current
            ? "bg-primary"
            : step === current && status === "pending"
              ? "bg-[#F2B266]"
              : "bg-[#DCE3E1]";
        return <span key={i} className={`h-1.5 grow rounded-[3px] ${color}`} />;
      })}
    </div>
  );
}

const AVATAR = [
  "bg-primary-soft text-primary",
  "bg-[#EDE9F8] text-ai",
  "bg-[#FDEBD7] text-warning",
  "bg-[#EAF0FB] text-[#2F5BA8]",
];

export function Avatar({ name, size = 42, index = 0 }: { name: string; size?: number; index?: number }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-extrabold ${AVATAR[index % AVATAR.length]}`}
      style={{ width: size, height: size, fontSize: size >= 48 ? 16 : 15 }}
    >
      {inisial(name)}
    </span>
  );
}

export function PrimaryButton({
  children,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`flex h-12 items-center justify-center rounded-button bg-primary text-base font-extrabold text-on-primary hover:bg-primary-hover disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export function Loading({ label = "Memuatkan…" }: { label?: string }) {
  return (
    <div role="status" className="flex grow items-center justify-center p-8 text-sm text-muted">
      {label}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-semibold text-danger">
      {message}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-card bg-surface px-4 py-6 text-center text-sm text-muted">{children}</div>;
}
