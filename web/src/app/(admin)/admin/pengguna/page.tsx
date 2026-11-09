"use client";

import { tr } from "@/lib/i18n";
import { mintaTeks } from "@/components/Dialog";
import { useState } from "react";
import { useData } from "@/lib/useData";
import { masaRelatif, rpc } from "@/lib/admin";
import { ErrorBox, Loading } from "@/components/ui";

type U = { person_id: string; name: string; whatsapp: string | null; companies: string | null; last_sign_in: string | null; active: boolean; is_platform_admin: boolean };

// Rujukan reka bentuk: design/SA_Pengguna.dc.html
export default function SaPengguna() {
  const [q, setQ] = useState("");
  const [cari, setCari] = useState("");
  const d = useData(() => rpc<U[]>("sa_users", { p_query: cari }), [cari]);
  const [ralat, setRalat] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

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
      <h1 className="m-0 text-2xl font-extrabold">{tr("Pengguna")}</h1>
      <span className="text-sm text-muted">{tr("Cari pengguna untuk menyahaktifkan akaun atau memaksa log keluar. Profil peribadi tidak dipaparkan.")}</span>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setCari(q);
        }}
        className="flex gap-2"
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tr("Cari nama atau no. WhatsApp")}
          aria-label={tr("Cari pengguna")}
          className="h-11 min-w-0 grow rounded-[12px] border border-line bg-surface px-3.5 text-sm outline-none focus:border-primary"
        />
        <button type="submit" className="h-11 rounded-[12px] bg-primary px-4 text-sm font-bold text-white">
          {tr("Cari")}</button>
      </form>
      {info && <span className="rounded-[12px] bg-success-soft px-3 py-2 text-sm font-semibold text-success">{info}</span>}
      {ralat && <ErrorBox message={ralat} />}
      {d.error && <ErrorBox message={d.error} />}
      {!d.data && !d.error && <Loading />}
      {d.data && (
        <div className="overflow-x-auto rounded-card bg-surface p-4">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-xs tracking-[0.04em] text-muted">
                <th className="py-2 font-bold">{tr("NAMA")}</th>
                <th className="py-2 font-bold">WHATSAPP</th>
                <th className="py-2 font-bold">{tr("SYARIKAT · PERANAN")}</th>
                <th className="py-2 font-bold">{tr("LOG MASUK")}</th>
                <th className="py-2 font-bold">{tr("STATUS")}</th>
                <th className="py-2 font-bold">{tr("TINDAKAN")}</th>
              </tr>
            </thead>
            <tbody>
              {d.data.map((u) => (
                <tr key={u.person_id} className="border-t border-[#EEF2F1]">
                  <td className="py-2.5 font-bold">
                    {u.name}
                    {u.is_platform_admin && <span className="ml-1 text-xs text-ai">{tr("(Pentadbir Platform)")}</span>}
                  </td>
                  <td className="py-2.5 tabular-nums">{u.whatsapp ?? "-"}</td>
                  <td className="py-2.5">{u.companies ?? "-"}</td>
                  <td className="py-2.5">{u.last_sign_in ? tr("{0} lalu", masaRelatif(u.last_sign_in)) : tr("Belum")}</td>
                  <td className="py-2.5">
                    <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${u.active ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>{u.active ? tr("Aktif") : tr("Dinyahaktif")}</span>
                  </td>
                  <td className="py-2.5">
                    <span className="flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const sebab = u.active ? await mintaTeks({ tajuk: `Nyahaktifkan ${u.name}?`, mesej: "Pengguna ini tidak boleh log masuk sehingga diaktifkan semula.", label: "Sebab", ok: "Nyahaktifkan", bahaya: true }) : null;
                          if (u.active && sebab === null) return;
                          buat(
                            () => rpc("sa_set_person_active", { p_person: u.person_id, p_active: !u.active, p_reason: sebab }),
                            u.active ? `${u.name} dinyahaktifkan.` : `${u.name} diaktifkan semula.`,
                          );
                        }}
                        className={`h-9 rounded-[10px] border px-3 text-[13px] font-bold ${u.active ? "border-danger text-danger" : "border-primary text-primary"}`}
                      >
                        {u.active ? tr("Nyahaktifkan") : tr("Aktifkan")}
                      </button>
                      <button type="button" onClick={() => buat(() => rpc("sa_force_logout", { p_person: u.person_id }), `${u.name} telah dilog keluar.`)} className="h-9 rounded-[10px] border border-line px-3 text-[13px] font-bold">
                        {tr("Log keluar")}</button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <span className="text-xs text-muted">{tr("Pengguna yang dinyahaktifkan tidak boleh log masuk ke mana-mana syarikat. Rekod HR mereka kekal disimpan untuk syarikat.")}</span>
    </>
  );
}
