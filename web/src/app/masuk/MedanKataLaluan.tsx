"use client";

import { tr } from "@/lib/i18n";
import { useState } from "react";

export const medanMasuk =
  "h-12 w-full min-w-0 rounded-field border-[1.5px] border-line bg-surface px-4 text-base font-semibold text-ink outline-none focus:border-primary";

/** Medan kata laluan dengan butang Papar / Sorok. */
export function MedanKataLaluan({
  label,
  value,
  onChange,
  autoComplete,
  bantuan,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  bantuan?: string;
}) {
  const [papar, setPapar] = useState(false);
  return (
    <label className="flex flex-col gap-2 text-sm font-bold">
      {label}
      <span className="relative flex">
        <input
          type={papar ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${medanMasuk} pr-20`}
        />
        <button
          type="button"
          onClick={() => setPapar(!papar)}
          aria-label={papar ? tr("Sorok kata laluan") : tr("Papar kata laluan")}
          className="absolute inset-y-0 right-1 flex min-w-11 items-center justify-center px-3 text-[13px] font-bold text-primary"
        >
          {papar ? tr("Sorok") : tr("Papar")}
        </button>
      </span>
      {bantuan && <span className="text-xs font-normal text-muted">{bantuan}</span>}
    </label>
  );
}
