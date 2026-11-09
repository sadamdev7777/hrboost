"use client";

import { tr } from "@/lib/i18n";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { panggilAi } from "@/lib/ai";
import { masa, tarikh, todayISO } from "@/lib/format";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { Seksyen } from "@/components/Senarai";

const CADANGAN = [tr("Berapakah baki cuti saya?"), tr("Adakah tuntutan saya telah diluluskan?"), tr("Berapa harikah cuti paterniti?"), tr("Saya memerlukan surat pengesahan jawatan")];
const TINDAKAN: Record<string, string> = { submit_leave: tr("Menghantar permohonan cuti"), request_letter: tr("Meminta surat daripada HR"), create_claim: tr("Membaca resit"), approve_task: tr("Meluluskan permohonan") };
const JENIS_SURAT = [tr("Pengesahan jawatan"), tr("Pengesahan gaji"), tr("Tawaran kerja"), tr("Amaran"), tr("Tamat percubaan"), tr("Pelepasan jawatan")];

type Mesej = { role: "user" | "assistant"; text: string };

// Rujukan reka bentuk: design/PembantuAI.dc.html
export default function PembantuAiPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Halaman />
    </Suspense>
  );
}

function Halaman() {
  const sp = useSearchParams();
  const pekerja = sp.get("pekerja");
  return pekerja && sp.get("surat") ? <DrafSurat employmentId={pekerja} /> : <Sembang />;
}

function Sembang() {
  const me = useMe();
  const emp = me.active!;
  const [mesej, setMesej] = useState<Mesej[]>([]);
  const [input, setInput] = useState("");
  const [conv, setConv] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const bawah = useRef<HTMLDivElement>(null);
  const tindakan = useData(async () => must(await getSupabase().rpc("my_ai_actions", { p_limit: 3 })) ?? [], [mesej.length > 0 ? mesej.length : 0]);

  useEffect(() => {
    bawah.current?.scrollIntoView({ behavior: "smooth" });
  }, [mesej.length, busy]);

  async function hantar(teks: string) {
    const t = teks.trim();
    if (!t || busy) return;
    setRalat(null);
    setInput("");
    setMesej((m) => [...m, { role: "user", text: t }]);
    setBusy(true);
    try {
      const r = await panggilAi<{ balasan: string; conversation_id: string }>("pembantu-ai", { mesej: t, company_id: emp.companyId, conversation_id: conv });
      setConv(r.conversation_id);
      setMesej((m) => [...m, { role: "assistant", text: r.balasan }]);
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
    setBusy(false);
  }

  return (
    <Screen lebar="sederhana">
      <BackHeader title={tr("Pembantu AI")} href="/saya" />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-4">
        {mesej.length === 0 && (
          <>
            <div className="flex flex-col gap-1.5 rounded-card bg-[#F3F0FC] px-4 py-4">
              <b className="text-lg font-extrabold text-[#4A3B8C]">{tr("Tanya apa sahaja tentang HR")}</b>
              <span className="text-[13px] leading-normal text-[#4A3B8C]">{tr("Sama seperti menghantar WhatsApp kepada nombor HRBoost. Ejen hanya boleh melihat data anda sendiri.")}</span>
            </div>
            <Seksyen>{tr("CUBA TANYA")}</Seksyen>
            <div className="flex flex-wrap gap-2">
              {CADANGAN.map((c) => (
                <button key={c} type="button" onClick={() => hantar(c)} className="min-h-11 rounded-[14px] border border-[#D9D2F1] bg-surface px-3.5 py-2 text-left text-sm font-semibold text-[#4A3B8C]">
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
        {mesej.map((m, i) => (
          <div
            key={i}
            className={`max-w-[88%] rounded-[16px] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "self-end rounded-tr-sm bg-primary text-white" : "self-start rounded-tl-sm bg-surface"}`}
          >
            {m.text}
          </div>
        ))}
        {busy && <div className="self-start rounded-[16px] rounded-tl-sm bg-surface px-3.5 py-2.5 text-sm text-muted">{tr("Sedang menyemak…")}</div>}
        {ralat && <ErrorBox message={ralat} />}
        <div ref={bawah} />
      </main>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void hantar(input);
        }}
        className="sticky bottom-0 flex items-center gap-2 border-t border-line-soft bg-surface px-4 pt-3 pb-5"
      >
        <label className="sr-only" htmlFor="soalan">
          {tr("Soalan")}</label>
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

function DrafSurat({ employmentId }: { employmentId: string }) {
  const p = useData(
    async () =>
      must(await getSupabase().from("employments").select("persons!employments_person_id_fkey(preferred_name, full_name)").eq("id", employmentId).maybeSingle()),
    [employmentId],
  );
  const [jenis, setJenis] = useState(JENIS_SURAT[0]);
  const [nota, setNota] = useState("");
  const [surat, setSurat] = useState("");
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const nama = p.data?.persons?.preferred_name || p.data?.persons?.full_name || "";

  async function jana() {
    setBusy(true);
    setRalat(null);
    try {
      const r = await panggilAi<{ surat: string }>("pembantu-ai", { mode: "surat", employment_id: employmentId, jenis, nota });
      setSurat(r.surat);
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
    setBusy(false);
  }

  return (
    <Screen lebar="sederhana">
      <BackHeader title={tr("Draf surat{0}", nama ? ` · ${nama}` : "")} href={`/pengurusan/pekerja/${employmentId}`} />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-6">
        <label className="flex flex-col gap-1.5 text-[13px] font-bold text-[#4A5A57]">
          {tr("Jenis surat")}<select value={jenis} onChange={(e) => setJenis(e.target.value)} className="h-11 rounded-[12px] border border-line bg-surface px-3 text-sm font-semibold text-ink">
            {JENIS_SURAT.map((j) => (
              <option key={j}>{j}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-bold text-[#4A5A57]">
          {tr("Nota untuk AI (pilihan)")}<textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={3} placeholder={tr("Contoh: berkuat kuasa 1 Disember, gaji baharu RM3,200")} className="rounded-[12px] border border-line bg-surface p-3 text-sm text-ink" />
        </label>
        <button type="button" onClick={jana} disabled={busy} className="h-12 rounded-[14px] bg-ai text-sm font-extrabold text-white disabled:opacity-60">
          {busy ? tr("AI sedang menulis…") : surat ? tr("Jana semula") : tr("Jana draf")}
        </button>
        {ralat && <ErrorBox message={ralat} />}
        {surat && (
          <>
            <textarea value={surat} onChange={(e) => setSurat(e.target.value)} rows={18} aria-label={tr("Draf surat")} className="rounded-[12px] border border-line bg-surface p-4 font-mono text-[13px] leading-relaxed" />
            <span className="text-xs text-muted">{tr("Draf ini dijana oleh AI. Semak dan lengkapkan bahagian bertanda [ ] sebelum ditandatangani.")}</span>
            <button type="button" onClick={() => navigator.clipboard?.writeText(surat)} className="h-11 rounded-[12px] border border-primary text-sm font-bold text-primary">
              {tr("Salin teks")}</button>
          </>
        )}
      </main>
    </Screen>
  );
}
