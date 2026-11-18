"use client";

import { useEffect } from "react";

/**
 * Sandaran pautan e-mel Supabase Auth: jika alamat set semula tiada dalam senarai Redirect URLs projek,
 * Supabase menghantar pengguna ke Site URL (laman utama) dengan token dalam #hash. Alihkan ke halaman yang betul
 * dengan hash yang sama supaya pautan tetap berfungsi.
 */
export function AlihPautanAuth() {
  useEffect(() => {
    const h = window.location.hash;
    if (!h || h.length < 2) return;
    const p = new URLSearchParams(h.slice(1));
    const jenis = p.get("type");
    const ralat = p.get("error_code") ?? p.get("error");
    // Set semula kata laluan → /masuk/set-semula. Pautan pengesahan pendaftaran yang gagal (cth. otp_expired)
    // yang mendarat di laman utama → /daftar/sahkan supaya pengguna boleh minta pautan baharu.
    const sasaran = jenis === "recovery" ? "/masuk/set-semula" : ralat && (jenis === "signup" || !jenis) && window.location.pathname === "/" ? "/daftar/sahkan" : null;
    if (sasaran && window.location.pathname !== sasaran && (p.get("access_token") || ralat)) {
      window.location.replace(sasaran + h);
    }
  }, []);
  return null;
}
