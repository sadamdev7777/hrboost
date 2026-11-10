"use client";

import { tr } from "@/lib/i18n";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { ButangUtama, HadPeranan, Seksyen, Suis } from "@/components/Senarai";
import { getOtDigunakan, setOtDigunakan } from "@/lib/urusan";
import { beritahu } from "@/components/Dialog";
import { NEGERI } from "@/lib/senarai";
import { MuatNaikLogo } from "@/components/Logo";
import { useMeContext } from "@/lib/me";


type Syarikat = {
  name: string;
  code: string;
  reg_no: string | null;
  address: string | null;
  state: string;
  weekend_days: number[];
  work_start: string;
  work_end: string;
  late_grace_minutes: number;
  epf_employer_no: string | null;
  socso_employer_no: string | null;
  lhdn_employer_no: string | null;
  hrdf_registered: boolean;
  logo_path: string | null;
};

const cls = "h-10 min-w-0 grow rounded-[10px] border border-[#D5DEDC] bg-surface px-2.5 text-sm font-semibold text-ink outline-none focus:border-primary disabled:bg-page";

// Rujukan reka bentuk: design/T_Syarikat.dc.html
export default function ProfilSyarikatPage() {
  return (
    <HadPeranan roles={["hr", "finance", "ceo", "admin"]} back="/pengurusan/tetapan">
      <ProfilSyarikat />
    </HadPeranan>
  );
}

function ProfilSyarikat() {
  const me = useMe();
  const cid = me.active!.companyId;
  const admin = me.roles.includes("admin");
  const { reload: muatSemula } = useMeContext();
  const d = useData(
    async () =>
      must(
        await getSupabase()
          .from("companies")
          .select("name, code, reg_no, address, state, weekend_days, work_start, work_end, late_grace_minutes, epf_employer_no, socso_employer_no, lhdn_employer_no, hrdf_registered, logo_path")
          .eq("id", cid)
          .single(),
      ) as Syarikat,
    [cid],
  );
  return (
    <Screen lebar="sederhana">
      <BackHeader title={tr("Profil syarikat")} href="/pengurusan/tetapan" />
      {d.error && <ErrorBox message={d.error} />}
      {d.loading && !d.data && <Loading />}
      {d.data && (
        <section className="flex flex-col gap-2 px-4 pt-2 pb-1">
          <Seksyen>{tr("LOGO SYARIKAT")}</Seksyen>
          <MuatNaikLogo
            companyId={cid}
            nama={d.data.name}
            path={d.data.logo_path}
            boleh={me.roles.includes("hr") || admin}
            onChange={() => {
              d.reload();
              muatSemula();
            }}
          />
        </section>
      )}
      {d.data && <Borang s={d.data} admin={admin} cid={cid} onSaved={d.reload} />}
      {d.data && <SuisLebihMasa cid={cid} boleh={me.roles.includes("hr") || admin} />}
    </Screen>
  );
}

function Borang({ s, admin, cid, onSaved }: { s: Syarikat; admin: boolean; cid: string; onSaved: () => void }) {
  const [f, setF] = useState({
    ...s,
    reg_no: s.reg_no ?? "",
    address: s.address ?? "",
    epf_employer_no: s.epf_employer_no ?? "",
    socso_employer_no: s.socso_employer_no ?? "",
    lhdn_employer_no: s.lhdn_employer_no ?? "",
    work_start: s.work_start.slice(0, 5),
    work_end: s.work_end.slice(0, 5),
  });
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const set = (k: keyof typeof f, v: unknown) => {
    setOk(false);
    setF({ ...f, [k]: v });
  };
  const hujung = f.weekend_days.includes(5) ? "5,6" : f.weekend_days.length === 1 ? "0" : "0,6";

  async function simpan() {
    setRalat(null);
    if (!f.name.trim()) return setRalat(tr("Sila isi nama syarikat."));
    if (f.work_end <= f.work_start) return setRalat(tr("Waktu keluar mesti selepas waktu masuk."));
    setBusy(true);
    try {
      must(
        await getSupabase()
          .from("companies")
          .update({
            name: f.name.trim(),
            reg_no: f.reg_no.trim() || null,
            address: f.address.trim() || null,
            state: f.state,
            weekend_days: f.weekend_days,
            work_start: f.work_start,
            work_end: f.work_end,
            late_grace_minutes: Number(f.late_grace_minutes) || 0,
            epf_employer_no: f.epf_employer_no.trim() || null,
            socso_employer_no: f.socso_employer_no.trim() || null,
            lhdn_employer_no: f.lhdn_employer_no.trim() || null,
            hrdf_registered: f.hrdf_registered,
          })
          .eq("id", cid),
      );
      setOk(true);
      onSaved();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
    setBusy(false);
  }

  return (
    <>
      <main className="flex grow flex-col gap-2.5 px-4 pt-1 pb-4">
        {!admin && <span className="rounded-[14px] bg-warning-soft px-4 py-3 text-[13px] text-warning">{tr("Hanya Pentadbir syarikat boleh mengubah maklumat ini.")}</span>}
        <Seksyen>{tr("SYARIKAT")}</Seksyen>
        <Kotak>
          <Baris label={tr("Nama")}>
            <input className={cls} disabled={!admin} value={f.name} onChange={(e) => set("name", e.target.value)} />
          </Baris>
          <Baris label={tr("Kod (untuk akses)")}>
            <span className="grow text-sm font-bold">{f.code}</span>
          </Baris>
          <Baris label={tr("No. SSM")}>
            <input className={cls} disabled={!admin} value={f.reg_no} onChange={(e) => set("reg_no", e.target.value)} />
          </Baris>
          <Baris label={tr("Alamat (kepala surat)")}>
            <input className={cls} disabled={!admin} value={f.address} onChange={(e) => set("address", e.target.value)} placeholder={tr("Alamat penuh syarikat")} />
          </Baris>
          <Baris label={tr("Negeri")}>
            <select className={cls} disabled={!admin} value={f.state} onChange={(e) => set("state", e.target.value)}>
              {NEGERI.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </Baris>
        </Kotak>

        <Seksyen className="pt-1" >
          <span id="waktu">{tr("WAKTU KERJA")}</span>
        </Seksyen>
        <Kotak>
          <Baris label={tr("Hujung minggu")}>
            <select className={cls} disabled={!admin} value={hujung} onChange={(e) => set("weekend_days", e.target.value.split(",").map(Number))}>
              <option value="0,6">{tr("Sabtu & Ahad")}</option>
              <option value="5,6">{tr("Jumaat & Sabtu")}</option>
              <option value="0">{tr("Ahad sahaja")}</option>
            </select>
          </Baris>
          <Baris label={tr("Masuk / keluar")}>
            <input type="time" className={cls} disabled={!admin} value={f.work_start} onChange={(e) => set("work_start", e.target.value)} aria-label={tr("Waktu masuk")} />
            <input type="time" className={cls} disabled={!admin} value={f.work_end} onChange={(e) => set("work_end", e.target.value)} aria-label={tr("Waktu keluar")} />
          </Baris>
          <Baris label={tr("Dikira lewat selepas")}>
            <input className={cls} disabled={!admin} inputMode="numeric" value={f.late_grace_minutes} onChange={(e) => set("late_grace_minutes", e.target.value.replace(/\D/g, ""))} />
            <span className="text-sm text-muted">minit</span>
          </Baris>
        </Kotak>

        <Seksyen className="pt-1">{tr("MAJIKAN BERKANUN")}</Seksyen>
        <Kotak>
          <Baris label={tr("No. majikan KWSP")}>
            <input className={cls} disabled={!admin} value={f.epf_employer_no} onChange={(e) => set("epf_employer_no", e.target.value)} />
          </Baris>
          <Baris label={tr("No. majikan PERKESO")}>
            <input className={cls} disabled={!admin} value={f.socso_employer_no} onChange={(e) => set("socso_employer_no", e.target.value)} />
          </Baris>
          <Baris label={tr("No. E (LHDN)")}>
            <input className={cls} disabled={!admin} value={f.lhdn_employer_no} onChange={(e) => set("lhdn_employer_no", e.target.value)} placeholder="E" />
          </Baris>
          <Baris label={tr("Berdaftar HRDF")}>
            <select className={cls} disabled={!admin} value={f.hrdf_registered ? "1" : "0"} onChange={(e) => set("hrdf_registered", e.target.value === "1")}>
              <option value="1">{tr("Ya")}</option>
              <option value="0">{tr("Tidak")}</option>
            </select>
          </Baris>
        </Kotak>
        {ralat && <ErrorBox message={ralat} />}
        {ok && <span className="text-sm font-semibold text-success">{tr("Profil syarikat disimpan.")}</span>}
      </main>
      {admin && (
        <div className="bar-bawah sticky bottom-0 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
          <ButangUtama onClick={simpan} busy={busy}>
            {tr("Simpan")}</ButangUtama>
        </div>
      )}
    </>
  );
}

function Kotak({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col rounded-card bg-surface px-4 py-0.5 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">{children}</div>;
}

function Baris({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-h-12 items-center gap-2.5 text-sm">
      <span className="w-[120px] shrink-0 text-muted lg:w-[170px]">{label}</span>
      {children}
    </label>
  );
}

/** Kerja lebih masa ialah pilihan: apabila dimatikan, pekerja tidak boleh memohon. */
function SuisLebihMasa({ cid, boleh }: { cid: string; boleh: boolean }) {
  const d = useData(() => getOtDigunakan(cid), [cid]);
  if (d.data === null || d.data === undefined) return null;
  return (
    <div className="mx-4 mb-6 flex items-center gap-3 rounded-card bg-surface px-4 py-3">
      <span className="flex grow flex-col gap-0.5">
        <b className="text-sm font-bold">{tr("Kerja lebih masa")}</b>
        <span className="text-xs leading-snug text-muted">
          {d.data
            ? tr("Pekerja boleh memohon bayaran kerja lebih masa (Akta Kerja: 1.5×, 2× hari rehat, 3× cuti umum); dibayar bersama gaji selepas diluluskan.")
            : tr("Tidak digunakan. Pilihan Kerja lebih masa tidak dipaparkan kepada pekerja.")}
        </span>
      </span>
      <Suis
        on={d.data}
        disabled={!boleh}
        label={tr("Kerja lebih masa")}
        onChange={async (v) => {
          try {
            await setOtDigunakan(cid, v);
            beritahu(v ? "Kerja lebih masa dihidupkan." : "Kerja lebih masa dimatikan.");
            d.reload();
          } catch (e) {
            beritahu(e instanceof Error ? e.message : "Ralat", "ralat");
          }
        }}
      />
    </div>
  );
}
