"use client";

import Link from "next/link";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getTuntutanSaya, type Tuntutan } from "@/lib/claims";
import { namaPeringkat, ringgit, tarikh } from "@/lib/format";
import { IconDocument } from "@/components/icons";
import { BackHeader, Empty, ErrorBox, Loading, Screen } from "@/components/ui";

const BULAN = ["JANUARI", "FEBRUARI", "MAC", "APRIL", "MEI", "JUN", "JULAI", "OGOS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DISEMBER"];

// Rujukan reka bentuk: design/Tuntutan.dc.html
export default function TuntutanSayaPage() {
  const me = useMe();
  const list = useData(() => getTuntutanSaya(me.active!), [me.active?.id]);
  const data = list.data ?? [];
  const menunggu = data.filter((t) => t.status === "pending").reduce((s, t) => s + t.total, 0);
  const lulus = data.filter((t) => t.status === "approved" && !t.paidAt).reduce((s, t) => s + t.total, 0);

  const kumpulan = new Map<string, Tuntutan[]>();
  for (const t of data) {
    const d = t.item?.date ?? t.createdAt.slice(0, 10);
    const k = `${BULAN[Number(d.slice(5, 7)) - 1]}${d.slice(0, 4) === new Date().getFullYear().toString() ? "" : " " + d.slice(0, 4)}`;
    kumpulan.set(k, [...(kumpulan.get(k) ?? []), t]);
  }

  return (
    <Screen>
      <BackHeader title="Tuntutan" href="/saya" />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-0.5 rounded-[14px] bg-surface px-3.5 py-3">
            <span className="text-xs text-muted">Menunggu</span>
            <b className="text-lg font-extrabold">{ringgit(menunggu)}</b>
          </div>
          <div className="flex flex-col gap-0.5 rounded-[14px] bg-surface px-3.5 py-3">
            <span className="text-xs text-muted">Lulus, dibayar bersama gaji</span>
            <b className="text-lg font-extrabold">{ringgit(lulus)}</b>
          </div>
        </div>

        {list.error && <ErrorBox message={list.error} />}
        {list.loading && !list.data && <Loading />}
        {list.data && data.length === 0 && <Empty>Belum ada tuntutan. Ambil gambar resit untuk mula.</Empty>}

        {[...kumpulan.entries()].map(([bulan, items]) => (
          <div key={bulan} className="flex flex-col gap-2">
            <span className="text-xs font-bold tracking-[0.04em] text-subtle">{bulan}</span>
            {items.map((t) => (
              <Link
                key={t.id}
                href={t.status === "draft" || t.status === "returned" || !t.approvalRequestId ? `/tuntutan/${t.id}` : `/permohonan/${t.approvalRequestId}`}
                className="flex items-center justify-between gap-2.5 rounded-card bg-surface px-4 py-3 text-ink!"
              >
                <div className="flex min-w-0 flex-col gap-[3px]">
                  <span className="text-sm font-bold">{t.title}</span>
                  <span className="text-xs text-muted">{keterangan(t)}</span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-right text-sm font-extrabold">{ringgit(t.total)}</span>
                  <Pill t={t} />
                </div>
              </Link>
            ))}
          </div>
        ))}
      </main>

      <div className="sticky bottom-0 grid grid-cols-2 gap-2.5 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
        <Link href="/tuntutan/baru" className="flex h-12 items-center justify-center gap-2 rounded-button bg-primary text-sm font-extrabold text-white!">
          Ambil gambar
        </Link>
        <Link href="/tuntutan/baru" className="flex h-12 items-center justify-center gap-2 rounded-button border-2 border-primary bg-surface text-sm font-extrabold text-primary!">
          <IconDocument size={18} />
          Muat naik
        </Link>
      </div>
    </Screen>
  );
}

function keterangan(t: Tuntutan): string {
  if (t.status === "draft") return "Draf · belum dihantar";
  if (t.status === "returned") return "Dikembalikan untuk pembetulan";
  if (!t.item) return "";
  const d = tarikh(t.item.date);
  if (t.item.distanceKm) return `${d} · ${t.item.distanceKm} km`;
  return `${d} · ${t.item.receipts.length} resit`;
}

function Pill({ t }: { t: Tuntutan }) {
  const [label, cls] =
    t.status === "pending"
      ? [t.waitingFor ? `Di ${t.waitingFor.split(", ").map(namaPeringkat).join(", ")}` : "Menunggu", "text-warning bg-warning-soft"]
      : t.status === "approved"
        ? [t.paidAt ? "Dibayar" : "Lulus", "text-success bg-success-soft"]
        : t.status === "rejected"
          ? ["Ditolak", "text-danger bg-danger-soft"]
          : t.status === "returned"
            ? ["Dikembalikan", "text-warning bg-warning-soft"]
            : t.status === "cancelled"
              ? ["Dibatalkan", "text-subtle bg-[#E9EEED]"]
              : ["Draf", "text-subtle bg-[#E9EEED]"];
  return <span className={`rounded-[9px] px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${cls}`}>{label}</span>;
}
