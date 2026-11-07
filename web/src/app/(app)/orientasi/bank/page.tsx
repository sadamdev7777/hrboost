"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { getKemajuan, langkahSeterusnya, simpanLangkah } from "@/lib/onboarding";
import { Loading, Screen } from "@/components/ui";
import { NextButton, OnboardingLayout, Seksyen, inputCls } from "@/components/OnboardingLayout";

// Rujukan reka bentuk: design/OnboardingLangkah.dc.html
const BANK = [
  "Maybank",
  "CIMB Bank",
  "Public Bank",
  "RHB Bank",
  "Hong Leong Bank",
  "AmBank",
  "Bank Islam",
  "Bank Rakyat",
  "Bank Simpanan Nasional (BSN)",
  "Affin Bank",
  "Alliance Bank",
  "Bank Muamalat",
  "Agrobank",
  "MBSB Bank",
  "Al Rajhi Bank",
  "Kuwait Finance House",
  "OCBC Bank",
  "HSBC Bank",
  "UOB",
  "Standard Chartered",
];
const HUBUNGAN = ["Ibu", "Bapa", "Suami / Isteri", "Adik-beradik", "Anak", "Lain-lain"];

export default function OrientasiBankPage() {
  const me = useMe();
  const emp = me.active!;
  const asal = useData(async () => {
    const sb = getSupabase();
    const p = must(await sb.from("persons").select("bank_name, bank_account_no").eq("id", me.personId).single());
    const c = must(await sb.from("emergency_contacts").select("name, relationship, phone").eq("person_id", me.personId).limit(1));
    return { ...p, contact: c[0] ?? null };
  }, [me.personId]);

  if (!asal.data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  return <Borang emp={emp.id} asal={asal.data} />;
}

function Borang({
  emp,
  asal,
}: {
  emp: string;
  asal: { bank_name: string | null; bank_account_no: string | null; contact: { name: string; relationship: string | null; phone: string } | null };
}) {
  const router = useRouter();
  const [bank, setBank] = useState(asal.bank_name ?? "");
  const [akaun, setAkaun] = useState(asal.bank_account_no ?? "");
  const [waris, setWaris] = useState(asal.contact?.name ?? "");
  const [hubungan, setHubungan] = useState(asal.contact?.relationship ?? HUBUNGAN[0]);
  const [telefon, setTelefon] = useState(asal.contact?.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function simpan() {
    setBusy(true);
    setError(null);
    try {
      await simpanLangkah(emp, "bank", {
        bank_name: bank,
        bank_account_no: akaun,
        contact_name: waris,
        contact_relationship: hubungan,
        contact_phone: telefon,
      });
      router.push(langkahSeterusnya(await getKemajuan(emp), "bank"));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const lengkap = bank && akaun.trim() && waris.trim() && telefon.trim();

  return (
    <OnboardingLayout
      step={4}
      back="/orientasi/swafoto"
      title="Bank & waris"
      sub="Untuk bayaran gaji dan kecemasan."
      error={error}
      footer={<NextButton busy={busy} disabled={!lengkap} onClick={simpan} />}
    >
      <Seksyen>AKAUN BANK GAJI</Seksyen>
      <label className="flex flex-col gap-1.5 text-sm font-bold">
        Bank
        <select value={bank} onChange={(e) => setBank(e.target.value)} className={inputCls}>
          <option value="">Pilih bank</option>
          {BANK.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-bold">
        No. akaun
        <input
          type="text"
          inputMode="numeric"
          placeholder="Contoh: 1234 5678 9012"
          value={akaun}
          onChange={(e) => setAkaun(e.target.value.replace(/[^\d\s-]/g, ""))}
          className={inputCls}
        />
      </label>
      <span className="-mt-1.5 text-xs text-muted">Nama akaun mesti sama dengan nama dalam kad pengenalan.</span>

      <Seksyen className="mt-1">WARIS UNTUK KECEMASAN</Seksyen>
      <label className="flex flex-col gap-1.5 text-sm font-bold">
        Nama
        <input type="text" placeholder="Nama penuh waris" value={waris} onChange={(e) => setWaris(e.target.value)} className={inputCls} />
      </label>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Hubungan
          <select value={hubungan} onChange={(e) => setHubungan(e.target.value)} className={inputCls}>
            {HUBUNGAN.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          No. telefon
          <input
            type="tel"
            inputMode="tel"
            placeholder="01x-xxx xxxx"
            value={telefon}
            onChange={(e) => setTelefon(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>
    </OnboardingLayout>
  );
}
