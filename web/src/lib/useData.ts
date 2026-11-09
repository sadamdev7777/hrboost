"use client";

import { tr, trRalat } from "@/lib/i18n";
import { useCallback, useEffect, useState } from "react";

type Dep = string | number | boolean | null | undefined;

/**
 * Muat data secara tak segerak dengan status memuat / ralat dan fungsi muat semula.
 * `deps` mestilah nilai primitif (id, tarikh) — ia menjadi kunci muat semula.
 * Data lama dikekalkan semasa memuat semula supaya skrin tidak berkelip.
 */
export function useData<T>(fn: () => Promise<T>, deps: Dep[]) {
  const [tick, setTick] = useState(0);
  const key = JSON.stringify([...deps, tick]);
  const [res, setRes] = useState<{ key: string | null; data: T | null; error: string | null }>({
    key: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    let alive = true;
    fn().then(
      (data) => alive && setRes({ key, data, error: null }),
      (e: unknown) =>
        alive && setRes((r) => ({ key, data: r.data, error: mesejRalat(e instanceof Error ? e.message : String(e)) })),
    );
    return () => {
      alive = false;
    };
    // `fn` sengaja tidak dimasukkan: kunci `key` sudah mewakili inputnya.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data: res.data, error: res.error, loading: res.key !== key, reload };
}

/**
 * Tukar ralat teknikal (Postgres / PostgREST / rangkaian) kepada mesej mesra dalam bahasa pengguna.
 * Mesej daripada RPC kita sendiri (raise exception '...', BM) diterjemah melalui trRalat.
 */
export function mesejRalat(m: string, code?: string): string {
  const t = m.toLowerCase();
  if (code === "23505" || t.includes("duplicate key") || t.includes("already exists")) return tr("Rekod ini sudah wujud.");
  if (code === "23503" || t.includes("violates foreign key")) return tr("Rekod ini masih digunakan oleh data lain dan tidak boleh diubah atau dipadam.");
  if (code === "23502" || t.includes("null value in column")) return tr("Sila lengkapkan semua medan yang wajib.");
  if (code === "23514" || t.includes("violates check constraint")) return tr("Nilai yang dimasukkan tidak sah.");
  if (code === "42501" || t.includes("permission denied") || t.includes("row-level security")) return tr("Anda tidak mempunyai akses untuk tindakan ini.");
  if (t.includes("jwt expired") || t.includes("invalid jwt") || code === "PGRST301") return tr("Sesi anda telah tamat. Sila log masuk semula.");
  if (t.includes("failed to fetch") || t.includes("networkerror") || t.includes("network request failed") || t.includes("load failed"))
    return tr("Tiada sambungan internet. Semak sambungan anda dan cuba lagi.");
  if (t.includes("timeout") || t.includes("statement timeout")) return tr("Permintaan mengambil masa terlalu lama. Sila cuba lagi.");
  if (t.includes("invalid input syntax")) return tr("Format nilai tidak sah.");
  return trRalat(m);
}

/** Lempar ralat Supabase sebagai Error biasa dengan mesej BM (lihat mesejRalat). */
export function must<R extends { data: unknown; error: { message: string; code?: string } | null }>(
  res: R,
): Extract<R, { error: null }>["data"] {
  if (res.error) throw new Error(mesejRalat(res.error.message, res.error.code));
  return res.data as Extract<R, { error: null }>["data"];
}
