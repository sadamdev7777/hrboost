"use client";

import { tr } from "@/lib/i18n";
import { useCallback, useSyncExternalStore } from "react";
import { hasRole, useMeContext, type Me } from "./me";

/** Mod paparan: "hr" (pengurusan) atau "pekerja" (urusan diri sendiri). */
export type Mod = "hr" | "pekerja";

const KUNCI = "hrb_mod";
const PERISTIWA = "hrb-mod";
const PERANAN_PENGURUSAN = ["hr", "finance", "ceo", "admin"] as const;

export function bolehModHr(me: Me | null): boolean {
  return !!me && !!me.active && hasRole(me, [...PERANAN_PENGURUSAN]);
}

function baca(): string {
  try {
    return localStorage.getItem(KUNCI) ?? "";
  } catch {
    return "";
  }
}
function langgan(cb: () => void) {
  window.addEventListener(PERISTIWA, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(PERISTIWA, cb);
    window.removeEventListener("storage", cb);
  };
}

export function setMod(m: Mod) {
  try {
    localStorage.setItem(KUNCI, m);
  } catch {
    /* storan disekat */
  }
  window.dispatchEvent(new Event(PERISTIWA));
}

/** Mod semasa. Lalai: "hr" bagi HR / Kewangan / CEO / Pentadbir, "pekerja" bagi yang lain. */
export function useMod(): { mod: Mod; boleh: boolean; tukar: (m: Mod) => void } {
  const { state } = useMeContext();
  const me = state.status === "ready" ? state.me : null;
  const boleh = bolehModHr(me);
  const disimpan = useSyncExternalStore(langgan, baca, () => "");
  const mod: Mod = boleh && disimpan !== "pekerja" ? "hr" : "pekerja";
  const tukar = useCallback((m: Mod) => setMod(m), []);
  return { mod, boleh, tukar };
}

export type ItemNav = { href: string; label: string; pendek?: string; ikon: "home" | "plus" | "check" | "user" | "chart" | "users" | "card" | "settings" | "org" | "calendar" | "document" | "bell" | "chat"; roles?: string[] };

export const NAV_PEKERJA: ItemNav[] = [
  { href: "/utama", label: tr("Utama"), ikon: "home" },
  { href: "/mohon", label: tr("Mohon"), ikon: "plus" },
  { href: "/kelulusan", label: tr("Kelulusan"), ikon: "check" },
  { href: "/saya", label: tr("Saya"), ikon: "user" },
];

export const NAV_HR: ItemNav[] = [
  { href: "/pengurusan", label: tr("Papan Pemuka"), pendek: tr("Utama"), ikon: "chart" },
  { href: "/pengurusan/pekerja", label: tr("Pekerja"), ikon: "users", roles: ["hr", "ceo", "admin"] },
  { href: "/kelulusan", label: tr("Kelulusan"), ikon: "check" },
  { href: "/pengurusan/gaji", label: tr("Gaji"), ikon: "card", roles: ["hr", "finance", "admin"] },
  { href: "/saya", label: tr("Saya"), ikon: "user" },
];

/** Item tambahan dalam menu sisi (desktop) Mod HR. */
export const NAV_HR_LAGI: ItemNav[] = [
  { href: "/kalendar", label: tr("Kalendar pasukan"), ikon: "calendar" },
  { href: "/pengurusan/surat", label: tr("Surat"), ikon: "document", roles: ["hr", "admin"] },
  { href: "/pengurusan/pengumuman", label: tr("Pengumuman"), ikon: "bell", roles: ["hr", "ceo", "admin"] },
  { href: "/pengurusan/soalan", label: tr("Soalan HR"), ikon: "chat", roles: ["hr", "admin"] },
  { href: "/pengurusan/kerja-fleksibel", label: tr("Kerja fleksibel"), ikon: "calendar", roles: ["hr", "admin"] },
  { href: "/pengurusan/laporan", label: tr("Laporan"), ikon: "chart" },
  { href: "/pengurusan/tetapan/jabatan", label: tr("Jabatan"), ikon: "org", roles: ["hr", "admin"] },
  { href: "/pengurusan/tetapan", label: tr("Tetapan"), ikon: "settings" },
];

export function navUntuk(me: Me | null, mod: Mod): ItemNav[] {
  if (mod === "pekerja" || !me) return NAV_PEKERJA;
  return NAV_HR.filter((n) => !n.roles || hasRole(me, n.roles as Parameters<typeof hasRole>[1]));
}

/** Item yang aktif: padanan awalan terpanjang (cth. /pengurusan/gaji mengatasi /pengurusan). */
export function itemAktif(items: ItemNav[], path: string): string | null {
  let best: string | null = null;
  for (const n of items) {
    if ((path === n.href || path.startsWith(n.href + "/")) && (!best || n.href.length > best.length)) best = n.href;
  }
  return best;
}

export function lamanUtama(mod: Mod): string {
  return mod === "hr" ? "/pengurusan" : "/utama";
}
