"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useData } from "@/lib/useData";
import { LABEL_STATUS_SYARIKAT, masaRelatif, rpc } from "@/lib/admin";
import { ErrorBox, Loading } from "@/components/ui";

type Dash = {
  companies_active: number;
  companies_new_week: number;
  staff_active: number;
  staff_login_30d: number;
  onboarding_incomplete: number;
  wa_month: number;
  ai_month: number;
  grants_pending: number;
  attention: { company_id: string; name: string; issue: string; since: string }[];
  top_usage: { company_id: string; name: string; status: string; staff: number; wa: number; wa_limit: number | null; ai: number }[];
};
type Grant = { id: string; who: string; who_from: string | null; role: string; target: string; days: number; status: string };
const PERANAN: Record<string, string> = { hr: "HR", ceo: tr("paparan CEO"), admin: tr("Pentadbir"), finance: tr("Kewangan"), staff: tr("lihat sahaja") };
const BULAN = [tr("Januari"), tr("Februari"), tr("Mac"), tr("April"), tr("Mei"), tr("Jun"), tr("Julai"), tr("Ogos"), tr("September"), tr("Oktober"), tr("November"), tr("Disember")];

// Rujukan reka bentuk: design/SA_Dashboard.dc.html
export default function SaDashboard() {
  const d = useData(() => rpc<Dash>("sa_dashboard"), []);
  const g = useData(() => rpc<Grant[]>("sa_access_grants"), []);
  const x = d.data;
  const now = new Date();
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="m-0 text-2xl font-extrabold">{tr("Ringkasan platform")}</h1>
          <span className="text-sm text-muted">{tr("Data agregat sahaja. Butiran peribadi pekerja tidak dipaparkan di sini.")}</span>
        </div>
        <span className="rounded-full bg-surface px-3 py-1.5 text-sm font-bold">
          {BULAN[now.getMonth()]} {now.getFullYear()}
        </span>
      </div>
      {d.error && <ErrorBox message={d.error} />}
      {!x && !d.error && <Loading />}
      {x && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kad l={tr("Syarikat aktif")} v={x.companies_active} s={tr("+{0} minggu ini", x.companies_new_week)} />
            <Kad l={tr("Pekerja aktif")} v={x.staff_active} s={tr("{0} log masuk dalam 30 hari", x.staff_login_30d)} />
            <Kad l={tr("Persediaan belum selesai")} v={x.onboarding_incomplete} s="syarikat" />
            <Kad l={tr("Mesej WhatsApp")} v={x.wa_month} s={tr("bulan ini")} />
            <Kad l={tr("Panggilan AI")} v={x.ai_month} s={tr("bulan ini")} />
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <section className="flex flex-col gap-3 rounded-card bg-surface p-5">
              <div className="flex items-center justify-between">
                <b className="text-base font-extrabold">{tr("Perlu perhatian")}</b>
                <Link href="/admin/syarikat" className="text-sm font-bold">
                  {tr("Semua syarikat")}</Link>
              </div>
              {x.attention.length === 0 ? (
                <span className="text-sm text-muted">{tr("Tiada isu.")}</span>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted">
                      <th className="py-2 font-bold">{tr("Syarikat")}</th>
                      <th className="py-2 font-bold">{tr("Isu")}</th>
                      <th className="py-2 font-bold">{tr("Sejak")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {x.attention.map((a, i) => (
                      <tr key={i} className="border-t border-[#EEF2F1]">
                        <td className="py-2.5 font-bold">{a.name}</td>
                        <td className="py-2.5">{a.issue}</td>
                        <td className="py-2.5 text-muted">{masaRelatif(a.since)}</td>
                        <td className="py-2.5 text-right">
                          <Link href={`/admin/syarikat/${a.company_id}`} className="font-bold">
                            {tr("Lihat")}</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
            <section className="flex flex-col gap-3 rounded-card bg-surface p-5">
              <div className="flex items-center justify-between">
                <b className="text-base font-extrabold">{tr("Permohonan akses")}</b>
                <Link href="/admin/akses" className="text-sm font-bold">
                  {tr("Semak")}</Link>
              </div>
              {(g.data ?? []).filter((r) => r.status === "pending").length === 0 && <span className="text-sm text-muted">{tr("Tiada permohonan menunggu.")}</span>}
              {(g.data ?? [])
                .filter((r) => r.status === "pending")
                .slice(0, 4)
                .map((r) => (
                  <div key={r.id} className="flex flex-col gap-0.5 border-t border-[#EEF2F1] pt-2.5 text-sm first:border-0 first:pt-0">
                    <b>
                      {r.who} ({r.who_from ?? "-"})
                    </b>
                    <span className="text-muted">
                      {tr("Mohon akses {0} ke {1} · {2} hari", PERANAN[r.role] ?? r.role, r.target, r.days)}</span>
                  </div>
                ))}
            </section>
          </div>
          <section className="flex flex-col gap-3 rounded-card bg-surface p-5">
            <b className="text-base font-extrabold">{tr("Penggunaan bulan ini — syarikat teratas")}</b>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="py-2 font-bold">{tr("Syarikat")}</th>
                    <th className="py-2 font-bold">{tr("Pekerja")}</th>
                    <th className="py-2 font-bold">{tr("WhatsApp (had)")}</th>
                    <th className="py-2 font-bold">AI</th>
                    <th className="py-2 font-bold">{tr("Status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {x.top_usage.map((t) => {
                    const pct = t.wa_limit ? Math.min(100, (t.wa / t.wa_limit) * 100) : 0;
                    return (
                      <tr key={t.company_id} className="border-t border-[#EEF2F1]">
                        <td className="py-2.5 font-bold">
                          <Link href={`/admin/syarikat/${t.company_id}`} className="text-ink!">
                            {t.name}
                          </Link>
                        </td>
                        <td className="py-2.5">{t.staff}</td>
                        <td className="py-2.5">
                          <span className="flex items-center gap-2">
                            <span className="h-1.5 w-20 rounded-full bg-[#E4EAE8]">
                              <i className={`block h-full rounded-full ${pct >= 80 ? "bg-warning" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                            </span>
                            {t.wa} / {t.wa_limit ?? "∞"}
                          </span>
                        </td>
                        <td className="py-2.5">{t.ai}</td>
                        <td className="py-2.5">
                          <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${LABEL_STATUS_SYARIKAT[t.status]?.c}`}>{LABEL_STATUS_SYARIKAT[t.status]?.l}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}

function Kad({ l, v, s }: { l: string; v: number; s: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-card bg-surface p-4">
      <span className="text-xs font-bold text-muted">{l}</span>
      <b className="text-2xl font-extrabold">{v.toLocaleString("en-MY")}</b>
      <em className="text-xs text-muted not-italic">{s}</em>
    </div>
  );
}
