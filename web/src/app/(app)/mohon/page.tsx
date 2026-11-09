"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getBaki, getPermohonanSaya, kiniDi, paparPermohonan, type Baki } from "@/lib/data";
import { hari } from "@/lib/format";
import { IconCalendar, IconChat, IconChevronRight, IconClock, IconDocument, IconReceipt, IconWallet } from "@/components/icons";
import { Screen, StatusPill } from "@/components/ui";
import { TabNav } from "@/components/TabNav";

// Rujukan reka bentuk: design/Mohon.dc.html
export default function MohonPage() {
  const me = useMe();
  const emp = me.active;
  const baki = useData(() => (emp ? getBaki(emp) : Promise.resolve({} as Record<string, Baki>)), [emp?.id]);
  const mohon = useData(() => getPermohonanSaya(), [emp?.id]);
  const proses = (mohon.data ?? []).find((p) => p.status === "pending");
  const al = baki.data?.AL;
  const mc = baki.data?.MC;

  return (
    <Screen>
      <main className="flex grow flex-col gap-3 px-4 pt-7 pb-4">
        <div className="mb-1 flex flex-col gap-1">
          <h1 className="m-0 text-[22px] font-extrabold">Mohon</h1>
          <span className="text-sm text-subtle">Apakah yang anda ingin mohon hari ini?</span>
        </div>

        <Pilihan
          href="/mohon/cuti"
          tone="bg-primary-soft text-primary"
          icon={<IconCalendar />}
          title="Cuti"
          sub={al ? `Baki tahunan ${hari(al.available)} hari${mc ? ` · MC ${hari(mc.available)} hari` : ""}` : "Cuti tahunan, sakit, kecemasan"}
        />
        <Pilihan
          href="/tuntutan/baru"
          tone="bg-warning-soft text-warning"
          icon={<IconReceipt />}
          title="Tuntutan"
          sub="Ambil gambar atau muat naik resit"
        />
        <Pilihan
          href="/kehadiran/betulkan"
          tone="bg-[#EAF0FB] text-[#2F5BA8]"
          icon={<IconClock />}
          title="Pembetulan masa"
          sub="Terlupa mengimbas atau bertugas di luar"
        />
        <Pilihan
          href="/mohon/lebih-masa"
          tone="bg-[#EDE9F8] text-ai"
          icon={<IconClock />}
          title="Kerja lebih masa"
          sub="Dibayar bersama gaji selepas diluluskan"
        />
        <Pilihan
          href="/mohon/pendahuluan"
          tone="bg-warning-soft text-warning"
          icon={<IconWallet />}
          title="Pendahuluan gaji"
          sub="Ditolak daripada gaji bulan berikutnya"
        />
        <Pilihan
          href="/mohon/kerja-fleksibel"
          tone="bg-[#EAF0FB] text-[#2F5BA8]"
          icon={<IconCalendar />}
          title="Kerja fleksibel"
          sub="Ubah waktu, hari atau tempat bekerja"
        />
        <Pilihan
          href="/mohon/surat"
          tone="bg-ai-soft text-ai"
          icon={<IconDocument />}
          title="Surat"
          sub="Pengesahan majikan atau gaji, cth. untuk pinjaman bank"
        />

        {proses && (
          <>
            <div className="mt-2 flex items-center justify-between">
              <h2 className="m-0 text-sm font-extrabold">Sedang diproses</h2>
              <Link href="/permohonan" className="text-[13px] font-bold">
                Lihat semua
              </Link>
            </div>
            <Link href={`/permohonan/${proses.id}`} className="flex items-center gap-3 rounded-[14px] bg-surface px-3.5 py-3 text-ink!">
              <span className="flex grow flex-col gap-0.5">
                <b className="text-sm">{paparPermohonan(proses).title}</b>
                <span className="text-xs text-subtle">
                  {[kiniDi(proses.waitingFor), proses.totalSteps ? `peringkat ${proses.currentStep} daripada ${proses.totalSteps}` : null]
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
            Semua permohonan ini juga boleh dibuat melalui WhatsApp. Contoh: “Saya ingin memohon cuti 23–28 Dis.”
          </span>
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
