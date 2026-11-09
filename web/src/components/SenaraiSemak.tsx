"use client";

import { tr } from "@/lib/i18n";
import { useState } from "react";
import { useData } from "@/lib/useData";
import { getSenaraiSemak, getTugasSemakSaya, padamSemak, tambahSemak, tandaSemak, type PerkaraSemak, type TugasSemak } from "@/lib/berkanun";
import { tarikh, todayISO } from "@/lib/format";
import { ErrorBox } from "./ui";
import { beritahu, mintaTeks } from "./Dialog";

function Tarikh({ iso, siap }: { iso: string | null; siap: boolean }) {
  if (!iso) return null;
  const lewat = !siap && iso < todayISO();
  const hariIni = !siap && iso === todayISO();
  return <span className={`text-xs ${lewat ? "font-bold text-danger" : hariIni ? "font-bold text-warning" : "text-muted"}`}>{lewat ? tr("Lewat · {0}", tarikh(iso)) : hariIni ? tr("Hari ini") : tarikh(iso)}</span>;
}

function KotakTanda({ siap, boleh, label, onTukar }: { siap: boolean; boleh: boolean; label: string; onTukar: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={siap}
      aria-label={label}
      disabled={!boleh}
      onClick={onTukar}
      className={`flex size-11 shrink-0 items-center justify-center rounded-full disabled:cursor-default`}
    >
      <span className={`flex size-6 items-center justify-center rounded-[7px] border-2 text-sm font-extrabold ${siap ? "border-primary bg-primary text-white" : "border-[#B8C6C3] bg-surface"} ${!boleh ? "opacity-50" : ""}`}>
        {siap ? "✓" : ""}
      </span>
    </button>
  );
}

/** Senarai semak bagi seorang pekerja (Profil Pekerja). */
export function SenaraiSemakPekerja({ employmentId, hr }: { employmentId: string; hr: boolean }) {
  const d = useData(() => getSenaraiSemak(employmentId), [employmentId]);
  const [ralat, setRalat] = useState<string | null>(null);
  const senarai = d.data ?? [];
  if (!d.data || !senarai.length) return null;
  const siap = senarai.filter((x) => x.done_at).length;

  async function tukar(x: PerkaraSemak) {
    setRalat(null);
    try {
      await tandaSemak(x.id, !x.done_at);
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
  }
  async function tambah() {
    const t = await mintaTeks({ tajuk: tr("Tambah perkara senarai semak"), label: tr("Perkara (untuk HR)"), ok: tr("Tambah") });
    if (!t) return;
    try {
      await tambahSemak(employmentId, "hr", t, null);
      beritahu(tr("Perkara ditambah."));
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
  }
  async function padam(x: PerkaraSemak) {
    try {
      await padamSemak(x.id);
      d.reload();
      beritahu(tr("Perkara dipadam."), "ok", {
        label: tr("Buat asal"),
        buat: async () => {
          await tambahSemak(employmentId, x.owner, x.title, x.due_date).catch(() => undefined);
          d.reload();
        },
      });
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
  }

  const kumpulan: { owner: "hr" | "ketua"; tajuk: string }[] = [
    { owner: "hr", tajuk: "HR" },
    { owner: "ketua", tajuk: tr("Ketua jabatan") },
  ];
  return (
    <section aria-label={tr("Senarai semak pekerja baharu")} className="flex flex-col gap-2 rounded-card bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="m-0 text-xs font-bold tracking-[0.04em] text-[#4A5A57]">{tr("SENARAI SEMAK PEKERJA BAHARU")}</h2>
        <span className={`text-xs font-bold ${siap === senarai.length && senarai.length ? "text-success" : "text-muted"}`}>
          {tr("{0}/{1} selesai", siap, senarai.length)}</span>
      </div>
      {senarai.length > 0 && (
        <div className="h-1.5 overflow-hidden rounded-full bg-[#E4EAE8]">
          <div className="h-full rounded-full bg-primary" style={{ width: `${(siap / senarai.length) * 100}%` }} />
        </div>
      )}
      {kumpulan.map((k) => {
        const xs = senarai.filter((x) => x.owner === k.owner);
        if (!xs.length) return null;
        return (
          <div key={k.owner} className="flex flex-col">
            <span className="pt-1 text-[11px] font-bold text-muted">{k.tajuk}</span>
            {xs.map((x) => (
              <div key={x.id} className="flex min-h-11 items-center gap-1 text-sm">
                <KotakTanda siap={!!x.done_at} boleh={x.can_act} label={x.title} onTukar={() => tukar(x)} />
                <span className="flex min-w-0 grow flex-col">
                  <span className={x.done_at ? "text-muted line-through" : ""}>{x.title}</span>
                  {x.done_at ? (
                    <span className="text-xs text-muted">
                      {tr("Selesai {0}{1}", tarikh(x.done_at), x.done_by_name ? tr(" oleh {0}", x.done_by_name) : "")}</span>
                  ) : (
                    <Tarikh iso={x.due_date} siap={false} />
                  )}
                </span>
                {hr && (
                  <button type="button" onClick={() => padam(x)} aria-label={tr("Padam {0}", x.title)} className="flex size-9 shrink-0 items-center justify-center text-lg text-muted hover:text-danger">
                    {tr("×")}</button>
                )}
              </div>
            ))}
          </div>
        );
      })}
      {ralat && <ErrorBox message={ralat} />}
      {hr && (
        <button type="button" onClick={tambah} className="flex min-h-10 items-center self-start text-[13px] font-bold text-primary">
          {tr("+ Tambah perkara")}</button>
      )}
    </section>
  );
}

/** Kad untuk ketua jabatan (Utama): perkara senarai semak pasukan yang belum selesai. */
export function TugasSemakKetua({ companyId }: { companyId: string }) {
  const d = useData(() => getTugasSemakSaya(companyId), [companyId]);
  const [ralat, setRalat] = useState<string | null>(null);
  const senarai = (d.data ?? []).filter((x) => x.owner === "ketua");
  if (!senarai.length) return null;
  async function siap(id: string) {
    setRalat(null);
    try {
      await tandaSemak(id, true);
      beritahu(tr("Ditanda selesai."), "ok", {
        label: tr("Buat asal"),
        buat: async () => {
          await tandaSemak(id, false).catch(() => undefined);
          d.reload();
        },
      });
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
  }
  return (
    <section aria-label={tr("Senarai semak pekerja baharu")} className="flex flex-col gap-1 rounded-card bg-surface px-4 py-3">
      <h2 className="m-0 pb-1 text-xs font-bold tracking-[0.04em] text-[#4A5A57]">{tr("PEKERJA BAHARU · SENARAI SEMAK ANDA")}</h2>
      {senarai.slice(0, 5).map((x) => (
        <div key={x.id} className="flex min-h-11 items-center gap-1 text-sm">
          <KotakTanda siap={false} boleh label={`${x.title} (${x.employee_name})`} onTukar={() => siap(x.id)} />
          <span className="flex min-w-0 grow flex-col">
            <span>{x.title}</span>
            <span className="flex gap-1.5 text-xs text-muted">
              <b className="font-semibold text-subtle">{x.employee_name}</b>
              <Tarikh iso={x.due_date} siap={false} />
            </span>
          </span>
        </div>
      ))}
      {senarai.length > 5 && <span className="py-1 text-xs text-muted">{tr("dan {0} perkara lagi", senarai.length - 5)}</span>}
      {ralat && <ErrorBox message={ralat} />}
    </section>
  );
}

/** Ringkasan per pekerja untuk Papan Pemuka HR (hanya perkara HR yang lewat / tiba dalam 3 hari). */
export function ringkasSemakHr(xs: TugasSemak[]) {
  const had = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  const m = new Map<string, { employment_id: string; name: string; n: number; lewat: number }>();
  for (const x of xs) {
    if (x.owner !== "hr" || (x.due_date && x.due_date > had)) continue;
    const r = m.get(x.employment_id) ?? { employment_id: x.employment_id, name: x.employee_name, n: 0, lewat: 0 };
    r.n++;
    if (x.due_date && x.due_date < todayISO()) r.lewat++;
    m.set(x.employment_id, r);
  }
  return [...m.values()];
}
