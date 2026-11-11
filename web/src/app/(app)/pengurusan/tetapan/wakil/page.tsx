"use client";

import { tr } from "@/lib/i18n";
import { sahkan } from "@/components/Dialog";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { addDays, julatTarikh, todayISO } from "@/lib/format";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { ButangUtama, HadPeranan, MedanBorang, Seksyen, Tag, inputKecil } from "@/components/Senarai";

const JENIS: Record<string, string> = { leave: tr("Cuti"), claim: "tuntutan", attendance_correction: tr("pembetulan masa"), payroll_run: "gaji", overtime: tr("kerja lebih masa"), salary_advance: tr("pendahuluan gaji"), profile_change: tr("kemas kini profil") };

function jenisTeks(t: string[] | null) {
  if (!t || t.length === 0) return tr("Semua jenis");
  const s = t.map((x) => JENIS[x] ?? x);
  return s.length > 1 ? `${s.slice(0, -1).join(", ")} & ${s[s.length - 1]}` : s[0];
}

// Rujukan reka bentuk: design/T_WakilKelulusan.dc.html
export default function WakilPage() {
  return (
    <HadPeranan roles={["hr", "admin"]} back="/pengurusan/tetapan">
      <Wakil />
    </HadPeranan>
  );
}

function Wakil() {
  const me = useMe();
  const cid = me.active!.companyId;
  const today = todayISO();
  const d = useData(async () => {
    const sb = getSupabase();
    const [del, ppl, lr] = await Promise.all([
      sb.from("approval_delegations").select("id, from_person_id, to_person_id, start_date, end_date, request_types").eq("company_id", cid).gte("end_date", today).order("start_date"),
      sb.rpc("my_colleagues", { p_company: cid }),
      sb.from("leave_requests").select("start_date, end_date, cover_person_id, employments!inner(person_id, company_id)").eq("employments.company_id", cid).gte("end_date", today),
    ]);
    return { del: must(del) ?? [], ppl: [{ person_id: me.personId, name: me.name, department_id: null, department: null }, ...(must(ppl) ?? [])], lr: must(lr) ?? [] };
  }, [cid, today]);
  const [f, setF] = useState({ dari: "", ke: "", mula: today, tamat: addDays(today, 4) });
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const ppl = d.data?.ppl ?? [];
  const nama = (id: string) => ppl.find((p) => p.person_id === id)?.name ?? tr("Pekerja");
  const dari = f.dari || ppl[0]?.person_id || "";
  const ke = f.ke || ppl.find((p) => p.person_id !== dari)?.person_id || "";

  async function simpan() {
    setRalat(null);
    if (dari === ke) return setRalat(tr("Pelulus dan wakil mesti berbeza."));
    if (f.tamat < f.mula) return setRalat(tr("Tarikh tamat mesti selepas tarikh mula."));
    setBusy(true);
    try {
      must(
        await getSupabase().from("approval_delegations").insert({ company_id: cid, from_person_id: dari, to_person_id: ke, start_date: f.mula, end_date: f.tamat, request_types: null }),
      );
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
    setBusy(false);
  }

  async function padam(id: string) {
    if (!(await sahkan({ tajuk: tr("Buang wakil ini?"), mesej: tr("Tugasan kelulusan akan kembali kepada pelulus asal."), ok: tr("Buang"), bahaya: true }))) return;
    try {
      must(await getSupabase().from("approval_delegations").delete().eq("id", id));
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
  }

  return (
    <Screen lebar="sederhana">
      <BackHeader title={tr("Wakil kelulusan")} href="/pengurusan/tetapan" />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-6">
        <div className="rounded-[14px] bg-[#E3F1EE] px-4 py-3 text-[13px] leading-normal text-primary">
          {tr("Apabila pelulus bercuti, tugasan kelulusan akan terus dihantar kepada wakil supaya tidak tertangguh.")}</div>
        <Seksyen>{tr("AKTIF & AKAN DATANG")}</Seksyen>
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data && <Loading />}
        {d.data?.del.length === 0 && <span className="text-sm text-muted">{tr("Tiada wakil aktif.")}</span>}
        {(d.data?.del ?? []).map((x) => {
          const aktif = x.start_date <= today;
          const auto = d.data!.lr.some((l) => l.employments?.person_id === x.from_person_id && l.cover_person_id === x.to_person_id && l.start_date === x.start_date && l.end_date === x.end_date);
          return (
            <div key={x.id} className="flex flex-col gap-1 rounded-card bg-surface px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <b className="text-sm font-bold">
                  {nama(x.from_person_id)} → {nama(x.to_person_id)}
                </b>
                <Tag tone={aktif ? "success" : "warning"}>{aktif ? tr("Aktif") : tr("Akan datang")}</Tag>
              </div>
              <span className="text-[13px] text-[#4A5A57]">
                {julatTarikh(x.start_date, x.end_date)} · {jenisTeks(x.request_types)}
              </span>
              {auto && <span className="text-xs text-muted">{tr("Dicipta secara automatik apabila {0} memohon cuti", nama(x.from_person_id))}</span>}
              <button type="button" onClick={() => padam(x.id)} className="self-start py-2 text-[13px] font-bold text-danger">
                {tr("Buang")}</button>
            </div>
          );
        })}

        <Seksyen className="pt-1">{tr("TAMBAH WAKIL")}</Seksyen>
        <div className="flex flex-col gap-2.5 rounded-card bg-surface px-4 py-3">
          <div className="grid grid-cols-2 gap-2.5">
            <MedanBorang label={tr("Pelulus")}>
              <select className={inputKecil} value={dari} onChange={(e) => setF({ ...f, dari: e.target.value })}>
                {ppl.map((p) => (
                  <option key={p.person_id} value={p.person_id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </MedanBorang>
            <MedanBorang label={tr("Wakil")}>
              <select className={inputKecil} value={ke} onChange={(e) => setF({ ...f, ke: e.target.value })}>
                {ppl
                  .filter((p) => p.person_id !== dari)
                  .map((p) => (
                    <option key={p.person_id} value={p.person_id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </MedanBorang>
            <MedanBorang label={tr("Dari")}>
              <input type="date" className={inputKecil} value={f.mula} onChange={(e) => setF({ ...f, mula: e.target.value })} />
            </MedanBorang>
            <MedanBorang label={tr("Hingga")}>
              <input type="date" className={inputKecil} value={f.tamat} onChange={(e) => setF({ ...f, tamat: e.target.value })} />
            </MedanBorang>
          </div>
          {ralat && <ErrorBox message={ralat} />}
          <ButangUtama onClick={simpan} busy={busy}>
            {tr("Simpan wakil")}</ButangUtama>
        </div>
      </main>
    </Screen>
  );
}
