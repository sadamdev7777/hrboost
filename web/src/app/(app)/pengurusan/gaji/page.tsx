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
  muatTurun,
  getLaporanSlip,
  getTetapanPratonton,
  selesaikanLaporan,
  sediakanGaji,
  setPelarasan,
  setTetapanPratonton,
  tandaDibayar,
  type Jumlah,
} from "@/lib/gaji";
import { getSenaraiPekerja } from "@/lib/hr";
import { getBenderaGaji, type BenderaGaji } from "@/lib/berkanun";
import { namaPeringkat, todayISO } from "@/lib/format";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { PengepalaAkar, TabNav } from "@/components/TabNav";
import { TabGaji } from "@/components/TabGaji";
import { ButangBantuan, KadPanduan } from "@/components/Panduan";
import { useSearchParams } from "next/navigation";
import { ButangUtama, HadPeranan, Lembaran, MedanBorang, Seksyen, Suis, Tag, inputKecil } from "@/components/Senarai";
import { beritahu, mintaTeks } from "@/components/Dialog";

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
  const d = useData(async () => {
    const prep = await sediakanGaji(emp.companyId, tempoh.y, tempoh.m);
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
    return { prep, run, aliran };
  }, [emp.companyId, tempoh.y, tempoh.m]);

  const status = d.data?.run.status;
  const langkah = !status ? 0 : status === "draft" ? 1 : status === "calculated" || status === "returned" ? 2 : status === "pending" ? 3 : 4;

  return (
    <Screen>
      <PengepalaAkar
        title={tr("Penggajian")}
        action={
          <div className="mr-1 flex items-center gap-1">
            <ButangBantuan id="gaji" />
            <button type="button" aria-label={tr("Bulan sebelumnya")} onClick={() => setTempoh(geser(tempoh.y, tempoh.m, -1))} className="flex size-11 items-center justify-center rounded-full text-lg">
              ‹
            </button>
            <span className="flex h-9 items-center rounded-full bg-[#E3F1EE] px-3 text-[13px] font-extrabold whitespace-nowrap text-primary">{`${BULAN_PENUH[tempoh.m - 1].slice(0, 3)} ${tempoh.y}`}</span>
            <button type="button" aria-label={tr("Bulan seterusnya")} onClick={() => setTempoh(geser(tempoh.y, tempoh.m, 1))} className="flex size-11 items-center justify-center rounded-full text-lg">
              ›
            </button>
          </div>
        }
      />
      <TabGaji />
      <div className="px-4 pt-3 empty:hidden lg:px-0">
        <KadPanduan id="gaji" />
      </div>
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
      {d.data && status === "draft" && <Langkah1 data={d.data} reload={d.reload} />}
      {d.data && (status === "calculated" || status === "returned") && <Langkah2 data={d.data} reload={d.reload} />}
      {d.data && status === "pending" && <Langkah3 data={d.data} />}
      {d.data && (status === "approved" || status === "paid" || status === "locked") && <Langkah4 data={d.data} reload={d.reload} />}
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

type Data = { prep: Awaited<ReturnType<typeof sediakanGaji>>; run: Awaited<ReturnType<typeof getLarian>>; aliran: string[] };

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
        <Seksyen>{tr("DATA BULAN INI (AUTOMATIK)")}</Seksyen>
        <div className="flex flex-col rounded-card bg-surface px-4 text-sm [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
          <Baris k={tr("Pekerja aktif")} v={s.employees} />
          <Baris k={tr("Tuntutan yang diluluskan untuk dibayar")} v={`${s.claims} (${rm(s.claims_amount)})`} />
          <Baris k={tr("Cuti tanpa gaji")} v={tr("{0} orang", s.unpaid_leave_people)} />
          <div className="flex min-h-12 items-center justify-between gap-2">
            <span className="text-muted">{tr("Komisen / elaun bulan ini")}</span>
            <button type="button" onClick={() => setImport(true)} className="min-h-11 font-bold text-primary">
              {(adj.data ?? []).length ? tr("{0} orang · Ubah", new Set((adj.data ?? []).map((a) => a.employment_id)).size) : tr("Tambah")}
            </button>
          </div>
        </div>

        {!data.prep.statutory_ready && <ErrorBox message={tr("Jadual kadar berkanun belum dimuatkan untuk bulan ini. Hubungi Pentadbir Platform.")} />}
        <SemakanGaji checks={data.prep.checks} />
        <Seksyen className="pt-1">{tr("SELEPAS DILULUSKAN, SISTEM AKAN MENYEDIAKAN")}</Seksyen>
        <span className="text-[13px] leading-normal text-[#4A5A57]">{tr("Slip gaji (WhatsApp ke pekerja) · Fail bank pukal · KWSP · PERKESO/SIP · PCB (CP39) · Jurnal ke sistem perakaunan")}</span>
        {ralat && <ErrorBox message={ralat} />}
      </main>
      <div className="bar-bawah sticky bottom-0 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
        <ButangUtama onClick={kira} busy={busy} disabled={!data.prep.statutory_ready}>
          {tr("Kira Gaji")}</ButangUtama>
      </div>
      {import_ && <Pelarasan runId={data.run.id} companyId={me.active!.companyId} onClose={() => { setImport(false); adj.reload(); }} />}
    </>
  );
}

function Pelarasan({ runId, companyId, onClose }: { runId: string; companyId: string; onClose: () => void }) {
  const ppl = useData(() => getSenaraiPekerja(companyId), [companyId]);
  const [emp, setEmp] = useState("");
  const [kod, setKod] = useState("COMMISSION");
  const [amaun, setAmaun] = useState("");
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const pilih = emp || ppl.data?.[0]?.id || "";
  async function simpan() {
    setRalat(null);
    setBusy(true);
    try {
      await setPelarasan(runId, pilih, kod, Number(amaun) || 0);
      setOk(tr("Disimpan untuk {0}.", ppl.data?.find((p) => p.id === pilih)?.name));
      setAmaun("");
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
    setBusy(false);
  }
  return (
    <Lembaran title={tr("Komisen & elaun bulan ini")} onClose={onClose}>
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
        <MedanBorang label={tr("Jenis")}>
          <select className={inputKecil} value={kod} onChange={(e) => setKod(e.target.value)}>
            <option value="COMMISSION">{tr("Komisen")}</option>
            <option value="OT">{tr("Kerja lebih masa")}</option>
            <option value="ALLOWANCE">{tr("Elaun")}</option>
          </select>
        </MedanBorang>
        <MedanBorang label={tr("Jumlah (RM)")} nota={tr("0 = buang")}>
          <input className={inputKecil} inputMode="decimal" value={amaun} onChange={(e) => setAmaun(e.target.value.replace(/[^\d.]/g, ""))} />
        </MedanBorang>
      </div>
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
          <b>{tr("Aliran kelulusan gaji: {0}", data.aliran.join(" → ") || tr("Kewangan → CEO"))}</b>{tr(". Pelulus akan menerima WhatsApp bersama ringkasan di atas.")}</span>
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

function Langkah3({ data }: { data: Data }) {
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

  async function turun(k: "bank" | "epf" | "socso" | "pcb") {
    setRalat(null);
    try {
      await muatTurun(data.run.id, k, tr("{0}-{1}.csv", k === "bank" ? "bayaran-bank" : k === "epf" ? "kwsp" : k === "socso" ? "perkeso-sip" : "pcb-cp39", ym));
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
  }

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
          <Fail t={tr("Caruman KWSP")} s={tr("Data untuk i-Akaun Majikan")} onClick={() => turun("epf")} />
          <Fail t={tr("PERKESO & SIP")} s={tr("Data untuk ASSIST")} onClick={() => turun("socso")} />
          <Fail t={tr("PCB (CP39)")} s={tr("Data untuk e-PCB LHDN")} onClick={() => turun("pcb")} />
        </div>
        <span className="text-xs text-muted">{tr("Format fail rasmi setiap portal perlu disahkan sebelum gaji sebenar pertama. Setiap muat turun direkodkan.")}</span>
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
