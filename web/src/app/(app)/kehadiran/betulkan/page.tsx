"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { getKehadiranBulan, hantarPembetulan, masaKeISO, SEBAB_PEMBETULAN } from "@/lib/kehadiran";
import { addDays, hariTarikh, jam, todayISO } from "@/lib/format";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { ButangUtama, Seksyen } from "@/components/Senarai";

const HARI_PENUH: Record<string, string> = { Isn: "ISNIN", Sel: "SELASA", Rab: "RABU", Kha: "KHAMIS", Jum: "JUMAAT", Sab: "SABTU", Ahd: "AHAD" };

// Rujukan reka bentuk: design/PembetulanMasa.dc.html
export default function BetulkanMasaPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Betulkan />
    </Suspense>
  );
}

function Betulkan() {
  const me = useMe();
  const emp = me.active!;
  const router = useRouter();
  const sp = useSearchParams();
  const today = todayISO();
  const [pilihTarikh, setPilihTarikh] = useState(sp.get("tarikh") ?? today);
  const tarikh = pilihTarikh > today ? today : pilihTarikh;
  const d = useData(async () => {
    const hari = await getKehadiranBulan(emp.id, tarikh.slice(0, 7));
    const wf = must(
      await getSupabase()
        .from("approval_workflows")
        .select("approval_workflow_steps(step_order, name, approver)")
        .eq("company_id", emp.companyId)
        .eq("request_type", "attendance_correction")
        .maybeSingle(),
    );
    return { rekod: hari.find((h) => h.date === tarikh) ?? null, steps: (wf?.approval_workflow_steps ?? []).sort((a, b) => a.step_order - b.step_order) };
  }, [emp.id, tarikh]);
  const [masuk, setMasuk] = useState<{ t: string; v: string } | null>(null);
  const [keluar, setKeluar] = useState<{ t: string; v: string } | null>(null);
  const [sebab, setSebab] = useState("lupa");
  const [ket, setKet] = useState("");
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);

  const r = d.data?.rekod;
  const lalaiMasuk = emp.workStart.slice(0, 5).replace(/^0/, "");
  const lalaiKeluar = emp.workEnd.slice(0, 5).replace(/^0/, "");
  const vMasuk = masuk?.t === tarikh ? masuk.v : r?.clockIn && !(r.late > 0) ? jam(r.clockIn) : lalaiMasuk;
  const vKeluar = keluar?.t === tarikh ? keluar.v : r?.clockOut ? jam(r.clockOut) : lalaiKeluar;
  const ketua = emp.departmentName ? `ketua jabatan ${emp.departmentName}` : "ketua jabatan";
  const pelulus = (d.data?.steps ?? []).map((s) => (s.approver === "dept_head" ? ketua : s.name)).join(", kemudian ") || ketua;
  const hd = hariTarikh(tarikh);

  async function hantar() {
    setRalat(null);
    const i = vMasuk ? masaKeISO(tarikh, vMasuk) : null;
    const o = vKeluar ? masaKeISO(tarikh, vKeluar) : null;
    if (vMasuk && !i) return setRalat("Masa masuk tidak sah (contoh: 8:55).");
    if (vKeluar && !o) return setRalat("Masa keluar tidak sah (contoh: 18:05).");
    const label = SEBAB_PEMBETULAN.find((s) => s.id === sebab)!.label;
    if (sebab === "lain" && !ket.trim()) return setRalat("Sila terangkan sebabnya.");
    setBusy(true);
    try {
      await hantarPembetulan(emp.id, tarikh, i, o, ket.trim() ? `${label}: ${ket.trim()}` : label);
      router.replace("/kehadiran");
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
      setBusy(false);
    }
  }

  return (
    <Screen>
      <BackHeader title="Betulkan masa" href="/kehadiran" />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-4">
        <label className="flex items-center gap-2 text-sm">
          <span className="font-bold text-[#4A5A57]">Tarikh</span>
          <input
            type="date"
            min={addDays(today, -31)}
            max={today}
            value={tarikh}
            onChange={(e) => setPilihTarikh(e.target.value)}
            className="h-10 rounded-[10px] border border-[#D5DEDC] bg-surface px-2.5 text-sm font-semibold"
          />
        </label>
        <Seksyen>
          REKOD MESIN · {HARI_PENUH[hd.slice(0, 3)] ?? ""}, {hd.slice(5).toUpperCase()}
        </Seksyen>
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data ? (
          <Loading />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-0.5 rounded-[14px] bg-surface px-3.5 py-3">
              <span className="text-xs text-muted">Masuk</span>
              <b className={`text-lg font-extrabold ${r?.late ? "text-warning" : ""}`}>{r?.clockIn ? jam(r.clockIn) : "Tiada"}</b>
            </div>
            <div className="flex flex-col gap-0.5 rounded-[14px] bg-surface px-3.5 py-3">
              <span className="text-xs text-muted">Keluar</span>
              <b className="text-lg font-extrabold">{r?.clockOut ? jam(r.clockOut) : "Tiada"}</b>
            </div>
          </div>
        )}

        <Seksyen className="pt-1">MASA SEBENAR</Seksyen>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 rounded-[14px] bg-surface px-3.5 py-2.5">
            <span className="text-xs text-muted">Masuk</span>
            <input value={vMasuk} onChange={(e) => setMasuk({ t: tarikh, v: e.target.value })} inputMode="numeric" placeholder="8:55" className="h-9 text-lg font-extrabold outline-none" />
          </label>
          <label className="flex flex-col gap-1 rounded-[14px] bg-surface px-3.5 py-2.5">
            <span className="text-xs text-muted">Keluar</span>
            <input value={vKeluar} onChange={(e) => setKeluar({ t: tarikh, v: e.target.value })} inputMode="numeric" placeholder="18:05" className="h-9 text-lg font-extrabold outline-none" />
          </label>
        </div>

        <Seksyen className="pt-1">SEBAB</Seksyen>
        <div className="grid grid-cols-2 gap-2">
          {SEBAB_PEMBETULAN.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={sebab === s.id}
              onClick={() => setSebab(s.id)}
              className={`h-[46px] rounded-[12px] px-2 text-[13px] font-bold ${sebab === s.id ? "border-[1.5px] border-primary bg-[#E3F1EE] text-primary" : "border border-[#D5DEDC] bg-surface"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-[#4A5A57]">Keterangan {sebab === "lain" ? "" : "(pilihan)"}</span>
          <input
            value={ket}
            onChange={(e) => setKet(e.target.value)}
            placeholder="Contoh: berjumpa pelanggan di KLIA terlebih dahulu"
            className="h-12 rounded-[12px] border border-[#D5DEDC] bg-surface px-3 text-sm outline-none focus:border-primary"
          />
        </label>
        <span className="rounded-[14px] bg-[#E3F1EE] px-4 py-3 text-[13px] leading-normal text-primary">
          Akan diluluskan oleh {pelulus} hari ini. Setelah diluluskan, rekod lewat akan dibatalkan.
        </span>
        {ralat && <ErrorBox message={ralat} />}
      </main>
      <div className="sticky bottom-0 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
        <ButangUtama onClick={hantar} busy={busy} disabled={r?.correction === "pending"}>
          {r?.correction === "pending" ? "Sedang menunggu kelulusan" : "Hantar permohonan"}
        </ButangUtama>
      </div>
    </Screen>
  );
}
