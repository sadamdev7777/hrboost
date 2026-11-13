"use client";

import { tr, trRalat } from "@/lib/i18n";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useData } from "@/lib/useData";
import { tarikh } from "@/lib/format";
import { InputPeratus, SuisPemberat, pemberatSah } from "@/components/PemberatKpi";
import { useMe } from "@/lib/me";
import { getSenaraiPekerja } from "@/lib/hr";
import {
  beratSama,
  getPenilaian,
  kePeratus,
  peratusBerat,
  tetapkanPelulus,
  LABEL_STATUS_PENILAIAN,
  markahTeks,
  muktamadkan,
  SKALA_PRESTASI,
  simpanKendiri,
  simpanKpi,
  simpanPelulus,
  type ItemKpi,
  type Penilaian,
} from "@/lib/prestasi";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { ButangUtama, MedanBorang, Seksyen, Tag, inputKecil } from "@/components/Senarai";
import { beritahu, sahkan } from "@/components/Dialog";

/** Satu penilaian prestasi: kendiri (pekerja) → pelulus (ketua) → HR muktamad. */
export default function PenilaianPrestasiPage() {
  const { id } = useParams<{ id: string }>();
  const d = useData(() => getPenilaian(id), [id]);
  return (
    <Screen lebar="sederhana">
      <BackHeader title={tr("Penilaian prestasi")} href={d.data && (d.data.role === "hr" || d.data.role === "ceo") ? "/pengurusan/prestasi" : "/prestasi"} />
      {d.error && (
        <div className="px-4">
          <ErrorBox message={trRalat(d.error)} />
        </div>
      )}
      {!d.data && !d.error && <Loading />}
      {d.data && <Borang key={JSON.stringify(d.data.items.map((i) => i.id)) + d.data.status} p={d.data} reload={d.reload} />}
    </Screen>
  );
}

function Skala({ nilai, onPilih, label, boleh }: { nilai: number | null | undefined; onPilih: (n: number) => void; label: string; boleh: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-1.5">
      {SKALA_PRESTASI.map((s, i) => {
        const n = i + 1;
        const on = nilai === n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${label}: ${n} ${s}`}
            disabled={!boleh}
            onClick={() => onPilih(n)}
            className={`flex min-h-11 flex-col items-center justify-center rounded-[12px] border text-[11px] leading-tight font-semibold disabled:cursor-default ${on ? "border-primary bg-primary text-white" : "border-line bg-surface text-subtle"}`}
          >
            <b className="text-base">{n}</b>
            <span className="hidden sm:block">{s}</span>
          </button>
        );
      })}
    </div>
  );
}

function Borang({ p, reload }: { p: Penilaian; reload: () => void }) {
  const router = useRouter();
  const isiKendiri = p.role === "self" && p.status === "self" && p.cycle.status === "open";
  const isiPelulus = (p.role === "reviewer" && p.status === "manager") || (p.role === "hr" && p.status === "manager");
  // KPI hanya ditetapkan oleh HR (bukan pekerja, bukan pelulus)
  const ubahKpi = p.role === "hr" && p.status !== "final";
  const muktamad = p.can_finalise && p.status === "hr";
  const [berbeza, setBerbeza] = useState(!beratSama(p.items));
  const [items, setItems] = useState<ItemKpi[]>(ubahKpi && !beratSama(p.items) ? kePeratus(p.items) : p.items);
  const [ulasan, setUlasan] = useState((isiPelulus ? p.manager_comment : p.self_comment) ?? "");
  const [akhir, setAkhir] = useState(p.manager_rating != null ? String(p.manager_rating) : "");
  const [nota, setNota] = useState("");
  const [kpiBaru, setKpiBaru] = useState("");
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const kunciMarkah = isiKendiri ? "self" : "manager";

  const set = (i: number, patch: Partial<ItemKpi>) => setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const samaBerat = beratSama(items);
  const purata = (k: "self_score" | "manager_score") => {
    const ada = items.filter((x) => x[k] != null);
    const b = ada.reduce((a, x) => a + x.weight, 0);
    return b ? ada.reduce((a, x) => a + (x[k] as number) * x.weight, 0) / b : null;
  };

  async function jalankan(f: () => Promise<void>, mesej: string, balik = false) {
    setBusy(true);
    setRalat(null);
    try {
      await f();
      beritahu(mesej);
      if (balik) router.push(p.role === "hr" ? "/pengurusan/prestasi" : "/prestasi");
      else reload();
    } catch (e) {
      setRalat(e instanceof Error ? trRalat(e.message) : tr("Ralat"));
    }
    setBusy(false);
  }
  /** Simpan KPI (jika boleh diubah) dan markah. KPI baharu mendapat id selepas disimpan; susunan dikekalkan. */
  async function simpanSemua(hantar: boolean) {
    let sebenar = items;
    if (ubahKpi) {
      if (berbeza && !pemberatSah(items)) throw new Error(tr("Jumlah pemberat mesti tepat 100%."));
      await simpanKpi(p.id, items.map((x) => ({ ...x, weight: berbeza ? x.weight : 1 })));
      sebenar = (await getPenilaian(p.id)).items;
    }
    const m = sebenar.map((x, i) => ({
      id: x.id!,
      score: (items[i]?.[`${kunciMarkah}_score`] as number | null | undefined) ?? null,
      note: (items[i]?.[`${kunciMarkah}_note`] as string | null | undefined) ?? null,
    }));
    if (isiKendiri) await simpanKendiri(p.id, m, ulasan, hantar);
    else if (isiPelulus) await simpanPelulus(p.id, m, ulasan, hantar);
  }

  const st = LABEL_STATUS_PENILAIAN[p.status];
  return (
    <>
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-4">
        <div className="flex items-start gap-3 rounded-card bg-surface px-4 py-3">
          <span className="flex grow flex-col gap-0.5">
            <b className="text-base font-extrabold">{p.employee.name}</b>
            <span className="text-[13px] text-muted">{[p.employee.position, p.employee.department].filter(Boolean).join(" · ") || p.employee.employee_no}</span>
            <span className="text-xs text-muted">
              {p.cycle.name} · {tarikh(p.cycle.period_start)} – {tarikh(p.cycle.period_end)}
              {p.reviewer ? " · " + tr("Pelulus: {0}", p.reviewer) : p.reviewer_skip ? " · " + tr("Tiada pelulus (CEO)") : ""}
            </span>
          </span>
          <Tag tone={st.tone}>{st.l}</Tag>
        </div>

        {p.status === "final" && p.final_rating != null && (
          <div className="flex items-center justify-between rounded-card bg-[#E3F1EE] px-4 py-3 text-primary">
            <b className="text-sm font-extrabold">{tr("MARKAH AKHIR")}</b>
            <b className="text-2xl font-extrabold">{tr("{0} / 5", markahTeks(p.final_rating))}</b>
          </div>
        )}
        {p.role === "hr" && (p.status === "self" || p.status === "manager") && !p.reviewer_skip && (
          <PilihPelulus p={p} reload={reload} />
        )}
        {isiKendiri && (
          <span className="text-xs leading-snug text-muted">
            {tr("Nilai diri anda bagi setiap KPI (1 = Lemah, 5 = Cemerlang). KPI ditetapkan oleh HR. Markah pelulus dipaparkan selepas HR memuktamadkan penilaian.")}
          </span>
        )}

        <Seksyen>{tr("KPI & MATLAMAT")}</Seksyen>
        {ubahKpi && (
          <SuisPemberat
            berbeza={berbeza}
            items={items}
            onUbah={(v) => {
              setBerbeza(v);
              setItems(v ? kePeratus(items.map((x) => ({ ...x, weight: 1 }))) : items.map((x) => ({ ...x, weight: 1 })));
            }}
          />
        )}
        {items.length === 0 && <span className="rounded-card bg-surface px-4 py-3 text-sm text-muted">{tr("Belum ada KPI.")}</span>}
        {items.map((x, i) => (
          <div key={x.id ?? `baru-${i}`} className="flex flex-col gap-2 rounded-card bg-surface px-4 py-3">
            {ubahKpi ? (
              <div className={`grid ${berbeza ? "grid-cols-[1fr_96px_auto]" : "grid-cols-[1fr_auto]"} items-end gap-2`}>
                <MedanBorang label={tr("KPI {0}", i + 1)}>
                  <input className={inputKecil} value={x.title} onChange={(e) => set(i, { title: e.target.value })} />
                </MedanBorang>
                {berbeza && (
                  <MedanBorang label={tr("Pemberat")}>
                    <InputPeratus nilai={x.weight} label={tr("Pemberat KPI {0}", i + 1)} onUbah={(n) => set(i, { weight: n })} />
                  </MedanBorang>
                )}
                <button type="button" disabled={items.length <= 1} aria-label={tr("Buang KPI {0}", x.title)} onClick={() => setItems(items.filter((_, j) => j !== i))} className="flex size-11 items-center justify-center text-lg text-danger disabled:opacity-40">
                  ×
                </button>
                <div className={berbeza ? "col-span-3" : "col-span-2"}>
                  <input className={inputKecil + " w-full"} placeholder={tr("Sasaran (cth. RM500k jualan)")} value={x.target ?? ""} onChange={(e) => set(i, { target: e.target.value })} />
                </div>
              </div>
            ) : (
              <span className="flex flex-col gap-0.5">
                <b className="text-sm font-bold">{x.title}</b>
                <span className="text-xs text-muted">
                  {[x.target ? tr("Sasaran: {0}", x.target) : null, samaBerat ? null : tr("Pemberat {0}%", peratusBerat(x.weight, items))].filter(Boolean).join(" · ")}
                </span>
              </span>
            )}
            {(isiKendiri || x.self_score != null) && (
              <MedanBorang label={tr("Markah kendiri")}>
                <Skala nilai={x.self_score} boleh={isiKendiri} label={tr("Markah kendiri {0}", x.title)} onPilih={(n) => set(i, { self_score: n })} />
              </MedanBorang>
            )}
            {isiKendiri ? (
              <input className={inputKecil} placeholder={tr("Pencapaian / bukti (pilihan)")} value={x.self_note ?? ""} onChange={(e) => set(i, { self_note: e.target.value })} />
            ) : (
              x.self_note && <span className="text-xs text-muted">{tr("Pekerja: {0}", x.self_note)}</span>
            )}
            {(isiPelulus || x.manager_score != null) && (
              <MedanBorang label={tr("Markah pelulus")}>
                <Skala nilai={x.manager_score} boleh={isiPelulus} label={tr("Markah pelulus {0}", x.title)} onPilih={(n) => set(i, { manager_score: n })} />
              </MedanBorang>
            )}
            {isiPelulus ? (
              <input className={inputKecil} placeholder={tr("Ulasan pelulus (pilihan)")} value={x.manager_note ?? ""} onChange={(e) => set(i, { manager_note: e.target.value })} />
            ) : (
              x.manager_note && <span className="text-xs text-muted">{tr("Pelulus: {0}", x.manager_note)}</span>
            )}
          </div>
        ))}
        {ubahKpi && (
          <div className="flex gap-2">
            <input className={inputKecil + " grow"} placeholder={tr("Tambah KPI atau matlamat")} value={kpiBaru} onChange={(e) => setKpiBaru(e.target.value)} />
            <button
              type="button"
              disabled={!kpiBaru.trim() || items.length >= 20}
              onClick={() => {
                setItems([...items, { title: kpiBaru.trim(), description: null, target: null, weight: berbeza ? 0 : 1 }]);
                setKpiBaru("");
              }}
              className="h-11 shrink-0 rounded-[12px] border border-primary px-4 text-sm font-bold text-primary disabled:opacity-50"
            >
              {tr("Tambah")}
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-center">
          <span className="flex flex-col rounded-card bg-surface py-2.5">
            <b className="text-lg font-extrabold">{markahTeks(purata("self_score"))}</b>
            <span className="text-xs text-muted">{tr("Purata kendiri")}</span>
          </span>
          <span className="flex flex-col rounded-card bg-surface py-2.5">
            <b className="text-lg font-extrabold">{markahTeks(purata("manager_score") ?? p.manager_rating)}</b>
            <span className="text-xs text-muted">{tr("Purata pelulus")}</span>
          </span>
        </div>

        {(isiKendiri || isiPelulus) && (
          <MedanBorang label={isiKendiri ? tr("Ulasan keseluruhan anda") : tr("Ulasan keseluruhan pelulus")}>
            <textarea rows={3} value={ulasan} onChange={(e) => setUlasan(e.target.value)} className="rounded-[12px] border border-[#D5DEDC] bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary" />
          </MedanBorang>
        )}
        {!isiKendiri && p.self_comment && (
          <div className="flex flex-col gap-1 rounded-card bg-surface px-4 py-3 text-sm">
            <b className="text-xs font-bold text-muted">{tr("ULASAN PEKERJA")}</b>
            <span>{p.self_comment}</span>
          </div>
        )}
        {!isiPelulus && p.manager_comment && (
          <div className="flex flex-col gap-1 rounded-card bg-surface px-4 py-3 text-sm">
            <b className="text-xs font-bold text-muted">{tr("ULASAN PELULUS")}</b>
            <span>{p.manager_comment}</span>
          </div>
        )}
        {p.hr_note && (
          <div className="flex flex-col gap-1 rounded-card bg-surface px-4 py-3 text-sm">
            <b className="text-xs font-bold text-muted">{tr("NOTA HR")}</b>
            <span>{p.hr_note}</span>
          </div>
        )}
        {muktamad && (
          <>
            <Seksyen className="pt-1">{tr("MUKTAMADKAN")}</Seksyen>
            <MedanBorang label={tr("Markah akhir (1–5)")} nota={tr("Lalai: markah pelulus")}>
              <input className={inputKecil} inputMode="decimal" value={akhir} onChange={(e) => setAkhir(e.target.value.replace(/[^\d.]/g, ""))} />
            </MedanBorang>
            <MedanBorang label={tr("Nota kepada pekerja (pilihan)")}>
              <textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)} className="rounded-[12px] border border-[#D5DEDC] bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary" />
            </MedanBorang>
          </>
        )}
        {ralat && <ErrorBox message={ralat} />}
      </main>
      {(isiKendiri || isiPelulus || muktamad || (ubahKpi && p.role !== "self")) && (
        <div className="bar-bawah sticky bottom-0 flex flex-col gap-2 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
          {(isiKendiri || isiPelulus) && (
            <ButangUtama
              busy={busy}
              onClick={async () => {
                if (items.some((x) => x[`${kunciMarkah}_score`] == null)) return setRalat(tr("Sila beri markah bagi setiap KPI."));
                if (!(await sahkan({ tajuk: tr("Hantar penilaian?"), mesej: isiKendiri ? tr("Penilaian kendiri tidak boleh diubah selepas dihantar kepada pelulus.") : tr("Penilaian dihantar kepada HR untuk dimuktamadkan."), ok: tr("Hantar") }))) return;
                await jalankan(() => simpanSemua(true), isiKendiri ? tr("Penilaian kendiri dihantar.") : tr("Penilaian dihantar kepada HR."), true);
              }}
            >
              {tr("Hantar penilaian")}
            </ButangUtama>
          )}
          {muktamad && (
            <ButangUtama
              busy={busy}
              onClick={() => {
                const n = akhir.trim() ? Number(akhir) : null;
                if (n != null && !(n >= 1 && n <= 5)) return setRalat(tr("Markah akhir mesti antara 1 dan 5."));
                return jalankan(() => muktamadkan(p.id, n, nota), tr("Penilaian dimuktamadkan. Pekerja dimaklumkan."), true);
              }}
            >
              {tr("Muktamadkan")}
            </ButangUtama>
          )}
          {(isiKendiri || isiPelulus || (ubahKpi && !muktamad)) && (
            <button type="button" disabled={busy} onClick={() => jalankan(() => simpanSemua(false), tr("Disimpan."))} className="flex min-h-11 items-center justify-center text-sm font-bold text-primary">
              {tr("Simpan draf")}
            </button>
          )}
        </div>
      )}
    </>
  );
}

/** HR: tetapkan / tukar pelulus (cth. jabatan tiada ketua). */
function PilihPelulus({ p, reload }: { p: Penilaian; reload: () => void }) {
  const me = useMe();
  const senarai = useData(() => getSenaraiPekerja(me.active!.companyId), [me.active!.companyId]);
  const [pilih, setPilih] = useState(p.reviewer_person_id ?? "");
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const calon = (senarai.data ?? []).filter((x) => x.name !== p.employee.name || x.employeeNo !== p.employee.employee_no);
  async function simpan() {
    if (!pilih) return;
    setBusy(true);
    setRalat(null);
    try {
      await tetapkanPelulus(p.id, pilih);
      beritahu(tr("Pelulus ditetapkan."));
      reload();
    } catch (e) {
      setRalat(e instanceof Error ? trRalat(e.message) : tr("Ralat"));
    }
    setBusy(false);
  }
  return (
    <div className={`flex flex-col gap-2 rounded-card px-4 py-3 ${p.needs_reviewer ? "bg-warning-soft" : "bg-surface"}`}>
      <b className={`text-sm ${p.needs_reviewer ? "text-warning" : ""}`}>{p.needs_reviewer ? tr("Penilaian ini belum ada pelulus") : tr("Pelulus")}</b>
      {p.needs_reviewer && <span className="text-xs leading-snug text-warning">{tr("Jabatan pekerja ini tiada ketua. Pilih siapa yang akan menilai pekerja ini.")}</span>}
      <div className="flex gap-2">
        <select className={inputKecil + " min-w-0 grow"} aria-label={tr("Pilih pelulus")} value={pilih} onChange={(e) => setPilih(e.target.value)}>
          <option value="">{tr("Pilih pekerja…")}</option>
          {calon.map((x) => (
            <option key={x.personId} value={x.personId}>
              {x.name}
              {x.department ? ` · ${x.department}` : ""}
            </option>
          ))}
        </select>
        <button type="button" disabled={busy || !pilih || pilih === p.reviewer_person_id} onClick={simpan} className="h-11 shrink-0 rounded-[12px] bg-primary px-4 text-sm font-bold text-white disabled:opacity-50">
          {tr("Tetapkan")}
        </button>
      </div>
      {ralat && <ErrorBox message={ralat} />}
    </div>
  );
}
