"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { jam } from "@/lib/format";
import { daftarKehadiran, dapatkanLokasi, getKehadiranHariIni, jarakTeks, type HasilDaftar, type Lokasi } from "@/lib/kehadiranGps";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { ButangUtama, Tag } from "@/components/Senarai";

/** Daftar masuk / keluar melalui telefon: lokasi GPS + swafoto (satu skrin, satu tugas). */
export default function DaftarKehadiranPage() {
  const me = useMe();
  const emp = me.active!;
  const hariIni = useData(() => getKehadiranHariIni(emp.id), [emp.id]);
  const input = useRef<HTMLInputElement>(null);
  const [lokasi, setLokasi] = useState<Lokasi | null>(null);
  const [cariLokasi, setCariLokasi] = useState(true);
  const [ralatLokasi, setRalatLokasi] = useState<string | null>(null);
  const [swafoto, setSwafoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const [hasil, setHasil] = useState<HasilDaftar | null>(null);

  const punches = hariIni.data?.punches ?? [];
  const jenis: "in" | "out" = punches.length ? "out" : "in";

  async function ambilLokasi() {
    setCariLokasi(true);
    setRalatLokasi(null);
    try {
      setLokasi(await dapatkanLokasi());
    } catch (e) {
      setRalatLokasi((e as Error).message);
    }
    setCariLokasi(false);
  }

  // Cari lokasi sebaik skrin dibuka
  useEffect(() => {
    let batal = false;
    dapatkanLokasi()
      .then((l) => !batal && setLokasi(l))
      .catch((e: Error) => !batal && setRalatLokasi(e.message))
      .finally(() => !batal && setCariLokasi(false));
    return () => {
      batal = true;
    };
  }, []);

  const pratonton = useMemo(() => (swafoto ? URL.createObjectURL(swafoto) : null), [swafoto]);
  useEffect(() => () => {
    if (pratonton) URL.revokeObjectURL(pratonton);
  }, [pratonton]);

  async function hantar() {
    if (!lokasi || !swafoto) return;
    setBusy(true);
    setRalat(null);
    try {
      setHasil(await daftarKehadiran(me.personId, emp.id, jenis, lokasi, swafoto));
      hariIni.reload();
    } catch (e) {
      setRalat((e as Error).message);
    }
    setBusy(false);
  }

  const tajuk = jenis === "in" ? tr("Daftar masuk") : tr("Daftar keluar");

  if (hasil)
    return (
      <Screen>
        <BackHeader title={hasil.kind === "in" ? tr("Daftar masuk") : tr("Daftar keluar")} href="/utama" />
        <main className="flex grow flex-col gap-4 px-4 pt-4 pb-6">
          <section aria-label={tr("Keputusan")} className="flex flex-col items-center gap-2 rounded-card bg-surface px-4 py-6 text-center">
            <span className="text-sm font-bold text-muted">{hasil.kind === "in" ? tr("Daftar masuk direkod") : tr("Daftar keluar direkod")}</span>
            <b className="text-[34px] font-extrabold">{jam(hasil.punched_at)}</b>
            {hasil.outside ? (
              <div className="flex flex-col items-center gap-1">
                <Tag tone="warning">{tr("Luar lokasi")}</Tag>
                <span className="text-[13px] text-subtle">
                  {hasil.location_name
                    ? tr("Kira-kira {0} dari {1}. HR akan nampak lokasi ini.", jarakTeks(hasil.distance_m), hasil.location_name)
                    : tr("Tiada lokasi pejabat didaftarkan. HR akan nampak lokasi ini.")}
                </span>
              </div>
            ) : (
              <span className="text-[13px] text-success">{tr("Di {0}", hasil.location_name ?? "")}</span>
            )}
          </section>
          <Link href="/utama" className="flex h-12 items-center justify-center rounded-button bg-primary text-base font-extrabold text-white!">
            {tr("Selesai")}
          </Link>
          <Link href="/kehadiran" className="flex min-h-11 items-center justify-center text-sm font-bold">
            {tr("Lihat kehadiran saya")}
          </Link>
        </main>
      </Screen>
    );

  return (
    <Screen>
      <BackHeader title={tajuk} href="/utama" />
      <main className="flex grow flex-col gap-3 px-4 pt-2 pb-4">
        {hariIni.loading && !hariIni.data && <Loading />}
        {hariIni.error && <ErrorBox message={hariIni.error} />}
        {hariIni.data && !hariIni.data.enabled && (
          <div className="rounded-card bg-surface px-4 py-4 text-sm text-subtle">{tr("Daftar masuk melalui telefon tidak diaktifkan oleh syarikat anda.")}</div>
        )}
        {hariIni.data?.enabled && (
          <>
            {punches.length > 0 && (
              <div className="rounded-card bg-surface px-4 py-3 text-[13px] text-subtle">
                {tr("Daftar masuk hari ini: {0}", jam(punches[0].punched_at))}
                {punches.length > 1 && ` · ${tr("Terakhir: {0}", jam(punches[punches.length - 1].punched_at))}`}
              </div>
            )}

            <section aria-label={tr("Lokasi")} className="flex flex-col gap-1.5 rounded-card bg-surface px-4 py-3.5">
              <b className="text-sm">{tr("1. Lokasi")}</b>
              {cariLokasi ? (
                <span className="text-[13px] text-muted">{tr("Mengesan lokasi…")}</span>
              ) : lokasi ? (
                <span className="text-[13px] text-success">{tr("Lokasi dikesan (ketepatan ±{0})", jarakTeks(lokasi.accuracy))}</span>
              ) : (
                <>
                  {ralatLokasi && <span className="text-[13px] text-danger">{ralatLokasi}</span>}
                  <button type="button" onClick={ambilLokasi} className="h-11 self-start rounded-xl border border-line px-4 text-sm font-bold text-primary">
                    {tr("Cuba lagi")}
                  </button>
                </>
              )}
            </section>

            <section aria-label={tr("Swafoto")} className="flex flex-col gap-2 rounded-card bg-surface px-4 py-3.5">
              <b className="text-sm">{tr("2. Swafoto")}</b>
              <input
                ref={input}
                type="file"
                accept="image/*"
                capture="user"
                aria-label={tr("Ambil swafoto")}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setSwafoto(f);
                  e.target.value = "";
                }}
              />
              {pratonton ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- pratonton fail tempatan (blob:) */}
                  <img src={pratonton} alt={tr("Swafoto yang diambil")} className="size-20 rounded-full object-cover" />
                  <button type="button" onClick={() => input.current?.click()} className="h-11 rounded-xl border border-line px-4 text-sm font-bold text-primary">
                    {tr("Ambil semula")}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => input.current?.click()} className="h-12 rounded-xl border-[1.5px] border-dashed border-primary text-sm font-bold text-primary">
                  {tr("Ambil swafoto")}
                </button>
              )}
              <span className="text-xs text-muted">{tr("Swafoto wajib untuk mengesahkan kehadiran anda sendiri.")}</span>
            </section>

            {ralat && <ErrorBox message={ralat} />}
          </>
        )}
      </main>
      {hariIni.data?.enabled && (
        <div className="bar-bawah sticky bottom-0 flex flex-col gap-2 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
          <ButangUtama onClick={hantar} busy={busy} disabled={!lokasi || !swafoto}>
            {busy ? tr("Menghantar…") : tajuk}
          </ButangUtama>
          <span className="text-center text-xs text-muted">{tr("Masa direkod mengikut masa pelayan HRBoost.")}</span>
        </div>
      )}
    </Screen>
  );
}
