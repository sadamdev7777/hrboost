"use client";

import { tr } from "@/lib/i18n";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { ImportPukal } from "@/components/ImportPukal";
import { importBakiCuti } from "@/lib/berkanun";
import { getSenaraiPekerja } from "@/lib/hr";
import { ButangUtama, HadPeranan, Lembaran, MedanBorang, Seksyen, Suis, Tag, inputKecil, inputSempit, GrupLajur } from "@/components/Senarai";

const WAJIB = ["AL", "MC", "HL", "ML", "PL"];
const NAMA: Record<string, string> = { AL: tr("Tahunan"), MC: tr("Sakit (MC)"), HL: tr("Kemasukan hospital"), ML: tr("Bersalin"), PL: tr("Paterniti") };
const PILIHAN = [
  { code: "EL", name: tr("Cuti Kecemasan"), label: tr("Kecemasan"), sub: tr("Tidak menolak baki · boleh dimohon selepas"), deduct: false, paid: true, days: null as number | null },
  { code: "UL", name: tr("Cuti Tanpa Gaji"), label: tr("Tanpa gaji"), sub: tr("Gaji dipotong mengikut hari"), deduct: false, paid: false, days: null },
  { code: "KW", name: tr("Cuti Kahwin"), label: tr("Cuti kahwin"), sub: tr("3 hari · sekali sepanjang perkhidmatan"), deduct: true, paid: true, days: 3 },
  { code: "HJ", name: tr("Cuti Haji / Umrah"), label: tr("Cuti haji / umrah"), sub: tr("Bilangan hari ditetapkan syarikat · sekali sepanjang perkhidmatan"), deduct: true, paid: true, days: null },
];
type Rule = { id: string; min_service_months: number; max_service_months: number | null; days_per_year: number };
type Jenis = { id: string; code: string; name: string; active: boolean; max_carry_forward: number; requires_attachment: boolean; leave_entitlement_rules: Rule[] };

// Rujukan reka bentuk: design/T_JenisCuti.dc.html
export default function JenisCutiPage() {
  return (
    <HadPeranan roles={["hr", "admin"]} back="/pengurusan/tetapan">
      <JenisCuti />
    </HadPeranan>
  );
}

function JenisCuti() {
  const me = useMe();
  const cid = me.active!.companyId;
  const d = useData(
    async () =>
      (must(
        await getSupabase()
          .from("leave_types")
          .select("id, code, name, active, max_carry_forward, requires_attachment, leave_entitlement_rules(id, min_service_months, max_service_months, days_per_year)")
          .eq("company_id", cid)
          .order("sort_order"),
      ) ?? []) as Jenis[],
    [cid],
  );
  const [ubah, setUbah] = useState<Jenis | null>(null);
  const [imp, setImp] = useState(false);
  const [templat, setTemplat] = useState("");
  const tahun = new Date().getFullYear();
  async function bukaImport() {
    const ppl = await getSenaraiPekerja(cid).catch(() => []);
    setTemplat([tr("No. pekerja,Kod cuti,Dibawa dari tahun lepas,Telah diambil"), ...ppl.map((p) => tr("{0},AL,0,0", p.employeeNo))].join("\n"));
    setImp(true);
  }
  const [haji, setHaji] = useState<string>("");
  const [ralat, setRalat] = useState<string | null>(null);
  const jenis = d.data ?? [];
  const al = jenis.find((j) => j.code === "AL");

  const ringkas = (j: Jenis) => {
    const r = [...j.leave_entitlement_rules].sort((a, b) => a.min_service_months - b.min_service_months);
    const hari = r.map((x) => Number(x.days_per_year)).join(" / ");
    return r.length > 1 ? tr("{0} hari mengikut tempoh perkhidmatan", hari) : tr("{0} hari{1}", hari, j.code === "HL" ? " setahun" : "");
  };

  async function togol(p: (typeof PILIHAN)[number], on: boolean) {
    setRalat(null);
    const sb = getSupabase();
    try {
      const ada = jenis.find((j) => j.code === p.code);
      if (ada) {
        must(await sb.from("leave_types").update({ active: on }).eq("id", ada.id));
      } else if (on) {
        const hari = p.code === "HJ" ? Number(haji) : p.days;
        if (p.code === "HJ" && !(hari && hari > 0)) {
          setRalat(tr("Sila isi bilangan hari cuti haji / umrah dahulu."));
          return;
        }
        const t = must(
          await sb
            .from("leave_types")
            .insert({ company_id: cid, code: p.code, name: p.name, deduct_balance: p.deduct, is_paid: p.paid, sort_order: 10 + PILIHAN.indexOf(p) })
            .select("id")
            .single(),
        );
        if (hari) must(await sb.from("leave_entitlement_rules").insert({ leave_type_id: t.id, days_per_year: hari }));
      }
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
  }

  async function bawa(v: string) {
    if (!al) return;
    const n = Number(v);
    if (!(n >= 0 && n <= 30)) return;
    try {
      must(await getSupabase().from("leave_types").update({ max_carry_forward: n }).eq("id", al.id));
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
  }

  return (
    <Screen lebar="lebar">
      <BackHeader title={tr("Jenis cuti")} href="/pengurusan/tetapan" />
      <main className="flex grow flex-col gap-2.5 px-4 pt-1 pb-6">
        <GrupLajur>
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data && <Loading />}
        <Seksyen>{tr("MENGIKUT AKTA KERJA · MINIMUM")}</Seksyen>
        <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
          {WAJIB.map((c) => jenis.find((j) => j.code === c))
            .filter(Boolean)
            .map((j) => (
              <button key={j!.id} type="button" onClick={() => setUbah(j!)} className="flex min-h-12 items-center gap-2 py-2 text-left">
                <span className="flex grow flex-col gap-0.5">
                  <b className="text-sm font-bold">{NAMA[j!.code]}</b>
                  <span className="text-xs text-muted">
                    {ringkas(j!)}
                    {j!.requires_attachment ? tr(" · perlu sijil") : ""}
                  </span>
                </span>
                <Tag tone="primary">{tr("Wajib")}</Tag>
              </button>
            ))}
        </div>

        <Seksyen className="pt-1">{tr("PILIHAN SYARIKAT")}</Seksyen>
        <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
          {PILIHAN.map((p) => {
            const j = jenis.find((x) => x.code === p.code);
            const on = !!j?.active;
            return (
              <div key={p.code} className="flex min-h-12 items-center gap-2 py-2">
                <span className="flex grow flex-col gap-0.5">
                  <b className="text-sm font-bold">{tr(p.label)}</b>
                  <span className="text-xs text-muted">{j && j.leave_entitlement_rules.length ? tr("{0} · sekali sepanjang perkhidmatan", ringkas(j)) : p.sub}</span>
                  {p.code === "HJ" && !j && (
                    <input className={`${inputSempit} mt-1 h-9 w-32`} inputMode="numeric" placeholder={tr("Bilangan hari")} value={haji} onChange={(e) => setHaji(e.target.value.replace(/\D/g, ""))} aria-label={tr("Bilangan hari cuti haji")} />
                  )}
                </span>
                <Suis on={on} label={`${on ? tr("Matikan") : tr("Hidupkan")} ${tr(p.label)}`} onChange={(v) => togol(p, v)} />
              </div>
            );
          })}
        </div>

        {al && (
          <div className="flex items-center gap-2 rounded-card bg-surface px-4 py-3">
            <span className="flex grow flex-col gap-0.5">
              <b className="text-sm font-bold">{tr("Bawa ke tahun hadapan")}</b>
              <span className="text-xs text-muted">{tr("Baki cuti tahunan")}</span>
            </span>
            <label className="flex items-center gap-1.5 text-sm font-bold">
              maks
              <input className={`${inputSempit} w-16 text-center`} inputMode="numeric" defaultValue={Number(al.max_carry_forward)} onBlur={(e) => bawa(e.target.value)} aria-label={tr("Maksimum hari dibawa ke hadapan")} />
              hari
            </label>
          </div>
        )}
        {ralat && <ErrorBox message={ralat} />}
        <span className="text-xs text-muted">{tr("Kelayakan syarikat boleh lebih tinggi daripada minimum, tetapi tidak boleh kurang.")}</span>
        <button type="button" onClick={bukaImport} className="flex min-h-12 items-center justify-between gap-2 rounded-card bg-surface px-4 py-3 text-left">
          <span className="flex flex-col gap-0.5">
            <b className="text-sm font-bold">{tr("Import baki cuti awal (Excel)")}</b>
            <span className="text-xs text-muted">{tr("Baki dibawa dan cuti yang telah diambil sebelum menggunakan HRBoost, tahun {0}", tahun)}</span>
          </span>
          <span className="text-[13px] font-bold text-primary">{tr("Import")}</span>
        </button>
        </GrupLajur>
      </main>
      {imp && (
        <ImportPukal
          tajuk={tr("Import baki cuti awal {0}", tahun)}
          huraian={tr("Kod cuti: {0}. \"Dibawa\" ditambah kepada kelayakan; \"Telah diambil\" ditolak daripada baki. Cuti yang dimohon melalui HRBoost tidak perlu dimasukkan.", jenis.map((j) => j.code).join(", "))}
          lajur={[
            { k: "employee_no", label: tr("No. pekerja"), alias: /^(nopekerja|nopek|employeeno|empno|staffno|no)$/, wajib: true },
            { k: "leave_code", label: tr("Kod cuti"), alias: /^(kodcuti|kod|leavecode|code|jeniscuti)$/, wajib: true },
            { k: "carried_forward", label: tr("Dibawa"), alias: /^(dibawa|bawa|carriedforward|cf)/, jenis: "nombor" },
            { k: "taken", label: tr("Telah diambil"), alias: /^(telahdiambil|diambil|taken|used)/, jenis: "nombor" },
          ]}
          templat={templat}
          namaTemplat={tr("baki-cuti-{0}.csv", tahun)}
          hantar={(b) => importBakiCuti(cid, tahun, b.map((x) => ({ employee_no: x.employee_no, leave_code: x.leave_code, carried_forward: x.carried_forward, taken: x.taken })))}
          onClose={() => setImp(false)}
          onDone={() => d.reload()}
        />
      )}
      {ubah && (
        <UbahKelayakan
          j={ubah}
          onClose={() => setUbah(null)}
          onDone={() => {
            setUbah(null);
            d.reload();
          }}
        />
      )}
    </Screen>
  );
}

function tempoh(r: Rule) {
  const a = r.min_service_months / 12;
  if (r.max_service_months == null) return r.min_service_months ? tr("{0} tahun ke atas", a) : tr("Semua pekerja");
  return tr("{0} – {1} tahun", a, r.max_service_months / 12);
}

function UbahKelayakan({ j, onClose, onDone }: { j: Jenis; onClose: () => void; onDone: () => void }) {
  const rules = [...j.leave_entitlement_rules].sort((a, b) => a.min_service_months - b.min_service_months);
  const [nilai, setNilai] = useState<Record<string, string>>(Object.fromEntries(rules.map((r) => [r.id, String(Number(r.days_per_year))])));
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  async function simpan() {
    setBusy(true);
    setRalat(null);
    try {
      for (const r of rules) {
        const v = Number(nilai[r.id]);
        if (v !== Number(r.days_per_year)) must(await getSupabase().from("leave_entitlement_rules").update({ days_per_year: v }).eq("id", r.id));
      }
      onDone();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
      setBusy(false);
    }
  }
  return (
    <Lembaran title={tr("Kelayakan {0}", NAMA[j.code] ?? j.name)} onClose={onClose}>
      {rules.map((r) => (
        <MedanBorang key={r.id} label={tr("{0} (hari setahun)", tempoh(r))}>
          <input className={inputKecil} inputMode="decimal" value={nilai[r.id]} onChange={(e) => setNilai({ ...nilai, [r.id]: e.target.value.replace(/[^\d.]/g, "") })} />
        </MedanBorang>
      ))}
      <span className="text-xs text-muted">{tr("Nilai di bawah minimum Akta Kerja akan ditolak.")}</span>
      {ralat && <ErrorBox message={ralat} />}
      <ButangUtama onClick={simpan} busy={busy}>
        {tr("Simpan")}</ButangUtama>
    </Lembaran>
  );
}
