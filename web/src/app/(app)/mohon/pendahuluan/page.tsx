"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { ringgit, tarikh, tarikhTempatan, type StatusPermohonan } from "@/lib/format";
import { BULAN_PENUH } from "@/lib/gaji";
import { getPendahuluanSaya, mohonPendahuluan } from "@/lib/urusan";
import { BackHeader, ErrorBox, Loading, Screen, StatusPill } from "@/components/ui";
import { ButangUtama, MedanBorang, Seksyen, inputKecil } from "@/components/Senarai";
import { beritahu } from "@/components/Dialog";

/** Pendahuluan gaji: diluluskan ketua & Kewangan, ditolak daripada gaji bulan berikutnya. */
export default function PendahuluanPage() {
  const me = useMe();
  const emp = me.active!;
  const router = useRouter();
  const d = useData(() => getPendahuluanSaya(emp.id), [emp.id]);
  const [jumlah, setJumlah] = useState("");
  const [sebab, setSebab] = useState("");
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const senarai = (d.data ?? []).filter((x) => x.id);

  async function hantar() {
    const n = Number(jumlah);
    if (!(n > 0)) return setRalat("Sila masukkan jumlah.");
    if (n > 1000000) return setRalat("Jumlah tidak sah.");
    if (!sebab.trim()) return setRalat("Sila nyatakan sebab.");
    setBusy(true);
    setRalat(null);
    try {
      const a = (await mohonPendahuluan(emp.id, n, sebab.trim())) as { approval_request_id?: string };
      beritahu("Permohonan pendahuluan gaji dihantar.");
      router.push(a.approval_request_id ? `/permohonan/${a.approval_request_id}` : "/permohonan");
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
      setBusy(false);
    }
  }

  return (
    <Screen lebar="sederhana">
      <BackHeader title="Pendahuluan gaji" href="/mohon" />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-6">
        {d.loading && !d.data && <Loading />}
        {d.error && <ErrorBox message={d.error} />}
        {d.data && (
          <>
            <span className="text-sm leading-snug text-subtle">Masukkan jumlah yang diperlukan. Permohonan diluluskan oleh CEO, dan jumlahnya ditolak sepenuhnya daripada gaji bulan berikutnya.</span>
            <MedanBorang label="Jumlah (RM)">
              <input className={inputKecil} inputMode="decimal" value={jumlah} onChange={(e) => setJumlah(e.target.value.replace(/[^\d.]/g, ""))} aria-label="Jumlah" />
            </MedanBorang>
            <MedanBorang label="Sebab">
              <input className={inputKecil} value={sebab} onChange={(e) => setSebab(e.target.value)} placeholder="Contoh: Kecemasan keluarga" />
            </MedanBorang>
            {ralat && <ErrorBox message={ralat} />}
            <ButangUtama onClick={hantar} busy={busy}>
              Hantar permohonan
            </ButangUtama>
          </>
        )}
        {senarai.length > 0 && (
          <>
            <Seksyen className="pt-2">PERMOHONAN TERDAHULU</Seksyen>
            <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              {senarai.map((x) => (
                <Link key={x.id} href={x.approval_request_id ? `/permohonan/${x.approval_request_id}` : "#"} className="flex min-h-12 items-center gap-3 py-2 text-sm text-ink!">
                  <span className="flex grow flex-col gap-0.5">
                    <b className="font-bold">{ringgit(Number(x.amount))}</b>
                    <span className="text-xs text-muted">
                      {tarikh(tarikhTempatan(x.created_at!))}
                      {x.deduct_month ? ` · ${x.deducted ? "telah ditolak" : "akan ditolak"} daripada gaji ${BULAN_PENUH[x.deduct_month - 1]} ${x.deduct_year}` : ""}
                    </span>
                  </span>
                  <StatusPill status={x.status as StatusPermohonan} />
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </Screen>
  );
}
