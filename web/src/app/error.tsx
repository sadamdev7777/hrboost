"use client";

import { tr } from "@/lib/i18n";
import { useEffect } from "react";
import { laporRalat } from "@/lib/laporRalat";

/** Sempadan ralat: ralat paparan dilaporkan dan pengguna boleh cuba semula. */
export default function Ralat({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => laporRalat(error, error.digest ? `render ${error.digest}` : "render"), [error]);
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="m-0 text-xl font-extrabold">{tr("Maaf, berlaku ralat")}</h1>
      <p className="m-0 text-sm text-muted">{tr("Ralat ini telah direkodkan secara automatik. Sila cuba semula.")}</p>
      <div className="flex gap-2">
        <button type="button" onClick={reset} className="h-11 rounded-[12px] bg-primary px-5 text-sm font-bold text-white">
          {tr("Cuba semula")}
        </button>
        <a href="/utama" className="flex h-11 items-center rounded-[12px] border border-[#D5DEDC] bg-surface px-5 text-sm font-bold text-ink!">
          {tr("Ke laman utama")}
        </a>
      </div>
    </main>
  );
}
