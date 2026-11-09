"use client";

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
  sediakanGaji,
  setPelarasan,
  tandaDibayar,
  type Jumlah,
} from "@/lib/gaji";
import { getSenaraiPekerja } from "@/lib/hr";
import { namaPeringkat, todayISO } from "@/lib/format";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { PengepalaAkar } from "@/components/TabNav";
import { TabGaji } from "@/components/TabGaji";
import { useSearchParams } from "next/navigation";
import { ButangUtama, HadPeranan, Lembaran, MedanBorang, Seksyen, Tag, inputKecil } from "@/components/Senarai";

const rm = (n: number | string | null | undefined) => `RM ${Number(n ?? 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const LANGKAH = ["Semak data", "Kira", "Kelulusan", "Bayar & hantar"];

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
        backHr="/pengurusan"
        title={`Gaji ${BULAN_PENUH[tempoh.m - 1].slice(0, 3)} ${tempoh.y}`}
        action={
          <div className="mr-1 flex items-center gap-1">
            <button type="button" aria-label="Bulan sebelumnya" onClick={() => setTempoh(geser(tempoh.y, tempoh.m, -1))} className="flex size-11 items-center justify-center rounded-full text-lg">
              ‹
            </button>
            <span className="flex h-9 items-center rounded-full bg-[#E3F1EE] px-3 text-[13px] font-extrabold text-primary">{emp.companyCode}</span>
            <button type="button" aria-label="Bulan seterusnya" onClick={() => setTempoh(geser(tempoh.y, tempoh.m, 1))} className="flex size-11 items-center justify-center rounded-full text-lg">
              ›
            </button>
          </div>
        }
      />
      <TabGaji />
      <ol className="mx-5 mt-4 grid grid-cols-4 gap-1.5 lg:mx-0" aria-label="Langkah proses gaji">
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
          <ErrorBox message="Gaji bulan ini telah ditolak. Hubungi Kewangan / CEO." />
        </main>
      )}
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
    return <div className="rounded-card bg-success-soft px-4 py-3 text-[13px] font-semibold text-success">Semakan sebelum kira: tiada isu ditemui.</div>;
  return (
    <div className="flex flex-col gap-2">
      {tiadaGaji.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card bg-danger-soft px-4 py-3 text-[13px] text-danger">
          <b className="grow">
            Mesti dibaiki: {tiadaGaji.length} pekerja belum mempunyai gaji pokok ({nama(tiadaGaji)})
          </b>
          <Link href="/pengurusan/gaji/pekerja" className="font-bold text-danger!">
            Tetapkan gaji ›
          </Link>
        </div>
      )}
      {terkumpul.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card bg-warning-soft px-4 py-3 text-[13px] text-warning">
          <span className="grow">
            <b>Amaran:</b> {terkumpul.length} pekerja tiada data gaji terkumpul tahun ini — PCB mungkin kurang tepat ({nama(terkumpul)}).
          </span>
          <Link href="/pengurusan/gaji/data-terkumpul" className="font-bold text-warning!">
            Isi sekarang ›
          </Link>
        </div>
      )}
      {lain.length > 0 && (
        <div className="flex flex-col gap-1 rounded-card bg-warning-soft px-4 py-3 text-[13px] text-warning">
          <b>Amaran ({lain.length})</b>
          <ul className="m-0 flex list-disc flex-col gap-0.5 pl-5">
            {lain.map((c, i) => (
              <li key={i}>{c}</li>
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
      setRalat(e instanceof Error ? e.message : "Ralat");
      setBusy(false);
    }
  }

  return (
    <>
      <main className="flex grow flex-col gap-3 px-4 pt-4 pb-4">
        <Seksyen>DATA BULAN INI (AUTOMATIK)</Seksyen>
        <div className="flex flex-col rounded-card bg-surface px-4 text-sm [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
          <Baris k="Pekerja aktif" v={s.employees} />
          <Baris k="Tuntutan yang diluluskan untuk dibayar" v={`${s.claims} (${rm(s.claims_amount)})`} />
          <Baris k="Cuti tanpa gaji" v={`${s.unpaid_leave_people} orang`} />
          <div className="flex min-h-12 items-center justify-between gap-2">
            <span className="text-muted">Komisen / elaun bulan ini</span>
            <button type="button" onClick={() => setImport(true)} className="min-h-11 font-bold text-primary">
              {(adj.data ?? []).length ? `${new Set((adj.data ?? []).map((a) => a.employment_id)).size} orang · Ubah` : "Tambah"}
            </button>
          </div>
        </div>

        {!data.prep.statutory_ready && <ErrorBox message="Jadual kadar berkanun belum dimuatkan untuk bulan ini. Hubungi Pentadbir Platform." />}
        <SemakanGaji checks={data.prep.checks} />
        <Seksyen className="pt-1">SELEPAS DILULUSKAN, SISTEM AKAN MENYEDIAKAN</Seksyen>
        <span className="text-[13px] leading-normal text-[#4A5A57]">Slip gaji (WhatsApp ke pekerja) · Fail bank pukal · KWSP · PERKESO/SIP · PCB (CP39) · Jurnal ke sistem perakaunan</span>
        {ralat && <ErrorBox message={ralat} />}
      </main>
      <div className="bar-bawah sticky bottom-0 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
        <ButangUtama onClick={kira} busy={busy} disabled={!data.prep.statutory_ready}>
          Kira Gaji
        </ButangUtama>
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
      setOk(`Disimpan untuk ${ppl.data?.find((p) => p.id === pilih)?.name}.`);
      setAmaun("");
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
    }
    setBusy(false);
  }
  return (
    <Lembaran title="Komisen & elaun bulan ini" onClose={onClose}>
      <MedanBorang label="Pekerja">
        <select className={inputKecil} value={pilih} onChange={(e) => setEmp(e.target.value)}>
          {(ppl.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.employeeNo}
            </option>
          ))}
        </select>
      </MedanBorang>
      <div className="grid grid-cols-2 gap-2.5">
        <MedanBorang label="Jenis">
          <select className={inputKecil} value={kod} onChange={(e) => setKod(e.target.value)}>
            <option value="COMMISSION">Komisen</option>
            <option value="OT">Kerja lebih masa</option>
            <option value="ALLOWANCE">Elaun</option>
          </select>
        </MedanBorang>
        <MedanBorang label="Jumlah (RM)" nota="0 = buang">
          <input className={inputKecil} inputMode="decimal" value={amaun} onChange={(e) => setAmaun(e.target.value.replace(/[^\d.]/g, ""))} />
        </MedanBorang>
      </div>
      {ralat && <ErrorBox message={ralat} />}
      {ok && <span className="text-sm font-semibold text-success">{ok}</span>}
      <ButangUtama onClick={simpan} busy={busy}>
        Simpan
      </ButangUtama>
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
      setRalat(e instanceof Error ? e.message : "Ralat");
    }
    setBusy(null);
  }

  return (
    <>
      <main className="flex grow flex-col gap-3 px-4 pt-4 pb-4">
        {data.run.status === "returned" && <span className="rounded-[14px] bg-warning-soft px-4 py-3 text-[13px] text-warning">Gaji dikembalikan oleh pelulus. Semak, kira semula dan hantar sekali lagi.</span>}
        <div className="grid grid-cols-2 gap-2">
          <Angka k="Jumlah kasar" v={rm(j.gross)} />
          <Angka k="Jumlah bersih" v={rm(j.net)} />
          <Angka k="Caruman majikan" v={rm(j.employer)} />
          <Angka k="PCB" v={rm(j.pcb)} />
        </div>
        <Seksyen className="pt-1">{j.previous_run ? "BERBEZA DARIPADA BULAN LALU" : "PERUBAHAN"}</Seksyen>
        <div className="flex flex-col rounded-card bg-surface px-4 text-sm [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
          {(diff.data ?? []).length === 0 && <span className="py-3 text-muted">Tiada perubahan berbanding bulan lalu.</span>}
          {(diff.data ?? []).slice(0, 8).map((x) => (
            <div key={x.employment_id} className="flex min-h-12 items-center justify-between gap-3 py-2">
              <b>{x.name}</b>
              <span className="text-right text-[13px] text-muted">{x.note}</span>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setLihat(!lihat)} className="self-start py-2 text-sm font-bold text-primary">
          {lihat ? "Sembunyikan slip" : `Lihat semua ${j.headcount} slip (pratonton)`}
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
        <span className="rounded-[14px] bg-[#E3F1EE] px-4 py-3 text-[13px] leading-normal text-primary">
          <b>Aliran kelulusan gaji: {data.aliran.join(" → ") || "Kewangan → CEO"}</b>. Pelulus akan menerima WhatsApp bersama ringkasan di atas.
        </span>
        {ralat && <ErrorBox message={ralat} />}
      </main>
      <div className="bar-bawah sticky bottom-0 grid grid-cols-[auto_1fr] gap-2.5 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
        <button type="button" disabled={!!busy} onClick={() => buat("kira")} className="h-12 rounded-button border-2 border-primary px-4 text-sm font-extrabold text-primary disabled:opacity-60">
          {busy === "kira" ? "Mengira…" : "Kira semula"}
        </button>
        <ButangUtama onClick={() => buat("hantar")} busy={busy === "hantar"}>
          Hantar untuk kelulusan
        </ButangUtama>
      </div>
    </>
  );
}

function Langkah3({ data }: { data: Data }) {
  const j = (data.run.totals ?? {}) as unknown as Jumlah;
  return (
    <main className="flex grow flex-col gap-3 px-4 pt-4 pb-6">
      <div className="flex flex-col items-center gap-2 rounded-card bg-surface px-4 py-6 text-center">
        <Tag tone="warning">Menunggu kelulusan</Tag>
        <b className="text-lg font-extrabold">{rm(j.net)} bersih · {j.headcount} pekerja</b>
        <span className="text-sm text-muted">Aliran: {data.aliran.join(" → ")}</span>
      </div>
      {data.run.approval_request_id && (
        <Link href={`/permohonan/${data.run.approval_request_id}`} className="flex h-12 items-center justify-center rounded-[14px] border border-line bg-surface text-sm font-bold">
          Lihat status kelulusan
        </Link>
      )}
    </main>
  );
}

function Langkah4({ data, reload }: { data: Data; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const [tarikhBayar, setTarikhBayar] = useState(todayISO());
  const dibayar = data.run.status !== "approved";
  const ym = `${data.run.period_year}${String(data.run.period_month).padStart(2, "0")}`;
  const j = (data.run.totals ?? {}) as unknown as Jumlah;

  async function turun(k: "bank" | "epf" | "socso" | "pcb") {
    setRalat(null);
    try {
      await muatTurun(data.run.id, k, `${k === "bank" ? "bayaran-bank" : k === "epf" ? "kwsp" : k === "socso" ? "perkeso-sip" : "pcb-cp39"}-${ym}.csv`);
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
    }
  }

  async function bayar() {
    setBusy(true);
    setRalat(null);
    try {
      await tandaDibayar(data.run.id, tarikhBayar);
      reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
      setBusy(false);
    }
  }

  return (
    <>
      <main className="flex grow flex-col gap-3 px-4 pt-4 pb-4">
        <span className="rounded-[14px] bg-success-soft px-4 py-3 text-[13px] font-semibold text-success">
          {dibayar
            ? `Telah dibayar${data.run.pay_date ? ` pada ${data.run.pay_date.split("-").reverse().join("/")}` : ""}. Slip gaji telah dihantar kepada ${j.headcount} pekerja.`
            : `Diluluskan oleh ${data.aliran.join(" dan ")}.`}
        </span>
        <Seksyen>MUAT TURUN</Seksyen>
        <div className="flex flex-col rounded-card bg-surface px-4 text-sm [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
          <Fail t="Fail bayaran bank" s="Untuk dimuat naik ke perbankan internet" onClick={() => turun("bank")} />
          <Fail t="Caruman KWSP" s="Data untuk i-Akaun Majikan" onClick={() => turun("epf")} />
          <Fail t="PERKESO & SIP" s="Data untuk ASSIST" onClick={() => turun("socso")} />
          <Fail t="PCB (CP39)" s="Data untuk e-PCB LHDN" onClick={() => turun("pcb")} />
        </div>
        <span className="text-xs text-muted">Format fail rasmi setiap portal perlu disahkan sebelum gaji sebenar pertama. Setiap muat turun direkodkan.</span>
        {!dibayar && (
          <>
            <Seksyen className="pt-1">AUTOMATIK APABILA ANDA MENANDAKAN &quot;TELAH DIBAYAR&quot;</Seksyen>
            <div className="flex flex-col rounded-card bg-surface px-4 text-sm [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              <Baris k={`Slip gaji ke WhatsApp ${j.headcount} pekerja`} v="Tanpa jumlah dalam mesej" />
              <Baris k="Tuntutan ditanda dibayar" v={rm(j.claims)} />
              <Baris k="Jurnal gaji ke sistem perakaunan" v="Mengikut Tetapan" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <span className="font-bold text-[#4A5A57]">Tarikh bayaran</span>
              <input type="date" value={tarikhBayar} onChange={(e) => setTarikhBayar(e.target.value)} className="h-10 rounded-[10px] border border-[#D5DEDC] bg-surface px-2.5 font-semibold" />
            </label>
          </>
        )}
        {ralat && <ErrorBox message={ralat} />}
      </main>
      {!dibayar && (
        <div className="bar-bawah sticky bottom-0 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
          <ButangUtama onClick={bayar} busy={busy}>
            Tandakan telah dibayar &amp; hantar slip
          </ButangUtama>
        </div>
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
        Muat turun
      </button>
    </div>
  );
}
