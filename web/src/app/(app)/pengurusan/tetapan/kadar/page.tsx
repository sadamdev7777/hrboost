"use client";

import { useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { tarikh, todayISO } from "@/lib/format";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { HadPeranan, Seksyen, Tag } from "@/components/Senarai";

const JADUAL = [
  { code: "EPF", name: "KWSP", sub: "Jadual Ketiga" },
  { code: "SOCSO", name: "PERKESO", sub: "Kategori pertama & kedua" },
  { code: "EIS", name: "SIP / EIS", sub: "Jadual caruman" },
  { code: "PCB", name: "PCB / MTD", sub: "Kaedah pengiraan berkomputer LHDN" },
  { code: "HRDF", name: "HRDF", sub: "Levi mengikut tetapan syarikat" },
];

// Rujukan reka bentuk: design/T_KadarBerkanun.dc.html
export default function KadarPage() {
  return (
    <HadPeranan roles={["hr", "finance", "ceo", "admin"]} back="/pengurusan/tetapan">
      <Kadar />
    </HadPeranan>
  );
}

function Kadar() {
  const me = useMe();
  const cid = me.active!.companyId;
  const today = todayISO();
  const d = useData(async () => {
    const sb = getSupabase();
    const [r, c] = await Promise.all([
      sb.from("statutory_rates").select("code, effective_from, effective_to").lte("effective_from", today).order("effective_from", { ascending: false }),
      sb.from("companies").select("epf_employer_rate, hrdf_registered").eq("id", cid).single(),
    ]);
    return { r: must(r) ?? [], c: must(c) };
  }, [cid, today]);
  const [ralat, setRalat] = useState<string | null>(null);
  const admin = me.roles.includes("admin");

  async function kadarKwsp(v: string) {
    setRalat(null);
    const n = v === "" ? null : Number(v);
    if (n !== null && !(n >= 12 && n <= 30)) return setRalat("Kadar mesti antara 12% hingga 30%.");
    try {
      must(await getSupabase().from("companies").update({ epf_employer_rate: n }).eq("id", cid));
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
    }
  }

  return (
    <Screen>
      <BackHeader title="Kadar berkanun" href="/pengurusan/tetapan" />
      <main className="flex grow flex-col gap-2.5 px-5 pt-1 pb-6">
        <div className="rounded-[14px] bg-[#E3F1EE] px-4 py-3 text-[13px] leading-normal text-primary">
          Jadual kadar dikemas kini oleh HRBoost untuk semua syarikat apabila kerajaan mengumumkan perubahan. Anda tidak perlu memasukkan kadar sendiri.
        </div>
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data && <Loading />}
        <Seksyen>JADUAL SEMASA</Seksyen>
        <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
          {JADUAL.map((j) => {
            const r = d.data?.r.find((x) => x.code === j.code && (!x.effective_to || x.effective_to >= today));
            return (
              <div key={j.code} className="flex min-h-[56px] items-center gap-2 py-2">
                <span className="flex grow flex-col gap-0.5">
                  <b className="text-[15px] font-bold">{j.name}</b>
                  <span className="text-xs text-muted">
                    {j.sub}
                    {r ? ` · berkuat kuasa ${tarikh(r.effective_from)} ${r.effective_from.slice(0, 4)}` : ""}
                  </span>
                </span>
                {d.data && (r ? <Tag tone="success">Terkini</Tag> : <Tag tone="warning">Belum dimuatkan</Tag>)}
              </div>
            );
          })}
        </div>

        <Seksyen className="pt-1">PILIHAN SYARIKAT</Seksyen>
        <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
          <div className="flex min-h-[60px] items-center gap-2 py-2">
            <span className="flex grow flex-col gap-0.5">
              <b className="text-[15px] font-bold">Caruman KWSP majikan</b>
              <span className="text-xs text-muted">Boleh lebih tinggi daripada minimum</span>
            </span>
            <select
              aria-label="Caruman KWSP majikan"
              disabled={!admin}
              value={d.data?.c.epf_employer_rate == null ? "" : String(Number(d.data.c.epf_employer_rate))}
              onChange={(e) => kadarKwsp(e.target.value)}
              className="h-10 rounded-[10px] border border-[#D5DEDC] bg-surface px-2 text-sm font-semibold"
            >
              <option value="">Mengikut minimum</option>
              {[13, 14, 15, 16, 17, 18, 20].map((p) => (
                <option key={p} value={p}>
                  {p}%
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-h-[60px] items-center gap-2 py-2">
            <span className="flex grow flex-col gap-0.5">
              <b className="text-[15px] font-bold">Kadar levi HRDF</b>
              <span className="text-xs text-muted">Daripada Profil syarikat</span>
            </span>
            <span className="text-sm font-bold">{d.data ? (d.data.c.hrdf_registered ? "Mengikut pendaftaran" : "Tidak berdaftar") : ""}</span>
          </div>
        </div>
        {ralat && <ErrorBox message={ralat} />}
        <span className="rounded-[14px] bg-warning-soft px-4 py-3 text-xs leading-normal text-warning">
          Sebelum gaji pertama, bandingkan kiraan sistem dengan kalkulator rasmi selama 2 bulan.
        </span>
      </main>
    </Screen>
  );
}
