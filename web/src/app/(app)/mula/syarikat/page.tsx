"use client";

import { tr, trRalat } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMe, useMeContext } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { selesaiLangkah } from "@/lib/mula";
import { NEGERI } from "@/lib/senarai";
import { ErrorBox, Loading } from "@/components/ui";
import { ButangUtama, HadPeranan, MedanBorang, Seksyen, inputKecil } from "@/components/Senarai";
import { MulaLayout } from "@/components/MulaLayout";

// Rujukan reka bentuk: design/SyarikatLangkah.dc.html
export default function MulaSyarikatPage() {
  return (
    <HadPeranan roles={["admin"]} back="/mula">
      <Borang />
    </HadPeranan>
  );
}

function Borang() {
  const me = useMe();
  const ctx = useMeContext();
  const cid = me.active!.companyId;
  const router = useRouter();
  const eid = me.active!.id;
  const d = useData(async () => {
    const sb = getSupabase();
    const [c, e, g] = await Promise.all([
      sb.from("companies").select("name, code, reg_no, state, weekend_days, work_start, work_end, late_grace_minutes").eq("id", cid).single(),
      sb.from("employments").select("join_date, positions(title)").eq("id", eid).single(),
      sb
        .from("employment_compensation")
        .select("amount, effective_from, pay_components!inner(code)")
        .eq("employment_id", eid)
        .eq("pay_components.code", "BASIC")
        .order("effective_from", { ascending: false })
        .limit(1),
    ]);
    const emp = must(e);
    return { ...must(c), join_date: emp.join_date, position: emp.positions?.title ?? "", basic: must(g)?.[0]?.amount ?? null };
  }, [cid, eid]);
  const [f, setF] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  if (!d.data) return d.error ? <ErrorBox message={d.error} /> : <Loading />;
  const v = f ?? {
    name: d.data.name,
    code: d.data.code,
    reg_no: d.data.reg_no ?? "",
    state: d.data.state,
    weekend: d.data.weekend_days.includes(5) ? "5,6" : "0,6",
    start: d.data.work_start.slice(0, 5),
    end: d.data.work_end.slice(0, 5),
    grace: String(d.data.late_grace_minutes),
    join: d.data.join_date,
    position: d.data.position,
    basic: d.data.basic == null ? "" : String(d.data.basic),
  };
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...v, [k]: e.target.value });

  async function simpan() {
    setRalat(null);
    if (!v.name.trim()) return setRalat(tr("Sila isi nama syarikat."));
    if (v.end <= v.start) return setRalat(tr("Waktu keluar mesti selepas waktu masuk."));
    const gaji = v.basic.trim() === "" ? null : Number(v.basic.replace(/,/g, ""));
    if (gaji != null && !(gaji > 0)) return setRalat(tr("Gaji pokok tidak sah."));
    if (!v.join) return setRalat(tr("Sila isi tarikh mula bekerja anda."));
    setBusy(true);
    try {
      const sb = getSupabase();
      if (v.code.trim().toUpperCase() !== d.data!.code) must(await sb.rpc("set_company_code", { p_company: cid, p_code: v.code }));
      must(
        await sb
          .from("companies")
          .update({
            name: v.name.trim().toUpperCase(),
            reg_no: v.reg_no.trim() || null,
            state: v.state,
            weekend_days: v.weekend.split(",").map(Number),
            work_start: v.start,
            work_end: v.end,
            late_grace_minutes: Number(v.grace) || 0,
          })
          .eq("id", cid),
      );
      // Maklumat pengasas sendiri (pendaftar ialah pekerja pertama syarikat)
      if (v.join !== d.data!.join_date) must(await sb.rpc("hr_set_join_date", { p_employment: eid, p_date: v.join }));
      const ubah: Record<string, string | number> = {};
      if (v.position.trim() !== d.data!.position) ubah.position = v.position.trim();
      if (gaji != null && gaji !== d.data!.basic) {
        ubah.basic = gaji;
        ubah.effective_from = v.join;
      }
      if (Object.keys(ubah).length) must(await sb.rpc("hr_update_employment", { p_employment: eid, p_data: ubah, p_via: "web" }));
      await selesaiLangkah(cid, "company");
      ctx.reload();
      router.push("/mula/import");
    } catch (e) {
      setRalat(e instanceof Error ? trRalat(e.message) : tr("Ralat"));
      setBusy(false);
    }
  }

  return (
    <MulaLayout
      n={2}
      title={tr("Maklumat syarikat")}
      back="/mula"
      footer={
        <ButangUtama onClick={simpan} busy={busy}>
          {tr("Simpan & seterusnya")}</ButangUtama>
      }
    >
      <MedanBorang label={tr("Nama syarikat")}>
        <input className={inputKecil} value={v.name} onChange={set("name")} />
      </MedanBorang>
      <div className="grid grid-cols-2 gap-2.5">
        <MedanBorang label={tr("Kod pendek")} nota={tr("Untuk no. pekerja & akses")}>
          <input className={`${inputKecil} uppercase`} value={v.code} onChange={set("code")} maxLength={8} />
        </MedanBorang>
        <MedanBorang label={tr("No. SSM")}>
          <input className={inputKecil} value={v.reg_no} onChange={set("reg_no")} placeholder="2020010xxxxx" />
        </MedanBorang>
      </div>
      <Seksyen className="pt-1">{tr("WAKTU KERJA")}</Seksyen>
      <MedanBorang label={tr("Negeri (untuk cuti umum)")}>
        <select className={inputKecil} value={v.state} onChange={set("state")}>
          {NEGERI.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </MedanBorang>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-bold text-[#4A5A57]">{tr("Hujung minggu")}</span>
        <div className="grid grid-cols-2 gap-2">
          {[
            ["0,6", tr("Sabtu & Ahad")],
            ["5,6", tr("Jumaat & Sabtu")],
          ].map(([k, l]) => (
            <button
              key={k}
              type="button"
              aria-pressed={v.weekend === k}
              onClick={() => setF({ ...v, weekend: k })}
              className={`h-11 rounded-[12px] text-sm font-bold ${v.weekend === k ? "border-[1.5px] border-primary bg-[#E3F1EE] text-primary" : "border border-[#D5DEDC] bg-surface"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        <MedanBorang label={tr("Masuk")}>
          <input type="time" className={inputKecil} value={v.start} onChange={set("start")} />
        </MedanBorang>
        <MedanBorang label={tr("Keluar")}>
          <input type="time" className={inputKecil} value={v.end} onChange={set("end")} />
        </MedanBorang>
        <MedanBorang label={tr("Lewat jika > (min)")}>
          <input className={inputKecil} inputMode="numeric" value={v.grace} onChange={set("grace")} />
        </MedanBorang>
      </div>
      <Seksyen className="pt-1">{tr("MAKLUMAT ANDA SEBAGAI PEKERJA")}</Seksyen>
      <span className="-mt-1 text-xs leading-snug text-muted">{tr("Anda juga direkodkan sebagai pekerja pertama syarikat ini. Maklumat ini digunakan untuk cuti, gaji dan KWSP anda.")}</span>
      <div className="grid grid-cols-2 gap-2.5">
        <MedanBorang label={tr("Tarikh mula bekerja")}>
          <input type="date" className={inputKecil} value={v.join} onChange={set("join")} />
        </MedanBorang>
        <MedanBorang label={tr("Jawatan")}>
          <input className={inputKecil} value={v.position} onChange={set("position")} placeholder={tr("cth. Pengarah Urusan")} />
        </MedanBorang>
      </div>
      <MedanBorang label={tr("Gaji pokok sebulan (RM)")} nota={tr("Pilihan. Boleh diisi kemudian dalam Penggajian.")}>
        <input className={inputKecil} inputMode="decimal" value={v.basic} onChange={set("basic")} placeholder="0.00" />
      </MedanBorang>
      {ralat && <ErrorBox message={ralat} />}
    </MulaLayout>
  );
}
