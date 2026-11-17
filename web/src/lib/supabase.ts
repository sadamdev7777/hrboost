"use client";

import { tr } from "@/lib/i18n";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Hanya kunci awam (anon). Jangan letak kunci service role di frontend.
// Nilai datang daripada pemboleh ubah persekitaran (lihat web/.env.example).

const KEEP_KEY = "hrb_kekal_log_masuk";

/** Pilihan "Kekalkan log masuk di telefon ini": localStorage (kekal) atau sessionStorage (tamat bila tab ditutup). */
export function setKeepSignedIn(keep: boolean) {
  try {
    localStorage.setItem(KEEP_KEY, keep ? "1" : "0");
  } catch {
    /* storan disekat: abaikan */
  }
}

function keepSignedIn(): boolean {
  try {
    return localStorage.getItem(KEEP_KEY) !== "0";
  } catch {
    return true;
  }
}

const sessionStore = {
  getItem(key: string) {
    try {
      // Baca storan yang sepadan dengan pilihan semasa dahulu (elak sesi lama daripada storan lain dibaca)
      return keepSignedIn() ? (localStorage.getItem(key) ?? sessionStorage.getItem(key)) : (sessionStorage.getItem(key) ?? localStorage.getItem(key));
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string) {
    try {
      if (keepSignedIn()) {
        sessionStorage.removeItem(key);
        localStorage.setItem(key, value);
      } else {
        localStorage.removeItem(key);
        sessionStorage.setItem(key, value);
      }
    } catch {
      /* abaikan */
    }
  },
  removeItem(key: string) {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {
      /* abaikan */
    }
  },
};

let client: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(tr("NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY belum ditetapkan."));
  }
  // Pautan daripada e-mel (pengesahan / jemputan / set semula): sesi disimpan kekal pada peranti ini
  try {
    if (/access_token=|type=(signup|recovery|invite|magiclink)/.test(window.location.hash)) setKeepSignedIn(true);
  } catch {
    /* abaikan */
  }
  client = createClient<Database>(url, anonKey, {
    auth: { storage: sessionStore, persistSession: true, autoRefreshToken: true },
    global: { fetch: fetchSemakSesi },
  });
  return client;
}

/** Peristiwa apabila sesi log masuk hilang semasa aplikasi dibuka (cth. tamat atau diganti oleh tab lain). */
export const PERISTIWA_SESI_TAMAT = "hrb:sesi-tamat";
let semakSesiBerjalan = false;

/**
 * fetch dengan semakan: permintaan data yang ditolak 401 (dihantar tanpa sesi) → jika sesi memang sudah tiada,
 * maklumkan aplikasi supaya pengguna dibawa ke log masuk, bukan melihat ralat "permission denied".
 */
async function fetchSemakSesi(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401 && !semakSesiBerjalan) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/rest/v1/") && client) {
      semakSesiBerjalan = true;
      void client.auth
        .getSession()
        .then(({ data }) => {
          if (!data.session) window.dispatchEvent(new Event(PERISTIWA_SESI_TAMAT));
        })
        .finally(() => {
          semakSesiBerjalan = false;
        });
    }
  }
  return res;
}
