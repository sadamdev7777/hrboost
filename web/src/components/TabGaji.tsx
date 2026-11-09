"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TAB = [
  { href: "/pengurusan/gaji", label: tr("Bulan ini") },
  { href: "/pengurusan/gaji/pekerja", label: tr("Gaji pekerja") },
  { href: "/pengurusan/gaji/pendahuluan", label: tr("Pendahuluan") },
  { href: "/pengurusan/gaji/sejarah", label: tr("Sejarah") },
];

/** Tab halaman Gaji: proses bulan ini, gaji tetap pekerja, sejarah & fail. */
export function TabGaji() {
  const path = usePathname();
  return (
    <nav aria-label={tr("Gaji")} className="flex gap-0.5 overflow-x-auto border-b border-line-soft px-3 lg:px-0">
      {TAB.map((t) => {
        const on = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`flex h-10 shrink-0 items-center border-b-[3px] px-3 text-sm whitespace-nowrap ${on ? "border-primary font-extrabold text-primary!" : "border-transparent font-semibold text-[#4A5A57]!"}`}
          >
            {tr(t.label)}
          </Link>
        );
      })}
    </nav>
  );
}
