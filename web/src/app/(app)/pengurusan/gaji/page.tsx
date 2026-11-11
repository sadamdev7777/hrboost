"use client";

import { tr, trRalat } from "@/lib/i18n";
import { FailBank } from "@/components/FailBank";
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
  const langkah = !status ? 0 : status === "draft" ? 1 : status === "calculated" || status === "returned" ? 2 : status === "pending" ? 3 : 4;

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
      <PilihKitaran
        senarai={senaraiKitaran.data ?? []}
        pilih={kitaran}
        onPilih={setKitaran}
        onTambah={async () => {
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
      />
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
      {d.data && status === "rejected" && (
        <main className="px-4 pt-4">
          <ErrorBox message={tr("Gaji bulan ini telah ditolak. Hubungi Kewangan / CEO.")} />
        </main>
      )}
      <TabNav />
    </Screen>
  );
}

/** Semakan sebelum kira, dikumpulkan: "Mesti dibaiki" (merah) dan "Amaran" (kuning), dengan pautan terus. */
function SemakanGaji({ checks }: { checks: string[] }) {
  const tiadaGaji = checks.filter((c) => c.includes("gaji pokok belum ditetapkan"));
  const terkumpul = checks.filter((c) => c.includes("tiada data terkumpul"));
  const lain = checks.filter((c) => !tiadaGaji.includes(c) && !terkumpul.includes(c));
  const nama = (xs: string[]) => xs.map((c) => c.split(":")[0]).join(", ");
  if (!checks.length)
    return <div className="rounded-card bg-success-soft px-4 py-3 text-[13px] font-semibold text-success">{tr("Semakan sebelum kira: tiada isu ditemui.")}</div>;
  return (
    <div className="flex flex-col gap-2">
      {tiadaGaji.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card bg-danger-soft px-4 py-3 text-[13px] text-danger">
          <b className="grow">
            {tr("Mesti dibaiki: {0} pekerja belum mempunyai gaji pokok ({1})", tiadaGaji.length, nama(tiadaGaji))}</b>
          <Link href="/pengurusan/gaji/pekerja" className="font-bold text-danger!">
            {tr("Tetapkan gaji ›")}</Link>
        </div>
      )}
      {terkumpul.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card bg-warning-soft px-4 py-3 text-[13px] text-warning">
          <span className="grow">
            <b>{tr("Amaran:")}</b> {" "}{tr("{0} pekerja tiada data gaji terkumpul tahun ini — PCB mungkin kurang tepat ({1}).", terkumpul.length, nama(terkumpul))}</span>
          <Link href="/pengurusan/gaji/data-terkumpul" className="flex min-h-11 items-center font-bold text-warning!">
            {tr("Isi atau import Excel ›")}</Link>
        </div>
      )}
      {lain.length > 0 && (
        <div className="flex flex-col gap-1 rounded-card bg-warning-soft px-4 py-3 text-[13px] text-warning">
          <b>{tr("Amaran ({0})", lain.length)}</b>
          <ul className="m-0 flex list-disc flex-col gap-0.5 pl-5">
            {lain.map((c, i) => (
              <li key={i}>{trRalat(c)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

type Data = { prep: Awaited<ReturnType<typeof sediakanGaji>>; run: Awaited<ReturnType<typeof getLarian>>; aliran: string[]; tambahan: boolean };

/** Kitaran gaji bulan ini: gaji bulanan + kitaran tambahan (bonus dll.). */
function PilihKitaran({ senarai, pilih, onPilih, onTambah }: { senarai: Awaited<ReturnType<typeof getKitaran>>; pilih: string | null; onPilih: (id: string | null) => void; onTambah: () => void }) {
  const tambahan = senarai.filter((k) => k.kind === "additional");
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
      <button type="button" onClick={onTambah} className="flex h-10 items-center rounded-full border border-dashed border-primary px-3.5 text-[13px] font-bold text-primary">
        {tr("+ Kitaran tambahan (bonus)")}
      </button>
    </div>
  );
}

/** Pekerja yang maklumat gajinya belum lengkap (no. KWSP, akaun bank, status perkahwinan…). */
function PanelKesediaan({ companyId }: { companyId: string }) {
  const k = useData(() => getKesediaan(companyId), [companyId]);
  const ppl = useData(() => getSenaraiPekerja(companyId), [companyId]);
  const xs = k.data ?? [];
  const [buka, setBuka] = useState(false);
  if (!xs.length) return null;
  const nama = (id: string) => ppl.data?.find((p) => p.id === id)?.name ?? "…";
  return (
    <div className="flex flex-col gap-1 rounded-card bg-warning-soft px-4 py-3 text-[13px] text-warning">
      <button type="button" onClick={() => setBuka(!buka)} className="flex min-h-9 items-center justify-between gap-2 text-left font-bold text-warning">
        <span>{tr("Maklumat gaji tidak lengkap: {0} pekerja", xs.length)}</span>
        <span aria-hidden>{buka ? "−" : "+"}</span>
      </button>
      {buka && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {xs.map((x) => (
            <li key={x.employment_id}>
              <Link href={`/pengurusan/pekerja/${x.employment_id}`} className="font-bold text-inherit! underline-offset-2 hover:underline">
                {nama(x.employment_id)}
              </Link>
              : {x.missing.map((m) => trRalat(m)).join(", ")}
            </li>
          ))}
        </ul>
      )}
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
        <div className="flex flex-col rounded-card bg-surface px-4 text-sm [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
          <Baris k={tr("Pekerja aktif")} v={s.employees} />
          <Baris k={tr("Tuntutan yang diluluskan untuk dibayar")} v={`${s.claims} (${rm(s.claims_amount)})`} />
          <Baris k={tr("Cuti tanpa gaji")} v={tr("{0} orang", s.unpaid_leave_people)} />
        </div>
        <SenaraiPelarasan runId={data.run.id} companyId={data.run.company_id} onTambah={() => setImport(true)} data={adj.data ?? []} reload={adj.reload} />
        <PanelKesediaan companyId={data.run.company_id} />

        {!data.prep.statutory_ready && <ErrorBox message={tr("Jadual kadar berkanun belum dimuatkan untuk bulan ini. Hubungi Pentadbir Platform.")} />}
        <SemakanGaji checks={data.prep.checks} />
        <Seksyen className="pt-1">{tr("SELEPAS DILULUSKAN, SISTEM AKAN MENYEDIAKAN")}</Seksyen>
        <span className="text-[13px] leading-normal text-[#4A5A57]">{tr("Slip gaji (WhatsApp ke pekerja) · Fail bank pukal · KWSP · PERKESO/SIP · PCB (CP39) · Jurnal ke sistem perakaunan")}</span>
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
        <Seksyen className="grow">{tr("ITEM BULAN INI SAHAJA ({0})", data.length)}</Seksyen>
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
          .select("id, net, employments(employee_no, persons!employments_person_id_fkey(preferred_name, full_name))")
          .eq("payroll_run_id", data.run.id),
      ) ?? [],
    [data.run.id],
  );
  const [lihat, setLihat] = useState(false);
  const [busy, setBusy] = useState<null | "kira" | "hantar">(null);
  const [ralat, setRalat] = useState<string | null>(null);

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
        <div className="grid grid-cols-2 gap-2">
          <Angka k={tr("Jumlah kasar")} v={rm(j.gross)} />
          <Angka k={tr("Jumlah bersih")} v={rm(j.net)} />
          <Angka k={tr("Caruman majikan")} v={rm(j.employer)} />
          <Angka k="PCB" v={rm(j.pcb)} />
        </div>
        <PanelBendera runId={data.run.id} />
        <PanelLaporanPekerja runId={data.run.id} />
        <Seksyen className="pt-1">{j.previous_run ? tr("BERBEZA DARIPADA BULAN LALU") : "PERUBAHAN"}</Seksyen>
        <div className="flex flex-col rounded-card bg-surface px-4 text-sm [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
          {(diff.data ?? []).length === 0 && <span className="py-3 text-muted">{tr("Tiada perubahan berbanding bulan lalu.")}</span>}
          {(diff.data ?? []).slice(0, 8).map((x) => (
            <div key={x.employment_id} className="flex min-h-12 items-center justify-between gap-3 py-2">
              <b>{x.name}</b>
              <span className="text-right text-[13px] text-muted">{x.note}</span>
            </div>
          ))}
        </div>
        <PanelVarians runId={data.run.id} ym={`${data.run.period_year}${String(data.run.period_month).padStart(2, "0")}`} />
        <button type="button" onClick={() => setLihat(!lihat)} className="self-start py-2 text-sm font-bold text-primary">
          {lihat ? tr("Sembunyikan slip") : tr("Lihat semua {0} slip (pratonton)", j.headcount)}
        </button>
        {lihat && (
          <div className="flex flex-col rounded-card bg-surface px-4 text-sm [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
            {(slip.data ?? []).map((s) => (
              <Link key={s.id} href={`/pengurusan/gaji/slip/${s.id}`} className="flex min-h-12 items-center justify-between text-ink!">
                <span>
                  {s.employments?.persons?.preferred_name || s.employments?.persons?.full_name} · {s.employments?.employee_no}
                </span>
                <b>{rm(s.net)}</b>
              </Link>
            ))}
          </div>
        )}
        <SuisPratonton companyId={data.run.company_id} />
        <span className="rounded-[14px] bg-[#E3F1EE] px-4 py-3 text-[13px] leading-normal text-primary">
          <b>{tr("Aliran kelulusan gaji: {0}", data.aliran.join(" → ") || tr("CEO → Kewangan"))}</b>{tr(". Pelulus akan menerima WhatsApp bersama ringkasan di atas.")}</span>
        {ralat && <ErrorBox message={ralat} />}
      </main>
      <div className="bar-bawah sticky bottom-0 grid grid-cols-[auto_1fr] gap-2.5 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
        <button type="button" disabled={!!busy} onClick={() => buat("kira")} className="h-12 rounded-button border-2 border-primary px-4 text-sm font-extrabold text-primary disabled:opacity-60">
          {busy === "kira" ? tr("Mengira…") : tr("Kira semula")}
        </button>
        <ButangUtama onClick={() => buat("hantar")} busy={busy === "hantar"}>
          {tr("Hantar untuk kelulusan")}</ButangUtama>
      </div>
    </>
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
      <Seksyen className="pt-1">{tr("SEMAKAN PINTAR ({0})", senarai.length)}</Seksyen>
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

  return (
    <>
      <main className="flex grow flex-col gap-3 px-4 pt-4 pb-4">
        <span className="rounded-[14px] bg-success-soft px-4 py-3 text-[13px] font-semibold text-success">
          {dibayar
            ? tr("Telah dibayar{0}. Slip gaji telah dihantar kepada {1} pekerja.", data.run.pay_date ? tr(" pada {0}", data.run.pay_date.split("-").reverse().join("/")) : "", j.headcount)
            : tr("Diluluskan oleh {0}.", data.aliran.join(" dan "))}
        </span>
        <Seksyen>{tr("MUAT TURUN")}</Seksyen>
        <div className="flex flex-col rounded-card bg-surface px-4 text-sm [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
          <Fail t={tr("Fail bayaran bank")} s={tr("Format Maybank2u Biz, CIMB BizChannel atau bank lain")} onClick={() => setFailBank(true)} />
          {senaraiFail(data.tambahan).map((f) => (
            <Fail key={f.jenis} t={f.t} s={f.s} onClick={() => turun(f.jenis, f.fail(ymFail))} />
          ))}
        </div>
        <span className="text-xs text-muted">{tr("Fail teks CP39 dan PERKESO gabungan mengikut susun atur yang diterbitkan; sahkan dengan spesifikasi rasmi terkini dan muat naik ujian sebelum gaji sebenar pertama. Setiap muat turun direkodkan.")}</span>
        <PanelLepasSlip run={data.run} reload={reload} />
        <ResitPcb runId={data.run.id} awal={data.run.pcb_receipt_no} />
        {!dibayar && (
          <>
            <Seksyen className="pt-1">{tr("AUTOMATIK APABILA ANDA MENANDAKAN \"TELAH DIBAYAR\"")}</Seksyen>
            <div className="flex flex-col rounded-card bg-surface px-4 text-sm [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              <Baris k={tr("Slip gaji ke WhatsApp {0} pekerja", j.headcount)} v={tr("Tanpa jumlah dalam mesej")} />
              <Baris k={tr("Tuntutan ditanda dibayar")} v={rm(j.claims)} />
              <Baris k={tr("Jurnal gaji ke sistem perakaunan")} v={tr("Mengikut Tetapan")} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <span className="font-bold text-[#4A5A57]">{tr("Tarikh bayaran")}</span>
              <input type="date" value={tarikhBayar} onChange={(e) => setTarikhBayar(e.target.value)} className="h-10 rounded-[10px] border border-[#D5DEDC] bg-surface px-2.5 font-semibold" />
            </label>
          </>
        )}
        {ralat && <ErrorBox message={ralat} />}
      </main>
      <div className="flex justify-center px-4 pb-4">
        <button type="button" onClick={() => bukaSemulaGaji(data.run.id, reload)} className="flex min-h-11 items-center px-3 text-sm font-bold text-danger">
          {tr("Buka semula gaji ini")}
        </button>
      </div>
      {!dibayar && (
        <div className="bar-bawah sticky bottom-0 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
          <ButangUtama onClick={bayar} busy={busy}>
            {tr("Tandakan telah dibayar & hantar slip")}</ButangUtama>
        </div>
      )}
      {failBank && (
        <FailBank runId={data.run.id} companyId={data.run.company_id} companyCode={me.active?.companyCode ?? ""} tarikhAwal={data.run.pay_date ?? tarikhBayar} onClose={() => setFailBank(false)} />
      )}
    </>
  );
}

function Baris({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-2">
      <span className="text-muted">{k}</span>
      <b className="text-right">{v}</b>
    </div>
  );
}

function Angka({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[14px] bg-surface px-3.5 py-3">
      <span className="text-xs text-muted">{k}</span>
      <b className="text-lg font-extrabold">{v}</b>
    </div>
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
