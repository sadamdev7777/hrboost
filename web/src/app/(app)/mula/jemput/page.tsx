"use client";

import { tr } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { getSenaraiPekerja } from "@/lib/hr";
import { useSaluran } from "@/lib/saluran";
import { addDays, dow, todayISO } from "@/lib/format";
import { ErrorBox, Loading } from "@/components/ui";
import { ButangUtama, HadPeranan, Seksyen } from "@/components/Senarai";
import { MulaLayout } from "@/components/MulaLayout";

const JEMPUTAN_KEY = "hrb_pautan_tanpa_wa";

function isninSeterusnya(): string {
  const t = todayISO();
  const n = (8 - dow(t)) % 7 || 7;
  return addDays(t, n);
}

// Rujukan reka bentuk: design/SyarikatJemput.dc.html
export default function JemputPage() {
  return (
    <HadPeranan roles={["hr", "admin"]} back="/mula">
      <Jemput />
    </HadPeranan>
  );
}

function Jemput() {
  const me = useMe();
  const emp = me.active!;
  const router = useRouter();
  const d = useData(
    async () =>
      (await getSenaraiPekerja(emp.companyId)).filter(
        (p) => !p.activated && p.personId !== me.personId,
      ),
    [emp.companyId],
  );
  const telefon = useData(async () => {
    const ids = (d.data ?? []).map((p) => p.personId);
    if (!ids.length)
      return [] as { id: string; phone_whatsapp: string | null }[];
    return (
      must(
        await getSupabase()
          .from("persons")
          .select("id, phone_whatsapp")
          .in("id", ids),
      ) ?? []
    );
  }, [(d.data ?? []).length]);
  const saluran = useSaluran(emp.companyId);
  const [bila, setBila] = useState<"now" | "mon">("now");
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  if (!d.data) return d.error ? <ErrorBox message={d.error} /> : <Loading />;

  // WhatsApp automatik (Murpati) tidak aktif: semua pautan dihantar sendiri oleh HR selepas ini
  const automatik = saluran.whatsapp;
  const tanpaWa = automatik
    ? d.data.filter((p) =>
        telefon.data?.find((t) => t.id === p.personId && !t.phone_whatsapp),
      )
    : [];
  const denganWa = automatik ? d.data.length - tanpaWa.length : 0;
  const contoh = d.data[0]?.name ?? tr("Firdaus");
  const isnin = isninSeterusnya();

  async function hantar() {
    setBusy(true);
    setRalat(null);
    try {
      const sendAfter =
        automatik && bila === "mon"
          ? new Date(`${isnin}T09:00:00+08:00`).toISOString()
          : null;
      const r =
        must(
          await getSupabase().rpc("invite_pending", {
            p_company: emp.companyId,
            p_base_url: window.location.origin,
            p_send_after: sendAfter as string,
          }),
        ) ?? [];
      const pautan = r
        .filter((x) => !x.has_whatsapp && x.token)
        .map((x) => ({
          name: x.name,
          url: `${window.location.origin}/jemputan/${x.token}`,
          phone: x.phone,
          language: x.language,
        }));
      try {
        sessionStorage.setItem(
          JEMPUTAN_KEY,
          JSON.stringify({
            n: r.filter((x) => x.has_whatsapp).length,
            bila: automatik ? bila : "now",
            pautan,
          }),
        );
      } catch {}
      router.push("/mula/selesai");
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
      setBusy(false);
    }
  }

  return (
    <MulaLayout
      n={6}
      title={tr("Jemput pekerja")}
      back="/mula/peranan"
      footer={
        <ButangUtama onClick={hantar} busy={busy}>
          {d.data.length === 0
            ? tr("Selesai")
            : !automatik
              ? tr("Sediakan {0} pautan jemputan", d.data.length)
              : bila === "now"
                ? tr("Hantar {0} jemputan sekarang", denganWa)
                : tr("Jadualkan Isnin 9:00 pagi")}
        </ButangUtama>
      }
    >
      <span className="text-sm leading-normal text-subtle">
        {automatik
          ? tr("Setiap pekerja akan menerima pautan peribadi melalui WhatsApp.")
          : tr(
              "Setiap pekerja mendapat pautan peribadi. Pada langkah seterusnya, hantar pautan kepada setiap pekerja melalui WhatsApp anda sendiri (satu tekan) atau salin pautan.",
            )}
      </span>
      <Seksyen>{tr("PRATONTON MESEJ")}</Seksyen>
      <div className="max-w-[92%] rounded-[14px] rounded-tl-sm bg-[#E7DED3] p-3">
        <div className="rounded-[12px] bg-white px-3.5 py-2.5 text-sm leading-snug">
          {tr("Assalamualaikum")} <b>{contoh}</b>
          {tr(", anda dijemput menyertai")} <b>{emp.companyName}</b>{" "}
          {tr(
            "di HRBoost. Buka pautan ini dan sahkan 4 digit akhir kad pengenalan anda:",
          )}{" "}
          <span className="text-primary">
            {tr(
              "{0}/jemputan/••••••",
              typeof window !== "undefined"
                ? window.location.host
                : "hrboost.io",
            )}
          </span>{" "}
          {tr("(sah selama 7 hari)")}
        </div>
      </div>
      <div className="flex flex-col rounded-card bg-surface px-4 text-sm [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
        <div className="flex min-h-12 items-center justify-between">
          <span className="text-muted">
            {automatik
              ? tr("Dihantar melalui WhatsApp")
              : tr("Pautan untuk dihantar")}
          </span>
          <b>{tr("{0} orang", automatik ? denganWa : d.data.length)}</b>
        </div>
        {tanpaWa.map((p) => (
          <div
            key={p.id}
            className="flex min-h-12 items-center justify-between"
          >
            <span>{tr("{0} — tiada WhatsApp", p.name)}</span>
            <span className="text-xs text-muted">
              {tr("Pautan untuk disalin selepas ini")}
            </span>
          </div>
        ))}
      </div>
      {automatik && (
        <>
          <Seksyen className="pt-1">{tr("MASA PENGHANTARAN")}</Seksyen>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["now", tr("Sekarang")],
                ["mon", tr("Isnin, 9:00 pagi")],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                aria-pressed={bila === k}
                onClick={() => setBila(k)}
                className={`h-[46px] rounded-[12px] text-sm font-bold ${bila === k ? "border-[1.5px] border-primary bg-[#E3F1EE] text-primary" : "border border-[#D5DEDC] bg-surface"}`}
              >
                {l}
              </button>
            ))}
          </div>
          <span className="rounded-[14px] bg-warning-soft px-4 py-3 text-[13px] leading-normal text-warning">
            {tr(
              "Petua: maklumkan dahulu dalam kumpulan WhatsApp syarikat supaya pekerja tidak menyangka mesej ini spam.",
            )}
          </span>
        </>
      )}
      {ralat && <ErrorBox message={ralat} />}
    </MulaLayout>
  );
}
