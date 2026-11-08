"use client";

import Link from "next/link";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getSenaraiPekerja, LABEL_PERANAN, type PekerjaRingkas } from "@/lib/hr";
import { inisial } from "@/lib/format";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { PengepalaAkar, TabNav } from "@/components/TabNav";
import { useRouter } from "next/navigation";
import { HadPeranan, Seksyen, Tag } from "@/components/Senarai";

type Tapis = "semua" | "aktif" | "percubaan" | "belum";
const TAPIS: { id: Tapis; label: string }[] = [
  { id: "semua", label: "Semua" },
  { id: "aktif", label: "Aktif" },
  { id: "percubaan", label: "Percubaan" },
  { id: "belum", label: "Belum aktif" },
];
const AV = ["bg-[#E3F1EE] text-primary", "bg-[#FDEBD7] text-warning", "bg-[#EDE9F8] text-ai"];

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
  const boleh = me.roles.includes("hr") || me.roles.includes("admin");

  const semua = list.data ?? [];
  const q = cari.trim().toLowerCase();
  const tapisan = semua.filter((p) => {
    if (q && !p.name.toLowerCase().includes(q) && !p.employeeNo.toLowerCase().includes(q)) return false;
    if (tapis === "aktif") return p.activated && p.status === "active";
    if (tapis === "percubaan") return p.status === "probation";
    if (tapis === "belum") return !p.activated;
    return true;
  });
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
            <Link href="/pengurusan/pekerja/baru" aria-label="Tambah pekerja" className="mr-1 flex size-11 items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-white! lg:mr-0 lg:w-auto lg:px-4">
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span className="hidden lg:inline">Tambah pekerja</span>
            </Link>
          )
        }
      />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-6 lg:px-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="flex h-12 items-center gap-2.5 rounded-[14px] bg-surface px-3.5 lg:w-[360px]">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B6B68" strokeWidth="2" strokeLinecap="round">
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
        </div>

        {list.error && <ErrorBox message={list.error} />}
        {list.loading && !list.data && <Loading />}
        {list.data && tapisan.length === 0 && <span className="text-sm text-muted">Tiada pekerja sepadan.</span>}

        {tapisan.length > 0 && <JadualPekerja ppl={tapisan} />}

        {[...kumpulan.entries()].map(([jab, ppl]) => (
          <div key={jab} className="flex flex-col gap-1.5 lg:hidden">
            <Seksyen>{jab}</Seksyen>
            <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              {ppl.map((p, i) => (
                <Link key={p.id} href={`/pengurusan/pekerja/${p.id}`} className="flex min-h-12 items-center gap-3 py-2 text-ink!">
                  <span className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${AV[i % 3]}`}>{inisial(p.name)}</span>
                  <span className="flex grow flex-col gap-0.5">
                    <b className="text-sm font-bold">{p.name}</b>
                    <span className="text-xs text-muted">{[p.isHead ? "Ketua Jabatan" : p.position, p.employeeNo].filter(Boolean).join(" · ")}</span>
                  </span>
                  {!p.activated ? (
                    <Tag tone="neutral">Belum aktif</Tag>
                  ) : p.status === "probation" ? (
                    <Tag tone="warning">Percubaan</Tag>
                  ) : (
                    p.roles
                      .filter((r) => ["hr", "finance", "ceo", "admin"].includes(r))
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
function JadualPekerja({ ppl }: { ppl: PekerjaRingkas[] }) {
  const router = useRouter();
  return (
    <div className="hidden overflow-hidden rounded-card bg-surface lg:block">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[#EEF2F1] text-xs font-bold tracking-[0.03em] text-muted">
            <th className="px-4 py-3 font-bold">NAMA</th>
            <th className="px-4 py-3 font-bold">NO. PEKERJA</th>
            <th className="px-4 py-3 font-bold">JABATAN</th>
            <th className="px-4 py-3 font-bold">JAWATAN</th>
            <th className="px-4 py-3 font-bold">PERANAN</th>
            <th className="px-4 py-3 font-bold">STATUS</th>
          </tr>
        </thead>
        <tbody>
          {ppl.map((p, i) => (
            <tr key={p.id} onClick={() => router.push(`/pengurusan/pekerja/${p.id}`)} className="cursor-pointer border-b border-[#EEF2F1] last:border-0 hover:bg-[#F7F9F8]">
              <td className="px-4 py-2.5">
                <Link href={`/pengurusan/pekerja/${p.id}`} className="flex items-center gap-3 font-bold text-ink!">
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${AV[i % 3]}`}>{inisial(p.name)}</span>
                  {p.name}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-muted">{p.employeeNo}</td>
              <td className="px-4 py-2.5">{p.department ?? "—"}</td>
              <td className="px-4 py-2.5">{p.isHead ? "Ketua Jabatan" : (p.position ?? "—")}</td>
              <td className="px-4 py-2.5">
                <span className="flex flex-wrap gap-1">
                  {p.roles
                    .filter((r) => ["hr", "finance", "ceo", "admin"].includes(r))
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
  );
}
