"use client";

import { LogoSyarikat } from "./Logo";
import { tr } from "@/lib/i18n";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { IconBell, IconCalendar, IconChat, IconCard, IconChart, IconCheckSquare, IconClock, IconDocument, IconGrid, IconHome, IconInbox, IconPlusCircle, IconOrg, IconReceipt, IconSettings, IconUser, IconUserPlus, IconUsers, IconWallet, IconSparkle, IconCake } from "./icons";
import { getBilanganTugasan } from "@/lib/data";
import { useData } from "@/lib/useData";
import { useMeContext } from "@/lib/me";
import { MENU_PEKERJA, NAV_TETAPAN, itemAktif, lamanUtama, menuHrUntuk, navUntuk, semuaItemHr, useMod, type IkonNav, type ItemNav, type Mod } from "@/lib/mod";
import { getSupabase } from "@/lib/supabase";
import { Avatar, BackHeader } from "./ui";
import { useSkrinLebar } from "@/lib/skrin";
import { bukaCari } from "./CariPantas";

export const IKON: Record<IkonNav, (p: { size?: number }) => ReactNode> = {
  home: IconHome,
  plus: IconPlusCircle,
  check: IconCheckSquare,
  user: IconUser,
  chart: IconChart,
  users: IconUsers,
  card: IconCard,
  settings: IconSettings,
  org: IconOrg,
  calendar: IconCalendar,
  document: IconDocument,
  bell: IconBell,
  chat: IconChat,
  clock: IconClock,
  receipt: IconReceipt,
  userplus: IconUserPlus,
  inbox: IconInbox,
  grid: IconGrid,
  wallet: IconWallet,
  sparkle: IconSparkle,
  cake: IconCake,
};

function Lencana({ n }: { n: number }) {
  return (
    <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[11px] font-extrabold text-white">{n}</span>
  );
}

/**
 * Navigasi bawah (telefon sahaja; disorok pada skrin lebar kerana menu sisi dipaparkan).
 * Mod Pekerja: 4 tab (CLAUDE.md §1). Mod HR: Papan Pemuka, Pekerja, Kelulusan, Gaji + "Lagi" (modul lain, Saya).
 */
export function TabNav() {
  const { data } = useData(getBilanganTugasan, []);
  const { state } = useMeContext();
  const me = state.status === "ready" ? state.me : null;
  const { mod } = useMod();
  const items = navUntuk(me, mod);
  const path = usePathname();
  const lebar = useSkrinLebar();
  // Mod HR: halaman modul yang tiada dalam tab bawah (cth. Cuti) menandakan "Lagi".
  let aktif = itemAktif(items, path);
  if (mod === "hr" && me) {
    const sebenar = itemAktif(semuaItemHr(me), path);
    if (sebenar && !items.some((n) => n.href === sebenar)) aktif = "/pengurusan/menu";
    if (path === "/saya" || path.startsWith("/saya/")) aktif = "/pengurusan/menu";
  }
  if (lebar) return null;
  return (
    <nav
      className="sticky bottom-0 z-10 grid border-t border-line-soft bg-surface px-1 pt-2 pb-[max(16px,env(safe-area-inset-bottom))] lg:hidden print:hidden!"
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
      {sasaran === "pekerja" ? tr("Tukar ke Mod Pekerja") : tr("Tukar ke Mod HR")}
    </button>
  );
}

/** Menu sisi untuk skrin lebar (≥ 1024px). Mod HR: berkumpulan ikut modul; Tetapan & akaun di bawah. */
export function MenuSisi() {
  const { data } = useData(getBilanganTugasan, []);
  const { state } = useMeContext();
  const me = state.status === "ready" ? state.me : null;
  const { mod } = useMod();
  const path = usePathname();
  const lebar = useSkrinLebar();
  if (!me || !lebar) return null;
  const hr = mod === "hr";
  const kumpulan = hr ? menuHrUntuk(me) : MENU_PEKERJA;
  const aktif = itemAktif(hr ? semuaItemHr(me) : MENU_PEKERJA.flatMap((k) => k.items), path);
  const sayaAktif = ["/saya", "/profil"].some((x) => path === x || path.startsWith(x + "/"));

  const pautan = (n: ItemNav) => {
    const Ikon = IKON[n.ikon];
    const on = aktif === n.href && !sayaAktif;
    return (
      <Link
        key={n.href}
        href={n.href}
        aria-current={on ? "page" : undefined}
        className={`flex h-10 items-center gap-3 rounded-[12px] px-3 text-sm ${on ? "bg-[#E3F1EE] font-extrabold text-primary!" : "font-semibold text-ink! hover:bg-[#EEF2F1]"}`}
      >
        <Ikon size={20} />
        <span className="min-w-0 grow truncate">{tr(n.label)}</span>
        {n.href === "/kelulusan" && (data ?? 0) > 0 && <Lencana n={data ?? 0} />}
      </Link>
    );
  };

  return (
    <aside aria-label={tr("Menu sisi")} className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-line-soft bg-surface px-3 py-5 lg:flex print:hidden!">
      {me.active?.logoPath && (
        <div className="px-2 pb-2">
          <LogoSyarikat path={me.active.logoPath} nama={me.active.companyName} className="h-11 max-w-full object-left" />
        </div>
      )}
      <div className="flex items-center gap-2.5 px-2 pb-4">
        {!me.active?.logoPath && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary text-[11px] font-extrabold text-white">{(me.active?.companyCode ?? "HR").slice(0, 3)}</span>
        )}
        <span className="flex min-w-0 flex-col">
          <b className="line-clamp-2 text-[13px] leading-snug font-extrabold" title={me.active?.companyName}>
            {me.active?.companyName ?? "HRBoost"}
          </b>
          <span className="text-xs text-muted">
            {me.active?.companyCode} · {hr ? tr("Mod HR") : tr("Mod Pekerja")}
          </span>
        </span>
      </div>
      {hr && (
        <button
          type="button"
          onClick={bukaCari}
          className="mb-2 flex h-10 shrink-0 items-center gap-2 rounded-[12px] border border-line bg-page px-3 text-left text-[13px] text-muted hover:border-primary"
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <span className="min-w-0 grow truncate">{tr("Cari pekerja…")}</span>
          <kbd className="shrink-0 rounded border border-line px-1.5 font-sans text-[11px] whitespace-nowrap">{tr("Ctrl K")}</kbd>
        </button>
      )}
      <nav className="flex flex-col gap-0.5" aria-label={tr("Menu utama")}>
        {kumpulan.map((k, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            {k.tajuk && <span className="px-3 pt-3.5 pb-1 text-[11px] font-bold tracking-[0.04em] text-muted">{tr(k.tajuk)}</span>}
            {k.items.map(pautan)}
          </div>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-1.5 border-t border-line-soft pt-3">
        {hr && pautan(NAV_TETAPAN)}
        {(
          <Link
            href={hr ? "/saya" : "/profil"}
            aria-current={sayaAktif ? "page" : undefined}
            className={`flex min-h-11 items-center gap-2.5 rounded-[12px] px-2 hover:bg-[#EEF2F1] ${sayaAktif ? "bg-[#E3F1EE]" : ""}`}
          >
            <Avatar name={me.name} size={32} personId={me.personId} />
            <span className="flex min-w-0 flex-col leading-tight">
              <b className="truncate text-[13px] text-ink">{me.name}</b>
              <span className="truncate text-xs text-muted">{hr ? tr("Profil & urusan saya") : tr("Profil Saya")}</span>
            </span>
          </Link>
        )}
        <TukarMod />
        <div className="flex items-center justify-end gap-2 px-2">
          <button type="button" onClick={() => void getSupabase().auth.signOut()} className="flex min-h-10 shrink-0 items-center text-[13px] font-bold whitespace-nowrap text-danger">
            {tr("Log keluar")}</button>
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
