import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Hanya kunci awam (anon / publishable). Jangan letak kunci service role di frontend.
// Nilai datang daripada pemboleh ubah persekitaran (lihat web/.env.example).
export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY belum ditetapkan.");
  }
  return createClient<Database>(url, anonKey);
}
