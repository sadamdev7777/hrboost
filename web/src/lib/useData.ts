"use client";

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
        alive && setRes((r) => ({ key, data: r.data, error: e instanceof Error ? e.message : String(e) })),
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

/** Lempar ralat Supabase sebagai Error biasa dengan mesej daripada pangkalan data (BM). */
export function must<R extends { data: unknown; error: { message: string } | null }>(
  res: R,
): Extract<R, { error: null }>["data"] {
  if (res.error) throw new Error(res.error.message);
  return res.data as Extract<R, { error: null }>["data"];
}
