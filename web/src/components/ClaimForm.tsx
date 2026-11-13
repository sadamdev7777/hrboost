"use client";

import { tr } from "@/lib/i18n";
import { beritahu } from "@/components/Dialog";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getAliranTuntutan, getJenisTuntutan, hantarTuntutan, padamDraf, simpanDraf, type ItemTuntutan } from "@/lib/claims";
import { muatNaikPeribadi, urlSementara } from "@/lib/upload";
import { ringgit, todayISO } from "@/lib/format";
import { panggilAi, type BacaanResit } from "@/lib/ai";
import { IconDocument } from "./icons";
import { BackHeader, ErrorBox, Loading, Screen } from "./ui";

type Resit = { kind: "baru"; file: File; src: "Kamera" | "Galeri" } | { kind: "lama"; path: string };

// Rujukan reka bentuk: design/BuatClaim.dc.html
export function ClaimForm({ claimId, initial }: { claimId?: string; initial?: ItemTuntutan }) {
  const me = useMe();
  const emp = me.active!;
  const router = useRouter();
  const jenis = useData(() => getJenisTuntutan(emp.companyId), [emp.companyId]);
  const aliran = useData(() => getAliranTuntutan(emp.companyId), [emp.companyId]);
  const kamera = useRef<HTMLInputElement>(null);
  const galeri = useRef<HTMLInputElement>(null);

  const [resit, setResit] = useState<Resit[]>(() => (initial?.receipts ?? []).map((path) => ({ kind: "lama" as const, path })));
  const [tanpaResit, setTanpaResit] = useState(!!initial && initial.receipts.length === 0);
  const [typeId, setTypeId] = useState(initial?.claimTypeId ?? "");
  const [tarikh, setTarikh] = useState(initial?.date ?? todayISO());
  const [jumlah, setJumlah] = useState(initial ? String(initial.amount) : "");
  const [km, setKm] = useState(initial?.distanceKm ? String(initial.distanceKm) : "");
  const [tujuan, setTujuan] = useState(initial?.purpose ?? "");
  const [busy, setBusy] = useState<null | "draf" | "hantar" | "padam">(null);
  const [error, setError] = useState<string | null>(null);
  const [ai, setAi] = useState<null | "baca" | "ok">(null);

  const senarai = jenis.data ?? [];
  const perbatuan = senarai.find((j) => j.mileageRate);
  const pilih = typeId || (tanpaResit ? perbatuan?.id : senarai.find((j) => !j.mileageRate)?.id) || "";
  const j = senarai.find((x) => x.id === pilih);
  const isKm = !!j?.mileageRate;
  const amaun = isKm ? Math.round(Number(km || 0) * (j?.mileageRate ?? 0) * 100) / 100 : Number(jumlah || 0);
  const lebihHad = j?.limitPerItem != null && amaun > j.limitPerItem;
  const borang = resit.length > 0 || tanpaResit;

  function tambah(e: React.ChangeEvent<HTMLInputElement>, src: "Kamera" | "Galeri") {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const besar = files.find((f) => f.size > 10 * 1024 * 1024 && f.type === "application/pdf");
    if (besar) setError(tr("{0} melebihi 10 MB.", besar.name));
    const baru = files.filter((f) => f !== besar);
    setResit((r) => [...r, ...baru.map((file) => ({ kind: "baru" as const, file, src }))]);
    // AI membaca resit pertama (gambar/PDF) dan mengisi borang jika masih kosong
    const pertama = baru[0];
    if (pertama && !initial && !jumlah && !tujuan && resit.length === 0) void bacaResit(pertama);
  }

  async function bacaResit(file: File) {
    setAi("baca");
    try {
      const path = await muatNaikPeribadi(me.personId, "resit", file);
      // fail sudah dimuat naik: guna laluan yang sama semasa menyimpan
      setResit((r) => r.map((x) => (x.kind === "baru" && x.file === file ? { kind: "lama" as const, path } : x)));
      const h = await panggilAi<BacaanResit & { ok: boolean }>("ai-receipt", { path, company_id: emp.companyId });
      if (!h.readable) return setAi(null);
      const jenisAi = h.claim_type ? (jenis.data ?? []).find((x) => x.name === h.claim_type && !x.mileageRate) : undefined;
      if (jenisAi) setTypeId(jenisAi.id);
      if (h.amount && h.amount > 0) setJumlah(String(h.amount));
      if (h.date && /^\d{4}-\d{2}-\d{2}$/.test(h.date) && h.date <= todayISO()) setTarikh(h.date);
      if (h.purpose) setTujuan((t) => t || h.purpose);
      setAi("ok");
    } catch {
      setAi(null); // AI tidak tersedia — pekerja mengisi sendiri
    }
  }

  async function simpan(hantar: boolean) {
    setError(null);
    if (!j) return setError(tr("Sila pilih jenis tuntutan."));
    if (!(amaun > 0)) return setError(isKm ? tr("Sila isi jarak perjalanan (km).") : tr("Sila isi jumlah tuntutan."));
    if (!tujuan.trim()) return setError(tr("Sila nyatakan tujuan tuntutan."));
    if (hantar && j.requiresReceipt && resit.length === 0) return setError(tr("{0} memerlukan sekurang-kurangnya satu resit.", j.label));
    setBusy(hantar ? "hantar" : "draf");
    try {
      const paths: string[] = [];
      for (const r of resit) paths.push(r.kind === "lama" ? r.path : await muatNaikPeribadi(me.personId, "resit", r.file));
      const id = await simpanDraf(
        emp.id,
        { claimTypeId: j.id, date: tarikh, amount: amaun, purpose: tujuan, distanceKm: isKm ? Number(km) : null, receipts: paths },
        claimId,
      );
      if (hantar) await hantarTuntutan(id);
      beritahu(hantar ? tr("Tuntutan dihantar untuk kelulusan.") : tr("Draf tuntutan disimpan."));
      router.push("/tuntutan");
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  async function buang() {
    if (!claimId) return;
    setBusy("padam");
    try {
      await padamDraf(claimId);
      beritahu(tr("Draf dipadam."));
      router.push("/tuntutan");
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  const inputs = (
    <>
      <input ref={kamera} type="file" accept="image/*" capture="environment" className="hidden" aria-label={tr("Ambil gambar resit")} onChange={(e) => tambah(e, "Kamera")} />
      <input ref={galeri} type="file" accept="image/*,application/pdf" multiple className="hidden" aria-label={tr("Muat naik resit")} onChange={(e) => tambah(e, "Galeri")} />
    </>
  );

  if (jenis.loading && !jenis.data) {
    return (
      <Screen lebar="sederhana">
        <BackHeader title={tr("Tuntutan Baharu")} href="/tuntutan" />
        <Loading />
      </Screen>
    );
  }

  if (!borang) {
    return (
      <Screen lebar="sederhana">
        <BackHeader title={tr("Tuntutan Baharu")} href="/tuntutan" />
        {inputs}
        <main className="flex grow flex-col gap-3 px-4 pt-2 pb-4">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-xl font-extrabold">{tr("Tambah resit")}</h2>
            <span className="text-sm text-subtle">{tr("Ambil gambar resit atau muat naik e-resit, kemudian isi butirannya.")}</span>
          </div>
          <button type="button" onClick={() => kamera.current?.click()} className="flex min-h-[108px] flex-col items-center justify-center gap-2 rounded-[18px] bg-primary p-3 text-white">
            <CameraIcon />
            <b className="text-sm font-extrabold">{tr("Ambil gambar resit")}</b>
            <span className="text-xs opacity-90">{tr("Buka kamera telefon")}</span>
          </button>
          <button type="button" onClick={() => galeri.current?.click()} className="flex min-h-[108px] flex-col items-center justify-center gap-2 rounded-[18px] border-2 border-primary bg-surface p-3 text-primary">
            <IconDocument size={26} />
            <b className="text-sm font-extrabold">{tr("Muat naik dari galeri / fail")}</b>
            <span className="text-xs text-[#33504B]">{tr("Gambar, tangkapan skrin e-resit atau PDF")}</span>
          </button>
          <div className="flex flex-col gap-2 rounded-[14px] bg-surface px-3.5 py-3">
            <span className="text-xs font-bold tracking-[0.04em] text-subtle">{tr("PANDUAN GAMBAR YANG JELAS")}</span>
            <span className="text-[13px] leading-normal text-[#33504B]">
              {tr("Letakkan resit di atas permukaan rata dengan pencahayaan yang mencukupi, dan pastikan jumlah serta tarikh jelas kelihatan.")}</span>
          </div>
          {error && <ErrorBox message={error} />}
          {perbatuan && (
            <button type="button" onClick={() => setTanpaResit(true)} className="mt-auto min-h-11 text-center text-[13px] font-bold text-primary lg:mt-1 lg:self-start lg:text-left">
              {tr("Tuntutan perbatuan? Isi tanpa resit")}</button>
          )}
        </main>
      </Screen>
    );
  }

  return (
    <Screen lebar="sederhana">
      <BackHeader title={claimId ? tr("Ubah Tuntutan") : tr("Tuntutan Baharu")} href="/tuntutan" />
      {inputs}
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-4">
        {resit.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-3">
            {resit.map((r, i) => (
              <Thumb key={i} r={r} onRemove={() => setResit((x) => x.filter((_, k) => k !== i))} />
            ))}
          </div>
        ) : null}
        <div className="rounded-[14px] bg-primary-soft px-3.5 py-3 text-[13px] leading-[1.45] text-primary-hover">
          {resit.length > 0
            ? tr("{0} resit dilampirkan. Isi jenis, tarikh dan jumlah seperti dalam resit.", resit.length)
            : tr("Tuntutan tanpa resit. Isi jarak perjalanan untuk perbatuan.")}
        </div>
        <div className="flex gap-2">
          <Mini onClick={() => kamera.current?.click()}>{tr("+ Ambil lagi")}</Mini>
          <Mini onClick={() => galeri.current?.click()}>{tr("+ Dari galeri")}</Mini>
        </div>

        {ai && (
            <div className="rounded-[12px] bg-[#F3F0FC] px-3.5 py-2.5 text-[13px] font-semibold text-[#4A3B8C]">
              {ai === "baca" ? tr("AI sedang membaca resit…") : tr("Diisi oleh AI daripada resit — sila semak sebelum menghantar.")}
            </div>
          )}
          <label className="flex flex-col gap-1.5 text-sm font-bold">
          {tr("Jenis")}<select value={pilih} onChange={(e) => setTypeId(e.target.value)} className="h-[46px] rounded-xl border border-line bg-surface px-3.5 text-sm font-semibold text-ink">
            {senarai.map((x) => (
              <option key={x.id} value={x.id}>
                {tr(x.label)}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1.5 text-sm font-bold">
            {tr("Tarikh")}<input type="date" value={tarikh} max={todayISO()} onChange={(e) => e.target.value && setTarikh(e.target.value)} className="h-[46px] rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-ink" />
          </label>
          {isKm ? (
            <label className="flex flex-col gap-1.5 text-sm font-bold">
              {tr("Jarak (km)")}<input type="text" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value.replace(/[^\d.]/g, ""))} className="h-[46px] rounded-xl border border-line bg-surface px-3.5 text-sm font-semibold text-ink" />
            </label>
          ) : (
            <label className="flex flex-col gap-1.5 text-sm font-bold">
              {tr("Jumlah (RM)")}<input type="text" inputMode="decimal" value={jumlah} onChange={(e) => setJumlah(e.target.value.replace(/[^\d.]/g, ""))} className="h-[46px] rounded-xl border border-line bg-surface px-3.5 text-sm font-semibold text-ink" />
            </label>
          )}
        </div>
        {isKm && (
          <span className="-mt-1 text-xs text-muted">
            {tr("{0} km × RM {1} =", km || 0, j!.mileageRate!.toFixed(2))}{" "}<b className="text-ink">{ringgit(amaun)}</b>
          </span>
        )}
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          {tr("Tujuan")}<input type="text" value={tujuan} onChange={(e) => setTujuan(e.target.value)} placeholder={tr("Contoh: Menghantar kumpulan umrah ke KLIA2")} className="h-[46px] rounded-xl border border-line bg-surface px-3.5 text-sm font-semibold text-ink placeholder:font-normal placeholder:text-muted" />
        </label>
        {lebihHad && <span className="rounded-xl bg-warning-soft px-3 py-2 text-xs font-semibold text-warning">{tr("Melebihi had {0} ({1} setiap item). Pelulus akan menyemak.", j!.label, ringgit(j!.limitPerItem))}</span>}
        {aliran.data && <span className="text-xs text-muted">{aliran.data}</span>}
        {error && <ErrorBox message={error} />}
        {claimId && (
          <button type="button" disabled={!!busy} onClick={buang} className="self-start text-[13px] font-bold text-danger">
            {busy === "padam" ? tr("Memadam…") : tr("Padam draf")}
          </button>
        )}
      </main>

      <div className="bar-bawah sticky bottom-0 grid grid-cols-[1fr_2fr] gap-2.5 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
        <button type="button" disabled={!!busy} onClick={() => simpan(false)} className="h-12 rounded-button border-[1.5px] border-line bg-surface text-sm font-bold text-ink disabled:opacity-60">
          {busy === "draf" ? tr("Menyimpan…") : tr("Simpan draf")}
        </button>
        <button type="button" disabled={!!busy} onClick={() => simpan(true)} className="h-12 rounded-button bg-primary text-base font-extrabold text-white hover:bg-primary-hover disabled:opacity-60">
          {busy === "hantar" ? tr("Menghantar…") : tr("Hantar {0}", ringgit(amaun))}
        </button>
      </div>
    </Screen>
  );
}

function Thumb({ r, onRemove }: { r: Resit; onRemove: () => void }) {
  const local = useMemo(() => (r.kind === "baru" && r.file.type.startsWith("image/") ? URL.createObjectURL(r.file) : null), [r]);
  useEffect(() => () => {
    if (local) URL.revokeObjectURL(local);
  }, [local]);
  const remote = useData(() => (r.kind === "lama" ? urlSementara(r.path) : Promise.resolve(null)), [r.kind === "lama" ? r.path : null]);
  const src = local ?? remote.data;
  const pdf = r.kind === "baru" ? r.file.type === "application/pdf" : r.path.endsWith(".pdf");
  return (
    <div className="relative h-[120px] w-[92px] shrink-0 overflow-hidden rounded-xl border border-line bg-surface">
      {src && !pdf ? (
        // eslint-disable-next-line @next/next/no-img-element -- pratonton resit (blob: / URL bertandatangan)
        <img src={src} alt={tr("Resit")} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full items-center justify-center text-xs font-bold text-muted">{pdf ? "PDF" : tr("Resit")}</span>
      )}
      <span className="absolute bottom-1 left-1 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
        {r.kind === "baru" ? r.src : tr("Disimpan")}
      </span>
      <button type="button" onClick={onRemove} aria-label={tr("Buang resit")} className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-surface/90 text-sm font-bold text-danger">
        {tr("×")}</button>
    </div>
  );
}

function Mini({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-[13px] font-bold text-primary">
      {children}
    </button>
  );
}

function CameraIcon() {
  return (
    <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
