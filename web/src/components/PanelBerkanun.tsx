"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { ringgit, todayISO } from "@/lib/format";
import { BULAN_RINGKAS } from "@/lib/gaji";
import { KATEGORI_TP1, buangTp1, getBerkanun, getTp1, simpanBerkanun, tambahTp1, type Berkanun } from "@/lib/gajiLengkap";
import { ErrorBox } from "./ui";
import { ButangUtama, Cip, Lembaran, MedanBorang, Suis, inputKecil } from "./Senarai";
import { beritahu, sahkan } from "./Dialog";

const KWSP: Record<Berkanun["epf_category"], string> = {
  auto: tr("Automatik (ikut warganegara & umur)"),
  citizen: tr("Warganegara / PR"),
  foreign: tr("Pekerja asing (2%)"),
  none: tr("Tidak mencarum"),
};
const PERKESO: Record<Berkanun["socso_category"], string> = {
  auto: tr("Automatik (ikut umur & warganegara)"),
  cat1: tr("Kategori 1 (bencana pekerjaan & ilat)"),
  cat2: tr("Kategori 2 (bencana pekerjaan sahaja, 60 tahun ke atas)"),
  foreign: tr("Pekerja asing (bencana pekerjaan sahaja)"),
  none: tr("Tidak mencarum"),
};
const YA_TIDAK: Record<"auto" | "yes" | "no", string> = { auto: tr("Automatik"), yes: tr("Ya"), no: tr("Tidak") };

/** Maklumat berkanun & cukai seorang pekerja (HR): pemastautin, OKU, anak, kategori KWSP/PERKESO, SIP, SKBBK, zakat, CP38, TP1. */
export function PanelBerkanun({ employmentId, nama }: { employmentId: string; nama: string }) {
  const me = useMe();
  const bolehUbah = me.roles.some((r) => ["hr", "admin"].includes(r));
  const d = useData(() => getBerkanun(employmentId), [employmentId]);
  const [ubah, setUbah] = useState(false);
  const b = d.data;
  const y = Number(todayISO().slice(0, 4));
  const anak = b ? b.child_u18 + b.child_higher + b.child_disabled + b.child_disabled_higher : 0;

  return (
    <section aria-label={tr("Maklumat berkanun & cukai")} className="mt-2 flex flex-col gap-2.5 rounded-card bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <b className="grow text-sm font-extrabold">{tr("Maklumat berkanun & cukai")}</b>
        {bolehUbah && b && (
          <button type="button" onClick={() => setUbah(true)} className="flex h-10 items-center rounded-full border border-primary px-4 text-[13px] font-bold text-primary">
            {tr("Ubah")}
          </button>
        )}
      </div>
      {d.error && <ErrorBox message={d.error} />}
      {b && (
        <dl className="m-0 grid grid-cols-1 gap-x-6 text-sm sm:grid-cols-2 [&>div]:flex [&>div]:min-h-10 [&>div]:items-center [&>div]:justify-between [&>div]:gap-3 [&>div]:border-b [&>div]:border-[#EEF2F1]">
          <Baris k={tr("Taraf cukai")} v={b.resident ? tr("Pemastautin") : tr("Bukan pemastautin (30%)")} />
          <Baris k={tr("OKU")} v={[b.disabled && tr("Pekerja"), b.spouse_disabled && tr("Pasangan")].filter(Boolean).join(", ") || tr("Tiada")} />
          <Baris k={tr("Anak layak pelepasan")} v={anak ? tr("{0} orang{1}", anak, b.child_shared ? tr(" (dikongsi 50%)") : "") : tr("Tiada")} />
          <Baris k="KWSP" v={b.epf_employee_rate !== null ? tr("{0} · pekerja {1}%", KWSP[b.epf_category], b.epf_employee_rate) : KWSP[b.epf_category]} />
          <Baris k="PERKESO" v={PERKESO[b.socso_category]} />
          <Baris k={tr("SIP / SKBBK")} v={`${YA_TIDAK[b.eis]} / ${YA_TIDAK[b.skbbk]}`} />
          <Baris k={tr("Zakat sebulan")} v={b.zakat_monthly ? ringgit(b.zakat_monthly) : tr("Tiada")} />
          <Baris k={tr("Potongan CP38")} v={b.cp38_monthly ? tr("{0} hingga {1}", ringgit(b.cp38_monthly), b.cp38_until ?? "—") : tr("Tiada")} />
        </dl>
      )}
      <Tp1 employmentId={employmentId} tahun={y} bolehUbah={bolehUbah} />
      <div className="flex flex-wrap gap-2 pt-1">
        <Link href={`/pengurusan/gaji/pcb/${employmentId}?y=${y}`} className="flex h-10 items-center rounded-full border border-line px-3.5 text-[13px] font-bold text-ink!">
          {tr("Penyata PCB (PCB II)")}
        </Link>
        <Link href={`/pengurusan/gaji/cp22/${employmentId}`} className="flex h-10 items-center rounded-full border border-line px-3.5 text-[13px] font-bold text-ink!">
          {tr("Borang CP22 (pekerja baharu)")}
        </Link>
      </div>
      {ubah && b && (
        <BorangBerkanun
          employmentId={employmentId}
          nama={nama}
          awal={b}
          onClose={(ok) => {
            setUbah(false);
            if (ok) d.reload();
          }}
        />
      )}
    </section>
  );
}

function Baris({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div>
      <dt className="text-muted">{k}</dt>
      <dd className="m-0 text-right font-semibold">{v}</dd>
    </div>
  );
}

function Tp1({ employmentId, tahun, bolehUbah }: { employmentId: string; tahun: number; bolehUbah: boolean }) {
  const d = useData(() => getTp1(employmentId, tahun), [employmentId, tahun]);
  const [baru, setBaru] = useState(false);
  const xs = d.data ?? [];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="grow text-[13px] font-bold text-[#4A5A57]">{tr("Pelepasan TP1 {0} (mengurangkan PCB)", tahun)}</span>
        {bolehUbah && (
          <button type="button" onClick={() => setBaru(true)} className="min-h-10 text-[13px] font-bold text-primary">
            {tr("+ Tambah")}
          </button>
        )}
      </div>
      {xs.length === 0 && <span className="text-xs text-muted">{tr("Tiada. Pekerja mengisi Borang TP1 dan HR merekodkannya di sini mengikut bulan.")}</span>}
      {xs.map((t) => (
        <div key={t.id} className="flex min-h-10 items-center gap-2 text-sm">
          <span className="w-10 shrink-0 font-bold">{BULAN_RINGKAS[t.month - 1]}</span>
          <span className="grow">{t.category}</span>
          <b>{ringgit(t.amount)}</b>
          {bolehUbah && (
            <button
              type="button"
              aria-label={tr("Buang")}
              onClick={async () => {
                if (!(await sahkan({ tajuk: tr("Buang pelepasan TP1?"), bahaya: true, ok: tr("Buang") }))) return;
                await buangTp1(t.id);
                d.reload();
              }}
              className="flex size-10 items-center justify-center text-lg text-muted"
            >
              ×
            </button>
          )}
        </div>
      ))}
      {baru && (
        <BorangTp1
          tahun={tahun}
          onClose={async (t) => {
            setBaru(false);
            if (!t) return;
            try {
              await tambahTp1(employmentId, t);
              beritahu(tr("Pelepasan TP1 direkodkan."));
              d.reload();
            } catch (e) {
              beritahu(e instanceof Error ? e.message : tr("Ralat"), "ralat");
            }
          }}
        />
      )}
    </div>
  );
}

function BorangTp1({ tahun, onClose }: { tahun: number; onClose: (t: { year: number; month: number; category: string; amount: number; note: string | null } | null) => void }) {
  const [bulan, setBulan] = useState(Number(todayISO().slice(5, 7)));
  const [kat, setKat] = useState(KATEGORI_TP1[0]);
  const [amaun, setAmaun] = useState("");
  return (
    <Lembaran title={tr("Pelepasan TP1")} onClose={() => onClose(null)}>
      <div className="grid grid-cols-2 gap-2.5">
        <MedanBorang label={tr("Bulan")}>
          <select className={inputKecil} value={bulan} onChange={(e) => setBulan(Number(e.target.value))}>
            {BULAN_RINGKAS.map((b, i) => (
              <option key={b} value={i + 1}>
                {b} {tahun}
              </option>
            ))}
          </select>
        </MedanBorang>
        <MedanBorang label={tr("Jumlah (RM)")}>
          <input className={inputKecil} inputMode="decimal" value={amaun} onChange={(e) => setAmaun(e.target.value.replace(/[^\d.]/g, ""))} />
        </MedanBorang>
      </div>
      <MedanBorang label={tr("Kategori")}>
        <select className={inputKecil} value={kat} onChange={(e) => setKat(e.target.value)}>
          {KATEGORI_TP1.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </MedanBorang>
      <ButangUtama disabled={!(Number(amaun) > 0)} onClick={() => onClose({ year: tahun, month: bulan, category: kat, amount: Number(amaun), note: null })}>
        {tr("Simpan")}
      </ButangUtama>
    </Lembaran>
  );
}

function BorangBerkanun({ employmentId, nama, awal, onClose }: { employmentId: string; nama: string; awal: Berkanun; onClose: (ok: boolean) => void }) {
  const [f, setF] = useState<Berkanun>(awal);
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const set = <K extends keyof Berkanun>(k: K, v: Berkanun[K]) => setF((x) => ({ ...x, [k]: v }));
  const nombor = (k: "child_u18" | "child_higher" | "child_disabled" | "child_disabled_higher") => (
    <input className={inputKecil} inputMode="numeric" value={String(f[k])} onChange={(e) => set(k, Math.min(30, Number(e.target.value.replace(/\D/g, "")) || 0))} />
  );
  async function simpan() {
    setBusy(true);
    setRalat(null);
    try {
      await simpanBerkanun(employmentId, f);
      beritahu(tr("Maklumat berkanun {0} disimpan.", nama));
      onClose(true);
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
      setBusy(false);
    }
  }
  return (
    <Lembaran title={tr("Maklumat berkanun: {0}", nama)} onClose={() => onClose(false)}>
      <b className="text-[13px] text-[#4A5A57]">{tr("CUKAI (PCB)")}</b>
      <BarisSuis label={tr("Pemastautin cukai")} nota={tr("Bukan pemastautin dikenakan PCB 30% rata")} on={f.resident} onChange={(v) => set("resident", v)} />
      <BarisSuis label={tr("Pekerja OKU")} on={f.disabled} onChange={(v) => set("disabled", v)} />
      <BarisSuis label={tr("Pasangan OKU")} on={f.spouse_disabled} onChange={(v) => set("spouse_disabled", v)} />
      <span className="text-xs text-muted">{tr("Status perkahwinan & pasangan bekerja diambil daripada profil pekerja.")}</span>
      <div className="grid grid-cols-2 gap-2.5">
        <MedanBorang label={tr("Anak bawah 18 tahun")}>{nombor("child_u18")}</MedanBorang>
        <MedanBorang label={tr("Anak 18+ belajar (diploma ke atas)")}>{nombor("child_higher")}</MedanBorang>
        <MedanBorang label={tr("Anak OKU")}>{nombor("child_disabled")}</MedanBorang>
        <MedanBorang label={tr("Anak OKU belajar")}>{nombor("child_disabled_higher")}</MedanBorang>
      </div>
      <BarisSuis label={tr("Pelepasan anak dikongsi dengan pasangan (50%)")} on={f.child_shared} onChange={(v) => set("child_shared", v)} />

      <b className="pt-2 text-[13px] text-[#4A5A57]">{tr("KWSP, PERKESO & SIP")}</b>
      <MedanBorang label={tr("Kategori KWSP")}>
        <select className={inputKecil} value={f.epf_category} onChange={(e) => set("epf_category", e.target.value as Berkanun["epf_category"])}>
          {Object.entries(KWSP).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </MedanBorang>
      <MedanBorang label={tr("Kadar caruman pekerja pilihan (%)")} nota={tr("Kosong = kadar berkanun. Cth. 9 jika pekerja memilih kadar lebih rendah melalui Borang KWSP 17A (Khas).")}>
        <input
          className={inputKecil}
          inputMode="decimal"
          value={f.epf_employee_rate ?? ""}
          onChange={(e) => set("epf_employee_rate", e.target.value === "" ? null : Math.min(20, Number(e.target.value.replace(/[^\d.]/g, "")) || 0))}
        />
      </MedanBorang>
      <MedanBorang label={tr("Kategori PERKESO")}>
        <select className={inputKecil} value={f.socso_category} onChange={(e) => set("socso_category", e.target.value as Berkanun["socso_category"])}>
          {Object.entries(PERKESO).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </MedanBorang>
      <PilihYa label={tr("SIP (Sistem Insurans Pekerjaan)")} v={f.eis} onChange={(v) => set("eis", v)} />
      <PilihYa label={tr("Lindung 24 Jam (SKBBK)")} v={f.skbbk} onChange={(v) => set("skbbk", v)} nota={tr("Automatik = ikut tetapan syarikat (wajib bagi pekerja asing).")} />
      <MedanBorang label={tr("No. PERKESO pekerja asing (SSFW)")}>
        <input className={inputKecil} value={f.ssfw_no ?? ""} onChange={(e) => set("ssfw_no", e.target.value || null)} />
      </MedanBorang>

      <b className="pt-2 text-[13px] text-[#4A5A57]">{tr("POTONGAN LAIN")}</b>
      <div className="grid grid-cols-2 gap-2.5">
        <MedanBorang label={tr("Zakat sebulan (RM)")} nota={tr("Mengurangkan PCB")}>
          <input className={inputKecil} inputMode="decimal" value={f.zakat_monthly || ""} onChange={(e) => set("zakat_monthly", Number(e.target.value.replace(/[^\d.]/g, "")) || 0)} />
        </MedanBorang>
        <MedanBorang label={tr("CP38 sebulan (RM)")} nota={tr("Arahan potongan tambahan LHDN")}>
          <input className={inputKecil} inputMode="decimal" value={f.cp38_monthly || ""} onChange={(e) => set("cp38_monthly", Number(e.target.value.replace(/[^\d.]/g, "")) || 0)} />
        </MedanBorang>
      </div>
      {f.cp38_monthly > 0 && (
        <MedanBorang label={tr("CP38 hingga")}>
          <input type="date" className={inputKecil} value={f.cp38_until ?? ""} onChange={(e) => set("cp38_until", e.target.value || null)} />
        </MedanBorang>
      )}
      {ralat && <ErrorBox message={ralat} />}
      <ButangUtama onClick={simpan} busy={busy}>
        {tr("Simpan")}
      </ButangUtama>
    </Lembaran>
  );
}

function BarisSuis({ label, nota, on, onChange }: { label: string; nota?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex min-h-12 items-center gap-3">
      <span className="flex grow flex-col gap-0.5">
        <span className="text-sm font-semibold">{label}</span>
        {nota && <span className="text-xs leading-snug text-muted">{nota}</span>}
      </span>
      <Suis on={on} onChange={onChange} label={label} />
    </div>
  );
}

function PilihYa({ label, v, onChange, nota }: { label: string; v: "auto" | "yes" | "no"; onChange: (v: "auto" | "yes" | "no") => void; nota?: string }) {
  return (
    <div className="flex flex-col gap-1.5" role="group" aria-label={label}>
      <span className="text-[13px] font-bold text-[#4A5A57]">{label}</span>
      <div className="flex flex-wrap gap-2">
        {(["auto", "yes", "no"] as const).map((k) => (
          <Cip key={k} on={v === k} onClick={() => onChange(k)}>
            {YA_TIDAK[k]}
          </Cip>
        ))}
      </div>
      {nota && <span className="text-xs text-muted">{nota}</span>}
    </div>
  );
}
