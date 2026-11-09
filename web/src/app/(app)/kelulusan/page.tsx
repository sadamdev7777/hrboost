"use client";

import { tr } from "@/lib/i18n";
import { beritahu } from "@/components/Dialog";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMe, type Me } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { mesejRalat, must, useData } from "@/lib/useData";
import { paparPermohonan } from "@/lib/data";
import { hari, hariTarikh, masa, masaPanjang, ringgit, tarikhTempatan, todayISO, type StatusPermohonan } from "@/lib/format";
import { IconClock } from "@/components/icons";
import { Avatar, Empty, ErrorBox, Loading, Screen, StatusPill } from "@/components/ui";
import { TabNav } from "@/components/TabNav";
import { ReasonSheet } from "@/components/ReasonSheet";
import { RequestDetail } from "@/components/RequestDetail";
import { useSkrinLebar } from "@/lib/skrin";

// Rujukan reka bentuk: design/Kelulusan.dc.html
type Filter = "all" | "leave" | "claim" | "attendance_correction" | "payroll_run" | "overtime" | "salary_advance";
const FILTER_LABEL: Record<Exclude<Filter, "all">, string> = {
  leave: tr("Cuti"),
  claim: tr("Tuntutan"),
  attendance_correction: tr("Pembetulan"),
  payroll_run: tr("Gaji"),
  overtime: tr("Lebih masa"),
  salary_advance: tr("Pendahuluan"),
};
const ROLE_LABEL: Record<string, string> = { hr: "HR", ceo: "CEO", finance: tr("Kewangan"), admin: tr("Pentadbir") };

export default function KelulusanPage() {
  const me = useMe();
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [filter, setFilter] = useState<Filter>("all");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tasks = useData(loadPending, []);
  const lebar = useSkrinLebar();
  const [pilih, setPilih] = useState<string | null>(null);
  const [tanda, setTanda] = useState<Set<string>>(new Set());
  const konteks = useData(async () => {
    const ids = (tasks.data ?? []).map((t) => t.taskId);
    if (!ids.length) return new Map<string, Konteks>();
    const rows = must(await getSupabase().rpc("approval_task_context", { p_tasks: ids })) ?? [];
    return new Map(rows.map((r) => [r.task_id, r as Konteks]));
  }, [(tasks.data ?? []).map((t) => t.taskId).join(",")]);
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
    if (err) setError(mesejRalat(err.message, err.code));
    else beritahu(action === "approve" ? tr("Diluluskan.") : tr("Ditolak. Pemohon dimaklumkan."));
    if (pilih === taskId) setPilih(null);
    tasks.reload();
  }

  // Pintasan papan kekunci (desktop): J/K atau ↓/↑ pilih, A lulus, X tanda
  const pintasan = useRef<(e: KeyboardEvent) => void>(() => {});
  const tekan = (e: KeyboardEvent) => {
    if (!lebar || tab !== "pending" || !shown.length || e.ctrlKey || e.metaKey || e.altKey) return;
    const sasaran = e.target as HTMLElement | null;
    if (sasaran && (/^(INPUT|TEXTAREA|SELECT)$/.test(sasaran.tagName) || sasaran.isContentEditable)) return;
    if (document.querySelector("[role=alertdialog],[role=dialog]")) return;
    const kini = pilih ?? shown[0].taskId;
    const i = Math.max(shown.findIndex((t) => t.taskId === kini), 0);
    const k = e.key.toLowerCase();
    if (k === "j" || e.key === "ArrowDown") {
      e.preventDefault();
      setPilih(shown[Math.min(i + 1, shown.length - 1)].taskId);
    } else if (k === "k" || e.key === "ArrowUp") {
      e.preventDefault();
      setPilih(shown[Math.max(i - 1, 0)].taskId);
    } else if (k === "a" && shown[i].type !== "payroll_run" && !busy) {
      e.preventDefault();
      const seterusnya = shown[i + 1]?.taskId ?? shown[i - 1]?.taskId ?? null;
      void act(shown[i].taskId, "approve").then(() => setPilih(seterusnya));
    } else if (k === "x" && shown[i].type !== "payroll_run") {
      e.preventDefault();
      const n = new Set(tanda);
      if (n.has(shown[i].taskId)) n.delete(shown[i].taskId);
      else n.add(shown[i].taskId);
      setTanda(n);
    }
  };
  useEffect(() => {
    pintasan.current = tekan;
  });
  useEffect(() => {
    const f = (e: KeyboardEvent) => pintasan.current(e);
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);

  async function lulusDitanda() {
    const ids = [...tanda];
    setBusy("pukal");
    setError(null);
    const gagal: string[] = [];
    for (const id of ids) {
      const { error: err } = await getSupabase().rpc("approval_act", { p_task: id, p_action: "approve", p_via: "web" });
      if (err) gagal.push(err.message);
    }
    setBusy(null);
    setTanda(new Set());
    setPilih(null);
    if (gagal.length) setError(tr("{0} diluluskan. Tidak berjaya: {1}", ids.length - gagal.length, gagal.join("; ")));
    else beritahu(tr("{0} permohonan diluluskan.", ids.length));
    tasks.reload();
  }

  return (
    <Screen>
      <main className="flex grow flex-col gap-3 px-4 pt-4 pb-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="m-0 text-2xl font-extrabold">{tr("Kelulusan")}</h1>
          <span className="text-right text-[13px] font-semibold text-muted">{labelPeranan(me)}</span>
        </div>

        <div role="tablist" className="grid grid-cols-3 gap-1 rounded-[14px] bg-[#E4EAE8] p-1">
          <button
            role="tab"
            aria-selected={tab === "pending"}
            onClick={() => setTab("pending")}
            className={`h-10 rounded-[10px] text-[13px] ${tab === "pending" ? "bg-surface font-extrabold text-ink" : "font-semibold text-subtle"}`}
          >
            {tr("Menunggu · {0}", list.length)}</button>
          <Link href="/permohonan" className="flex h-10 items-center justify-center rounded-[10px] text-[13px] font-semibold whitespace-nowrap text-subtle!">
            {tr("Permohonan Saya")}</Link>
          <button
            role="tab"
            aria-selected={tab === "history"}
            onClick={() => setTab("history")}
            className={`h-10 rounded-[10px] text-[13px] ${tab === "history" ? "bg-surface font-extrabold text-ink" : "font-semibold text-subtle"}`}
          >
            {tr("Sejarah")}</button>
        </div>

        {error && <ErrorBox message={error} />}

        {tab === "pending" && (
          <>
            <SlaBanner tasks={list} />
            {list.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Chip on={filter === "all"} onClick={() => setFilter("all")}>
                  {tr("Semua")}</Chip>
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
            {tasks.data && list.length === 0 && (
              <Empty>
                {tr("Tiada permohonan menunggu kelulusan anda.")}{!me.isHead && !me.roles.some((r) => ["hr", "finance", "ceo", "admin"].includes(r)) && (
                  <span className="mt-1 block text-xs">
                    {tr("Permohonan akan muncul di sini jika anda dilantik sebagai ketua jabatan atau wakil kelulusan. Permohonan anda sendiri ada di tab “Permohonan Saya”.")}</span>
                )}
              </Empty>
            )}

            {lebar && shown.length > 0 ? (
              <div className="grid grid-cols-[minmax(0,400px)_minmax(0,1fr)] items-start gap-5">
                <div className="flex flex-col gap-2">
                  <div className="flex min-h-11 items-center justify-between gap-2 rounded-[14px] bg-surface px-3">
                    <label className="flex items-center gap-2 text-[13px] font-semibold">
                      <input
                        type="checkbox"
                        className="size-[18px] accent-primary"
                        checked={tanda.size > 0 && shown.every((t) => tanda.has(t.taskId))}
                        onChange={(e) => setTanda(e.target.checked ? new Set(shown.filter((t) => t.type !== "payroll_run").map((t) => t.taskId)) : new Set())}
                      />
                      {tr("Pilih semua")}</label>
                    <button
                      type="button"
                      disabled={!tanda.size || busy === "pukal"}
                      onClick={lulusDitanda}
                      className="flex h-9 items-center rounded-full bg-primary px-4 text-[13px] font-bold text-white disabled:opacity-40"
                    >
                      {busy === "pukal" ? tr("Meluluskan…") : tr("Lulus {0} dipilih", tanda.size || "")}
                    </button>
                  </div>
                  <span className="px-1 text-[11px] text-muted">
                    {tr("Pintasan:")}{" "}<kbd className="rounded border border-line px-1 font-sans">J</kbd>/<kbd className="rounded border border-line px-1 font-sans">K</kbd> {" "}{tr("pilih ·")}{" "}
                    <kbd className="rounded border border-line px-1 font-sans">A</kbd> {" "}{tr("lulus ·")}{" "}<kbd className="rounded border border-line px-1 font-sans">X</kbd> tanda
                  </span>
                  {shown.map((t, i) => {
                    const aktif = (pilih ?? shown[0].taskId) === t.taskId;
                    return (
                      <div
                        key={t.taskId}
                        ref={aktif ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}
                        aria-current={aktif ? "true" : undefined}
                        className={`flex cursor-pointer gap-3 rounded-[14px] px-3 py-3 ${aktif ? "bg-[#E3F1EE] ring-2 ring-primary" : "bg-surface hover:bg-[#F7F9F8]"}`}
                        onClick={() => setPilih(t.taskId)}
                      >
                        {t.type !== "payroll_run" ? (
                          <input
                            type="checkbox"
                            aria-label={tr("Pilih {0}", t.name)}
                            className="mt-1 size-[18px] shrink-0 accent-primary"
                            checked={tanda.has(t.taskId)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const n = new Set(tanda);
                              if (e.target.checked) n.add(t.taskId);
                              else n.delete(t.taskId);
                              setTanda(n);
                            }}
                          />
                        ) : (
                          <span className="w-[18px] shrink-0" />
                        )}
                        <Avatar name={t.name} index={i} size={36} />
                        <div className="flex min-w-0 grow flex-col gap-0.5">
                          <div className="flex justify-between gap-2">
                            <span className="truncate text-sm font-extrabold">{t.name}</span>
                            <span className="text-xs whitespace-nowrap text-muted">{masa(t.assignedAt)}</span>
                          </div>
                          <span className="truncate text-[13px] font-semibold">{t.title}</span>
                          <BarisKonteks k={konteks.data?.get(t.taskId)} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="sticky top-4 rounded-[18px] bg-page">
                  <RequestDetail
                    key={pilih ?? shown[0].taskId}
                    mode={{ kind: "approver", taskId: pilih ?? shown[0].taskId }}
                    tertanam={{ onSelesai: () => { setPilih(null); tasks.reload(); } }}
                  />
                </div>
              </div>
            ) : (
            <div className="flex flex-col gap-2.5">
              {shown.map((t, i) => (
                <div key={t.taskId} className="flex flex-col gap-2.5 rounded-[18px] bg-surface px-4 py-3">
                  <Link href={`/kelulusan/${t.taskId}`} className="flex gap-3 text-ink!">
                    <Avatar name={t.name} index={i} />
                    <div className="flex grow flex-col gap-[3px]">
                      <div className="flex justify-between gap-2">
                        <span className="text-sm font-extrabold">{t.name}</span>
                        <span className="text-xs whitespace-nowrap text-muted">{masa(t.assignedAt)}</span>
                      </div>
                      <span className="text-sm font-semibold">{t.title}</span>
                      <BarisKonteks k={konteks.data?.get(t.taskId)} />
                      {t.ai && <span className="text-[13px] text-ai">{tr("AI: {0}", t.ai)}</span>}
                    </div>
                  </Link>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={busy === t.taskId}
                      onClick={() => setRejecting(t.taskId)}
                      className="h-11 rounded-xl border-[1.5px] border-line bg-surface text-sm font-bold text-danger disabled:opacity-60"
                    >
                      {tr("Tolak")}</button>
                    <button
                      type="button"
                      disabled={busy === t.taskId}
                      onClick={() => act(t.taskId, "approve")}
                      className="h-11 rounded-xl bg-primary text-sm font-extrabold text-white hover:bg-primary-hover disabled:opacity-60"
                    >
                      {busy === t.taskId ? "…" : tr("Lulus")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            )}
          </>
        )}

        {tab === "history" && (
          <div className="flex flex-col gap-2.5">
            {history.error && <ErrorBox message={history.error} />}
            {history.loading && !history.data && <Loading />}
            {history.data && history.data.length === 0 && <Empty>{tr("Belum ada keputusan direkodkan.")}</Empty>}
            {history.data?.map((h) => (
              <div key={h.taskId} className="flex items-center justify-between gap-2 rounded-card bg-surface px-4 py-3">
                <span className="flex flex-col gap-0.5">
                  <b className="text-sm">{h.title}</b>
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
          title={tr("Tolak permohonan")}
          confirmLabel={tr("Tolak")}
          danger
          onCancel={() => setRejecting(null)}
          onConfirm={(r) => act(rejecting, "reject", r)}
        />
      )}
    </Screen>
  );
}

type Konteks = { task_id: string; balance_after: number | null; team_off: number; team_names: string | null; has_attachment: boolean };

/** Satu baris konteks supaya keputusan mudah boleh dibuat tanpa membuka butiran. */
function BarisKonteks({ k }: { k: Konteks | undefined }) {
  if (!k) return null;
  const bah: { t: string; tone: string }[] = [];
  if (k.balance_after !== null && k.balance_after !== undefined)
    bah.push({ t: tr("Baki selepas: {0} hari", hari(Number(k.balance_after))), tone: Number(k.balance_after) < 0 ? "text-danger" : "text-subtle" });
  if (k.team_off > 0) bah.push({ t: tr("{0} rakan bercuti ({1})", k.team_off, k.team_names), tone: "text-warning" });
  else if (k.balance_after !== null) bah.push({ t: tr("Tiada rakan sejabatan bercuti"), tone: "text-subtle" });
  if (k.has_attachment) bah.push({ t: tr("Ada lampiran"), tone: "text-subtle" });
  if (!bah.length) return null;
  return (
    <span className="flex flex-wrap gap-x-2 text-xs">
      {bah.map((b, i) => (
        <span key={i} className={b.tone}>
          {i > 0 ? "· " : ""}
          {b.t}
        </span>
      ))}
    </span>
  );
}

function labelPeranan(me: Me): string {
  if (me.isHead && me.active?.departmentName) return tr("{0} · Ketua {1}", me.name, me.active.departmentName);
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
    ? tr("Ada permohonan yang melepasi had masa. Sila selesaikan segera.")
    : tarikhTempatan(due) === todayISO()
      ? tr("Selesaikan sebelum {0} hari ini", masaPanjang(due))
      : tr("Selesaikan sebelum {0}, {1}", hariTarikh(tarikhTempatan(due)), masaPanjang(due));
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
  return rows.map((r) => {
    const ctx = (r.context as Record<string, unknown>) ?? {};
    const v = paparPermohonan({ type: r.request_type!, title: r.title!, context: ctx, submittedAt: r.submitted_at! });
    const title =
      r.request_type === "leave"
        ? tr("{0} · {1} hari", v.title, hari(Number(ctx.days ?? 0)))
        : r.request_type === "claim"
          ? `${v.title} · ${ringgit(Number(ctx.amount ?? 0))}`
          : v.title;
    return {
      taskId: r.task_id!,
      type: r.request_type as Tugasan["type"],
      name: r.requester_nickname || r.requester_name || tr("Pemohon"),
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
      : { title: tr("Permohonan") };
    return {
      taskId: t.id,
      title: v.title,
      step: t.step_name,
      actedAt: t.acted_at,
      status: (t.status === "approved" ? "approved" : t.status === "rejected" ? "rejected" : "returned") as StatusPermohonan,
    };
  });
}
