"use client";

// Jemputan yang sedang diaktifkan, disimpan sementara semasa pengguna mengesahkan OTP.
const KEY = "hrb_jemputan";

export type JemputanTertangguh = { token: string; ic4: string; error?: string };

export function simpanJemputan(j: JemputanTertangguh) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(j));
  } catch {
    /* abaikan */
  }
}

export function bacaJemputan(): JemputanTertangguh | null {
  try {
    const v = sessionStorage.getItem(KEY);
    return v ? (JSON.parse(v) as JemputanTertangguh) : null;
  } catch {
    return null;
  }
}

export function padamJemputan() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* abaikan */
  }
}

/** Ambil token daripada pautan penuh (…/jemputan/<token>) atau token sahaja. */
export function tokenDaripada(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const m = s.match(/jemputan\/([A-Za-z0-9_-]{8,})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{8,}$/.test(s) ? s : null;
}
