"use client";

import { tr } from "@/lib/i18n";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { arkibPengumuman, getBelumBaca, getPengumuman, siarPengumuman, type Pengumuman } from "@/lib/urusan";
import { bilaDihantar } from "@/lib/format";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { PengepalaAkar, TabNav } from "@/components/TabNav";
import { ButangUtama, HadPeranan, Lembaran, MedanBorang, Suis, inputKecil } from "@/components/Senarai";
import { beritahu, sahkan } from "@/components/Dialog";

export default function PengumumanHrPage() {
  return (
    <HadPeranan roles={["hr", "ceo", "admin"]}>
      <Kandungan />
    </HadPeranan>
  );
}

function Kandungan() {
  const me = useMe();
  const emp = me.active!;
  const d = useData(() => getPengumuman(emp.companyId, true), [emp.companyId]);
  const [tajuk, setTajuk] = useState("");
  const [isi, setIsi] = useState("");
  const [wa, setWa] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const [lihat, setLihat] = useState<Pengumuman | null>(null);

  async function siar() {
    if (tajuk.trim().length < 3) return setRalat(tr("Sila isi tajuk."));
    if (isi.trim().length < 3) return setRalat(tr("Sila isi kandungan pengumuman."));
    if (wa && !(await sahkan({ tajuk: tr("Hantar kepada semua pekerja?"), mesej: tr("Pengumuman dipaparkan di skrin Utama dan dihantar sebagai notifikasi kepada setiap pekerja aktif."), ok: tr("Siarkan") }))) return;
    setBusy(true);
    setRalat(null);
    try {
      await siarPengumuman(emp.companyId, tajuk.trim(), isi.trim(), wa);
      beritahu(tr("Pengumuman disiarkan."));
      setTajuk("");
      setIsi("");
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
    setBusy(false);
  }

  return (
    <Screen lebar="lebar">
      <PengepalaAkar title={tr("Pengumuman")} />
      <main className="flex grow flex-col gap-4 px-4 pt-1 pb-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-start lg:gap-5 lg:px-0">
        <section className="flex flex-col gap-3 rounded-card bg-surface px-4 py-4 lg:px-5">
          <h2 className="m-0 text-xs font-bold tracking-[0.04em] text-[#4A5A57]">{tr("PENGUMUMAN BAHARU")}</h2>
          <MedanBorang label={tr("Tajuk")}>
            <input className={inputKecil} value={tajuk} maxLength={120} onChange={(e) => setTajuk(e.target.value)} placeholder={tr("Contoh: Cuti umum ganti pada Isnin")} />
          </MedanBorang>
          <MedanBorang label={tr("Kandungan")}>
            <textarea
              rows={6}
              maxLength={2000}
              value={isi}
              onChange={(e) => setIsi(e.target.value)}
              className="rounded-[12px] border border-[#D5DEDC] bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary"
            />
          </MedanBorang>
          <div className="flex items-center gap-3">
            <span className="flex grow flex-col gap-0.5">
              <b className="text-sm font-bold">{tr("Hantar melalui WhatsApp")}</b>
              <span className="text-xs text-muted">{tr("Jika dimatikan, pengumuman hanya dipaparkan dalam aplikasi.")}</span>
            </span>
            <Suis on={wa} onChange={setWa} label={tr("Hantar melalui WhatsApp")} />
          </div>
          {ralat && <ErrorBox message={ralat} />}
          <ButangUtama onClick={siar} busy={busy}>
            {tr("Siarkan")}</ButangUtama>
        </section>

        <section className="flex flex-col gap-2">
          {d.error && <ErrorBox message={d.error} />}
          {d.loading && !d.data && <Loading />}
          {d.data && d.data.length === 0 && <div className="rounded-card bg-surface px-4 py-8 text-center text-sm text-muted">{tr("Belum ada pengumuman.")}</div>}
          {(d.data ?? []).length > 0 && (
            <div className="flex flex-col rounded-card bg-surface px-4 lg:px-5 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              {(d.data ?? []).map((a) => {
                const peratus = a.audience ? Math.round(((a.read_count ?? 0) / a.audience) * 100) : 0;
                return (
                  <div key={a.id} className={`flex flex-col gap-1.5 py-3 text-sm ${a.archived ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <b className="font-extrabold">{a.title}</b>
                      <span className="shrink-0 text-xs text-muted">{bilaDihantar(a.created_at)}</span>
                    </div>
                    <p className="m-0 line-clamp-3 leading-snug whitespace-pre-line text-[#33433F]">{a.body}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="flex grow items-center gap-2 text-xs font-semibold text-subtle">
                        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[#E4EAE8]">
                          <span className="block h-full rounded-full bg-primary" style={{ width: `${peratus}%` }} />
                        </span>
                        {tr("Dibaca {0}/{1}{2}{3}", a.read_count ?? 0, a.audience ?? 0, a.sent_whatsapp ? tr(" · WhatsApp") : "", a.archived ? tr(" · diarkibkan") : "")}</span>
                      <button type="button" onClick={() => setLihat(a)} className="flex min-h-9 items-center text-xs font-bold text-primary">
                        {tr("Belum membaca")}</button>
                      {!a.archived && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await arkibPengumuman(a.id);
                              beritahu("Pengumuman diarkibkan.");
                              d.reload();
                            } catch (e) {
                              beritahu(e instanceof Error ? e.message : "Ralat", "ralat");
                            }
                          }}
                          className="flex min-h-9 items-center text-xs font-bold text-muted"
                        >
                          {tr("Arkibkan")}</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
      {lihat && <BelumBaca a={lihat} onClose={() => setLihat(null)} />}
      <TabNav />
    </Screen>
  );
}

function BelumBaca({ a, onClose }: { a: Pengumuman; onClose: () => void }) {
  const d = useData(() => getBelumBaca(a.id), [a.id]);
  return (
    <Lembaran title={tr("Belum membaca: {0}", a.title)} onClose={onClose}>
      {d.error && <ErrorBox message={d.error} />}
      {!d.data && !d.error && <Loading />}
      {d.data && d.data.length === 0 && <span className="text-sm text-success">{tr("Semua pekerja telah membaca.")}</span>}
      {d.data && d.data.length > 0 && (
        <ul className="m-0 flex max-h-[360px] list-none flex-col overflow-auto p-0 text-sm [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
          {d.data.map((x) => (
            <li key={x.employment_id} className="flex min-h-10 items-center justify-between gap-2">
              <span className="font-semibold">{x.name}</span>
              <span className="text-xs text-muted">{x.department ?? ""}</span>
            </li>
          ))}
        </ul>
      )}
    </Lembaran>
  );
}
