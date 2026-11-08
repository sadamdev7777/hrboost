"use client";

import { useRef, useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { tarikh } from "@/lib/format";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { ButangUtama, HadPeranan, Lembaran, MedanBorang, Seksyen, Suis, Tag, inputKecil } from "@/components/Senarai";

// Rujukan reka bentuk: design/T_PengetahuanAI.dc.html
export default function PengetahuanAiPage() {
  return (
    <HadPeranan roles={["hr", "admin"]} back="/pengurusan/tetapan">
      <Pengetahuan />
    </HadPeranan>
  );
}

function Pengetahuan() {
  const me = useMe();
  const cid = me.active!.companyId;
  const d = useData(async () => {
    const sb = getSupabase();
    const [docs, soalan] = await Promise.all([sb.rpc("kb_documents", { p_company: cid }), sb.rpc("kb_unanswered", { p_company: cid })]);
    return { docs: must(docs) ?? [], soalan: must(soalan) ?? [] };
  }, [cid]);
  const [baru, setBaru] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);

  async function togol(id: string, on: boolean) {
    setRalat(null);
    try {
      must(await getSupabase().from("ai_knowledge_docs").update({ active: on }).eq("id", id));
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
    }
  }

  return (
    <Screen lebar="sederhana">
      <BackHeader title="Pengetahuan AI" href="/pengurusan/tetapan" />
      <main className="flex grow flex-col gap-2.5 px-4 pt-1 pb-6">
        <div className="rounded-[14px] bg-[#F3F0FC] px-4 py-3 text-[13px] leading-normal text-[#4A3B8C]">
          Pembantu AI menjawab soalan pekerja berdasarkan dokumen di sini sahaja. Ia tidak meneka polisi.
        </div>
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data && <Loading />}
        <Seksyen>DOKUMEN</Seksyen>
        <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
          {(d.data?.docs ?? []).map((x) => (
            <div key={x.id} className="flex min-h-12 items-center gap-2 py-2">
              <span className="flex grow flex-col gap-0.5">
                <b className="text-sm font-bold">{x.title}</b>
                <span className="text-xs text-muted">
                  {x.global ? "Platform HRBoost" : `${x.chunks} bahagian · dikemas kini ${tarikh(x.updated_at)}`}
                </span>
              </span>
              {x.global ? <Tag tone="neutral">Platform</Tag> : <Suis on={x.active} label={`${x.active ? "Nyahaktifkan" : "Aktifkan"} ${x.title}`} onChange={(v) => togol(x.id, v)} />}
            </div>
          ))}
          <div className="flex min-h-12 items-center gap-2 py-2">
            <span className="flex grow flex-col gap-0.5">
              <b className="text-sm font-bold">Tetapan sistem</b>
              <span className="text-xs text-muted">Jenis cuti, tuntutan, waktu kerja — automatik</span>
            </span>
            <Tag tone="primary">Automatik</Tag>
          </div>
        </div>
        <button type="button" onClick={() => setBaru(true)} className="h-12 rounded-[14px] border-2 border-dashed border-[#C9D3D1] text-sm font-bold text-primary">
          + Muat naik dokumen
        </button>
        {ralat && <ErrorBox message={ralat} />}

        <Seksyen className="pt-2">SOALAN PEKERJA YANG TIDAK DAPAT DIJAWAB OLEH AI</Seksyen>
        <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
          {(d.data?.soalan ?? []).length === 0 && <span className="py-3 text-sm text-muted">Tiada soalan tertunggak.</span>}
          {(d.data?.soalan ?? []).map((q) => (
            <div key={q.id} className="flex min-h-12 items-center gap-2 py-2">
              <span className="flex grow flex-col gap-0.5">
                <b className="text-sm font-semibold">“{q.question}”</b>
                <span className="text-xs text-muted">
                  {q.name ?? "Pekerja"} · {tarikh(q.created_at)}
                </span>
              </span>
              <button
                type="button"
                onClick={async () => {
                  await getSupabase().rpc("kb_resolve_unanswered", { p_id: q.id });
                  d.reload();
                }}
                className="min-h-11 text-[13px] font-bold text-primary"
              >
                Selesai
              </button>
            </div>
          ))}
        </div>
        <span className="text-xs text-muted">Tambah jawapan dalam buku panduan supaya AI dapat menjawabnya pada masa hadapan.</span>
      </main>
      {baru && (
        <DokumenBaru
          cid={cid}
          onClose={() => setBaru(false)}
          onDone={() => {
            setBaru(false);
            d.reload();
          }}
        />
      )}
    </Screen>
  );
}

function DokumenBaru({ cid, onClose, onDone }: { cid: string; onClose: () => void; onDone: () => void }) {
  const [tajuk, setTajuk] = useState("");
  const [isi, setIsi] = useState("");
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const fail = useRef<HTMLInputElement>(null);

  async function baca(f: File | undefined) {
    if (!f) return;
    if (!/\.(txt|md)$/i.test(f.name) && !f.type.startsWith("text/")) return setRalat("Sokongan fail: .txt atau .md. Untuk PDF/Word, salin teks dan tampal di bawah.");
    setIsi(await f.text());
    if (!tajuk) setTajuk(f.name.replace(/\.(txt|md)$/i, ""));
  }

  async function simpan() {
    setBusy(true);
    setRalat(null);
    try {
      must(await getSupabase().rpc("kb_save_document", { p_company: cid, p_title: tajuk, p_text: isi }));
      onDone();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
      setBusy(false);
    }
  }

  return (
    <Lembaran title="Dokumen baharu" onClose={onClose}>
      <MedanBorang label="Tajuk">
        <input className={inputKecil} value={tajuk} onChange={(e) => setTajuk(e.target.value)} placeholder="Contoh: Buku panduan pekerja" />
      </MedanBorang>
      <button type="button" onClick={() => fail.current?.click()} className="h-11 rounded-[12px] border border-line text-sm font-bold">
        Pilih fail teks (.txt / .md)
      </button>
      <input ref={fail} type="file" accept=".txt,.md,text/plain,text/markdown" className="hidden" aria-label="Pilih fail dokumen" onChange={(e) => baca(e.target.files?.[0])} />
      <MedanBorang label="Kandungan" nota="Atau tampal teks daripada PDF / Word. Pisahkan bahagian dengan baris kosong.">
        <textarea className={`${inputKecil} h-48 py-2.5 text-sm font-normal`} value={isi} onChange={(e) => setIsi(e.target.value)} />
      </MedanBorang>
      {ralat && <ErrorBox message={ralat} />}
      <ButangUtama onClick={simpan} busy={busy} disabled={!tajuk.trim() || isi.trim().length < 20}>
        Simpan dokumen
      </ButangUtama>
    </Lembaran>
  );
}
