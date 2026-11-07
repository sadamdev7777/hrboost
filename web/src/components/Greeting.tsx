"use client";

import { useMeContext, type Me } from "@/lib/me";
import { ucapan } from "@/lib/format";
import { IconChevronDown } from "./icons";

/** Ucapan + nama panggilan + pilihan syarikat (jika bekerja di lebih daripada satu syarikat). */
export function Greeting({ me }: { me: Me }) {
  const { setActiveCompany } = useMeContext();
  const multi = me.employments.length > 1;
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm text-muted">{ucapan()}</span>
        <span className="text-2xl font-extrabold">{me.name}</span>
      </div>
      {me.active && (
        <label className="relative flex h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm font-bold">
          {me.active.companyCode}
          {multi && <IconChevronDown size={16} className="text-muted" />}
          {multi && (
            <select
              aria-label="Tukar syarikat"
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
    </div>
  );
}
