"use client";

import { useEffect } from "react";
import { pasangPelaporRalat } from "@/lib/laporRalat";

/** Pasang pelapor ralat global sekali (lihat lib/laporRalat.ts). */
export function PelaporRalat() {
  useEffect(() => pasangPelaporRalat(), []);
  return null;
}
