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
      return localStorage.getItem(key) ?? sessionStorage.getItem(key);
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
  client = createClient<Database>(url, anonKey, {
    auth: { storage: sessionStore, persistSession: true, autoRefreshToken: true },
  });
  return client;
}
