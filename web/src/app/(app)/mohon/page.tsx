"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import type { ReactNode } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getBaki, getPermohonanSaya, kiniDi, paparPermohonan, type Baki } from "@/lib/data";
import { hari } from "@/lib/format";
import { getOtDigunakan } from "@/lib/urusan";
import { IconCalendar, IconChat, IconChevronRight, IconClock, IconDocument, IconReceipt, IconWallet } from "@/components/icons";
import { Screen, StatusPill } from "@/components/ui";
import { TabNav } from "@/components/TabNav";

// Rujukan reka bentuk: design/Mohon.dc.html
export default function MohonPage() {
  const me = useMe();
  const emp = me.active;
  const baki = useData(() => (emp ? getBaki(emp) : Promise.resolve({} as Record<string, Baki>)), [emp?.id]);
  const mohon = useData(() => getPermohonanSaya(), [emp?.id]);
  const ot = useData(() => (emp ? getOtDigunakan(emp.companyId) : Promise.resolve(false)), [emp?.companyId]);
  const proses = (mohon.data ?? []).find((p) => p.status === "pending");
  const al = baki.data?.AL;
  const mc = baki.data?.MC;

  return (
    <Screen>
      <main className="flex grow flex-col gap-3 px-4 pt-7 pb-4">
        <div className="mb-1 flex flex-col gap-1">
          <h1 className="m-0 text-[22px] font-extrabold">{tr("Mohon")}</h1>
          <span className="text-sm text-subtle">{tr("Apakah yang anda ingin mohon hari ini?")}</span>
        </div>

        <Pilihan
          href="/mohon/cuti"
          tone="bg-primary-soft text-primary"
          icon={<IconCalendar />}
          title={tr("Cuti")}
          sub={al ? tr("Baki tahunan {0} hari{1}", hari(al.available), mc ? tr(" · MC {0} hari", hari(mc.available)) : "") : tr("Cuti tahunan, sakit, kecemasan")}
        />
        <Pilihan
          href="/tuntutan/baru"
          tone="bg-warning-soft text-warning"
          icon={<IconReceipt />}
          title={tr("Tuntutan")}
          sub={tr("Ambil gambar atau muat naik resit")}
        />
        <Pilihan
          href="/kehadiran/betulkan"
          tone="bg-[#EAF0FB] text-[#2F5BA8]"
          icon={<IconClock />}
          title={tr("Pembetulan masa")}
          sub={tr("Terlupa mengimbas atau bertugas di luar")}
        />
        {ot.data && (
        <Pilihan
          href="/mohon/lebih-masa"
          tone="bg-[#EDE9F8] text-ai"
          icon={<IconClock />}
          title={tr("Kerja lebih masa")}
          sub={tr("Dibayar bersama gaji selepas diluluskan")}
        />
        )}
        <Pilihan
          href="/mohon/pendahuluan"
          tone="bg-warning-soft text-warning"
          icon={<IconWallet />}
          title={tr("Pendahuluan gaji")}
          sub={tr("Diluluskan oleh CEO, ditolak daripada gaji bulan berikutnya")}
        />
        <Pilihan
          href="/mohon/kerja-fleksibel"
          tone="bg-[#EAF0FB] text-[#2F5BA8]"
          icon={<IconCalendar />}
          title={tr("Kerja fleksibel")}
          sub={tr("Ubah waktu, hari atau tempat bekerja")}
        />
        <Pilihan
          href="/mohon/surat"
          tone="bg-ai-soft text-ai"
          icon={<IconDocument />}
          title={tr("Surat")}
          sub={tr("Pengesahan majikan atau gaji, cth. untuk pinjaman bank")}
        />

        {proses && (
          <>
            <div className="mt-2 flex items-center justify-between">
              <h2 className="m-0 text-sm font-extrabold">{tr("Sedang diproses")}</h2>
              <Link href="/permohonan" className="text-[13px] font-bold">
                {tr("Lihat semua")}</Link>
            </div>
            <Link href={`/permohonan/${proses.id}`} className="flex items-center gap-3 rounded-[14px] bg-surface px-3.5 py-3 text-ink!">
              <span className="flex grow flex-col gap-0.5">
                <b className="text-sm">{paparPermohonan(proses).title}</b>
                <span className="text-xs text-subtle">
                  {[kiniDi(proses.waitingFor), proses.totalSteps ? tr("peringkat {0} daripada {1}", proses.currentStep, proses.totalSteps) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <StatusPill status={proses.status} />
            </Link>
          </>
        )}

        <div className="mt-auto flex items-start gap-2.5 rounded-[14px] bg-primary-soft px-3.5 py-3">
          <IconChat size={20} className="mt-px shrink-0 text-primary" />
          <span className="text-[13px] leading-[1.45] text-primary-hover">
            {tr("Semua permohonan ini juga boleh dibuat melalui WhatsApp. Contoh: “Saya ingin memohon cuti 23–28 Dis.”")}</span>
        </div>
      </main>
      <TabNav />
    </Screen>
  );
}

function Pilihan({ href, tone, icon, title, sub }: { href: string; tone: string; icon: ReactNode; title: string; sub: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-[18px] bg-surface p-4 text-ink! hover:bg-[#F9FBFA]">
      <span className={`flex size-12 shrink-0 items-center justify-center rounded-[14px] ${tone}`}>{icon}</span>
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <b className="text-base font-extrabold">{title}</b>
        <span className="text-[13px] text-subtle">{sub}</span>
      </span>
      <IconChevronRight size={20} className="text-muted" />
    </Link>
  );
}
