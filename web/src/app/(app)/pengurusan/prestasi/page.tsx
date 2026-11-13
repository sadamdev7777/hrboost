"use client";

import { tr, trRalat } from "@/lib/i18n";
import Link from "next/link";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { tarikh, todayISO } from "@/lib/format";
import { InputPeratus, SuisPemberat, pemberatSah } from "@/components/PemberatKpi";
import {
  beratSama,
  bukaKitaran,
  getKitaran,
  getSenaraiKitaran,
  kePeratus,
  LABEL_STATUS_PENILAIAN,
  markahTeks,
  simpanKitaran,
  tutupKitaran,
  type ItemKpi,
  type Kitaran,
} from "@/lib/prestasi";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { PengepalaAkar } from "@/components/TabNav";
import { ButangUtama, HadPeranan, Lembaran, MedanBorang, Seksyen, Tag, inputKecil } from "@/components/Senarai";
import { beritahu, sahkan } from "@/components/Dialog";

const STATUS_KITARAN: Record<Kitaran["status"], { l: string; tone: "neutral" | "warning" | "success" }> = {
  draft: { l: tr("Draf"), tone: "neutral" },
  open: { l: tr("Dibuka"), tone: "warning" },
  closed: { l: tr("Ditutup"), tone: "success" },
};

/** HR: kitaran penilaian prestasi & KPI — cipta, buka kepada pekerja, pantau, muktamadkan, tutup. */
export default function PrestasiHrPage() {
  return (
    <HadPeranan roles={["hr", "ceo", "admin"]} back="/pengurusan">
      <PrestasiHr />
    </HadPeranan>
  );
}

function PrestasiHr() {
  const me = useMe();
  const cid = me.active!.companyId;
  const hr = me.roles.some((r) => r === "hr" || r === "admin");
  const d = useData(() => getKitaran(cid), [cid]);
  const [pilih, setPilih] = useState<string | null>(null);
  const [borang, setBorang] = useState<Kitaran | "baru" | null>(null);
  const aktif = d.data?.find((k) => k.id === (pilih ?? d.data?.[0]?.id)) ?? null;

  return (
    <Screen lebar="lebar">
      <PengepalaAkar
        title={tr("Penilaian prestasi")}
        back="/pengurusan"
        action={
          hr && (
            <button type="button" onClick={() => setBorang("baru")} className="h-10 rounded-full bg-primary px-4 text-[13px] font-bold text-white">
              {tr("+ Kitaran baharu")}
            </button>
          )
        }
      />
      <main className="flex grow flex-col gap-2.5 px-4 pt-2 pb-6 lg:px-0">
        {d.error && <ErrorBox message={d.error} />}
        {!d.data && !d.error && <Loading />}
        {d.data && d.data.length === 0 && (
          <div className="flex flex-col gap-2 rounded-card bg-surface px-4 py-5 text-sm">
            <b className="font-extrabold">{tr("Belum ada kitaran penilaian")}</b>
            <span className="text-muted">
              {tr("Cipta kitaran (cth. Penilaian Tahunan 2026) dan senarai KPI. Apabila dibuka, setiap pekerja menilai diri sendiri, kemudian pelulus menilai (ketua jabatan bagi pekerja, CEO bagi ketua jabatan), dan HR memuktamadkan markah.")}
            </span>
          </div>
        )}
        {d.data && d.data.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {d.data.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setPilih(k.id)}
                className={`h-10 rounded-full px-3.5 text-[13px] font-bold ${aktif?.id === k.id ? "bg-primary text-white" : "bg-surface text-[#4A5A57]"}`}
              >
                {k.name}
              </button>
            ))}
          </div>
        )}
        {aktif && <ButiranKitaran key={aktif.id} k={aktif} hr={hr} reload={d.reload} ubah={() => setBorang(aktif)} />}
      </main>
      {borang && (
        <BorangKitaran
          cid={cid}
          k={borang === "baru" ? null : borang}
          tutup={() => setBorang(null)}
          selesai={(id) => {
            setBorang(null);
            setPilih(id);
            d.reload();
          }}
        />
      )}
    </Screen>
  );
}

function ButiranKitaran({ k, hr, reload, ubah }: { k: Kitaran; hr: boolean; reload: () => void; ubah: () => void }) {
  const s = useData(() => getSenaraiKitaran(k.id), [k.id, k.total, k.final_done]);
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const st = STATUS_KITARAN[k.status];
  async function buat(f: () => Promise<void>) {
    setBusy(true);
    setRalat(null);
    try {
      await f();
      reload();
      s.reload();
    } catch (e) {
      setRalat(e instanceof Error ? trRalat(e.message) : tr("Ralat"));
    }
    setBusy(false);
  }
  return (
    <>
      <div className="flex flex-col gap-2 rounded-card bg-surface px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="flex grow flex-col gap-0.5">
            <b className="text-base font-extrabold">{k.name}</b>
            <span className="text-xs text-muted">
              {tarikh(k.period_start)} – {tarikh(k.period_end)}
              {k.self_due ? " · " + tr("kendiri sebelum {0}", tarikh(k.self_due)) : ""}
              {k.manager_due ? " · " + tr("pelulus sebelum {0}", tarikh(k.manager_due)) : ""}
            </span>
          </span>
          <Tag tone={st.tone}>{st.l}</Tag>
        </div>
        {k.status !== "draft" && (
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            {[
              [tr("Pekerja"), k.total],
              [tr("Kendiri siap"), k.self_done],
              [tr("Pelulus siap"), k.manager_done],
              [tr("Muktamad"), k.final_done],
            ].map(([l, n]) => (
              <span key={String(l)} className="flex flex-col rounded-[12px] bg-page py-2">
                <b className="text-lg font-extrabold">{n}</b>
                <span className="text-xs text-muted">{l}</span>
              </span>
            ))}
          </div>
        )}
        {k.status === "draft" && (
          <span className="text-[13px] text-muted">{tr("{0} KPI: {1}", k.template.length, k.template.map((t) => t.title).join(", ") || "-")}</span>
        )}
        {k.avg_rating != null && <span className="text-[13px] text-muted">{tr("Purata markah akhir: {0} / 5", markahTeks(k.avg_rating))}</span>}
        {hr && (
          <div className="flex flex-wrap gap-2 pt-1">
            {k.status !== "closed" && (
              <button type="button" onClick={ubah} className="h-10 rounded-full border border-primary px-4 text-[13px] font-bold text-primary">
                {tr("Ubah")}
              </button>
            )}
            {k.status !== "closed" && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  buat(async () => {
                    if (!(await sahkan({ tajuk: k.status === "draft" ? tr("Buka kitaran penilaian?") : tr("Tambah pekerja baharu?"), mesej: tr("Setiap pekerja aktif menerima penilaian dengan KPI kitaran ini dan dimaklumkan melalui WhatsApp. HR boleh mengubah KPI bagi setiap pekerja selepas itu."), ok: tr("Buka") }))) return;
                    const n = await bukaKitaran(k.id);
                    beritahu(tr("{0} pekerja dimaklumkan.", n));
                  })
                }
                className="h-10 rounded-full bg-primary px-4 text-[13px] font-bold text-white disabled:opacity-60"
              >
                {k.status === "draft" ? tr("Buka kepada pekerja") : tr("Tambah pekerja baharu")}
              </button>
            )}
            {k.status === "open" && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  buat(async () => {
                    if (!(await sahkan({ tajuk: tr("Tutup kitaran?"), mesej: tr("Pekerja tidak lagi boleh mengisi penilaian kendiri."), ok: tr("Tutup") }))) return;
                    await tutupKitaran(k.id);
                  })
                }
                className="h-10 rounded-full px-3 text-[13px] font-bold text-danger disabled:opacity-60"
              >
                {tr("Tutup kitaran")}
              </button>
            )}
          </div>
        )}
        {ralat && <ErrorBox message={ralat} />}
      </div>
      {k.status !== "draft" && (
        <>
          <Seksyen className="pt-1">{tr("PEKERJA")}</Seksyen>
          {s.error && <ErrorBox message={s.error} />}
          {!s.data && !s.error && <Loading />}
          {s.data && (
            <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              {s.data.map((r) => {
                const t = LABEL_STATUS_PENILAIAN[r.status];
                return (
                  <Link key={r.id} href={`/prestasi/${r.id}`} className="flex min-h-[56px] items-center gap-3 py-2 text-ink!">
                    <span className="flex grow flex-col gap-0.5">
                      <b className="text-sm font-bold">{r.name}</b>
                      <span className="text-xs text-muted">
                        {[r.department, r.reviewer ? tr("Pelulus: {0}", r.reviewer) : r.reviewer_skip ? tr("Tiada pelulus (CEO) — terus kepada HR") : null].filter(Boolean).join(" · ")}
                        {r.needs_reviewer && <b className="text-warning">{(r.department ? " · " : "") + tr("Perlu tetapkan pelulus")}</b>}
                      </span>
                    </span>
                    <span className="w-14 text-right text-sm font-extrabold tabular-nums">{markahTeks(r.final_rating ?? r.manager_rating)}</span>
                    <Tag tone={r.status === "hr" && hr ? "warning" : t.tone}>{r.status === "hr" && hr ? tr("Perlu dimuktamadkan") : t.l}</Tag>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}

function BorangKitaran({ cid, k, tutup, selesai }: { cid: string; k: Kitaran | null; tutup: () => void; selesai: (id: string) => void }) {
  const y = Number(todayISO().slice(0, 4));
  const [f, setF] = useState({
    name: k?.name ?? tr("Penilaian Tahunan {0}", y),
    period_start: k?.period_start ?? `${y}-01-01`,
    period_end: k?.period_end ?? `${y}-12-31`,
    self_due: k?.self_due ?? "",
    manager_due: k?.manager_due ?? "",
  });
  const asal: ItemKpi[] = k?.template?.length
    ? k.template
    : [
        { title: tr("Pencapaian sasaran kerja"), description: null, target: null, weight: 1 },
        { title: tr("Kualiti kerja"), description: null, target: null, weight: 1 },
        { title: tr("Kerjasama & komunikasi"), description: null, target: null, weight: 1 },
        { title: tr("Disiplin & kehadiran"), description: null, target: null, weight: 1 },
      ];
  const [berbeza, setBerbeza] = useState(!beratSama(asal));
  const [kpi, setKpi] = useState<ItemKpi[]>(beratSama(asal) ? asal : kePeratus(asal));
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const draf = !k || k.status === "draft";
  const set = (n: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [n]: e.target.value });

  function tukarBerbeza(v: boolean) {
    setBerbeza(v);
    setKpi(v ? kePeratus(kpi.map((x) => ({ ...x, weight: 1 }))) : kpi.map((x) => ({ ...x, weight: 1 })));
  }
  async function simpan() {
    const isi = kpi.filter((x) => x.title.trim());
    if (berbeza && !pemberatSah(isi)) return setRalat(tr("Jumlah pemberat mesti tepat 100%."));
    setBusy(true);
    setRalat(null);
    try {
      const id = await simpanKitaran(cid, k?.id ?? null, { ...f, template: isi.map((x) => ({ ...x, weight: berbeza ? x.weight : 1 })) });
      beritahu(tr("Kitaran disimpan."));
      selesai(id);
    } catch (e) {
      setRalat(e instanceof Error ? trRalat(e.message) : tr("Ralat"));
      setBusy(false);
    }
  }
  return (
    <Lembaran title={k ? tr("Ubah kitaran") : tr("Kitaran penilaian baharu")} onClose={tutup} besar>
      <div className="flex flex-col gap-2.5">
        <MedanBorang label={tr("Nama kitaran")}>
          <input className={inputKecil} value={f.name} onChange={set("name")} />
        </MedanBorang>
        <div className="grid grid-cols-2 gap-2.5">
          <MedanBorang label={tr("Tempoh mula")}>
            <input type="date" className={inputKecil} value={f.period_start} onChange={set("period_start")} />
          </MedanBorang>
          <MedanBorang label={tr("Tempoh tamat")}>
            <input type="date" className={inputKecil} value={f.period_end} onChange={set("period_end")} />
          </MedanBorang>
          <MedanBorang label={tr("Kendiri sebelum")}>
            <input type="date" className={inputKecil} value={f.self_due} onChange={set("self_due")} />
          </MedanBorang>
          <MedanBorang label={tr("Pelulus sebelum")}>
            <input type="date" className={inputKecil} value={f.manager_due} onChange={set("manager_due")} />
          </MedanBorang>
        </div>
        <Seksyen className="pt-1">{tr("KPI UNTUK SEMUA PEKERJA")}</Seksyen>
        <span className="text-xs leading-snug text-muted">
          {draf
            ? tr("KPI ini disalin kepada setiap pekerja apabila kitaran dibuka. Selepas itu, HR boleh mengubah KPI bagi setiap pekerja dalam penilaian masing-masing.")
            : tr("KPI kitaran tidak boleh diubah selepas kitaran dibuka. Ubah KPI dalam penilaian setiap pekerja.")}
        </span>
        <SuisPemberat berbeza={berbeza} onUbah={tukarBerbeza} items={kpi} disabled={!draf} />
        {kpi.map((x, i) => (
          <div key={i} className={`grid ${berbeza ? "grid-cols-[1fr_96px_auto]" : "grid-cols-[1fr_auto]"} items-center gap-2`}>
            <input className={inputKecil} disabled={!draf} value={x.title} placeholder={tr("Nama KPI")} aria-label={tr("KPI {0}", i + 1)} onChange={(e) => setKpi(kpi.map((y, j) => (j === i ? { ...y, title: e.target.value } : y)))} />
            {berbeza && <InputPeratus nilai={x.weight} disabled={!draf} label={tr("Pemberat KPI {0}", i + 1)} onUbah={(n) => setKpi(kpi.map((y, j) => (j === i ? { ...y, weight: n } : y)))} />}
            <button type="button" disabled={!draf || kpi.length <= 1} aria-label={tr("Buang KPI {0}", x.title)} onClick={() => setKpi(kpi.filter((_, j) => j !== i))} className="flex size-11 items-center justify-center text-lg text-danger disabled:opacity-40">
              ×
            </button>
          </div>
        ))}
        {draf && kpi.length < 20 && (
          <button type="button" onClick={() => setKpi([...kpi, { title: "", description: null, target: null, weight: berbeza ? 0 : 1 }])} className="flex min-h-11 items-center self-start text-sm font-bold text-primary">
            {tr("+ Tambah KPI")}
          </button>
        )}
        <span className="text-xs leading-snug text-muted">
          {tr("Setiap KPI dinilai pada skala 1–5 (1 = Lemah, 5 = Cemerlang). Pelulus: ketua jabatan menilai pekerja, CEO menilai ketua jabatan. Jika jabatan tiada ketua, HR menetapkan pelulus.")}
        </span>
        {ralat && <ErrorBox message={ralat} />}
        <ButangUtama onClick={simpan} busy={busy}>
          {tr("Simpan")}
        </ButangUtama>
      </div>
    </Lembaran>
  );
}
