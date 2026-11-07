"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { hari, julatTarikh, masa, namaPeringkat, ringgit, tarikh, tarikhTempatan, todayISO, type StatusPermohonan } from "@/lib/format";
import { IconCheck, IconSparkle } from "./icons";
import { Avatar, BackHeader, ErrorBox, Loading, Screen, StatusPill } from "./ui";
import { ReasonSheet } from "./ReasonSheet";
import { urlSementara } from "@/lib/upload";

const VIA: Record<string, string> = { web: "aplikasi", whatsapp: "WhatsApp", ai_agent: "pembantu AI", system: "sistem" };
const TAJUK: Record<string, string> = {
  leave: "Permohonan Cuti",
  claim: "Tuntutan",
  attendance_correction: "Pembetulan Masa",
  payroll_run: "Kelulusan Gaji",
};

type Mode = { kind: "approver"; taskId: string } | { kind: "requester"; requestId: string };

// Rujukan reka bentuk: design/Butiran.dc.html
export function RequestDetail({ mode }: { mode: Mode }) {
  const me = useMe();
  const router = useRouter();
  const d = useData(() => loadDetail(mode), [mode.kind === "approver" ? mode.taskId : mode.requestId]);
  const [sheet, setSheet] = useState<null | "reject" | "return">(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const back = mode.kind === "approver" ? "/kelulusan" : "/permohonan";

  if (d.loading && !d.data) {
    return (
      <Screen>
        <BackHeader href={back} />
        <Loading />
      </Screen>
    );
  }
  if (d.error || !d.data) {
    return (
      <Screen>
        <BackHeader href={back} />
        <div className="p-5">
          <ErrorBox message={d.error ?? "Permohonan tidak dijumpai atau anda tidak mempunyai akses."} />
        </div>
      </Screen>
    );
  }

  const x = d.data;
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
      setError(err.message);
      return;
    }
    setSheet(null);
    router.push("/kelulusan");
  }

  async function batal() {
    if (!window.confirm("Batalkan permohonan ini?")) return;
    setBusy(true);
    const { error: err } = await getSupabase().rpc("approval_cancel", { p_request: x.req.id, p_via: "web" });
    setBusy(false);
    if (err) setError(err.message);
    else d.reload();
  }

  return (
    <Screen>
      <BackHeader title={TAJUK[x.req.request_type] ?? "Permohonan"} href={back} />
      <main className="flex grow flex-col gap-3.5 px-5 pt-1 pb-4">
        <section className="flex flex-col gap-3.5 rounded-[18px] bg-surface p-4">
          <div className="flex items-center gap-3">
            <Avatar name={x.requesterName} size={48} />
            <div className="flex grow flex-col gap-0.5">
              <span className="text-base font-extrabold">{x.requesterName}</span>
              <span className="text-[13px] text-muted">
                {[x.department, x.companyCode, `dihantar ${masa(x.req.submitted_at)}${x.via ? ` melalui ${VIA[x.via] ?? x.via}` : ""}`]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            {mode.kind === "requester" && <StatusPill status={x.req.status as StatusPermohonan} />}
          </div>

          {x.leave && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Jenis" value={x.leave.typeName} />
              <Field label="Tempoh" value={`${hari(x.leave.days)} hari bekerja`} />
              <Field label="Tarikh" value={julatTarikh(x.leave.start, x.leave.end)} />
              {x.leave.balanceAfter !== null && <Field label="Baki selepas" value={`${hari(x.leave.balanceAfter)} hari`} />}
            </div>
          )}
          {x.leave?.reason && <Field label="Sebab" value={x.leave.reason} plain />}
          {x.leave?.cover && <Field label="Pengganti tugas" value={x.leave.cover} plain />}
          {x.leave?.attachment && <LihatSijil path={x.leave.attachment} />}

          {x.claim && (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tajuk" value={x.claim.title} />
                <Field label="Jumlah" value={ringgit(x.claim.total)} />
              </div>
              {x.claim.items.map((it, i) => (
                <div key={i} className="flex justify-between border-t border-[#EEF2F1] pt-2 text-sm">
                  <span>
                    {it.type}
                    {it.description ? ` · ${it.description}` : ""} · {tarikh(it.date)}
                  </span>
                  <b>{ringgit(it.amount)}</b>
                </div>
              ))}
            </div>
          )}
          {!x.leave && !x.claim && <Field label="Permohonan" value={x.req.title} />}
        </section>

        {x.req.ai_summary && (
          <section className="flex flex-col gap-2 rounded-[18px] bg-ai-soft px-4 py-3.5">
            <div className="flex items-center gap-2">
              <IconSparkle size={18} className="text-ai" />
              <span className="text-sm font-extrabold text-ai-hover">Ringkasan AI</span>
            </div>
            <p className="m-0 text-sm whitespace-pre-line text-[#2E2650]">{x.req.ai_summary}</p>
          </section>
        )}

        <section className="flex flex-col gap-3 rounded-[18px] bg-surface p-4">
          <span className="text-sm font-extrabold">Aliran kelulusan</span>
          <div className="flex items-center gap-3">
            <Done />
            <span className="grow text-sm">Dihantar oleh {x.requesterName}</span>
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
                  {s.order} · {s.name}
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
      </main>

      {canAct && (
        <div className="sticky bottom-0 flex flex-col gap-2 border-t border-line-soft bg-surface px-5 pt-3 pb-7">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => setSheet("reject")}
              className="h-[54px] rounded-button border-[1.5px] border-line bg-surface text-base font-bold text-danger disabled:opacity-60"
            >
              Tolak
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => act("approve")}
              className="h-[54px] rounded-button bg-primary text-base font-extrabold text-white hover:bg-primary-hover disabled:opacity-60"
            >
              {busy ? "Memproses…" : "Lulus"}
            </button>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => setSheet("return")}
            className="h-11 bg-transparent text-sm font-bold text-primary"
          >
            Kembalikan untuk pembetulan
          </button>
        </div>
      )}

      {canCancel && (
        <div className="sticky bottom-0 border-t border-line-soft bg-surface px-5 pt-3 pb-7">
          <button
            type="button"
            disabled={busy}
            onClick={batal}
            className="h-12 w-full rounded-[14px] border border-line bg-surface text-[15px] font-bold text-danger disabled:opacity-60"
          >
            Batalkan permohonan
          </button>
        </div>
      )}

      {sheet && (
        <ReasonSheet
          title={sheet === "reject" ? "Tolak permohonan" : "Kembalikan untuk pembetulan"}
          confirmLabel={sheet === "reject" ? "Tolak" : "Kembalikan"}
          danger={sheet === "reject"}
          onCancel={() => setSheet(null)}
          onConfirm={(r) => act(sheet, r)}
        />
      )}
    </Screen>
  );
}

function LihatSijil({ path }: { path: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">Sijil sokongan</span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const url = await urlSementara(path);
          setBusy(false);
          if (url) window.open(url, "_blank", "noopener");
          else setError("Sijil tidak dapat dibuka.");
        }}
        className="self-start text-[15px] font-bold text-primary"
      >
        {busy ? "Membuka…" : "Lihat sijil"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
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
      <span className={`text-[15px] ${plain ? "" : "font-bold"}`}>{value}</span>
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
    if (!t) throw new Error("Tugasan tidak dijumpai atau anda tidak mempunyai akses.");
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
  if (!req) throw new Error("Permohonan tidak dijumpai atau anda tidak mempunyai akses.");

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

  const requesterName = p?.preferred_name || p?.full_name || "Pemohon";
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
    if (approved) return { order: s.step_order, name, state: "approved", right: approved.acted_at ? masa(approved.acted_at) : "Lulus", mine, comment: approved.comment };
    if (rejected) return { order: s.step_order, name, state: "rejected", right: "Ditolak", mine, comment: rejected.comment };
    if (returned) return { order: s.step_order, name, state: "returned", right: "Dikembalikan", mine, comment: returned.comment };
    if (pending && req.status === "pending")
      return { order: s.step_order, name, state: "current", right: "Menunggu", mine: pending.approver_person_id === me?.id, comment: null };
    if (skipped) return { order: s.step_order, name, state: "skipped", right: "Dilangkau", mine: false, comment: null };
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
  let claim: null | { title: string; total: number; items: { type: string; description: string | null; date: string; amount: number }[] } = null;

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
        if (!cover && lr.cover_person_id === me?.id) cover = "Anda";
      }
      leave = {
        typeName: lr.leave_types?.name ?? "Cuti",
        days: Number(lr.days),
        start: lr.start_date,
        end: lr.end_date,
        reason: lr.reason,
        cover,
        balanceAfter,
        attachment: lr.attachment_path,
      };
    }
  } else if (req.request_type === "claim") {
    const c = must(
      await sb
        .from("claims")
        .select("title, total_amount, claim_items(description, expense_date, amount, claim_types(name))")
        .eq("id", req.reference_id)
        .maybeSingle(),
    );
    if (c) {
      claim = {
        title: c.title,
        total: Number(c.total_amount),
        items: c.claim_items.map((i) => ({
          type: i.claim_types?.name ?? "Item",
          description: i.description,
          date: i.expense_date,
          amount: Number(i.amount),
        })),
      };
    }
  }

  return {
    req,
    requesterName,
    department: e?.departments?.name ?? null,
    companyCode: e?.companies?.code ?? null,
    via,
    tasks: ts,
    flow,
    leave,
    claim,
    isToday: tarikhTempatan(req.submitted_at) === todayISO(),
  };
}
