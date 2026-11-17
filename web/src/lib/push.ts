"use client";

import { getSupabase } from "@/lib/supabase";
import { must } from "@/lib/useData";

// Notifikasi telefon (Web Push). Lihat migrasi 20261214002700_web_push.sql & public/sw.js.
// Android (Chrome): pelayar atau aplikasi yang dipasang. iPhone: iOS 16.4+ dan hanya selepas
// "Tambah ke Skrin Utama".

export type KeadaanPush = {
  /** Pelayar menyokong Web Push */
  sokong: boolean;
  /** iPhone/iPad yang belum memasang aplikasi ke Skrin Utama */
  iosPerluPasang: boolean;
  /** Kebenaran pelayar: default | granted | denied */
  kebenaran: NotificationPermission | "tiada";
  /** Peranti ini sedang menerima notifikasi untuk pengguna ini */
  aktif: boolean;
  /** Pelayan telah menyediakan kunci (VAPID) */
  tersedia: boolean;
};

const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const dipasang = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const sokong = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

async function pendaftaran(): Promise<ServiceWorkerRegistration> {
  const r = (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
  await navigator.serviceWorker.ready;
  return r;
}

async function langgananSemasa(): Promise<PushSubscription | null> {
  if (!sokong()) return null;
  const r = await navigator.serviceWorker.getRegistration("/");
  return r ? r.pushManager.getSubscription() : null;
}

function kunciKeBait(b64: string): Uint8Array<ArrayBuffer> {
  const t = (b64 + "===".slice((b64.length + 3) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(t);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function simpan(sub: PushSubscription) {
  const j = sub.toJSON();
  must(await getSupabase().rpc("push_subscribe", { p_endpoint: sub.endpoint, p_p256dh: j.keys?.p256dh ?? "", p_auth: j.keys?.auth ?? "", p_ua: navigator.userAgent }));
}

export async function keadaanPush(): Promise<KeadaanPush> {
  if (!sokong()) return { sokong: false, iosPerluPasang: ios() && !dipasang(), kebenaran: "tiada", aktif: false, tersedia: false };
  const sub = await langgananSemasa();
  const st = must(await getSupabase().rpc("push_status", { p_endpoint: sub?.endpoint })) as { available: boolean; this_device: boolean };
  return {
    sokong: true,
    iosPerluPasang: ios() && !dipasang(),
    kebenaran: Notification.permission,
    aktif: !!sub && st.this_device && Notification.permission === "granted",
    tersedia: st.available,
  };
}

/** Minta kebenaran & langgan peranti ini. Pulangkan false jika pengguna menolak. */
export async function aktifkanPush(): Promise<boolean> {
  if (!sokong()) return false;
  const kunci = must(await getSupabase().rpc("push_public_key")) as string | null;
  if (!kunci) throw new Error("Notifikasi telefon belum tersedia. Sila cuba sebentar lagi.");
  const izin = await Notification.requestPermission();
  if (izin !== "granted") return false;
  const r = await pendaftaran();
  let sub = await r.pushManager.getSubscription();
  if (!sub) sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: kunciKeBait(kunci) });
  await simpan(sub);
  return true;
}

export async function matikanPush() {
  const sub = await langgananSemasa();
  if (!sub) return;
  await getSupabase().rpc("push_unsubscribe", { p_endpoint: sub.endpoint });
  await sub.unsubscribe().catch(() => false);
}

/**
 * Selepas log masuk: pastikan langganan peranti ini dikaitkan dengan pengguna semasa
 * (cth. log masuk akaun lain pada telefon yang sama, atau pelayar memperbaharui langganan).
 */
export async function segerakPush() {
  try {
    if (!sokong() || Notification.permission !== "granted") return;
    const sub = await langgananSemasa();
    if (sub) await simpan(sub);
  } catch {
    /* abaikan */
  }
}

/** Log keluar: berhenti menghantar notifikasi pengguna ini ke peranti ini, kemudian tamatkan sesi. */
export async function logKeluar() {
  try {
    const sub = await langgananSemasa();
    if (sub) await getSupabase().rpc("push_unsubscribe", { p_endpoint: sub.endpoint });
  } catch {
    /* abaikan */
  }
  await getSupabase().auth.signOut();
}
