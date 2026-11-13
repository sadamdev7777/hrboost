"use client";

import { tr } from "@/lib/i18n";
import { TabModul } from "@/components/TabModul";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { tarikh, tarikhTempatan } from "@/lib/format";
import { getSurat, keluarkanSurat, LABEL_SURAT, STATUS_SURAT, tolakSurat } from "@/lib/urusan";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { PengepalaAkar, TabNav } from "@/components/TabNav";
import { HadPeranan, Tag } from "@/components/Senarai";
import { beritahu, mintaTeks, sahkan } from "@/components/Dialog";

/** Permohonan surat daripada pekerja: keluarkan (surat dijana automatik) atau tolak. */
export default function SuratHrPage() {
  return (
    <HadPeranan roles={["hr", "admin"]}>
      <Kandungan />
    </HadPeranan>
  );
}

function Kandungan() {
  const me = useMe();
  const emp = me.active!;
  const router = useRouter();
  const d = useData(() => getSurat(emp.companyId), [emp.companyId]);
  const [tapis, setTapis] = useState<"pending" | "semua">("pending");
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [ralat, setRalat] = useState<string | null>(null);
  const semua = d.data ?? [];
  const senarai = tapis === "pending" ? semua.filter((s) => s.status === "pending") : semua;
  const menunggu = semua.filter((s) => s.status === "pending").length;

  async function keluar(id: string, nama: string, jenis: string) {
    if (!(await sahkan({ tajuk: tr("Keluarkan {0} untuk {1}?", jenis.toLowerCase(), nama), mesej: tr("Surat dijana dengan nama anda sebagai penandatangan. Pekerja dimaklumkan."), ok: tr("Keluarkan surat") }))) return;
    setSibuk(id);
    setRalat(null);
    try {
      const ruj = await keluarkanSurat(id);
      beritahu(tr("Surat {0} dikeluarkan.", ruj));
      router.push(`/surat/${id}`);
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
      setSibuk(null);
    }
  }
  async function tolak(id: string) {
    const sebab = await mintaTeks({ tajuk: tr("Tolak permohonan surat"), label: tr("Sebab (dihantar kepada pekerja)"), ok: tr("Tolak"), bahaya: true });
    if (!sebab) return;
    try {
      await tolakSurat(id, sebab);
      beritahu(tr("Permohonan ditolak."));
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
  }

  return (
    <Screen lebar="lebar">
      <PengepalaAkar title={tr("Peti HR")} />
      <TabModul modul="peti" />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-6 lg:px-0">
        <span className="text-sm leading-normal text-subtle">
          {tr("Pekerja memohon surat pengesahan melalui Mohon → Surat. Surat dijana daripada rekod pekerja dan boleh disimpan sebagai PDF. Alamat syarikat pada kepala surat diubah di")}{" "}
          <Link href="/pengurusan/tetapan/syarikat" className="font-bold">
            {tr("Tetapan → Syarikat")}</Link>
          .
        </span>
        <div className="flex gap-2">
          {(
            [
              ["pending", tr("Menunggu ({0})", menunggu)],
              ["semua", tr("Semua")],
            ] as const
          ).map(([k, t]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTapis(k)}
              className={`flex h-9 items-center rounded-full px-4 text-[13px] font-bold ${tapis === k ? "bg-primary text-white" : "border border-line bg-surface"}`}
            >
              {t}
            </button>
          ))}
        </div>
        {d.error && <ErrorBox message={d.error} />}
        {ralat && <ErrorBox message={ralat} />}
        {d.loading && !d.data && <Loading />}
        {d.data && senarai.length === 0 && <div className="rounded-card bg-surface px-4 py-8 text-center text-sm text-muted">{tr("Tiada permohonan surat {0}.", tapis === "pending" ? tr("yang menunggu") : "")}</div>}
        {senarai.length > 0 && (
          <div className="flex flex-col rounded-card bg-surface px-4 lg:px-5 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
            {senarai.map((s) => (
              <div key={s.id} className="flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 py-3 text-sm">
                <span className="flex min-w-0 grow basis-64 flex-col gap-0.5">
                  <b className="font-bold">
                    <Link href={`/pengurusan/pekerja/${s.employment_id}`} className="text-ink!">
                      {s.name}
                    </Link>{" "}
                    <span className="font-semibold text-muted">· {s.employee_no}</span>
                  </b>
                  <span className="text-[13px]">{LABEL_SURAT[s.kind]}</span>
                  <span className="text-xs text-muted">
                    {s.purpose}
                    {s.addressed_to ? tr(" · kepada {0}", s.addressed_to) : ""} · {tarikh(tarikhTempatan(s.created_at))}
                    {s.ref_no ? ` · ${s.ref_no}` : ""}
                  </span>
                </span>
                <Tag tone={STATUS_SURAT[s.status].tone}>{STATUS_SURAT[s.status].label}</Tag>
                {s.status === "pending" && (
                  <span className="flex gap-2">
                    <button type="button" onClick={() => tolak(s.id)} className="flex h-10 items-center rounded-full border border-line px-4 text-[13px] font-bold text-danger">
                      {tr("Tolak")}</button>
                    <button
                      type="button"
                      disabled={sibuk === s.id}
                      onClick={() => keluar(s.id, s.name, LABEL_SURAT[s.kind])}
                      className="flex h-10 items-center rounded-full bg-primary px-4 text-[13px] font-bold text-white disabled:opacity-60"
                    >
                      {sibuk === s.id ? "…" : tr("Keluarkan")}
                    </button>
                  </span>
                )}
                {s.status === "issued" && (
                  <Link href={`/surat/${s.id}`} className="flex h-10 items-center rounded-full border border-line px-4 text-[13px] font-bold">
                    {tr("Lihat surat")}</Link>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      <TabNav />
    </Screen>
  );
}
