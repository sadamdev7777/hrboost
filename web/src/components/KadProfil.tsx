"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getProfilSaya, kelengkapan } from "@/lib/profilSaya";

const TEMPOH_SEMBUNYI = 7 * 86400000;
const kunci = (personId: string) => `hrb_kadprofil_${personId}`;

/** Disembunyikan oleh pekerja dalam 7 hari lepas? (simpanan pelayar sahaja; gagal → papar) */
function disembunyikan(personId: string): boolean {
  try {
    const t = Number(localStorage.getItem(kunci(personId)) ?? 0);
    return Date.now() - t < TEMPOH_SEMBUNYI;
  } catch {
    return false;
  }
}

/** Peringatan di Utama sehingga profil 100% lengkap. Boleh disembunyikan selama 7 hari. */
export function KadProfil() {
  const me = useMe();
  const emp = me.active;
  const [tutup, setTutup] = useState(false);
  const d = useData(
    () => (emp ? getProfilSaya(me.personId, emp.id) : Promise.resolve(null)),
    [me.personId, emp?.id],
  );
  if (!d.data) return null;
  const k = kelengkapan(d.data);
  if (k.peratus === 100 || tutup || disembunyikan(me.personId)) return null;
  function sembunyi() {
    try {
      localStorage.setItem(kunci(me.personId), String(Date.now()));
    } catch {
      /* simpanan pelayar disekat — sembunyi untuk sesi ini sahaja */
    }
    setTutup(true);
  }
  return (
    <div className="flex items-center rounded-card bg-surface">
      <Link
        href="/profil"
        className="flex min-w-0 grow items-center gap-3 py-3 pl-4 text-ink!"
      >
        <span
          className="relative flex size-12 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-primary"
          style={{
            background: `conic-gradient(#0F6B5F ${k.peratus * 3.6}deg, #E3F1EE 0)`,
          }}
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-surface">
            {k.peratus}%
          </span>
        </span>
        <span className="flex min-w-0 grow flex-col gap-0.5">
          <b className="text-sm">{tr("Lengkapkan profil anda")}</b>
          <span className="truncate text-xs text-muted">
            {tr("Belum diisi: {0}", k.kurang.join(", "))}
          </span>
        </span>
      </Link>
      <button
        type="button"
        onClick={sembunyi}
        aria-label={tr("Sembunyikan selama 7 hari")}
        title={tr("Sembunyikan selama 7 hari")}
        className="flex size-11 shrink-0 items-center justify-center text-2xl leading-none text-muted"
      >
        ×
      </button>
    </div>
  );
}
