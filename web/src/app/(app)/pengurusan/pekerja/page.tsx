"use client";

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
import { useRouter } from "next/navigation";
import { useSkrinLebar } from "@/lib/skrin";
import { HadPeranan, Seksyen, Tag } from "@/components/Senarai";

type Tapis = "semua" | "aktif" | "percubaan" | "belum";
const TAPIS: { id: Tapis; label: string }[] = [
  { id: "semua", label: "Semua" },
  { id: "aktif", label: "Aktif" },
  { id: "percubaan", label: "Percubaan" },
  { id: "belum", label: "Belum aktif" },
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
  const [tapis, setTapis] = useState<Tapis>("semua");
  const [jab, setJab] = useState("");
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
    const k = (p.department ?? "Tiada jabatan").toUpperCase();
    kumpulan.set(k, [...(kumpulan.get(k) ?? []), p]);
  }

  return (
    <Screen lebar="lebar">
      <PengepalaAkar
        title={`Pekerja ${emp.companyCode}`}
        action={
          boleh && (
            <span className="flex items-center gap-2">
            <Link
              href="/pengurusan/tetapan/jabatan"
              className="flex h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-bold text-primary!"
            >
              Jabatan
            </Link>
            <Link
              href="/pengurusan/pekerja/baru"
              aria-label="Tambah pekerja"
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
              <span className="hidden lg:inline">Tambah pekerja</span>
            </Link>
            </span>
          )
        }
      />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-6 lg:px-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="flex h-12 items-center gap-2.5 rounded-[14px] bg-surface px-3.5 lg:w-[360px]">
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
            <span className="sr-only">Cari pekerja</span>
            <input
              type="search"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari nama atau no. pekerja"
              className="h-full grow bg-transparent text-sm outline-none"
            />
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {TAPIS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTapis(t.id)}
                className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] font-bold ${tapis === t.id ? "bg-primary text-white" : "bg-surface text-[#4A5A57]"}`}
              >
                {t.label}
                {t.id === "semua" && list.data ? ` · ${semua.length}` : ""}
              </button>
            ))}
          </div>
          <select
            aria-label="Tapis jabatan"
            value={jab}
            onChange={(e) => setJab(e.target.value)}
            className="h-9 rounded-full border border-line bg-surface px-3 text-[13px] font-bold text-[#4A5A57]"
          >
            <option value="">Semua jabatan</option>
            {senaraiJab.map((j) => (
              <option key={j} value={j}>
                {j === "-" ? "Tiada jabatan" : j}
              </option>
            ))}
          </select>
          {lebar && tapisan.length > 0 && (
            <button type="button" onClick={() => eksportCSV(tapisan, emp.companyCode)} className="ml-auto h-9 rounded-full border border-primary px-4 text-[13px] font-bold text-primary">
              Eksport CSV
            </button>
          )}
        </div>

        {list.error && <ErrorBox message={list.error} />}
        {list.loading && !list.data && <Loading />}
        {list.data && tapisan.length === 0 && (
          <span className="text-sm text-muted">Tiada pekerja sepadan.</span>
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
                        {[p.isHead ? "Ketua Jabatan" : p.position, p.employeeNo]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    {!p.activated ? (
                      <Tag tone="neutral">Belum aktif</Tag>
                    ) : p.status === "probation" ? (
                      <Tag tone="warning">Percubaan</Tag>
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
  if (!p.activated) return <Tag tone="neutral">Belum aktif</Tag>;
  if (p.status === "probation") return <Tag tone="warning">Percubaan</Tag>;
  return <Tag tone="success">Aktif</Tag>;
}

/** Jadual untuk skrin lebar (desktop). */
type Lajur = "name" | "employeeNo" | "department" | "position" | "status";
const STATUS_TEKS = (p: PekerjaRingkas) => (!p.activated ? "Belum aktif" : p.status === "probation" ? "Percubaan" : "Aktif");

function eksportCSV(ppl: PekerjaRingkas[], kod: string) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const baris = [
    ["Nama", "No. pekerja", "Jabatan", "Jawatan", "Peranan", "Status"],
    ...ppl.map((p) => [p.name, p.employeeNo, p.department ?? "", p.isHead ? "Ketua Jabatan" : (p.position ?? ""), p.roles.map((r) => LABEL_PERANAN[r] ?? r).join(" / "), STATUS_TEKS(p)]),
  ];
  const url = URL.createObjectURL(new Blob(["\ufeff" + baris.map((b) => b.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `pekerja-${kod}.csv`;
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
  async function pukal(kerja: (p: PekerjaRingkas) => Promise<unknown>, sasaran: PekerjaRingkas[], mesej: string) {
    setBusy(true);
    let ok = 0;
    const gagal: string[] = [];
    for (const p of sasaran) {
      try {
        await kerja(p);
        ok++;
      } catch (e) {
        gagal.push(`${p.name}: ${e instanceof Error ? e.message : "Ralat"}`);
      }
    }
    setBusy(false);
    setTanda(new Set());
    if (gagal.length) beritahu(`${ok} berjaya. Tidak berjaya: ${gagal.join("; ")}`, "ralat");
    else beritahu(mesej.replace("{n}", String(ok)));
    onUbah();
  }
  const [isih, setIsih] = useState<Isih>({ k: "employeeNo", naik: true });
  const nilai = (p: PekerjaRingkas, k: Lajur) => (k === "status" ? STATUS_TEKS(p) : k === "position" ? (p.isHead ? "Ketua Jabatan" : (p.position ?? "")) : ((p[k] as string | null) ?? ""));
  const ppl = [...asal].sort((a, b) => nilai(a, isih.k).localeCompare(nilai(b, isih.k), "ms") * (isih.naik ? 1 : -1));
  const belumAktif = dipilih.filter((p) => !p.activated);
  return (
    <div className="flex flex-col gap-2">
    {boleh && dipilih.length > 0 && (
      <div className="flex flex-wrap items-center gap-2 rounded-[14px] bg-[#E3F1EE] px-4 py-2.5 text-sm">
        <b className="text-primary">{dipilih.length} dipilih</b>
        <span className="grow" />
        <select aria-label="Jabatan baharu" value={jabBaru} onChange={(e) => setJabBaru(e.target.value)} className="h-9 rounded-full border border-line bg-surface px-3 text-[13px] font-bold">
          <option value="">Pindah ke jabatan…</option>
          {(jab.data ?? []).map((j) => (
            <option key={j.id} value={j.id}>
              {j.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!jabBaru || busy}
          onClick={() => pukal((p) => kemasKiniPekerjaan(p.id, { department_id: jabBaru }), dipilih, "{n} pekerja dipindahkan.")}
          className="h-9 rounded-full bg-primary px-4 text-[13px] font-bold text-white disabled:opacity-40"
        >
          Pindah
        </button>
        {belumAktif.length > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => pukal((p) => jemputPekerja(p.id), belumAktif, "Jemputan dihantar semula kepada {n} pekerja.")}
            className="h-9 rounded-full border border-primary bg-surface px-4 text-[13px] font-bold text-primary disabled:opacity-40"
          >
            Hantar semula jemputan ({belumAktif.length})
          </button>
        )}
        <button type="button" onClick={() => setTanda(new Set())} className="h-9 px-2 text-[13px] font-bold text-muted">
          Batal
        </button>
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
                  aria-label="Pilih semua pekerja"
                  className="size-[18px] accent-primary"
                  checked={ppl.length > 0 && ppl.every((p) => tanda.has(p.id))}
                  onChange={(e) => setTanda(e.target.checked ? new Set(ppl.map((p) => p.id)) : new Set())}
                />
              </th>
            )}
            <Kepala isih={isih} setIsih={setIsih} k="name" label="NAMA" />
            <Kepala isih={isih} setIsih={setIsih} k="employeeNo" label="NO. PEKERJA" />
            <Kepala isih={isih} setIsih={setIsih} k="department" label="JABATAN" />
            <Kepala isih={isih} setIsih={setIsih} k="position" label="JAWATAN" />
            <th className="px-4 py-3 font-bold">PERANAN</th>
            <Kepala isih={isih} setIsih={setIsih} k="status" label="STATUS" />
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
                  <input type="checkbox" aria-label={`Pilih ${p.name}`} className="size-[18px] accent-primary" checked={tanda.has(p.id)} onChange={(e) => togol(p.id, e.target.checked)} />
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
              <td className="px-4 py-2.5">{p.department ?? "—"}</td>
              <td className="px-4 py-2.5">
                {p.isHead ? "Ketua Jabatan" : (p.position ?? "—")}
              </td>
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
              <td className="px-4 py-2.5">
                <StatusPekerja p={p} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}
