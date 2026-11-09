"use client";

import Link from "next/link";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { ringgit, tarikh, tarikhTempatan, type StatusPermohonan } from "@/lib/format";
import { BULAN_PENUH } from "@/lib/gaji";
import { getPendahuluanHr, tandaPendahuluanDibayar } from "@/lib/urusan";
import { ErrorBox, Loading, Screen, StatusPill } from "@/components/ui";
import { PengepalaAkar } from "@/components/TabNav";
import { TabGaji } from "@/components/TabGaji";
import { HadPeranan } from "@/components/Senarai";
import { beritahu, sahkan } from "@/components/Dialog";

/** Pendahuluan gaji: bayar (Kewangan) dan ditolak secara automatik dalam Proses Gaji. */
export default function PendahuluanHrPage() {
  return (
    <HadPeranan roles={["hr", "finance", "admin"]}>
      <Kandungan />
    </HadPeranan>
  );
}

function Kandungan() {
  const me = useMe();
  const emp = me.active!;
  const d = useData(() => getPendahuluanHr(emp.companyId), [emp.companyId]);
  return (
    <Screen lebar="lebar">
      <PengepalaAkar title="Gaji" backHr="/pengurusan" />
      <TabGaji />
      <main className="flex grow flex-col gap-3 px-4 pt-4 pb-6 lg:px-0">
        <span className="text-sm leading-normal text-subtle">
          Pekerja memohon melalui Mohon → Pendahuluan gaji (jumlah bebas); diluluskan oleh CEO (aliran boleh diubah dalam Tetapan → Aliran Kelulusan). Selepas dibayar, jumlahnya ditolak secara automatik semasa{" "}
          <Link href="/pengurusan/gaji" className="font-bold">
            Proses Gaji
          </Link>{" "}
          bulan berikutnya.
        </span>
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data && <Loading />}
        {d.data && d.data.length === 0 && <div className="rounded-card bg-surface px-4 py-8 text-center text-sm text-muted">Tiada pendahuluan gaji yang aktif.</div>}
        {(d.data ?? []).length > 0 && (
          <div className="flex flex-col rounded-card bg-surface px-4 lg:px-5 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
            {(d.data ?? []).map((a) => (
              <div key={a.id} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 text-sm">
                <span className="flex min-w-0 grow basis-60 flex-col gap-0.5">
                  <b className="font-bold">
                    <Link href={`/pengurusan/pekerja/${a.employment_id}`} className="text-ink!">
                      {a.name}
                    </Link>{" "}
                    · {ringgit(Number(a.amount))}
                  </b>
                  <span className="text-xs text-muted">
                    {a.reason} · {tarikh(tarikhTempatan(a.created_at))}
                    {a.deduct_month ? ` · tolak gaji ${BULAN_PENUH[a.deduct_month - 1]} ${a.deduct_year}` : ""}
                    {a.deducted ? " (dalam larian gaji)" : ""}
                  </span>
                </span>
                <StatusPill status={a.status as StatusPermohonan} />
                {a.status === "approved" &&
                  (a.disbursed_at ? (
                    <span className="text-xs font-bold text-success">Dibayar {tarikh(tarikhTempatan(a.disbursed_at))}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!(await sahkan({ tajuk: `Tandakan ${ringgit(Number(a.amount))} telah dibayar kepada ${a.name}?`, ok: "Tandakan dibayar" }))) return;
                        try {
                          await tandaPendahuluanDibayar(a.id);
                          beritahu("Ditandakan dibayar; pekerja dimaklumkan.");
                          d.reload();
                        } catch (e) {
                          beritahu(e instanceof Error ? e.message : "Ralat", "ralat");
                        }
                      }}
                      className="flex h-9 items-center rounded-full bg-primary px-4 text-xs font-bold text-white"
                    >
                      Tandakan dibayar
                    </button>
                  ))}
              </div>
            ))}
          </div>
        )}
      </main>
    </Screen>
  );
}
