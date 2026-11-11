"use client";

import { tr } from "@/lib/i18n";
import { TabModul } from "@/components/TabModul";
import Link from "next/link";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getJabatan, getSenaraiPekerja, type Jabatan } from "@/lib/hr";
import { inisial } from "@/lib/format";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { PengepalaAkar } from "@/components/TabNav";
import { HadPeranan } from "@/components/Senarai";
import { BorangJabatan, PilihKetua, padamJabatan } from "@/components/Jabatan";

export default function JabatanTetapanPage() {
  return (
    <HadPeranan roles={["hr", "admin"]} back="/pengurusan/tetapan">
      <SenaraiJabatan />
    </HadPeranan>
  );
}

function SenaraiJabatan() {
  const me = useMe();
  const cid = me.active!.companyId;
  const d = useData(async () => {
    const [jab, ppl] = await Promise.all([getJabatan(cid), getSenaraiPekerja(cid)]);
    return { jab, ppl };
  }, [cid]);
  const [baru, setBaru] = useState(false);
  const [nama, setNama] = useState<Jabatan | null>(null);
  const [ketua, setKetua] = useState<Jabatan | null>(null);
  const [ralat, setRalat] = useState<string | null>(null);
  const [padam, setPadam] = useState<string | null>(null);

  const kira = (id: string) => (d.data?.ppl ?? []).filter((p) => p.departmentId === id).length;
  const tanpaJabatan = (d.data?.ppl ?? []).filter((p) => !p.departmentId).length;

  async function buang(j: Jabatan) {
    if (padam !== j.id) return setPadam(j.id);
    setRalat(await padamJabatan(j.id));
    setPadam(null);
    d.reload();
  }

  const selesai = () => {
    setBaru(false);
    setNama(null);
    setKetua(null);
    d.reload();
  };

  return (
    <Screen lebar="lebar">
      <PengepalaAkar
        title={tr("Pekerja")}
        back="/pengurusan"
        action={
          <button type="button" onClick={() => setBaru(true)} className="flex h-10 items-center rounded-full bg-primary px-4 text-[13px] font-bold text-white">
            {tr("+ Tambah jabatan")}
          </button>
        }
      />
      <TabModul modul="pekerja" />
      <main className="flex grow flex-col gap-3 px-4 pt-3 pb-6 lg:px-0">
        <span className="text-sm leading-normal text-subtle">
          {tr("Ketua jabatan menjadi pelulus pertama bagi pasukannya. Untuk memindahkan pekerja ke jabatan lain, buka profil pekerja → Ubah gaji & jawatan.")}
        </span>
        {d.error && <ErrorBox message={d.error} />}
        {ralat && <ErrorBox message={ralat} />}
        {d.loading && !d.data && <Loading />}
        {d.data && (
          <>
            <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              {d.data.jab.length === 0 && <span className="py-4 text-sm text-muted">{tr("Belum ada jabatan. Tekan “+ Tambah jabatan”.")}</span>}
              {d.data.jab.map((j) => {
                const n = kira(j.id);
                return (
                  <div key={j.id} className="flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 py-3">
                    <span className="flex min-w-0 grow basis-40 flex-col gap-0.5">
                      <b className="text-sm font-bold">{j.name}</b>
                      <span className={`text-xs ${!j.headPersonId && n ? "text-warning" : "text-muted"}`}>{tr("{0} pekerja{1}", n, !j.headPersonId && n ? tr(" · tiada ketua") : "")}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setKetua(j)}
                      className={`flex h-10 items-center gap-2 rounded-full pr-3 pl-1 text-[13px] font-bold ${j.headPersonId ? "bg-[#E3F1EE] text-primary" : "border border-warning px-3 text-warning"}`}
                    >
                      {j.headPersonId ? (
                        <>
                          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs text-white">{inisial(j.headName ?? "")}</span>
                          {j.headPersonId === me.personId ? tr("Anda") : j.headName}
                        </>
                      ) : (
                        tr("Pilih ketua")
                      )}
                    </button>
                    <span className="flex basis-full gap-1 sm:basis-auto">
                      <button type="button" onClick={() => setNama(j)} className="-ml-2.5 flex h-10 items-center px-2.5 text-[13px] font-bold text-primary sm:ml-0">
                        {tr("Namakan semula")}
                      </button>
                      {n === 0 && (
                        <button type="button" onClick={() => buang(j)} className="flex h-10 items-center px-2.5 text-[13px] font-bold text-danger">
                          {padam === j.id ? tr("Sahkan padam") : tr("Padam")}
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
            {tanpaJabatan > 0 && (
              <div className="flex items-center justify-between gap-2 rounded-[14px] bg-warning-soft px-4 py-3 text-[13px] text-warning">
                <span>{tr("{0} pekerja belum mempunyai jabatan.", tanpaJabatan)}</span>
                <Link href="/pengurusan/pekerja" className="font-bold text-warning!">
                  {tr("Lihat pekerja")}
                </Link>
              </div>
            )}
          </>
        )}
      </main>
      {baru && <BorangJabatan cid={cid} onClose={() => setBaru(false)} onDone={selesai} />}
      {nama && <BorangJabatan cid={cid} jabatan={nama} onClose={() => setNama(null)} onDone={selesai} />}
      {ketua && d.data && <PilihKetua jabatan={ketua} ppl={d.data.ppl} onClose={() => setKetua(null)} onDone={selesai} />}
    </Screen>
  );
}
