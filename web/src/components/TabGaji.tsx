"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TAB = [
  { href: "/pengurusan/gaji", label: "Bulan ini" },
  { href: "/pengurusan/gaji/pekerja", label: "Gaji pekerja" },
  { href: "/pengurusan/gaji/sejarah", label: "Sejarah" },
];

/** Tab halaman Gaji: proses bulan ini, gaji tetap pekerja, sejarah & fail. */
export function TabGaji() {
  const path = usePathname();
  return (
    <nav aria-label="Gaji" className="flex gap-0.5 overflow-x-auto border-b border-line-soft px-3 lg:px-0">
      {TAB.map((t) => {
        const on = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`flex h-10 shrink-0 items-center border-b-[3px] px-3 text-sm whitespace-nowrap ${on ? "border-primary font-extrabold text-primary!" : "border-transparent font-semibold text-[#4A5A57]!"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
