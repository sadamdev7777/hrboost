"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { IconBack } from "./icons";
import { ErrorBox, Screen } from "./ui";

/** Bingkai skrin langkah orientasi: kembali, "Langkah N daripada 8", 8 bar, kandungan, butang bawah. */
export function OnboardingLayout({
  step,
  back,
  title,
  sub,
  children,
  footer,
  error,
}: {
  step: number;
  back: string;
  title: string;
  sub?: string;
  children: ReactNode;
  footer: ReactNode;
  error?: string | null;
}) {
  return (
    <Screen>
      <header className="flex items-center gap-2 px-3 pt-4 pb-1">
        <Link href={back} aria-label="Kembali" className="flex size-11 items-center justify-center rounded-full text-ink!">
          <IconBack />
        </Link>
        <span className="text-[13px] font-bold text-subtle">Langkah {step} daripada 8</span>
      </header>
      <div className="grid grid-cols-8 gap-1 px-4 pb-2" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className={`h-[5px] rounded-[3px] ${i < step ? "bg-primary" : "bg-[#DCE3E1]"}`} />
        ))}
      </div>
      <main className="flex grow flex-col gap-3 px-4 pt-2.5 pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-2xl font-extrabold">{title}</h1>
          {sub && <span className="text-sm text-subtle">{sub}</span>}
        </div>
        {children}
        {error && <ErrorBox message={error} />}
      </main>
      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-line-soft bg-surface px-4 pt-3 pb-5">{footer}</div>
    </Screen>
  );
}

export function NextButton({
  children = "Simpan & seterusnya",
  busy,
  disabled,
  onClick,
  type = "button",
}: {
  children?: ReactNode;
  busy?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={busy || disabled}
      className="flex h-12 w-full items-center justify-center rounded-button bg-primary text-base font-extrabold text-white hover:bg-primary-hover disabled:bg-[#DCE3E1] disabled:text-subtle"
    >
      {busy ? "Menyimpan…" : children}
    </button>
  );
}

export function Seksyen({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`text-xs font-bold tracking-[0.04em] text-subtle ${className}`}>{children}</span>;
}

export const inputCls =
  "h-[50px] rounded-xl border border-line bg-surface px-3.5 text-sm font-semibold text-ink placeholder:font-normal placeholder:text-muted";
