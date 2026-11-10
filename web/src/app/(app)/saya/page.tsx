"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { hasRole, useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { getBaki, type Baki } from "@/lib/data";
import { hari, inisial, todayISO } from "@/lib/format";
import {
  IconBell,
  IconCake,
  IconCalendar,
  IconCard,
  IconChart,
  IconChat,
  IconChevronRight,
  IconClock,
  IconDocument,
  IconReceipt,
  IconSettings,
  IconSparkle,
  IconUsers,
  IconWallet,
  IconOrg,
} from "@/components/icons";
import { Screen } from "@/components/ui";
import { PilihBahasa } from "@/components/PilihBahasa";
import { TabNav, TukarMod } from "@/components/TabNav";
import { useSkrinLebar } from "@/lib/skrin";

// Rujukan reka bentuk: design/Saya.dc.html
export default function SayaPage() {
  const me = useMe();
  const router = useRouter();
  const emp = me.active;
  const baki = useData(() => (emp ? getBaki(emp) : Promise.resolve({} as Record<string, Baki>)), [emp?.id]);
  const jadi = useData(async () => {
    if (!emp) return [];
    const t = todayISO();
    return must(await getSupabase().rpc("team_birthdays", { p_company: emp.companyId, p_from: t, p_to: t })) ?? [];
  }, [emp?.companyId]);
  const lebar = useSkrinLebar();
  const pengurusan = hasRole(me, ["hr", "finance", "ceo", "admin"]);
  const hariIni = (jadi.data ?? []).filter((b) => b.person_id !== me.personId);

  async function logKeluar() {
    await getSupabase().auth.signOut();
    router.replace("/masuk");
  }

  return (
    <Screen>
      <main className="flex grow flex-col gap-4 px-4 pt-4 pb-4">
        <Link href="/profil" className="flex items-center gap-3 text-ink!">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary text-lg font-extrabold text-white">
            {inisial(me.name)}
          </span>
          <div className="flex grow flex-col gap-0.5">
            <h1 className="m-0 text-lg font-extrabold">{me.name}</h1>
            <span className="text-[13px] text-muted">
              {[emp?.position, emp?.employeeNo].filter(Boolean).join(" · ")}
            </span>
          </div>
          <IconChevronRight size={20} className="text-[#9AA8A5]" />
        </Link>
        {!lebar && <TukarMod />}

        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <Kumpulan tajuk={tr("MENU SAYA")}>
          <Baris href="/cuti" icon={<IconCalendar size={18} />} label={tr("Cuti")}>
            {baki.data?.AL && <span className="text-[13px] text-muted">{tr("Baki {0}", hari(baki.data.AL.available))}</span>}
          </Baris>
          <Baris href="/tuntutan" icon={<IconReceipt size={18} />} label={tr("Tuntutan")} />
          <Baris href="/kehadiran" icon={<IconClock size={18} />} label={tr("Kehadiran")} />
          <Baris href="/gaji" icon={<IconWallet size={18} />} label={tr("Slip Gaji")} />
          <Baris href="/kalendar" icon={<IconCalendar size={18} />} label={tr("Kalendar pasukan")} />
          <Baris href="/pengumuman" icon={<IconBell size={18} />} label={tr("Pengumuman")} />
          <Baris href="/tanya-hr" icon={<IconSparkle size={18} />} tone="bg-[#EDE9F8] text-ai" label={tr("Tanya HR")} />
          <Baris href="/hari-jadi" icon={<IconCake size={18} />} tone="bg-[#FDEBD7] text-warning" label={tr("Hari Jadi")}>
            {hariIni.length > 0 && (
              <span className="text-[13px] font-bold text-warning">
                {hariIni.length === 1 ? tr("{0} hari ini", hariIni[0].name) : tr("{0} orang hari ini", hariIni.length)}
              </span>
            )}
          </Baris>
        </Kumpulan>

        {pengurusan && (
          <Kumpulan tajuk={tr("PENGURUSAN · HR / CEO SAHAJA")}>
            <Baris href="/pengurusan" icon={<IconChart size={18} />} tone="bg-[#FDEBD7] text-warning" label={tr("Papan Pemuka Syarikat")} />
            <Baris href="/pengurusan/pekerja" icon={<IconUsers size={18} />} tone="bg-[#FDEBD7] text-warning" label={tr("Pekerja")} />
            {hasRole(me, ["hr", "admin"]) && <Baris href="/pengurusan/tetapan/jabatan" icon={<IconOrg size={18} />} tone="bg-[#FDEBD7] text-warning" label={tr("Jabatan & Ketua")} />}
            {hasRole(me, ["hr", "finance", "admin"]) && (
              <>
                <Baris href="/pengurusan/gaji" icon={<IconCard size={18} />} tone="bg-[#FDEBD7] text-warning" label={tr("Proses Gaji")} />
                <Baris href="/pengurusan/gaji/pekerja" icon={<IconWallet size={18} />} tone="bg-[#FDEBD7] text-warning" label={tr("Gaji Pekerja")} />
              </>
            )}
            {hasRole(me, ["hr", "admin"]) && <Baris href="/pengurusan/surat" icon={<IconDocument size={18} />} tone="bg-[#FDEBD7] text-warning" label={tr("Surat")} />}
            {hasRole(me, ["hr", "admin"]) && <Baris href="/pengurusan/soalan" icon={<IconChat size={18} />} tone="bg-[#FDEBD7] text-warning" label={tr("Soalan HR")} />}
            {hasRole(me, ["hr", "admin"]) && <Baris href="/pengurusan/kerja-fleksibel" icon={<IconCalendar size={18} />} tone="bg-[#FDEBD7] text-warning" label={tr("Kerja fleksibel")} />}
            {hasRole(me, ["hr", "ceo", "admin"]) && <Baris href="/pengurusan/pengumuman" icon={<IconBell size={18} />} tone="bg-[#FDEBD7] text-warning" label={tr("Pengumuman")} />}
            <Baris href="/pengurusan/laporan" icon={<IconChart size={18} />} tone="bg-[#FDEBD7] text-warning" label={tr("Laporan")} />
            <Baris href="/pengurusan/tetapan" icon={<IconSettings size={18} />} tone="bg-[#FDEBD7] text-warning" label={tr("Tetapan")} />
          </Kumpulan>
        )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-surface px-4 py-3 lg:max-w-[480px]">
          <span className="flex flex-col">
            <b className="text-sm font-bold">{tr("Bahasa")}</b>
            <span className="text-xs text-muted">{tr("Skrin, mesej WhatsApp dan slip gaji")}</span>
          </span>
          <PilihBahasa simpan />
        </div>

        <button
          type="button"
          onClick={logKeluar}
          className="h-12 rounded-[14px] border lg:w-60 border-line bg-surface text-sm font-bold text-danger"
        >
          {tr("Log keluar")}</button>
      </main>
      <TabNav />
    </Screen>
  );
}

function Kumpulan({ tajuk, children }: { tajuk: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-bold tracking-[0.04em] text-subtle">{tajuk}</span>
      <div className="flex flex-col rounded-card bg-surface [&>a+a]:border-t [&>a+a]:border-[#EEF2F1]">{children}</div>
    </div>
  );
}

function Baris({
  href,
  icon,
  label,
  tone = "bg-primary-soft text-primary",
  children,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  tone?: string;
  children?: ReactNode;
}) {
  return (
    <Link href={href} className="flex min-h-12 items-center gap-3 px-4 text-sm font-semibold text-ink!">
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-[11px] ${tone}`}>{icon}</span>
      <span className="grow">{label}</span>
      {children}
    </Link>
  );
}
