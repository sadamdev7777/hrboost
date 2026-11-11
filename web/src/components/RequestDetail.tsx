"use client";

import { tawarLulusBerturut } from "@/lib/lulusBerturut";
import { tr, trRalat, trKonteks, trTajuk } from "@/lib/i18n";
import { beritahu, sahkan } from "@/components/Dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { mesejRalat, must, useData } from "@/lib/useData";
import { hari, jam, julatTarikh, masa, namaPeringkat, ringgit, tarikh, tarikhTempatan, todayISO, type StatusPermohonan } from "@/lib/format";
import { IconCheck, IconSparkle } from "./icons";
import { Avatar, BackHeader, ErrorBox, Loading, Screen, StatusPill } from "./ui";
import { ReasonSheet } from "./ReasonSheet";
import { urlSementara } from "@/lib/upload";
import { namaJenisTuntutan } from "@/lib/claims";

const VIA: Record<string, string> = { web: tr("aplikasi"), whatsapp: tr("WhatsApp"), ai_agent: tr("pembantu AI"), system: tr("sistem") };
const TAJUK: Record<string, string> = {
  leave: tr("Permohonan Cuti"),
  claim: tr("Tuntutan"),
  attendance_correction: tr("Pembetulan Masa"),
  payroll_run: tr("Kelulusan Gaji"),
  overtime: tr("Kerja Lebih Masa"),
  salary_advance: tr("Pendahuluan Gaji"),
  profile_change: tr("Kemas Kini Profil"),
};

type Mode = { kind: "approver"; taskId: string } | { kind: "requester"; requestId: string };

// Rujukan reka bentuk: design/Butiran.dc.html
/** Bingkai: skrin penuh, atau panel dalam halaman Kelulusan (desktop) apabila `tertanam`. */
function Bingkai({ tertanam, children }: { tertanam: boolean; children: React.ReactNode }) {
  return tertanam ? <div className="flex flex-col">{children}</div> : <Screen lebar="sederhana">{children}</Screen>;
}

export function RequestDetail({ mode, tertanam }: { mode: Mode; tertanam?: { onSelesai: () => void } }) {
  const me = useMe();
  const router = useRouter();
  const d = useData(() => loadDetail(mode), [mode.kind === "approver" ? mode.taskId : mode.requestId]);
  const [sheet, setSheet] = useState<null | "reject" | "return">(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const back = mode.kind === "approver" ? "/kelulusan" : "/permohonan";

  if (d.loading && !d.data) {
    return (
      <Bingkai tertanam={!!tertanam}>
        {!tertanam && <BackHeader href={back} />}
        <Loading />
      </Bingkai>
    );
  }
  if (d.error || !d.data) {
    return (
      <Bingkai tertanam={!!tertanam}>
        {!tertanam && <BackHeader href={back} />}
        <div className="p-5">
          <ErrorBox message={d.error ?? tr("Permohonan tidak dijumpai atau anda tidak mempunyai akses.")} />
        </div>
      </Bingkai>
    );
  }

  const x = d.data;
  // Panel tertanam berada dalam <main> halaman Kelulusan: elak <main> bersarang.
  const Isi = tertanam ? "div" : "main";
  const myTask = x.tasks.find((t) => t.approver_person_id === me.personId && t.status === "pending");
  const canAct = mode.kind === "approver" && !!myTask && x.req.status === "pending";
  const canCancel = mode.kind === "requester" && x.req.requester_person_id === me.personId && x.req.status === "pending";

  async function act(action: "approve" | "reject" | "return", comment?: string) {
    if (!myTask) return;
    setBusy(true);
    setError(null);
    const { error: err } = await getSupabase().rpc("approval_act", {
      p_task: myTask.id,
      p_action: action,
      p_comment: comment,
      p_via: "web",
    });
    setBusy(false);
    if (err) {
      setError(mesejRalat(err.message, err.code));
      return;
    }
    setSheet(null);
    beritahu(action === "approve" ? tr("Diluluskan.") : action === "reject" ? tr("Ditolak. Pemohon dimaklumkan.") : tr("Dikembalikan kepada pemohon untuk pembetulan."));
    if (action === "approve") await tawarLulusBerturut(myTask.id, me.personId);
    if (tertanam) tertanam.onSelesai();
    else router.push("/kelulusan");
  }

  async function batal() {
    if (!(await sahkan({ tajuk: tr("Batalkan permohonan ini?"), mesej: tr("Pelulus akan dimaklumkan. Anda boleh memohon semula kemudian."), ok: tr("Batalkan"), bahaya: true }))) return;
    setBusy(true);
    const { error: err } = await getSupabase().rpc("approval_cancel", { p_request: x.req.id, p_via: "web" });
    setBusy(false);
    if (err) setError(mesejRalat(err.message, err.code));
    else d.reload();
  }

  return (
    <Bingkai tertanam={!!tertanam}>
      {tertanam ? (
        <h2 className="m-0 px-1 pt-1 pb-2 text-lg font-extrabold">{TAJUK[x.req.request_type] ?? tr("Permohonan")}</h2>
      ) : (
        <BackHeader title={TAJUK[x.req.request_type] ?? tr("Permohonan")} href={back} />
      )}
      <Isi className={`flex grow flex-col gap-3 ${tertanam ? "" : "px-4 pt-1 pb-4"}`}>
        <section className="flex flex-col gap-3 rounded-[18px] bg-surface p-4">
          <div className="flex items-center gap-3">
            <Avatar name={x.requesterName} size={48} personId={x.req.requester_person_id} />
            <div className="flex grow flex-col gap-0.5">
              <span className="text-base font-extrabold">{x.requesterName}</span>
              <span className="text-[13px] text-muted">
                {[x.department, x.companyCode, tr("dihantar {0}{1}", masa(x.req.submitted_at), x.via ? tr(" melalui {0}", VIA[x.via] ?? x.via) : "")]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            {mode.kind === "requester" && <StatusPill status={x.req.status as StatusPermohonan} />}
          </div>

          {x.leave && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={tr("Jenis")} value={x.leave.typeName} />
              <Field label={tr("Tempoh")} value={`${hari(x.leave.days)} hari bekerja`} />
              <Field label={tr("Tarikh")} value={julatTarikh(x.leave.start, x.leave.end)} />
              {x.leave.balanceAfter !== null && <Field label={tr("Baki selepas")} value={`${hari(x.leave.balanceAfter)} hari`} />}
            </div>
          )}
          {x.leave?.reason && <Field label={tr("Sebab")} value={x.leave.reason} plain />}
          {x.leave?.cover && <Field label={tr("Pengganti tugas")} value={x.leave.cover} plain />}
          {x.leave?.attachment && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted">{tr("Sijil sokongan")}</span>
              <LihatFail path={x.leave.attachment} label={tr("Lihat sijil")} />
            </div>
          )}

          {x.gaji && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={tr("Bulan")} value={x.gaji.bulan} />
              <Field label={tr("Pekerja")} value={String(x.gaji.headcount)} />
              <Field label={tr("Jumlah kasar")} value={ringgit(x.gaji.gross)} />
              <Field label={tr("Jumlah bersih")} value={ringgit(x.gaji.net)} />
              <Field label={tr("Caruman majikan")} value={ringgit(x.gaji.employer)} />
              <Field label="PCB" value={ringgit(x.gaji.pcb)} />
            </div>
          )}
          {x.koreksi && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={tr("Tarikh")} value={tarikh(x.koreksi.date)} />
              <Field label={tr("Rekod mesin")} value={`${x.koreksi.machineIn ? jam(x.koreksi.machineIn) : "Tiada"} – ${x.koreksi.machineOut ? jam(x.koreksi.machineOut) : "Tiada"}`} />
              <Field label={tr("Masuk sebenar")} value={x.koreksi.in ? jam(x.koreksi.in) : "Tiada perubahan"} />
              <Field label={tr("Keluar sebenar")} value={x.koreksi.out ? jam(x.koreksi.out) : "Tiada perubahan"} />
            </div>
          )}
          {x.koreksi && <Field label={tr("Sebab")} value={x.koreksi.reason} plain />}

          {x.claim && (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-3">
                <Field label={tr("Tajuk")} value={x.claim.title} />
                <Field label={tr("Jumlah")} value={ringgit(x.claim.total)} />
              </div>
              {x.claim.items.map((it, i) => (
                <div key={i} className="flex flex-col gap-1.5 border-t border-[#EEF2F1] pt-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span>
                      {it.type} · {tarikh(it.date)}
                      {it.km ? tr(" · {0} km", it.km) : ""}
                    </span>
                    <b>{ringgit(it.amount)}</b>
                  </div>
                  {it.receipts.length > 0 && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {it.receipts.map((r, k) => (
                        <LihatFail key={r} path={r} label={tr("Lihat resit{0}", it.receipts.length > 1 ? ` ${k + 1}` : "")} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {x.profil && (
            <div className="flex flex-col gap-2">
              {x.profil.changes.map((c) => (
                <div key={c.field} className="flex flex-col gap-0.5 border-t border-[#EEF2F1] pt-2 text-sm first:border-t-0 first:pt-0">
                  <span className="text-xs text-muted">{trRalat(c.label)}</span>
                  <span>
                    <span className="text-muted line-through">{nilaiProfil(c.field, c.old)}</span> → <b>{nilaiProfil(c.field, c.new)}</b>
                  </span>
                </div>
              ))}
              {x.profil.attachment && <LihatFail path={x.profil.attachment} label={tr("Lihat gambar kad pengenalan")} />}
            </div>
          )}
          {!x.leave && !x.claim && !x.profil && <Field label={tr("Permohonan")} value={trTajuk(x.req.title)} />}
        </section>

        {x.req.ai_summary && (
          <section className="flex flex-col gap-2 rounded-[18px] bg-ai-soft px-4 py-3">
            <div className="flex items-center gap-2">
              <IconSparkle size={18} className="text-ai" />
              <span className="text-sm font-extrabold text-ai-hover">{tr("Ringkasan AI")}</span>
            </div>
            <p className="m-0 text-sm whitespace-pre-line text-[#2E2650]">{x.req.ai_summary}</p>
          </section>
        )}

        <section className="flex flex-col gap-3 rounded-[18px] bg-surface p-4">
          <span className="text-sm font-extrabold">{tr("Aliran kelulusan")}</span>
          <div className="flex items-center gap-3">
            <Done />
            <span className="grow text-sm">{tr("Dihantar oleh {0}", x.requesterName)}</span>
            <span className="text-xs text-muted">{masa(x.req.submitted_at)}</span>
          </div>
          {x.flow.map((s) => (
            <div key={s.order} className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                {s.state === "approved" ? (
                  <Done />
                ) : s.state === "current" ? (
                  <span className="size-[26px] shrink-0 rounded-full border-[3px] border-[#D97706] bg-surface" />
                ) : s.state === "rejected" || s.state === "returned" ? (
                  <span className="size-[26px] shrink-0 rounded-full border-[3px] border-danger bg-surface" />
                ) : (
                  <span className="size-[26px] shrink-0 rounded-full border-2 border-line-strong" />
                )}
                <span
                  className={`grow text-sm ${s.state === "current" ? "font-extrabold" : s.state === "future" || s.state === "skipped" ? "text-muted" : ""}`}
                >
                  {s.order} · {trRalat(s.name)}
                  {s.mine ? " (anda)" : ""}
                </span>
                <span
                  className={`text-xs ${
                    s.state === "current" ? "font-bold text-warning" : s.state === "rejected" ? "font-bold text-danger" : "text-muted"
                  }`}
                >
                  {s.right}
                </span>
              </div>
              {s.comment && <span className="ml-[38px] text-[13px] text-subtle">“{s.comment}”</span>}
            </div>
          ))}
        </section>
        {error && <ErrorBox message={error} />}
      </Isi>

      {canAct && (
        <div className="bar-bawah sticky bottom-0 flex flex-col gap-2 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => setSheet("reject")}
              className="h-12 rounded-button border-[1.5px] border-line bg-surface text-base font-bold text-danger disabled:opacity-60"
            >
              {tr("Tolak")}</button>
            <button
              type="button"
              disabled={busy}
              onClick={() => act("approve")}
              className="h-12 rounded-button bg-primary text-base font-extrabold text-white hover:bg-primary-hover disabled:opacity-60"
            >
              {busy ? tr("Memproses…") : tr("Lulus")}
            </button>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => setSheet("return")}
            className="h-11 bg-transparent text-sm font-bold text-primary"
          >
            {tr("Kembalikan untuk pembetulan")}</button>
        </div>
      )}

      {canCancel && (
        <div className="bar-bawah sticky bottom-0 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
          <button
            type="button"
            disabled={busy}
            onClick={batal}
            className="h-12 w-full rounded-[14px] border border-line bg-surface text-sm font-bold text-danger disabled:opacity-60"
          >
            {tr("Batalkan permohonan")}</button>
        </div>
      )}

      {sheet && (
        <ReasonSheet
          title={sheet === "reject" ? tr("Tolak permohonan") : tr("Kembalikan untuk pembetulan")}
          confirmLabel={sheet === "reject" ? tr("Tolak") : tr("Kembalikan")}
          danger={sheet === "reject"}
          onCancel={() => setSheet(null)}
          onConfirm={(r) => act(sheet, r)}
        />
      )}
    </Bingkai>
  );
}

function LihatFail({ path, label }: { path: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex flex-col">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const url = await urlSementara(path);
          setBusy(false);
          if (url) window.open(url, "_blank", "noopener");
          else setError("Fail tidak dapat dibuka.");
        }}
        className="self-start text-sm font-bold text-primary"
      >
        {busy ? tr("Membuka…") : label}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}

function Done() {
  return (
    <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-primary text-white">
      <IconCheck size={14} />
    </span>
  );
}

function Field({ label, value, plain }: { label: string; value: string; plain?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-sm ${plain ? "" : "font-bold"}`}>{value}</span>
    </div>
  );
}

// ------------------------------------------------------------------ data

type FlowStep = {
  order: number;
  name: string;
  state: "approved" | "current" | "rejected" | "returned" | "skipped" | "future";
  right: string;
  mine: boolean;
  comment: string | null;
};

async function loadDetail(mode: Mode) {
  const sb = getSupabase();
  let requestId: string;
  if (mode.kind === "approver") {
    const t = must(await sb.from("approval_tasks").select("request_id").eq("id", mode.taskId).maybeSingle());
    if (!t) throw new Error(tr("Tugasan tidak dijumpai atau anda tidak mempunyai akses."));
    requestId = t.request_id;
  } else {
    requestId = mode.requestId;
  }

  const req = must(
    await sb
      .from("approval_requests")
      .select(
        "id, request_type, reference_id, requester_person_id, requester_employment_id, title, context, ai_summary, status, submitted_at, workflow_id, current_step_order, company_id",
      )
      .eq("id", requestId)
      .maybeSingle(),
  );
  if (!req) throw new Error(tr("Permohonan tidak dijumpai atau anda tidak mempunyai akses."));

  const { data: auth } = await sb.auth.getUser();
  const me = must(await sb.from("persons").select("id").eq("auth_user_id", auth.user?.id ?? "").maybeSingle());

  const [person, emp, tasks, actions, steps] = await Promise.all([
    sb.from("persons").select("preferred_name, full_name").eq("id", req.requester_person_id).maybeSingle(),
    req.requester_employment_id
      ? sb
          .from("employments")
          .select("departments(name), companies(code)")
          .eq("id", req.requester_employment_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    sb
      .from("approval_tasks")
      .select("id, step_order, step_name, approver_person_id, status, acted_at, comment")
      .eq("request_id", req.id)
      .order("step_order"),
    sb.from("approval_actions").select("action, step_order, via, comment, created_at").eq("request_id", req.id).order("id"),
    req.workflow_id
      ? sb.from("approval_workflow_steps").select("step_order, name").eq("workflow_id", req.workflow_id).order("step_order")
      : Promise.resolve({ data: [], error: null }),
  ]);
  const p = must(person);
  const e = must(emp);
  const ts = must(tasks) ?? [];
  const acts = must(actions) ?? [];
  const st = (must(steps) ?? []) as { step_order: number; name: string }[];

  const requesterName =
    p?.preferred_name ||
    p?.full_name ||
    (await sb.rpc("request_requester_name", { p_request: req.id })).data ||
    tr("Pemohon");
  const via = acts.find((a) => a.action === "submitted")?.via ?? null;

  // Aliran kelulusan: satu baris setiap peringkat
  const flow: FlowStep[] = st.map((s) => {
    const mineAll = ts.filter((t) => t.step_order === s.step_order);
    const skipped = acts.some((a) => a.action === "skipped" && a.step_order === s.step_order);
    const approved = mineAll.find((t) => t.status === "approved");
    const rejected = mineAll.find((t) => t.status === "rejected");
    const returned = mineAll.find((t) => t.status === "returned");
    const pending = mineAll.find((t) => t.status === "pending");
    const mine = !!me && mineAll.some((t) => t.approver_person_id === me.id);
    const name = namaPeringkat(s.name);
    if (approved) return { order: s.step_order, name, state: "approved", right: approved.acted_at ? masa(approved.acted_at) : trKonteks("Lulus", "Approved"), mine, comment: approved.comment };
    if (rejected) return { order: s.step_order, name, state: "rejected", right: tr("Ditolak"), mine, comment: rejected.comment };
    if (returned) return { order: s.step_order, name, state: "returned", right: tr("Dikembalikan"), mine, comment: returned.comment };
    if (pending && req.status === "pending")
      return { order: s.step_order, name, state: "current", right: tr("Menunggu"), mine: pending.approver_person_id === me?.id, comment: null };
    if (skipped) return { order: s.step_order, name, state: "skipped", right: tr("Dilangkau"), mine: false, comment: null };
    return { order: s.step_order, name, state: "future", right: "", mine: false, comment: null };
  });

  // Butiran modul
  let leave: null | {
    typeName: string;
    days: number;
    start: string;
    end: string;
    reason: string | null;
    cover: string | null;
    balanceAfter: number | null;
    attachment: string | null;
  } = null;
  let gaji: null | { bulan: string; headcount: number; gross: number; net: number; employer: number; pcb: number } = null;
  let koreksi: null | { date: string; in: string | null; out: string | null; reason: string; machineIn: string | null; machineOut: string | null } = null;
  let claim: null | {
    title: string;
    total: number;
    items: { type: string; description: string | null; date: string; amount: number; km: number | null; receipts: string[] }[];
  } = null;

  if (req.request_type === "leave") {
    const lr = must(
      await sb
        .from("leave_requests")
        .select("employment_id, leave_type_id, start_date, end_date, days, reason, cover_person_id, attachment_path, leave_types(name, deduct_balance)")
        .eq("id", req.reference_id)
        .maybeSingle(),
    );
    if (lr) {
      let balanceAfter: number | null = null;
      if (lr.leave_types?.deduct_balance) {
        const b = must(
          await sb
            .from("leave_balances")
            .select("available")
            .eq("employment_id", lr.employment_id)
            .eq("leave_type_id", lr.leave_type_id)
            .eq("year", Number(lr.start_date.slice(0, 4)))
            .maybeSingle(),
        );
        // "available" sudah menolak hari yang sedang menunggu
        if (b) balanceAfter = Number(b.available);
      }
      let cover: string | null = null;
      if (lr.cover_person_id) {
        const cols = must(await sb.rpc("my_colleagues", { p_company: req.company_id })) ?? [];
        cover = cols.find((c) => c.person_id === lr.cover_person_id)?.name ?? null;
        if (!cover && lr.cover_person_id === me?.id) cover = tr("Anda");
      }
      leave = {
        typeName: lr.leave_types?.name ?? tr("Cuti"),
        days: Number(lr.days),
        start: lr.start_date,
        end: lr.end_date,
        reason: lr.reason,
        cover,
        balanceAfter,
        attachment: lr.attachment_path,
      };
    }
  } else if (req.request_type === "payroll_run") {
    const pr = must(await sb.from("payroll_runs").select("period_year, period_month, totals").eq("id", req.reference_id).maybeSingle());
    if (pr) {
      const t = (pr.totals ?? {}) as Record<string, number>;
      const BULAN = [tr("Januari"), tr("Februari"), tr("Mac"), tr("April"), tr("Mei"), tr("Jun"), tr("Julai"), tr("Ogos"), tr("September"), tr("Oktober"), tr("November"), tr("Disember")];
      gaji = {
        bulan: `${BULAN[pr.period_month - 1]} ${pr.period_year}`,
        headcount: Number(t.headcount ?? 0),
        gross: Number(t.gross ?? 0),
        net: Number(t.net ?? 0),
        employer: Number(t.employer ?? 0),
        pcb: Number(t.pcb ?? 0),
      };
    }
  } else if (req.request_type === "attendance_correction") {
    const ac = must(
      await sb
        .from("attendance_corrections")
        .select("employment_id, work_date, requested_clock_in, requested_clock_out, reason")
        .eq("id", req.reference_id)
        .maybeSingle(),
    );
    if (ac) {
      const rec = (
        await sb.from("attendance_records").select("clock_in, clock_out, source").eq("employment_id", ac.employment_id).eq("work_date", ac.work_date).maybeSingle()
      ).data;
      const asal = rec && rec.source !== "correction" ? rec : null;
      koreksi = {
        date: ac.work_date,
        in: ac.requested_clock_in,
        out: ac.requested_clock_out,
        reason: ac.reason,
        machineIn: asal?.clock_in ?? null,
        machineOut: asal?.clock_out ?? null,
      };
    }
  } else if (req.request_type === "claim") {
    const c = must(
      await sb
        .from("claims")
        .select("title, total_amount, claim_items(description, expense_date, amount, distance_km, receipt_paths, claim_types(name))")
        .eq("id", req.reference_id)
        .maybeSingle(),
    );
    if (c) {
      claim = {
        title: c.title,
        total: Number(c.total_amount),
        items: c.claim_items.map((i) => ({
          type: namaJenisTuntutan(i.claim_types?.name ?? tr("Item")),
          description: i.description,
          date: i.expense_date,
          amount: Number(i.amount),
          km: i.distance_km === null ? null : Number(i.distance_km),
          receipts: i.receipt_paths ?? [],
        })),
      };
    }
  }

  const ctxProfil = req.request_type === "profile_change" ? (req.context as { changes?: { field: string; label: string; old: string | null; new: string | null }[]; attachment?: string | null } | null) : null;
  const profil = ctxProfil?.changes ? { changes: ctxProfil.changes, attachment: ctxProfil.attachment ?? null } : null;

  return {
    profil,
    req,
    requesterName,
    department: e?.departments?.name ?? null,
    companyCode: e?.companies?.code ?? null,
    via,
    tasks: ts,
    flow,
    leave,
    claim,
    koreksi,
    gaji,
    isToday: tarikhTempatan(req.submitted_at) === todayISO(),
  };
}

const KAHWIN: Record<string, string> = { bujang: tr("Bujang"), berkahwin: tr("Berkahwin"), duda_janda: tr("Duda / Janda") };
/** Nilai perubahan profil untuk paparan pelulus (HR melihat nilai penuh untuk disemak). */
function nilaiProfil(field: string, v: string | null): string {
  if (v === null || v === "") return "-";
  if (field === "marital_status") return KAHWIN[v] ?? v;
  if (field === "spouse_working") return v === "true" ? tr("Ya") : tr("Tidak");
  return v;
}
