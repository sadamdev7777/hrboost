"use client";

import { tr } from "@/lib/i18n";
import { TabModul } from "@/components/TabModul";
import Link from "next/link";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { bilaDihantar } from "@/lib/format";
import { getSoalan, getStatistikSoalan, jawabSoalan, type SoalanHr } from "@/lib/urusan";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { PengepalaAkar, TabNav } from "@/components/TabNav";
import { HadPeranan, Tag } from "@/components/Senarai";
import { beritahu } from "@/components/Dialog";

/** Peti soalan daripada pekerja yang tidak dapat dijawab oleh Pembantu AI. */
export default function SoalanHrPage() {
  return (
    <HadPeranan roles={["hr", "admin"]}>
      <Kandungan />
    </HadPeranan>
  );
}

function Kandungan() {
  const me = useMe();
  const emp = me.active!;
  const d = useData(async () => {
    const [senarai, stat] = await Promise.all([getSoalan(emp.companyId), getStatistikSoalan(emp.companyId)]);
    return { senarai, stat };
  }, [emp.companyId]);
  const [tapis, setTapis] = useState<"open" | "semua">("open");
  const semua = d.data?.senarai ?? [];
  const senarai = tapis === "open" ? semua.filter((q) => q.status === "open") : semua;
  const s = d.data?.stat;

  return (
    <Screen lebar="lebar">
      <PengepalaAkar title={tr("Peti HR")} />
      <TabModul modul="peti" />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-6 lg:px-0">
        {s && (
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
            <Angka n={String(s.open)} l={tr("Belum dijawab")} tone={s.open ? "text-warning" : ""} />
            <Angka n={String(s.total)} l={tr("Soalan (30 hari)")} />
            <Angka n={s.total ? `${Math.round((s.ai_resolved / s.total) * 100)}%` : "—"} l={tr("Dijawab oleh AI")} />
            <Angka n={s.avg_hours != null ? tr("{0} jam", s.avg_hours) : "—"} l={tr("Purata masa HR menjawab")} />
          </div>
        )}
        <div className="flex gap-2">
          {(
            [
              ["open", tr("Belum dijawab")],
              ["semua", tr("Semua")],
            ] as const
          ).map(([k, t]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTapis(k)}
              className={`flex h-9 items-center rounded-full px-4 text-[13px] font-bold ${tapis === k ? "bg-primary text-white" : "border border-line bg-surface"}`}
            >
              {t}
            </button>
          ))}
        </div>
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data && <Loading />}
        {d.data && senarai.length === 0 && <div className="rounded-card bg-surface px-4 py-8 text-center text-sm text-muted">{tr("Tiada soalan {0}.", tapis === "open" ? tr("yang belum dijawab") : "")}</div>}
        {senarai.map((q) => (
          <Soalan key={q.id} q={q} onDone={d.reload} />
        ))}
        <span className="text-xs leading-snug text-muted">
          {tr("Soalan yang kerap ditanya? Tambah jawapannya dalam")}{" "}
          <Link href="/pengurusan/tetapan/pengetahuan-ai" className="font-bold">
            {tr("Pengetahuan AI")}</Link>{" "}
          {tr("supaya Pembantu AI boleh menjawab terus.")}</span>
      </main>
      <TabNav />
    </Screen>
  );
}

function Angka({ n, l, tone = "" }: { n: string; l: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-card bg-surface px-4 py-3">
      <span className="text-xs font-semibold text-muted">{l}</span>
      <b className={`text-xl font-extrabold ${tone}`}>{n}</b>
    </div>
  );
}

function Soalan({ q, onDone }: { q: SoalanHr; onDone: () => void }) {
  const [jawapan, setJawapan] = useState("");
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  async function hantar() {
    if (jawapan.trim().length < 2) return setRalat(tr("Sila taip jawapan."));
    setBusy(true);
    setRalat(null);
    try {
      await jawabSoalan(q.id, jawapan.trim());
      beritahu(tr("Jawapan dihantar kepada {0}.", q.name));
      onDone();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
      setBusy(false);
    }
  }
  return (
    <section aria-label={tr("Soalan {0}", q.name)} className="flex flex-col gap-2 rounded-card bg-surface px-4 py-3 text-sm lg:px-5">
      <div className="flex items-start justify-between gap-2">
        <span className="flex flex-col gap-0.5">
          <Link href={`/pengurusan/pekerja/${q.employment_id}`} className="text-xs font-bold text-subtle!">
            {q.name} · {bilaDihantar(q.created_at)}
          </Link>
          <b className="text-[15px] font-bold">{q.question}</b>
        </span>
        <Tag tone={q.status === "answered" ? "success" : "warning"}>{q.status === "answered" ? tr("Dijawab") : tr("Belum dijawab")}</Tag>
      </div>
      {q.ai_answer && (
        <details className="rounded-[12px] bg-ai-soft px-3 py-2 text-[13px]">
          <summary className="cursor-pointer font-bold text-ai">{tr("Jawapan Pembantu AI (tidak memadai bagi pekerja)")}</summary>
          <p className="m-0 mt-1 whitespace-pre-line">{q.ai_answer}</p>
        </details>
      )}
      {q.answer ? (
        <p className="m-0 rounded-[12px] bg-page px-3 py-2 whitespace-pre-line">
          {q.answer}
          <span className="mt-1 block text-xs text-muted">
            {q.answered_by_name} · {bilaDihantar(q.answered_at!)}
          </span>
        </p>
      ) : (
        <>
          <textarea
            rows={3}
            value={jawapan}
            onChange={(e) => setJawapan(e.target.value)}
            placeholder={tr("Taip jawapan anda…")}
            aria-label={tr("Jawapan kepada {0}", q.name)}
            className="rounded-[12px] border border-[#D5DEDC] bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary"
          />
          {ralat && <ErrorBox message={ralat} />}
          <button type="button" onClick={hantar} disabled={busy} className="flex h-10 items-center self-end rounded-full bg-primary px-5 text-[13px] font-bold text-white disabled:opacity-60">
            {busy ? tr("Menghantar…") : tr("Hantar jawapan")}
          </button>
        </>
      )}
    </section>
  );
}
