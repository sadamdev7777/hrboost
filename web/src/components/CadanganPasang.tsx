"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useSkrinLebar } from "@/lib/skrin";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const KUNCI_TOLAK = "hrb_pasang_tolak";
const KUNCI_BIL = "hrb_bil_masuk";
const noSub = () => () => {};

function boleh(): boolean {
  try {
    const dipasang = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (dipasang) return false;
    if (Number(localStorage.getItem(KUNCI_BIL) ?? 0) < 2) return false;
    const tolak = Number(localStorage.getItem(KUNCI_TOLAK) ?? 0);
    return Date.now() - tolak > 30 * 864e5;
  } catch {
    return false;
  }
}

/** Kira log masuk (dipanggil selepas log masuk berjaya). */
export function kiraLogMasuk() {
  try {
    localStorage.setItem(KUNCI_BIL, String(Number(localStorage.getItem(KUNCI_BIL) ?? 0) + 1));
  } catch {
    /* storan disekat */
  }
}

/**
 * Cadangan "Pasang HRBoost" di telefon selepas log masuk kali ke-2 (bukan hanya semasa orientasi).
 * Android/Chrome: butang Pasang (beforeinstallprompt). iPhone: arahan Kongsi → Tambah ke Skrin Utama.
 * Disorok selama 30 hari jika pengguna menekan "Nanti".
 */
export function CadanganPasang() {
  const lebar = useSkrinLebar();
  const path = usePathname();
  const layak = useSyncExternalStore(noSub, boleh, () => false);
  const ios = useSyncExternalStore(noSub, () => /iphone|ipad|ipod/i.test(navigator.userAgent), () => false);
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [tutup, setTutup] = useState(false);

  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  const lamanUtama = path === "/utama" || path === "/pengurusan";
  if (lebar || !layak || tutup || !lamanUtama || (!evt && !ios)) return null;

  function nanti() {
    try {
      localStorage.setItem(KUNCI_TOLAK, String(Date.now()));
    } catch {
      /* abaikan */
    }
    setTutup(true);
  }

  return (
    <div role="region" aria-label="Pasang HRBoost" className={`fixed inset-x-3 z-30 mx-auto flex max-w-[456px] ${path === "/pengurusan" ? "bottom-[164px]" : "bottom-[92px]"} items-center gap-3 rounded-[16px] bg-ink px-4 py-3 text-white shadow-xl`}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-primary text-sm font-extrabold">HR</span>
      <span className="flex grow flex-col text-[13px] leading-snug">
        <b className="text-sm">Pasang HRBoost di telefon</b>
        {ios && !evt ? <span className="opacity-85">Tekan Kongsi, kemudian &ldquo;Tambah ke Skrin Utama&rdquo;.</span> : <span className="opacity-85">Buka dengan sekali tekan, seperti aplikasi.</span>}
      </span>
      {evt && (
        <button
          type="button"
          onClick={async () => {
            await evt.prompt();
            await evt.userChoice.catch(() => null);
            setEvt(null);
            setTutup(true);
          }}
          className="h-9 shrink-0 rounded-full bg-white px-3.5 text-[13px] font-bold text-ink"
        >
          Pasang
        </button>
      )}
      <button type="button" onClick={nanti} className="h-9 shrink-0 px-1.5 text-[13px] font-bold text-white/80">
        Nanti
      </button>
    </div>
  );
}
