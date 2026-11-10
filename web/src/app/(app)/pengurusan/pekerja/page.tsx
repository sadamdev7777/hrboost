"use client";

import { tr } from "@/lib/i18n";
import { TabModul } from "@/components/TabModul";
import Link from "next/link";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import {
  getJabatan,
  getSenaraiPekerja,
  jemputPekerja,
  kemasKiniPekerjaan,
  LABEL_PERANAN,
  type PekerjaRingkas,
} from "@/lib/hr";
import { beritahu } from "@/components/Dialog";
import { inisial } from "@/lib/format";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { PengepalaAkar, TabNav } from "@/components/TabNav";
import { ButangBantuan, KadPanduan } from "@/components/Panduan";
import { useRouter } from "next/navigation";
import { useSkrinLebar } from "@/lib/skrin";
import { useSimpanan } from "@/lib/simpanan";
import { labelJenis } from "@/lib/hr";
import { mintaTeks } from "@/components/Dialog";
import { tarikh } from "@/lib/format";
import { HadPeranan, Seksyen, Tag } from "@/components/Senarai";

type Tapis = "semua" | "aktif" | "percubaan" | "belum";
const TAPIS: { id: Tapis; label: string }[] = [
  { id: "semua", label: tr("Semua") },
  { id: "aktif", label: tr("Aktif") },
  { id: "percubaan", label: tr("Percubaan") },
  { id: "belum", label: tr("Belum aktif") },
];
const AV = [
  "bg-[#E3F1EE] text-primary",
  "bg-[#FDEBD7] text-warning",
  "bg-[#EDE9F8] text-ai",
];

// Rujukan reka bentuk: design/Pekerja.dc.html
export default function PekerjaPage() {
  return (
    <HadPeranan roles={["hr", "ceo", "admin"]}>
      <Senarai />
    </HadPeranan>
  );
}

function Senarai() {
  const me = useMe();
  const emp = me.active!;
  const list = useData(() => getSenaraiPekerja(emp.companyId), [emp.companyId]);
  const [cari, setCari] = useState("");
  // Penapis terakhir diingati dalam pelayar ini; paparan boleh disimpan dengan nama
  const [pilihan, setPilihan] = useSimpanan<{ tapis: Tapis; jab: string }>("hrb_pekerja_tapis", { tapis: "semua", jab: "" });
  const [paparan, setPaparan] = useSimpanan<{ nama: string; tapis: Tapis; jab: string }[]>("hrb_pekerja_paparan", []);
  const tapis = pilihan.tapis;
  const jab = pilihan.jab;
  const setTapis = (t: Tapis) => setPilihan({ ...pilihan, tapis: t });
  const setJab = (j: string) => setPilihan({ ...pilihan, jab: j });
  async function simpanPaparan() {
    const nama = await mintaTeks({ tajuk: tr("Simpan paparan ini"), label: tr("Nama paparan"), ok: tr("Simpan") });
    if (!nama) return;
    setPaparan([...paparan.filter((x) => x.nama !== nama.trim()), { nama: nama.trim(), tapis, jab }].slice(-8));
  }
  const lebar = useSkrinLebar();
  const boleh = me.roles.includes("hr") || me.roles.includes("admin");

  const semua = list.data ?? [];
  const q = cari.trim().toLowerCase();
  const tapisan = semua.filter((p) => {
    if (
      q &&
      !p.name.toLowerCase().includes(q) &&
      !p.employeeNo.toLowerCase().includes(q)
    )
      return false;
    if (jab && (p.department ?? "-") !== jab) return false;
    if (tapis === "aktif") return p.activated && p.status === "active";
    if (tapis === "percubaan") return p.status === "probation";
    if (tapis === "belum") return !p.activated;
    return true;
  });
  const senaraiJab = [...new Set(semua.map((p) => p.department ?? "-"))].sort();
  const kumpulan = new Map<string, PekerjaRingkas[]>();
  for (const p of tapisan) {
    const k = (p.department ?? tr("Tiada jabatan")).toUpperCase();
    kumpulan.set(k, [...(kumpulan.get(k) ?? []), p]);
  }

  return (
    <Screen lebar="lebar">
      <PengepalaAkar
        title={tr("Pekerja {0}", emp.companyCode)}
        action={
          boleh && (
            <span className="flex items-center gap-2">
            <ButangBantuan id="pekerja" />
            <Link
              href="/pengurusan/tetapan/jabatan"
              className="flex h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-bold text-primary!"
            >
              {tr("Jabatan")}</Link>
            <Link
              href="/pengurusan/pekerja/baru"
              aria-label={tr("Tambah pekerja")}
              className="mr-1 flex size-11 items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-white! lg:mr-0 lg:w-auto lg:px-4"
            >
              <svg
                aria-hidden="true"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span className="hidden lg:inline">{tr("Tambah pekerja")}</span>
            </Link>
            </span>
          )
        }
      />
      <TabModul modul="pekerja" />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-6 lg:px-0">
        {boleh && <KadPanduan id="pekerja" />}
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <label className="flex h-12 items-center gap-2.5 rounded-[14px] bg-surface px-3.5 lg:w-[340px] lg:shrink-0">
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#5B6B68"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <span className="sr-only">{tr("Cari pekerja")}</span>
            <input
              type="search"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder={tr("Cari nama atau no. pekerja")}
              className="h-full grow bg-transparent text-sm outline-none"
            />
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:shrink-0 lg:overflow-visible lg:pb-0">
            {TAPIS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTapis(t.id)}
                className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] font-bold whitespace-nowrap ${tapis === t.id ? "bg-primary text-white" : "bg-surface text-[#4A5A57]"}`}
              >
                {tr(t.label)}
                {t.id === "semua" && list.data ? ` · ${semua.length}` : ""}
              </button>
            ))}
          </div>
          <select
            aria-label={tr("Tapis jabatan")}
            value={jab}
            onChange={(e) => setJab(e.target.value)}
            className="h-9 max-w-[260px] shrink-0 rounded-full border border-line bg-surface px-3 text-[13px] font-bold text-[#4A5A57]"
          >
            <option value="">{tr("Semua jabatan")}</option>
            {senaraiJab.map((j) => (
              <option key={j} value={j}>
                {j === "-" ? tr("Tiada jabatan") : j}
              </option>
            ))}
          </select>
          {(tapis !== "semua" || jab) && (
            <button type="button" onClick={simpanPaparan} className="h-9 shrink-0 rounded-full px-2 text-[13px] font-bold whitespace-nowrap text-primary">
              {tr("+ Simpan paparan")}</button>
          )}
          {lebar && <PilihLajur />}
          {lebar && tapisan.length > 0 && (
            <button type="button" onClick={() => eksportCSV(tapisan, emp.companyCode)} className="ml-auto h-9 shrink-0 rounded-full border border-primary px-4 text-[13px] font-bold whitespace-nowrap text-primary">
              {tr("Eksport CSV")}</button>
          )}
        </div>

        {paparan.length > 0 && (
          <div className="-mt-1 flex flex-wrap items-center gap-1.5" aria-label={tr("Paparan tersimpan")}>
            <span className="text-xs font-bold text-muted">{tr("Paparan:")}</span>
            {paparan.map((v) => {
              const on = v.tapis === tapis && v.jab === jab;
              return (
                <span key={v.nama} className={`flex h-8 items-center rounded-full border text-[12px] font-bold ${on ? "border-primary bg-[#E3F1EE] text-primary" : "border-line bg-surface"}`}>
                  <button type="button" onClick={() => setPilihan({ tapis: v.tapis, jab: v.jab })} className="h-full pr-1 pl-3">
                    {v.nama}
                  </button>
                  <button type="button" aria-label={tr("Buang paparan {0}", v.nama)} onClick={() => setPaparan(paparan.filter((x) => x.nama !== v.nama))} className="h-full pr-2.5 pl-1 text-muted">
                    {tr("×")}</button>
                </span>
              );
            })}
          </div>
        )}
        {list.error && <ErrorBox message={list.error} />}
        {list.loading && !list.data && <Loading />}
        {list.data && tapisan.length === 0 && (
          <span className="text-sm text-muted">{tr("Tiada pekerja sepadan.")}</span>
        )}

        {lebar && tapisan.length > 0 && <JadualPekerja ppl={tapisan} boleh={boleh} onUbah={list.reload} />}

        {!lebar &&
          [...kumpulan.entries()].map(([jab, ppl]) => (
            <div key={jab} className="flex flex-col gap-1.5">
              <Seksyen>{jab}</Seksyen>
              <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
                {ppl.map((p, i) => (
                  <Link
                    key={p.id}
                    href={`/pengurusan/pekerja/${p.id}`}
                    className="flex min-h-12 items-center gap-3 py-2 text-ink!"
                  >
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${AV[i % 3]}`}
                    >
                      {inisial(p.name)}
                    </span>
                    <span className="flex grow flex-col gap-0.5">
                      <b className="text-sm font-bold">{p.name}</b>
                      <span className="text-xs text-muted">
                        {[p.isHead ? tr("Ketua Jabatan") : p.position, p.employeeNo]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    {!p.activated ? (
                      <Tag tone="neutral">{tr("Belum aktif")}</Tag>
                    ) : p.status === "probation" ? (
                      <Tag tone="warning">{tr("Percubaan")}</Tag>
                    ) : (
                      p.roles
                        .filter((r) =>
                          ["hr", "finance", "ceo", "admin"].includes(r),
                        )
                        .slice(0, 1)
                        .map((r) => (
                          <Tag key={r} tone="primary">
                            {LABEL_PERANAN[r]}
                          </Tag>
                        ))
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
      </main>
      <TabNav />
    </Screen>
  );
}

function StatusPekerja({ p }: { p: PekerjaRingkas }) {
  if (!p.activated) return <Tag tone="neutral">{tr("Belum aktif")}</Tag>;
  if (p.status === "probation") return <Tag tone="warning">{tr("Percubaan")}</Tag>;
  return <Tag tone="success">{tr("Aktif")}</Tag>;
}

/** Jadual untuk skrin lebar (desktop). */
type Lajur = "name" | "employeeNo" | "department" | "position" | "status" | "joinDate" | "type";
type LajurPilihan = "department" | "position" | "roles" | "joinDate" | "type" | "status";
const LAJUR_PILIHAN: { k: LajurPilihan; label: string }[] = [
  { k: "department", label: tr("Jabatan") },
  { k: "position", label: tr("Jawatan") },
  { k: "roles", label: tr("Peranan") },
  { k: "joinDate", label: tr("Tarikh mula") },
  { k: "type", label: tr("Jenis pekerjaan") },
  { k: "status", label: tr("Status") },
];
const LAJUR_LALAI: LajurPilihan[] = ["department", "position", "roles", "status"];

/** Pilih lajur jadual Pekerja (diingati dalam pelayar ini). */
function PilihLajur() {
  const [lajur, setLajur] = useSimpanan<LajurPilihan[]>("hrb_pekerja_lajur", LAJUR_LALAI);
  return (
    <details className="relative shrink-0">
      <summary className="flex h-9 cursor-pointer list-none items-center rounded-full border border-line bg-surface px-3.5 text-[13px] font-bold whitespace-nowrap text-[#4A5A57] [&::-webkit-details-marker]:hidden">
        {tr("Lajur ▾")}</summary>
      <div className="absolute right-0 z-20 mt-1 flex w-52 flex-col rounded-[14px] border border-line bg-surface p-2 shadow-lg">
        {LAJUR_PILIHAN.map((l) => (
          <label key={l.k} className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-[10px] px-2 text-sm hover:bg-page">
            <input
              type="checkbox"
              className="size-[18px] accent-primary"
              checked={lajur.includes(l.k)}
              onChange={(e) => setLajur(e.target.checked ? [...lajur, l.k] : lajur.filter((x) => x !== l.k))}
            />
            {tr(l.label)}
          </label>
        ))}
      </div>
    </details>
  );
}
const STATUS_TEKS = (p: PekerjaRingkas) => (!p.activated ? tr("Belum aktif") : p.status === "probation" ? tr("Percubaan") : tr("Aktif"));

function eksportCSV(ppl: PekerjaRingkas[], kod: string) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const baris = [
    [tr("Nama"), tr("No. pekerja"), tr("Jabatan"), tr("Jawatan"), tr("Peranan"), tr("Status")],
    ...ppl.map((p) => [p.name, p.employeeNo, p.department ?? "", p.isHead ? tr("Ketua Jabatan") : (p.position ?? ""), p.roles.map((r) => LABEL_PERANAN[r] ?? r).join(" / "), STATUS_TEKS(p)]),
  ];
  const url = URL.createObjectURL(new Blob(["\ufeff" + baris.map((b) => b.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = tr("pekerja-{0}.csv", kod);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

type Isih = { k: Lajur; naik: boolean };
function Kepala({ k, label, isih, setIsih }: { k: Lajur; label: string; isih: Isih; setIsih: (i: Isih) => void }) {
  return (
    <th className="px-4 py-3 font-bold" aria-sort={isih.k === k ? (isih.naik ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => setIsih({ k, naik: isih.k === k ? !isih.naik : true })} className="flex items-center gap-1 font-bold tracking-[0.03em]">
        {label}
        <span aria-hidden="true" className={isih.k === k ? "text-primary" : "opacity-30"}>
          {isih.k === k && !isih.naik ? "▼" : "▲"}
        </span>
      </button>
    </th>
  );
}

function JadualPekerja({ ppl: asal, boleh, onUbah }: { ppl: PekerjaRingkas[]; boleh: boolean; onUbah: () => void }) {
  const router = useRouter();
  const me = useMe();
  const [tanda, setTanda] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [jabBaru, setJabBaru] = useState("");
  const jab = useData(() => (boleh ? getJabatan(me.active!.companyId) : Promise.resolve([])), [boleh, me.active!.companyId]);
  const dipilih = asal.filter((p) => tanda.has(p.id));
  const togol = (id: string, on: boolean) => {
    const n = new Set(tanda);
    if (on) n.add(id);
    else n.delete(id);
    setTanda(n);
  };
  async function pukal(kerja: (p: PekerjaRingkas) => Promise<unknown>, sasaran: PekerjaRingkas[], mesej: string, asal?: (p: PekerjaRingkas) => Promise<unknown>) {
    setBusy(true);
    let ok = 0;
    const gagal: string[] = [];
    for (const p of sasaran) {
      try {
        await kerja(p);
        ok++;
      } catch (e) {
        gagal.push(`${p.name}: ${e instanceof Error ? e.message : tr("Ralat")}`);
      }
    }
    setBusy(false);
    setTanda(new Set());
    if (gagal.length) beritahu(tr("{0} berjaya. Tidak berjaya: {1}", ok, gagal.join("; ")), "ralat");
    else
      beritahu(
        mesej.replace("{n}", String(ok)),
        "ok",
        asal && {
          label: tr("Buat asal"),
          buat: async () => {
            for (const p of sasaran) await asal(p).catch(() => undefined);
            beritahu(tr("Perubahan dibatalkan."));
            onUbah();
          },
        },
      );
    onUbah();
  }
  const [isih, setIsih] = useState<Isih>({ k: "employeeNo", naik: true });
  const [lajur] = useSimpanan<LajurPilihan[]>("hrb_pekerja_lajur", LAJUR_LALAI);
  const ada = (k: LajurPilihan) => lajur.includes(k);
  const nilai = (p: PekerjaRingkas, k: Lajur) =>
    k === "status" ? STATUS_TEKS(p) : k === "position" ? (p.isHead ? tr("Ketua Jabatan") : (p.position ?? "")) : k === "type" ? labelJenis(p.type) : ((p[k] as string | null) ?? "");
  const ppl = [...asal].sort((a, b) => nilai(a, isih.k).localeCompare(nilai(b, isih.k), "ms") * (isih.naik ? 1 : -1));
  const belumAktif = dipilih.filter((p) => !p.activated);
  return (
    <div className="flex flex-col gap-2">
    {boleh && dipilih.length > 0 && (
      <div className="flex flex-wrap items-center gap-2 rounded-[14px] bg-[#E3F1EE] px-4 py-2.5 text-sm">
        <b className="text-primary">{tr("{0} dipilih", dipilih.length)}</b>
        <span className="grow" />
        <select aria-label={tr("Jabatan baharu")} value={jabBaru} onChange={(e) => setJabBaru(e.target.value)} className="h-9 rounded-full border border-line bg-surface px-3 text-[13px] font-bold">
          <option value="">{tr("Pindah ke jabatan…")}</option>
          {(jab.data ?? []).map((j) => (
            <option key={j.id} value={j.id}>
              {j.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!jabBaru || busy}
          onClick={() =>
            pukal(
              (p) => kemasKiniPekerjaan(p.id, { department_id: jabBaru }),
              dipilih,
              "{n} pekerja dipindahkan.",
              (p) => kemasKiniPekerjaan(p.id, { department_id: p.departmentId ?? "" }),
            )
          }
          className="h-9 rounded-full bg-primary px-4 text-[13px] font-bold text-white disabled:opacity-40"
        >
          {tr("Pindah")}</button>
        {belumAktif.length > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => pukal((p) => jemputPekerja(p.id), belumAktif, "Jemputan dihantar semula kepada {n} pekerja.")}
            className="h-9 rounded-full border border-primary bg-surface px-4 text-[13px] font-bold text-primary disabled:opacity-40"
          >
            {tr("Hantar semula jemputan ({0})", belumAktif.length)}</button>
        )}
        <button type="button" onClick={() => setTanda(new Set())} className="h-9 px-2 text-[13px] font-bold text-muted">
          {tr("Batal")}</button>
      </div>
    )}
    <div className="overflow-hidden rounded-card bg-surface">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[#EEF2F1] text-xs font-bold tracking-[0.03em] text-muted">
            {boleh && (
              <th className="w-10 pl-4">
                <input
                  type="checkbox"
                  aria-label={tr("Pilih semua pekerja")}
                  className="size-[18px] accent-primary"
                  checked={ppl.length > 0 && ppl.every((p) => tanda.has(p.id))}
                  onChange={(e) => setTanda(e.target.checked ? new Set(ppl.map((p) => p.id)) : new Set())}
                />
              </th>
            )}
            <Kepala isih={isih} setIsih={setIsih} k="name" label={tr("NAMA")} />
            <Kepala isih={isih} setIsih={setIsih} k="employeeNo" label={tr("NO. PEKERJA")} />
            {ada("department") && <Kepala isih={isih} setIsih={setIsih} k="department" label={tr("JABATAN")} />}
            {ada("position") && <Kepala isih={isih} setIsih={setIsih} k="position" label={tr("JAWATAN")} />}
            {ada("roles") && <th className="px-4 py-3 font-bold">{tr("PERANAN")}</th>}
            {ada("joinDate") && <Kepala isih={isih} setIsih={setIsih} k="joinDate" label={tr("TARIKH MULA")} />}
            {ada("type") && <Kepala isih={isih} setIsih={setIsih} k="type" label={tr("JENIS")} />}
            {ada("status") && <Kepala isih={isih} setIsih={setIsih} k="status" label={tr("STATUS")} />}
          </tr>
        </thead>
        <tbody>
          {ppl.map((p, i) => (
            <tr
              key={p.id}
              onClick={() => router.push(`/pengurusan/pekerja/${p.id}`)}
              className={`cursor-pointer border-b border-[#EEF2F1] last:border-0 hover:bg-[#F7F9F8] ${tanda.has(p.id) ? "bg-[#F2F8F7]" : ""}`}
            >
              {boleh && (
                <td className="pl-4" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" aria-label={tr("Pilih {0}", p.name)} className="size-[18px] accent-primary" checked={tanda.has(p.id)} onChange={(e) => togol(p.id, e.target.checked)} />
                </td>
              )}
              <td className="px-4 py-2.5">
                <Link
                  href={`/pengurusan/pekerja/${p.id}`}
                  className="flex items-center gap-3 font-bold text-ink!"
                >
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${AV[i % 3]}`}
                  >
                    {inisial(p.name)}
                  </span>
                  {p.name}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-muted">{p.employeeNo}</td>
              {ada("department") && <td className="px-4 py-2.5">{p.department ?? "—"}</td>}
              {ada("position") && (
                <td className="px-4 py-2.5">
                  {p.isHead ? tr("Ketua Jabatan") : (p.position ?? "—")}
                </td>
              )}
              {ada("roles") && (
              <td className="px-4 py-2.5">
                <span className="flex flex-wrap gap-1">
                  {p.roles
                    .filter((r) =>
                      ["hr", "finance", "ceo", "admin"].includes(r),
                    )
                    .map((r) => (
                      <Tag key={r} tone="primary">
                        {LABEL_PERANAN[r]}
                      </Tag>
                    ))}
                </span>
              </td>
              )}
              {ada("joinDate") && <td className="px-4 py-2.5 whitespace-nowrap">{tarikh(p.joinDate)}</td>}
              {ada("type") && <td className="px-4 py-2.5">{labelJenis(p.type)}</td>}
              {ada("status") && (
                <td className="px-4 py-2.5">
                  <StatusPekerja p={p} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}
