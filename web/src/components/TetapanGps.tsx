"use client";

import { tr } from "@/lib/i18n";
import { useState } from "react";
import { useData } from "@/lib/useData";
import { ErrorBox } from "@/components/ui";
import { ButangUtama, Lembaran, MedanBorang, Seksyen, Suis, inputKecil } from "@/components/Senarai";
import { dapatkanLokasi, getTetapanGps, koordinatDaripadaTeks, padamLokasi, petaUrl, setGps, simpanLokasi, type LokasiPejabat } from "@/lib/kehadiranGps";
import { sahkan } from "@/components/Dialog";

/** Tetapan → Kehadiran: daftar masuk melalui telefon (GPS + swafoto) dan lokasi pejabat. */
export function TetapanGps({ companyId }: { companyId: string }) {
  const d = useData(() => getTetapanGps(companyId), [companyId]);
  const [ubah, setUbah] = useState<LokasiPejabat | "baru" | null>(null);
  const [ralat, setRalat] = useState<string | null>(null);
  const t = d.data;

  async function suis(on: boolean) {
    setRalat(null);
    try {
      await setGps(companyId, on);
      d.reload();
    } catch (e) {
      setRalat((e as Error).message);
    }
  }
  async function padam(l: LokasiPejabat) {
    if (!(await sahkan({ tajuk: tr("Padam lokasi {0}?", l.name), mesej: tr("Rekod kehadiran lama kekal."), ok: tr("Padam"), bahaya: true }))) return;
    try {
      await padamLokasi(l.id);
      d.reload();
    } catch (e) {
      setRalat((e as Error).message);
    }
  }

  return (
    <section aria-label={tr("Daftar masuk melalui telefon")} className="flex flex-col gap-2">
      <Seksyen className="pt-1">{tr("DAFTAR MASUK MELALUI TELEFON (GPS)")}</Seksyen>
      {d.error && <ErrorBox message={d.error} />}
      {t && (
        <div className="flex flex-col rounded-card bg-surface px-4 text-sm [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
          <div className="flex min-h-14 items-center gap-3 py-2">
            <span className="flex grow flex-col gap-0.5">
              <b>{tr("Benarkan daftar masuk melalui telefon")}</b>
              <span className="text-xs text-muted">{tr("Pekerja daftar masuk dan keluar dengan lokasi GPS dan swafoto. Mesin kehadiran tetap berfungsi; masa masuk ialah yang terawal dan masa keluar yang terakhir.")}</span>
            </span>
            <Suis on={t.enabled} onChange={suis} label={tr("Benarkan daftar masuk melalui telefon")} />
          </div>
          {t.locations.map((l) => (
            <div key={l.id} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 py-2" data-lokasi={l.name}>
              <span className="flex min-w-0 grow basis-48 flex-col">
                <b>{l.name}</b>
                <span className="text-xs text-muted">
                  {tr("Radius {0} m", l.radius_m)} ·{" "}
                  <a href={petaUrl(l.lat, l.lng)} target="_blank" rel="noreferrer" className="font-semibold">
                    {tr("Lihat peta")}
                  </a>
                </span>
              </span>
              <button type="button" onClick={() => setUbah(l)} className="h-10 rounded-full border border-line px-3.5 text-xs font-bold text-primary">
                {tr("Ubah")}
              </button>
              <button type="button" onClick={() => padam(l)} className="h-10 rounded-full px-3 text-xs font-bold text-danger">
                {tr("Padam")}
              </button>
            </div>
          ))}
          <div className="flex min-h-14 flex-wrap items-center gap-3 py-2">
            <span className="grow text-xs text-muted">
              {t.locations.length
                ? tr("Daftar masuk di luar radius tetap direkod tetapi ditanda “Luar lokasi”.")
                : tr("Tambah sekurang-kurangnya satu lokasi pejabat. Tanpa lokasi, semua daftar masuk ditanda “Luar lokasi”.")}
            </span>
            <button type="button" onClick={() => setUbah("baru")} className="h-11 rounded-xl bg-primary px-4 text-sm font-bold text-white">
              {tr("+ Tambah lokasi")}
            </button>
          </div>
        </div>
      )}
      {ralat && <ErrorBox message={ralat} />}
      {ubah && (
        <BorangLokasi
          companyId={companyId}
          asal={ubah === "baru" ? null : ubah}
          onClose={() => setUbah(null)}
          onDone={() => {
            setUbah(null);
            d.reload();
          }}
        />
      )}
    </section>
  );
}

function BorangLokasi({ companyId, asal, onClose, onDone }: { companyId: string; asal: LokasiPejabat | null; onClose: () => void; onDone: () => void }) {
  const [nama, setNama] = useState(asal?.name ?? "");
  const [lat, setLat] = useState(asal ? String(asal.lat) : "");
  const [lng, setLng] = useState(asal ? String(asal.lng) : "");
  const [radius, setRadius] = useState(String(asal?.radius_m ?? 150));
  const [busy, setBusy] = useState<null | "lokasi" | "simpan">(null);
  const [pautan, setPautan] = useState("");
  const [ralatPautan, setRalatPautan] = useState<string | null>(null);

  function tampal(t: string) {
    setPautan(t);
    if (!t.trim()) return setRalatPautan(null);
    const k = koordinatDaripadaTeks(t);
    if (k) {
      setLat(k.lat.toFixed(6));
      setLng(k.lng.toFixed(6));
      setRalatPautan(null);
    } else {
      setRalatPautan(
        /goo\.gl|maps\.app/.test(t)
          ? tr("Pautan pendek tidak mengandungi koordinat. Buka pautan itu di pelayar, kemudian salin alamat penuh daripada bar alamat.")
          : tr("Koordinat tidak dijumpai dalam teks ini."),
      );
    }
  }
  const [ralat, setRalat] = useState<string | null>(null);

  async function lokasiSaya() {
    setBusy("lokasi");
    setRalat(null);
    try {
      const l = await dapatkanLokasi();
      setLat(l.lat.toFixed(6));
      setLng(l.lng.toFixed(6));
    } catch (e) {
      setRalat((e as Error).message);
    }
    setBusy(null);
  }
  async function simpan() {
    setBusy("simpan");
    setRalat(null);
    try {
      await simpanLokasi(companyId, { name: nama.trim(), lat: Number(lat), lng: Number(lng), radius_m: Number(radius) }, asal?.id);
      onDone();
    } catch (e) {
      setRalat((e as Error).message);
      setBusy(null);
    }
  }
  return (
    <Lembaran title={asal ? tr("Ubah lokasi") : tr("Tambah lokasi pejabat")} onClose={onClose}>
      <MedanBorang label={tr("Nama lokasi")}>
        <input className={inputKecil} value={nama} placeholder={tr("Contoh: Pejabat HQ")} onChange={(e) => setNama(e.target.value)} />
      </MedanBorang>
      <button type="button" disabled={!!busy} onClick={lokasiSaya} className="h-11 rounded-xl border border-line text-sm font-bold text-primary disabled:opacity-60">
        {busy === "lokasi" ? tr("Mengesan lokasi…") : tr("Guna lokasi saya sekarang")}
      </button>
      <MedanBorang
        label={tr("Atau tampal pautan Google Maps / koordinat")}
        nota={tr("Di Google Maps, klik kanan pada lokasi pejabat dan pilih koordinat untuk menyalinnya (cth. 3.073800, 101.518300).")}
      >
        <input className={inputKecil} value={pautan} placeholder="https://www.google.com/maps/@3.0738,101.5183,17z" onChange={(e) => tampal(e.target.value)} />
      </MedanBorang>
      {ralatPautan && <span className="text-xs text-danger">{ralatPautan}</span>}
      <div className="grid grid-cols-2 gap-2">
        <MedanBorang label={tr("Latitud")}>
          <input className={inputKecil} inputMode="decimal" value={lat} placeholder="3.139003" onChange={(e) => setLat(e.target.value)} />
        </MedanBorang>
        <MedanBorang label={tr("Longitud")}>
          <input className={inputKecil} inputMode="decimal" value={lng} placeholder="101.686855" onChange={(e) => setLng(e.target.value)} />
        </MedanBorang>
      </div>
      <MedanBorang label={tr("Radius (meter)")} nota={tr("Jarak dari titik ini yang dikira sebagai di lokasi. Cadangan: 100–300 m.")}>
        <input className={inputKecil} inputMode="numeric" value={radius} onChange={(e) => setRadius(e.target.value.replace(/\D/g, ""))} />
      </MedanBorang>
      {lat && lng && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && (
        <a href={petaUrl(Number(lat), Number(lng))} target="_blank" rel="noreferrer" className="text-sm font-bold">
          {tr("Semak di peta")}
        </a>
      )}
      {ralat && <ErrorBox message={ralat} />}
      <ButangUtama onClick={simpan} busy={busy === "simpan"} disabled={!nama.trim() || !lat || !lng}>
        {tr("Simpan")}
      </ButangUtama>
    </Lembaran>
  );
}
