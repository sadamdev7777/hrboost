"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { IconBack, IconCheckSquare, IconHome, IconPlusCircle, IconUser } from "./icons";
import { LABEL_STATUS, inisial, type StatusPermohonan } from "@/lib/format";

/** Bingkai skrin telefon: lebar maksimum, latar halaman, tinggi penuh. */
export function Screen({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-page text-ink">{children}</div>;
}

/** Pengepala dengan butang kembali (44px) dan tajuk. */
export function BackHeader({ title, href, action }: { title?: string; href?: string; action?: ReactNode }) {
  const router = useRouter();
  const cls = "flex size-11 items-center justify-center rounded-full text-ink!";
  return (
    <header className="flex items-center gap-2 px-3 pt-4 pb-2">
      {href ? (
        <Link href={href} aria-label="Kembali" className={cls}>
          <IconBack />
        </Link>
      ) : (
        <button type="button" aria-label="Kembali" className={cls} onClick={() => router.back()}>
          <IconBack />
        </button>
      )}
      {title && <h1 className="m-0 grow text-xl font-extrabold">{title}</h1>}
      {action}
    </header>
  );
}

const TABS = [
  { href: "/utama", label: "Utama", Icon: IconHome },
  { href: "/mohon", label: "Mohon", Icon: IconPlusCircle },
  { href: "/kelulusan", label: "Kelulusan", Icon: IconCheckSquare },
  { href: "/saya", label: "Saya", Icon: IconUser },
];

/** Navigasi bawah 4 tab (CLAUDE.md §1: Utama, Mohon, Kelulusan, Saya). */
export function BottomNav({ approvals = 0 }: { approvals?: number }) {
  const path = usePathname();
  return (
    <nav className="sticky bottom-0 grid grid-cols-4 border-t border-line-soft bg-surface px-2 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">
      {TABS.map(({ href, label, Icon }) => {
        const on = path === href || path.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`relative flex flex-col items-center gap-1 py-1.5 text-xs ${
              on ? "font-bold text-primary!" : "font-semibold text-muted!"
            }`}
          >
            {href === "/kelulusan" && approvals > 0 && (
              <span className="absolute top-0 left-[54%] flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[11px] font-extrabold text-white">
                {approvals}
              </span>
            )}
            <Icon />
            {label}
          </Link>
        );
      })}
    </nav>
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
      className={`flex h-14 items-center justify-center rounded-button bg-primary text-base font-extrabold text-on-primary hover:bg-primary-hover disabled:opacity-60 ${className}`}
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
