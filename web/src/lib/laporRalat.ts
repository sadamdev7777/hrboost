"use client";

import { getSupabase } from "./supabase";

// Pemantauan ralat tanpa perkhidmatan luar: ralat JavaScript yang tidak ditangkap dihantar ke
// log_client_error() (Pentadbir Platform → Ralat aplikasi). Tiada data borang dihantar; hanya mesej,
// jejak tindanan, laluan (tanpa query string) dan pelayar.
const ABAI = [/ResizeObserver loop/i, /^Script error\.?$/i, /AbortError/i, /Load failed$/i, /Failed to fetch$/i, /NetworkError/i];
let dihantar = 0;

export function laporRalat(e: unknown, konteks?: string) {
  try {
    if (typeof window === "undefined" || dihantar >= 20) return; // had setiap sesi halaman
    const err = e instanceof Error ? e : new Error(typeof e === "string" ? e : JSON.stringify(e)?.slice(0, 300) || "Ralat");
    const mesej = (konteks ? `[${konteks}] ` : "") + (err.message || String(err));
    if (ABAI.some((r) => r.test(err.message))) return;
    if (/localhost|127\.0\.0\.1/.test(location.hostname) && !localStorage.getItem("hrb_lapor_ralat_tempatan")) return;
    dihantar++;
    let syarikat: string | null = null;
    try {
      syarikat = localStorage.getItem("hrb_syarikat_aktif");
    } catch {
      /* abaikan */
    }
    void getSupabase()
      .rpc("log_client_error", {
        p_message: mesej.slice(0, 500),
        p_stack: (err.stack ?? "").slice(0, 4000),
        p_path: location.pathname,
        p_user_agent: navigator.userAgent.slice(0, 300),
        p_release: process.env.NEXT_PUBLIC_RELEASE ?? "",
        ...(syarikat && /^[0-9a-f-]{36}$/.test(syarikat) ? { p_company: syarikat } : {}),
      })
      .then(
        () => undefined,
        () => undefined,
      );
  } catch {
    /* pelapor ralat tidak boleh menyebabkan ralat */
  }
}

let dipasang = false;
export function pasangPelaporRalat() {
  if (dipasang || typeof window === "undefined") return;
  dipasang = true;
  window.addEventListener("error", (ev) => laporRalat(ev.error ?? ev.message));
  window.addEventListener("unhandledrejection", (ev) => laporRalat(ev.reason, "promise"));
}
