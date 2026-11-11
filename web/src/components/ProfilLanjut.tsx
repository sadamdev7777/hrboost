"use client";

import { tr, trRalat } from "@/lib/i18n";
import { useState, type ReactNode } from "react";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { tarikhPenuh } from "@/lib/format";
import { ErrorBox, Loading } from "./ui";
import { Lembaran, Seksyen, Tag } from "./Senarai";
import { sahkan } from "./Dialog";

/**
 * Profil pekerja lanjutan (setara tab BrioHR): Garis masa kerja, Keluarga, Aset syarikat, Latihan & sijil.
 * Satu komponen senarai + borang generik dipacu konfigurasi supaya setiap bahagian ringkas dan seragam.
 */

type Jadual = "job_timeline" | "family_members" | "company_assets" | "trainings";
type JenisMedan = "teks" | "tarikh" | "pilih" | "suis";
type Medan = { k: string; label: string; jenis?: JenisMedan; pilihan?: { v: string; l: string }[]; wajib?: boolean; lebar?: boolean };
type Rekod = Record<string, string | boolean | null> & { id: string };

const sb = () => getSupabase();

async function senarai(jadual: Jadual, employmentId: string, susun: string): Promise<Rekod[]> {
  return (must(await sb().from(jadual).select("*").eq("employment_id", employmentId).order(susun, { ascending: false, nullsFirst: false })) ?? []) as unknown as Rekod[];
}

async function simpan(jadual: Jadual, employmentId: string, id: string | null, data: Record<string, unknown>) {
  const q = id ? sb().from(jadual).update(data as never).eq("id", id) : sb().from(jadual).insert({ ...data, employment_id: employmentId } as never);
  must(await q);
}

async function buang(jadual: Jadual, id: string) {
  must(await sb().from(jadual).delete().eq("id", id));
}

const kotak = "h-11 w-full rounded-[12px] border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary";

function Borang({ tajuk, medan, asal, onClose, onSimpan }: { tajuk: string; medan: Medan[]; asal: Partial<Rekod>; onClose: () => void; onSimpan: (d: Record<string, unknown>) => Promise<void> }) {
  const [f, setF] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(
      medan.map((m) => [
        m.k,
        // Rekod baharu: tarikh wajib diisi hari ini secara lalai
        m.jenis === "suis" ? !!asal[m.k] : ((asal[m.k] as string | null) ?? (m.jenis === "tarikh" && m.wajib && !asal.id ? new Date().toISOString().slice(0, 10) : (m.pilihan?.[0]?.v ?? ""))),
      ]),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);

  async function hantar() {
    const kosong = medan.find((m) => m.wajib && !String(f[m.k] ?? "").trim());
    if (kosong) return setRalat(tr("Sila isi {0}.", kosong.label.toLowerCase()));
    setBusy(true);
    setRalat(null);
    try {
      await onSimpan(Object.fromEntries(medan.map((m) => [m.k, m.jenis === "suis" ? !!f[m.k] : String(f[m.k] ?? "").trim() || null])));
    } catch (e) {
      setRalat(e instanceof Error ? trRalat(e.message) : tr("Ralat"));
      setBusy(false);
    }
  }

  return (
    <Lembaran title={tajuk} onClose={onClose}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {medan.map((m) => (
          <label key={m.k} className={`flex flex-col gap-1 text-[13px] font-bold text-[#4A5A57] ${m.lebar || m.jenis === "suis" ? "sm:col-span-2" : ""} ${m.jenis === "suis" ? "flex-row items-center gap-2.5" : ""}`}>
            {m.jenis === "suis" ? (
              <>
                <input type="checkbox" checked={!!f[m.k]} onChange={(e) => setF({ ...f, [m.k]: e.target.checked })} className="size-5 accent-primary" />
                {m.label}
              </>
            ) : (
              <>
                {m.label}
                {m.jenis === "pilih" ? (
                  <select value={String(f[m.k] ?? "")} onChange={(e) => setF({ ...f, [m.k]: e.target.value })} className={kotak}>
                    {m.pilihan!.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.l}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input type={m.jenis === "tarikh" ? "date" : "text"} value={String(f[m.k] ?? "")} onChange={(e) => setF({ ...f, [m.k]: e.target.value })} className={kotak} />
                )}
              </>
            )}
          </label>
        ))}
      </div>
      {ralat && <ErrorBox message={ralat} />}
      <button type="button" onClick={hantar} disabled={busy} className="flex h-12 items-center justify-center rounded-button bg-primary text-base font-extrabold text-white disabled:opacity-50">
        {busy ? tr("Menyimpan…") : tr("Simpan")}
      </button>
    </Lembaran>
  );
}

/** Senarai rekod generik dengan butang Tambah / Ubah / Padam (HR sahaja). */
function SenaraiRekod({
  jadual,
  employmentId,
  boleh,
  tajuk,
  tambah,
  kosong,
  medan,
  susun,
  baris,
  tapis,
}: {
  jadual: Jadual;
  employmentId: string;
  boleh: boolean;
  tajuk: string;
  tambah: string;
  kosong: string;
  medan: Medan[];
  susun: string;
  baris: (r: Rekod) => ReactNode;
  tapis?: (r: Rekod) => boolean;
}) {
  const d = useData(() => senarai(jadual, employmentId, susun), [jadual, employmentId]);
  const [ubah, setUbah] = useState<Partial<Rekod> | null>(null);
  const rows = (d.data ?? []).filter((r) => !tapis || tapis(r));

  async function padam(r: Rekod) {
    if (!(await sahkan({ tajuk: tr("Padam rekod ini?"), mesej: tr("Rekod akan dibuang daripada profil pekerja."), ok: tr("Padam"), bahaya: true }))) return;
    await buang(jadual, r.id);
    d.reload();
  }

  return (
    <section aria-label={tajuk} className="flex flex-col gap-2">
      <div className="flex min-h-10 items-center justify-between gap-2">
        <Seksyen>{tajuk}</Seksyen>
        {boleh && (
          <button type="button" onClick={() => setUbah({})} className="flex h-10 items-center rounded-full border border-primary bg-surface px-4 text-[13px] font-bold text-primary">
            {tambah}
          </button>
        )}
      </div>
      {d.error && <ErrorBox message={d.error} />}
      {d.loading && !d.data && <Loading />}
      {d.data && (
        <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
          {rows.length === 0 && <span className="py-4 text-sm text-muted">{kosong}</span>}
          {rows.map((r) => (
            <div key={r.id} className="flex items-start gap-3 py-3 text-sm">
              <div className="flex min-w-0 grow flex-col gap-0.5">{baris(r)}</div>
              {boleh && (
                <span className="flex shrink-0">
                  <button type="button" onClick={() => setUbah(r)} className="flex min-h-10 items-center px-2 text-[13px] font-bold text-primary">
                    {tr("Ubah")}
                  </button>
                  <button type="button" onClick={() => padam(r)} className="flex min-h-10 items-center px-2 text-[13px] font-bold text-danger">
                    {tr("Padam")}
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {ubah && (
        <Borang
          tajuk={ubah.id ? tr("Ubah: {0}", tajuk.toLowerCase()) : tambah.replace(/^\+\s*/, "")}
          medan={medan}
          asal={ubah}
          onClose={() => setUbah(null)}
          onSimpan={async (data) => {
            await simpan(jadual, employmentId, (ubah.id as string) ?? null, data);
            setUbah(null);
            d.reload();
          }}
        />
      )}
    </section>
  );
}

const t = (s: string | boolean | null | undefined) => (typeof s === "string" && s ? s : null);
const tkh = (s: string | boolean | null | undefined) => (typeof s === "string" && s ? tarikhPenuh(s) : null);

// ---------------------------------------------------------------------------------------------
// 1. Garis masa kerja
export const LABEL_PERISTIWA: Record<string, string> = {
  started: tr("Mula bekerja di syarikat"),
  promoted: tr("Kenaikan / tukar jawatan"),
  transferred: tr("Pertukaran jabatan"),
  changed: tr("Tukar ketua"),
  confirmed: tr("Disahkan jawatan"),
  type_changed: tr("Tukar jenis pekerjaan"),
  ended: tr("Tamat pekerjaan"),
};
const LABEL_JENIS: Record<string, string> = { permanent: tr("Tetap"), contract: tr("Kontrak"), part_time: tr("Separuh masa"), intern: tr("Praktikal") };

export function GarisMasaKerja({ employmentId, boleh }: { employmentId: string; boleh: boolean }) {
  return (
    <SenaraiRekod
      jadual="job_timeline"
      employmentId={employmentId}
      boleh={boleh}
      tajuk={tr("GARIS MASA KERJA")}
      tambah={tr("+ Tambah peristiwa")}
      kosong={tr("Tiada rekod lagi.")}
      susun="effective_date"
      medan={[
        { k: "effective_date", label: tr("Tarikh berkuat kuasa"), jenis: "tarikh", wajib: true },
        // Peristiwa manual yang paling biasa didahulukan ("Mula bekerja" sudah direkod automatik)
        { k: "event", label: tr("Peristiwa"), jenis: "pilih", pilihan: ["promoted", "transferred", "changed", "type_changed", "confirmed", "started", "ended"].map((v) => ({ v, l: LABEL_PERISTIWA[v] })) },
        { k: "position", label: tr("Jawatan") },
        { k: "department", label: tr("Jabatan") },
        { k: "manager", label: tr("Ketua") },
        { k: "employment_type", label: tr("Jenis pekerjaan"), jenis: "pilih", pilihan: [{ v: "", l: "-" }, ...Object.entries(LABEL_JENIS).map(([v, l]) => ({ v, l }))] },
        { k: "note", label: tr("Catatan / sebab"), lebar: true },
      ]}
      baris={(r) => (
        <>
          <span className="flex flex-wrap items-center gap-2">
            <b className="font-bold">{LABEL_PERISTIWA[r.event as string] ?? (r.event as string)}</b>
            <span className="text-xs text-muted">{tkh(r.effective_date)}</span>
            {r.source === "import" && <Tag tone="neutral">{tr("Import")}</Tag>}
          </span>
          <span className="text-[13px] text-subtle">
            {[t(r.position), t(r.department), t(r.manager) && tr("Ketua: {0}", r.manager as string), t(r.employment_type) && LABEL_JENIS[r.employment_type as string]].filter(Boolean).join(" · ") || "-"}
          </span>
          {t(r.note) && <span className="text-xs text-muted">{r.note as string}</span>}
        </>
      )}
    />
  );
}

// ---------------------------------------------------------------------------------------------
// 2. Keluarga
const PENGAJIAN = [
  { v: "none", l: tr("Tidak belajar / bawah 18") },
  { v: "school", l: tr("Sekolah") },
  { v: "preu", l: tr("Pra-universiti") },
  { v: "higher", l: tr("Diploma / ijazah") },
];

export function Keluarga({ employmentId, boleh }: { employmentId: string; boleh: boolean }) {
  return (
    <SenaraiRekod
      jadual="family_members"
      employmentId={employmentId}
      boleh={boleh}
      tajuk={tr("KELUARGA")}
      tambah={tr("+ Tambah ahli keluarga")}
      kosong={tr("Tiada maklumat pasangan atau anak.")}
      susun="relation"
      medan={[
        { k: "relation", label: tr("Hubungan"), jenis: "pilih", pilihan: [{ v: "spouse", l: tr("Pasangan") }, { v: "child", l: tr("Anak") }] },
        { k: "name", label: tr("Nama"), wajib: true },
        { k: "ic_no", label: tr("No. kad pengenalan") },
        { k: "birth_date", label: tr("Tarikh lahir"), jenis: "tarikh" },
        { k: "studying", label: tr("Pengajian (anak)"), jenis: "pilih", pilihan: PENGAJIAN },
        { k: "working", label: tr("Bekerja (pasangan)"), jenis: "suis" },
        { k: "disabled", label: tr("OKU"), jenis: "suis" },
      ]}
      baris={(r) => (
        <>
          <span className="flex flex-wrap items-center gap-2">
            <b className="font-bold">{r.name as string}</b>
            <Tag tone="neutral">{r.relation === "spouse" ? tr("Pasangan") : tr("Anak")}</Tag>
            {r.disabled === true && <Tag tone="warning">{tr("OKU")}</Tag>}
          </span>
          <span className="text-[13px] text-subtle">
            {[
              tkh(r.birth_date),
              r.relation === "spouse" ? (r.working ? tr("Bekerja") : tr("Tidak bekerja")) : PENGAJIAN.find((p) => p.v === r.studying)?.l,
            ]
              .filter(Boolean)
              .join(" · ") || "-"}
          </span>
        </>
      )}
    />
  );
}

// ---------------------------------------------------------------------------------------------
// 3. Aset syarikat
const KATEGORI_ASET = [tr("Komputer riba"), tr("Telefon"), tr("Tablet"), tr("Kad akses"), tr("Kunci"), tr("Kenderaan"), tr("Pakaian seragam"), tr("Lain-lain")];

export function AsetSyarikat({ employmentId, boleh }: { employmentId: string; boleh: boolean }) {
  return (
    <SenaraiRekod
      jadual="company_assets"
      employmentId={employmentId}
      boleh={boleh}
      tajuk={tr("ASET SYARIKAT")}
      tambah={tr("+ Tambah aset")}
      kosong={tr("Tiada aset syarikat dipegang oleh pekerja ini.")}
      susun="issued_on"
      medan={[
        { k: "name", label: tr("Nama aset"), wajib: true },
        { k: "category", label: tr("Kategori"), jenis: "pilih", pilihan: KATEGORI_ASET.map((v) => ({ v, l: v })) },
        { k: "serial_no", label: tr("No. siri / tag") },
        { k: "issued_on", label: tr("Tarikh diserahkan"), jenis: "tarikh" },
        { k: "returned_on", label: tr("Tarikh dipulangkan"), jenis: "tarikh" },
        { k: "note", label: tr("Catatan"), lebar: true },
      ]}
      baris={(r) => (
        <>
          <span className="flex flex-wrap items-center gap-2">
            <b className="font-bold">{r.name as string}</b>
            {r.returned_on ? <Tag tone="neutral">{tr("Dipulangkan")}</Tag> : <Tag tone="success">{tr("Dipegang")}</Tag>}
          </span>
          <span className="text-[13px] text-subtle">
            {[t(r.category), t(r.serial_no), tkh(r.issued_on) && tr("Diserahkan {0}", tkh(r.issued_on)!), tkh(r.returned_on) && tr("Dipulangkan {0}", tkh(r.returned_on)!)].filter(Boolean).join(" · ") || "-"}
          </span>
        </>
      )}
    />
  );
}

// ---------------------------------------------------------------------------------------------
// 4. Latihan & sijil
export function LatihanSijil({ employmentId, boleh }: { employmentId: string; boleh: boolean }) {
  const hari = (s: string) => Math.ceil((new Date(s).getTime() - Date.now()) / 864e5);
  return (
    <SenaraiRekod
      jadual="trainings"
      employmentId={employmentId}
      boleh={boleh}
      tajuk={tr("LATIHAN & SIJIL")}
      tambah={tr("+ Tambah latihan / sijil")}
      kosong={tr("Tiada rekod latihan atau sijil.")}
      susun="start_date"
      medan={[
        { k: "kind", label: tr("Jenis"), jenis: "pilih", pilihan: [{ v: "training", l: tr("Latihan") }, { v: "certification", l: tr("Sijil") }] },
        { k: "title", label: tr("Tajuk"), wajib: true },
        { k: "provider", label: tr("Penganjur / badan pensijilan") },
        { k: "start_date", label: tr("Tarikh mula / dikeluarkan"), jenis: "tarikh" },
        { k: "end_date", label: tr("Tarikh tamat latihan"), jenis: "tarikh" },
        { k: "expiry_date", label: tr("Sijil tamat tempoh"), jenis: "tarikh" },
        { k: "note", label: tr("Catatan"), lebar: true },
      ]}
      baris={(r) => {
        const tamat = typeof r.expiry_date === "string" && r.expiry_date ? hari(r.expiry_date) : null;
        return (
          <>
            <span className="flex flex-wrap items-center gap-2">
              <b className="font-bold">{r.title as string}</b>
              <Tag tone="neutral">{r.kind === "certification" ? tr("Sijil") : tr("Latihan")}</Tag>
              {tamat !== null && tamat < 0 && <Tag tone="danger">{tr("Tamat tempoh")}</Tag>}
              {tamat !== null && tamat >= 0 && tamat <= 60 && <Tag tone="warning">{tr("Tamat dalam {0} hari", tamat)}</Tag>}
            </span>
            <span className="text-[13px] text-subtle">
              {[t(r.provider), tkh(r.start_date), tkh(r.expiry_date) && tr("Sah hingga {0}", tkh(r.expiry_date)!)].filter(Boolean).join(" · ") || "-"}
            </span>
          </>
        );
      }}
    />
  );
}
