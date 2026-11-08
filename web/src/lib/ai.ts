"use client";

import { FunctionsHttpError } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

export class RalatAi extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/** Panggil Edge Function AI; ralat dipetakan kepada mesej BM yang jelas. */
export async function panggilAi<T>(fn: "pembantu-ai" | "ai-receipt" | "ai-ic", body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke(fn, { body });
  if (error) {
    const ctx = (error as { context?: unknown }).context;
    if (error instanceof FunctionsHttpError && ctx && typeof (ctx as Response).json === "function") {
      const j = (await (ctx as Response).json().catch(() => null)) as { code?: string; error?: string } | null;
      if (j?.error) throw new RalatAi(j.code ?? "api", j.error);
    }
    throw new RalatAi("tiada_fungsi", "Pembantu AI belum diaktifkan untuk syarikat ini.");
  }
  return data as T;
}

export type BacaanResit = {
  merchant: string | null;
  date: string | null;
  amount: number | null;
  claim_type: string | null;
  purpose: string;
  readable: boolean;
};
