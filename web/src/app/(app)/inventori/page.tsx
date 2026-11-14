"use client";

import { tr } from "@/lib/i18n";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getInventori, type ItemInventori } from "@/lib/inventori";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { BarisInventori, BorangInventori, ButiranInventori } from "@/components/Inventori";

/** Pekerja: item syarikat yang dipegang / direkod sendiri. Tambah dengan gambar, butiran, harga & resit. */
export default function InventoriSayaPage() {
  const me = useMe();
  const emp = me.active!;
  const d = useData(() => getInventori(emp.companyId, "mine"), [emp.companyId]);
  const [lihat, setLihat] = useState<ItemInventori | null>(null);
  const [borang, setBorang] = useState<ItemInventori | "baru" | null>(null);
  const senarai = d.data ?? [];
  const dipegang = senarai.filter((x) => x.employment_id === emp.id && !x.returned_on);
  const lain = senarai.filter((x) => !dipegang.includes(x));

  return (
    <Screen lebar="sederhana">
      <BackHeader
        title={tr("Inventori saya")}
        href="/saya"
        action={
          <button type="button" onClick={() => setBorang("baru")} className="h-11 rounded-full bg-primary px-4 text-[13px] font-bold text-white">
            {tr("+ Tambah item")}
          </button>
        }
      />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-6">
        <span className="text-[13px] leading-snug text-subtle">
          {tr("Rekod barang syarikat yang anda pegang (cth. laptop, telefon) atau barang di pejabat. Ambil gambar, isi butiran dan lampirkan resit jika ada. HR akan mengesahkan setiap item.")}
        </span>
        {d.error && <ErrorBox message={d.error} />}
        {!d.data && !d.error && <Loading />}
        {d.data && senarai.length === 0 && (
          <div className="flex flex-col items-start gap-3 rounded-card bg-surface px-4 py-5 text-sm">
            <b>{tr("Belum ada item")}</b>
            <span className="text-muted">{tr("Tekan “+ Tambah item” dan ambil gambar barang syarikat yang anda pegang.")}</span>
          </div>
        )}
        {dipegang.length > 0 && (
          <Kumpulan tajuk={tr("DIPEGANG OLEH SAYA · {0}", dipegang.length)}>
            {dipegang.map((x) => (
              <BarisInventori key={x.id} x={x} onClick={() => setLihat(x)} />
            ))}
          </Kumpulan>
        )}
        {lain.length > 0 && (
          <Kumpulan tajuk={tr("DIREKOD OLEH SAYA · {0}", lain.length)}>
            {lain.map((x) => (
              <BarisInventori key={x.id} x={x} onClick={() => setLihat(x)} />
            ))}
          </Kumpulan>
        )}
      </main>
      {lihat && (
        <ButiranInventori
          x={lihat}
          hr={false}
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
          hr={false}
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

function Kumpulan({ tajuk, children }: { tajuk: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <span className="text-xs font-bold tracking-[0.04em] text-[#4A5A57]">{tajuk}</span>
      <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">{children}</div>
    </section>
  );
}
