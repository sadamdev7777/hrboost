"use client";

import { tr, trRalat } from "@/lib/i18n";
import { useRef, useState } from "react";
import { hasRole, useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { muatNaikPeribadi, urlSementara } from "@/lib/upload";
import { ringgit, tarikh, todayISO } from "@/lib/format";
import { getSenaraiPekerja } from "@/lib/hr";
import {
  getInventori,
  drafDaripada,
  drafKosong,
  KATEGORI_INVENTORI,
  LABEL_KEADAAN,
  LABEL_STATUS_INVENTORI,
  padamInventori,
  perluDipulang,
  pulangInventori,
  sahkanInventori,
  simpanInventori,
  type DrafInventori,
  type ItemInventori,
} from "@/lib/inventori";
import { ErrorBox } from "./ui";
import { ButangUtama, Lembaran, MedanBorang, Tag, inputKecil } from "./Senarai";
import { beritahu, mintaTeks, sahkan } from "./Dialog";
import { IconDocument } from "./icons";

const MAKS_FAIL = 6;

/** Gambar kecil daripada fail peribadi (URL bertandatangan ≤ 5 minit). Tekan untuk buka saiz penuh. */
export function Lakaran({ path, besar, onBuang }: { path: string; besar?: boolean; onBuang?: () => void }) {
  const u = useData(() => urlSementara(path), [path]);
  const pdf = path.toLowerCase().endsWith(".pdf");
  const saiz = besar ? "size-24" : "size-14";
  return (
    <span className={`relative shrink-0 ${saiz}`}>
      <button
        type="button"
        onClick={async () => {
          const url = await urlSementara(path);
          if (url) window.open(url, "_blank", "noopener");
        }}
        aria-label={pdf ? tr("Buka PDF") : tr("Buka gambar")}
        className={`flex ${saiz} items-center justify-center overflow-hidden rounded-[12px] border border-line bg-page`}
      >
        {pdf ? (
          <IconDocument size={22} className="text-muted" />
        ) : u.data ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={u.data} alt="" className="h-full w-full object-cover" />
        ) : null}
      </button>
      {onBuang && (
        <button type="button" onClick={onBuang} aria-label={tr("Buang fail")} className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-ink text-sm text-white">
          ×
        </button>
      )}
    </span>
  );
}

/** Medan fail: "Ambil gambar" (kamera belakang) + "Muat naik" (galeri / PDF). Fail dimuat naik serta-merta. */
function MedanFail({ label, nota, paths, onChange, pdf }: { label: string; nota?: string; paths: string[]; onChange: (p: string[]) => void; pdf?: boolean }) {
  const me = useMe();
  const kamera = useRef<HTMLInputElement>(null);
  const galeri = useRef<HTMLInputElement>(null);
  const [sibuk, setSibuk] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  async function tambah(e: React.ChangeEvent<HTMLInputElement>) {
    const fail = Array.from(e.target.files ?? []).slice(0, MAKS_FAIL - paths.length);
    e.target.value = "";
    if (!fail.length) return;
    setSibuk(true);
    setRalat(null);
    try {
      const baru: string[] = [];
      for (const f of fail) baru.push(await muatNaikPeribadi(me.personId, "inventori", f));
      onChange([...paths, ...baru]);
    } catch (err) {
      setRalat(err instanceof Error ? err.message : tr("Ralat"));
    }
    setSibuk(false);
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold text-[#33504B]">{label}</span>
      {nota && <span className="-mt-1 text-xs text-muted">{nota}</span>}
      <input ref={kamera} type="file" accept="image/*" capture="environment" className="hidden" aria-label={tr("Ambil gambar")} onChange={tambah} />
      <input ref={galeri} type="file" accept={pdf ? "image/*,application/pdf" : "image/*"} multiple className="hidden" aria-label={tr("Muat naik")} onChange={tambah} />
      {paths.length > 0 && (
        <div className="flex flex-wrap gap-3 pt-1">
          {paths.map((p) => (
            <Lakaran key={p} path={p} onBuang={() => onChange(paths.filter((x) => x !== p))} />
          ))}
        </div>
      )}
      {paths.length < MAKS_FAIL && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={sibuk} onClick={() => kamera.current?.click()} className="h-11 rounded-[12px] bg-primary text-sm font-bold text-white disabled:opacity-60">
            {sibuk ? tr("Memuat naik…") : tr("Ambil gambar")}
          </button>
          <button type="button" disabled={sibuk} onClick={() => galeri.current?.click()} className="h-11 rounded-[12px] border border-primary text-sm font-bold text-primary disabled:opacity-60">
            {tr("Muat naik")}
          </button>
        </div>
      )}
      {ralat && <ErrorBox message={ralat} />}
    </div>
  );
}

/** Borang tambah / ubah item. Pekerja: dipegang sendiri atau lokasi. HR: pilih mana-mana pekerja atau lokasi. */
export function BorangInventori({ item, hr, onClose, onDone }: { item?: ItemInventori; hr: boolean; onClose: () => void; onDone: () => void }) {
  const me = useMe();
  const emp = me.active!;
  const [d, setD] = useState<DrafInventori>(() => (item ? drafDaripada(item) : drafKosong(emp.id)));
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const pekerja = useData(() => (hr ? getSenaraiPekerja(emp.companyId) : Promise.resolve([])), [hr, emp.companyId]);
  const set = <K extends keyof DrafInventori>(k: K, v: DrafInventori[K]) => setD({ ...d, [k]: v });
  const lokasiSahaja = d.employment_id == null;

  async function simpan() {
    if (!d.name.trim()) return setRalat(tr("Sila namakan item."));
    if (lokasiSahaja && !d.location.trim()) return setRalat(tr("Nyatakan lokasi item (cth. Pejabat Seri Kembangan)."));
    if (d.price && !(Number(d.price) >= 0)) return setRalat(tr("Harga tidak sah."));
    if (!hr && d.photo_paths.length === 0 && !(await sahkan({ tajuk: tr("Simpan tanpa gambar?"), mesej: tr("Gambar membantu HR mengenal pasti item. Anda boleh tambah gambar kemudian."), ok: tr("Simpan") }))) return;
    setBusy(true);
    setRalat(null);
    try {
      await simpanInventori(emp.companyId, d, item?.id);
      beritahu(hr ? tr("Item disimpan.") : tr("Item dihantar kepada HR untuk disahkan."));
      onDone();
    } catch (e) {
      setRalat(e instanceof Error ? trRalat(e.message) : tr("Ralat"));
      setBusy(false);
    }
  }

  return (
    <Lembaran title={item ? tr("Ubah item") : tr("Tambah item inventori")} onClose={onClose} besar>
      <div className="flex flex-col gap-3">
        <MedanFail label={tr("Gambar item")} nota={tr("Ambil gambar terus atau pilih dari galeri. Sehingga 6 gambar.")} paths={d.photo_paths} onChange={(p) => set("photo_paths", p)} />
        <MedanBorang label={tr("Nama item")}>
          <input className={inputKecil} value={d.name} onChange={(e) => set("name", e.target.value)} placeholder={tr("Contoh: Laptop Dell Latitude")} />
        </MedanBorang>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MedanBorang label={tr("Kategori")}>
            <select className={inputKecil} value={d.category} onChange={(e) => set("category", e.target.value)}>
              <option value="">{tr("Pilih kategori")}</option>
              {KATEGORI_INVENTORI.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </MedanBorang>
          <MedanBorang label={tr("Jenama / model")}>
            <input className={inputKecil} value={d.brand_model} onChange={(e) => set("brand_model", e.target.value)} placeholder={tr("Contoh: Dell 5440")} />
          </MedanBorang>
          <MedanBorang label={tr("No. siri / tag")}>
            <input className={inputKecil} value={d.serial_no} onChange={(e) => set("serial_no", e.target.value)} />
          </MedanBorang>
          <MedanBorang label={tr("Tarikh beli / terima")}>
            <input type="date" className={inputKecil} value={d.issued_on} max={todayISO()} onChange={(e) => set("issued_on", e.target.value)} />
          </MedanBorang>
          <MedanBorang label={tr("Harga (RM)")}>
            <input className={inputKecil} inputMode="decimal" value={d.price} onChange={(e) => set("price", e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.00" />
          </MedanBorang>
          <MedanBorang label={tr("Keadaan")}>
            <select className={inputKecil} value={d.condition} onChange={(e) => set("condition", e.target.value as DrafInventori["condition"])}>
              {(Object.keys(LABEL_KEADAAN) as (keyof typeof LABEL_KEADAAN)[]).map((k) => (
                <option key={k} value={k}>
                  {LABEL_KEADAAN[k]}
                </option>
              ))}
            </select>
          </MedanBorang>
        </div>

        <MedanBorang label={tr("Siapa memegang item ini?")}>
          {hr ? (
            <select className={inputKecil} value={d.employment_id ?? ""} onChange={(e) => set("employment_id", e.target.value || null)}>
              <option value="">{tr("Tiada pemegang (di lokasi)")}</option>
              {(pekerja.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.department ? ` · ${p.department}` : ""}
                </option>
              ))}
            </select>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {[
                [emp.id, tr("Saya")],
                [null, tr("Di pejabat / lokasi")],
              ].map(([v, l]) => (
                <button
                  key={String(v)}
                  type="button"
                  aria-pressed={d.employment_id === v}
                  onClick={() => set("employment_id", v)}
                  className={`h-11 rounded-[12px] text-sm font-bold ${d.employment_id === v ? "border-[1.5px] border-primary bg-[#E3F1EE] text-primary" : "border border-[#D5DEDC] bg-surface"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
        </MedanBorang>
        <MedanBorang label={lokasiSahaja ? tr("Lokasi") : tr("Lokasi (pilihan)")}>
          <input className={inputKecil} value={d.location} onChange={(e) => set("location", e.target.value)} placeholder={tr("Contoh: Pejabat Seri Kembangan, tingkat 1")} />
        </MedanBorang>

        <MedanFail label={tr("Resit (jika ada)")} nota={tr("Gambar resit atau PDF invois.")} paths={d.receipt_paths} onChange={(p) => set("receipt_paths", p)} pdf />
        <MedanBorang label={tr("Catatan (pilihan)")}>
          <textarea rows={2} value={d.note} onChange={(e) => set("note", e.target.value)} className="rounded-[12px] border border-[#D5DEDC] bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary" />
        </MedanBorang>
        {!hr && <span className="text-xs text-muted">{tr("Item akan disemak oleh HR sebelum masuk ke inventori rasmi syarikat.")}</span>}
        {ralat && <ErrorBox message={ralat} />}
        <ButangUtama onClick={simpan} busy={busy}>
          {hr ? tr("Simpan") : item ? tr("Hantar semula") : tr("Hantar kepada HR")}
        </ButangUtama>
      </div>
    </Lembaran>
  );
}

/** Butiran item: gambar, resit, maklumat; tindakan ikut peranan. */
export function ButiranInventori({ x, hr, onClose, onUbah, onSelesai }: { x: ItemInventori; hr: boolean; onClose: () => void; onUbah: () => void; onSelesai: () => void }) {
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const st = LABEL_STATUS_INVENTORI[x.status];
  async function jalan(f: () => Promise<void>, mesej: string) {
    setBusy(true);
    setRalat(null);
    try {
      await f();
      beritahu(mesej);
      onSelesai();
    } catch (e) {
      setRalat(e instanceof Error ? trRalat(e.message) : tr("Ralat"));
      setBusy(false);
    }
  }
  const butir: [string, string | null][] = [
    [tr("Kategori"), x.category],
    [tr("Jenama / model"), x.brand_model],
    [tr("No. siri / tag"), x.serial_no],
    [tr("Harga"), x.price != null ? ringgit(Number(x.price)) : null],
    [tr("Tarikh beli / terima"), x.issued_on ? tarikh(x.issued_on) : null],
    [tr("Keadaan"), LABEL_KEADAAN[x.condition]],
    [tr("Pemegang"), x.holder ? [x.holder, x.department].filter(Boolean).join(" · ") : null],
    [tr("Lokasi"), x.location],
    [tr("Direkod oleh"), x.created_by_name],
    [tr("Dipulangkan"), x.returned_on ? tarikh(x.returned_on) : null],
    [tr("Catatan"), x.note],
  ];
  return (
    <Lembaran title={x.name} onClose={onClose} besar>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone={st.tone}>{st.l}</Tag>
          {x.returned_on && <Tag tone="neutral">{tr("Dipulangkan")}</Tag>}
        </div>
        {x.status === "rejected" && x.reject_reason && <span className="rounded-[12px] bg-danger-soft px-3 py-2 text-sm text-danger">{tr("Sebab HR: {0}", x.reject_reason)}</span>}
        {x.photo_paths.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {x.photo_paths.map((p) => (
              <Lakaran key={p} path={p} besar />
            ))}
          </div>
        )}
        <div className="flex flex-col rounded-card border border-line-soft px-4 text-sm [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
          {butir
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="flex min-h-11 items-center justify-between gap-3 py-2">
                <span className="text-muted">{k}</span>
                <b className="text-right font-semibold">{v}</b>
              </div>
            ))}
        </div>
        {x.receipt_paths.length > 0 && (
          <div className="flex flex-col gap-2">
            <b className="text-sm">{tr("Resit")}</b>
            <div className="flex flex-wrap gap-3">
              {x.receipt_paths.map((p) => (
                <Lakaran key={p} path={p} />
              ))}
            </div>
          </div>
        )}
        {ralat && <ErrorBox message={ralat} />}
        <div className="flex flex-wrap gap-2">
          {hr && x.status === "pending" && (
            <>
              <button type="button" disabled={busy} onClick={() => jalan(() => sahkanInventori(x.id, true), tr("Item disahkan."))} className="h-11 grow rounded-[12px] bg-primary px-4 text-sm font-bold text-white disabled:opacity-60">
                {tr("Sahkan")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const s = await mintaTeks({ tajuk: tr("Kembalikan kepada pekerja"), label: tr("Apa yang perlu dibetulkan?"), ok: tr("Kembalikan") });
                  if (s) await jalan(() => sahkanInventori(x.id, false, s), tr("Item dikembalikan kepada pekerja."));
                }}
                className="h-11 grow rounded-[12px] border border-line px-4 text-sm font-bold text-danger disabled:opacity-60"
              >
                {tr("Kembalikan")}
              </button>
            </>
          )}
          {x.editable && (
            <button type="button" disabled={busy} onClick={onUbah} className="h-11 grow rounded-[12px] border border-primary px-4 text-sm font-bold text-primary disabled:opacity-60">
              {tr("Ubah")}
            </button>
          )}
          {hr && x.status === "verified" && !x.returned_on && x.employment_id && (
            <button type="button" disabled={busy} onClick={() => jalan(() => pulangInventori(x.id, todayISO()), tr("Item ditanda dipulangkan."))} className="h-11 grow rounded-[12px] border border-line px-4 text-sm font-bold disabled:opacity-60">
              {tr("Tanda dipulangkan")}
            </button>
          )}
          {x.editable && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (await sahkan({ tajuk: tr("Buang item ini?"), mesej: tr("Rekod item akan dipadam."), ok: tr("Buang"), bahaya: true })) await jalan(() => padamInventori(x.id), tr("Item dibuang."));
              }}
              className="h-11 rounded-[12px] px-4 text-sm font-bold text-danger disabled:opacity-60"
            >
              {tr("Buang")}
            </button>
          )}
        </div>
      </div>
    </Lembaran>
  );
}

/** Baris item untuk senarai (telefon & desktop). */
export function BarisInventori({ x, onClick, tunjukPemegang }: { x: ItemInventori; onClick: () => void; tunjukPemegang?: boolean }) {
  const st = LABEL_STATUS_INVENTORI[x.status];
  return (
    <button type="button" onClick={onClick} className="flex min-h-[72px] w-full items-center gap-3 py-2.5 text-left">
      {x.photo_paths[0] ? (
        <Lakaran path={x.photo_paths[0]} />
      ) : (
        <span className="flex size-14 shrink-0 items-center justify-center rounded-[12px] bg-page text-xs text-muted">{tr("Tiada gambar")}</span>
      )}
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <b className="truncate text-sm font-bold">{x.name}</b>
        <span className="truncate text-xs text-muted">
          {[x.category, tunjukPemegang ? (x.holder ?? x.location) : x.employment_id ? null : x.location, x.price != null ? ringgit(Number(x.price)) : null].filter(Boolean).join(" · ")}
        </span>
      </span>
      {x.returned_on ? <Tag tone="neutral">{tr("Dipulangkan")}</Tag> : perluDipulang(x) ? <Tag tone="danger">{tr("Perlu dipulangkan")}</Tag> : <Tag tone={st.tone}>{st.l}</Tag>}
    </button>
  );
}

/**
 * HR: item syarikat yang masih dipegang oleh seorang pekerja (belum dipulangkan) — dalam dialog
 * Tamatkan pekerjaan dan profil pekerja yang berhenti. Tidak dipaparkan jika tiada item.
 */
export function ItemBelumDipulang({ employmentId, nota }: { employmentId: string; nota?: string }) {
  const me = useMe();
  const hr = hasRole(me, ["hr", "admin"]);
  const d = useData(() => (hr ? getInventori(me.active!.companyId, "all") : Promise.resolve([])), [hr, me.active?.companyId]);
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [ralat, setRalat] = useState<string | null>(null);
  const item = (d.data ?? []).filter((x) => x.employment_id === employmentId && !x.returned_on && x.status !== "rejected");
  if (!hr || item.length === 0) return null;
  const jumlah = item.reduce((a, x) => a + Number(x.price ?? 0), 0);
  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-warning/30 bg-warning-soft px-4 py-3 text-sm">
      <b className="text-warning">{tr("{0} item syarikat belum dipulangkan", item.length)}{jumlah > 0 ? ` · ${ringgit(jumlah)}` : ""}</b>
      {nota && <span className="text-xs leading-snug text-warning">{nota}</span>}
      <div className="flex flex-col rounded-[12px] bg-surface px-3 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
        {item.map((x) => (
          <div key={x.id} className="flex min-h-[64px] items-center gap-3 py-2">
            {x.photo_paths[0] ? <Lakaran path={x.photo_paths[0]} /> : <span className="flex size-14 shrink-0 items-center justify-center rounded-[12px] bg-page text-[11px] text-muted">-</span>}
            <span className="flex min-w-0 grow flex-col">
              <b className="truncate">{x.name}</b>
              <span className="truncate text-xs text-muted">{[x.category, x.serial_no, x.price != null ? ringgit(Number(x.price)) : null].filter(Boolean).join(" · ")}</span>
            </span>
            <button
              type="button"
              disabled={sibuk === x.id}
              onClick={async () => {
                setSibuk(x.id);
                setRalat(null);
                try {
                  await pulangInventori(x.id, todayISO());
                  beritahu(tr("{0} ditanda dipulangkan.", x.name));
                  d.reload();
                } catch (e) {
                  setRalat(e instanceof Error ? trRalat(e.message) : tr("Ralat"));
                }
                setSibuk(null);
              }}
              className="h-11 shrink-0 rounded-[12px] border border-primary px-3 text-[13px] font-bold text-primary disabled:opacity-60"
            >
              {tr("Dipulangkan")}
            </button>
          </div>
        ))}
      </div>
      {ralat && <ErrorBox message={ralat} />}
    </div>
  );
}
