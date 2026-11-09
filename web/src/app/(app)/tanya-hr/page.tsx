"use client";

import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { bilaDihantar } from "@/lib/format";
import { panggilAi } from "@/lib/ai";
import { getSoalan, tanyaHr } from "@/lib/urusan";
import { BackHeader, ErrorBox, Screen } from "@/components/ui";
import { ButangUtama, Seksyen, Tag } from "@/components/Senarai";
import { beritahu } from "@/components/Dialog";

/**
 * Tanya HR: soalan dijawab dahulu oleh Pembantu AI daripada buku panduan syarikat.
 * Jika tidak memadai, soalan dihantar kepada HR (WhatsApp) dan jawapan direkodkan di sini.
 */
export default function TanyaHrPage() {
  const me = useMe();
  const emp = me.active!;
  const d = useData(() => getSoalan(emp.companyId, true), [emp.companyId]);
  const [soalan, setSoalan] = useState("");
  const [ai, setAi] = useState<string | null>(null);
  const [tahap, setTahap] = useState<"tulis" | "ai" | "hantar">("tulis");
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);

  async function tanya() {
    if (soalan.trim().length < 3) return setRalat("Sila taip soalan anda.");
    setBusy(true);
    setRalat(null);
    try {
      const r = await panggilAi<{ balasan: string }>("pembantu-ai", { mesej: soalan.trim(), company_id: emp.companyId });
      setAi(r.balasan);
      setTahap("ai");
    } catch {
      // Pembantu AI tidak tersedia: terus hantar kepada HR
      await hantar(null, true);
    }
    setBusy(false);
  }

  async function hantar(jawapanAi: string | null, kepadaHr: boolean) {
    setBusy(true);
    setRalat(null);
    try {
      await tanyaHr(emp.id, soalan.trim(), jawapanAi, kepadaHr);
      beritahu(kepadaHr ? "Soalan dihantar kepada HR. Jawapan akan dihantar melalui WhatsApp." : "Terima kasih.");
      setSoalan("");
      setAi(null);
      setTahap("tulis");
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
    }
    setBusy(false);
  }

  const sejarah = (d.data ?? []).filter((q) => q.status !== "ai_resolved");
  return (
    <Screen lebar="sederhana">
      <BackHeader title="Tanya HR" href="/saya" />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-6">
        <span className="text-sm leading-snug text-subtle">Soalan tentang cuti, gaji, tuntutan atau polisi syarikat. Pembantu AI menjawab dahulu daripada buku panduan; jika belum jelas, soalan anda dihantar kepada HR.</span>
        <textarea
          rows={4}
          value={soalan}
          disabled={tahap === "ai"}
          onChange={(e) => setSoalan(e.target.value)}
          placeholder="Contoh: Bolehkah saya membawa baki cuti tahunan ke tahun hadapan?"
          className="rounded-[14px] border border-[#D5DEDC] bg-surface px-3.5 py-3 text-sm text-ink outline-none focus:border-primary disabled:bg-page"
          aria-label="Soalan"
        />
        {ralat && <ErrorBox message={ralat} />}
        {tahap === "tulis" && (
          <ButangUtama onClick={tanya} busy={busy}>
            Tanya
          </ButangUtama>
        )}
        {tahap === "ai" && ai && (
          <section aria-label="Jawapan Pembantu AI" className="flex flex-col gap-3 rounded-card bg-ai-soft px-4 py-3.5">
            <b className="text-xs font-bold tracking-[0.04em] text-ai">JAWAPAN PEMBANTU AI</b>
            <p className="m-0 text-sm leading-relaxed whitespace-pre-line text-ink">{ai}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={busy} onClick={() => hantar(ai, false)} className="h-11 rounded-button border border-ai bg-surface text-[13px] font-bold text-ai disabled:opacity-60">
                Ini menjawab soalan saya
              </button>
              <button type="button" disabled={busy} onClick={() => hantar(ai, true)} className="h-11 rounded-button bg-ai text-[13px] font-bold text-white disabled:opacity-60">
                Hantar kepada HR
              </button>
            </div>
          </section>
        )}

        {sejarah.length > 0 && (
          <>
            <Seksyen className="pt-2">SOALAN SAYA KEPADA HR</Seksyen>
            <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              {sejarah.map((q) => (
                <div key={q.id} className="flex flex-col gap-1.5 py-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <b className="font-bold">{q.question}</b>
                    <Tag tone={q.status === "answered" ? "success" : "warning"}>{q.status === "answered" ? "Dijawab" : "Menunggu HR"}</Tag>
                  </div>
                  {q.answer && (
                    <p className="m-0 rounded-[12px] bg-page px-3 py-2 leading-snug whitespace-pre-line">
                      {q.answer}
                      <span className="mt-1 block text-xs text-muted">
                        {q.answered_by_name ?? "HR"} · {bilaDihantar(q.answered_at!)}
                      </span>
                    </p>
                  )}
                  {!q.answer && <span className="text-xs text-muted">Dihantar {bilaDihantar(q.created_at)}</span>}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </Screen>
  );
}
