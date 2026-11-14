"use client";

import { teksKepentingan } from "@/components/PemberatKpi";
import { tr, trRalat } from "@/lib/i18n";
import { useState } from "react";
import { tarikh } from "@/lib/format";
import { beratSama, HURAIAN_SKALA, markahTeks, SKALA_PRESTASI, simpanKendiri, type ItemKpi } from "@/lib/prestasi";
import { beritahu, sahkan } from "./Dialog";
import { ErrorBox } from "./ui";
import { ButangUtama } from "./Senarai";

type Props = {
  id?: string; // penilaian (tiada dalam pratonton)
  kitaran: string;
  tarikhAkhir: string | null;
  pelulus: string | null;
  items: ItemKpi[];
  ulasanAwal?: string | null;
  /** Pratonton HR: tiada apa-apa disimpan */
  pratonton?: boolean;
  onSelesai: () => void;
};

/**
 * Penilaian kendiri "satu KPI satu skrin": pengenalan → setiap KPI (markah 1–5 berhuraian, bukti pilihan)
 * → semak & hantar. Jawapan disimpan secara senyap setiap kali pekerja menekan Seterusnya.
 */
export function PenilaianWizard({ id, kitaran, tarikhAkhir, pelulus, items: awal, ulasanAwal, pratonton, onSelesai }: Props) {
  const [items, setItems] = useState<ItemKpi[]>(awal);
  // Sambung semula: KPI pertama yang belum bermarkah; jika semua sudah, terus ke skrin semak
  const pertamaKosong = awal.findIndex((x) => x.self_score == null);
  const adaJawapan = awal.some((x) => x.self_score != null);
  const [langkah, setLangkah] = useState<number>(adaJawapan ? (pertamaKosong === -1 ? awal.length : pertamaKosong) : -1);
  const [buka, setBuka] = useState<Record<number, boolean>>({});
  const [ulasan, setUlasan] = useState(ulasanAwal ?? "");
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const n = items.length;
  const samaBerat = beratSama(items);
  const minit = Math.max(2, Math.ceil(n * 1.5));
  const markah = () => items.map((x) => ({ id: x.id!, score: x.self_score ?? null, note: x.self_note ?? null }));
  const purata = (() => {
    const ada = items.filter((x) => x.self_score != null);
    const b = ada.reduce((a, x) => a + x.weight, 0);
    return b ? ada.reduce((a, x) => a + (x.self_score as number) * x.weight, 0) / b : null;
  })();

  async function simpan(hantar: boolean) {
    if (pratonton || !id) return;
    await simpanKendiri(id, markah(), ulasan, hantar);
  }
  async function pergi(ke: number) {
    setRalat(null);
    if (!pratonton && langkah >= 0 && langkah < n) {
      setBusy(true);
      try {
        await simpan(false);
      } catch (e) {
        setRalat(e instanceof Error ? trRalat(e.message) : tr("Ralat"));
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    setLangkah(ke);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }
  async function hantar() {
    if (pratonton) return onSelesai();
    if (items.some((x) => x.self_score == null)) return setRalat(tr("Sila beri markah bagi setiap KPI."));
    if (!(await sahkan({ tajuk: tr("Hantar penilaian?"), mesej: tr("Penilaian kendiri tidak boleh diubah selepas dihantar kepada pelulus."), ok: tr("Hantar") }))) return;
    setBusy(true);
    setRalat(null);
    try {
      await simpan(true);
      beritahu(tr("Penilaian kendiri dihantar."));
      onSelesai();
    } catch (e) {
      setRalat(e instanceof Error ? trRalat(e.message) : tr("Ralat"));
      setBusy(false);
    }
  }

  const banner = pratonton && (
    <div className="rounded-[12px] bg-ai-soft px-3.5 py-2.5 text-[13px] font-semibold text-ai">{tr("Pratonton — inilah yang dilihat oleh pekerja. Jawapan tidak disimpan.")}</div>
  );

  // ---------------------------------------------------------------- Pengenalan
  if (langkah === -1) {
    return (
      <main className="flex grow flex-col gap-4 px-4 pt-2 pb-6">
        {banner}
        <div className="flex flex-col gap-2 rounded-card bg-surface px-5 py-5">
          <span className="text-xs font-bold tracking-[0.04em] text-muted">{tr("PENILAIAN KENDIRI")}</span>
          <b className="text-xl font-extrabold">{kitaran}</b>
          <span className="text-sm text-subtle">
            {tr("{0} KPI · lebih kurang {1} minit", n, minit)}
            {tarikhAkhir ? " · " + tr("sebelum {0}", tarikh(tarikhAkhir)) : ""}
          </span>
        </div>
        <ol className="flex flex-col gap-2.5 text-sm text-subtle">
          <li>{tr("1. Beri markah 1 hingga 5 bagi setiap KPI, satu demi satu.")}</li>
          <li>{tr("2. Tambah contoh atau bukti jika mahu (pilihan).")}</li>
          <li>{tr("3. Semak jawapan dan hantar.")}</li>
        </ol>
        <span className="text-xs leading-snug text-muted">
          {pelulus ? tr("Markah anda dihantar kepada {0}. Markah pelulus dipaparkan selepas HR memuktamadkan penilaian.", pelulus) : tr("Markah pelulus dipaparkan selepas HR memuktamadkan penilaian.")}
          {!pratonton && " " + tr("Jawapan disimpan setiap kali anda menekan Seterusnya; anda boleh sambung kemudian.")}
        </span>
        {n === 0 ? (
          <span className="rounded-card bg-surface px-4 py-3 text-sm text-muted">{tr("Belum ada KPI.")}</span>
        ) : (
          <ButangUtama onClick={() => setLangkah(0)}>{tr("Mula")}</ButangUtama>
        )}
      </main>
    );
  }

  // ---------------------------------------------------------------- Semak & hantar
  if (langkah >= n) {
    return (
      <main className="flex grow flex-col gap-3 px-4 pt-2 pb-6">
        {banner}
        <b className="text-lg font-extrabold">{tr("Semak & hantar")}</b>
        <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
          {items.map((x, i) => (
            <button key={x.id ?? i} type="button" onClick={() => setLangkah(i)} className="flex min-h-[56px] items-center gap-3 py-2 text-left">
              <span className="flex min-w-0 grow flex-col">
                <b className="truncate text-sm">{x.title}</b>
                {x.self_note && <span className="truncate text-xs text-muted">{x.self_note}</span>}
              </span>
              {x.self_score != null ? (
                <span className="flex shrink-0 flex-col items-end">
                  <b className="text-lg font-extrabold text-primary">{x.self_score}</b>
                  <span className="text-[11px] text-muted">{SKALA_PRESTASI[x.self_score - 1]}</span>
                </span>
              ) : (
                <span className="shrink-0 text-xs font-bold text-danger">{tr("Belum diisi")}</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between rounded-card bg-[#E3F1EE] px-4 py-3 text-primary">
          <b className="text-sm">{tr("Purata markah anda")}</b>
          <b className="text-xl font-extrabold">{tr("{0} / 5", markahTeks(purata))}</b>
        </div>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[#33504B]">
          {tr("Ulasan keseluruhan (pilihan)")}
          <textarea
            rows={3}
            value={ulasan}
            onChange={(e) => setUlasan(e.target.value)}
            placeholder={tr("Contoh: pencapaian terbaik tahun ini, atau sokongan yang anda perlukan")}
            className="rounded-[12px] border border-[#D5DEDC] bg-surface px-3 py-2.5 text-sm font-normal text-ink outline-none focus:border-primary"
          />
        </label>
        {ralat && <ErrorBox message={ralat} />}
        <ButangUtama onClick={hantar} busy={busy}>
          {pratonton ? tr("Tamat pratonton") : tr("Hantar penilaian")}
        </ButangUtama>
        <button type="button" onClick={() => setLangkah(n - 1)} className="flex min-h-11 items-center justify-center text-sm font-bold text-primary">
          {tr("Kembali")}
        </button>
      </main>
    );
  }

  // ---------------------------------------------------------------- Satu KPI
  const x = items[langkah];
  const set = (patch: Partial<ItemKpi>) => setItems(items.map((y, j) => (j === langkah ? { ...y, ...patch } : y)));
  const bukaNota = buka[langkah] || !!x.self_note;
  return (
    <main className="flex grow flex-col gap-4 px-4 pt-2 pb-6">
      {banner}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold tracking-[0.04em] text-muted">{tr("KPI {0} DARIPADA {1}", langkah + 1, n)}</span>
        <div className="flex gap-1" aria-hidden="true">
          {items.map((_, j) => (
            <span key={j} className={`h-1.5 grow rounded-full ${j < langkah || items[j].self_score != null ? "bg-primary" : j === langkah ? "bg-primary/40" : "bg-[#E4EAE8]"}`} />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1 rounded-card bg-surface px-5 py-4">
        <b className="text-lg leading-snug font-extrabold">{x.title}</b>
        {(x.target || !samaBerat) && (
          <span className="text-[13px] text-subtle">
            {[x.target ? tr("Sasaran: {0}", x.target) : null, samaBerat ? null : teksKepentingan(x.weight, items)].filter(Boolean).join(" · ")}
          </span>
        )}
      </div>
      <b className="text-sm">{tr("Bagaimana prestasi anda bagi KPI ini?")}</b>
      <div role="radiogroup" aria-label={tr("Markah kendiri {0}", x.title)} className="flex flex-col gap-2">
        {SKALA_PRESTASI.map((label, i) => {
          const nilai = i + 1;
          const on = x.self_score === nilai;
          return (
            <button
              key={nilai}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${nilai} ${label}`}
              onClick={() => set({ self_score: nilai })}
              className={`flex min-h-[56px] items-center gap-3 rounded-[14px] border px-4 py-2 text-left ${on ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink"}`}
            >
              <b className={`flex size-9 shrink-0 items-center justify-center rounded-full text-base font-extrabold ${on ? "bg-white text-primary" : "bg-page text-ink"}`}>{nilai}</b>
              <span className="flex flex-col">
                <b className="text-sm">{label}</b>
                <span className={`text-xs ${on ? "text-white/85" : "text-muted"}`}>{HURAIAN_SKALA[i]}</span>
              </span>
            </button>
          );
        })}
      </div>
      {bukaNota ? (
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[#33504B]">
          {tr("Contoh / bukti (pilihan)")}
          <textarea
            rows={2}
            value={x.self_note ?? ""}
            onChange={(e) => set({ self_note: e.target.value })}
            placeholder={tr("Contoh: capai jualan RM520k, 4% melebihi sasaran")}
            className="rounded-[12px] border border-[#D5DEDC] bg-surface px-3 py-2.5 text-sm font-normal text-ink outline-none focus:border-primary"
          />
        </label>
      ) : (
        <button type="button" onClick={() => setBuka({ ...buka, [langkah]: true })} className="flex min-h-11 items-center self-start text-sm font-bold text-primary">
          {tr("+ Tambah contoh / bukti (pilihan)")}
        </button>
      )}
      {ralat && <ErrorBox message={ralat} />}
      <div className="grid grid-cols-[auto_1fr] gap-2 pt-1">
        <button type="button" disabled={busy} onClick={() => pergi(langkah - 1)} className="h-12 rounded-button border border-line bg-surface px-5 text-sm font-bold disabled:opacity-60">
          {tr("Kembali")}
        </button>
        <ButangUtama onClick={() => (x.self_score == null ? setRalat(tr("Sila pilih markah dahulu.")) : pergi(langkah + 1))} busy={busy}>
          {langkah === n - 1 ? tr("Semak jawapan") : tr("Seterusnya")}
        </ButangUtama>
      </div>
    </main>
  );
}
