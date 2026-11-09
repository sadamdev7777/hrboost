"use client";

import { beritahu } from "@/components/Dialog";
import Link from "next/link";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getJadualGaji, setGajiPekerja, type BarisGaji, type JadualGaji, type Kiraan } from "@/lib/gaji";
import { inisial, ringgit, tarikh, todayISO } from "@/lib/format";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { TabGaji } from "@/components/TabGaji";
import { HadPeranan, Tag } from "@/components/Senarai";
import { KomponenBaharu, RingkasanKiraan, UbahGaji, nilaiInput, usePratonton } from "@/components/GajiPekerja";
import { PengepalaAkar, TabNav } from "@/components/TabNav";
import { useSkrinLebar } from "@/lib/skrin";

const AV = ["bg-[#E3F1EE] text-primary", "bg-[#FDEBD7] text-warning", "bg-[#EDE9F8] text-ai"];
const rm = (n: number | undefined | null) => Number(n ?? 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  const [lihat, setLihat] = useState<BarisGaji | null>(null);
  const [baru, setBaru] = useState(false);
  const [pukal, setPukal] = useState(false);
  const lebar = useSkrinLebar();
  const j = d.data;
  const belum = (j?.rows ?? []).filter((r) => !(r.items.BASIC > 0));
  const senarai = tapis === "belum" ? belum : (j?.rows ?? []);
  const t = j?.totals ?? {};

  return (
    <Screen lebar="lebar">
      <PengepalaAkar
        title="Gaji"
        backHr="/pengurusan"
        action={
          <button type="button" onClick={() => setBaru(true)} className="mr-1 flex min-h-11 items-center px-2 text-[13px] font-bold text-primary">
            + Jenis elaun
          </button>
        }
      />
      <TabGaji />
      <main className="flex grow flex-col gap-3 px-4 pt-4 pb-6 lg:px-0">
        <span className="text-sm leading-normal text-subtle">
          Gaji pokok dan elaun / potongan tetap. KWSP, PERKESO, SIP, HRDF dan PCB dikira secara automatik. Komisen, kerja lebih masa dan tuntutan ditambah semasa{" "}
          <Link href="/pengurusan/gaji" className="font-bold">
            Proses Gaji
          </Link>
          .
        </span>
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !j && <Loading />}
        {j && (
          <>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-5 lg:gap-3">
              <Angka n={String(j.rows.length)} label="Pekerja aktif" />
              <Angka n={String(belum.length)} label="Belum ada gaji pokok" tone={belum.length ? "warning" : undefined} />
              <Angka n={ringgit(t.gross)} label="Jumlah gaji kasar" kecil />
              <Angka n={ringgit(t.net)} label="Jumlah gaji bersih" kecil />
              <Angka n={ringgit(t.employer_cost)} label="Kos majikan (termasuk caruman)" kecil />
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
              {!pukal && lebar && (
                <button type="button" onClick={() => setPukal(true)} className="ml-auto h-9 rounded-full border border-primary px-4 text-[13px] font-bold text-primary">
                  Ubah ramai sekali gus
                </button>
              )}
            </div>
            {senarai.length === 0 && (
              <span className="text-sm text-muted">{tapis === "belum" ? "Semua pekerja sudah mempunyai gaji pokok." : "Tiada pekerja aktif."}</span>
            )}

            {lebar &&
              senarai.length > 0 &&
              (pukal ? (
                <JadualPukal
                  j={j}
                  rows={senarai}
                  onBatal={() => setPukal(false)}
                  onSiap={() => {
                    setPukal(false);
                    d.reload();
                  }}
                />
              ) : (
                <Jadual j={j} rows={senarai} onUbah={setUbah} />
              ))}

            {!lebar && senarai.length > 0 && (
              <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
                {senarai.map((r, i) => (
                  <button key={r.employment_id} type="button" onClick={() => setLihat(r)} className="flex min-h-14 items-center gap-3 py-2.5 text-left">
                    <span className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${AV[i % 3]}`}>{inisial(r.name)}</span>
                    <span className="flex min-w-0 grow flex-col gap-0.5">
                      <b className="text-sm font-bold">{r.name}</b>
                      <span className="truncate text-xs text-muted">
                        {r.items.BASIC > 0 ? `Kasar ${ringgit(r.calc?.gross)} · KWSP ${rm(r.calc?.epf_employee)}` : r.employee_no}
                      </span>
                    </span>
                    {r.items.BASIC > 0 ? (
                      <span className="flex flex-col items-end">
                        <b className="text-sm whitespace-nowrap">{ringgit(r.calc?.net)}</b>
                        <span className="text-[11px] text-muted">bersih</span>
                      </span>
                    ) : (
                      <Tag tone="warning">Belum ditetapkan</Tag>
                    )}
                  </button>
                ))}
              </div>
            )}
            <span className="text-xs leading-normal text-muted">
              Angka ialah anggaran sebulan bagi gaji tetap; PCB sebenar bergantung pada data terkumpul tahun ini. Setiap paparan dan perubahan gaji direkodkan dalam log akses data.
            </span>
          </>
        )}
      </main>
      <TabNav />
      {lihat && j && !ubah && (
        <ButiranTelefon
          r={lihat}
          onClose={() => setLihat(null)}
          onUbah={() => {
            setUbah(lihat);
            setLihat(null);
          }}
        />
      )}
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

function ButiranTelefon({ r, onClose, onUbah }: { r: BarisGaji; onClose: () => void; onUbah: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`Gaji ${r.name}`} className="flex max-h-[90dvh] w-full max-w-[480px] flex-col gap-3 overflow-y-auto rounded-t-[20px] bg-surface px-4 pt-5 pb-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="m-0 text-lg font-extrabold">Gaji {r.name}</h2>
        {r.effective_from && <span className="-mt-2 text-xs text-muted">Berkuat kuasa mulai {tarikh(r.effective_from)}</span>}
        <RingkasanKiraan k={r.items.BASIC > 0 ? r.calc : null} padat />
        <button type="button" onClick={onUbah} className="h-12 rounded-button bg-primary text-base font-extrabold text-white">
          Ubah gaji
        </button>
      </div>
    </div>
  );
}

function Angka({ n, label, tone, kecil }: { n: string; label: string; tone?: "warning"; kecil?: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 rounded-[14px] px-3.5 py-3 ${tone === "warning" ? "bg-warning-soft text-warning" : "bg-surface"}`}>
      <b className={`${kecil ? "text-base lg:text-lg" : "text-xl"} font-extrabold tabular-nums`}>{n}</b>
      <span className={`text-xs ${tone ? "" : "text-muted"}`}>{label}</span>
    </div>
  );
}

const th = "px-2.5 py-3 text-[11px] font-bold tracking-[0.03em] text-muted whitespace-nowrap";
const td = "px-2.5 py-2.5 tabular-nums whitespace-nowrap";

/** Dua angka bertindan: pekerja (atas) / majikan (bawah). */
function PM({ p, m }: { p?: number; m?: number }) {
  return (
    <span className="flex flex-col items-end leading-tight">
      <span>{rm(p)}</span>
      <span className="text-[11px] text-muted">{rm(m)}</span>
    </span>
  );
}

function SelKiraan({ k }: { k: Kiraan | null }) {
  if (!k || !k.statutory_ready)
    return (
      <td colSpan={7} className={`${td} text-center text-muted`}>
        —
      </td>
    );
  return (
    <>
      <td className={`${td} text-right font-semibold`}>{rm(k.gross)}</td>
      <td className={`${td} text-right`}>
        <PM p={k.epf_employee} m={k.epf_employer} />
      </td>
      <td className={`${td} text-right`}>
        <PM p={k.socso_employee} m={k.socso_employer} />
      </td>
      <td className={`${td} text-right`}>
        <PM p={k.eis_employee} m={k.eis_employer} />
      </td>
      <td className={`${td} text-right`}>{rm(k.pcb)}</td>
      <td className={`${td} text-right font-extrabold text-primary`}>{rm(k.net)}</td>
      <td className={`${td} text-right`}>{rm(k.employer_cost)}</td>
    </>
  );
}

const KepalaKiraan = () => (
  <>
    <th className={`${th} text-right`}>KASAR</th>
    <th className={`${th} text-right`}>
      KWSP
      <br />
      <span className="font-semibold">pekerja / majikan</span>
    </th>
    <th className={`${th} text-right`}>
      PERKESO
      <br />
      <span className="font-semibold">pekerja / majikan</span>
    </th>
    <th className={`${th} text-right`}>
      SIP
      <br />
      <span className="font-semibold">pekerja / majikan</span>
    </th>
    <th className={`${th} text-right`}>PCB</th>
    <th className={`${th} text-right`}>BERSIH</th>
    <th className={`${th} text-right`}>KOS MAJIKAN</th>
  </>
);

/** Jadual (desktop): gaji tetap + kiraan berkanun automatik + jumlah. */
function Jadual({ j, rows, onUbah }: { j: JadualGaji; rows: BarisGaji[]; onUbah: (r: BarisGaji) => void }) {
  const t = j.totals ?? {};
  return (
    <div className="overflow-x-auto rounded-card bg-surface">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-[#EEF2F1] align-bottom">
            <th className={`${th} pl-4`}>PEKERJA</th>
            {j.components.map((c) => (
              <th key={c.code} className={`${th} text-right`}>
                {c.name.toUpperCase()}
                {c.kind === "deduction" ? " (−)" : ""}
              </th>
            ))}
            <KepalaKiraan />
            <th className={th} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.employment_id} className="border-b border-[#EEF2F1] last:border-0 hover:bg-[#F7F9F8]">
              <td className="py-2.5 pr-2.5 pl-4">
                <span className="flex flex-col">
                  <b className="text-sm">{r.name}</b>
                  <span className="text-[11px] whitespace-nowrap text-muted">
                    {r.employee_no}
                    {r.effective_from ? ` · mulai ${tarikh(r.effective_from)}` : ""}
                  </span>
                  {r.upcoming && (
                    <span className="mt-0.5">
                      <Tag tone="ai">Perubahan akan datang</Tag>
                    </span>
                  )}
                </span>
              </td>
              {j.components.map((c) => (
                <td key={c.code} className={`${td} text-right`}>
                  {r.items[c.code] ? rm(r.items[c.code]) : c.code === "BASIC" ? <Tag tone="warning">Belum</Tag> : <span className="text-muted">—</span>}
                </td>
              ))}
              <SelKiraan k={r.items.BASIC > 0 ? r.calc : null} />
              <td className="py-2.5 pr-3 text-right">
                <button type="button" onClick={() => onUbah(r)} className="flex min-h-10 items-center px-2 font-bold text-primary">
                  Ubah
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[#DCE3E1] bg-[#F7F9F8] font-extrabold">
            <td className="py-3 pr-2.5 pl-4">Jumlah</td>
            {j.components.map((c) => (
              <td key={c.code} className={`${td} text-right`}>
                {rm(rows.reduce((s, r) => s + (r.items[c.code] ?? 0), 0))}
              </td>
            ))}
            <td className={`${td} text-right`}>{rm(t.gross)}</td>
            <td className={`${td} text-right`}>
              <PM p={t.epf_employee} m={t.epf_employer} />
            </td>
            <td className={`${td} text-right`}>
              <PM p={t.socso_employee} m={t.socso_employer} />
            </td>
            <td className={`${td} text-right`}>
              <PM p={t.eis_employee} m={t.eis_employer} />
            </td>
            <td className={`${td} text-right`}>{rm(t.pcb)}</td>
            <td className={`${td} text-right text-primary`}>{rm(t.net)}</td>
            <td className={`${td} text-right`}>{rm(t.employer_cost)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Satu baris mod ubah ramai, dengan kiraan langsung bagi nilai yang sedang ditaip. */
function BarisPukal({
  j,
  r,
  nilai,
  mulai,
  onNilai,
}: {
  j: JadualGaji;
  r: BarisGaji;
  nilai: Record<string, string>;
  mulai: string;
  onNilai: (code: string, v: string) => void;
}) {
  const items: Record<string, number> | null = (() => {
    const o: Record<string, number> = {};
    for (const c of j.components) {
      const n = nilaiInput(nilai[c.code] ?? "");
      if (n === null) return null;
      if (n > 0) o[c.code] = n;
    }
    return o.BASIC ? o : null;
  })();
  const berubah = j.components.some((c) => (nilaiInput(nilai[c.code] ?? "") ?? -1) !== (r.items[c.code] ?? 0));
  const pr = usePratonton(r.employment_id, berubah ? items : null, r.join_date > mulai ? r.join_date : mulai);
  const k = berubah ? pr.k : r.items.BASIC > 0 ? r.calc : null;
  return (
    <tr className={`border-b border-[#EEF2F1] last:border-0 ${berubah ? "bg-[#FFFBEB]" : ""}`}>
      <td className="py-2 pr-2.5 pl-4">
        <span className="flex flex-col">
          <b className="text-sm">{r.name}</b>
          <span className="text-[11px] text-muted">{r.employee_no}</span>
        </span>
      </td>
      {j.components.map((c) => (
        <td key={c.code} className="px-1.5 py-1.5 text-right">
          <input
            aria-label={`${c.name} ${r.name}`}
            inputMode="decimal"
            placeholder="0.00"
            value={nilai[c.code] ?? ""}
            onChange={(e) => onNilai(c.code, e.target.value.replace(/[^\d.,]/g, ""))}
            className="h-10 w-28 rounded-[10px] border border-line bg-surface px-2.5 text-right tabular-nums outline-none focus:border-primary"
          />
        </td>
      ))}
      <SelKiraan k={berubah && !items ? null : k} />
    </tr>
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
    beritahu(`Gaji ${n} pekerja dikemas kini.`);
    onSiap();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-card bg-surface">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#EEF2F1] align-bottom">
              <th className={`${th} pl-4`}>PEKERJA</th>
              {j.components.map((c) => (
                <th key={c.code} className={`${th} text-right`}>
                  {c.name.toUpperCase()} (RM)
                </th>
              ))}
              <KepalaKiraan />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <BarisPukal
                key={r.employment_id}
                j={j}
                r={r}
                mulai={mulai}
                nilai={nilai[r.employment_id] ?? {}}
                onNilai={(code, v) => setNilai((s) => ({ ...s, [r.employment_id]: { ...s[r.employment_id], [code]: v } }))}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-card bg-surface p-4">
        <label className="flex flex-col gap-1.5 text-[13px] font-bold text-[#4A5A57]">
          Berkuat kuasa mulai
          <input type="date" value={mulai} onChange={(e) => setMulai(e.target.value)} className="h-11 rounded-[10px] border border-line bg-surface px-3 text-sm text-ink" />
        </label>
        <span className="max-w-[420px] text-xs leading-normal text-muted">
          Baris berlatar kuning telah diubah; kiraan dikemas kini semasa anda menaip. Hanya baris yang berubah disimpan. Pekerja yang mula bekerja selepas tarikh ini menggunakan tarikh mula bekerja.
        </span>
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
