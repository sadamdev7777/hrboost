"use client";

import Link from "next/link";
import { useData } from "@/lib/useData";
import { LANGKAH, getKemajuan } from "@/lib/onboarding";
import { IconChevronRight } from "./icons";

/** Peringatan di tab Utama jika orientasi pekerja belum lengkap. */
export function OrientasiBanner({ employmentId }: { employmentId: string }) {
  const { data } = useData(() => getKemajuan(employmentId), [employmentId]);
  if (!data) return null;
  const n = LANGKAH.filter((l) => data.has(l.key)).length;
  if (n >= LANGKAH.length) return null;
  return (
    <Link href="/orientasi" className="flex items-center gap-3 rounded-card border-[1.5px] border-primary bg-surface px-4 py-3 text-ink!">
      <span className="flex grow flex-col gap-0.5">
        <b className="text-sm font-extrabold">Lengkapkan akaun anda</b>
        <span className="text-[13px] text-muted">
          {n} daripada {LANGKAH.length} langkah selesai
        </span>
      </span>
      <IconChevronRight size={20} className="text-primary" />
    </Link>
  );
}
