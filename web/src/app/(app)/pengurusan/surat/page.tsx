"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useMemo, useState } from "react";
import { TabModul } from "@/components/TabModul";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { tarikh, tarikhTempatan, todayISO } from "@/lib/format";
import { getSurat, LABEL_SURAT_HR, labelSurat, type JenisSuratHr } from "@/lib/urusan";
import { getSenaraiPekerja, type PekerjaRingkas } from "@/lib/hr";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { PengepalaAkar, TabNav } from "@/components/TabNav";
import { HadPeranan, inputKecil, Lembaran, MedanBorang, Tag } from "@/components/Senarai";
import { HURAIAN_SURAT, JanaSurat, JENIS_DARI_PROFIL } from "@/components/JanaSurat";

/**
 * Surat → Semua surat: daftar surat yang dikeluarkan syarikat dan aliran "Jana surat":
 * pilih jenis surat → pilih pekerja (ditapis ikut jenis) → isi butiran → surat A4.
 */
export default function SuratPage() {
  return (
    <HadPeranan roles={["hr", "admin"]}>
      <Kandungan />
    </HadPeranan>
  );
}

/** Pekerja yang layak bagi setiap jenis surat. */
function layak(j: JenisSuratHr, p: PekerjaRingkas): boolean {
  const aktif = p.status === "probation" || p.status === "active";
  if (j === "confirmation" || j === "probation_extension") return p.status === "probation";
  if (j === "resignation_accept" || j === "experience") return !!p.endDate;
  return aktif;
}

/** Susunan senarai pekerja: yang paling mungkin diperlukan dahulu. */
function susun(j: JenisSuratHr, a: PekerjaRingkas, b: PekerjaRingkas): number {
  if (j === "confirmation" || j === "probation_extension") return (a.probationEnd ?? "9999").localeCompare(b.probationEnd ?? "9999");
  if (j === "resignation_accept" || j === "experience") return (b.endDate ?? "").localeCompare(a.endDate ?? "");
  if (j === "offer") return b.joinDate.localeCompare(a.joinDate);
  return a.name.localeCompare(b.name);
}

/** Teks apabila tiada pekerja layak (fungsi supaya teks mengikut bahasa semasa). */
function kosong(j: JenisSuratHr): string {
  if (j === "confirmation" || j === "probation_extension") return tr("Tiada pekerja dalam tempoh percubaan.");
  if (j === "resignation_accept" || j === "experience") return tr("Tiada pekerja yang mempunyai hari bekerja terakhir. Tetapkan dahulu di profil pekerja → Tamatkan pekerjaan.");
  return tr("Tiada pekerja aktif.");
}

function Kandungan() {
  const me = useMe();
  const emp = me.active!;
  const d = useData(() => getSurat(emp.companyId), [emp.companyId]);
  const [jenisTapis, setJenisTapis] = useState("");
  const [cari, setCari] = useState("");
  const [aliran, setAliran] = useState<{ jenis: JenisSuratHr | null; pekerja: PekerjaRingkas | null } | null>(null);

  const semua = d.data ?? [];
  const menunggu = semua.filter((s) => s.status === "pending" && s.source !== "hr").length;
  const dikeluarkan = semua.filter((s) => s.status === "issued");
  const jenisAda = [...new Set(dikeluarkan.map((s) => s.kind))];
  const q = cari.trim().toLowerCase();
  const senarai = dikeluarkan.filter(
    (s) => (!jenisTapis || s.kind === jenisTapis) && (!q || s.name.toLowerCase().includes(q) || s.employee_no.toLowerCase().includes(q) || (s.ref_no ?? "").toLowerCase().includes(q)),
  );

  return (
    <Screen lebar="lebar">
      <PengepalaAkar
        title={tr("Surat")}
        action={
          <button type="button" onClick={() => setAliran({ jenis: null, pekerja: null })} className="h-11 rounded-full bg-primary px-4 text-[13px] font-bold text-white">
            {tr("+ Jana surat")}
          </button>
        }
      />
      <TabModul modul="surat" />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-6 lg:px-0">
        <span className="text-sm leading-normal text-subtle">
          {tr("Surat dijana daripada rekod pekerja: pilih jenis surat, pilih pekerja, isi butiran. Pekerja dimaklumkan dan boleh memuat turun surat sebagai PDF.")}
        </span>
        {menunggu > 0 && (
          <Link href="/pengurusan/surat/permintaan" className="flex min-h-12 items-center gap-3 rounded-card bg-warning-soft px-4 py-2.5 text-sm font-bold text-warning!">
            <span className="grow">{tr("{0} permintaan surat daripada pekerja menunggu", menunggu)}</span>
            <span aria-hidden="true">›</span>
          </Link>
        )}
        <div className="flex flex-wrap gap-2">
          <input className={`${inputKecil} min-w-0 grow basis-56`} value={cari} onChange={(e) => setCari(e.target.value)} placeholder={tr("Cari nama, no. pekerja atau rujukan")} aria-label={tr("Cari surat")} />
          <select className={`${inputKecil} grow basis-48`} value={jenisTapis} onChange={(e) => setJenisTapis(e.target.value)} aria-label={tr("Jenis surat")}>
            <option value="">{tr("Semua jenis surat")}</option>
            {jenisAda.map((k) => (
              <option key={k} value={k}>
                {labelSurat(k)}
              </option>
            ))}
          </select>
        </div>
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data && <Loading />}
        {d.data && senarai.length === 0 && (
          <div className="rounded-card bg-surface px-4 py-8 text-center text-sm text-muted">
            {dikeluarkan.length === 0 ? tr("Belum ada surat dikeluarkan. Tekan + Jana surat untuk mula.") : tr("Tiada surat sepadan dengan carian.")}
          </div>
        )}
        {senarai.length > 0 && (
          <div className="flex flex-col rounded-card bg-surface px-4 lg:px-5 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
            {senarai.map((s) => (
              <Link key={s.id} href={`/surat/${s.id}`} className="flex min-h-16 items-center gap-3 py-3 text-sm text-ink!">
                <span className="flex min-w-0 grow flex-col gap-0.5">
                  <b className="font-bold">{labelSurat(s.kind)}</b>
                  <span className="text-[13px]">
                    {s.name} <span className="text-muted">· {s.employee_no}</span>
                  </span>
                  <span className="text-xs text-muted">
                    {[s.ref_no, s.issued_at ? tarikh(tarikhTempatan(s.issued_at)) : null, s.source === "hr" ? tr("Dikeluarkan oleh HR") : tr("Atas permintaan pekerja")].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {s.kind === "salary_advance" && <Tag tone="neutral">{tr("Memo dalaman")}</Tag>}
                <span aria-hidden="true" className="text-muted">
                  ›
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
      {aliran && !aliran.jenis && <PilihJenis onClose={() => setAliran(null)} onPilih={(j) => setAliran({ jenis: j, pekerja: null })} />}
      {aliran?.jenis && !aliran.pekerja && (
        <PilihPekerja
          companyId={emp.companyId}
          jenis={aliran.jenis}
          onKembali={() => setAliran({ jenis: null, pekerja: null })}
          onClose={() => setAliran(null)}
          onPilih={(p) => setAliran({ jenis: aliran.jenis, pekerja: p })}
        />
      )}
      {aliran?.jenis && aliran.pekerja && (
        <JanaSurat
          employmentId={aliran.pekerja.id}
          nama={aliran.pekerja.name}
          probationEnd={aliran.pekerja.probationEnd}
          jenisAwal={aliran.jenis}
          onKembali={() => setAliran({ jenis: aliran.jenis, pekerja: null })}
          onClose={() => setAliran(null)}
        />
      )}
      <TabNav />
    </Screen>
  );
}

/** Langkah 1: jenis surat */
function PilihJenis({ onClose, onPilih }: { onClose: () => void; onPilih: (j: JenisSuratHr) => void }) {
  return (
    <Lembaran title={tr("Jana surat: pilih jenis")} onClose={onClose} besar>
      <div className="flex flex-col gap-2" role="list" aria-label={tr("Jenis surat")}>
        {JENIS_DARI_PROFIL.map((j) => (
          <button
            key={j}
            type="button"
            role="listitem"
            onClick={() => onPilih(j)}
            className="flex min-h-14 flex-col items-start gap-0.5 rounded-[14px] border border-line bg-surface px-4 py-3 text-left hover:border-primary"
          >
            <b className="text-sm font-bold">{LABEL_SURAT_HR[j]}</b>
            <span className="text-xs leading-snug text-muted">{HURAIAN_SURAT[j]}</span>
          </button>
        ))}
        <span className="pt-1 text-xs leading-snug text-muted">{tr("Memo pendahuluan gaji dijana dari Penggajian → Pendahuluan gaji.")}</span>
      </div>
    </Lembaran>
  );
}

/** Langkah 2: pekerja — hanya yang layak bagi jenis surat itu */
function PilihPekerja({
  companyId,
  jenis,
  onKembali,
  onClose,
  onPilih,
}: {
  companyId: string;
  jenis: JenisSuratHr;
  onKembali: () => void;
  onClose: () => void;
  onPilih: (p: PekerjaRingkas) => void;
}) {
  const d = useData(() => getSenaraiPekerja(companyId, true), [companyId]);
  const [cari, setCari] = useState("");
  const hari = todayISO();
  const layakSemua = useMemo(() => (d.data ?? []).filter((p) => layak(jenis, p)).sort((a, b) => susun(jenis, a, b)), [d.data, jenis]);
  const q = cari.trim().toLowerCase();
  const senarai = layakSemua.filter((x) => !q || x.name.toLowerCase().includes(q) || x.employeeNo.toLowerCase().includes(q)).slice(0, 50);

  function nota(p: PekerjaRingkas): string | null {
    if ((jenis === "confirmation" || jenis === "probation_extension") && p.probationEnd)
      return p.probationEnd < hari ? tr("Percubaan tamat {0} (sudah lepas)", tarikh(p.probationEnd)) : tr("Percubaan tamat {0}", tarikh(p.probationEnd));
    if ((jenis === "resignation_accept" || jenis === "experience") && p.endDate) return tr("Hari bekerja terakhir {0}", tarikh(p.endDate));
    if (jenis === "offer") return tr("Mula bekerja {0}", tarikh(p.joinDate));
    return null;
  }

  return (
    <Lembaran title={LABEL_SURAT_HR[jenis]} onClose={onClose} besar>
      <div className="flex flex-col gap-2.5">
        <span className="text-[13px] leading-snug text-subtle">{tr("Pilih pekerja. Hanya pekerja yang layak bagi surat ini dipaparkan.")}</span>
        <MedanBorang label={tr("Cari pekerja")}>
          <input className={inputKecil} value={cari} autoFocus onChange={(e) => setCari(e.target.value)} placeholder={tr("Nama atau no. pekerja")} />
        </MedanBorang>
        {d.error && <ErrorBox message={d.error} />}
        {!d.data && !d.error && <Loading />}
        {d.data && layakSemua.length === 0 && <div className="rounded-[14px] bg-page px-4 py-6 text-center text-sm text-muted">{kosong(jenis)}</div>}
        {senarai.length > 0 && (
          <div className="flex max-h-[50dvh] flex-col overflow-y-auto rounded-[14px] border border-line-soft [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
            {senarai.map((x) => {
              const n = nota(x);
              return (
                <button key={x.id} type="button" onClick={() => onPilih(x)} className="flex min-h-12 flex-col items-start justify-center px-3.5 py-2 text-left hover:bg-page">
                  <b className="text-sm font-bold">{x.name}</b>
                  <span className="text-xs text-muted">{[x.employeeNo, x.position, x.department, n].filter(Boolean).join(" · ")}</span>
                </button>
              );
            })}
          </div>
        )}
        <button type="button" onClick={onKembali} className="h-12 rounded-button border border-line bg-surface px-5 text-sm font-bold">
          {tr("Kembali")}
        </button>
      </div>
    </Lembaran>
  );
}
