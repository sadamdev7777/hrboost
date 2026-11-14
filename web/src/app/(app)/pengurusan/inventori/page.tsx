"use client";

import { tr } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { useMe, hasRole } from "@/lib/me";
import { useData } from "@/lib/useData";
import { ringgit, tarikh } from "@/lib/format";
import { getInventori, KATEGORI_INVENTORI, LABEL_STATUS_INVENTORI, perluDipulang, type ItemInventori } from "@/lib/inventori";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { PengepalaAkar } from "@/components/TabNav";
import { TabModul } from "@/components/TabModul";
import { HadPeranan, Tag, inputKecil } from "@/components/Senarai";
import { BarisStat, Cip, Jadual, KadStat, Kosong } from "@/components/Modul";
import { BarisInventori, BorangInventori, ButiranInventori, Lakaran } from "@/components/Inventori";
import { useSkrinLebar } from "@/lib/skrin";

type Tapis = "semua" | "pending" | "pulang" | "dipegang" | "lokasi" | "dipulangkan";

/** HR: semua inventori syarikat — sahkan rekod pekerja, nilai keseluruhan, pemegang & lokasi. */
export default function InventoriHrPage() {
  return (
    <HadPeranan roles={["hr", "admin", "ceo", "finance"]} back="/pengurusan">
      <InventoriHr />
    </HadPeranan>
  );
}

function InventoriHr() {
  const me = useMe();
  const cid = me.active!.companyId;
  const hr = hasRole(me, ["hr", "admin"]);
  const lebar = useSkrinLebar();
  const d = useData(() => getInventori(cid, "all"), [cid]);
  const [tapis, setTapis] = useState<Tapis>("semua");
  const [kategori, setKategori] = useState("");
  const [cari, setCari] = useState("");
  const [lihat, setLihat] = useState<ItemInventori | null>(null);
  const [borang, setBorang] = useState<ItemInventori | "baru" | null>(null);
  const semua = useMemo(() => d.data ?? [], [d.data]);

  const aktif = semua.filter((x) => x.status === "verified" && !x.returned_on);
  const menunggu = semua.filter((x) => x.status === "pending").length;
  const pulang = semua.filter(perluDipulang).length;
  const nilai = aktif.reduce((a, x) => a + Number(x.price ?? 0), 0);
  const papar = semua.filter((x) => {
    if (tapis === "pending" && x.status !== "pending") return false;
    if (tapis === "pulang" && !perluDipulang(x)) return false;
    if (tapis === "dipegang" && !(x.employment_id && !x.returned_on)) return false;
    if (tapis === "lokasi" && x.employment_id) return false;
    if (tapis === "dipulangkan" && !x.returned_on) return false;
    if (kategori && x.category !== kategori) return false;
    const q = cari.trim().toLowerCase();
    return !q || [x.name, x.brand_model, x.serial_no, x.holder, x.location, x.department].some((v) => v?.toLowerCase().includes(q));
  });

  function eksport() {
    const baris = [
      [tr("Item"), tr("Kategori"), tr("Jenama / model"), tr("No. siri / tag"), tr("Pemegang"), tr("Jabatan"), tr("Lokasi"), tr("Harga (RM)"), tr("Tarikh beli / terima"), tr("Keadaan"), tr("Status"), tr("Dipulangkan")],
      ...papar.map((x) => [x.name, x.category ?? "", x.brand_model ?? "", x.serial_no ?? "", x.holder ?? "", x.department ?? "", x.location ?? "", x.price != null ? Number(x.price).toFixed(2) : "", x.issued_on ?? "", x.condition, LABEL_STATUS_INVENTORI[x.status].l, x.returned_on ?? ""]),
    ];
    const csv = "﻿" + baris.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `inventori-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <Screen lebar="lebar">
      <PengepalaAkar
        title={tr("Inventori")}
        back="/pengurusan"
        action={
          hr && (
            <button type="button" onClick={() => setBorang("baru")} className="h-11 rounded-full bg-primary px-4 text-[13px] font-bold text-white">
              {tr("+ Tambah item")}
            </button>
          )
        }
      />
      <TabModul modul="pekerja" />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-6 lg:px-0">
        {d.error && <ErrorBox message={d.error} />}
        {!d.data && !d.error && <Loading />}
        {d.data && (
          <>
            <BarisStat>
              <KadStat label={tr("Item aktif")} nilai={String(aktif.length)} onClick={() => setTapis("semua")} aktif={tapis === "semua"} />
              <KadStat label={tr("Nilai inventori")} nilai={ringgit(nilai)} />
              <KadStat label={tr("Menunggu semakan")} nilai={String(menunggu)} tone={menunggu ? "warning" : undefined} onClick={() => setTapis("pending")} aktif={tapis === "pending"} />
              <KadStat label={tr("Perlu dipulangkan")} nilai={String(pulang)} tone={pulang ? "danger" : undefined} onClick={() => setTapis("pulang")} aktif={tapis === "pulang"} />
              <KadStat label={tr("Dipegang pekerja")} nilai={String(aktif.filter((x) => x.employment_id).length)} onClick={() => setTapis("dipegang")} aktif={tapis === "dipegang"} />
            </BarisStat>
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ["semua", tr("Semua")],
                  ["pending", tr("Menunggu semakan")],
                  ["pulang", tr("Perlu dipulangkan")],
                  ["dipegang", tr("Dipegang pekerja")],
                  ["lokasi", tr("Di lokasi")],
                  ["dipulangkan", tr("Dipulangkan")],
                ] as [Tapis, string][]
              ).map(([k, l]) => (
                <Cip key={k} on={tapis === k} onClick={() => setTapis(k)}>
                  {l}
                </Cip>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px_auto]">
              <input className={`${inputKecil} min-w-0`} value={cari} onChange={(e) => setCari(e.target.value)} placeholder={tr("Cari item, pemegang, no. siri…")} aria-label={tr("Cari")} />
              <select className={inputKecil} value={kategori} onChange={(e) => setKategori(e.target.value)} aria-label={tr("Kategori")}>
                <option value="">{tr("Semua kategori")}</option>
                {KATEGORI_INVENTORI.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <button type="button" onClick={eksport} disabled={!papar.length} className="h-11 rounded-[12px] border border-line bg-surface px-4 text-sm font-bold disabled:opacity-50">
                {tr("Eksport CSV")}
              </button>
            </div>
            {papar.length === 0 ? (
              <Kosong>{semua.length ? tr("Tiada item sepadan dengan tapisan.") : tr("Belum ada item inventori. Pekerja boleh merekod item di Saya → Inventori saya, atau tekan “+ Tambah item”.")}</Kosong>
            ) : lebar ? (
              <Jadual kepala={["", tr("Item"), tr("Pemegang / lokasi"), tr("Harga"), tr("Tarikh"), tr("Status")]} kanan={[3]}>
                {papar.map((x) => {
                  const st = LABEL_STATUS_INVENTORI[x.status];
                  return (
                    <tr key={x.id} onClick={() => setLihat(x)} className="cursor-pointer hover:bg-page">
                      <td className="w-16">{x.photo_paths[0] ? <Lakaran path={x.photo_paths[0]} /> : <span className="flex size-14 items-center justify-center rounded-[12px] bg-page text-[11px] text-muted">-</span>}</td>
                      <td>
                        <b className="block font-bold">{x.name}</b>
                        <span className="text-xs text-muted">{[x.category, x.brand_model, x.serial_no].filter(Boolean).join(" · ")}</span>
                      </td>
                      <td>
                        <span className="block">{x.holder ?? x.location ?? "-"}</span>
                        <span className="text-xs text-muted">{x.holder ? x.department : null}</span>
                      </td>
                      <td className="text-right tabular-nums">{x.price != null ? ringgit(Number(x.price)) : "-"}</td>
                      <td className="whitespace-nowrap text-muted">{x.issued_on ? tarikh(x.issued_on) : "-"}</td>
                      <td>
                        {x.returned_on ? (
                          <Tag tone="neutral">{tr("Dipulangkan")}</Tag>
                        ) : perluDipulang(x) ? (
                          <span className="flex flex-col items-start gap-0.5">
                            <Tag tone="danger">{tr("Perlu dipulangkan")}</Tag>
                            <span className="text-[11px] text-muted">{x.holder_end_date ? tr("Hari terakhir {0}", tarikh(x.holder_end_date)) : tr("Pekerja telah berhenti")}</span>
                          </span>
                        ) : (
                          <Tag tone={st.tone}>{st.l}</Tag>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </Jadual>
            ) : (
              <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
                {papar.map((x) => (
                  <BarisInventori key={x.id} x={x} tunjukPemegang onClick={() => setLihat(x)} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
      {lihat && (
        <ButiranInventori
          x={lihat}
          hr={hr}
          onClose={() => setLihat(null)}
          onUbah={() => {
            setBorang(lihat);
            setLihat(null);
          }}
          onSelesai={() => {
            setLihat(null);
            d.reload();
          }}
        />
      )}
      {borang && (
        <BorangInventori
          item={borang === "baru" ? undefined : borang}
          hr={hr}
          onClose={() => setBorang(null)}
          onDone={() => {
            setBorang(null);
            d.reload();
          }}
        />
      )}
    </Screen>
  );
}
