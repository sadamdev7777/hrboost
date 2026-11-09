"use client";

import { tr } from "@/lib/i18n";
import { mintaTeks, sahkan } from "@/components/Dialog";
import { useState } from "react";
import { useData } from "@/lib/useData";
import { rpc, tarikhPendek } from "@/lib/admin";
import { ErrorBox, Loading } from "@/components/ui";

type Grant = {
  id: string;
  who: string;
  who_from: string | null;
  role: string;
  target: string;
  target_admins: string | null;
  days: number;
  reason: string;
  status: string;
  decided_at: string | null;
  expires_at: string | null;
};
const PERANAN: Record<string, string> = { hr: "HR", ceo: tr("paparan CEO"), admin: tr("Pentadbir"), finance: tr("Kewangan"), staff: tr("lihat sahaja") };

// Rujukan reka bentuk: design/SA_Akses.dc.html
export default function SaAkses() {
  const d = useData(() => rpc<Grant[]>("sa_access_grants"), []);
  const [ralat, setRalat] = useState<string | null>(null);
  const pending = (d.data ?? []).filter((g) => g.status === "pending");
  const aktif = (d.data ?? []).filter((g) => g.status === "approved");

  async function putus(id: string, lulus: boolean) {
    const nota = lulus ? null : await mintaTeks({ tajuk: tr("Tolak permohonan akses"), label: tr("Sebab (dimaklumkan kepada pemohon)"), ok: tr("Tolak"), bahaya: true });
    if (!lulus && nota === null) return;
    if (!lulus && !nota?.trim()) return;
    setRalat(null);
    try {
      await rpc("decide_company_access", { p_grant: id, p_approve: lulus, p_note: nota });
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
  }
  async function tarik(id: string) {
    if (!(await sahkan({ tajuk: tr("Tarik balik akses ini?"), ok: tr("Tarik balik"), bahaya: true }))) return;
    try {
      await rpc("revoke_company_access", { p_grant: id });
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
  }

  return (
    <>
      <h1 className="m-0 text-2xl font-extrabold">{tr("Permohonan akses syarikat")}</h1>
      <span className="max-w-[720px] text-sm text-muted">
        {tr("Sesiapa yang ingin melihat atau mengurus syarikat selain tempat dia bekerja memerlukan kelulusan anda. Akses tamat secara automatik mengikut tempoh.")}</span>
      {ralat && <ErrorBox message={ralat} />}
      {d.error && <ErrorBox message={d.error} />}
      {!d.data && !d.error && <Loading />}
      <span className="text-xs font-bold tracking-[0.04em] text-[#4A5A57]">{tr("MENUNGGU KELULUSAN")}</span>
      {d.data && pending.length === 0 && <span className="text-sm text-muted">{tr("Tiada permohonan menunggu.")}</span>}
      <div className="grid gap-4 lg:grid-cols-2">
        {pending.map((g) => (
          <section key={g.id} className="flex flex-col gap-2.5 rounded-card bg-surface p-5 text-sm">
            <div className="flex items-start justify-between gap-2">
              <b className="text-base font-extrabold">
                {tr("{0} memohon akses {1} ke {2}", g.who, PERANAN[g.role] ?? g.role, g.target)}</b>
              <span className="rounded-lg bg-warning-soft px-2 py-0.5 text-xs font-bold text-warning">{tr("Menunggu")}</span>
            </div>
            <Row k={tr("Pemohon")} v={`${g.who} · ${g.who_from ?? "-"}`} />
            <Row k={tr("Akses diminta")} v={tr("{0} di {1}", PERANAN[g.role] ?? g.role, g.target)} />
            <Row k={tr("Tempoh")} v={tr("{0} hari", g.days)} />
            <Row k={tr("Pentadbir {0}", g.target)} v={tr("{0} (dimaklumkan)", g.target_admins ?? "-")} />
            <p className="m-0 rounded-[10px] bg-page p-3">
              <b>{tr("Sebab:")}</b> {g.reason}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => putus(g.id, false)} className="h-11 grow rounded-[12px] border border-danger font-bold text-danger">
                {tr("Tolak")}</button>
              <button type="button" onClick={() => putus(g.id, true)} className="h-11 grow rounded-[12px] bg-primary font-bold text-white">
                {tr("Lulus {0} hari", g.days)}</button>
            </div>
          </section>
        ))}
      </div>
      <span className="pt-2 text-xs font-bold tracking-[0.04em] text-[#4A5A57]">{tr("AKSES AKTIF")}</span>
      <div className="overflow-x-auto rounded-card bg-surface p-4">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-2 font-bold">{tr("PENGGUNA")}</th>
              <th className="py-2 font-bold">{tr("AKSES")}</th>
              <th className="py-2 font-bold">{tr("DILULUSKAN")}</th>
              <th className="py-2 font-bold">{tr("TAMAT")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {aktif.length === 0 && (
              <tr>
                <td colSpan={5} className="py-3 text-muted">
                  {tr("Tiada akses aktif.")}</td>
              </tr>
            )}
            {aktif.map((g) => (
              <tr key={g.id} className="border-t border-[#EEF2F1]">
                <td className="py-2.5">
                  <b>{g.who}</b> <span className="text-muted">· {g.who_from}</span>
                </td>
                <td className="py-2.5">
                  {tr("{0} di {1}", PERANAN[g.role] ?? g.role, g.target)}</td>
                <td className="py-2.5">{tarikhPendek(g.decided_at)}</td>
                <td className="py-2.5">{g.expires_at ? tarikhPendek(g.expires_at) : tr("Tiada had")}</td>
                <td className="py-2.5 text-right">
                  <button type="button" onClick={() => tarik(g.id)} className="font-bold text-danger">
                    {tr("Tarik balik")}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{k}</span>
      <b className="text-right">{v}</b>
    </div>
  );
}
