"use client";

import { tr } from "@/lib/i18n";
import { useSyncExternalStore } from "react";

const MQ = tr("(min-width: 1024px)");

function langgan(cb: () => void) {
  const m = window.matchMedia(MQ);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}

/**
 * true pada skrin lebar (≥ 1024px, sama dengan `lg:` Tailwind). Digunakan untuk memaparkan
 * SATU versi sahaja (menu sisi / jadual vs tab bawah / senarai kad), bukan kedua-duanya
 * dengan CSS tersorok — elak elemen pendua untuk pembaca skrin dan ujian.
 */
export function useSkrinLebar(): boolean {
  return useSyncExternalStore(langgan, () => window.matchMedia(MQ).matches, () => false);
}
