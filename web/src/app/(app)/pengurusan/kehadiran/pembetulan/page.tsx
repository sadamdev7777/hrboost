"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { hariTarikh, jam } from "@/lib/format";
import { getKehadiranHari } from "@/lib/modul";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { PengepalaAkar, TabNav } from "@/components/TabNav";
import { TabModul } from "@/components/TabModul";
import { HadPeranan } from "@/components/Senarai";
import { Kosong } from "@/components/Modul";

/** Permohonan pembetulan masa yang menunggu kelulusan (semua pekerja). */
export default function PembetulanHrPage() {
  return (
    <HadPeranan roles={["hr", "ceo", "admin"]}>
      <Kandungan />
    </HadPeranan>
  );
}

function Kandungan() {
  const me = useMe();
  const emp = me.active!;
  const d = useData(() => getKehadiranHari(emp.companyId), [emp.companyId]);
  const senarai = d.data?.corrections ?? [];
  return (
    <Screen lebar="lebar">
      <PengepalaAkar title={tr("Kehadiran")} />
      <TabModul modul="kehadiran" />
      <main className="flex grow flex-col gap-3 px-4 pt-3 pb-6 lg:px-0">
        <span className="text-sm text-subtle">
          {tr("Pekerja yang terlupa mengimbas atau mesin bermasalah memohon pembetulan masa. Kelulusan mengikut aliran kelulusan syarikat.")}</span>
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data && <Loading />}
        {d.data && (
          <div className="flex flex-col rounded-card bg-surface px-4 lg:px-5 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
            {senarai.length === 0 ? (
              <Kosong>{tr("Tiada pembetulan masa yang menunggu kelulusan.")}</Kosong>
            ) : (
              senarai.map((c) => (
                <Link key={c.id} href={c.approval_request_id ? `/kelulusan/${c.approval_request_id}` : `/pengurusan/pekerja/${c.employment_id}`} className="flex min-h-[56px] flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm text-ink! hover:bg-[#F7F9F8]">
                  <span className="flex min-w-0 grow basis-60 flex-col">
                    <b>{c.name}</b>
                    <span className="text-xs text-muted">{c.reason}</span>
                  </span>
                  <span className="text-[13px] font-semibold">{hariTarikh(c.work_date)}</span>
                  <span className="text-[13px] text-subtle">
                    {tr("Masuk {0} · Keluar {1}", c.requested_clock_in ? jam(c.requested_clock_in) : "–", c.requested_clock_out ? jam(c.requested_clock_out) : "–")}</span>
                  <span className="text-[13px] font-bold text-primary">{tr("Semak ›")}</span>
                </Link>
              ))
            )}
          </div>
        )}
      </main>
      <TabNav />
    </Screen>
  );
}
