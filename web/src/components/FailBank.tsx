"use client";

import { tr } from "@/lib/i18n";
import { useState } from "react";
import { useData } from "@/lib/useData";
import {
  binaFail,
  getBarisBayaran,
  getFormatSyarikat,
  LABEL_MEDAN,
  muatTurunFail,
  nilaiSel,
  PRATETAP,
  semakBaris,
  simpanFormatSyarikat,
  type FormatBank,
  type LajurBank,
  type MedanBank,
} from "@/lib/failBank";
import { ErrorBox, Loading } from "./ui";
import { Lembaran } from "./Senarai";
import { beritahu } from "./Dialog";

const pilih = "h-11 rounded-[12px] border border-line bg-surface px-3 text-sm";

/**
 * Fail bayaran gaji mengikut format bank: pilih pratetap (Maybank2u Biz, CIMB BizConverter, …),
 * susun lajur supaya sepadan dengan templat bank syarikat, pratonton, muat turun dan simpan sebagai format syarikat.
 */
export function FailBank({ runId, companyId, companyCode, tarikhAwal, onClose }: { runId: string; companyId: string; companyCode: string; tarikhAwal: string; onClose: () => void }) {
  const d = useData(async () => {
    const [bayaran, simpan] = await Promise.all([getBarisBayaran(runId), getFormatSyarikat(companyId).catch(() => null)]);
    return { bayaran, simpan };
  }, [runId, companyId]);
  const [f, setF] = useState<FormatBank | null>(null);
  const [tarikh, setTarikh] = useState(tarikhAwal);
  const [ubah, setUbah] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);

  const format = f ?? d.data?.simpan ?? PRATETAP[0];
  const b = d.data?.bayaran;
  const isu = b ? semakBaris(format, b.rows) : [];
  const tempoh = b ? `${String(b.period_month).padStart(2, "0")}/${b.period_year}` : "";
  const set = (p: Partial<FormatBank>) => setF({ ...format, ...p });
  const setLajur = (i: number, p: Partial<LajurBank>) => set({ columns: format.columns.map((c, j) => (j === i ? { ...c, ...p } : c)) });
  const alih = (i: number, k: number) => {
    const c = [...format.columns];
    const [x] = c.splice(i, 1);
    c.splice(i + k, 0, x);
    set({ columns: c });
  };

  async function muatTurun() {
    if (!b) return;
    setRalat(null);
    setBusy(true);
    try {
      muatTurunFail(tr("gaji-{0}-{1}{2}-{3}.{4}", companyCode, b.period_year, String(b.period_month).padStart(2, "0"), format.id, format.sambungan), binaFail(format, b, tarikh), format.sambungan);
      // Format yang digunakan diingati untuk bulan seterusnya
      await simpanFormatSyarikat(companyId, format);
      beritahu(tr("Fail bank dimuat turun. Format disimpan untuk bulan seterusnya."));
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Lembaran title={tr("Fail bayaran bank")} onClose={onClose}>
      {d.error && <ErrorBox message={d.error} />}
      {d.loading && !d.data && <Loading />}
      {b && (
        <>
          <label className="flex flex-col gap-1.5 text-sm font-bold">
            {tr("Format bank")}
            <select
              className={pilih}
              value={format.id}
              onChange={(e) => {
                const p = PRATETAP.find((x) => x.id === e.target.value);
                if (p) setF(p);
                else if (d.data?.simpan) setF(d.data.simpan);
              }}
            >
              {d.data?.simpan && !PRATETAP.some((x) => x.id === d.data!.simpan!.id) && <option value={d.data.simpan.id}>{d.data.simpan.nama}</option>}
              {PRATETAP.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nama}
                </option>
              ))}
            </select>
          </label>
          {format.nota && <span className="rounded-[12px] bg-page px-3 py-2 text-xs leading-normal text-subtle">{format.nota}</span>}
          <label className="flex flex-col gap-1.5 text-sm font-bold">
            {tr("Tarikh bayaran (kredit)")}
            <input type="date" className={pilih} value={tarikh} onChange={(e) => e.target.value && setTarikh(e.target.value)} />
          </label>

          <button type="button" onClick={() => setUbah(!ubah)} className="flex min-h-11 items-center self-start text-sm font-bold text-primary">
            {ubah ? tr("Tutup susunan lajur") : tr("Susun lajur ikut templat bank ›")}</button>
          {ubah && (
            <div className="flex flex-col gap-2 rounded-[14px] bg-page p-3">
              <span className="text-xs text-subtle">
                {tr("Muat turun templat terkini daripada portal bank anda, kemudian susun lajur di bawah supaya sama (tajuk, susunan dan format). Susunan disimpan untuk syarikat anda.")}</span>
              {format.columns.map((c, i) => (
                <div key={i} className="flex flex-wrap items-center gap-1.5 rounded-[12px] bg-surface p-2">
                  <span className="w-5 text-center text-xs font-bold text-muted">{i + 1}</span>
                  <input aria-label={tr("Tajuk lajur {0}", i + 1)} value={c.tajuk} onChange={(e) => setLajur(i, { tajuk: e.target.value })} className="h-10 min-w-0 grow basis-32 rounded-[10px] border border-line px-2.5 text-sm" />
                  <select aria-label={tr("Isi lajur {0}", i + 1)} value={c.medan} onChange={(e) => setLajur(i, { medan: e.target.value as MedanBank })} className="h-10 min-w-0 grow basis-40 rounded-[10px] border border-line px-2 text-sm">
                    {(Object.keys(LABEL_MEDAN) as MedanBank[]).map((k) => (
                      <option key={k} value={k}>
                        {LABEL_MEDAN[k]}
                      </option>
                    ))}
                  </select>
                  {["tetap", "jenis_id", "rujukan", "keterangan"].includes(c.medan) && (
                    <input
                      aria-label={tr("Nilai lajur {0}", i + 1)}
                      placeholder={c.medan === "jenis_id" ? "NRIC" : c.medan === "tetap" ? "" : "GAJI {tempoh}"}
                      value={c.nilai ?? ""}
                      onChange={(e) => setLajur(i, { nilai: e.target.value })}
                      className="h-10 w-36 rounded-[10px] border border-line px-2.5 text-sm"
                    />
                  )}
                  <span className="flex">
                    <button type="button" aria-label={tr("Naik")} disabled={i === 0} onClick={() => alih(i, -1)} className="size-10 rounded-[10px] text-lg disabled:opacity-30">
                      ↑
                    </button>
                    <button type="button" aria-label={tr("Turun")} disabled={i === format.columns.length - 1} onClick={() => alih(i, 1)} className="size-10 rounded-[10px] text-lg disabled:opacity-30">
                      ↓
                    </button>
                    <button type="button" aria-label={tr("Buang lajur {0}", i + 1)} onClick={() => set({ columns: format.columns.filter((_, j) => j !== i) })} className="size-10 rounded-[10px] text-lg text-danger">
                      ×
                    </button>
                  </span>
                </div>
              ))}
              <button type="button" onClick={() => set({ columns: [...format.columns, { medan: "tetap", tajuk: tr("Lajur baharu") }] })} className="flex min-h-11 items-center self-start text-sm font-bold text-primary">
                {tr("+ Tambah lajur")}</button>
              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                <label className="flex flex-col gap-1">
                  {tr("Pemisah")}
                  <select value={format.pemisah} onChange={(e) => set({ pemisah: e.target.value as FormatBank["pemisah"] })} className={pilih}>
                    <option value=",">{tr("Koma ( , )")}</option>
                    <option value=";">{tr("Koma bertitik ( ; )")}</option>
                    <option value="|">{tr("Garis tegak ( | )")}</option>
                    <option value={"\t"}>{tr("Tab")}</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  {tr("Format tarikh")}
                  <select value={format.tarikh} onChange={(e) => set({ tarikh: e.target.value as FormatBank["tarikh"] })} className={pilih}>
                    {["DD/MM/YYYY", "DD-MM-YYYY", "YYYYMMDD", "YYYY-MM-DD"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  {tr("Format amaun")}
                  <select value={format.amaun} onChange={(e) => set({ amaun: e.target.value as FormatBank["amaun"] })} className={pilih}>
                    <option value="titik">1234.56</option>
                    <option value="koma_ribu">1,234.56</option>
                    <option value="sen">{tr("123456 (sen)")}</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  {tr("Jenis fail")}
                  <select value={format.sambungan} onChange={(e) => set({ sambungan: e.target.value as FormatBank["sambungan"] })} className={pilih}>
                    <option value="csv">CSV</option>
                    <option value="txt">TXT</option>
                  </select>
                </label>
              </div>
              {(
                [
                  ["kepala", tr("Baris tajuk di atas")],
                  ["hurufBesar", tr("Nama & rujukan HURUF BESAR")],
                  ["buangSimbol", tr("Buang simbol khas (* ! @ # $ ( ) …)")],
                  ["kpTanpaSengkang", tr("No. kad pengenalan tanpa sengkang")],
                ] as [keyof FormatBank, string][]
              ).map(([k, l]) => (
                <label key={k} className="flex min-h-10 items-center gap-2.5 text-sm">
                  <input type="checkbox" checked={!!format[k]} onChange={(e) => set({ [k]: e.target.checked } as Partial<FormatBank>)} className="size-5 accent-primary" />
                  {l}
                </label>
              ))}
            </div>
          )}

          {isu.length > 0 && (
            <div className="flex flex-col gap-1 rounded-[12px] bg-warning-soft px-3 py-2 text-xs text-warning">
              <b>{tr("Semak sebelum muat naik ({0})", isu.length)}</b>
              {isu.slice(0, 6).map((x, i) => (
                <span key={i}>
                  {x.nama}: {x.isu}
                </span>
              ))}
              {isu.length > 6 && <span>{tr("dan {0} lagi", isu.length - 6)}</span>}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <b className="text-xs text-muted">{tr("PRATONTON ({0} pekerja · RM {1})", b.rows.length, b.rows.reduce((t, x) => t + x.net, 0).toLocaleString("en-MY", { minimumFractionDigits: 2 }))}</b>
            <div className="overflow-x-auto rounded-[12px] border border-line-soft">
              <table className="w-full border-collapse text-xs whitespace-nowrap">
                {format.kepala && (
                  <thead>
                    <tr className="bg-page text-left">
                      {format.columns.map((c, i) => (
                        <th key={i} className="px-2 py-1.5 font-bold">
                          {c.tajuk}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {b.rows.slice(0, 3).map((r) => (
                    <tr key={r.person_id} className="border-t border-line-soft">
                      {format.columns.map((c, i) => (
                        <td key={i} className="px-2 py-1.5 tabular-nums">
                          {nilaiSel(c, r, format, { tarikh, tempoh })}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {ralat && <ErrorBox message={ralat} />}
          <button type="button" disabled={busy || !b.rows.length} onClick={muatTurun} className="flex h-12 items-center justify-center rounded-button bg-primary text-base font-extrabold text-white disabled:opacity-50">
            {tr("Muat turun fail {0}", format.sambungan.toUpperCase())}</button>
          <span className="text-center text-xs text-muted">{tr("Setiap muat turun direkodkan. Semak fail pertama dengan templat bank sebelum dimuat naik.")}</span>
        </>
      )}
    </Lembaran>
  );
}
