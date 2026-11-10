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

export type IkonNav =
  | "home" | "plus" | "check" | "user" | "chart" | "users" | "card" | "settings" | "org" | "calendar" | "document" | "bell" | "chat"
  | "clock" | "receipt" | "userplus" | "inbox" | "grid" | "wallet" | "sparkle" | "cake";
/** `padan`: awalan laluan lain yang turut menandakan item ini aktif (tab dalam modul). */
export type ItemNav = { href: string; label: string; pendek?: string; ikon: IkonNav; roles?: string[]; padan?: string[] };
export type KumpulanNav = { tajuk: string | null; items: ItemNav[] };

export const NAV_PEKERJA: ItemNav[] = [
  { href: "/utama", label: tr("Utama"), ikon: "home" },
  { href: "/mohon", label: tr("Mohon"), ikon: "plus" },
  { href: "/kelulusan", label: tr("Kelulusan"), ikon: "check" },
  { href: "/saya", label: tr("Saya"), ikon: "user" },
];

/**
 * Menu sisi desktop Mod Pekerja: urusan harian dikumpulkan supaya Slip gaji, Cuti, Tuntutan dan Kehadiran
 * boleh dibuka terus (di telefon kekal 4 tab bawah; item yang sama ada dalam Saya).
 */
export const MENU_PEKERJA: KumpulanNav[] = [
  {
    tajuk: null,
    items: [
      { href: "/utama", label: tr("Utama"), ikon: "home" },
      { href: "/mohon", label: tr("Mohon"), ikon: "plus" },
      { href: "/kelulusan", label: tr("Kelulusan"), ikon: "check" },
    ],
  },
  {
    tajuk: tr("URUSAN SAYA"),
    items: [
      { href: "/gaji", label: tr("Slip gaji"), ikon: "wallet" },
      { href: "/cuti", label: tr("Cuti"), ikon: "calendar" },
      { href: "/tuntutan", label: tr("Tuntutan"), ikon: "receipt" },
      { href: "/kehadiran", label: tr("Kehadiran"), ikon: "clock" },
      { href: "/permohonan", label: tr("Permohonan saya"), ikon: "document" },
    ],
  },
  {
    tajuk: tr("SYARIKAT"),
    items: [
      { href: "/pengumuman", label: tr("Pengumuman"), ikon: "bell" },
      { href: "/kalendar", label: tr("Kalendar pasukan"), ikon: "users" },
      { href: "/hari-jadi", label: tr("Hari Jadi"), ikon: "cake" },
    ],
  },
  {
    tajuk: tr("BANTUAN"),
    items: [
      { href: "/tanya-hr", label: tr("Tanya HR"), ikon: "chat" },
      { href: "/pembantu-ai", label: tr("Pembantu AI"), ikon: "sparkle" },
    ],
  },
];

const HR_CEO = ["hr", "ceo", "admin"];

/**
 * Menu Mod HR (menu sisi desktop & halaman "Lagi" di telefon), disusun ikut modul HR.
 * Alat kecil ialah tab dalam modul (contoh: Kalendar pasukan & Cuti umum dalam Cuti).
 */
export const MENU_HR: KumpulanNav[] = [
  {
    tajuk: null,
    items: [
      { href: "/pengurusan", label: tr("Papan Pemuka"), pendek: tr("Utama"), ikon: "chart" },
      { href: "/kelulusan", label: tr("Kelulusan"), ikon: "check" },
      { href: "/pengurusan/pengumuman", label: tr("Pengumuman"), ikon: "bell", roles: HR_CEO },
    ],
  },
  {
    tajuk: tr("ORANG"),
    items: [
      { href: "/pengurusan/pekerja", label: tr("Pekerja"), ikon: "users", roles: HR_CEO, padan: ["/pengurusan/carta", "/pengurusan/tetapan/jabatan"] },
      { href: "/pengurusan/orientasi", label: tr("Orientasi"), ikon: "userplus", roles: HR_CEO },
    ],
  },
  {
    tajuk: tr("MASA"),
    items: [
      { href: "/pengurusan/cuti", label: tr("Cuti"), ikon: "calendar", roles: HR_CEO, padan: ["/kalendar", "/pengurusan/tetapan/cuti-umum"] },
      { href: "/pengurusan/kehadiran", label: tr("Kehadiran"), ikon: "clock", roles: HR_CEO, padan: ["/pengurusan/kerja-fleksibel"] },
    ],
  },
  {
    tajuk: tr("WANG"),
    items: [
      { href: "/pengurusan/gaji", label: tr("Penggajian"), ikon: "card", roles: ["hr", "finance", "admin"] },
      { href: "/pengurusan/tuntutan", label: tr("Tuntutan perbelanjaan"), pendek: tr("Tuntutan"), ikon: "receipt", roles: ["hr", "finance", "ceo", "admin"] },
    ],
  },
  {
    tajuk: tr("LAIN-LAIN"),
    items: [
      { href: "/pengurusan/soalan", label: tr("Peti HR"), ikon: "inbox", roles: ["hr", "admin"], padan: ["/pengurusan/surat"] },
      { href: "/pengurusan/laporan", label: tr("Laporan"), ikon: "chart" },
    ],
  },
];

/** Tetapan: di bahagian bawah menu sisi. */
export const NAV_TETAPAN: ItemNav = { href: "/pengurusan/tetapan", label: tr("Tetapan"), ikon: "settings" };

/** Navigasi bawah (telefon) Mod HR: 4 modul utama + "Lagi" (semua modul, Saya, tukar mod). */
const NAV_HR_BAWAH: ItemNav[] = [
  { href: "/pengurusan", label: tr("Papan Pemuka"), pendek: tr("Utama"), ikon: "chart" },
  { href: "/pengurusan/pekerja", label: tr("Pekerja"), ikon: "users", roles: HR_CEO },
  { href: "/kelulusan", label: tr("Kelulusan"), ikon: "check" },
  { href: "/pengurusan/gaji", label: tr("Penggajian"), ikon: "card", roles: ["hr", "finance", "admin"] },
  { href: "/pengurusan/menu", label: tr("Lagi"), ikon: "grid" },
];

type Peranan = Parameters<typeof hasRole>[1];
const boleh = (me: Me, n: ItemNav) => !n.roles || hasRole(me, n.roles as Peranan);

/** Menu HR mengikut peranan pengguna (kumpulan kosong disorok). */
export function menuHrUntuk(me: Me): KumpulanNav[] {
  return MENU_HR.map((k) => ({ ...k, items: k.items.filter((n) => boleh(me, n)) })).filter((k) => k.items.length);
}

export function navUntuk(me: Me | null, mod: Mod): ItemNav[] {
  if (mod === "pekerja" || !me) return NAV_PEKERJA;
  return NAV_HR_BAWAH.filter((n) => boleh(me, n));
}

/** Semua item Mod HR (untuk menentukan item aktif). */
export function semuaItemHr(me: Me): ItemNav[] {
  return [...menuHrUntuk(me).flatMap((k) => k.items), NAV_TETAPAN, ...NAV_HR_BAWAH];
}

/** Item yang aktif: padanan awalan terpanjang (termasuk `padan`), cth. /pengurusan/gaji mengatasi /pengurusan. */
export function itemAktif(items: ItemNav[], path: string): string | null {
  let best: { href: string; len: number } | null = null;
  for (const n of items) {
    for (const awalan of [n.href, ...(n.padan ?? [])]) {
      if ((path === awalan || path.startsWith(awalan + "/")) && (!best || awalan.length > best.len)) best = { href: n.href, len: awalan.length };
    }
  }
  return best?.href ?? null;
}

export function lamanUtama(mod: Mod): string {
  return mod === "hr" ? "/pengurusan" : "/utama";
}
