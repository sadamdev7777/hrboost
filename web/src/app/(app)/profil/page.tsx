"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getProfil, sorokAkaun, sorokIC, sorokTelefon } from "@/lib/profil";
import { paparTelefon, tarikh } from "@/lib/format";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";

const BULAN = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];

// Rujukan reka bentuk: design/Profil.dc.html
export default function ProfilPage() {
  const me = useMe();
  const p = useData(() => getProfil(me.personId), [me.personId]);
  const d = p.data;

  return (
    <Screen>
      <BackHeader
        title="Profil Saya"
        href="/saya"
        action={
          <Link href="/profil/ubah" className="p-3 text-sm font-bold">
            Ubah
          </Link>
        }
      />
      <main className="flex grow flex-col gap-2.5 px-4 pt-1 pb-6">
        {p.error && <ErrorBox message={p.error} />}
        {p.loading && !d && <Loading />}
        {d && (
          <>
            <Seksyen>PERIBADI</Seksyen>
            <Kotak>
              <Medan label="Nama penuh (kad pengenalan)">{d.fullName}</Medan>
              <Medan label="Nama panggilan">{d.preferredName}</Medan>
              <Medan label="No. kad pengenalan">{sorokIC(d.icNo)}</Medan>
              <Medan label="WhatsApp">{sorokTelefon(d.phone)}</Medan>
              <Medan label="Alamat">{d.address || "Belum diisi"}</Medan>
            </Kotak>

            <Seksyen>BANK (UNTUK GAJI)</Seksyen>
            <Kotak>
              <Medan label="Bank">{d.bankName || "Belum diisi"}</Medan>
              <Medan label="No. akaun">{sorokAkaun(d.bankAccountNo)}</Medan>
            </Kotak>
            {d.bankMenunggu && (
              <div className="rounded-[14px] bg-warning-soft px-4 py-3 text-[13px] leading-normal text-warning">
                Pertukaran ke {d.bankMenunggu.bankName} {sorokAkaun(d.bankMenunggu.bankAccountNo)} sedang menunggu pengesahan HR.
              </div>
            )}
            {d.bankDitolak && !d.bankMenunggu && (
              <div className="rounded-[14px] bg-danger-soft px-4 py-3 text-[13px] leading-normal text-danger">
                Pertukaran akaun bank ditolak oleh HR pada {tarikh(d.bankDitolak.decidedAt)}
                {d.bankDitolak.note ? `: ${d.bankDitolak.note}` : "."}
              </div>
            )}

            <Seksyen>PEKERJAAN</Seksyen>
            <Kotak>
              {d.pekerjaan.map((e) => (
                <Medan key={e.company} label={e.company}>
                  {[e.position ?? e.department, `sejak ${BULAN[Number(e.joinDate.slice(5, 7)) - 1]} ${e.joinDate.slice(0, 4)}`].filter(Boolean).join(" · ")}
                </Medan>
              ))}
            </Kotak>

            <Seksyen>WARIS</Seksyen>
            <Kotak>
              {d.waris ? (
                <Medan label={d.waris.name}>{[d.waris.relationship, paparTelefon(d.waris.phone)].filter(Boolean).join(" · ")}</Medan>
              ) : (
                <Medan label="Waris">Belum diisi</Medan>
              )}
            </Kotak>

            <span className="text-xs leading-normal text-muted">
              Pertukaran akaun bank perlu disahkan oleh HR. Maklumat sensitif disembunyikan dan setiap akses direkodkan.
            </span>
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
