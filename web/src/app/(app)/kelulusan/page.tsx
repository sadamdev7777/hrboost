"use client";

import Link from "next/link";
import { useState } from "react";
import { useMe, type Me } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { paparPermohonan } from "@/lib/data";
import { hari, hariTarikh, masa, masaPanjang, ringgit, tarikhTempatan, todayISO, type StatusPermohonan } from "@/lib/format";
import { IconClock } from "@/components/icons";
import { Avatar, Empty, ErrorBox, Loading, Screen, StatusPill } from "@/components/ui";
import { TabNav } from "@/components/TabNav";
import { ReasonSheet } from "@/components/ReasonSheet";

// Rujukan reka bentuk: design/Kelulusan.dc.html
type Filter = "all" | "leave" | "claim" | "attendance_correction" | "payroll_run";
const FILTER_LABEL: Record<Exclude<Filter, "all">, string> = {
  leave: "Cuti",
  claim: "Tuntutan",
  attendance_correction: "Pembetulan",
  payroll_run: "Gaji",
};
const ROLE_LABEL: Record<string, string> = { hr: "HR", ceo: "CEO", finance: "Kewangan", admin: "Pentadbir" };

export default function KelulusanPage() {
  const me = useMe();
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [filter, setFilter] = useState<Filter>("all");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tasks = useData(loadPending, []);
  const history = useData(() => (tab === "history" ? loadHistory(me.personId) : Promise.resolve(null)), [tab]);

  const list = tasks.data ?? [];
  const shown = list.filter((t) => filter === "all" || t.type === filter);
  const counts = list.reduce<Record<string, number>>((m, t) => ({ ...m, [t.type]: (m[t.type] ?? 0) + 1 }), {});

  async function act(taskId: string, action: "approve" | "reject", comment?: string) {
    setBusy(taskId);
    setError(null);
    const { error: err } = await getSupabase().rpc("approval_act", {
      p_task: taskId,
      p_action: action,
      p_comment: comment,
      p_via: "web",
    });
    setBusy(null);
    setRejecting(null);
    if (err) setError(err.message);
    tasks.reload();
  }

  return (
    <Screen>
      <main className="flex grow flex-col gap-3.5 px-5 pt-6 pb-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="m-0 text-2xl font-extrabold">Kelulusan</h1>
          <span className="text-right text-[13px] font-semibold text-muted">{labelPeranan(me)}</span>
        </div>

        <div role="tablist" className="grid grid-cols-3 gap-1 rounded-[14px] bg-[#E4EAE8] p-1">
          <button
            role="tab"
            aria-selected={tab === "pending"}
            onClick={() => setTab("pending")}
            className={`h-10 rounded-[10px] text-[13px] ${tab === "pending" ? "bg-surface font-extrabold text-ink" : "font-semibold text-subtle"}`}
          >
            Menunggu · {list.length}
          </button>
          <Link href="/permohonan" className="flex h-10 items-center justify-center rounded-[10px] text-[13px] font-semibold whitespace-nowrap text-subtle!">
            Permohonan Saya
          </Link>
          <button
            role="tab"
            aria-selected={tab === "history"}
            onClick={() => setTab("history")}
            className={`h-10 rounded-[10px] text-[13px] ${tab === "history" ? "bg-surface font-extrabold text-ink" : "font-semibold text-subtle"}`}
          >
            Sejarah
          </button>
        </div>

        {error && <ErrorBox message={error} />}

        {tab === "pending" && (
          <>
            <SlaBanner tasks={list} />
            {list.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Chip on={filter === "all"} onClick={() => setFilter("all")}>
                  Semua
                </Chip>
                {(Object.keys(FILTER_LABEL) as Exclude<Filter, "all">[])
                  .filter((k) => counts[k])
                  .map((k) => (
                    <Chip key={k} on={filter === k} onClick={() => setFilter(k)}>
                      {FILTER_LABEL[k]} · {counts[k]}
                    </Chip>
                  ))}
              </div>
            )}
            {tasks.error && <ErrorBox message={tasks.error} />}
            {tasks.loading && !tasks.data && <Loading />}
            {tasks.data && list.length === 0 && <Empty>Tiada permohonan menunggu kelulusan anda.</Empty>}

            <div className="flex flex-col gap-2.5">
              {shown.map((t, i) => (
                <div key={t.taskId} className="flex flex-col gap-2.5 rounded-[18px] bg-surface px-4 py-3.5">
                  <Link href={`/kelulusan/${t.taskId}`} className="flex gap-3 text-ink!">
                    <Avatar name={t.name} index={i} />
                    <div className="flex grow flex-col gap-[3px]">
                      <div className="flex justify-between gap-2">
                        <span className="text-[15px] font-extrabold">{t.name}</span>
                        <span className="text-xs whitespace-nowrap text-muted">{masa(t.assignedAt)}</span>
                      </div>
                      <span className="text-sm font-semibold">{t.title}</span>
                      {t.ai && <span className="text-[13px] text-ai">AI: {t.ai}</span>}
                    </div>
                  </Link>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={busy === t.taskId}
                      onClick={() => setRejecting(t.taskId)}
                      className="h-11 rounded-xl border-[1.5px] border-line bg-surface text-sm font-bold text-danger disabled:opacity-60"
                    >
                      Tolak
                    </button>
                    <button
                      type="button"
                      disabled={busy === t.taskId}
                      onClick={() => act(t.taskId, "approve")}
                      className="h-11 rounded-xl bg-primary text-sm font-extrabold text-white hover:bg-primary-hover disabled:opacity-60"
                    >
                      {busy === t.taskId ? "…" : "Lulus"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "history" && (
          <div className="flex flex-col gap-2.5">
            {history.error && <ErrorBox message={history.error} />}
            {history.loading && !history.data && <Loading />}
            {history.data && history.data.length === 0 && <Empty>Belum ada keputusan direkodkan.</Empty>}
            {history.data?.map((h) => (
              <div key={h.taskId} className="flex items-center justify-between gap-2 rounded-card bg-surface px-4 py-3.5">
                <span className="flex flex-col gap-0.5">
                  <b className="text-[15px]">{h.title}</b>
                  <span className="text-xs text-muted">
                    {h.step} · {h.actedAt ? `${hariTarikh(tarikhTempatan(h.actedAt))}, ${masa(h.actedAt)}` : ""}
                  </span>
                </span>
                <StatusPill status={h.status} />
              </div>
            ))}
          </div>
        )}
      </main>
      <TabNav />
      {rejecting && (
        <ReasonSheet
          title="Tolak permohonan"
          confirmLabel="Tolak"
          danger
          onCancel={() => setRejecting(null)}
          onConfirm={(r) => act(rejecting, "reject", r)}
        />
      )}
    </Screen>
  );
}

function labelPeranan(me: Me): string {
  if (me.isHead && me.active?.departmentName) return `${me.name} · Ketua ${me.active.departmentName}`;
  const r = me.roles.find((x) => ROLE_LABEL[x]);
  return r ? `${me.name} · ${ROLE_LABEL[r]}` : me.name;
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`h-9 rounded-full px-3.5 text-[13px] ${
        on ? "border-0 bg-ink font-bold text-white" : "border border-line bg-surface font-semibold text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function SlaBanner({ tasks }: { tasks: Tugasan[] }) {
  const due = tasks.map((t) => t.slaDueAt).filter((x): x is string => !!x).sort()[0];
  if (!due) return null;
  const breached = tasks.some((t) => t.breached);
  const text = breached
    ? "Ada permohonan yang melepasi had masa. Sila selesaikan segera."
    : tarikhTempatan(due) === todayISO()
      ? `Selesaikan sebelum ${masaPanjang(due)} hari ini`
      : `Selesaikan sebelum ${hariTarikh(tarikhTempatan(due))}, ${masaPanjang(due)}`;
  return (
    <div className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 ${breached ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning"}`}>
      <IconClock size={18} />
      <span className="text-[13px] font-semibold">{text}</span>
    </div>
  );
}

type Tugasan = {
  taskId: string;
  type: Exclude<Filter, "all">;
  name: string;
  title: string;
  ai: string | null;
  assignedAt: string;
  slaDueAt: string | null;
  breached: boolean;
};

async function loadPending(): Promise<Tugasan[]> {
  const sb = getSupabase();
  const rows = must(await sb.from("v_my_approval_tasks").select("*").order("assigned_at"));
  if (rows.length === 0) return [];
  const reqs = must(
    await sb.from("approval_requests").select("id, requester_person_id").in("id", rows.map((r) => r.request_id!)),
  );
  const pids = [...new Set(reqs.map((r) => r.requester_person_id))];
  const people = must(await sb.from("persons").select("id, preferred_name, full_name").in("id", pids));
  return rows.map((r) => {
    const pid = reqs.find((x) => x.id === r.request_id)?.requester_person_id;
    const p = people.find((x) => x.id === pid);
    const ctx = (r.context as Record<string, unknown>) ?? {};
    const v = paparPermohonan({ type: r.request_type!, title: r.title!, context: ctx, submittedAt: r.submitted_at! });
    const title =
      r.request_type === "leave"
        ? `${v.title} · ${hari(Number(ctx.days ?? 0))} hari`
        : r.request_type === "claim"
          ? `${v.title} · ${ringgit(Number(ctx.amount ?? 0))}`
          : v.title;
    return {
      taskId: r.task_id!,
      type: r.request_type as Tugasan["type"],
      name: p?.preferred_name || p?.full_name || r.requester_name || "Pemohon",
      title,
      ai: r.ai_summary,
      assignedAt: r.assigned_at!,
      slaDueAt: r.sla_due_at,
      breached: !!r.sla_breached,
    };
  });
}

async function loadHistory(personId: string) {
  const sb = getSupabase();
  const rows = must(
    await sb
      .from("approval_tasks")
      .select("id, step_name, status, acted_at, approval_requests(title, request_type, context, submitted_at)")
      .eq("approver_person_id", personId)
      .in("status", ["approved", "rejected", "returned"])
      .order("acted_at", { ascending: false })
      .limit(30),
  );
  return rows.map((t) => {
    const r = t.approval_requests;
    const v = r
      ? paparPermohonan({ type: r.request_type, title: r.title, context: (r.context as Record<string, unknown>) ?? {}, submittedAt: r.submitted_at })
      : { title: "Permohonan" };
    return {
      taskId: t.id,
      title: v.title,
      step: t.step_name,
      actedAt: t.acted_at,
      status: (t.status === "approved" ? "approved" : t.status === "rejected" ? "rejected" : "returned") as StatusPermohonan,
    };
  });
}
