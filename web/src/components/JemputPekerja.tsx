"use client";

import { tr, trRalat } from "@/lib/i18n";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { bukaWa, teksJemputan, useSaluran } from "@/lib/saluran";
import { beritahu } from "@/components/Dialog";
import { ErrorBox, Loading } from "@/components/ui";
import { Lembaran } from "@/components/Senarai";

type Kenalan = { name: string; email: string | null; phone: string | null; language: string | null; company: string };
type Hasil = { token: string; url: string };

async function hantar(employmentId: string, saluran: "email" | "whatsapp" | "link"): Promise<Hasil> {
  return must(await getSupabase().rpc("invite_send", { p_employment: employmentId, p_base_url: window.location.origin, p_channel: saluran })) as unknown as Hasil;
}

/**
 * Jemput pekerja mengaktifkan akaun: e-mel (dihantar oleh sistem), WhatsApp (automatik jika WhatsApp disambung;
 * jika tidak, WhatsApp dibuka dengan mesej siap diisi ke nombor pekerja) atau salin pautan.
 */
export function JemputPekerja({ employmentId, companyId, onClose, onSelesai }: { employmentId: string; companyId: string; onClose: () => void; onSelesai: () => void }) {
  const k = useData(async () => must(await getSupabase().rpc("invite_contact", { p_employment: employmentId })) as unknown as Kenalan, [employmentId]);
  const saluran = useSaluran(companyId);
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [ralat, setRalat] = useState<string | null>(null);
  const x = k.data;

  async function buat(cara: "email" | "whatsapp" | "salin") {
    if (!x) return;
    setSibuk(cara);
    setRalat(null);
    try {
      if (cara === "email") {
        await hantar(employmentId, "email");
        beritahu(tr("Jemputan dihantar ke {0}.", x.email ?? ""));
      } else if (cara === "whatsapp" && saluran.whatsapp) {
        await hantar(employmentId, "whatsapp");
        beritahu(tr("Jemputan dihantar kepada {0} melalui WhatsApp.", x.name));
      } else if (cara === "whatsapp") {
        const h = await hantar(employmentId, "link");
        bukaWa(x.phone, teksJemputan(x.name, x.company, h.url, x.language));
      } else {
        const h = await hantar(employmentId, "link");
        await navigator.clipboard?.writeText(h.url);
        beritahu(tr("Pautan jemputan disalin. Tampal dan hantar kepada {0}.", x.name));
      }
      onSelesai();
      onClose();
    } catch (e) {
      setRalat(e instanceof Error ? trRalat(e.message) : tr("Ralat"));
    }
    setSibuk(null);
  }

  const pilihan = "flex min-h-14 w-full flex-col items-start gap-0.5 rounded-[14px] border border-line bg-surface px-4 py-3 text-left hover:border-primary disabled:opacity-50";
  return (
    <Lembaran title={x ? tr("Jemput {0}", x.name) : tr("Jemput pekerja")} onClose={onClose}>
      {k.error && <ErrorBox message={k.error} />}
      {!x && !k.error && <Loading />}
      {x && (
        <div className="flex flex-col gap-2.5">
          <span className="text-[13px] leading-snug text-subtle">
            {tr("Pekerja membuka pautan, mengesahkan 4 digit akhir kad pengenalan dan menetapkan kata laluan. Pautan sah selama 7 hari.")}
          </span>
          <button type="button" disabled={!x.email || !!sibuk} onClick={() => buat("email")} className={pilihan}>
            <b className="text-sm font-bold">{sibuk === "email" ? tr("Menghantar…") : tr("Hantar melalui e-mel")}</b>
            <span className="text-xs text-muted">{x.email ?? tr("Tiada e-mel. Isi di profil pekerja dahulu.")}</span>
          </button>
          <button type="button" disabled={!x.phone || !!sibuk} onClick={() => buat("whatsapp")} className={pilihan}>
            <b className="text-sm font-bold">{sibuk === "whatsapp" ? tr("Menghantar…") : tr("Hantar melalui WhatsApp")}</b>
            <span className="text-xs text-muted">
              {x.phone ? (saluran.whatsapp ? tr("Dihantar automatik ke {0}", x.phone) : tr("WhatsApp dibuka dengan mesej siap diisi ke {0}", x.phone)) : tr("Tiada nombor WhatsApp. Isi di profil pekerja dahulu.")}
            </span>
          </button>
          <button type="button" disabled={!!sibuk} onClick={() => buat("salin")} className={pilihan}>
            <b className="text-sm font-bold">{tr("Salin pautan")}</b>
            <span className="text-xs text-muted">{tr("Hantar sendiri melalui aplikasi lain")}</span>
          </button>
          {ralat && <ErrorBox message={ralat} />}
        </div>
      )}
    </Lembaran>
  );
}
