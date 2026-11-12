"use client";

import { tr, trRalat } from "@/lib/i18n";
import { FailBank } from "@/components/FailBank";
import { useBilSkbbk } from "@/components/PilihSkbbk";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import {
  BULAN_PENUH,
  getLarian,
  getPelarasan,
  getPerbezaan,
  hantarKelulusan,
  kiraGaji,
  getLaporanSlip,
  getTetapanPratonton,
  selesaikanLaporan,
  sediakanGaji,
  setPelarasan,
  setTetapanPratonton,
  tandaDibayar,
  type Jumlah,
  type Persediaan,
} from "@/lib/gaji";
import { getSenaraiPekerja } from "@/lib/hr";
import { getBenderaGaji, type BenderaGaji } from "@/lib/berkanun";
import { namaPeringkat, todayISO } from "@/lib/format";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { PengepalaAkar, TabNav } from "@/components/TabNav";
import { TabGaji } from "@/components/TabGaji";
import { ButangBantuan, KadPanduan } from "@/components/Panduan";
import { useSearchParams } from "next/navigation";
import { ButangUtama, Cip, HadPeranan, Lembaran, MedanBorang, Seksyen, Suis, Tag, inputKecil } from "@/components/Senarai";
import { beritahu, mintaTeks } from "@/components/Dialog";
import {
  KOD_SISTEM_KIRA,
  bukaSemula,
  eksport,
  getKatalog,
  getKesediaan,
  getKitaran,
  getVarians,
  lepasSlip,
  muatTurunTeks,
  senaraiFail,
  setResitPcb,
  tambahKitaran,
  tarikBalikSlip,
  type Varians,
} from "@/lib/gajiLengkap";

const rm = (n: number | string | null | undefined) => tr("RM {0}", Number(n ?? 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const LANGKAH = [tr("Semak data"), tr("Kira"), tr("Kelulusan"), tr("Bayar & hantar")];

function geser(y: number, m: number, n: number) {
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
}

// Rujukan reka bentuk: design/ProsesGaji.dc.html → GajiSemak.dc.html → GajiBayar.dc.html
export default function ProsesGajiPage() {
  return (
    <HadPeranan roles={["hr", "finance", "admin"]}>
      <Suspense fallback={<Loading />}>
        <ProsesGaji />
      </Suspense>
    </HadPeranan>
  );
}

function ProsesGaji() {
  const me = useMe();
  const emp = me.active!;
  const t = todayISO();
  const sp = useSearchParams();
  const [tempoh, setTempoh] = useState(() => {
    const y = Number(sp.get("y"));
    const m = Number(sp.get("m"));
    return y > 2000 && m >= 1 && m <= 12 ? { y, m } : { y: Number(t.slice(0, 4)), m: Number(t.slice(5, 7)) };
  });
  const [kitaran, setKitaran] = useState<string | null>(null);
  const senaraiKitaran = useData(() => getKitaran(emp.companyId, tempoh.y, tempoh.m), [emp.companyId, tempoh.y, tempoh.m]);
  const d = useData(async () => {
    const tambahan = kitaran && (await getKitaran(emp.companyId, tempoh.y, tempoh.m)).some((k) => k.id === kitaran && k.kind === "additional");
    const prep: Persediaan = tambahan
      ? { run_id: kitaran!, status: "", summary: { employees: 0, claims: 0, claims_amount: 0, unpaid_leave_people: 0, adjustment_people: 0 }, checks: [], statutory_ready: true }
      : await sediakanGaji(emp.companyId, tempoh.y, tempoh.m);
    const run = await getLarian(prep.run_id);
    const wf = must(
      await getSupabase()
        .from("approval_workflows")
        .select("approval_workflow_steps(step_order, name)")
        .eq("company_id", emp.companyId)
        .eq("request_type", "payroll_run")
        .maybeSingle(),
    );
    const aliran = (wf?.approval_workflow_steps ?? []).sort((a, b) => a.step_order - b.step_order).map((s) => namaPeringkat(s.name));
    return { prep, run, aliran, tambahan: !!tambahan };
  }, [emp.companyId, tempoh.y, tempoh.m, kitaran]);
  const muatSemula = () => {
    d.reload();
    senaraiKitaran.reload();
  };
  const tukarTempoh = (t: { y: number; m: number }) => {
    setKitaran(null);
    setTempoh(t);
  };

  const status = d.data?.run.status;
  const langkah = !status ? 0 : status === "draft" ? 1 : status === "calculated" || status === "returned" ? 2 : status === "pending" || status === "rejected" ? 3 : 4;

  return (
    <Screen>
      <PengepalaAkar
        title={tr("Penggajian")}
        action={
          <div className="mr-1 flex items-center gap-1">
            <ButangBantuan id="gaji" />
            <button type="button" aria-label={tr("Bulan sebelumnya")} onClick={() => tukarTempoh(geser(tempoh.y, tempoh.m, -1))} className="flex size-11 items-center justify-center rounded-full text-lg">
              ‹
            </button>
            <span className="flex h-9 items-center rounded-full bg-[#E3F1EE] px-3 text-[13px] font-extrabold whitespace-nowrap text-primary">{`${BULAN_PENUH[tempoh.m - 1].slice(0, 3)} ${tempoh.y}`}</span>
            <button type="button" aria-label={tr("Bulan seterusnya")} onClick={() => tukarTempoh(geser(tempoh.y, tempoh.m, 1))} className="flex size-11 items-center justify-center rounded-full text-lg">
              ›
            </button>
          </div>
        }
      />
      <TabGaji />
      <div className="px-4 pt-3 empty:hidden lg:px-0">
        <KadPanduan id="gaji" />
      </div>
      <PilihKitaran senarai={senaraiKitaran.data ?? []} pilih={kitaran} onPilih={setKitaran} />
      <ol className="mx-5 mt-4 grid grid-cols-4 gap-1.5 lg:mx-0" aria-label={tr("Langkah proses gaji")}>
        {LANGKAH.map((l, i) => {
          const siap = langkah > i + 1 || status === "paid";
          const kini = langkah === i + 1 && status !== "paid";
          return (
            <li key={l} className="flex flex-col items-center gap-1 text-center">
              <i className={`flex size-7 items-center justify-center rounded-full text-xs font-extrabold not-italic ${siap ? "bg-primary text-white" : kini ? "border-2 border-primary text-primary" : "bg-[#E4EAE8] text-[#4A5A57]"}`}>
                {siap ? "✓" : i + 1}
              </i>
              <span className={`text-[11px] font-bold ${kini ? "text-primary" : "text-[#4A5A57]"}`}>{l}</span>
            </li>
          );
        })}
      </ol>
      {d.error && (
        <div className="px-4 pt-3">
          <ErrorBox message={d.error} />
        </div>
      )}
      {d.loading && !d.data && <Loading />}
      {d.data && status === "draft" && <Langkah1 data={d.data} reload={muatSemula} />}
      {d.data && (status === "calculated" || status === "returned") && <Langkah2 data={d.data} reload={muatSemula} />}
      {d.data && status === "pending" && <Langkah3 data={d.data} reload={muatSemula} />}
      {d.data && (status === "approved" || status === "paid" || status === "locked") && <Langkah4 data={d.data} reload={muatSemula} />}
      {d.data && (status === "rejected" || status === "cancelled") && (
        <main className="flex flex-col gap-3 px-4 pt-4 lg:px-0">
          <ErrorBox message={status === "rejected" ? tr("Gaji bulan ini telah ditolak oleh pelulus. Semak komen pelulus, betulkan dan hantar semula.") : tr("Permohonan kelulusan gaji ini telah dibatalkan.")} />
          {d.data.run.approval_request_id && (
            <Link href={`/permohonan/${d.data.run.approval_request_id}`} className="flex h-12 items-center justify-center rounded-[14px] border border-line bg-surface text-sm font-bold">
              {tr("Lihat komen pelulus")}
            </Link>
          )}
          <ButangUtama onClick={() => bukaSemulaGaji(d.data!.run.id, muatSemula)}>{tr("Betulkan & sediakan semula")}</ButangUtama>
        </main>
      )}
      {d.data && (
        <div className="flex justify-center px-4 pt-2 pb-6">
          <button
            type="button"
            onClick={async () => {
              const label = await mintaTeks({
                tajuk: tr("Kitaran gaji tambahan"),
                mesej: tr("Untuk bonus, insentif atau bayaran lain di luar gaji bulanan. PCB dikira mengikut kaedah saraan tambahan; tiada PERKESO/SIP."),
                label: tr("Nama kitaran (cth. Bonus Disember)"),
                ok: tr("Cipta"),
              });
              if (!label) return;
              try {
                const id = await tambahKitaran(emp.companyId, tempoh.y, tempoh.m, label);
                senaraiKitaran.reload();
                setKitaran(id);
              } catch (e) {
                beritahu(e instanceof Error ? e.message : tr("Ralat"), "ralat");
              }
            }}
            className="flex min-h-11 items-center text-[13px] font-bold text-primary"
          >
            {tr("+ Bayar bonus atau insentif berasingan (kitaran tambahan)")}
          </button>
        </div>
      )}
      <TabNav />
    </Screen>
  );
}

/**
 * Satu senarai "Sebelum mengira": perkara yang mesti dibaiki (merah) dan perlu disemak (kuning), setiap satu dengan pautan terus.
 * Menggantikan kotak berasingan untuk gaji pokok, data terkumpul, maklumat tidak lengkap dan amaran lain.
 */
function SemakanGaji({ checks, companyId, statutoryReady }: { checks: string[]; companyId: string; statutoryReady: boolean }) {
  const k = useData(() => getKesediaan(companyId), [companyId]);
  const ppl = useData(() => getSenaraiPekerja(companyId), [companyId]);
  const [buka, setBuka] = useState<string | null>(null);
  const tiadaGaji = checks.filter((c) => c.includes("gaji pokok belum ditetapkan"));
  const terkumpul = checks.filter((c) => c.includes("tiada data terkumpul"));
  const lain = checks.filter((c) => !tiadaGaji.includes(c) && !terkumpul.includes(c));
  const nama = (xs: string[]) => xs.map((c) => c.split(":")[0]).join(", ");
  const tidakLengkap = k.data ?? [];
  const namaPekerja = (id: string) => ppl.data?.find((p) => p.id === id)?.name ?? "…";

  type Baris = { id: string; merah: boolean; tajuk: string; nota?: string; href?: string; pautan?: string; butiran?: React.ReactNode };
  const baris: Baris[] = [];
  if (!statutoryReady) baris.push({ id: "kadar", merah: true, tajuk: tr("Jadual kadar berkanun belum dimuatkan untuk bulan ini."), nota: tr("Hubungi Pentadbir Platform.") });
  if (tiadaGaji.length)
    baris.push({ id: "gaji", merah: true, tajuk: tr("{0} pekerja belum mempunyai gaji pokok", tiadaGaji.length), nota: nama(tiadaGaji), href: "/pengurusan/gaji/pekerja", pautan: tr("Tetapkan gaji") });
  if (terkumpul.length)
    baris.push({
      id: "ytd",
      merah: true,
      tajuk: tr("{0} pekerja tiada data gaji terkumpul tahun ini", terkumpul.length),
      nota: tr("Tanpa data ini PCB dikira terlalu rendah (selalunya RM0). Isi daripada sistem gaji lama: {0}.", nama(terkumpul)),
      href: "/pengurusan/gaji/data-terkumpul",
      pautan: tr("Isi atau import"),
    });
  if (tidakLengkap.length)
    baris.push({
      id: "lengkap",
      merah: false,
      tajuk: tr("{0} pekerja: maklumat gaji tidak lengkap", tidakLengkap.length),
      nota: tr("Contohnya no. KWSP, akaun bank atau status perkahwinan."),
      butiran: (
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
          {tidakLengkap.map((x) => (
            <li key={x.employment_id}>
              <Link href={`/pengurusan/pekerja/${x.employment_id}`} className="font-bold">
                {namaPekerja(x.employment_id)}
              </Link>
              <span className="text-muted">: {x.missing.map((m) => trRalat(m)).join(", ")}</span>
            </li>
          ))}
        </ul>
      ),
    });
  if (lain.length)
    baris.push({
      id: "lain",
      merah: false,
      tajuk: tr("{0} perkara lain untuk disemak", lain.length),
      butiran: (
        <ul className="m-0 flex list-disc flex-col gap-0.5 pl-5 text-[13px] text-muted">
          {lain.map((c, i) => (
            <li key={i}>{trRalat(c)}</li>
          ))}
        </ul>
      ),
    });

  return (
    <section aria-label={tr("Sebelum mengira")} className="flex flex-col gap-2">
      <Seksyen className="pt-1">{tr("SEBELUM MENGIRA")}</Seksyen>
      {baris.length === 0 ? (
        <div className="rounded-card bg-success-soft px-4 py-3 text-[13px] font-semibold text-success">{tr("Semua sedia. Tekan Kira Gaji.")}</div>
      ) : (
        <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
          {baris.map((b) => (
            <div key={b.id} className="flex flex-col gap-1.5 py-3">
              <div className="flex items-start gap-3">
                <span aria-hidden className={`mt-1.5 size-2.5 shrink-0 rounded-full ${b.merah ? "bg-danger" : "bg-warning"}`} />
                <span className="flex min-w-0 grow flex-col gap-0.5">
                  <b className={`text-sm ${b.merah ? "text-danger" : "text-ink"}`}>{b.tajuk}</b>
                  {b.nota && <span className="text-[13px] leading-snug text-muted">{b.nota}</span>}
                </span>
                {b.href ? (
                  <Link href={b.href} className="flex min-h-9 shrink-0 items-center text-[13px] font-bold">
                    {b.pautan} ›
                  </Link>
                ) : (
                  b.butiran && (
                    <button type="button" aria-expanded={buka === b.id} onClick={() => setBuka(buka === b.id ? null : b.id)} className="flex min-h-9 shrink-0 items-center text-[13px] font-bold text-primary">
                      {buka === b.id ? tr("Tutup") : tr("Lihat")}
                    </button>
                  )
                )}
              </div>
              {buka === b.id && <div className="pl-5.5">{b.butiran}</div>}
            </div>
          ))}
        </div>
      )}
      {baris.some((b) => b.merah) && <span className="text-xs text-muted">{tr("Perkara merah perlu dibaiki dahulu supaya gaji dikira dengan betul. Perkara kuning boleh disemak kemudian.")}</span>}
    </section>
  );
}

type Data = { prep: Awaited<ReturnType<typeof sediakanGaji>>; run: Awaited<ReturnType<typeof getLarian>>; aliran: string[]; tambahan: boolean };

/** Kitaran gaji bulan ini: gaji bulanan + kitaran tambahan (bonus dll.). */
function PilihKitaran({ senarai, pilih, onPilih }: { senarai: Awaited<ReturnType<typeof getKitaran>>; pilih: string | null; onPilih: (id: string | null) => void }) {
  const tambahan = senarai.filter((k) => k.kind === "additional");
  // Kebanyakan bulan hanya ada gaji bulanan: pilihan kitaran dipaparkan hanya apabila ada bonus/insentif berasingan.
  if (!tambahan.length) return null;
  return (
    <div className="mx-4 mt-3 flex flex-wrap items-center gap-2 lg:mx-0" role="group" aria-label={tr("Kitaran gaji")}>
      <Cip on={!pilih} onClick={() => onPilih(null)}>
        {tr("Gaji bulanan")}
      </Cip>
      {tambahan.map((k) => (
        <Cip key={k.id} on={pilih === k.id} onClick={() => onPilih(k.id)}>
          {k.label ?? tr("Kitaran {0}", k.cycle_no)}
        </Cip>
      ))}
    </div>
  );
}

function Langkah1({ data, reload }: { data: Data; reload: () => void }) {
  const me = useMe();
  const s = data.prep.summary;
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const [import_, setImport] = useState(false);
  const adj = useData(() => getPelarasan(data.run.id), [data.run.id]);
  const skbbk = useBilSkbbk(data.run.company_id);

  async function kira() {
    setBusy(true);
    setRalat(null);
    try {
      await kiraGaji(data.run.id);
      reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
      setBusy(false);
    }
  }

  return (
    <>
      <main className="flex grow flex-col gap-3 px-4 pt-4 pb-4">
        {data.tambahan ? (
          <>
            <span className="rounded-[14px] bg-[#E3F1EE] px-4 py-3 text-[13px] leading-normal text-primary">
              <b>{data.run.label}</b>
              {tr(": masukkan item (cth. bonus) bagi setiap pekerja yang terlibat. Hanya pekerja dengan item akan menerima slip kitaran ini. KWSP dikira atas jumlah gabungan bulan ini; PCB mengikut kaedah saraan tambahan LHDN.")}
            </span>
            <SenaraiPelarasan runId={data.run.id} companyId={data.run.company_id} onTambah={() => setImport(true)} data={adj.data ?? []} reload={adj.reload} />
          </>
        ) : (
          <>
            <Seksyen>{tr("DATA BULAN INI (AUTOMATIK)")}</Seksyen>
            <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-card bg-surface px-4 py-3 text-sm">
              <span>
                <b>{s.employees}</b> {tr("pekerja aktif")}
              </span>
              <span>
                <b>{s.claims}</b> {tr("tuntutan untuk dibayar")} ({rm(s.claims_amount)})
              </span>
              <span>
                <b>{s.unpaid_leave_people}</b> {tr("orang cuti tanpa gaji")}
              </span>
              {skbbk.data != null && (
                <Link href="/pengurusan/gaji/tetapan" className="inline-flex min-h-11 items-center gap-1 text-ink!">
                  <b>{skbbk.data}</b> {tr("menyertai Lindung 24 Jam ›")}
                </Link>
              )}
            </div>
            <SemakanGaji checks={data.prep.checks} companyId={data.run.company_id} statutoryReady={data.prep.statutory_ready} />
            <SenaraiPelarasan runId={data.run.id} companyId={data.run.company_id} onTambah={() => setImport(true)} data={adj.data ?? []} reload={adj.reload} />
          </>
        )}
        {ralat && <ErrorBox message={ralat} />}
      </main>
      <div className="bar-bawah sticky bottom-0 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
        <ButangUtama onClick={kira} busy={busy} disabled={!data.prep.statutory_ready || (data.tambahan && !(adj.data ?? []).length)}>
          {tr("Kira Gaji")}</ButangUtama>
      </div>
      {import_ && <Pelarasan runId={data.run.id} companyId={me.active!.companyId} onClose={() => { setImport(false); adj.reload(); }} />}
    </>
  );
}

/** Item bulan ini sahaja (komisen, bonus, elaun sekali, BIK, potongan) yang telah dimasukkan. */
function SenaraiPelarasan({
  runId,
  companyId,
  data,
  reload,
  onTambah,
}: {
  runId: string;
  companyId: string;
  data: { id: string; employment_id: string; component_code: string; amount: number; note: string | null }[];
  reload: () => void;
  onTambah: () => void;
}) {
  const ppl = useData(() => getSenaraiPekerja(companyId), [companyId]);
  const kat = useData(() => getKatalog(companyId), [companyId]);
  const nama = (id: string) => ppl.data?.find((p) => p.id === id)?.name ?? "…";
  const item = (k: string) => kat.data?.find((c) => c.code === k);
  return (
    <section aria-label={tr("Item bulan ini")} className="flex flex-col gap-2">
      <div className="flex items-center gap-2 pt-1">
        <Seksyen className="grow">{tr("KOMISEN, BONUS & POTONGAN BULAN INI ({0})", data.length)}</Seksyen>
        <button type="button" onClick={onTambah} className="flex h-10 items-center rounded-full border border-primary px-3.5 text-[13px] font-bold text-primary">
          {tr("+ Tambah item")}
        </button>
      </div>
      {data.length === 0 ? (
        <span className="text-xs text-muted">{tr("Komisen, bonus, elaun sekali, manfaat (BIK) atau potongan yang hanya untuk bulan ini.")}</span>
      ) : (
        <div className="flex flex-col rounded-card bg-surface px-4 text-sm [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
          {data.map((a) => {
            const c = item(a.component_code);
            return (
              <div key={a.id} className="flex min-h-12 items-center gap-2 py-2">
                <span className="flex min-w-0 grow flex-col">
                  <b>{nama(a.employment_id)}</b>
                  <span className="text-xs text-muted">
                    {c?.name ?? a.component_code}
                    {a.note ? ` · ${a.note}` : ""}
                  </span>
                </span>
                <b className={c?.kind === "deduction" ? "text-danger" : ""}>
                  {c?.kind === "deduction" ? "−" : ""}
                  {rm(a.amount)}
                </b>
                <button
                  type="button"
                  aria-label={tr("Buang")}
                  onClick={async () => {
                    try {
                      await setPelarasan(runId, a.employment_id, a.component_code, 0);
                      reload();
                    } catch (e) {
                      beritahu(e instanceof Error ? e.message : tr("Ralat"), "ralat");
                    }
                  }}
                  className="flex size-10 items-center justify-center text-lg text-muted"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Pelarasan({ runId, companyId, onClose }: { runId: string; companyId: string; onClose: () => void }) {
  const ppl = useData(() => getSenaraiPekerja(companyId), [companyId]);
  const kat = useData(() => getKatalog(companyId), [companyId]);
  const [emp, setEmp] = useState("");
  const [kod, setKod] = useState("COMMISSION");
  const [amaun, setAmaun] = useState("");
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const pilih = emp || ppl.data?.[0]?.id || "";
  const item = (kat.data ?? []).filter((c) => c.active && !KOD_SISTEM_KIRA.includes(c.code));
  const KUMP: [string, string][] = [
    ["earning", tr("Pendapatan")],
    ["benefit", tr("Manfaat (BIK)")],
    ["deduction", tr("Potongan")],
  ];
  async function simpan() {
    setRalat(null);
    setBusy(true);
    try {
      await setPelarasan(runId, pilih, kod, Number(amaun) || 0, nota.trim() || undefined);
      setOk(tr("Disimpan untuk {0}.", ppl.data?.find((p) => p.id === pilih)?.name));
      setAmaun("");
      setNota("");
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
    setBusy(false);
  }
  return (
    <Lembaran title={tr("Item bulan ini")} onClose={onClose}>
      <MedanBorang label={tr("Pekerja")}>
        <select className={inputKecil} value={pilih} onChange={(e) => setEmp(e.target.value)}>
          {(ppl.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.employeeNo}
            </option>
          ))}
        </select>
      </MedanBorang>
      <div className="grid grid-cols-2 gap-2.5">
        <MedanBorang label={tr("Item")}>
          <select className={inputKecil} value={kod} onChange={(e) => setKod(e.target.value)}>
            {KUMP.map(([k, l]) => (
              <optgroup key={k} label={l}>
                {item
                  .filter((c) => c.kind === k)
                  .map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </MedanBorang>
        <MedanBorang label={tr("Jumlah (RM)")} nota={tr("0 = buang")}>
          <input className={inputKecil} inputMode="decimal" value={amaun} onChange={(e) => setAmaun(e.target.value.replace(/[^\d.]/g, ""))} />
        </MedanBorang>
      </div>
      <MedanBorang label={tr("Keterangan pada slip (pilihan)")} nota={tr("Cth. Jualan Oktober, Bonus prestasi 2026")}>
        <input className={inputKecil} value={nota} maxLength={60} onChange={(e) => setNota(e.target.value)} />
      </MedanBorang>
      <span className="text-xs text-muted">
        {tr("Cukai, KWSP dan PERKESO mengikut tetapan item dalam tab Item gaji.")}{" "}
        <Link href="/pengurusan/gaji/item" className="font-bold">
          {tr("Urus item ›")}
        </Link>
      </span>
      {ralat && <ErrorBox message={ralat} />}
      {ok && <span className="text-sm font-semibold text-success">{ok}</span>}
      <ButangUtama onClick={simpan} busy={busy}>
        {tr("Simpan")}</ButangUtama>
    </Lembaran>
  );
}

function Langkah2({ data, reload }: { data: Data; reload: () => void }) {
  const j = (data.run.totals ?? {}) as unknown as Jumlah;
  const diff = useData(() => getPerbezaan(data.run.id), [data.run.id]);
  const slip = useData(
    async () =>
      must(
        await getSupabase()
          .from("payslips")
          .select("id, gross, net, employment_id, employments(employee_no, persons!employments_person_id_fkey(preferred_name, full_name))")
          .eq("payroll_run_id", data.run.id),
      ) ?? [],
    [data.run.id],
  );
  const [semua, setSemua] = useState(false);
  const [busy, setBusy] = useState<null | "kira" | "hantar">(null);
  const [ralat, setRalat] = useState<string | null>(null);
  const catatan = (id: string) => (diff.data ?? []).find((x) => x.employment_id === id)?.note ?? null;
  const senarai = [...(slip.data ?? [])].sort((a, b) => Number(!!catatan(b.employment_id)) - Number(!!catatan(a.employment_id)));
  const tunjuk = semua ? senarai : senarai.slice(0, 8);

  async function buat(k: "kira" | "hantar") {
    setBusy(k);
    setRalat(null);
    try {
      if (k === "kira") await kiraGaji(data.run.id);
      else await hantarKelulusan(data.run.id);
      reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
    setBusy(null);
  }

  return (
    <>
      <main className="flex grow flex-col gap-3 px-4 pt-4 pb-4">
        {data.run.status === "returned" && <span className="rounded-[14px] bg-warning-soft px-4 py-3 text-[13px] text-warning">{tr("Gaji dikembalikan oleh pelulus. Semak, kira semula dan hantar sekali lagi.")}</span>}
        <div className="flex flex-col gap-3 rounded-card bg-surface px-4 py-4">
          <span className="flex flex-col">
            <span className="text-xs font-bold tracking-[0.04em] text-muted">{tr("GAJI BERSIH DIBAYAR KEPADA {0} PEKERJA", j.headcount)}</span>
            <b className="text-[26px] font-extrabold">{rm(j.net)}</b>
          </span>
          <div className="grid grid-cols-3 gap-2 border-t border-[#EEF2F1] pt-3 text-[13px]">
            <span className="flex flex-col">
              <span className="text-muted">{tr("Jumlah kasar")}</span>
              <b>{rm(j.gross)}</b>
            </span>
            <span className="flex flex-col">
              <span className="text-muted">{tr("Caruman majikan")}</span>
              <b>{rm(j.employer)}</b>
            </span>
            <span className="flex flex-col">
              <span className="text-muted">PCB</span>
              <b>{rm(j.pcb)}</b>
            </span>
          </div>
        </div>
        <PanelBendera runId={data.run.id} />
        <PanelLaporanPekerja runId={data.run.id} />
        <section aria-label={tr("Slip pekerja")} className="flex flex-col gap-2">
          <Seksyen className="pt-1">{tr("SLIP PEKERJA ({0})", senarai.length)}</Seksyen>
          <div className="flex flex-col rounded-card bg-surface px-4 text-sm [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
            {tunjuk.map((x) => {
              const c = catatan(x.employment_id);
              return (
                <Link key={x.id} href={`/pengurusan/gaji/slip/${x.id}`} className="flex min-h-12 items-center gap-3 py-2 text-ink!">
                  <span className="flex min-w-0 grow flex-col">
                    <b>{x.employments?.persons?.preferred_name || x.employments?.persons?.full_name}</b>
                    {c && <span className="text-xs text-muted">{c}</span>}
                  </span>
                  <span className="text-right text-[13px] text-muted">{rm(x.gross)}</span>
                  <b className="w-28 text-right">{rm(x.net)}</b>
                </Link>
              );
            })}
          </div>
          {senarai.length > 8 && (
            <button type="button" onClick={() => setSemua(!semua)} className="self-start py-1 text-sm font-bold text-primary">
              {semua ? tr("Tunjuk sebahagian") : tr("Lihat semua {0} slip", senarai.length)}
            </button>
          )}
          <span className="text-xs text-muted">{tr("Kasar · bersih. Tekan nama untuk melihat slip penuh.")}</span>
        </section>
        <Lanjut>
          <PanelVarians runId={data.run.id} ym={`${data.run.period_year}${String(data.run.period_month).padStart(2, "0")}`} />
          <SuisPratonton companyId={data.run.company_id} />
        </Lanjut>
        {ralat && <ErrorBox message={ralat} />}
      </main>
      <div className="bar-bawah sticky bottom-0 flex flex-col gap-2 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
        <div className="grid grid-cols-[auto_1fr] gap-2.5">
          <button type="button" disabled={!!busy} onClick={() => buat("kira")} className="h-12 rounded-button border-2 border-primary px-4 text-sm font-extrabold text-primary disabled:opacity-60">
            {busy === "kira" ? tr("Mengira…") : tr("Kira semula")}
          </button>
          <ButangUtama onClick={() => buat("hantar")} busy={busy === "hantar"}>
            {tr("Hantar untuk kelulusan")}
          </ButangUtama>
        </div>
        <span className="text-center text-xs text-muted">{tr("Pelulus: {0}. Mereka menerima WhatsApp bersama ringkasan ini.", data.aliran.join(" → ") || tr("CEO → Kewangan"))}</span>
      </div>
    </>
  );
}

/** Bahagian "Pilihan lanjut": alat yang jarang digunakan disorok supaya langkah utama jelas. */
function Lanjut({ children }: { children: React.ReactNode }) {
  const [buka, setBuka] = useState(false);
  return (
    <section className="flex flex-col gap-3">
      <button type="button" aria-expanded={buka} onClick={() => setBuka(!buka)} className="flex min-h-11 items-center gap-2 self-start text-sm font-bold text-[#4A5A57]">
        <span aria-hidden className="text-primary">
          {buka ? "−" : "+"}
        </span>
        {tr("Pilihan lanjut")}
      </button>
      {buka && children}
    </section>
  );
}

const GAYA_BENDERA: Record<BenderaGaji["level"], { kotak: string; label: string }> = {
  ralat: { kotak: "bg-danger-soft text-danger", label: tr("Mesti dibaiki") },
  amaran: { kotak: "bg-warning-soft text-warning", label: tr("Semak") },
  maklumat: { kotak: "bg-[#E3F1EE] text-primary", label: tr("Untuk makluman") },
};

/** Semakan pintar selepas kira: setiap bendera disertakan penjelasan supaya HR tahu apa yang perlu disemak. */
function PanelBendera({ runId }: { runId: string }) {
  const f = useData(() => getBenderaGaji(runId), [runId]);
  const senarai = f.data ?? [];
  if (f.loading && !f.data) return null;
  if (!senarai.length)
    return <div className="rounded-card bg-success-soft px-4 py-3 text-[13px] font-semibold text-success">{tr("Semakan pintar: tiada perkara luar biasa ditemui.")}</div>;
  return (
    <section aria-label={tr("Semakan pintar")} className="flex flex-col gap-2">
      <Seksyen className="pt-1">{tr("PERLU DISEMAK ({0})", senarai.length)}</Seksyen>
      {(["ralat", "amaran", "maklumat"] as const).map((lv) => {
        const xs = senarai.filter((b) => b.level === lv);
        if (!xs.length) return null;
        return (
          <div key={lv} className={`flex flex-col gap-1 rounded-card px-4 py-3 text-[13px] ${GAYA_BENDERA[lv].kotak}`}>
            <b>
              {GAYA_BENDERA[lv].label} ({xs.length})
            </b>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {xs.map((b, i) => (
                <li key={i} className="leading-snug">
                  <Link href={`/pengurusan/pekerja/${b.employment_id}`} className="font-bold text-inherit! underline-offset-2 hover:underline">
                    {b.name}
                  </Link>
                  : {b.message}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

/** Laporan kesilapan daripada pekerja yang melihat pratonton slip. */
function PanelLaporanPekerja({ runId }: { runId: string }) {
  const d = useData(() => getLaporanSlip(runId), [runId]);
  const xs = d.data ?? [];
  if (!xs.length) return null;
  const terbuka = xs.filter((x) => !x.resolved_at).length;
  async function selesai(id: string, nama: string) {
    const n = await mintaTeks({ tajuk: tr("Selesaikan laporan {0}", nama), label: tr("Nota kepada pekerja (pilihan)"), ok: tr("Tanda selesai"), wajib: false });
    if (n === null) return;
    try {
      await selesaikanLaporan(id, n);
      beritahu(tr("{0} dimaklumkan melalui WhatsApp.", nama));
      d.reload();
    } catch (e) {
      beritahu(e instanceof Error ? e.message : tr("Ralat"), "ralat");
    }
  }
  return (
    <section aria-label={tr("Laporan daripada pekerja")} className="flex flex-col gap-2">
      <Seksyen className="pt-1">{tr("LAPORAN DARIPADA PEKERJA ({0} belum selesai)", terbuka)}</Seksyen>
      <div className="flex flex-col rounded-card bg-surface px-4 text-sm [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
        {xs.map((x) => (
          <div key={x.id} className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
            <span className="flex min-w-0 grow basis-60 flex-col gap-0.5">
              <Link href={`/pengurusan/pekerja/${x.employment_id}`} className="font-bold text-ink!">
                {x.name}
              </Link>
              <span className={x.resolved_at ? "text-muted" : ""}>{tr("“")}{x.message}{tr("”")}</span>
              {x.resolved_at && <span className="text-xs text-success">{tr("Selesai{0}", x.resolution ? ` — ${x.resolution}` : "")}</span>}
            </span>
            {!x.resolved_at && (
              <button type="button" onClick={() => selesai(x.id, x.name)} className="flex h-9 items-center rounded-full border border-line px-3 text-xs font-bold text-primary">
                {tr("Tanda selesai")}</button>
            )}
          </div>
        ))}
      </div>
      {terbuka > 0 && <span className="text-xs text-muted">{tr("Betulkan data (gaji pekerja, komisen, cuti), tekan Kira semula, kemudian tanda selesai.")}</span>}
    </section>
  );
}

function SuisPratonton({ companyId }: { companyId: string }) {
  const d = useData(() => getTetapanPratonton(companyId), [companyId]);
  if (d.data === null || d.data === undefined) return null;
  return (
    <div className="flex items-center gap-3 rounded-card bg-surface px-4 py-2">
      <span className="flex grow flex-col gap-0.5">
        <b className="text-sm font-bold">{tr("Pekerja boleh pratonton slip")}</b>
        <span className="text-xs leading-snug text-muted">{tr("Pekerja melihat slip draf mereka sebelum kelulusan dan boleh melaporkan kesilapan.")}</span>
      </span>
      <Suis
        on={d.data}
        label={tr("Pekerja boleh pratonton slip")}
        onChange={async (v) => {
          try {
            await setTetapanPratonton(companyId, v);
            beritahu(v ? "Pratonton slip dihidupkan." : "Pratonton slip dimatikan.");
            d.reload();
          } catch (e) {
            beritahu(e instanceof Error ? e.message : "Ralat", "ralat");
          }
        }}
      />
    </div>
  );
}

/** Buka semula gaji (perlu dikira & diluluskan semula). */
async function bukaSemulaGaji(runId: string, reload: () => void) {
  const sebab = await mintaTeks({
    tajuk: tr("Buka semula gaji?"),
    mesej: tr("Gaji akan kembali ke Langkah 2 untuk dibetulkan, dikira dan diluluskan semula. Slip yang telah dilepaskan akan ditarik balik."),
    label: tr("Sebab buka semula"),
    ok: tr("Buka semula"),
    bahaya: true,
  });
  if (!sebab) return;
  try {
    await bukaSemula(runId, sebab);
    beritahu(tr("Gaji dibuka semula."));
    reload();
  } catch (e) {
    beritahu(e instanceof Error ? e.message : tr("Ralat"), "ralat");
  }
}

/** Laporan varians: setiap pekerja berbanding bulan lepas (kasar, bersih, KWSP, PCB) + CSV. */
function PanelVarians({ runId, ym }: { runId: string; ym: string }) {
  const [buka, setBuka] = useState(false);
  const d = useData(() => (buka ? getVarians(runId) : Promise.resolve(null)), [runId, buka]);
  const xs = (d.data ?? []).filter((v) => v.status !== "sama");
  const LABEL: Record<Varians["status"], string> = { baharu: tr("Baharu"), berhenti: tr("Berhenti"), berubah: tr("Berubah"), sama: tr("Sama") };
  function csv() {
    const baris = [
      [tr("No. pekerja"), tr("Nama"), tr("Status"), tr("Kasar lalu"), tr("Kasar"), tr("Bersih lalu"), tr("Bersih"), tr("KWSP lalu"), "KWSP", tr("PCB lalu"), "PCB", tr("Catatan")],
      ...(d.data ?? []).map((v) => [v.employee_no, v.name, LABEL[v.status], v.prev_gross, v.gross, v.prev_net, v.net, v.prev_epf, v.epf, v.prev_pcb, v.pcb, v.note ?? ""]),
    ];
    muatTurunTeks(baris.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n"), `varians-gaji-${ym}.csv`, true);
  }
  return (
    <section aria-label={tr("Laporan varians")} className="flex flex-col gap-2">
      <button type="button" onClick={() => setBuka(!buka)} className="flex min-h-11 items-center justify-between rounded-card bg-surface px-4 text-left text-sm font-bold">
        <span>{tr("Laporan varians (berbanding bulan lepas)")}</span>
        <span aria-hidden className="text-primary">
          {buka ? "−" : "+"}
        </span>
      </button>
      {buka && d.loading && !d.data && <Loading />}
      {buka && d.data && (
        <>
          <div className="overflow-x-auto rounded-card bg-surface">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead className="text-xs text-muted">
                <tr className="[&>th]:px-3 [&>th]:py-2">
                  <th>{tr("Pekerja")}</th>
                  <th>{tr("Status")}</th>
                  <th className="text-right!">{tr("Kasar lalu")}</th>
                  <th className="text-right!">{tr("Kasar")}</th>
                  <th className="text-right!">{tr("Beza")}</th>
                  <th>{tr("Sebab")}</th>
                </tr>
              </thead>
              <tbody>
                {xs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-3 text-muted">
                      {tr("Tiada perubahan berbanding bulan lalu.")}
                    </td>
                  </tr>
                )}
                {xs.map((v) => {
                  const beza = (v.gross ?? 0) - (v.prev_gross ?? 0);
                  return (
                    <tr key={v.employment_id} className="border-t border-[#EEF2F1] [&>td]:px-3 [&>td]:py-2">
                      <td className="font-bold">{v.name}</td>
                      <td>
                        <Tag tone={v.status === "baharu" ? "primary" : v.status === "berhenti" ? "danger" : "warning"}>{LABEL[v.status]}</Tag>
                      </td>
                      <td className="text-right">{v.prev_gross === null ? "—" : rm(v.prev_gross)}</td>
                      <td className="text-right">{v.gross === null ? "—" : rm(v.gross)}</td>
                      <td className={`text-right font-bold ${beza < 0 ? "text-danger" : "text-success"}`}>
                        {beza > 0 ? "+" : ""}
                        {rm(beza)}
                      </td>
                      <td className="text-muted">{v.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={csv} className="self-start py-1 text-sm font-bold text-primary">
            {tr("Muat turun laporan varians (CSV)")}
          </button>
        </>
      )}
    </section>
  );
}

function Langkah3({ data, reload }: { data: Data; reload: () => void }) {
  const j = (data.run.totals ?? {}) as unknown as Jumlah;
  return (
    <main className="flex grow flex-col gap-3 px-4 pt-4 pb-6">
      <div className="flex flex-col items-center gap-2 rounded-card bg-surface px-4 py-6 text-center">
        <Tag tone="warning">{tr("Menunggu kelulusan")}</Tag>
        <b className="text-lg font-extrabold">{tr("{0} bersih · {1} pekerja", rm(j.net), j.headcount)}</b>
        <span className="text-sm text-muted">{tr("Aliran: {0}", data.aliran.join(" → "))}</span>
      </div>
      <PanelLaporanPekerja runId={data.run.id} />
      {data.run.approval_request_id && (
        <Link href={`/permohonan/${data.run.approval_request_id}`} className="flex h-12 items-center justify-center rounded-[14px] border border-line bg-surface text-sm font-bold">
          {tr("Lihat status kelulusan")}</Link>
      )}
      <button type="button" onClick={() => bukaSemulaGaji(data.run.id, reload)} className="flex h-12 items-center justify-center rounded-[14px] text-sm font-bold text-danger">
        {tr("Tarik balik & buka semula")}
      </button>
    </main>
  );
}

function Langkah4({ data, reload }: { data: Data; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const [tarikhBayar, setTarikhBayar] = useState(todayISO());
  const [failBank, setFailBank] = useState(false);
  const me = useMe();
  const dibayar = data.run.status !== "approved";
  const ym = `${data.run.period_year}${String(data.run.period_month).padStart(2, "0")}`;
  const j = (data.run.totals ?? {}) as unknown as Jumlah;

  async function turun(k: Parameters<typeof eksport>[1], fail: string) {
    setRalat(null);
    try {
      await eksport(data.run.id, k, fail);
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
  }
  const ymFail = data.run.kind === "additional" ? `${ym}-k${data.run.cycle_no}` : ym;

  async function bayar() {
    setBusy(true);
    setRalat(null);
    try {
      await tandaDibayar(data.run.id, tarikhBayar);
      reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
      setBusy(false);
    }
  }

  const failUtama = senaraiFail(data.tambahan).filter((f) => ["epf", "socso_txt", "pcb_txt"].includes(f.jenis));
  const failLain = senaraiFail(data.tambahan).filter((f) => !failUtama.includes(f));
  const NAMA_UTAMA: Record<string, string> = { epf: "KWSP", socso_txt: tr("PERKESO, SIP & SKBBK"), pcb_txt: tr("PCB (CP39)") };

  return (
    <>
      <main className="flex grow flex-col gap-3 px-4 pt-4 pb-4">
        <span className="rounded-[14px] bg-success-soft px-4 py-3 text-[13px] font-semibold text-success">
          {dibayar
            ? tr("Telah dibayar{0}. Slip gaji telah dihantar kepada {1} pekerja.", data.run.pay_date ? tr(" pada {0}", data.run.pay_date.split("-").reverse().join("/")) : "", j.headcount)
            : tr("Diluluskan oleh {0}. Ikut 3 langkah di bawah.", data.aliran.join(" dan "))}
        </span>

        <Tugasan n={1} siap={dibayar} tajuk={tr("Bayar gaji melalui bank")} nota={tr("Muat turun fail bayaran pukal ({0}) dan muat naik ke perbankan internet syarikat.", rm(j.net))}>
          <button type="button" onClick={() => setFailBank(true)} className="h-11 self-start rounded-[12px] border-[1.5px] border-primary px-4 text-sm font-bold text-primary">
            {tr("Fail bayaran bank")}
          </button>
        </Tugasan>

        <Tugasan
          n={2}
          siap={dibayar}
          tajuk={tr("Tandakan telah dibayar")}
          nota={dibayar ? tr("Slip gaji telah dihantar dan tuntutan ditanda dibayar.") : tr("Slip gaji dihantar ke WhatsApp {0} pekerja (tanpa jumlah dalam mesej) dan tuntutan {1} ditanda dibayar.", j.headcount, rm(j.claims))}
        >
          {!dibayar && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <span className="font-bold text-[#4A5A57]">{tr("Tarikh bayaran")}</span>
                <input type="date" value={tarikhBayar} onChange={(e) => setTarikhBayar(e.target.value)} className="h-11 rounded-[10px] border border-[#D5DEDC] bg-surface px-2.5 font-semibold" />
              </label>
              <button type="button" disabled={busy} onClick={bayar} className="h-11 rounded-[12px] bg-primary px-4 text-sm font-extrabold text-white disabled:opacity-60">
                {busy ? tr("Menyimpan…") : tr("Tandakan telah dibayar & hantar slip")}
              </button>
            </div>
          )}
        </Tugasan>

        <Tugasan n={3} tajuk={tr("Hantar caruman berkanun")} nota={tr("Muat naik fail ke portal masing-masing sebelum 15hb bulan berikutnya.")}>
          <div className="flex flex-col [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
            {failUtama.map((f) => (
              <div key={f.jenis} className="flex min-h-12 items-center gap-2 py-1.5 text-sm">
                <span className="flex grow flex-col">
                  <b>{NAMA_UTAMA[f.jenis]}</b>
                  <span className="text-xs text-muted">{f.s}</span>
                </span>
                <button type="button" onClick={() => turun(f.jenis, f.fail(ymFail))} className="h-10 rounded-[10px] border border-primary px-3 text-[13px] font-bold text-primary">
                  {tr("Muat turun")}
                </button>
              </div>
            ))}
          </div>
          {dibayar && <ResitPcb runId={data.run.id} awal={data.run.pcb_receipt_no} />}
        </Tugasan>
        {ralat && <ErrorBox message={ralat} />}

        <Lanjut>
          <Seksyen>{tr("FAIL LAIN")}</Seksyen>
          <div className="flex flex-col rounded-card bg-surface px-4 text-sm [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
            {failLain.map((f) => (
              <Fail key={f.jenis} t={f.t} s={f.s} onClick={() => turun(f.jenis, f.fail(ymFail))} />
            ))}
          </div>
          <span className="text-xs text-muted">{tr("Fail teks CP39 dan PERKESO gabungan mengikut susun atur yang diterbitkan; sahkan dengan spesifikasi rasmi terkini dan muat naik ujian sebelum gaji sebenar pertama. Setiap muat turun direkodkan.")}</span>
          <PanelLepasSlip run={data.run} reload={reload} />
          {!dibayar && <ResitPcb runId={data.run.id} awal={data.run.pcb_receipt_no} />}
          <button type="button" onClick={() => bukaSemulaGaji(data.run.id, reload)} className="flex min-h-11 items-center self-start text-sm font-bold text-danger">
            {tr("Buka semula gaji ini")}
          </button>
        </Lanjut>
      </main>
      {failBank && (
        <FailBank runId={data.run.id} companyId={data.run.company_id} companyCode={me.active?.companyCode ?? ""} tarikhAwal={data.run.pay_date ?? tarikhBayar} onClose={() => setFailBank(false)} />
      )}
    </>
  );
}

/** Satu langkah bernombor selepas gaji diluluskan. */
function Tugasan({ n, tajuk, nota, siap, children }: { n: number; tajuk: string; nota: string; siap?: boolean; children?: React.ReactNode }) {
  return (
    <section aria-label={tajuk} className="flex gap-3 rounded-card bg-surface px-4 py-3.5">
      <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${siap ? "bg-primary text-white" : "border-2 border-primary text-primary"}`}>{siap ? "✓" : n}</span>
      <div className="flex min-w-0 grow flex-col gap-2">
        <span className="flex flex-col gap-0.5">
          <b className="text-[15px] font-extrabold">{tajuk}</b>
          <span className="text-[13px] leading-snug text-muted">{nota}</span>
        </span>
        {children}
      </div>
    </section>
  );
}

function Fail({ t, s, onClick }: { t: string; s: string; onClick: () => void }) {
  return (
    <div className="flex min-h-12 items-center gap-2 py-2">
      <span className="flex grow flex-col">
        <b>{t}</b>
        <span className="text-xs text-muted">{s}</span>
      </span>
      <button type="button" onClick={onClick} className="h-10 rounded-[10px] border border-primary px-3 text-[13px] font-bold text-primary">
        {tr("Muat turun")}</button>
    </div>
  );
}

/** Lepaskan slip kepada pekerja: serta-merta, pada tarikh, atau tarik balik. */
function PanelLepasSlip({ run, reload }: { run: Data["run"]; reload: () => void }) {
  const [pada, setPada] = useState("");
  const [busy, setBusy] = useState(false);
  const lepas = run.payslip_release_at ? new Date(run.payslip_release_at) : null;
  const kelihatan = lepas && lepas <= new Date();
  async function buat(f: () => Promise<void>, ok: string) {
    setBusy(true);
    try {
      await f();
      beritahu(ok);
      reload();
    } catch (e) {
      beritahu(e instanceof Error ? e.message : tr("Ralat"), "ralat");
    }
    setBusy(false);
  }
  const masa = (d: Date) => d.toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <section aria-label={tr("Slip gaji pekerja")} className="flex flex-col gap-2">
      <Seksyen className="pt-1">{tr("SLIP GAJI PEKERJA")}</Seksyen>
      <div className="flex flex-col gap-2.5 rounded-card bg-surface px-4 py-3 text-sm">
        <span className={`font-bold ${kelihatan ? "text-success" : "text-warning"}`}>
          {kelihatan ? tr("Slip telah dilepaskan kepada pekerja ({0}).", masa(lepas!)) : lepas ? tr("Slip akan dilepaskan pada {0}.", masa(lepas)) : tr("Slip belum dilepaskan. Pekerja belum boleh melihat slip ini.")}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {!kelihatan && (
            <button type="button" disabled={busy} onClick={() => buat(() => lepasSlip(run.id, null), tr("Slip dilepaskan & pekerja dimaklumkan."))} className="h-10 rounded-[10px] bg-primary px-3.5 text-[13px] font-bold text-white disabled:opacity-60">
              {tr("Lepaskan sekarang")}
            </button>
          )}
          <input type="datetime-local" aria-label={tr("Tarikh & masa lepas slip")} value={pada} onChange={(e) => setPada(e.target.value)} className="h-10 rounded-[10px] border border-[#D5DEDC] bg-surface px-2.5 text-[13px] font-semibold" />
          <button
            type="button"
            disabled={busy || !pada}
            onClick={() => buat(() => lepasSlip(run.id, new Date(pada).toISOString()), tr("Tarikh lepas slip ditetapkan."))}
            className="h-10 rounded-[10px] border border-primary px-3.5 text-[13px] font-bold text-primary disabled:opacity-50"
          >
            {tr("Jadualkan")}
          </button>
          {lepas && (
            <button type="button" disabled={busy} onClick={() => buat(() => tarikBalikSlip(run.id), tr("Slip ditarik balik."))} className="h-10 rounded-[10px] px-3 text-[13px] font-bold text-danger disabled:opacity-60">
              {tr("Tarik balik")}
            </button>
          )}
        </div>
        <span className="text-xs text-muted">{tr("Pekerja dimaklumkan melalui WhatsApp apabila slip dilepaskan (tanpa jumlah dalam mesej).")}</span>
      </div>
    </section>
  );
}

/** No. resit bayaran PCB (untuk penyata PCB II pekerja). */
function ResitPcb({ runId, awal }: { runId: string; awal: string | null }) {
  const [v, setV] = useState(awal ?? "");
  const [ok, setOk] = useState(false);
  return (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-bold text-[#4A5A57]">{tr("No. resit bayaran PCB (LHDN)")}</span>
      <input
        value={v}
        onChange={(e) => {
          setV(e.target.value);
          setOk(false);
        }}
        className="h-10 min-w-0 grow rounded-[10px] border border-[#D5DEDC] bg-surface px-2.5 font-semibold"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await setResitPcb(runId, v);
            setOk(true);
          } catch (e) {
            beritahu(e instanceof Error ? e.message : tr("Ralat"), "ralat");
          }
        }}
        className="h-10 rounded-[10px] border border-primary px-3 text-[13px] font-bold text-primary"
      >
        {ok ? tr("Disimpan") : tr("Simpan")}
      </button>
    </label>
  );
}
