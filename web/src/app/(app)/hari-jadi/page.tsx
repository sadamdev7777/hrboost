"use client";

import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getHariJadi, nomborUcapan, type HariJadi } from "@/lib/profil";
import { addDays, dow, hariPendek, inisial, todayISO } from "@/lib/format";
import { IconCake, IconChat } from "@/components/icons";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";

const BULAN = ["JAN", "FEB", "MAC", "APR", "MEI", "JUN", "JUL", "OGO", "SEP", "OKT", "NOV", "DIS"];
const NAMA_HARI: Record<string, string> = { Isn: "Isnin", Sel: "Selasa", Rab: "Rabu", Kha: "Khamis", Jum: "Jumaat", Sab: "Sabtu", Ahd: "Ahad" };

function bila(date: string, today: string): string {
  if (date === today) return "Hari ini";
  if (date === addDays(today, 1)) return "Esok";
  const beza = Math.round((Date.parse(date) - Date.parse(today)) / 86400000);
  if (beza < 7) return NAMA_HARI[hariPendek(date)] ?? hariPendek(date);
  const minggu = Math.round(beza / 7);
  return `${minggu} minggu lagi`;
}

// Rujukan reka bentuk: design/HariJadi.dc.html
export default function HariJadiPage() {
  const me = useMe();
  const emp = me.active!;
  const today = todayISO();
  const [tab, setTab] = useState<"week" | "month">("week");
  // "Minggu ini" = hari ini hingga Ahad; "Bulan ini" = hingga akhir bulan
  const akhirMinggu = addDays(today, (7 - dow(today)) % 7);
  const [y, m] = today.split("-").map(Number);
  const akhirBulan = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const hingga = akhirBulan > akhirMinggu ? akhirBulan : akhirMinggu;
  const list = useData(() => getHariJadi(emp.companyId, today, hingga), [emp.companyId, today, hingga]);

  const semua = (list.data ?? []).filter((p) => p.personId !== me.personId);
  const hariIni = semua.filter((p) => p.date === today);
  const baki = semua.filter((p) => p.date !== today && p.date <= (tab === "week" ? akhirMinggu : akhirBulan));

  return (
    <Screen>
      <BackHeader title="Hari Jadi" href="/saya" />
      <main className="flex grow flex-col gap-3.5 px-5 pt-1 pb-4">
        {list.error && <ErrorBox message={list.error} />}
        {list.loading && !list.data && <Loading />}
        {hariIni.map((p) => (
          <KadHariIni key={p.personId} p={p} companyId={emp.companyId} companyCode={emp.companyCode} />
        ))}

        <div role="tablist" className="grid grid-cols-2 gap-1 rounded-[14px] bg-[#E4EAE8] p-1">
          {(
            [
              ["week", "Minggu ini"],
              ["month", "Bulan ini"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`h-10 rounded-[10px] text-sm ${tab === id ? "bg-surface font-extrabold text-ink" : "font-semibold text-[#4A5A57]"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-col rounded-card bg-surface px-4 py-1">
          {list.data && baki.length === 0 && (
            <span className="py-4 text-sm text-muted">Tiada hari jadi {tab === "week" ? "lagi minggu ini" : "lagi bulan ini"}.</span>
          )}
          {baki.map((p, i) => (
            <div key={p.personId} className={`flex min-h-[58px] items-center gap-3 ${i ? "border-t border-[#EEF2F1]" : ""}`}>
              <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-page">
                <b className="text-base leading-none font-extrabold">{Number(p.date.slice(8))}</b>
                <span className="text-[10px] font-bold text-[#4A5A57]">{BULAN[Number(p.date.slice(5, 7)) - 1]}</span>
              </span>
              <span className="flex grow flex-col gap-0.5">
                <b className="text-[15px] font-bold">{p.name}</b>
                {p.department && <span className="text-xs text-muted">{p.department}</span>}
              </span>
              <span className="text-xs font-bold text-[#4A5A57]">{bila(p.date, today)}</span>
            </div>
          ))}
        </div>

        <span className="text-xs leading-normal text-muted">
          Hanya hari dan bulan dipaparkan — tiada tahun atau umur. Diambil secara automatik daripada no. kad pengenalan. Pekerja boleh menyembunyikan hari jadi sendiri di Profil.
        </span>
      </main>
    </Screen>
  );
}

function KadHariIni({ p, companyId, companyCode }: { p: HariJadi; companyId: string; companyCode: string }) {
  const [ralat, setRalat] = useState<string | null>(null);
  async function ucap() {
    setRalat(null);
    try {
      const no = await nomborUcapan(companyId, p.personId);
      if (!no) throw new Error("Nombor WhatsApp tidak tersedia.");
      const teks = encodeURIComponent(`Selamat hari jadi, ${p.name}!`);
      window.open(`https://wa.me/${no.replace(/\D/g, "")}?text=${teks}`, "_blank", "noopener");
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
    }
  }
  return (
    <div className="flex flex-col gap-3.5 rounded-[20px] bg-[#FDEBD7] p-[18px]">
      <div className="flex items-center gap-3.5">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-surface text-lg font-extrabold text-warning">{inisial(p.name)}</span>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold tracking-[0.04em] text-warning">
            HARI INI · {Number(p.date.slice(8))} {BULAN[Number(p.date.slice(5, 7)) - 1]}
          </span>
          <b className="text-xl font-extrabold">{p.name}</b>
          <span className="text-[13px] text-[#6B3A0B]">{[p.department, companyCode].filter(Boolean).join(" · ")}</span>
        </div>
        <IconCake size={34} className="ml-auto text-warning" />
      </div>
      <button type="button" onClick={ucap} className="flex h-12 items-center justify-center gap-2 rounded-[14px] bg-surface text-[15px] font-extrabold text-warning">
        <IconChat size={18} />
        Ucap selamat di WhatsApp
      </button>
      {ralat && <span className="text-xs font-semibold text-danger">{ralat}</span>}
    </div>
  );
}
