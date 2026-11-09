"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import type { ReactNode } from "react";
import { IconBack } from "./icons";
import { Screen } from "./ui";

/** Susun atur langkah persediaan syarikat (SyarikatLangkah, ImportPekerja, …). */
export function MulaLayout({ n, title, back, children, footer }: { n: number; title: string; back: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <Screen lebar="sederhana">
      <header className="flex items-center gap-2 px-3 pt-4 pb-1">
        <Link href={back} aria-label={tr("Kembali")} className="flex size-11 items-center justify-center rounded-full text-ink!">
          <IconBack />
        </Link>
        <span className="text-[13px] font-bold text-muted">{tr("Langkah {0} daripada 6", n)}</span>
      </header>
      <div className="mx-5 mb-2 h-1.5 rounded-full bg-[#E4EAE8]" aria-hidden="true">
        <div className="h-full rounded-full bg-primary" style={{ width: `${(n / 6) * 100}%` }} />
      </div>
      <main className="flex grow flex-col gap-3 px-4 pt-2 pb-4">
        <h1 className="m-0 text-xl font-extrabold">{title}</h1>
        {children}
      </main>
      {footer && <div className="bar-bawah sticky bottom-0 border-t border-line-soft bg-surface px-4 pt-3 pb-5">{footer}</div>}
    </Screen>
  );
}
