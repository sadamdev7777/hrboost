"use client";

import Link from "next/link";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getJadualGaji, jumlahTetap, setGajiPekerja, type BarisGaji, type JadualGaji } from "@/lib/gaji";
import { inisial, ringgit, tarikh, todayISO } from "@/lib/format";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { HadPeranan, Tag } from "@/components/Senarai";
import { KomponenBaharu, UbahGaji, nilaiInput } from "@/components/GajiPekerja";
import { TabNav } from "@/components/TabNav";

const AV = ["bg-[#E3F1EE] text-primary", "bg-[#FDEBD7] text-warning", "bg-[#EDE9F8] text-ai"];

export default function GajiPekerjaPage() {
  return (
    <HadPeranan roles={["hr", "finance", "admin"]} back="/pengurusan/gaji">
      <GajiPekerja />
    </HadPeranan>
  );
}

function GajiPekerja() {
  const me = useMe();
  const emp = me.active!;
  const d = useData(() => getJadualGaji(emp.companyId), [emp.companyId]);
  const [tapis, setTapis] = useState<"semua" | "belum">("semua");
  const [ubah, setUbah] = useState<BarisGaji | null>(null);
  const [baru, setBaru] = useState(false);
  const [pukal, setPukal] = useState(false);
  const j = d.data;
  const belum = (j?.rows ?? []).filter((r) => !(r.items.BASIC > 0));
  const senarai = tapis === "belum" ? belum : (j?.rows ?? []);
  const jumlah = (j?.rows ?? []).reduce((s, r) => s + jumlahTetap(r.items, j!.components), 0);

  return (
    <Screen lebar="lebar">
      <BackHeader
        title="Gaji Pekerja"
        href="/pengurusan/gaji"
        action={
          <button type="button" onClick={() => setBaru(true)} className="mr-1 flex min-h-11 items-center px-2 text-[13px] font-bold text-primary">
            + Jenis elaun
          </button>
        }
      />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-6 lg:px-0">
        <span className="text-sm leading-normal text-subtle">
          Gaji pokok dan elaun / potongan tetap setiap bulan. Komisen, kerja lebih masa dan tuntutan dimasukkan semasa{" "}
          <Link href="/pengurusan/gaji" className="font-bold">
            Proses Gaji
          </Link>
          .
        </span>
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !j && <Loading />}
        {j && (
          <>
            <div className="grid grid-cols-3 gap-2 lg:max-w-[720px]">
              <Angka n={String(j.rows.length)} label="Pekerja aktif" />
              <Angka n={String(belum.length)} label="Belum ada gaji pokok" tone={belum.length ? "warning" : undefined} />
              <Angka n={ringgit(jumlah)} label="Jumlah tetap sebulan" kecil />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ["semua", `Semua · ${j.rows.length}`],
                  ["belum", `Belum ditetapkan · ${belum.length}`],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTapis(k)}
                  className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] font-bold ${tapis === k ? "bg-primary text-white" : "bg-surface text-[#4A5A57]"}`}
                >
                  {l}
                </button>
              ))}
              {!pukal && (
                <button type="button" onClick={() => setPukal(true)} className="ml-auto hidden h-9 rounded-full border border-primary px-4 text-[13px] font-bold text-primary lg:block">
                  Ubah ramai sekali gus
                </button>
              )}
            </div>
            {senarai.length === 0 && <span className="text-sm text-muted">{tapis === "belum" ? "Semua pekerja sudah mempunyai gaji pokok." : "Tiada pekerja aktif."}</span>}

            {senarai.length > 0 &&
              (pukal ? (
                <JadualPukal j={j} rows={senarai} onBatal={() => setPukal(false)} onSiap={() => { setPukal(false); d.reload(); }} />
              ) : (
                <Jadual j={j} rows={senarai} onUbah={setUbah} />
              ))}

            {/* Telefon: kad setiap pekerja */}
            <div className="flex flex-col rounded-card bg-surface px-4 lg:hidden [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              {senarai.map((r, i) => (
                <button key={r.employment_id} type="button" onClick={() => setUbah(r)} className="flex min-h-14 items-center gap-3 py-2.5 text-left">
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${AV[i % 3]}`}>{inisial(r.name)}</span>
                  <span className="flex min-w-0 grow flex-col gap-0.5">
                    <b className="text-sm font-bold">{r.name}</b>
                    <span className="truncate text-xs text-muted">
                      {j.components
                        .filter((c) => r.items[c.code])
                        .map((c) => `${c.code === "BASIC" ? "Pokok" : c.name} ${ringgit(r.items[c.code])}`)
                        .join(" · ") || r.employee_no}
                    </span>
                  </span>
                  {r.items.BASIC > 0 ? <b className="text-sm whitespace-nowrap">{ringgit(jumlahTetap(r.items, j.components))}</b> : <Tag tone="warning">Belum ditetapkan</Tag>}
                </button>
              ))}
            </div>
            <span className="text-xs leading-normal text-muted">Setiap paparan dan perubahan gaji direkodkan dalam log akses data.</span>
          </>
        )}
      </main>
      <TabNav />
      {ubah && j && (
        <UbahGaji
          employmentId={ubah.employment_id}
          nama={ubah.name}
          komponen={j.components}
          items={ubah.items}
          tarikhMula={ubah.join_date}
          onClose={() => setUbah(null)}
          onDone={() => {
            setUbah(null);
            d.reload();
          }}
        />
      )}
      {baru && (
        <KomponenBaharu
          companyId={emp.companyId}
          onClose={() => setBaru(false)}
          onDone={() => {
            setBaru(false);
            d.reload();
          }}
        />
      )}
    </Screen>
  );
}

function Angka({ n, label, tone, kecil }: { n: string; label: string; tone?: "warning"; kecil?: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 rounded-[14px] px-3.5 py-3 ${tone === "warning" ? "bg-warning-soft text-warning" : "bg-surface"}`}>
      <b className={`${kecil ? "text-base lg:text-lg" : "text-xl"} font-extrabold`}>{n}</b>
      <span className={`text-xs ${tone ? "" : "text-muted"}`}>{label}</span>
    </div>
  );
}

const th = "px-3 py-3 text-xs font-bold tracking-[0.03em] text-muted";
const td = "px-3 py-2.5";

/** Jadual (desktop). */
function Jadual({ j, rows, onUbah }: { j: JadualGaji; rows: BarisGaji[]; onUbah: (r: BarisGaji) => void }) {
  return (
    <div className="hidden overflow-x-auto rounded-card bg-surface lg:block">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[#EEF2F1]">
            <th className={th}>PEKERJA</th>
            <th className={th}>JABATAN</th>
            {j.components.map((c) => (
              <th key={c.code} className={`${th} text-right`}>
                {c.name.toUpperCase()}
                {c.kind === "deduction" ? " (−)" : ""}
              </th>
            ))}
            <th className={`${th} text-right`}>JUMLAH</th>
            <th className={th}>BERKUAT KUASA</th>
            <th className={th} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.employment_id} className="border-b border-[#EEF2F1] last:border-0 hover:bg-[#F7F9F8]">
              <td className={td}>
                <span className="flex flex-col">
                  <b>{r.name}</b>
                  <span className="text-xs text-muted">{r.employee_no}</span>
                </span>
              </td>
              <td className={td}>{r.department ?? "—"}</td>
              {j.components.map((c) => (
                <td key={c.code} className={`${td} text-right tabular-nums`}>
                  {r.items[c.code] ? ringgit(r.items[c.code]).replace("RM ", "") : c.code === "BASIC" ? <Tag tone="warning">Belum</Tag> : <span className="text-muted">—</span>}
                </td>
              ))}
              <td className={`${td} text-right font-bold tabular-nums`}>{r.items.BASIC > 0 ? ringgit(jumlahTetap(r.items, j.components)) : "—"}</td>
              <td className={`${td} text-muted`}>
                {r.effective_from ? tarikh(r.effective_from) : "—"}
                {r.upcoming && (
                  <span className="ml-1">
                    <Tag tone="ai">Perubahan akan datang</Tag>
                  </span>
                )}
              </td>
              <td className={`${td} text-right`}>
                <button type="button" onClick={() => onUbah(r)} className="flex min-h-10 items-center px-2 font-bold text-primary">
                  Ubah
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Mod ubah ramai (desktop): isi terus dalam jadual, satu tarikh berkuat kuasa untuk semua. */
function JadualPukal({ j, rows, onBatal, onSiap }: { j: JadualGaji; rows: BarisGaji[]; onBatal: () => void; onSiap: () => void }) {
  const [nilai, setNilai] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(rows.map((r) => [r.employment_id, Object.fromEntries(j.components.map((c) => [c.code, r.items[c.code] ? String(r.items[c.code]) : ""]))])),
  );
  const [mulai, setMulai] = useState(`${todayISO().slice(0, 7)}-01`);
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string[]>([]);
  const [siap, setSiap] = useState(0);

  async function simpan() {
    const kerja: { r: BarisGaji; out: Record<string, number> }[] = [];
    const salah: string[] = [];
    for (const r of rows) {
      const out: Record<string, number> = {};
      for (const c of j.components) {
        const n = nilaiInput(nilai[r.employment_id]?.[c.code] ?? "");
        if (n === null) salah.push(`${r.name}: amaun ${c.name} tidak sah.`);
        else if (n !== (r.items[c.code] ?? 0)) out[c.code] = n;
      }
      if (!Object.keys(out).length) continue;
      if ((nilaiInput(nilai[r.employment_id]?.BASIC ?? "") ?? 0) <= 0) salah.push(`${r.name}: gaji pokok belum diisi.`);
      else kerja.push({ r, out });
    }
    if (salah.length) return setRalat(salah);
    if (!kerja.length) return setRalat(["Tiada perubahan untuk disimpan."]);
    setBusy(true);
    setRalat([]);
    const gagal: string[] = [];
    let n = 0;
    for (const { r, out } of kerja) {
      // Pekerja yang mula bekerja selepas tarikh pukal: guna tarikh mula bekerja.
      const tarikhGuna = r.join_date > mulai ? r.join_date : mulai;
      try {
        await setGajiPekerja(r.employment_id, out, tarikhGuna);
        n++;
        setSiap(n);
      } catch (e) {
        gagal.push(`${r.name}: ${e instanceof Error ? e.message : "Ralat"}`);
      }
    }
    setBusy(false);
    if (gagal.length) return setRalat([`${n} pekerja disimpan. Tidak berjaya:`, ...gagal]);
    onSiap();
  }

  return (
    <div className="hidden flex-col gap-3 lg:flex">
      <div className="overflow-x-auto rounded-card bg-surface">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[#EEF2F1]">
              <th className={th}>PEKERJA</th>
              {j.components.map((c) => (
                <th key={c.code} className={`${th} text-right`}>
                  {c.name.toUpperCase()} (RM)
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.employment_id} className="border-b border-[#EEF2F1] last:border-0">
                <td className={td}>
                  <span className="flex flex-col">
                    <b>{r.name}</b>
                    <span className="text-xs text-muted">{r.employee_no}</span>
                  </span>
                </td>
                {j.components.map((c) => (
                  <td key={c.code} className="px-2 py-1.5 text-right">
                    <input
                      aria-label={`${c.name} ${r.name}`}
                      inputMode="decimal"
                      placeholder="0.00"
                      value={nilai[r.employment_id]?.[c.code] ?? ""}
                      onChange={(e) => setNilai({ ...nilai, [r.employment_id]: { ...nilai[r.employment_id], [c.code]: e.target.value.replace(/[^\d.,]/g, "") } })}
                      className="h-10 w-32 rounded-[10px] border border-line bg-surface px-3 text-right tabular-nums outline-none focus:border-primary"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-card bg-surface p-4">
        <label className="flex flex-col gap-1.5 text-[13px] font-bold text-[#4A5A57]">
          Berkuat kuasa mulai
          <input type="date" value={mulai} onChange={(e) => setMulai(e.target.value)} className="h-11 rounded-[10px] border border-line bg-surface px-3 text-sm text-ink" />
        </label>
        <span className="max-w-[420px] text-xs leading-normal text-muted">Hanya baris yang berubah disimpan. Pekerja yang mula bekerja selepas tarikh ini menggunakan tarikh mula bekerja.</span>
        <span className="grow" />
        <button type="button" onClick={onBatal} disabled={busy} className="h-11 rounded-button border border-line px-5 text-sm font-bold">
          Batal
        </button>
        <button type="button" onClick={simpan} disabled={busy} className="h-11 rounded-button bg-primary px-6 text-sm font-extrabold text-white disabled:opacity-60">
          {busy ? `Menyimpan… (${siap})` : "Simpan semua"}
        </button>
      </div>
      {ralat.length > 0 && (
        <div role="alert" className="flex flex-col gap-1 rounded-[14px] bg-danger-soft px-4 py-3 text-[13px] text-danger">
          {ralat.map((x) => (
            <span key={x}>{x}</span>
          ))}
        </div>
      )}
    </div>
  );
}
