"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { IconCard, IconChart, IconCheckSquare, IconHome, IconPlusCircle, IconSettings, IconUser, IconUsers } from "./icons";
import { getBilanganTugasan } from "@/lib/data";
import { useData } from "@/lib/useData";
import { useMeContext } from "@/lib/me";
import { NAV_HR_LAGI, itemAktif, lamanUtama, navUntuk, useMod, type ItemNav, type Mod } from "@/lib/mod";
import { getSupabase } from "@/lib/supabase";
import { BackHeader } from "./ui";
import { useSkrinLebar } from "@/lib/skrin";
import { hasRole } from "@/lib/me";

const IKON: Record<ItemNav["ikon"], (p: { size?: number }) => ReactNode> = {
  home: IconHome,
  plus: IconPlusCircle,
  check: IconCheckSquare,
  user: IconUser,
  chart: IconChart,
  users: IconUsers,
  card: IconCard,
  settings: IconSettings,
};

function Lencana({ n }: { n: number }) {
  return (
    <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[11px] font-extrabold text-white">{n}</span>
  );
}

/**
 * Navigasi bawah (telefon sahaja; disorok pada skrin lebar kerana menu sisi dipaparkan).
 * Mod Pekerja: 4 tab (CLAUDE.md §1). Mod HR: Papan Pemuka, Pekerja, Kelulusan, Gaji, Saya (ikut peranan).
 */
export function TabNav() {
  const { data } = useData(getBilanganTugasan, []);
  const { state } = useMeContext();
  const me = state.status === "ready" ? state.me : null;
  const { mod } = useMod();
  const items = navUntuk(me, mod);
  const path = usePathname();
  const lebar = useSkrinLebar();
  const aktif = itemAktif(items, path);
  if (lebar) return null;
  return (
    <nav
      className="sticky bottom-0 z-10 grid border-t border-line-soft bg-surface px-1 pt-2 pb-[max(16px,env(safe-area-inset-bottom))] lg:hidden"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((n) => {
        const on = aktif === n.href;
        const Ikon = IKON[n.ikon];
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={on ? "page" : undefined}
            className={`relative flex flex-col items-center gap-1 py-1.5 text-[11px] leading-tight ${on ? "font-bold text-primary!" : "font-semibold text-muted!"}`}
          >
            {n.href === "/kelulusan" && (data ?? 0) > 0 && (
              <span className="absolute top-0 left-[54%]">
                <Lencana n={data ?? 0} />
              </span>
            )}
            <Ikon />
            <span className="max-w-full truncate px-0.5">{n.pendek ?? n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Butang tukar mod (HR ⇄ Pekerja). */
export function TukarMod({ className = "" }: { className?: string }) {
  const { mod, boleh, tukar } = useMod();
  const router = useRouter();
  if (!boleh) return null;
  const sasaran: Mod = mod === "hr" ? "pekerja" : "hr";
  return (
    <button
      type="button"
      onClick={() => {
        tukar(sasaran);
        router.push(lamanUtama(sasaran));
      }}
      className={`flex min-h-11 items-center justify-center rounded-[12px] border border-line bg-surface px-3 text-[13px] font-bold text-primary ${className}`}
    >
      {sasaran === "pekerja" ? "Tukar ke Mod Pekerja" : "Tukar ke Mod HR"}
    </button>
  );
}

/** Menu sisi untuk skrin lebar (≥ 1024px). */
export function MenuSisi() {
  const { data } = useData(getBilanganTugasan, []);
  const { state } = useMeContext();
  const me = state.status === "ready" ? state.me : null;
  const { mod } = useMod();
  const path = usePathname();
  const lebar = useSkrinLebar();
  if (!me || !lebar) return null;
  const utama = navUntuk(me, mod);
  const lagi = mod === "hr" ? NAV_HR_LAGI.filter((n) => !n.roles || hasRole(me, n.roles as Parameters<typeof hasRole>[1])) : [];
  const semua = [...utama, ...lagi];
  const aktif = itemAktif(semua, path);

  const pautan = (n: ItemNav) => {
    const Ikon = IKON[n.ikon];
    const on = aktif === n.href;
    return (
      <Link
        key={n.href}
        href={n.href}
        aria-current={on ? "page" : undefined}
        className={`flex h-11 items-center gap-3 rounded-[12px] px-3 text-sm ${on ? "bg-[#E3F1EE] font-extrabold text-primary!" : "font-semibold text-ink! hover:bg-[#EEF2F1]"}`}
      >
        <Ikon size={20} />
        <span className="grow">{n.label}</span>
        {n.href === "/kelulusan" && (data ?? 0) > 0 && <Lencana n={data ?? 0} />}
      </Link>
    );
  };

  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col gap-1 border-r border-line-soft bg-surface px-3 py-5 lg:flex">
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <span className="flex size-9 items-center justify-center rounded-[10px] bg-primary text-sm font-extrabold text-white">HR</span>
        <span className="flex min-w-0 flex-col">
          <b className="truncate text-sm font-extrabold">{me.active?.companyName ?? "HRBoost"}</b>
          <span className="text-xs text-muted">{mod === "hr" ? "Mod HR" : "Mod Pekerja"}</span>
        </span>
      </div>
      <nav className="flex flex-col gap-0.5" aria-label="Menu utama">
        {utama.map(pautan)}
        {lagi.length > 0 && <span className="px-3 pt-4 pb-1 text-[11px] font-bold tracking-[0.04em] text-muted">PENGURUSAN</span>}
        {lagi.map(pautan)}
      </nav>
      <div className="mt-auto flex flex-col gap-2 border-t border-line-soft pt-3">
        <TukarMod />
        <div className="flex items-center justify-between gap-2 px-2">
          <span className="truncate text-[13px] font-bold">{me.name}</span>
          <button type="button" onClick={() => void getSupabase().auth.signOut()} className="flex min-h-11 items-center text-[13px] font-bold text-danger">
            Log keluar
          </button>
        </div>
      </div>
    </aside>
  );
}

/**
 * Pengepala halaman akar Mod HR (Papan Pemuka, Pekerja, Gaji): tanpa butang kembali dalam Mod HR
 * (halaman ini ialah tab), dengan butang kembali ke Saya dalam Mod Pekerja.
 */
export function PengepalaAkar({ title, action, back = "/saya", backHr }: { title: string; action?: ReactNode; back?: string; backHr?: string }) {
  const { mod } = useMod();
  if (mod === "hr" && backHr) return <BackHeader title={title} href={backHr} action={action} />;
  if (mod === "hr")
    return (
      <header className="flex min-h-14 items-center gap-2 px-4 pt-3 pb-1 lg:px-0 lg:pt-6">
        <h1 className="m-0 grow text-xl font-extrabold lg:text-2xl">{title}</h1>
        {action}
      </header>
    );
  return <BackHeader title={title} href={back} action={action} />;
}
