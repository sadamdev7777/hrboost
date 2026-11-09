"use client";

import { tr } from "@/lib/i18n";
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
    <Screen lebar="sederhana">
      <main className="flex grow flex-col gap-4 px-4 pt-8 pb-4">
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !k && <Loading />}
        {k && (
          <>
            <span className="text-sm font-bold text-primary uppercase">{k.name}</span>
            <h1 className="m-0 text-[22px] font-extrabold">{tr("Sediakan syarikat anda")}</h1>
            <span className="text-sm leading-normal text-subtle">{tr("Tetapan cuti, tuntutan dan kelulusan telah disediakan mengikut Akta Kerja. Anda hanya perlu menyemaknya.")}</span>
            <div className="flex flex-col gap-2 rounded-card bg-surface px-4 py-3">
              <div className="flex justify-between text-sm font-bold">
                <span>{tr("{0} daripada 6 selesai", siap)}</span>
                <span className="text-muted">{tr("~{0} minit lagi", Math.max(0, 6 - siap) * 4)}</span>
              </div>
              <div className="h-2 rounded-full bg-[#E4EAE8]">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(siap / 6) * 100}%` }} />
              </div>
            </div>
            <span className="text-xs font-bold tracking-[0.04em] text-[#4A5A57]">{tr("WAJIB UNTUK MULA")}</span>
            <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              {LANGKAH_MULA.map((l, i) => {
                const done = k.steps.includes(l.id);
                const kini = l.href === seterusnya;
                const isi = (
                  <>
                    <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${done ? "bg-primary text-white" : kini ? "border-2 border-primary text-primary" : "bg-[#E4EAE8] text-[#4A5A57]"}`}>
                      {done ? "✓" : i + 1}
                    </span>
                    <span className={`grow text-sm ${done ? "text-muted line-through" : "font-bold"}`}>{tr(l.label)}</span>
                    <span className={`text-[13px] font-bold ${kini ? "text-primary" : "text-muted"}`}>
                      {(l.id === "company" || l.id === "roles") && !me.roles.includes("admin") && !done ? tr("Pentadbir sahaja") : kini ? tr("Mulakan →") : l.nota}
                    </span>
                  </>
                );
                const khas = (l.id === "company" || l.id === "roles") && !me.roles.includes("admin");
                return l.id === "admin" || khas ? (
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
            <span className="pt-1 text-xs font-bold tracking-[0.04em] text-[#4A5A57]">{tr("BOLEH DILAKUKAN KEMUDIAN")}</span>
            <div className="flex flex-col rounded-card bg-surface px-4 text-sm text-[#4A5A57] [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              {[
                [tr("No. majikan & tetapan gaji"), "/pengurusan/tetapan/syarikat"],
                [tr("Sambungkan mesin kehadiran"), "/pengurusan/tetapan/kehadiran"],
                [tr("Muat naik buku panduan untuk AI"), "/pengurusan/tetapan/pengetahuan-ai"],
                [tr("Daftar syarikat lain milik anda"), "/daftar"],
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
        <div className="bar-bawah sticky bottom-0 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
          <Link href={seterusnya} className="flex h-12 items-center justify-center rounded-button bg-primary text-base font-extrabold text-white!">
            {seterusnya === "/mula/selesai" ? tr("Lihat ringkasan") : tr("Teruskan")}
          </Link>
        </div>
      )}
    </Screen>
  );
}
