"use client";

import { tr, trRalat } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { aktifkanPush, dipasang, keadaanPush, matikanPush, segerakPush, type KeadaanPush } from "@/lib/push";
import { useSkrinLebar } from "@/lib/skrin";
import { beritahu } from "@/components/Dialog";

/** Saya → Notifikasi telefon: hidup / matikan untuk peranti ini, dengan status yang jelas. */
export function NotifikasiTelefon() {
  const [k, setK] = useState<KeadaanPush | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const muat = () => keadaanPush().then(setK).catch(() => setK(null));
  useEffect(() => {
    void muat();
  }, []);

  async function tukar() {
    if (!k) return;
    setSibuk(true);
    try {
      if (k.aktif) {
        await matikanPush();
      } else {
        const ok = await aktifkanPush();
        if (ok) beritahu(tr("Notifikasi telefon dihidupkan untuk peranti ini."));
      }
    } catch (e) {
      beritahu(e instanceof Error ? trRalat(e.message) : tr("Ralat"), "ralat");
    }
    await muat();
    setSibuk(false);
  }

  const status = !k
    ? ""
    : k.iosPerluPasang
      ? tr("iPhone: tambah HRBoost ke Skrin Utama dahulu (Kongsi → Tambah ke Skrin Utama), kemudian buka dari ikon itu.")
      : !k.sokong
        ? tr("Pelayar ini tidak menyokong notifikasi telefon.")
        : k.kebenaran === "denied"
          ? tr("Notifikasi disekat. Benarkan dalam tetapan pelayar / telefon untuk HRBoost.")
          : k.aktif
            ? tr("Hidup untuk peranti ini — kelulusan, cuti dan pengumuman muncul di skrin telefon.")
            : tr("Terima makluman kelulusan, cuti dan pengumuman terus di skrin telefon.");
  const boleh = !!k && k.sokong && !k.iosPerluPasang && k.kebenaran !== "denied" && (k.tersedia || k.aktif);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-surface px-4 py-3 lg:grow">
      <span className="flex min-w-0 grow basis-56 flex-col">
        <b className="text-sm font-bold">{tr("Notifikasi telefon")}</b>
        <span className="text-xs text-muted">{status}</span>
      </span>
      {boleh && (
        <button
          type="button"
          role="switch"
          aria-checked={k!.aktif}
          aria-label={tr("Notifikasi telefon")}
          disabled={sibuk}
          onClick={tukar}
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-60 ${k!.aktif ? "bg-primary" : "bg-[#D5DEDC]"}`}
        >
          <span className={`absolute top-1 left-1 size-6 rounded-full bg-white shadow transition-transform ${k!.aktif ? "translate-x-6" : ""}`} />
        </button>
      )}
    </div>
  );
}

const KUNCI_TOLAK = "hrb_notif_tolak";

/**
 * Cadangan sekali "Hidupkan notifikasi telefon?" di Utama / Papan Pemuka apabila aplikasi telah dipasang
 * (atau di komputer), kebenaran belum ditanya dan peranti belum dilanggan. Disorok 30 hari jika "Nanti".
 * Turut menyegerakkan langganan peranti dengan pengguna yang sedang log masuk.
 */
export function CadanganNotifikasi() {
  const path = usePathname();
  const lebar = useSkrinLebar();
  const [k, setK] = useState<KeadaanPush | null>(null);
  const [tutup, setTutup] = useState(false);
  const [sibuk, setSibuk] = useState(false);

  const [ditolak, setDitolak] = useState(true);
  useEffect(() => {
    void segerakPush()
      .then(() => keadaanPush())
      .then((x) => {
        try {
          setDitolak(Date.now() - Number(localStorage.getItem(KUNCI_TOLAK) ?? 0) < 30 * 864e5);
        } catch {
          /* storan disekat: kekal disorok */
        }
        setK(x);
      })
      .catch(() => setK(null));
  }, []);
  const lamanUtama = path === "/utama" || path === "/pengurusan";
  // Telefon: hanya selepas dipasang (sebelum itu cadangan "Pasang HRBoost" dipaparkan)
  const sedia = typeof window !== "undefined" && (lebar || dipasang());
  if (!k || tutup || ditolak || !lamanUtama || !sedia || !k.sokong || k.iosPerluPasang || k.aktif || k.kebenaran !== "default" || !k.tersedia) return null;

  function nanti() {
    try {
      localStorage.setItem(KUNCI_TOLAK, String(Date.now()));
    } catch {
      /* abaikan */
    }
    setTutup(true);
  }

  async function hidupkan() {
    setSibuk(true);
    try {
      const ok = await aktifkanPush();
      if (ok) beritahu(tr("Notifikasi telefon dihidupkan untuk peranti ini."));
      else nanti();
    } catch (e) {
      beritahu(e instanceof Error ? trRalat(e.message) : tr("Ralat"), "ralat");
    }
    setTutup(true);
  }

  return (
    <div
      role="region"
      aria-label={tr("Notifikasi telefon")}
      className={`fixed inset-x-3 z-30 mx-auto flex max-w-[456px] flex-wrap items-center gap-3 rounded-[16px] bg-ink px-4 py-3 text-white shadow-xl lg:right-6 lg:bottom-6 lg:left-auto ${path === "/pengurusan" ? "bottom-[164px]" : "bottom-[92px]"}`}
    >
      <span className="flex min-w-0 grow basis-52 flex-col text-[13px] leading-snug">
        <b className="text-sm">{tr("Hidupkan notifikasi telefon?")}</b>
        <span className="opacity-85">{tr("Dapatkan makluman kelulusan dan cuti terus di skrin, walaupun HRBoost tidak dibuka.")}</span>
      </span>
      <span className="flex shrink-0 gap-2">
        <button type="button" onClick={nanti} className="h-10 rounded-full px-3 text-[13px] font-bold opacity-80">
          {tr("Nanti")}
        </button>
        <button type="button" disabled={sibuk} onClick={hidupkan} className="h-10 rounded-full bg-white px-4 text-[13px] font-extrabold text-ink disabled:opacity-60">
          {tr("Hidupkan")}
        </button>
      </span>
    </div>
  );
}
