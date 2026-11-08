"use client";

import Link from "next/link";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getKeadaanMula, LANGKAH_MULA, langkahSeterusnya } from "@/lib/mula";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { HadPeranan } from "@/components/Senarai";

// Rujukan reka bentuk: design/OnboardingSyarikat.dc.html
export default function MulaPage() {
  return (
    <HadPeranan roles={["hr", "admin"]} back="/utama">
      <Senarai />
    </HadPeranan>
  );
}

function Senarai() {
  const me = useMe();
  const d = useData(() => getKeadaanMula(me.active!.companyId), [me.active!.companyId]);
  const k = d.data;
  const siap = k?.steps.length ?? 0;
  const seterusnya = k ? langkahSeterusnya(k) : "/mula/syarikat";

  return (
    <Screen>
      <main className="flex grow flex-col gap-4 px-4 pt-8 pb-4">
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !k && <Loading />}
        {k && (
          <>
            <span className="text-sm font-bold text-primary uppercase">{k.name}</span>
            <h1 className="m-0 text-[22px] font-extrabold">Sediakan syarikat anda</h1>
            <span className="text-sm leading-normal text-subtle">Tetapan cuti, tuntutan dan kelulusan telah disediakan mengikut Akta Kerja. Anda hanya perlu menyemaknya.</span>
            <div className="flex flex-col gap-2 rounded-card bg-surface px-4 py-3">
              <div className="flex justify-between text-sm font-bold">
                <span>{siap} daripada 6 selesai</span>
                <span className="text-muted">~{Math.max(0, 6 - siap) * 4} minit lagi</span>
              </div>
              <div className="h-2 rounded-full bg-[#E4EAE8]">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(siap / 6) * 100}%` }} />
              </div>
            </div>
            <span className="text-xs font-bold tracking-[0.04em] text-[#4A5A57]">WAJIB UNTUK MULA</span>
            <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              {LANGKAH_MULA.map((l, i) => {
                const done = k.steps.includes(l.id);
                const kini = l.href === seterusnya;
                const isi = (
                  <>
                    <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${done ? "bg-primary text-white" : kini ? "border-2 border-primary text-primary" : "bg-[#E4EAE8] text-[#4A5A57]"}`}>
                      {done ? "✓" : i + 1}
                    </span>
                    <span className={`grow text-sm ${done ? "text-muted line-through" : "font-bold"}`}>{l.label}</span>
                    <span className={`text-[13px] font-bold ${kini ? "text-primary" : "text-muted"}`}>{kini ? "Mulakan →" : l.nota}</span>
                  </>
                );
                return l.id === "admin" ? (
                  <div key={l.id} className="flex min-h-12 items-center gap-3">
                    {isi}
                  </div>
                ) : (
                  <Link key={l.id} href={l.href} className="flex min-h-12 items-center gap-3 text-ink!">
                    {isi}
                  </Link>
                );
              })}
            </div>
            <span className="pt-1 text-xs font-bold tracking-[0.04em] text-[#4A5A57]">BOLEH DILAKUKAN KEMUDIAN</span>
            <div className="flex flex-col rounded-card bg-surface px-4 text-sm text-[#4A5A57] [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              {[
                ["No. majikan & tetapan gaji", "/pengurusan/tetapan/syarikat"],
                ["Sambungkan mesin kehadiran", "/pengurusan/tetapan/kehadiran"],
                ["Muat naik buku panduan untuk AI", "/pengurusan/tetapan/pengetahuan-ai"],
                ["Daftar syarikat lain milik anda", "/daftar"],
              ].map(([t, h]) => (
                <Link key={t} href={h} className="flex min-h-12 items-center text-[#4A5A57]!">
                  {t}
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
      {k && (
        <div className="sticky bottom-0 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
          <Link href={seterusnya} className="flex h-12 items-center justify-center rounded-button bg-primary text-base font-extrabold text-white!">
            {seterusnya === "/mula/selesai" ? "Lihat ringkasan" : "Teruskan"}
          </Link>
        </div>
      )}
    </Screen>
  );
}
