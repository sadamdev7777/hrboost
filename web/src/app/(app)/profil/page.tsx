"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import type { ReactNode } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getProfil, sorokAkaun, sorokIC, sorokTelefon } from "@/lib/profil";
import { paparTelefon, tarikh } from "@/lib/format";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";

const BULAN = [tr("Jan"), tr("Feb"), tr("Mac"), tr("Apr"), tr("Mei"), tr("Jun"), tr("Jul"), tr("Ogo"), tr("Sep"), tr("Okt"), tr("Nov"), tr("Dis")];

// Rujukan reka bentuk: design/Profil.dc.html
export default function ProfilPage() {
  const me = useMe();
  const p = useData(() => getProfil(me.personId), [me.personId]);
  const d = p.data;

  return (
    <Screen>
      <BackHeader
        title={tr("Profil Saya")}
        href="/saya"
        action={
          <Link href="/profil/ubah" className="p-3 text-sm font-bold">
            {tr("Ubah")}</Link>
        }
      />
      <main className="flex grow flex-col gap-2.5 px-4 pt-1 pb-6">
        {p.error && <ErrorBox message={p.error} />}
        {p.loading && !d && <Loading />}
        {d && (
          <>
<div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-6 lg:gap-y-5">
<div className="flex flex-col gap-2.5">
            <Seksyen>{tr("PERIBADI")}</Seksyen>
            <Kotak>
              <Medan label={tr("Nama penuh (kad pengenalan)")}>{d.fullName}</Medan>
              <Medan label={tr("Nama panggilan")}>{d.preferredName}</Medan>
              <Medan label={tr("No. kad pengenalan")}>{sorokIC(d.icNo)}</Medan>
              <Medan label={tr("WhatsApp")}>{sorokTelefon(d.phone)}</Medan>
              <Medan label={tr("Alamat")}>{d.address || tr("Belum diisi")}</Medan>
            </Kotak>
</div>
<div className="flex flex-col gap-2.5">
            <Seksyen>{tr("LOG MASUK")}</Seksyen>
            <Kotak>
              <Link href="/akaun/kata-laluan" className="flex min-h-[50px] items-center justify-between gap-3 px-4 py-2 text-sm text-ink!">
                <span className="text-muted">{tr("E-mel & kata laluan")}</span>
                <span className="truncate font-semibold">{me.loginEmail ?? tr("Belum ditetapkan")} ›</span>
              </Link>
            </Kotak>
</div>
<div className="flex flex-col gap-2.5">
            <Seksyen>{tr("BANK (UNTUK GAJI)")}</Seksyen>
            <Kotak>
              <Medan label={tr("Bank")}>{d.bankName || tr("Belum diisi")}</Medan>
              <Medan label={tr("No. akaun")}>{sorokAkaun(d.bankAccountNo)}</Medan>
            </Kotak>
            {d.bankMenunggu && (
              <div className="rounded-[14px] bg-warning-soft px-4 py-3 text-[13px] leading-normal text-warning">
                {tr("Pertukaran ke {0} {1} sedang menunggu pengesahan HR.", d.bankMenunggu.bankName, sorokAkaun(d.bankMenunggu.bankAccountNo))}</div>
            )}
            {d.bankDitolak && !d.bankMenunggu && (
              <div className="rounded-[14px] bg-danger-soft px-4 py-3 text-[13px] leading-normal text-danger">
                {tr("Pertukaran akaun bank ditolak oleh HR pada {0}{1}", tarikh(d.bankDitolak.decidedAt), d.bankDitolak.note ? `: ${d.bankDitolak.note}` : ".")}</div>
            )}
</div>
<div className="flex flex-col gap-2.5">
            <Seksyen>{tr("PEKERJAAN")}</Seksyen>
            <Kotak>
              {d.pekerjaan.map((e) => (
                <Medan key={e.company} label={e.company}>
                  {[e.position ?? e.department, tr("sejak {0} {1}", BULAN[Number(e.joinDate.slice(5, 7)) - 1], e.joinDate.slice(0, 4))].filter(Boolean).join(" · ")}
                </Medan>
              ))}
            </Kotak>
</div>
<div className="flex flex-col gap-2.5">
            <Seksyen>{tr("WARIS")}</Seksyen>
            <Kotak>
              {d.waris ? (
                <Medan label={d.waris.name}>{[d.waris.relationship, paparTelefon(d.waris.phone)].filter(Boolean).join(" · ")}</Medan>
              ) : (
                <Medan label={tr("Waris")}>{tr("Belum diisi")}</Medan>
              )}
            </Kotak>


</div>
</div>            <span className="text-xs leading-normal text-muted">
              {tr("Pertukaran akaun bank perlu disahkan oleh HR. Maklumat sensitif disembunyikan dan setiap akses direkodkan.")}</span>
          </>
        )}
      </main>
    </Screen>
  );
}

function Seksyen({ children }: { children: ReactNode }) {
  return <span className="text-xs font-bold tracking-[0.04em] text-[#4A5A57]">{children}</span>;
}

function Kotak({ children }: { children: ReactNode }) {
  return <div className="flex flex-col rounded-card bg-surface [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">{children}</div>;
}

function Medan({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[50px] items-center justify-between gap-3 px-4 py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right font-bold">{children}</span>
    </div>
  );
}
