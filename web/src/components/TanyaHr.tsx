"use client";

import { tr } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { panggilAi } from "@/lib/ai";
import { bilaDihantar, masa, tarikh, todayISO } from "@/lib/format";
import { getSoalan, tanyaHr } from "@/lib/urusan";
import { BackHeader, ErrorBox, Screen } from "./ui";
import { Seksyen, Tag } from "./Senarai";
import { beritahu } from "./Dialog";

const CADANGAN = [tr("Berapakah baki cuti saya?"), tr("Adakah tuntutan saya telah diluluskan?"), tr("Berapa harikah cuti paterniti?"), tr("Saya memerlukan surat pengesahan jawatan")];
const TINDAKAN: Record<string, string> = { submit_leave: tr("Menghantar permohonan cuti"), request_letter: tr("Meminta surat daripada HR"), create_claim: tr("Membaca resit"), approve_task: tr("Meluluskan permohonan") };

/** Satu mesej sembang. `soalan` = soalan pengguna yang dijawab (untuk dihantar kepada HR). `status` = sudah dihantar kepada HR. */
type Mesej = { role: "user" | "assistant" | "hr"; text: string; soalan?: string; dihantar?: boolean };

/**
 * Tanya HR (gabungan Pembantu AI + Tanya HR): Pembantu AI menjawab serta-merta menggunakan data pekerja sendiri
 * dan buku panduan syarikat. Jika belum memadai, satu tekan menghantar soalan (bersama jawapan AI) ke Peti HR;
 * HR membalas melalui WhatsApp dan jawapan direkodkan di bawah "Soalan saya kepada HR".
 */
export function TanyaHr() {
  const me = useMe();
  const emp = me.active!;
  const sejarah = useData(() => getSoalan(emp.companyId, true), [emp.companyId]);
  const [mesej, setMesej] = useState<Mesej[]>([]);
  const [input, setInput] = useState("");
  const [conv, setConv] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const bawah = useRef<HTMLDivElement>(null);
  const tindakan = useData(async () => must(await getSupabase().rpc("my_ai_actions", { p_limit: 3 })) ?? [], []);

  useEffect(() => {
    if (mesej.length) bawah.current?.scrollIntoView({ behavior: "smooth" });
  }, [mesej.length, busy]);

  async function tanya(teks: string) {
    const t = teks.trim();
    if (!t || busy) return;
    setRalat(null);
    setInput("");
    setMesej((m) => [...m, { role: "user", text: t }]);
    setBusy(true);
    try {
      const r = await panggilAi<{ balasan: string; conversation_id: string }>("pembantu-ai", { mesej: t, company_id: emp.companyId, conversation_id: conv });
      setConv(r.conversation_id);
      setMesej((m) => [...m, { role: "assistant", text: r.balasan, soalan: t }]);
    } catch (e) {
      // AI tidak tersedia (cth. belum diaktifkan atau had bulanan habis): tawarkan hantar terus kepada HR
      const sebab = e instanceof Error && e.message ? e.message : tr("Pembantu AI tidak tersedia sekarang.");
      setMesej((m) => [...m, { role: "hr", text: `${sebab}\n${tr("Hantar soalan ini terus kepada HR?")}`, soalan: t }]);
    }
    setBusy(false);
  }

  async function kepadaHr(i: number) {
    const m = mesej[i];
    if (!m?.soalan || busy) return;
    setBusy(true);
    setRalat(null);
    try {
      await tanyaHr(emp.id, m.soalan, m.role === "assistant" ? m.text : null, true);
      setMesej((x) => x.map((y, j) => (j === i ? { ...y, dihantar: true } : y)));
      beritahu(tr("Soalan dihantar kepada HR. Jawapan akan dihantar melalui WhatsApp."));
      sejarah.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
    setBusy(false);
  }

  const soalanHr = (sejarah.data ?? []).filter((q) => q.status !== "ai_resolved");

  return (
    <Screen lebar="sederhana">
      <BackHeader title={tr("Tanya HR")} href="/saya" />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-4">
        {mesej.length === 0 && (
          <>
            <div className="flex flex-col gap-1.5 rounded-card bg-[#F3F0FC] px-4 py-4">
              <b className="text-lg font-extrabold text-[#4A3B8C]">{tr("Tanya apa sahaja tentang HR")}</b>
              <span className="text-[13px] leading-normal text-[#4A3B8C]">
                {tr("Pembantu AI menjawab serta-merta daripada data anda dan buku panduan syarikat. Jika belum jelas, tekan “Hantar kepada HR” — HR akan membalas melalui WhatsApp.")}
              </span>
            </div>
            <Seksyen>{tr("CUBA TANYA")}</Seksyen>
            <div className="flex flex-wrap gap-2">
              {CADANGAN.map((c) => (
                <button key={c} type="button" onClick={() => tanya(c)} className="min-h-11 rounded-[14px] border border-[#D9D2F1] bg-surface px-3.5 py-2 text-left text-sm font-semibold text-[#4A3B8C]">
                  {c}
                </button>
              ))}
            </div>
            {(tindakan.data ?? []).length > 0 && (
              <>
                <Seksyen className="pt-1">{tr("TINDAKAN EJEN UNTUK ANDA")}</Seksyen>
                <div className="flex flex-col rounded-card bg-surface px-4 text-sm [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
                  {tindakan.data!.map((a, i) => (
                    <div key={i} className="flex min-h-12 flex-col justify-center py-2">
                      <b>
                        {TINDAKAN[a.action] ?? a.action}
                        {(a.payload as { mula?: string; tamat?: string })?.mula ? ` ${tarikh((a.payload as { mula: string }).mula)}` : ""}
                      </b>
                      <span className="text-xs text-muted">
                        {a.created_at.slice(0, 10) === todayISO() ? tr("Hari ini") : tarikh(a.created_at)} {masa(a.created_at)} · {a.channel === "whatsapp" ? tr("WhatsApp") : tr("Aplikasi")}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {mesej.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="max-w-[88%] self-end rounded-[16px] rounded-tr-sm bg-primary px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-white">
              {m.text}
            </div>
          ) : (
            <div key={i} className="flex max-w-[88%] flex-col gap-2 self-start">
              <div className="rounded-[16px] rounded-tl-sm bg-surface px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">{m.text}</div>
              {m.dihantar ? (
                <span className="px-1 text-xs font-bold text-success">{tr("✓ Dihantar kepada HR. Jawapan akan dihantar melalui WhatsApp.")}</span>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => kepadaHr(i)}
                  className="flex min-h-10 items-center self-start rounded-full border border-ai px-3.5 text-[13px] font-bold text-ai disabled:opacity-50"
                >
                  {m.role === "hr" ? tr("Hantar kepada HR") : tr("Masih perlukan bantuan? Hantar kepada HR")}
                </button>
              )}
            </div>
          ),
        )}
        {busy && <div className="self-start rounded-[16px] rounded-tl-sm bg-surface px-3.5 py-2.5 text-sm text-muted">{tr("Sedang menyemak…")}</div>}
        {ralat && <ErrorBox message={ralat} />}

        {soalanHr.length > 0 && (
          <>
            <Seksyen className="pt-2">{tr("SOALAN SAYA KEPADA HR")}</Seksyen>
            <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              {soalanHr.map((q) => (
                <div key={q.id} className="flex flex-col gap-1.5 py-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <b className="font-bold">{q.question}</b>
                    <Tag tone={q.status === "answered" ? "success" : "warning"}>{q.status === "answered" ? tr("Dijawab") : tr("Menunggu HR")}</Tag>
                  </div>
                  {q.answer && (
                    <p className="m-0 rounded-[12px] bg-page px-3 py-2 leading-snug whitespace-pre-line">
                      {q.answer}
                      <span className="mt-1 block text-xs text-muted">
                        {q.answered_by_name ?? "HR"} · {bilaDihantar(q.answered_at!)}
                      </span>
                    </p>
                  )}
                  {!q.answer && <span className="text-xs text-muted">{tr("Dihantar {0}", bilaDihantar(q.created_at))}</span>}
                </div>
              ))}
            </div>
          </>
        )}
        <div ref={bawah} />
      </main>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void tanya(input);
        }}
        className="sticky bottom-0 flex items-center gap-2 border-t border-line-soft bg-surface px-4 pt-3 pb-5"
      >
        <label className="sr-only" htmlFor="soalan">
          {tr("Soalan")}
        </label>
        <input
          id="soalan"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={tr("Taip soalan…")}
          maxLength={2000}
          className="h-12 min-w-0 grow rounded-full border border-line bg-page px-4 text-sm outline-none focus:border-primary"
        />
        <button type="submit" aria-label={tr("Hantar")} disabled={busy || !input.trim()} className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-50">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
          </svg>
        </button>
      </form>
    </Screen>
  );
}
