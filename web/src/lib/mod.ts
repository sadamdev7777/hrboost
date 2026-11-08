"use client";

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

export type ItemNav = { href: string; label: string; pendek?: string; ikon: "home" | "plus" | "check" | "user" | "chart" | "users" | "card" | "settings"; roles?: string[] };

export const NAV_PEKERJA: ItemNav[] = [
  { href: "/utama", label: "Utama", ikon: "home" },
  { href: "/mohon", label: "Mohon", ikon: "plus" },
  { href: "/kelulusan", label: "Kelulusan", ikon: "check" },
  { href: "/saya", label: "Saya", ikon: "user" },
];

export const NAV_HR: ItemNav[] = [
  { href: "/pengurusan", label: "Papan Pemuka", pendek: "Utama", ikon: "chart" },
  { href: "/pengurusan/pekerja", label: "Pekerja", ikon: "users", roles: ["hr", "ceo", "admin"] },
  { href: "/kelulusan", label: "Kelulusan", ikon: "check" },
  { href: "/pengurusan/gaji", label: "Gaji", ikon: "card", roles: ["hr", "finance", "admin"] },
  { href: "/saya", label: "Saya", ikon: "user" },
];

/** Item tambahan dalam menu sisi (desktop) Mod HR. */
export const NAV_HR_LAGI: ItemNav[] = [
  { href: "/pengurusan/gaji/pekerja", label: "Gaji Pekerja", ikon: "card", roles: ["hr", "finance", "admin"] },
  { href: "/pengurusan/tetapan", label: "Tetapan", ikon: "settings" },
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
