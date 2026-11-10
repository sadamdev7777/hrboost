"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { hasRole, useMeContext } from "@/lib/me";
import { useMod } from "@/lib/mod";

type Tab = { href: string; label: string; roles?: string[] };

/** Tab bagi setiap modul HR. Alat kecil diletakkan sebagai tab supaya menu utama kekal ringkas. */
export const TAB_MODUL = {
  gaji: {
    label: tr("Penggajian"),
    tabs: [
      { href: "/pengurusan/gaji", label: tr("Bulan ini") },
      { href: "/pengurusan/gaji/pekerja", label: tr("Gaji pekerja") },
      { href: "/pengurusan/gaji/pendahuluan", label: tr("Pendahuluan") },
      { href: "/pengurusan/gaji/sejarah", label: tr("Sejarah") },
    ],
  },
  pekerja: {
    label: tr("Pekerja"),
    tabs: [
      { href: "/pengurusan/pekerja", label: tr("Senarai pekerja") },
      { href: "/pengurusan/carta", label: tr("Carta organisasi") },
      { href: "/pengurusan/tetapan/jabatan", label: tr("Jabatan"), roles: ["hr", "admin"] },
    ],
  },
  cuti: {
    label: tr("Cuti"),
    tabs: [
      { href: "/pengurusan/cuti", label: tr("Ringkasan") },
      { href: "/pengurusan/cuti/baki", label: tr("Baki cuti") },
      { href: "/kalendar", label: tr("Kalendar pasukan") },
      { href: "/pengurusan/tetapan/cuti-umum", label: tr("Cuti umum"), roles: ["hr", "admin"] },
    ],
  },
  kehadiran: {
    label: tr("Kehadiran"),
    tabs: [
      { href: "/pengurusan/kehadiran", label: tr("Kehadiran harian") },
      { href: "/pengurusan/kehadiran/pembetulan", label: tr("Pembetulan masa") },
      { href: "/pengurusan/kerja-fleksibel", label: tr("Kerja fleksibel"), roles: ["hr", "admin"] },
    ],
  },
  peti: {
    label: tr("Peti HR"),
    tabs: [
      { href: "/pengurusan/soalan", label: tr("Soalan HR") },
      { href: "/pengurusan/surat", label: tr("Permintaan surat") },
    ],
  },
} satisfies Record<string, { label: string; tabs: Tab[] }>;

/**
 * Bar tab modul. Di luar /pengurusan (cth. Kalendar pasukan, yang juga dibuka oleh pekerja biasa
 * dari Saya) tab hanya dipaparkan dalam Mod HR. Tab yang memerlukan peranan tertentu disorok jika tiada akses.
 */
export function TabModul({ modul }: { modul: keyof typeof TAB_MODUL }) {
  const path = usePathname();
  const { mod } = useMod();
  const { state } = useMeContext();
  const me = state.status === "ready" ? state.me : null;
  if (!me || (mod !== "hr" && !path.startsWith("/pengurusan"))) return null;
  const m = TAB_MODUL[modul];
  const tabs = (m.tabs as Tab[]).filter((t) => !t.roles || hasRole(me, t.roles as Parameters<typeof hasRole>[1]));
  if (tabs.length < 2) return null;
  return (
    <nav aria-label={tr(m.label)} className="flex gap-0.5 overflow-x-auto border-b border-line-soft px-3 lg:px-0 print:hidden!">
      {tabs.map((t) => {
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
