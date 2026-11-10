"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getJabatan, getSenaraiPekerja, type PekerjaRingkas } from "@/lib/hr";
import { Avatar, ErrorBox, Loading, Screen } from "@/components/ui";
import { PengepalaAkar, TabNav } from "@/components/TabNav";
import { TabModul } from "@/components/TabModul";
import { HadPeranan } from "@/components/Senarai";

/** Carta organisasi: syarikat → pengurusan atasan (CEO) → jabatan (ketua & ahli). */
export default function CartaPage() {
  return (
    <HadPeranan roles={["hr", "ceo", "admin"]}>
      <Kandungan />
    </HadPeranan>
  );
}

function Kandungan() {
  const me = useMe();
  const emp = me.active!;
  const d = useData(async () => {
    const [jab, ppl] = await Promise.all([getJabatan(emp.companyId), getSenaraiPekerja(emp.companyId)]);
    return { jab, ppl: ppl.filter((p) => p.status === "active" || p.status === "probation") };
  }, [emp.companyId]);
  const [buka, setBuka] = useState<Record<string, boolean>>({});

  const ppl = d.data?.ppl ?? [];
  const ceo = ppl.filter((p) => p.roles.includes("ceo"));
  const kumpulan = (d.data?.jab ?? []).map((j) => {
    const ahli = ppl.filter((p) => p.departmentId === j.id);
    const ketua = ppl.find((p) => p.personId === j.headPersonId) ?? null;
    return { id: j.id, nama: j.name, ketua, ahli: ahli.filter((p) => p.personId !== j.headPersonId) };
  });
  const tanpa = ppl.filter((p) => !p.departmentId);
  if (tanpa.length) kumpulan.push({ id: "-", nama: tr("Tiada jabatan"), ketua: null, ahli: tanpa });

  return (
    <Screen lebar="lebar">
      <PengepalaAkar title={tr("Pekerja")} />
      <TabModul modul="pekerja" />
      <main className="flex grow flex-col gap-4 px-4 pt-3 pb-6 lg:px-0">
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data && <Loading />}
        {d.data && (
          <>
            <div className="flex flex-col items-center">
              <div className="flex flex-col items-center rounded-card bg-primary px-6 py-3 text-center text-white">
                <b className="text-sm font-extrabold">{emp.companyName}</b>
                <span className="text-xs opacity-80">{tr("{0} pekerja · {1} jabatan", ppl.length, d.data.jab.length)}</span>
              </div>
              {ceo.length > 0 && (
                <>
                  <span aria-hidden="true" className="h-5 w-0.5 bg-line" />
                  <div className="flex flex-wrap justify-center gap-2">
                    {ceo.map((p, i) => (
                      <Orang key={p.id} p={p} i={i} peranan={tr("CEO")} serlah />
                    ))}
                  </div>
                </>
              )}
              <span aria-hidden="true" className="h-5 w-0.5 bg-line" />
            </div>
            <div className="grid gap-3 border-t-2 border-line pt-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {kumpulan.map((k, gi) => {
                const semua = buka[k.id] ?? false;
                const papar = semua ? k.ahli : k.ahli.slice(0, 6);
                return (
                  <section key={k.id} className="flex flex-col gap-2 rounded-card bg-surface p-3">
                    <div className="flex items-baseline justify-between gap-2 px-1">
                      <h2 className="m-0 truncate text-sm font-extrabold">{k.nama}</h2>
                      <span className="shrink-0 text-xs text-muted">{tr("{0} orang", k.ahli.length + (k.ketua ? 1 : 0))}</span>
                    </div>
                    {k.ketua ? (
                      <Orang p={k.ketua} i={gi} peranan={tr("Ketua Jabatan")} serlah />
                    ) : (
                      k.id !== "-" && <span className="rounded-[12px] bg-warning-soft px-3 py-2 text-xs font-bold text-warning">{tr("Belum ada ketua jabatan")}</span>
                    )}
                    {papar.length > 0 && (
                      <div className="ml-4 flex flex-col border-l-2 border-line-soft pl-2">
                        {papar.map((p, i) => (
                          <Orang key={p.id} p={p} i={i + gi} />
                        ))}
                      </div>
                    )}
                    {k.ahli.length > 6 && (
                      <button type="button" onClick={() => setBuka((b) => ({ ...b, [k.id]: !semua }))} className="min-h-9 self-start px-1 text-[13px] font-bold text-primary">
                        {semua ? tr("Tunjuk kurang") : tr("Tunjuk semua ({0})", k.ahli.length)}</button>
                    )}
                  </section>
                );
              })}
            </div>
          </>
        )}
      </main>
      <TabNav />
    </Screen>
  );
}

function Orang({ p, i, peranan, serlah = false }: { p: PekerjaRingkas; i: number; peranan?: string; serlah?: boolean }) {
  return (
    <Link
      href={`/pengurusan/pekerja/${p.id}`}
      className={`flex min-h-12 items-center gap-2.5 rounded-[12px] px-2 py-1.5 text-ink! hover:bg-[#F2F5F4] ${serlah ? "bg-[#F2F7F6]" : ""}`}
    >
      <Avatar name={p.name} size={34} index={i} />
      <span className="flex min-w-0 flex-col leading-tight">
        <b className="truncate text-[13px]">{p.name}</b>
        <span className="truncate text-xs text-muted">{peranan ?? p.position ?? "–"}</span>
      </span>
    </Link>
  );
}
