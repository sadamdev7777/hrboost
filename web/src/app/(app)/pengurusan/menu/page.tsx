"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useMe } from "@/lib/me";
import { menuHrUntuk, NAV_TETAPAN, type ItemNav } from "@/lib/mod";
import { getSupabase } from "@/lib/supabase";
import { Avatar, Screen } from "@/components/ui";
import { IKON, PengepalaAkar, TukarMod, TabNav } from "@/components/TabNav";
import { IconChevronRight } from "@/components/icons";

/** "Lagi" (telefon, Mod HR): semua modul HR ikut kumpulan, Saya, tukar mod dan log keluar. */
export default function MenuHrPage() {
  const me = useMe();
  const kumpulan = menuHrUntuk(me);
  return (
    <Screen lebar="sederhana">
      <PengepalaAkar title={tr("Lagi")} />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-6 lg:px-0">
        <Link href="/saya" className="flex items-center gap-3 rounded-card bg-surface px-4 py-3 text-ink!">
          <Avatar name={me.name} size={44} personId={me.personId} />
          <span className="flex min-w-0 grow flex-col">
            <b className="truncate">{me.name}</b>
            <span className="truncate text-xs text-muted">{tr("Profil & urusan saya")}</span>
          </span>
          <IconChevronRight size={18} />
        </Link>
        {kumpulan.map((k, i) => (
          <section key={i} className="flex flex-col rounded-card bg-surface px-4 py-2">
            {k.tajuk && <h2 className="m-0 pt-1 pb-1 text-[11px] font-bold tracking-[0.04em] text-muted">{tr(k.tajuk)}</h2>}
            <div className="flex flex-col [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              {k.items.map((n) => (
                <Baris key={n.href} n={n} />
              ))}
            </div>
          </section>
        ))}
        <section className="flex flex-col rounded-card bg-surface px-4 py-2">
          <Baris n={NAV_TETAPAN} />
        </section>
        <TukarMod />
        <button type="button" onClick={() => void getSupabase().auth.signOut()} className="min-h-11 text-sm font-bold text-danger">
          {tr("Log keluar")}</button>
      </main>
      <TabNav />
    </Screen>
  );
}

function Baris({ n }: { n: ItemNav }) {
  const Ikon = IKON[n.ikon];
  return (
    <Link href={n.href} className="flex min-h-12 items-center gap-3 py-1 text-[15px] font-semibold text-ink!">
      <span className="flex size-9 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
        <Ikon size={20} />
      </span>
      <span className="grow">{tr(n.label)}</span>
      <IconChevronRight size={18} />
    </Link>
  );
}
