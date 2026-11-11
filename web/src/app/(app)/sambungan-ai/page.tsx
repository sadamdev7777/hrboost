"use client";

import { tr, trRalat } from "@/lib/i18n";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { tarikh, tarikhTempatan } from "@/lib/format";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { ButangUtama, Seksyen, inputKecil } from "@/components/Senarai";
import { beritahu, sahkan } from "@/components/Dialog";

type Sambungan = { id: string; name: string; token_hint: string; created_at: string; expires_at: string; last_used_at: string | null; calls_30d: number };

const ALAT = () => [
  [tr("Semua pengguna"), tr("Profil saya, baki cuti, mohon cuti, status permohonan, slip gaji saya, siapa bercuti, dan lulus / tolak permohonan yang menunggu anda.")],
  [tr("HR, Kewangan, CEO & Pentadbir"), tr("Cari pekerja, ringkasan HR hari ini dan ringkasan gaji syarikat (jumlah sahaja).")],
];

/** Sambungan AI (MCP): pengguna menyambungkan Claude kepada HRBoost dengan token peribadi. */
export default function SambunganAiPage() {
  const me = useMe();
  const cid = me.active!.companyId;
  const d = useData(async () => (must(await getSupabase().rpc("mcp_token_list", { p_company: cid })) ?? []) as Sambungan[], [cid]);
  const [nama, setNama] = useState("Claude");
  const [baru, setBaru] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const asal = typeof window === "undefined" ? "" : window.location.origin;

  async function cipta() {
    setBusy(true);
    setRalat(null);
    try {
      const r = must(await getSupabase().rpc("mcp_token_create", { p_company: cid, p_name: nama })) as unknown as { token: string };
      setBaru(r.token);
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? trRalat(e.message) : tr("Ralat"));
    }
    setBusy(false);
  }

  async function batal(s: Sambungan) {
    if (!(await sahkan({ tajuk: tr("Batalkan sambungan {0}?", s.name), mesej: tr("AI yang menggunakan sambungan ini tidak lagi boleh mengakses HRBoost."), ok: tr("Batalkan"), bahaya: true }))) return;
    try {
      must(await getSupabase().rpc("mcp_token_revoke", { p_id: s.id }));
      beritahu(tr("Sambungan dibatalkan."));
      d.reload();
    } catch (e) {
      beritahu(e instanceof Error ? trRalat(e.message) : tr("Ralat"), "ralat");
    }
  }

  const salin = async (teks: string) => {
    try {
      await navigator.clipboard.writeText(teks);
      beritahu(tr("Disalin."));
    } catch {
      beritahu(tr("Tidak dapat menyalin. Pilih teks dan salin secara manual."), "ralat");
    }
  };

  return (
    <Screen lebar="lebar">
      <BackHeader title={tr("Sambungan AI (MCP)")} href="/saya" />
      <main className="flex grow flex-col gap-4 px-4 pt-1 pb-8 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="flex flex-col gap-3">
          <span className="text-sm leading-relaxed text-subtle">
            {tr("Sambungkan Claude (Claude.ai, Claude Desktop atau Claude Code) kepada HRBoost. Anda boleh bertanya atau memberi arahan dalam bahasa biasa, contohnya “Berapa baki cuti saya?” atau “Senaraikan permohonan yang menunggu kelulusan saya”.")}
          </span>
          <Seksyen>{tr("APA YANG BOLEH DILAKUKAN")}</Seksyen>
          <div className="flex flex-col gap-2 rounded-card bg-surface px-4 py-3 text-sm">
            {ALAT().map(([t, s]) => (
              <span key={t} className="flex flex-col gap-0.5">
                <b>{t}</b>
                <span className="text-[13px] leading-snug text-muted">{s}</span>
              </span>
            ))}
          </div>
          <div className="rounded-card bg-[#F3F0FC] px-4 py-3 text-[13px] leading-relaxed text-ai">
            <b>{tr("Keselamatan & privasi")}</b>
            <ul className="m-0 mt-1 flex list-disc flex-col gap-0.5 pl-5">
              <li>{tr("AI bertindak sebagai anda: ia hanya boleh melakukan apa yang anda boleh lakukan dalam aplikasi.")}</li>
              <li>{tr("No. kad pengenalan, akaun bank dan gaji individu pekerja lain tidak dikongsi dengan AI.")}</li>
              <li>{tr("Tiada kelulusan automatik: AI perlu pengesahan anda sebelum meluluskan atau memohon.")}</li>
              <li>{tr("Maklumat yang anda minta dihantar kepada penyedia AI anda. Jangan kongsi token dengan sesiapa; batalkan jika hilang.")}</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Seksyen>{tr("SAMBUNGAN BAHARU")}</Seksyen>
          {!baru ? (
            <div className="flex flex-col gap-3 rounded-card bg-surface px-4 py-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-bold text-[#4A5A57]">{tr("Nama sambungan")}</span>
                <input className={inputKecil} value={nama} maxLength={60} onChange={(e) => setNama(e.target.value)} placeholder={tr("Contoh: Claude di komputer pejabat")} />
              </label>
              {ralat && <ErrorBox message={ralat} />}
              <ButangUtama onClick={cipta} busy={busy} disabled={!nama.trim()}>
                {tr("Cipta sambungan")}
              </ButangUtama>
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-card border-2 border-primary bg-surface px-4 py-4 text-sm">
              <b className="text-primary">{tr("Sambungan dicipta. Salin sekarang: token ini dipaparkan sekali sahaja.")}</b>
              <Langkah
                no="1"
                tajuk={tr("Claude.ai atau Claude Desktop")}
                arahan={tr("Buka Tetapan → Penyambung (Connectors) → Tambah penyambung tersuai. Namakan “HRBoost” dan tampal URL ini:")}
                teks={`${asal}/api/mcp/${baru}`}
                salin={salin}
              />
              <Langkah
                no="2"
                tajuk={tr("Claude Code (terminal)")}
                arahan={tr("Jalankan arahan ini:")}
                teks={`claude mcp add --transport http hrboost ${asal}/api/mcp --header "Authorization: Bearer ${baru}"`}
                salin={salin}
              />
              <button type="button" onClick={() => setBaru(null)} className="self-start py-1 text-sm font-bold text-primary">
                {tr("Selesai")}
              </button>
            </div>
          )}

          <Seksyen className="pt-1">{tr("SAMBUNGAN AKTIF")}</Seksyen>
          {d.error && <ErrorBox message={d.error} />}
          {d.loading && !d.data && <Loading />}
          {d.data && d.data.length === 0 && <span className="text-sm text-muted">{tr("Belum ada sambungan.")}</span>}
          {(d.data ?? []).length > 0 && (
            <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              {(d.data ?? []).map((s) => (
                <div key={s.id} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                  <span className="flex min-w-0 grow basis-52 flex-col gap-0.5">
                    <b>
                      {s.name} <span className="font-normal text-muted">••••{s.token_hint}</span>
                    </b>
                    <span className="text-xs text-muted">
                      {tr("Dicipta {0}", tarikh(tarikhTempatan(s.created_at)))} ·{" "}
                      {s.last_used_at ? tr("Terakhir digunakan {0}", tarikh(tarikhTempatan(s.last_used_at))) : tr("Belum digunakan")} · {tr("{0} panggilan (30 hari)", s.calls_30d)}
                    </span>
                  </span>
                  <button type="button" onClick={() => batal(s)} className="flex h-10 items-center rounded-full border border-line px-3.5 text-[13px] font-bold text-danger">
                    {tr("Batalkan")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </Screen>
  );
}

function Langkah({ no, tajuk, arahan, teks, salin }: { no: string; tajuk: string; arahan: string; teks: string; salin: (t: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <b className="flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-full bg-[#E3F1EE] text-xs text-primary">{no}</span>
        {tajuk}
      </b>
      <span className="text-[13px] text-muted">{arahan}</span>
      <div className="flex items-stretch gap-2">
        <code className="min-w-0 grow overflow-x-auto rounded-[10px] bg-[#F1F4F3] px-3 py-2 text-xs break-all whitespace-pre-wrap">{teks}</code>
        <button type="button" onClick={() => salin(teks)} className="shrink-0 rounded-[10px] border border-primary px-3 text-[13px] font-bold text-primary">
          {tr("Salin")}
        </button>
      </div>
    </div>
  );
}
