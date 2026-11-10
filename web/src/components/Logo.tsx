"use client";

import { tr } from "@/lib/i18n";
import { useRef, useState } from "react";
import { buangLogo, muatNaikLogo, SAIZ_LOGO, urlLogo } from "@/lib/logo";
import { ErrorBox } from "./ui";
import { beritahu } from "./Dialog";

/** Logo syarikat (imej awam). Tiada apa dipaparkan jika syarikat belum memuat naik logo. */
export function LogoSyarikat({ path, nama, className = "h-12 max-w-[180px]" }: { path: string | null | undefined; nama: string; className?: string }) {
  const url = urlLogo(path);
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={tr("Logo {0}", nama)} className={`object-contain ${className}`} />;
}

/**
 * Muat naik logo syarikat: seret & lepas atau tekan untuk pilih fail.
 * Logo dikecilkan secara automatik (≤ 1200 × 400 px, ≤ 1 MB) sebelum dimuat naik.
 */
export function MuatNaikLogo({ companyId, nama, path, boleh, onChange }: { companyId: string; nama: string; path: string | null; boleh: boolean; onChange: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [atas, setAtas] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);

  async function hantar(f: File | undefined) {
    if (!f || !boleh) return;
    setRalat(null);
    setBusy(true);
    try {
      await muatNaikLogo(companyId, f, path);
      beritahu(tr("Logo disimpan. Logo akan dipaparkan pada surat, slip gaji dan menu HR."));
      onChange();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
    setBusy(false);
  }

  async function buang() {
    setRalat(null);
    setBusy(true);
    try {
      await buangLogo(companyId, path);
      onChange();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={boleh ? 0 : -1}
        aria-label={tr("Muat naik logo syarikat")}
        aria-disabled={!boleh}
        onClick={() => boleh && !busy && input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && boleh && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (boleh) setAtas(true);
        }}
        onDragLeave={() => setAtas(false)}
        onDrop={(e) => {
          e.preventDefault();
          setAtas(false);
          hantar(e.dataTransfer.files?.[0]);
        }}
        className={`flex min-h-36 flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed px-4 py-5 text-center transition-colors ${
          atas ? "border-primary bg-[#E3F1EE]" : "border-[#C9D4D1] bg-surface"
        } ${boleh ? "cursor-pointer hover:border-primary" : "opacity-70"}`}
      >
        {path ? (
          <span className="flex h-[100px] w-[300px] max-w-full items-center justify-center rounded-[10px] bg-[repeating-conic-gradient(#F1F4F3_0_25%,#fff_0_50%)] bg-[length:16px_16px] p-2">
            <LogoSyarikat path={path} nama={nama} className="max-h-full max-w-full" />
          </span>
        ) : (
          <span className="flex h-[100px] w-[300px] max-w-full items-center justify-center rounded-[10px] bg-page text-xs font-bold text-muted">
            {tr("{0} × {1} px", SAIZ_LOGO.w, SAIZ_LOGO.h)}
          </span>
        )}
        <b className="text-sm text-primary">{busy ? tr("Memuat naik…") : path ? tr("Seret logo baharu ke sini atau tekan untuk tukar") : tr("Seret logo ke sini atau tekan untuk pilih fail")}</b>
        <span className="text-xs leading-normal text-muted">
          {tr("Saiz dicadangkan: {0} × {1} px (mendatar, nisbah 3:1). PNG dengan latar lutsinar paling cantik. JPG atau WebP juga boleh, maksimum 1 MB.", SAIZ_LOGO.w, SAIZ_LOGO.h)}
        </span>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            hantar(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {path && boleh && (
        <button type="button" onClick={buang} disabled={busy} className="flex min-h-11 items-center self-start text-sm font-bold text-danger disabled:opacity-50">
          {tr("Buang logo")}
        </button>
      )}
      {ralat && <ErrorBox message={ralat} />}
    </div>
  );
}
