"use client";

import { useEffect } from "react";

const PILIH = 'input[type="date"],input[type="time"],input[type="datetime-local"],input[type="month"]';

/**
 * iOS Safari memaparkan tarikh hari ini dalam medan tarikh yang kosong, jadi medan kelihatan sudah diisi.
 * Tandakan medan kosong dengan `data-kosong` supaya CSS (globals.css) menyembunyikan nilai palsu itu.
 * Hanya dipasang pada iOS / iPadOS.
 */
export function PembetulTarikh() {
  useEffect(() => {
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (!ios) return;
    const kemas = () => {
      document.querySelectorAll<HTMLInputElement>(PILIH).forEach((el) => {
        const kosong = el.value === "";
        if (kosong !== el.hasAttribute("data-kosong")) el.toggleAttribute("data-kosong", kosong);
      });
    };
    kemas();
    const pemerhati = new MutationObserver(kemas);
    pemerhati.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("input", kemas, true);
    document.addEventListener("change", kemas, true);
    document.addEventListener("blur", kemas, true);
    // Nilai yang ditetapkan oleh React (cth. borang dikosongkan) tidak mencetuskan peristiwa
    const selang = window.setInterval(kemas, 600);
    return () => {
      pemerhati.disconnect();
      document.removeEventListener("input", kemas, true);
      document.removeEventListener("change", kemas, true);
      document.removeEventListener("blur", kemas, true);
      window.clearInterval(selang);
    };
  }, []);
  return null;
}
