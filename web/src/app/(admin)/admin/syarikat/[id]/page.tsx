"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useData } from "@/lib/useData";
import { LABEL_STATUS_SYARIKAT, masaRelatif, rpc, tarikhPendek } from "@/lib/admin";
import { ErrorBox, Loading } from "@/components/ui";

type Butiran = {
  id: string;
  name: string;
  code: string;
  reg_no: string | null;
  status: string;
  suspended_reason: string | null;
  created_at: string;
  onboarding_steps: number;
  staff_active: number;
  staff_total: number;
  departments: number;
  last_login: string | null;
  wa_used: number;
  ai_used: number;
  wa_limit: number | null;
  ai_limit: number | null;
  wa_default: number | null;
  ai_default: number | null;
  admins: { name: string; roles: string[] }[];
};
const PERANAN: Record<string, string> = { admin: tr("Pentadbir"), hr: "HR", finance: tr("Kewangan"), ceo: "CEO" };
const SEBAB = [tr("Penyalahgunaan / spam"), tr("Permintaan Pentadbir syarikat"), tr("Melanggar terma")];

// Rujukan reka bentuk: design/SA_SyarikatButiran.dc.html
export default function SaSyarikatButiran() {
  const { id } = useParams<{ id: string }>();
  const d = useData(() => rpc<Butiran>("sa_company_detail", { p_company: id }), [id]);
  const [had, setHad] = useState<{ wa: string; ai: string } | null>(null);
  const [sah, setSah] = useState(false);
  const [sebab, setSebab] = useState(SEBAB[0]);
  const [mesej, setMesej] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [ralat, setRalat] = useState<string | null>(null);
  const x = d.data;
  if (!x) return d.error ? <ErrorBox message={d.error} /> : <Loading />;
  const lim = { wa: x.wa_limit ?? x.wa_default, ai: x.ai_limit ?? x.ai_default };
  const v = had ?? { wa: x.wa_limit == null ? "" : String(x.wa_limit), ai: x.ai_limit == null ? "" : String(x.ai_limit) };
  const st = x.status === "suspended" ? "suspended" : x.onboarding_steps < 6 ? "onboarding" : "active";

  async function buat(f: () => Promise<unknown>, ok: string) {
    setRalat(null);
    setInfo(null);
    try {
      await f();
      setInfo(ok);
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
  }

  return (
    <>
      <Link href="/admin/syarikat" className="text-sm font-bold">
        {tr("← Semua syarikat")}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="m-0 text-2xl font-extrabold">{x.name}</h1>
        <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${LABEL_STATUS_SYARIKAT[st].c}`}>{LABEL_STATUS_SYARIKAT[st].l}</span>
      </div>
      {info && <span className="rounded-[12px] bg-success-soft px-3 py-2 text-sm font-semibold text-success">{info}</span>}
      {ralat && <ErrorBox message={ralat} />}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="grid grid-cols-2 gap-3 rounded-card bg-surface p-5 text-sm">
          <Item k={tr("Pentadbir")} v={x.admins.filter((a) => a.roles.includes("admin")).map((a) => a.name).join(", ") || "-"} />
          <Item k={tr("Pekerja aktif")} v={`${x.staff_active} / ${x.staff_total}`} />
          <Item k={tr("Jabatan")} v={String(x.departments)} />
          <Item k={tr("Daftar")} v={tarikhPendek(x.created_at)} />
          <Item k={tr("Persediaan")} v={x.onboarding_steps >= 6 ? tr("Selesai") : tr("Langkah {0}/6", x.onboarding_steps)} />
          <Item k={tr("Log masuk terakhir")} v={x.last_login ? tr("{0} lalu", masaRelatif(x.last_login)) : "-"} />
          <Item k={tr("Kod")} v={x.code} />
          <Item k={tr("No. SSM")} v={x.reg_no ?? "-"} />
        </section>
        <section className="flex flex-col gap-3 rounded-card bg-surface p-5 text-sm">
          <b className="text-base font-extrabold">{tr("Penggunaan bulan ini")}</b>
          <Bar l={tr("Mesej WhatsApp")} used={x.wa_used} limit={lim.wa} />
          <Bar l={tr("Panggilan AI")} used={x.ai_used} limit={lim.ai} />
          <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <label className="flex flex-col gap-1 text-xs font-bold text-muted">
              {tr("Had WhatsApp / bulan")}<input className="h-10 rounded-[10px] border border-line px-2.5 text-sm text-ink" inputMode="numeric" placeholder={tr("Lalai ({0})", x.wa_default ?? tr("tiada had"))} value={v.wa} onChange={(e) => setHad({ ...v, wa: e.target.value.replace(/\D/g, "") })} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-muted">
              {tr("Had AI / bulan")}<input className="h-10 rounded-[10px] border border-line px-2.5 text-sm text-ink" inputMode="numeric" placeholder={tr("Lalai ({0})", x.ai_default ?? tr("tiada had"))} value={v.ai} onChange={(e) => setHad({ ...v, ai: e.target.value.replace(/\D/g, "") })} />
            </label>
            <button
              type="button"
              onClick={() => buat(() => rpc("sa_set_company_limits", { p_company: x.id, p_wa: v.wa ? Number(v.wa) : null, p_ai: v.ai ? Number(v.ai) : null }), "Had disimpan.")}
              className="h-10 rounded-[10px] bg-primary px-4 text-sm font-bold text-white"
            >
              {tr("Simpan had")}</button>
          </div>
        </section>
        <section className="flex flex-col gap-3 rounded-card bg-surface p-5 text-sm">
          <b className="text-base font-extrabold">{tr("Pentadbir syarikat")}</b>
          {x.admins.map((a, i) => (
            <div key={i} className="flex justify-between border-t border-[#EEF2F1] pt-2 first:border-0 first:pt-0">
              <b>{a.name}</b>
              <span className="text-muted">{a.roles.map((r) => PERANAN[r]).join(" · ")}</span>
            </div>
          ))}
          <textarea value={mesej} onChange={(e) => setMesej(e.target.value)} rows={2} placeholder={tr("Mesej kepada Pentadbir (WhatsApp)")} className="rounded-[10px] border border-line p-2.5 text-sm" />
          <button
            type="button"
            disabled={!mesej.trim()}
            onClick={() => buat(() => rpc("sa_message_admins", { p_company: x.id, p_message: mesej }).then(() => setMesej("")), "Mesej dimasukkan ke barisan WhatsApp.")}
            className="h-10 self-start rounded-[10px] border border-primary px-4 text-sm font-bold text-primary disabled:opacity-50"
          >
            {tr("Hantar mesej kepada Pentadbir")}</button>
        </section>
        <section className="flex flex-col gap-3 rounded-card border border-danger/30 bg-surface p-5 text-sm">
          <b className="text-base font-extrabold text-danger">{tr("Zon bahaya")}</b>
          {x.status === "active" ? (
            <>
              <span>{tr("Nyahaktifkan syarikat: semua pengguna tidak boleh log masuk, pemberitahuan WhatsApp berhenti. Data disimpan dan boleh diaktifkan semula.")}</span>
              {!sah ? (
                <button type="button" onClick={() => setSah(true)} className="h-10 self-start rounded-[10px] border border-danger px-4 font-bold text-danger">
                  {tr("Nyahaktifkan syarikat")}</button>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="flex flex-col gap-1 text-xs font-bold text-muted">
                    {tr("Sebab (dimaklumkan kepada Pentadbir)")}<select value={sebab} onChange={(e) => setSebab(e.target.value)} className="h-10 rounded-[10px] border border-line px-2 text-sm text-ink">
                      {SEBAB.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setSah(false)} className="h-10 rounded-[10px] border border-line px-4 font-bold">
                      {tr("Batal")}</button>
                    <button
                      type="button"
                      onClick={() => buat(() => rpc("sa_set_company_status", { p_company: x.id, p_status: "suspended", p_reason: sebab }), "Syarikat dinyahaktifkan. Pentadbir telah dimaklumkan.").then(() => setSah(false))}
                      className="h-10 rounded-[10px] bg-danger px-4 font-bold text-white"
                    >
                      {tr("Ya, nyahaktifkan")}</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <span>{tr("Dinyahaktifkan{0}. Pentadbir telah dimaklumkan.", x.suspended_reason ? ` (${x.suspended_reason})` : "")}</span>
              <button
                type="button"
                onClick={() => buat(() => rpc("sa_set_company_status", { p_company: x.id, p_status: "active", p_reason: null }), "Syarikat diaktifkan semula.")}
                className="h-10 self-start rounded-[10px] bg-primary px-4 font-bold text-white"
              >
                {tr("Aktifkan semula")}</button>
            </>
          )}
        </section>
      </div>
    </>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted">{k}</span>
      <b>{v}</b>
    </div>
  );
}

function Bar({ l, used, limit }: { l: string; used: number; limit: number | null }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between">
        <span>{l}</span>
        <b>{limit ? tr("{0}% daripada had", pct) : tr("{0} (tiada had)", used)}</b>
      </div>
      <span className="h-2 rounded-full bg-[#E4EAE8]">
        <i className={`block h-full rounded-full ${pct >= 80 ? "bg-warning" : "bg-primary"}`} style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}
