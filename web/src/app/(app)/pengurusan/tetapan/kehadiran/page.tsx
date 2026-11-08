"use client";

import { useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { getSenaraiPekerja } from "@/lib/hr";
import { masa, tarikh } from "@/lib/format";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { ButangUtama, HadPeranan, Lembaran, MedanBorang, Seksyen, Tag, inputKecil } from "@/components/Senarai";

type Status = {
  configured: boolean;
  api_url: string;
  sync_minutes: number;
  active: boolean;
  token_valid: boolean;
  last_synced_at: string | null;
  last_error: string | null;
  next_run_at: string | null;
  employees: number;
  matched: number;
  unmatched: { workno: string; punches: number; last: string }[];
  log: { ok: boolean; message: string; records: number; at: string }[];
};

// Rujukan reka bentuk: design/IntegrasiKehadiran.dc.html
export default function IntegrasiKehadiranPage() {
  return (
    <HadPeranan roles={["hr", "admin"]} back="/pengurusan/tetapan">
      <Integrasi />
    </HadPeranan>
  );
}

function Integrasi() {
  const me = useMe();
  const cid = me.active!.companyId;
  const d = useData(async () => {
    const [s, ppl] = await Promise.all([getSupabase().rpc("attendance_integration_status", { p_company: cid }), getSenaraiPekerja(cid)]);
    return { s: must(s) as unknown as Status, ppl };
  }, [cid]);
  const [kunci, setKunci] = useState(false);
  const [padan, setPadan] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "test" | "pull">(null);
  const [mesej, setMesej] = useState<{ ok: boolean; text: string } | null>(null);
  const s = d.data?.s;

  async function panggil(mode: "test" | "pull") {
    setBusy(mode);
    setMesej(null);
    try {
      const { data, error } = await getSupabase().functions.invoke("crosschex-sync", { body: { company_id: cid, mode } });
      if (error) throw new Error("Fungsi penyegerakan belum dipasang atau tidak dapat dihubungi.");
      setMesej({ ok: !!data?.ok, text: data?.message ?? "Selesai" });
      d.reload();
    } catch (e) {
      setMesej({ ok: false, text: e instanceof Error ? e.message : "Ralat" });
    }
    setBusy(null);
  }

  async function kekerapan(min: number) {
    if (!s?.configured) return;
    try {
      must(await getSupabase().rpc("set_attendance_integration", { p_company: cid, p_api_url: s.api_url, p_key: "", p_secret: "", p_minutes: min }));
      d.reload();
    } catch (e) {
      setMesej({ ok: false, text: e instanceof Error ? e.message : "Ralat" });
    }
  }

  const bersambung = s?.configured && !s.last_error && !!s.last_synced_at;

  return (
    <Screen>
      <BackHeader title="Integrasi Kehadiran" href="/pengurusan/tetapan" />
      <main className="flex grow flex-col gap-2.5 px-5 pt-1 pb-4">
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data && <Loading />}
        {s && (
          <>
            <div className="flex flex-col gap-2 rounded-card bg-surface px-4 py-3.5">
              <div className="flex items-center gap-3">
                <span className="flex grow flex-col gap-0.5">
                  <b className="text-[15px] font-extrabold">CrossChex Cloud</b>
                  <span className="text-xs text-muted">Anviz · pelayan {/\.eu\./.test(s.api_url) ? "EU" : "global"}</span>
                </span>
                <Tag tone={bersambung ? "success" : s.last_error ? "danger" : "neutral"}>{bersambung ? "Bersambung" : s.last_error ? "Ralat" : s.configured ? "Belum ditarik" : "Belum disambung"}</Tag>
              </div>
              {s.last_synced_at && (
                <span className="text-xs text-[#4A5A57]">
                  Tarikan terakhir {masa(s.last_synced_at)}
                  {s.log[0]?.ok ? ` · ${s.log[0].message.toLowerCase()}` : ""}
                  {s.next_run_at ? ` · seterusnya ${masa(s.next_run_at)}` : ""}
                </span>
              )}
              {s.last_error && <span className="text-xs font-semibold text-danger">{s.last_error}</span>}
            </div>

            <Seksyen className="pt-1">SAMBUNGAN</Seksyen>
            <div className="flex flex-col rounded-card bg-surface px-4 text-sm [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              <Baris label="URL API">{s.api_url.replace(/^https:\/\//, "")}</Baris>
              <Baris label="Kunci API">{s.configured ? "••••••••" : "Belum diisi"}</Baris>
              <div className="flex min-h-[48px] items-center gap-2">
                <span className="grow text-muted">Rahsia API</span>
                <b>{s.configured ? "••••••••" : "Belum diisi"}</b>
                <button type="button" onClick={() => setKunci(true)} className="min-h-11 pl-2 text-[13px] font-bold text-primary">
                  {s.configured ? "Tukar" : "Isi"}
                </button>
              </div>
              <Baris label="Token">{s.token_valid ? "Diperbaharui secara automatik" : "Akan diminta semasa tarikan"}</Baris>
            </div>

            <Seksyen className="pt-1">TARIK DATA</Seksyen>
            <div className="flex flex-col rounded-card bg-surface px-4 text-sm [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              <div className="flex min-h-[52px] items-center gap-2">
                <span className="grow text-muted">Kekerapan</span>
                {[5, 15, 30].map((m) => (
                  <button
                    key={m}
                    type="button"
                    disabled={!s.configured}
                    onClick={() => kekerapan(m)}
                    className={`h-8 rounded-full px-2.5 text-xs font-bold disabled:opacity-50 ${s.sync_minutes === m ? "bg-primary text-white" : "border border-[#D5DEDC]"}`}
                  >
                    {m} min
                  </button>
                ))}
              </div>
              <Baris label="Masuk / keluar">Imbasan pertama / terakhir</Baris>
            </div>

            <Seksyen className="pt-1">PADANAN PEKERJA</Seksyen>
            <div className="flex flex-col rounded-card bg-surface px-4 text-sm [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              <Baris label="Dipadankan">
                {s.matched} / {s.employees}
              </Baris>
              {s.unmatched.map((u) => (
                <div key={u.workno} className="flex min-h-[52px] items-center gap-2">
                  <span className="flex grow flex-col">
                    <b>ID mesin {u.workno}</b>
                    <span className="text-xs text-muted">
                      belum dipadankan · {u.punches} imbasan, terakhir {tarikh(u.last)}
                    </span>
                  </span>
                  <button type="button" onClick={() => setPadan(u.workno)} className="min-h-11 text-[13px] font-bold text-primary">
                    Pilih pekerja
                  </button>
                </div>
              ))}
            </div>

            {s.log.length > 0 && (
              <>
                <Seksyen className="pt-1">LOG TERKINI</Seksyen>
                <div className="flex flex-col rounded-card bg-surface px-4 text-sm [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
                  {s.log.map((l, i) => (
                    <div key={i} className="flex min-h-[44px] items-center gap-3">
                      <span className="w-[64px] shrink-0 text-xs text-muted">{masa(l.at)}</span>
                      <span className={l.ok ? "" : "text-danger"}>{l.message}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {mesej && <span className={`rounded-[12px] px-3 py-2 text-[13px] font-semibold ${mesej.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>{mesej.text}</span>}
          </>
        )}
      </main>
      {s?.configured && (
        <div className="sticky bottom-0 grid grid-cols-2 gap-2.5 border-t border-line-soft bg-surface px-5 pt-3 pb-7">
          <button type="button" disabled={!!busy} onClick={() => panggil("test")} className="h-[52px] rounded-button border-2 border-primary text-[15px] font-extrabold text-primary disabled:opacity-60">
            {busy === "test" ? "Menguji…" : "Uji sambungan"}
          </button>
          <button type="button" disabled={!!busy} onClick={() => panggil("pull")} className="h-[52px] rounded-button bg-primary text-[15px] font-extrabold text-white disabled:opacity-60">
            {busy === "pull" ? "Menarik…" : "Tarik sekarang"}
          </button>
        </div>
      )}
      {kunci && s && (
        <Kunci
          cid={cid}
          s={s}
          onClose={() => setKunci(false)}
          onDone={() => {
            setKunci(false);
            d.reload();
          }}
        />
      )}
      {padan && d.data && (
        <Padan
          workno={padan}
          ppl={d.data.ppl.map((p) => ({ id: p.id, name: `${p.name} · ${p.employeeNo}` }))}
          onClose={() => setPadan(null)}
          onDone={() => {
            setPadan(null);
            d.reload();
          }}
        />
      )}
    </Screen>
  );
}

function Baris({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[48px] items-center justify-between gap-2">
      <span className="text-muted">{label}</span>
      <b className="text-right">{children}</b>
    </div>
  );
}

function Kunci({ cid, s, onClose, onDone }: { cid: string; s: Status; onClose: () => void; onDone: () => void }) {
  const [url, setUrl] = useState(s.api_url);
  const [key, setKey] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  async function simpan() {
    setRalat(null);
    if (!s.configured && (!key.trim() || !secret.trim())) return setRalat("Sila isi kunci dan rahsia API.");
    setBusy(true);
    try {
      must(await getSupabase().rpc("set_attendance_integration", { p_company: cid, p_api_url: url.trim(), p_key: key.trim(), p_secret: secret.trim(), p_minutes: s.sync_minutes }));
      onDone();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
      setBusy(false);
    }
  }
  return (
    <Lembaran title={s.configured ? "Tukar kunci CrossChex" : "Sambung CrossChex Cloud"} onClose={onClose}>
      <MedanBorang label="URL API">
        <input className={inputKecil} value={url} onChange={(e) => setUrl(e.target.value)} />
      </MedanBorang>
      <MedanBorang label="Kunci API" nota={s.configured ? "Kosong = kekalkan kunci semasa" : undefined}>
        <input className={inputKecil} value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" />
      </MedanBorang>
      <MedanBorang label="Rahsia API" nota={s.configured ? "Kosong = kekalkan rahsia semasa" : undefined}>
        <input className={inputKecil} type="password" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="new-password" />
      </MedanBorang>
      <span className="text-xs leading-normal text-muted">Kunci disimpan dalam peti rahsia (Vault) dan tidak akan dipaparkan semula. Hanya boleh ditukar.</span>
      {ralat && <ErrorBox message={ralat} />}
      <ButangUtama onClick={simpan} busy={busy}>
        Simpan
      </ButangUtama>
    </Lembaran>
  );
}

function Padan({ workno, ppl, onClose, onDone }: { workno: string; ppl: { id: string; name: string }[]; onClose: () => void; onDone: () => void }) {
  const [emp, setEmp] = useState(ppl[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  async function simpan() {
    setBusy(true);
    try {
      must(await getSupabase().rpc("match_attendance_workno", { p_employment: emp, p_workno: workno }));
      onDone();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
      setBusy(false);
    }
  }
  return (
    <Lembaran title={`Padankan ID mesin ${workno}`} onClose={onClose}>
      <MedanBorang label="Pekerja">
        <select className={inputKecil} value={emp} onChange={(e) => setEmp(e.target.value)}>
          {ppl.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </MedanBorang>
      <span className="text-xs text-muted">Imbasan lama bagi ID ini akan dibina semula sebagai rekod kehadiran pekerja tersebut.</span>
      {ralat && <ErrorBox message={ralat} />}
      <ButangUtama onClick={simpan} busy={busy}>
        Padankan
      </ButangUtama>
    </Lembaran>
  );
}
