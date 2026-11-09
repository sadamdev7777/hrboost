"use client";

import { tr } from "@/lib/i18n";
import { beritahu } from "@/components/Dialog";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { mesejRalat, must, useData } from "@/lib/useData";
import { getBaki } from "@/lib/data";
import { addDays, dow, hari, hariTarikh, julatTarikh, masaTeks, namaPeringkat, tarikh, todayISO } from "@/lib/format";
import { IconChevronRight } from "@/components/icons";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { muatNaikPeribadi } from "@/lib/upload";

// Rujukan reka bentuk: design/MohonCuti.dc.html
const JENIS = ["AL", "MC", "EL", "UL"] as const;
const SUB: Record<string, string> = {
  MC: tr("Perlu sijil cuti sakit"),
  EL: tr("Boleh mohon selepas"),
  UL: tr("Gaji dipotong"),
};
const NAMA_PENDEK: Record<string, string> = { AL: tr("Tahunan"), MC: tr("Sakit (MC)"), EL: tr("Kecemasan"), UL: tr("Tanpa Gaji") };

export default function MohonCutiPage() {
  const me = useMe();
  const emp = me.active!;
  const router = useRouter();
  const info = useData(() => loadInfo(emp.companyId, emp.departmentId, me.personId), [emp.companyId]);
  const baki = useData(() => getBaki(emp), [emp.id]);

  const [code, setCode] = useState<string>("AL");
  const [start, setStart] = useState(todayISO());
  const [end, setEnd] = useState(todayISO());
  // Rakan sejabatan yang bercuti (atau sedang memohon) pada tarikh yang sama
  const rakan = useData(async () => {
    const { data } = await getSupabase().rpc("team_leave_calendar", { p_company: emp.companyId, p_from: start, p_to: end });
    return ((data ?? []) as { name: string; start_date: string; end_date: string; status: string; is_me: boolean }[]).filter((r) => !r.is_me);
  }, [emp.companyId, start, end]);
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
    if (jenis.sla_exempt || info.data.workflow.sla === "none") return tr("Tiada had masa kelulusan untuk jenis cuti ini.");
    const now = new Date();
    const hm = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
    const t = todayISO();
    const hariKerja = dow(t) !== 0 && dow(t) !== 6;
    const tamat = masaTeks(emp.workEnd);
    return hariKerja && hm < info.data.workflow.cutoff_time.slice(0, 5)
      ? tr("Dijangka selesai hari ini sebelum {0}", tamat)
      : tr("Dijangka selesai pada hari bekerja berikutnya sebelum {0}", tamat);
  }, [jenis, info.data, emp.workEnd]);

  async function hantar() {
    setError(null);
    if (end < start) {
      setError(tr("Tarikh akhir mesti sama atau selepas tarikh mula."));
      return;
    }
    if (jenis?.requires_attachment && !sijil) {
      setError(tr("{0} memerlukan sijil sokongan. Sila ambil gambar atau muat naik sijil.", jenis.name));
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
      setError(mesejRalat(err.message, err.code));
      return;
    }
    beritahu(info.data?.steps[0] ? tr("Permohonan dihantar kepada {0}.", info.data.steps[0].label) : tr("Permohonan dihantar."));
    router.push("/permohonan");
  }

  if (info.loading && !info.data) {
    return (
      <Screen lebar="sederhana">
        <BackHeader title={tr("Mohon Cuti")} href="/utama" />
        <Loading />
      </Screen>
    );
  }

  const perluSijil = !!jenis?.requires_attachment;
  const n = kira.data?.days ?? null;

  return (
    <Screen lebar="sederhana">
      <BackHeader title={tr("Mohon Cuti")} href="/utama" />
      <main className="flex grow flex-col gap-[18px] px-4 pt-2 pb-4">
        {info.error && <ErrorBox message={info.error} />}

        <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
          <legend className="mb-2.5 text-sm font-bold">{tr("Jenis cuti")}</legend>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {JENIS.filter((c) => info.data?.types.some((t) => t.code === c)).map((c) => {
              const on = c === code;
              const sub = c === "AL" ? (al ? tr("Baki {0} hari", hari(al.available)) : tr("Cuti tahunan")) : SUB[c];
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
          <DateField label={tr("Dari")} value={start} onChange={(v) => { setStart(v); if (end < v) setEnd(v); }} />
          <DateField label={tr("Hingga")} value={end} min={start} onChange={setEnd} />
        </div>

        {rakan.data && (
          <div className={`flex items-start gap-2 rounded-[12px] px-3.5 py-2.5 text-[13px] ${rakan.data.length ? "bg-warning-soft text-warning" : "bg-surface text-subtle"}`}>
            <span aria-hidden="true" className="pt-px">{rakan.data.length ? "!" : "✓"}</span>
            <span>
              {rakan.data.length
                ? tr("Rakan sejabatan bercuti pada tarikh ini: {0}.", rakan.data.map((r) => `${r.name} (${julatTarikh(r.start_date, r.end_date)}${r.status === "pending" ? tr(", menunggu") : ""})`).join(", "))
                : tr("Tiada rakan sejabatan bercuti pada tarikh ini.")}
            </span>
          </div>
        )}

        <div className="flex flex-col gap-1.5 rounded-card bg-primary-soft px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-primary">
              {n === null ? "…" : tr("{0} hari bekerja", hari(n))}
            </span>
            {jenis && bakiJenis && n !== null && (
              <span className="text-[13px] font-bold text-primary">{tr("Baki selepas: {0} hari", hari(bakiJenis.available - n))}</span>
            )}
          </div>
          <span className="text-[13px] text-[#33504B]">{kira.data?.note ?? " "}</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1.5 text-sm font-bold">
            {tr("Pengganti tugas")}<select
              value={cover}
              onChange={(e) => setCover(e.target.value)}
              className="h-12 rounded-xl border-[1.5px] border-primary bg-surface px-3 text-sm font-semibold text-ink"
            >
              <option value="">{tr("Tiada")}</option>
              {info.data?.colleagues.map((c) => (
                <option key={c.person_id} value={c.person_id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-bold">
            {tr("Sebab (pilihan)")}<input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-12 rounded-xl border border-line bg-surface px-3.5 text-sm font-normal text-ink"
            />
          </label>
        </div>

        {info.data && info.data.steps.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-bold">{tr("Akan diluluskan oleh")}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {info.data.steps.map((s, i) => (
                <span key={s.label} className="flex items-center gap-1.5">
                  {i > 0 && <IconChevronRight size={14} className="text-muted" />}
                  <span className="rounded-[10px] border border-line bg-surface px-2.5 py-1.5 text-[13px] font-semibold">
                    {i + 1} · {tr(s.label)}
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

      <div className="bar-bawah sticky bottom-0 flex flex-col gap-2.5 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
        <button
          type="button"
          onClick={hantar}
          disabled={busy || (perluSijil && !sijil) || n === 0}
          className="flex h-12 items-center justify-center rounded-button bg-primary text-base font-extrabold text-white hover:bg-primary-hover disabled:opacity-60"
        >
          {busy ? tr("Menghantar…") : tr("Hantar Permohonan")}
        </button>
        <span className="text-center text-xs text-muted">
          {tr("Atau hantar melalui WhatsApp: “Saya ingin memohon cuti {0}{1}{2}”", tarikh(start), end !== start ? `–${tarikh(end)}` : "", reason.trim() ? tr(" untuk {0}", reason.trim().toLowerCase()) : "")}</span>
      </div>
    </Screen>
  );
}

function DateField({ label, value, min, onChange }: { label: string; value: string; min?: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-bold">
      {label}
      <span className="relative flex h-12 items-center rounded-xl border border-line bg-surface px-3.5 text-sm font-semibold">
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
  if (end < start) return { days: 0, note: tr("Tarikh akhir mesti selepas tarikh mula.") };
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
    ? tr("{0} tidak dikira.", parts.join(", ").replace(/, ([^,]*)$/, " dan $1"))
    : tr("Hanya hari bekerja dikira.");
  return { days: n, note: n === 0 ? tr("Tarikh dipilih bukan hari bekerja.") : note };
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
      <span className="text-sm font-bold">{tr("Sijil sokongan")}</span>
      <input ref={kamera} type="file" accept="image/*" capture="environment" className="hidden" onChange={pilih} />
      <input ref={fail} type="file" accept="image/*,application/pdf" className="hidden" onChange={pilih} />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => kamera.current?.click()} className="h-12 rounded-xl border-[1.5px] border-primary bg-surface text-sm font-bold text-primary">
          {tr("Ambil gambar")}</button>
        <button type="button" onClick={() => fail.current?.click()} className="h-12 rounded-xl border border-line bg-surface text-sm font-bold text-ink">
          {tr("Muat naik")}</button>
      </div>
      <span className={`text-xs ${file ? "font-semibold text-success" : "text-muted"}`}>
        {file ? tr("Dilampirkan: {0}", file.name) : tr("{0} memerlukan sijil. Gambar atau PDF, maksimum 10 MB.", name)}
      </span>
    </div>
  );
}
