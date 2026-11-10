"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useState } from "react";
import { hasRole, useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { addDays, tarikh, tarikhTempatan, todayISO } from "@/lib/format";
import { jemputPekerja } from "@/lib/hr";
import { LANGKAH } from "@/lib/onboarding";
import { getOrientasiHr, type PekerjaBaharu } from "@/lib/modul";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { PengepalaAkar, TabNav } from "@/components/TabNav";
import { HadPeranan, Tag } from "@/components/Senarai";
import { BarisStat, Jadual, KadStat, Kosong } from "@/components/Modul";
import { beritahu } from "@/components/Dialog";

type Tapis = "semua" | "belum_aktif" | "orientasi" | "percubaan";

/** Modul Orientasi (HR): pekerja baharu, jemputan, kemajuan orientasi, senarai semak dan percubaan. */
export default function OrientasiHrPage() {
  return (
    <HadPeranan roles={["hr", "ceo", "admin"]}>
      <Kandungan />
    </HadPeranan>
  );
}

function Kandungan() {
  const me = useMe();
  const emp = me.active!;
  const d = useData(() => getOrientasiHr(emp.companyId), [emp.companyId]);
  const [tapis, setTapis] = useState<Tapis>("semua");
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [ralat, setRalat] = useState<string | null>(null);
  const hari = todayISO();
  const semua = d.data ?? [];
  const belumAktif = semua.filter((p) => !p.activated);
  const orientasi = semua.filter((p) => p.activated && p.steps_done < LANGKAH.length);
  const percubaan = semua.filter((p) => p.status === "probation");
  const tamatHampir = percubaan.filter((p) => p.probation_end_date && p.probation_end_date <= addDays(hari, 30));
  const papar = tapis === "belum_aktif" ? belumAktif : tapis === "orientasi" ? orientasi : tapis === "percubaan" ? percubaan : semua;
  const bolehJemput = hasRole(me, ["hr", "admin"]);

  async function jemput(p: PekerjaBaharu) {
    setSibuk(p.employment_id);
    setRalat(null);
    try {
      await jemputPekerja(p.employment_id);
      beritahu(tr("Jemputan dihantar kepada {0} melalui WhatsApp.", p.name));
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    } finally {
      setSibuk(null);
    }
  }

  return (
    <Screen lebar="lebar">
      <PengepalaAkar
        title={tr("Orientasi")}
        action={
          bolehJemput ? (
            <Link href="/pengurusan/pekerja/baru" className="flex h-11 items-center rounded-full bg-primary px-4 text-sm font-bold whitespace-nowrap text-white!">
              {tr("+ Tambah pekerja")}</Link>
          ) : undefined
        }
      />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-6 lg:px-0">
        <span className="text-sm text-subtle">
          {tr("Pekerja baharu (90 hari), dalam tempoh percubaan atau belum mengaktifkan akaun. Pekerja melengkapkan {0} langkah orientasi di telefon selepas menerima jemputan WhatsApp.", LANGKAH.length)}</span>
        {d.error && <ErrorBox message={d.error} />}
        {ralat && <ErrorBox message={ralat} />}
        {d.loading && !d.data && <Loading />}
        {d.data && (
          <>
            <BarisStat>
              <KadStat label={tr("Pekerja baharu & percubaan")} nilai={semua.length} onClick={() => setTapis("semua")} aktif={tapis === "semua"} />
              <KadStat label={tr("Belum aktifkan akaun")} nilai={belumAktif.length} tone={belumAktif.length ? "danger" : undefined} onClick={() => setTapis("belum_aktif")} aktif={tapis === "belum_aktif"} />
              <KadStat label={tr("Orientasi belum lengkap")} nilai={orientasi.length} tone={orientasi.length ? "warning" : undefined} onClick={() => setTapis("orientasi")} aktif={tapis === "orientasi"} />
              <KadStat
                label={tr("Dalam percubaan")}
                nilai={percubaan.length}
                kecil={tamatHampir.length ? tr("{0} tamat dalam 30 hari", tamatHampir.length) : undefined}
                tone={tamatHampir.length ? "warning" : undefined}
                onClick={() => setTapis("percubaan")}
                aktif={tapis === "percubaan"}
              />
            </BarisStat>
            {papar.length === 0 ? (
              <div className="rounded-card bg-surface px-4">
                <Kosong>{tr("Tiada pekerja dalam kategori ini.")}</Kosong>
              </div>
            ) : (
              <Jadual kepala={[tr("PEKERJA"), tr("MULA"), tr("AKAUN"), tr("ORIENTASI"), tr("SENARAI SEMAK"), tr("PERCUBAAN")]}>
                {papar.map((p) => (
                  <tr key={p.employment_id}>
                    <td>
                      <Link href={`/pengurusan/pekerja/${p.employment_id}`} className="flex flex-col text-ink!">
                        <b>{p.name}</b>
                        <span className="text-xs text-muted">{[p.position, p.department].filter(Boolean).join(" · ")}</span>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap text-subtle">{tarikh(p.join_date)}</td>
                    <td>
                      {p.activated ? (
                        <Tag tone="success">{tr("Aktif")}</Tag>
                      ) : (
                        <span className="flex flex-col items-start gap-1">
                          <Tag tone="danger">{p.invite_sent_at ? tr("Dijemput {0}", tarikh(tarikhTempatan(p.invite_sent_at))) : tr("Belum dijemput")}</Tag>
                          {bolehJemput && (
                            <button type="button" disabled={sibuk === p.employment_id} onClick={() => jemput(p)} className="min-h-8 text-[13px] font-bold whitespace-nowrap text-primary disabled:opacity-50">
                              {p.invite_sent_at ? tr("Hantar semula") : tr("Hantar jemputan")}</button>
                          )}
                        </span>
                      )}
                    </td>
                    <td>
                      <Kemajuan n={p.steps_done} daripada={LANGKAH.length} />
                    </td>
                    <td>{p.checklist_total ? <Kemajuan n={p.checklist_done} daripada={p.checklist_total} /> : <span className="text-muted">–</span>}</td>
                    <td className="text-[13px]">
                      {p.status === "probation" ? (
                        <span className="flex flex-col">
                          <span className={p.probation_end_date && p.probation_end_date <= addDays(hari, 30) ? "font-bold text-warning" : ""}>
                            {p.probation_end_date ? tr("Tamat {0}", tarikh(p.probation_end_date)) : tr("Tarikh tamat belum ditetapkan")}</span>
                          <span className="text-xs text-muted">
                            {p.review?.hr_decision ? tr("Keputusan dibuat") : p.review?.submitted_at ? tr("Penilaian dihantar") : tr("Belum dinilai")}</span>
                        </span>
                      ) : (
                        <span className="text-muted">{tr("Disahkan")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </Jadual>
            )}
          </>
        )}
      </main>
      <TabNav />
    </Screen>
  );
}

function Kemajuan({ n, daripada }: { n: number; daripada: number }) {
  const siap = n >= daripada;
  return (
    <span className="flex min-w-[90px] flex-col gap-1">
      <span className={`text-xs font-bold ${siap ? "text-success" : "text-subtle"}`}>{siap ? tr("Selesai") : `${n}/${daripada}`}</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-[#E4EAE8]">
        <span className={`block h-full rounded-full ${siap ? "bg-success" : "bg-primary"}`} style={{ width: `${Math.min(100, (n / Math.max(1, daripada)) * 100)}%` }} />
      </span>
    </span>
  );
}
