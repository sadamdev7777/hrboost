"use client";

import Link from "next/link";
import { Avatar } from "./ui";
import { tr } from "@/lib/i18n";
import { useMeContext, type Me } from "@/lib/me";
import { ucapan } from "@/lib/format";
import { IconChevronDown } from "./icons";
import { Loceng } from "./Loceng";

/** Ucapan + nama panggilan + pilihan syarikat (jika bekerja di lebih daripada satu syarikat). */
export function Greeting({ me }: { me: Me }) {
  const { setActiveCompany } = useMeContext();
  const multi = me.employments.length > 1;
  return (
    <div className="flex items-center justify-between gap-3">
      <Link href="/profil" aria-label={tr("Profil Saya")} className="flex min-w-0 items-center gap-3 text-ink!">
        <Avatar name={me.name} size={48} personId={me.personId} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm text-muted">{ucapan()}</span>
          <h1 className="m-0 truncate text-xl font-extrabold">{me.name}</h1>
        </span>
      </Link>
      <span className="flex items-center gap-2">
      <Loceng />
      {me.active && (
        <label className="relative flex h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm font-bold">
          {me.active.companyCode}
          {multi && <IconChevronDown size={16} className="text-muted" />}
          {multi && (
            <select
              aria-label={tr("Tukar syarikat")}
              value={me.active.companyId}
              onChange={(e) => setActiveCompany(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {me.employments.map((e) => (
                <option key={e.companyId} value={e.companyId}>
                  {e.companyCode} · {e.companyName}
                </option>
              ))}
            </select>
          )}
        </label>
      )}
      </span>
    </div>
  );
}
