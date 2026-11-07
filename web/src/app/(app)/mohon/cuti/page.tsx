"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { getBaki } from "@/lib/data";
import { addDays, dow, hari, hariTarikh, masaTeks, namaPeringkat, tarikh, todayISO } from "@/lib/format";
import { IconChevronRight } from "@/components/icons";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { muatNaikPeribadi } from "@/lib/upload";

// Rujukan reka bentuk: design/MohonCuti.dc.html
const JENIS = ["AL", "MC", "EL", "UL"] as const;
const SUB: Record<string, string> = {
  MC: "Perlu sijil cuti sakit",
  EL: "Boleh mohon selepas",
  UL: "Gaji dipotong",
};
const NAMA_PENDEK: Record<string, string> = { AL: "Tahunan", MC: "Sakit (MC)", EL: "Kecemasan", UL: "Tanpa Gaji" };

export default function MohonCutiPage() {
  const me = useMe();
  const emp = me.active!;
  const router = useRouter();
  const info = useData(() => loadInfo(emp.companyId, emp.departmentId, me.personId), [emp.companyId]);
  const baki = useData(() => getBaki(emp), [emp.id]);

  const [code, setCode] = useState<string>("AL");
  const [start, setStart] = useState(todayISO());
  const [end, setEnd] = useState(todayISO());
  const [coverPick, setCover] = useState<string | null>(null); // null = belum dipilih (guna lalai)
  const [reason, setReason] = useState("");
  const [sijil, setSijil] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kira = useData(() => kiraHari(emp.id, emp.companyId, start, end), [emp.id, start, end]);

  const jenis = info.data?.types.find((t) => t.code === code);
  const al = baki.data?.AL;
  const bakiJenis = baki.data?.[code];

  // Lalai pengganti tugas: rakan pertama dalam jabatan yang sama
  const cover =
    coverPick ??
    info.data?.colleagues.find((c) => c.department_id === emp.departmentId && c.person_id !== info.data?.headId)
      ?.person_id ??
    "";

  const jangkaan = useMemo(() => {
    if (!jenis || !info.data?.workflow) return null;
    if (jenis.sla_exempt || info.data.workflow.sla === "none") return "Tiada had masa kelulusan untuk jenis cuti ini.";
    const now = new Date();
    const hm = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
    const t = todayISO();
    const hariKerja = dow(t) !== 0 && dow(t) !== 6;
    const tamat = masaTeks(emp.workEnd);
    return hariKerja && hm < info.data.workflow.cutoff_time.slice(0, 5)
      ? `Dijangka selesai hari ini sebelum ${tamat}`
      : `Dijangka selesai pada hari bekerja berikutnya sebelum ${tamat}`;
  }, [jenis, info.data, emp.workEnd]);

  async function hantar() {
    setError(null);
    if (end < start) {
      setError("Tarikh akhir mesti sama atau selepas tarikh mula.");
      return;
    }
    if (jenis?.requires_attachment && !sijil) {
      setError(`${jenis.name} memerlukan sijil sokongan. Sila ambil gambar atau muat naik sijil.`);
      return;
    }
    setBusy(true);
    let lampiran: string | undefined;
    if (jenis?.requires_attachment && sijil) {
      try {
        lampiran = await muatNaikPeribadi(me.personId, `sijil-${code.toLowerCase()}`, sijil);
      } catch (e) {
        setBusy(false);
        setError((e as Error).message);
        return;
      }
    }
    const { error: err } = await getSupabase().rpc("submit_leave", {
      p_employment: emp.id,
      p_leave_code: code,
      p_start: start,
      p_end: end,
      p_half: "full",
      p_reason: reason.trim() || undefined,
      p_attachment: lampiran,
      p_via: "web",
      p_cover_person: cover || undefined,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push("/permohonan");
  }

  if (info.loading && !info.data) {
    return (
      <Screen>
        <BackHeader title="Mohon Cuti" href="/utama" />
        <Loading />
      </Screen>
    );
  }

  const perluSijil = !!jenis?.requires_attachment;
  const n = kira.data?.days ?? null;

  return (
    <Screen>
      <BackHeader title="Mohon Cuti" href="/utama" />
      <main className="flex grow flex-col gap-[18px] px-5 pt-2 pb-4">
        {info.error && <ErrorBox message={info.error} />}

        <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
          <legend className="mb-2.5 text-sm font-bold">Jenis cuti</legend>
          <div className="grid grid-cols-2 gap-2">
            {JENIS.filter((c) => info.data?.types.some((t) => t.code === c)).map((c) => {
              const on = c === code;
              const sub = c === "AL" ? (al ? `Baki ${hari(al.available)} hari` : "Cuti tahunan") : SUB[c];
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setCode(c)}
                  className={`flex min-h-16 flex-col items-start justify-center gap-0.5 rounded-[14px] border-2 px-3.5 py-2.5 text-left ${
                    on ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink"
                  }`}
                >
                  <span className="text-sm font-bold">{NAMA_PENDEK[c]}</span>
                  <span className="text-xs opacity-85">{sub}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-2.5">
          <DateField label="Dari" value={start} onChange={(v) => { setStart(v); if (end < v) setEnd(v); }} />
          <DateField label="Hingga" value={end} min={start} onChange={setEnd} />
        </div>

        <div className="flex flex-col gap-1.5 rounded-card bg-primary-soft px-4 py-3.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[22px] font-extrabold text-primary">
              {n === null ? "…" : `${hari(n)} hari bekerja`}
            </span>
            {jenis && bakiJenis && n !== null && (
              <span className="text-[13px] font-bold text-primary">Baki selepas: {hari(bakiJenis.available - n)} hari</span>
            )}
          </div>
          <span className="text-[13px] text-[#33504B]">{kira.data?.note ?? " "}</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1.5 text-sm font-bold">
            Pengganti tugas
            <select
              value={cover}
              onChange={(e) => setCover(e.target.value)}
              className="h-12 rounded-xl border-[1.5px] border-primary bg-surface px-3 text-[15px] font-semibold text-ink"
            >
              <option value="">Tiada</option>
              {info.data?.colleagues.map((c) => (
                <option key={c.person_id} value={c.person_id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-bold">
            Sebab (pilihan)
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-12 rounded-xl border border-line bg-surface px-3.5 text-[15px] font-normal text-ink"
            />
          </label>
        </div>

        {info.data && info.data.steps.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-bold">Akan diluluskan oleh</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {info.data.steps.map((s, i) => (
                <span key={s.label} className="flex items-center gap-1.5">
                  {i > 0 && <IconChevronRight size={14} className="text-muted" />}
                  <span className="rounded-[10px] border border-line bg-surface px-2.5 py-1.5 text-[13px] font-semibold">
                    {i + 1} · {s.label}
                  </span>
                </span>
              ))}
            </div>
            {jangkaan && <span className="text-xs text-muted">{jangkaan}</span>}
          </div>
        )}

        {perluSijil && <Sijil name={jenis?.name ?? "Cuti ini"} file={sijil} onFile={setSijil} />}
        {error && <ErrorBox message={error} />}
      </main>

      <div className="sticky bottom-0 flex flex-col gap-2.5 border-t border-line-soft bg-surface px-5 pt-3 pb-7">
        <button
          type="button"
          onClick={hantar}
          disabled={busy || (perluSijil && !sijil) || n === 0}
          className="flex h-[54px] items-center justify-center rounded-button bg-primary text-base font-extrabold text-white hover:bg-primary-hover disabled:opacity-60"
        >
          {busy ? "Menghantar…" : "Hantar Permohonan"}
        </button>
        <span className="text-center text-xs text-muted">
          Atau hantar melalui WhatsApp: “Saya ingin memohon cuti {tarikh(start)}
          {end !== start ? `–${tarikh(end)}` : ""}
          {reason.trim() ? ` untuk ${reason.trim().toLowerCase()}` : ""}”
        </span>
      </div>
    </Screen>
  );
}

function DateField({ label, value, min, onChange }: { label: string; value: string; min?: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-bold">
      {label}
      <span className="relative flex h-12 items-center rounded-xl border border-line bg-surface px-3.5 text-[15px] font-semibold">
        {hariTarikh(value)}
        <input
          type="date"
          value={value}
          min={min}
          required
          onChange={(e) => e.target.value && onChange(e.target.value)}
          onClick={(e) => {
            try {
              e.currentTarget.showPicker?.();
            } catch {
              /* sesetengah pelayar tidak menyokong showPicker */
            }
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </span>
    </label>
  );
}

async function loadInfo(companyId: string, departmentId: string | null, myPersonId: string) {
  const sb = getSupabase();
  const [types, colleagues, wf, dept] = await Promise.all([
    sb.from("leave_types").select("id, code, name, requires_attachment, sla_exempt").eq("company_id", companyId).eq("active", true),
    sb.rpc("my_colleagues", { p_company: companyId }),
    sb
      .from("approval_workflows")
      .select("id, sla, cutoff_time, approval_workflow_steps(step_order, name, approver, approver_role)")
      .eq("company_id", companyId)
      .eq("request_type", "leave")
      .eq("active", true)
      .maybeSingle(),
    departmentId
      ? sb.from("departments").select("head_person_id").eq("id", departmentId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const cols = must(colleagues) ?? [];
  const head = must(dept)?.head_person_id ?? null;
  const workflow = must(wf);
  const steps = (workflow?.approval_workflow_steps ?? [])
    .sort((a, b) => a.step_order - b.step_order)
    .filter((s) => !(s.approver === "dept_head" && head === myPersonId))
    .map((s) => ({
      label:
        s.approver === "dept_head"
          ? cols.find((c) => c.person_id === head)?.name ?? namaPeringkat(s.name)
          : namaPeringkat(s.name),
    }));
  return { types: must(types) ?? [], colleagues: cols, workflow, steps, headId: head };
}

async function kiraHari(employmentId: string, companyId: string, start: string, end: string) {
  if (end < start) return { days: 0, note: "Tarikh akhir mesti selepas tarikh mula." };
  const sb = getSupabase();
  const [days, hols] = await Promise.all([
    sb.rpc("leave_count_days", { p_employment: employmentId, p_start: start, p_end: end, p_half: "full" }),
    sb
      .from("public_holidays")
      .select("holiday_date, name, company_id")
      .gte("holiday_date", start)
      .lte("holiday_date", end)
      .or(`company_id.is.null,company_id.eq.${companyId}`)
      .order("holiday_date"),
  ]);
  const n = Number(must(days) ?? 0);
  const cuti = (must(hols) ?? []).filter((h) => dow(h.holiday_date) !== 0 && dow(h.holiday_date) !== 6);
  let weekend = false;
  for (let d = start; d <= end; d = addDays(d, 1)) if (dow(d) === 0 || dow(d) === 6) weekend = true;
  const parts = cuti.map((h) => `${h.name} (${tarikh(h.holiday_date)})`);
  if (weekend) parts.push("hujung minggu");
  const note = parts.length
    ? `${parts.join(", ").replace(/, ([^,]*)$/, " dan $1")} tidak dikira.`
    : "Hanya hari bekerja dikira.";
  return { days: n, note: n === 0 ? "Tarikh dipilih bukan hari bekerja." : note };
}

/** Sijil sokongan (MC dll.): dua butang — Ambil gambar (kamera belakang) & Muat naik (galeri / PDF). */
function Sijil({ name, file, onFile }: { name: string; file: File | null; onFile: (f: File) => void }) {
  const kamera = useRef<HTMLInputElement>(null);
  const fail = useRef<HTMLInputElement>(null);
  const pilih = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
    e.target.value = "";
  };
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-bold">Sijil sokongan</span>
      <input ref={kamera} type="file" accept="image/*" capture="environment" className="hidden" onChange={pilih} />
      <input ref={fail} type="file" accept="image/*,application/pdf" className="hidden" onChange={pilih} />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => kamera.current?.click()} className="h-12 rounded-xl border-[1.5px] border-primary bg-surface text-sm font-bold text-primary">
          Ambil gambar
        </button>
        <button type="button" onClick={() => fail.current?.click()} className="h-12 rounded-xl border border-line bg-surface text-sm font-bold text-ink">
          Muat naik
        </button>
      </div>
      <span className={`text-xs ${file ? "font-semibold text-success" : "text-muted"}`}>
        {file ? `Dilampirkan: ${file.name}` : `${name} memerlukan sijil. Gambar atau PDF, maksimum 10 MB.`}
      </span>
    </div>
  );
}
