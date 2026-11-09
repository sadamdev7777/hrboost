"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * Keutamaan paparan setiap pelayar (penapis terakhir, paparan tersimpan, lajur jadual).
 * Hanya kemudahan — jika storan disekat, nilai lalai digunakan.
 */
const PERISTIWA = "hrb-simpanan";

function baca(k: string): string {
  try {
    return localStorage.getItem(k) ?? "";
  } catch {
    return "";
  }
}
function langgan(cb: () => void) {
  window.addEventListener(PERISTIWA, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(PERISTIWA, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useSimpanan<T>(kunci: string, lalai: T): [T, (v: T) => void] {
  const mentah = useSyncExternalStore(
    langgan,
    () => baca(kunci),
    () => "",
  );
  const nilai = useMemo(() => {
    if (!mentah) return lalai;
    try {
      return JSON.parse(mentah) as T;
    } catch {
      return lalai;
    }
    // lalai dianggap tetap bagi setiap kunci
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentah]);
  const set = useCallback(
    (v: T) => {
      try {
        localStorage.setItem(kunci, JSON.stringify(v));
      } catch {
        /* storan disekat */
      }
      window.dispatchEvent(new Event(PERISTIWA));
    },
    [kunci],
  );
  return [nilai, set];
}
