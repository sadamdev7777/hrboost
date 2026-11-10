"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { IconBack } from "./icons";
import { LABEL_STATUS, inisial, type StatusPermohonan } from "@/lib/format";

const LEBAR = {
  sempit: "lg:max-w-[560px]",
  sederhana: "lg:max-w-[760px] 2xl:max-w-[840px]",
  lebar: "lg:max-w-[1240px] 2xl:max-w-[1560px]",
} as const;

/**
 * Bingkai skrin: lajur telefon (≤ 480px) pada telefon; pada skrin lebar (≥ 1024px)
 * kandungan dilebarkan (lalai "lebar") dan dijajarkan ke kiri bersebelahan menu sisi.
 * Pada monitor sangat lebar (≥ 1536px) kandungan dilebarkan lagi dan diletakkan di tengah
 * ruang selepas menu sisi supaya tiada ruang kosong yang besar di sebelah kanan.
 */
export function Screen({ children, lebar = "lebar" }: { children: ReactNode; lebar?: keyof typeof LEBAR }) {
  // "sempit" = halaman awam / di luar aplikasi (tanpa menu sisi): kekal di tengah.
  const kiri = lebar === "sempit" ? "" : "lg:mx-0 lg:px-8 2xl:mx-auto 2xl:px-10";
  return <div className={`mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-page text-ink ${kiri} ${LEBAR[lebar]}`}>{children}</div>;
}

/** Pengepala dengan butang kembali (44px) dan tajuk. */
export function BackHeader({ title, href, action }: { title?: string; href?: string; action?: ReactNode }) {
  const router = useRouter();
  const cls = "flex size-11 items-center justify-center rounded-full text-ink!";
  return (
    <header className="flex items-center gap-2 px-3 pt-3 pb-1">
      {href ? (
        <Link href={href} aria-label={tr("Kembali")} className={cls}>
          <IconBack />
        </Link>
      ) : (
        <button type="button" aria-label={tr("Kembali")} className={cls} onClick={() => router.back()}>
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

/** Rangka kelabu semasa memuatkan (lebih pantas dirasai berbanding teks "Memuatkan…"). */
export function Loading({ label = tr("Memuatkan…") }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex w-full flex-col gap-3 px-4 py-4 lg:px-0">
      <span className="sr-only">{label}</span>
      <div className="h-[72px] animate-pulse rounded-card bg-[#E4EAE8]" />
      <div className="flex flex-col gap-0 rounded-card bg-surface px-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 border-b border-[#EEF2F1] py-3.5 last:border-0">
            <span className="size-9 shrink-0 animate-pulse rounded-full bg-[#E4EAE8]" />
            <span className="flex grow flex-col gap-2">
              <span className="h-3 w-2/5 animate-pulse rounded bg-[#E4EAE8]" />
              <span className="h-2.5 w-3/5 animate-pulse rounded bg-[#EEF2F1]" />
            </span>
          </div>
        ))}
      </div>
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
