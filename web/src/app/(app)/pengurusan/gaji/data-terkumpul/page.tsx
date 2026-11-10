"use client";

import { tr } from "@/lib/i18n";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { BULAN_PENUH } from "@/lib/gaji";
import { todayISO } from "@/lib/format";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { HadPeranan, inputKecil } from "@/components/Senarai";
import { nilaiInput } from "@/components/GajiPekerja";
import { ImportPukal } from "@/components/ImportPukal";
import type { HasilImport } from "@/lib/berkanun";

type Baris = {
  employment_id: string;
  name: string;
  employee_no: string;
  join_date: string;
  up_to_month: number | null;
  gross: number | null;
  epf: number | null;
  pcb: number | null;
  payroll_months: number;
};
type Nilai = { bulan: string; gross: string; epf: string; pcb: string };

/** Data gaji terkumpul tahun ini daripada sistem lama — diisi sekali gus untuk semua pekerja (PCB tepat). */
export default function DataTerkumpulPage() {
  return (
    <HadPeranan roles={["hr", "finance", "admin"]} back="/pengurusan/gaji">
      <DataTerkumpul />
    </HadPeranan>
  );
}

function DataTerkumpul() {
  const me = useMe();
  const cid = me.active!.companyId;
  const tahun = Number(todayISO().slice(0, 4));
  const bulanLalu = Math.max(Number(todayISO().slice(5, 7)) - 1, 1);
  const d = useData(async () => (must(await getSupabase().rpc("hr_opening_balances", { p_company: cid, p_year: tahun })) ?? []) as Baris[], [cid, tahun]);
  const [nilai, setNilai] = useState<Record<string, Nilai>>({});
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string[]>([]);
  const [ok, setOk] = useState<string | null>(null);
  const [imp, setImp] = useState(false);

  /** Import Excel/CSV: No. pekerja, Hingga bulan (1–11), Gaji kasar, KWSP pekerja, PCB. */
  async function importBaris(b: Record<string, string>[]): Promise<HasilImport[]> {
    const out: HasilImport[] = [];
    for (const x of b) {
      const r = (d.data ?? []).find((y) => y.employee_no.trim().toLowerCase() === (x.employee_no ?? "").trim().toLowerCase());
      if (!r) {
        out.push({ employee_no: x.employee_no, ok: false, message: tr("No. pekerja tidak dijumpai") });
        continue;
      }
      const bulan = Number(x.up_to_month || bulanLalu);
      const g = nilaiInput(x.gross ?? "");
      const e = nilaiInput(x.epf ?? "");
      const p = nilaiInput(x.pcb ?? "");
      if (!(bulan >= 1 && bulan <= 11) || g === null || e === null || p === null) {
        out.push({ employee_no: x.employee_no, ok: false, message: tr("Amaun atau bulan tidak sah") });
        continue;
      }
      const { error } = await getSupabase().rpc("set_payroll_opening", { p_employment: r.employment_id, p_year: tahun, p_up_to_month: bulan, p_gross: g, p_epf: e, p_pcb: p });
      out.push({ employee_no: x.employee_no, ok: !error, message: error ? error.message : tr("Disimpan") });
    }
    return out;
  }

  const awal = (r: Baris): Nilai => ({
    bulan: String(r.up_to_month ?? bulanLalu),
    gross: r.gross != null ? String(r.gross) : "",
    epf: r.epf != null ? String(r.epf) : "",
    pcb: r.pcb != null ? String(r.pcb) : "",
  });
  const v = (r: Baris) => nilai[r.employment_id] ?? awal(r);
  const ubah = (r: Baris, k: keyof Nilai, x: string) => setNilai((s) => ({ ...s, [r.employment_id]: { ...v(r), [k]: k === "bulan" ? x : x.replace(/[^\d.,]/g, "") } }));

  async function simpan() {
    setRalat([]);
    setOk(null);
    const kerja = (d.data ?? []).filter((r) => nilai[r.employment_id] && JSON.stringify(nilai[r.employment_id]) !== JSON.stringify(awal(r)));
    if (!kerja.length) return setRalat([tr("Tiada perubahan untuk disimpan.")]);
    setBusy(true);
    const gagal: string[] = [];
    for (const r of kerja) {
      const x = v(r);
      const g = nilaiInput(x.gross);
      const e = nilaiInput(x.epf);
      const p = nilaiInput(x.pcb);
      if (g === null || e === null || p === null) {
        gagal.push(`${r.name}: amaun tidak sah.`);
        continue;
      }
      const { error } = await getSupabase().rpc("set_payroll_opening", {
        p_employment: r.employment_id,
        p_year: tahun,
        p_up_to_month: Number(x.bulan),
        p_gross: g,
        p_epf: e,
        p_pcb: p,
      });
      if (error) gagal.push(`${r.name}: ${error.message}`);
    }
    setBusy(false);
    if (gagal.length) setRalat(gagal);
    else setOk(tr("{0} pekerja disimpan.", kerja.length));
    setNilai({});
    d.reload();
  }

  return (
    <Screen>
      <BackHeader
        title={tr("Data gaji terkumpul {0}", tahun)}
        href="/pengurusan/gaji"
        action={
          <button type="button" onClick={() => setImp(true)} className="mr-1 flex min-h-11 items-center px-2 text-[13px] font-bold whitespace-nowrap text-primary">
            {tr("Import Excel")}</button>
        }
      />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-6 lg:px-0">
        <span className="text-sm leading-normal text-subtle">
          {tr("Jika syarikat mula menggunakan HRBoost pada pertengahan tahun, isi jumlah gaji kasar, KWSP pekerja dan PCB yang telah dibayar dalam sistem lama sejak Januari. Ini diperlukan supaya PCB dikira dengan tepat (kaedah berkomputer LHDN). Gunakan angka daripada slip gaji / borang CP39 terdahulu.")}</span>
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data && <Loading />}
        {d.data && (
          <div className="overflow-x-auto rounded-card bg-surface">
            <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#EEF2F1] text-[11px] font-bold tracking-[0.03em] text-muted">
                  <th className="px-4 py-3">{tr("PEKERJA")}</th>
                  <th className="px-2 py-3">{tr("HINGGA BULAN")}</th>
                  <th className="px-2 py-3 text-right">{tr("GAJI KASAR (RM)")}</th>
                  <th className="px-2 py-3 text-right">{tr("KWSP PEKERJA (RM)")}</th>
                  <th className="px-2 py-3 text-right">{tr("PCB (RM)")}</th>
                </tr>
              </thead>
              <tbody>
                {d.data.map((r) => {
                  const x = v(r);
                  return (
                    <tr key={r.employment_id} className="border-b border-[#EEF2F1] last:border-0">
                      <td className="px-4 py-2">
                        <span className="flex flex-col">
                          <b className="text-sm">{r.name}</b>
                          <span className="text-[11px] text-muted">
                            {r.employee_no}
                            {r.payroll_months ? tr(" · {0} bulan dalam HRBoost", r.payroll_months) : ""}
                            {r.up_to_month == null ? tr(" · belum diisi") : ""}
                          </span>
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <select aria-label={tr("Hingga bulan {0}", r.name)} className={`${inputKecil} w-36!`} value={x.bulan} onChange={(e) => ubah(r, "bulan", e.target.value)}>
                          {BULAN_PENUH.slice(0, 11).map((b, i) => (
                            <option key={b} value={i + 1}>
                              {tr("Jan – {0}", b.slice(0, 3))}</option>
                          ))}
                        </select>
                      </td>
                      {(["gross", "epf", "pcb"] as const).map((k) => (
                        <td key={k} className="px-2 py-2 text-right">
                          <input
                            aria-label={`${k} ${r.name}`}
                            inputMode="decimal"
                            placeholder="0.00"
                            value={x[k]}
                            onChange={(e) => ubah(r, k, e.target.value)}
                            className="h-10 w-32 rounded-[10px] border border-line bg-surface px-2.5 text-right tabular-nums outline-none focus:border-primary"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {ralat.length > 0 && (
          <div role="alert" className="flex flex-col gap-1 rounded-[14px] bg-danger-soft px-4 py-3 text-[13px] text-danger">
            {ralat.map((x) => (
              <span key={x}>{x}</span>
            ))}
          </div>
        )}
        {ok && <span className="rounded-[14px] bg-success-soft px-4 py-3 text-[13px] font-semibold text-success">{ok}</span>}
      </main>
      <div className="bar-bawah sticky bottom-0 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
        <button type="button" onClick={simpan} disabled={busy} className="flex h-12 w-full items-center justify-center rounded-button bg-primary text-base font-extrabold text-white disabled:opacity-60">
          {busy ? tr("Menyimpan…") : tr("Simpan semua")}
        </button>
      </div>
      {imp && (
        <ImportPukal
          tajuk={tr("Import data gaji terkumpul")}
          huraian={tr("Isi semua pekerja sekali gus daripada sistem lama. Lajur: No. pekerja, Hingga bulan (1–11), Gaji kasar, KWSP pekerja dan PCB (jumlah sejak Januari).")}
          lajur={[
            { k: "employee_no", label: tr("No. pekerja"), alias: /^(nopekerja|nopek|employeeno|empno|staffno|no)$/, wajib: true },
            { k: "up_to_month", label: tr("Hingga bulan"), alias: /^(hinggabulan|bulan|month|uptomonth)/, jenis: "nombor" },
            { k: "gross", label: tr("Gaji kasar"), alias: /^(gajikasar|gross|kasar)/, wajib: true, jenis: "nombor" },
            { k: "epf", label: tr("KWSP pekerja"), alias: /^(kwsp|epf)/, wajib: true, jenis: "nombor" },
            { k: "pcb", label: tr("PCB"), alias: /^(pcb|mtd|cukai)/, wajib: true, jenis: "nombor" },
          ]}
          templat={[tr("No. pekerja,Hingga bulan,Gaji kasar,KWSP pekerja,PCB"), ...(d.data ?? []).map((r) => `${r.employee_no},${r.up_to_month ?? bulanLalu},${r.gross ?? ""},${r.epf ?? ""},${r.pcb ?? ""}`)].join("\n")}
          namaTemplat={tr("data-gaji-terkumpul-{0}.csv", tahun)}
          hantar={importBaris}
          onClose={() => setImp(false)}
          onDone={() => d.reload()}
        />
      )}
    </Screen>
  );
}
