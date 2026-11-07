"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { getKemajuan, langkahSeterusnya, simpanLangkah } from "@/lib/onboarding";
import { Loading, Screen } from "@/components/ui";
import { NextButton, OnboardingLayout, Seksyen } from "@/components/OnboardingLayout";

// Rujukan reka bentuk: design/OnboardingPeribadi.dc.html
const STATUS = [
  { id: "bujang", label: "Bujang" },
  { id: "berkahwin", label: "Berkahwin" },
  { id: "duda_janda", label: "Duda / Janda" },
] as const;

type Asal = {
  address: string | null;
  marital_status: string | null;
  spouse_working: boolean | null;
  children_count: number;
  epf_no: string | null;
  tax_no: string | null;
};

export default function OrientasiPeribadiPage() {
  const me = useMe();
  const emp = me.active!;
  const asal = useData(async () => {
    const sb = getSupabase();
    const p = must(
      await sb.from("persons").select("address, marital_status, spouse_working, children_count").eq("id", me.personId).single(),
    );
    const e = must(await sb.from("employments").select("epf_no, tax_no").eq("id", emp.id).single());
    return { ...p, ...e } as Asal;
  }, [me.personId, emp.id]);

  if (!asal.data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  return <Borang emp={emp.id} asal={asal.data} />;
}

function Borang({ emp, asal }: { emp: string; asal: Asal }) {
  const router = useRouter();
  const [alamat, setAlamat] = useState(asal.address ?? "");
  const [status, setStatus] = useState<string>(asal.marital_status ?? "");
  const [pasanganTakKerja, setPasanganTakKerja] = useState(asal.spouse_working === false);
  const [anak, setAnak] = useState(asal.children_count ?? 0);
  const [kwsp, setKwsp] = useState(asal.epf_no ?? "");
  const [tin, setTin] = useState(asal.tax_no ?? "");
  const [bantuan, setBantuan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function simpan() {
    setBusy(true);
    setError(null);
    try {
      await simpanLangkah(emp, "personal", {
        address: alamat,
        marital_status: status,
        spouse_working: !pasanganTakKerja,
        children_count: status === "bujang" ? 0 : anak,
        epf_no: kwsp,
        tax_no: tin,
        need_help: bantuan,
      });
      router.push(langkahSeterusnya(await getKemajuan(emp), "personal"));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const fld = "h-11 rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-ink placeholder:font-normal placeholder:text-muted";

  return (
    <OnboardingLayout
      step={6}
      back="/orientasi/kad-pengenalan"
      title="Peribadi, KWSP & cukai"
      sub="Supaya potongan gaji anda dikira dengan betul."
      error={error}
      footer={<NextButton busy={busy} disabled={!status} onClick={simpan} />}
    >
      <label className="flex flex-col gap-1.5 text-[13px] font-bold">
        Alamat rumah semasa
        <input
          type="text"
          autoComplete="street-address"
          placeholder="Alamat seperti dalam kad pengenalan, atau alamat semasa"
          value={alamat}
          onChange={(e) => setAlamat(e.target.value)}
          className={fld}
        />
      </label>

      <Seksyen>STATUS PERKAHWINAN</Seksyen>
      <div className="grid grid-cols-3 gap-1.5">
        {STATUS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={status === s.id}
            onClick={() => setStatus(s.id)}
            className={`h-11 rounded-xl text-[13px] font-bold ${
              status === s.id ? "border-[1.5px] border-primary bg-primary-soft text-primary" : "border border-line bg-surface text-ink"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {status && status !== "bujang" && (
        <div className="flex flex-col gap-2.5 rounded-[14px] bg-surface px-3.5 py-2.5">
          {status === "berkahwin" && (
            <label className="flex items-center gap-2.5 text-[13px] font-semibold">
              <input
                type="checkbox"
                checked={pasanganTakKerja}
                onChange={(e) => setPasanganTakKerja(e.target.checked)}
                className="size-5 accent-primary"
              />
              Pasangan tidak bekerja
            </label>
          )}
          <div className="flex items-center gap-2.5">
            <span className="grow text-[13px] font-bold">
              Bilangan anak
              <br />
              <span className="text-[11px] font-medium text-muted">di bawah 18 tahun, atau masih belajar</span>
            </span>
            <Stepper label="Kurangkan anak" onClick={() => setAnak((n) => Math.max(0, n - 1))}>
              −
            </Stepper>
            <b className="w-7 text-center text-lg">{anak}</b>
            <Stepper label="Tambah anak" onClick={() => setAnak((n) => n + 1)}>
              +
            </Stepper>
          </div>
        </div>
      )}

      <Seksyen>NO. BERKANUN</Seksyen>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1.5 text-[13px] font-bold">
          No. KWSP
          <input type="text" inputMode="numeric" placeholder="Contoh: 12345678" value={kwsp} onChange={(e) => setKwsp(e.target.value)} className={fld} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-bold">
          No. cukai (TIN)
          <input type="text" placeholder="IG..." value={tin} onChange={(e) => setTin(e.target.value.toUpperCase())} className={fld} />
        </label>
      </div>
      <label className="flex items-center gap-2.5 text-[13px] font-semibold">
        <input type="checkbox" checked={bantuan} onChange={(e) => setBantuan(e.target.checked)} className="size-5 accent-primary" />
        Belum ada — minta bantuan HR untuk mendaftar
      </label>
      <span className="text-[11px] font-medium text-muted">
        No. PERKESO menggunakan no. kad pengenalan anda — tiada maklumat perlu diisi.
      </span>
    </OnboardingLayout>
  );
}

function Stepper({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="size-11 rounded-xl border border-line bg-surface text-xl font-bold text-ink"
    >
      {children}
    </button>
  );
}
