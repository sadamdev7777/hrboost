"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getKeadaanMula } from "@/lib/mula";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { HadPeranan } from "@/components/Senarai";

const noSub = () => () => {};
function bacaJemputan(): string {
  try {
    return sessionStorage.getItem("hrb_pautan_tanpa_wa") ?? "";
  } catch {
    return "";
  }
}

// Rujukan reka bentuk: design/SyarikatSelesai.dc.html
export default function SelesaiPage() {
  return (
    <HadPeranan roles={["hr", "admin"]} back="/mula">
      <Selesai />
    </HadPeranan>
  );
}

function Selesai() {
  const me = useMe();
  const d = useData(() => getKeadaanMula(me.active!.companyId), [me.active!.companyId]);
  const mentah = useSyncExternalStore(noSub, bacaJemputan, () => "");
  const j = mentah ? (JSON.parse(mentah) as { n: number; bila: string; pautan: { name: string; url: string }[] }) : null;
  const k = d.data;

  return (
    <Screen lebar="sederhana">
      <main className="flex grow flex-col gap-4 px-4 pt-10 pb-4">
        {d.error && <ErrorBox message={d.error} />}
        {!k && !d.error && <Loading />}
        {k && (
          <>
            <span className="flex size-14 items-center justify-center rounded-full bg-[#E3F1EE] text-3xl text-primary">✓</span>
            <h1 className="m-0 text-[22px] font-extrabold">{k.name} sudah sedia!</h1>
            {j && <span className="text-sm text-subtle">{j.bila === "mon" ? `${j.n} jemputan dijadualkan pada Isnin, 9:00 pagi.` : `${j.n} jemputan dihantar melalui WhatsApp.`}</span>}
            <div className="flex flex-col gap-2 rounded-card bg-surface px-4 py-3">
              <div className="flex justify-between text-sm">
                <span className="font-bold">Pekerja yang telah mengaktifkan akaun</span>
                <b>
                  {k.activated} / {k.employees}
                </b>
              </div>
              <div className="h-2 rounded-full bg-[#E4EAE8]">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(k.activated / Math.max(k.employees, 1)) * 100}%` }} />
              </div>
              <span className="text-xs text-muted">Anda akan menerima ringkasan melalui WhatsApp setiap petang sehingga semua pekerja aktif.</span>
            </div>
            {(j?.pautan ?? []).length > 0 && (
              <div className="flex flex-col gap-2 rounded-card bg-surface px-4 py-3 text-sm">
                <b>Pautan untuk pekerja tanpa WhatsApp</b>
                {j!.pautan.map((p) => (
                  <div key={p.url} className="flex items-center gap-2">
                    <span className="grow">{p.name}</span>
                    <button type="button" onClick={() => navigator.clipboard?.writeText(p.url)} className="min-h-10 font-bold text-primary">
                      Salin pautan
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2 text-sm">
              <span>✓ {k.departments} jabatan{k.departments_without_head === 0 ? ", semuanya mempunyai ketua" : ` (${k.departments_without_head} tanpa ketua)`}</span>
              <span>✓ Aliran kelulusan cuti &amp; tuntutan aktif</span>
              <span>✓ Jenis cuti &amp; {k.holidays} cuti umum mengikut Akta Kerja</span>
            </div>
            <span className="pt-2 text-xs font-bold tracking-[0.04em] text-[#4A5A57]">BOLEH DILAKUKAN KEMUDIAN</span>
            <div className="flex flex-col rounded-card bg-surface px-4 text-sm [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              {[
                ["Lengkapkan profil anda sendiri", "/orientasi", "5 min"],
                ["Tetapan gaji & no. majikan", "/pengurusan/tetapan/syarikat", "Sebelum gaji pertama"],
                ["Sambungkan mesin kehadiran", "/pengurusan/tetapan/kehadiran", "Pilihan"],
                ["Semak cuti umum", "/pengurusan/tetapan/cuti-umum", "Pilihan"],
              ].map(([t, h, n]) => (
                <Link key={t} href={h} className="flex min-h-12 items-center justify-between gap-2 text-ink!">
                  <span>{t}</span>
                  <em className="text-xs text-muted not-italic">{n}</em>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
      <div className="bar-bawah sticky bottom-0 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
        <Link href="/pengurusan" className="flex h-12 items-center justify-center rounded-button bg-primary text-base font-extrabold text-white!">
          Pergi ke Papan Pemuka
        </Link>
      </div>
    </Screen>
  );
}
