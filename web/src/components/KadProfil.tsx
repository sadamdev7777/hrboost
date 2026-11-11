"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getProfilSaya, kelengkapan } from "@/lib/profilSaya";

/** Peringatan di Utama sehingga profil 100% lengkap. */
export function KadProfil() {
  const me = useMe();
  const emp = me.active;
  const d = useData(() => (emp ? getProfilSaya(me.personId, emp.id) : Promise.resolve(null)), [me.personId, emp?.id]);
  if (!d.data) return null;
  const k = kelengkapan(d.data);
  if (k.peratus === 100) return null;
  return (
    <Link href="/profil" className="flex items-center gap-3 rounded-card bg-surface px-4 py-3 text-ink!">
      <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-primary" style={{ background: `conic-gradient(#0F6B5F ${k.peratus * 3.6}deg, #E3F1EE 0)` }}>
        <span className="flex size-9 items-center justify-center rounded-full bg-surface">{k.peratus}%</span>
      </span>
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <b className="text-sm">{tr("Lengkapkan profil anda")}</b>
        <span className="truncate text-xs text-muted">{tr("Belum diisi: {0}", k.kurang.join(", "))}</span>
      </span>
      <span aria-hidden="true" className="text-lg text-primary">
        ›
      </span>
    </Link>
  );
}
