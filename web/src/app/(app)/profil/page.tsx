"use client";

import { tr, trRalat } from "@/lib/i18n";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { sorokAkaun, sorokIC, sorokTelefon } from "@/lib/profil";
import { getProfilSaya, kelengkapan, LABEL_KAHWIN, mohonKemasKini, ubahTerus, type ProfilSaya } from "@/lib/profilSaya";
import { buangGambarProfil, simpanGambarProfil } from "@/lib/avatar";
import { muatNaikPeribadi } from "@/lib/upload";
import { tarikhPenuh } from "@/lib/format";
import { BANK, HUBUNGAN } from "@/lib/senarai";
import { Avatar, BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { inputKecil, Kotak, Lembaran, Medan, MedanBorang, Seksyen, Tag } from "@/components/Senarai";
import { AsetSyarikat, GarisMasaKerja, Keluarga } from "@/components/ProfilLanjut";
import { beritahu } from "@/components/Dialog";
import { TabNav } from "@/components/TabNav";

type Lembar = null | "gambar" | "peribadi" | "waris" | "hr";

const LABEL_JENIS: Record<string, string> = { permanent: tr("Tetap"), contract: tr("Kontrak"), part_time: tr("Separuh masa"), intern: tr("Praktikal") };

/**
 * Profil Saya: pekerja mengemas kini profil sendiri.
 * Ubah terus (gambar, nama panggilan, alamat, e-mel, waris, keluarga) · Perlu HR sahkan (bank, perkahwinan, anak, KWSP, cukai, nama/KP)
 * · HR sahaja (jawatan, jabatan, gaji, tarikh mula).
 */
export default function ProfilPage() {
  const me = useMe();
  const emp = me.active!;
  const d = useData(() => getProfilSaya(me.personId, emp.id), [me.personId, emp.id]);
  const [lembar, setLembar] = useState<Lembar>(null);
  const p = d.data;
  const k = p ? kelengkapan(p) : null;
  const selesai = (msg?: string) => {
    setLembar(null);
    d.reload();
    if (msg) beritahu(msg);
  };

  return (
    <Screen lebar="sederhana">
      <BackHeader title={tr("Profil Saya")} href="/saya" />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-6 lg:px-0">
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !p && <Loading />}
        {p && k && (
          <>
            {/* Kepala: gambar, nama, jawatan & kelengkapan */}
            <div className="flex flex-col gap-3 rounded-card bg-surface p-4">
              <div className="flex items-center gap-4">
                <button type="button" onClick={() => setLembar("gambar")} aria-label={tr("Tukar gambar profil")} className="relative shrink-0">
                  <Avatar name={p.preferredName} size={72} path={p.avatarPath} />
                  <span className="absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full border-2 border-surface bg-primary text-white">
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 7h3l2-3h6l2 3h3v12H4z" />
                      <circle cx="12" cy="13" r="3.5" />
                    </svg>
                  </span>
                </button>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <b className="truncate text-lg font-extrabold">{p.preferredName}</b>
                  <span className="truncate text-[13px] text-subtle">{[p.position, p.department].filter(Boolean).join(" · ") || emp.companyCode}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[13px]">
                  <b>{tr("Profil {0}% lengkap", k.peratus)}</b>
                  {k.peratus === 100 && <Tag tone="success">{tr("Lengkap")}</Tag>}
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-page" role="progressbar" aria-valuenow={k.peratus} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${k.peratus}%` }} />
                </div>
                {k.kurang.length > 0 && <span className="text-xs text-muted">{tr("Belum diisi: {0}", k.kurang.join(", "))}</span>}
              </div>
            </div>

            {p.permohonan && <KadPermohonan p={p} />}

            <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-6">
              <div className="flex flex-col gap-3">
                <Bahagian tajuk={tr("PERIBADI")} jenis="terus" onUbah={() => setLembar("peribadi")}>
                  <Medan label={tr("Nama panggilan")}>{p.preferredName}</Medan>
                  <Medan label={tr("Alamat")}>{p.address || <Kosong />}</Medan>
                  <Medan label={tr("E-mel peribadi")}>{p.email || <Kosong />}</Medan>
                  <Medan label={tr("WhatsApp")}>{sorokTelefon(p.phone)}</Medan>
                  <Medan label={tr("Hari jadi kepada rakan")}>{p.hideBirthday ? tr("Disembunyikan") : tr("Dipaparkan")}</Medan>
                </Bahagian>

                <Bahagian tajuk={tr("WARIS KECEMASAN")} jenis="terus" onUbah={() => setLembar("waris")}>
                  {p.waris ? (
                    <>
                      <Medan label={tr("Nama")}>{p.waris.name}</Medan>
                      <Medan label={tr("Hubungan")}>{p.waris.relationship ?? "-"}</Medan>
                      <Medan label={tr("Telefon")}>{p.waris.phone}</Medan>
                    </>
                  ) : (
                    <span className="py-3 text-sm text-muted">{tr("Belum diisi")}</span>
                  )}
                </Bahagian>

                <Keluarga employmentId={emp.id} boleh />
              </div>

              <div className="flex flex-col gap-3">
                <Bahagian tajuk={tr("PERLU DISAHKAN HR")} jenis="hr" onUbah={p.permohonan?.status === "pending" ? undefined : () => setLembar("hr")}>
                  <Medan label={tr("Nama penuh (kad pengenalan)")}>{p.fullName}</Medan>
                  <Medan label={tr("No. kad pengenalan")}>{sorokIC(p.icNo)}</Medan>
                  <Medan label={tr("Status perkahwinan")}>{p.maritalStatus ? LABEL_KAHWIN[p.maritalStatus] ?? p.maritalStatus : <Kosong />}</Medan>
                  <Medan label={tr("Anak (PCB)")}>{p.childrenCount}</Medan>
                  <Medan label={tr("Bank")}>{p.bankName ? `${p.bankName} · ${sorokAkaun(p.bankAccountNo)}` : <Kosong />}</Medan>
                  <Medan label={tr("No. KWSP")}>{p.epfNo || <Kosong />}</Medan>
                  <Medan label={tr("No. PERKESO")}>{p.socsoNo || "-"}</Medan>
                  <Medan label={tr("No. cukai")}>{p.taxNo || "-"}</Medan>
                </Bahagian>

                <Bahagian tajuk={tr("PEKERJAAN")} jenis="hrSahaja">
                  <Medan label={tr("Jawatan")}>{p.position ?? "-"}</Medan>
                  <Medan label={tr("Jabatan")}>{p.department ?? "-"}</Medan>
                  <Medan label={tr("Tarikh mula")}>{tarikhPenuh(p.joinDate)}</Medan>
                  <Medan label={tr("Jenis")}>{LABEL_JENIS[p.employmentType] ?? p.employmentType}</Medan>
                </Bahagian>

                <GarisMasaKerja employmentId={emp.id} boleh={false} />
                <AsetSyarikat employmentId={emp.id} boleh={false} />

                <Seksyen>{tr("LOG MASUK & TETAPAN")}</Seksyen>
                <Kotak>
                  <Link href="/akaun/kata-laluan" className="flex min-h-[50px] items-center justify-between gap-3 px-4 py-2 text-sm text-ink!">
                    <span className="text-muted">{tr("E-mel & kata laluan")}</span>
                    <span className="truncate font-semibold">{me.loginEmail ?? tr("Belum ditetapkan")} ›</span>
                  </Link>
                  <Link href="/saya" className="flex min-h-[50px] items-center justify-between gap-3 px-4 py-2 text-sm text-ink!">
                    <span className="text-muted">{tr("Bahasa & log keluar")}</span>
                    <span className="font-semibold">›</span>
                  </Link>
                </Kotak>
              </div>
            </div>
          </>
        )}
      </main>
      {p && lembar === "gambar" && <TukarGambar p={p} onClose={() => setLembar(null)} onDone={() => selesai(tr("Gambar profil dikemas kini."))} />}
      {p && lembar === "peribadi" && <UbahPeribadi p={p} onClose={() => setLembar(null)} onDone={() => selesai(tr("Profil dikemas kini."))} />}
      {p && lembar === "waris" && <UbahWaris p={p} onClose={() => setLembar(null)} onDone={() => selesai(tr("Waris dikemas kini."))} />}
      {p && lembar === "hr" && (
        <MohonHr p={p} employmentId={emp.id} onClose={() => setLembar(null)} onDone={() => selesai(tr("Permohonan dihantar kepada HR untuk disahkan."))} />
      )}
      <TabNav />
    </Screen>
  );
}

function Kosong() {
  return <span className="font-semibold text-warning">{tr("Belum diisi")}</span>;
}

function Bahagian({ tajuk, jenis, onUbah, children }: { tajuk: string; jenis: "terus" | "hr" | "hrSahaja"; onUbah?: () => void; children: ReactNode }) {
  const label = jenis === "terus" ? tr("Ubah") : jenis === "hr" ? tr("Mohon kemas kini") : null;
  return (
    <section aria-label={tajuk} className="flex flex-col gap-1.5">
      <div className="flex min-h-10 items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <Seksyen>{tajuk}</Seksyen>
          {jenis === "hr" && <Tag tone="warning">{tr("Disahkan HR")}</Tag>}
        </span>
        {label && onUbah && (
          <button type="button" onClick={onUbah} className="flex h-10 items-center rounded-full border border-primary bg-surface px-4 text-[13px] font-bold text-primary">
            {label}
          </button>
        )}
      </div>
      <Kotak>{children}</Kotak>
      {jenis === "hrSahaja" && <span className="px-1 text-xs text-muted">{tr("Hanya HR boleh mengubah maklumat ini. Hubungi HR melalui Tanya HR.")}</span>}
    </section>
  );
}

function KadPermohonan({ p }: { p: ProfilSaya }) {
  const x = p.permohonan!;
  const tone = x.status === "pending" ? "bg-warning-soft text-warning" : "bg-danger-soft text-danger";
  return (
    <div className={`flex flex-col gap-1.5 rounded-[14px] px-4 py-3 text-[13px] ${tone}`}>
      <b>{x.status === "pending" ? tr("Menunggu pengesahan HR") : x.status === "returned" ? tr("Dihantar balik oleh HR") : tr("Ditolak oleh HR")}</b>
      {x.changes.map((c) => (
        <span key={c.field}>
          {trRalat(c.label)}: <b>{c.field === "bank_account_no" ? sorokAkaun(c.new) : c.field === "ic_no" ? sorokIC(c.new) : (c.field === "marital_status" && c.new ? LABEL_KAHWIN[c.new] : c.new) || "-"}</b>
        </span>
      ))}
      {x.requestId && (
        <Link href={`/permohonan/${x.requestId}`} className="font-bold text-inherit!">
          {tr("Lihat permohonan ›")}
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function TukarGambar({ p, onClose, onDone }: { p: ProfilSaya; onClose: () => void; onDone: () => void }) {
  const me = useMe();
  const kamera = useRef<HTMLInputElement>(null);
  const galeri = useRef<HTMLInputElement>(null);
  const [pratonton, setPratonton] = useState<{ file: File; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);

  const pilih = (f?: File) => f && setPratonton({ file: f, url: URL.createObjectURL(f) });
  async function simpan() {
    if (!pratonton) return;
    setBusy(true);
    setRalat(null);
    try {
      await simpanGambarProfil(me.personId, pratonton.file, p.avatarPath);
      onDone();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
      setBusy(false);
    }
  }
  async function buang() {
    setBusy(true);
    try {
      await buangGambarProfil(p.avatarPath);
      onDone();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
      setBusy(false);
    }
  }

  return (
    <Lembaran title={tr("Gambar profil")} onClose={onClose}>
      <div className="flex justify-center py-2">
        {pratonton ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pratonton.url} alt={tr("Pratonton")} className="size-36 rounded-full object-cover" />
        ) : (
          <Avatar name={p.preferredName} size={144} path={p.avatarPath} />
        )}
      </div>
      <span className="text-center text-xs text-muted">{tr("Gambar dipotong menjadi bulat dan boleh dilihat oleh rakan sekerja dalam syarikat anda.")}</span>
      {ralat && <ErrorBox message={ralat} />}
      {pratonton ? (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setPratonton(null)} disabled={busy} className="h-12 rounded-button border border-line text-sm font-bold">
            {tr("Pilih lain")}
          </button>
          <button type="button" onClick={simpan} disabled={busy} className="h-12 rounded-button bg-primary text-sm font-extrabold text-white disabled:opacity-50">
            {busy ? tr("Menyimpan…") : tr("Guna gambar ini")}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => kamera.current?.click()} className="h-12 rounded-button bg-primary text-sm font-extrabold text-white">
            {tr("Ambil swafoto")}
          </button>
          <button type="button" onClick={() => galeri.current?.click()} className="h-12 rounded-button border border-primary text-sm font-bold text-primary">
            {tr("Pilih dari galeri")}
          </button>
        </div>
      )}
      {!pratonton && p.avatarPath && (
        <button type="button" onClick={buang} disabled={busy} className="flex min-h-11 items-center justify-center text-sm font-bold text-danger">
          {tr("Buang gambar")}
        </button>
      )}
      <input ref={kamera} type="file" accept="image/*" capture="user" className="hidden" aria-label={tr("Ambil swafoto")} onChange={(e) => pilih(e.target.files?.[0])} />
      <input ref={galeri} type="file" accept="image/*" className="hidden" aria-label={tr("Pilih dari galeri")} onChange={(e) => pilih(e.target.files?.[0])} />
    </Lembaran>
  );
}

function UbahPeribadi({ p, onClose, onDone }: { p: ProfilSaya; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ preferred_name: p.preferredName, address: p.address ?? "", email: p.email ?? "", hide_birthday: p.hideBirthday });
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  async function simpan() {
    setBusy(true);
    setRalat(null);
    try {
      await ubahTerus(f);
      onDone();
    } catch (e) {
      setRalat(e instanceof Error ? trRalat(e.message) : tr("Ralat"));
      setBusy(false);
    }
  }
  return (
    <Lembaran title={tr("Ubah maklumat peribadi")} onClose={onClose}>
      <MedanBorang label={tr("Nama panggilan")}>
        <input className={inputKecil} value={f.preferred_name} maxLength={40} onChange={(e) => setF({ ...f, preferred_name: e.target.value })} />
      </MedanBorang>
      <MedanBorang label={tr("Alamat")}>
        <textarea rows={3} className="rounded-[12px] border border-[#D5DEDC] bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
      </MedanBorang>
      <MedanBorang label={tr("E-mel peribadi")}>
        <input type="email" className={inputKecil} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      </MedanBorang>
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
        <input type="checkbox" checked={f.hide_birthday} onChange={(e) => setF({ ...f, hide_birthday: e.target.checked })} className="size-5 accent-primary" />
        {tr("Sembunyikan hari jadi saya daripada rakan sekerja")}
      </label>
      {ralat && <ErrorBox message={ralat} />}
      <button type="button" onClick={simpan} disabled={busy} className="h-12 rounded-button bg-primary text-base font-extrabold text-white disabled:opacity-50">
        {busy ? tr("Menyimpan…") : tr("Simpan")}
      </button>
    </Lembaran>
  );
}

function UbahWaris({ p, onClose, onDone }: { p: ProfilSaya; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ contact_name: p.waris?.name ?? "", contact_relationship: p.waris?.relationship ?? HUBUNGAN[0], contact_phone: p.waris?.phone ?? "" });
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  async function simpan() {
    setBusy(true);
    setRalat(null);
    try {
      await ubahTerus(f);
      onDone();
    } catch (e) {
      setRalat(e instanceof Error ? trRalat(e.message) : tr("Ralat"));
      setBusy(false);
    }
  }
  return (
    <Lembaran title={tr("Waris kecemasan")} onClose={onClose}>
      <MedanBorang label={tr("Nama waris")}>
        <input className={inputKecil} value={f.contact_name} onChange={(e) => setF({ ...f, contact_name: e.target.value })} />
      </MedanBorang>
      <MedanBorang label={tr("Hubungan")}>
        <select className={inputKecil} value={f.contact_relationship} onChange={(e) => setF({ ...f, contact_relationship: e.target.value })}>
          {[...new Set([f.contact_relationship, ...HUBUNGAN])].map((h) => (
            <option key={h}>{h}</option>
          ))}
        </select>
      </MedanBorang>
      <MedanBorang label={tr("Telefon waris")}>
        <input type="tel" className={inputKecil} value={f.contact_phone} placeholder={tr("01x-xxx xxxx")} onChange={(e) => setF({ ...f, contact_phone: e.target.value })} />
      </MedanBorang>
      {ralat && <ErrorBox message={ralat} />}
      <button type="button" onClick={simpan} disabled={busy} className="h-12 rounded-button bg-primary text-base font-extrabold text-white disabled:opacity-50">
        {busy ? tr("Menyimpan…") : tr("Simpan")}
      </button>
    </Lembaran>
  );
}

/** Perubahan yang perlu disahkan HR: dihantar ke Kelulusan; dikemas kini automatik apabila diluluskan. */
function MohonHr({ p, employmentId, onClose, onDone }: { p: ProfilSaya; employmentId: string; onClose: () => void; onDone: () => void }) {
  const me = useMe();
  const asal = {
    full_name: p.fullName,
    ic_no: p.icNo ?? "",
    marital_status: p.maritalStatus ?? "",
    children_count: String(p.childrenCount),
    bank_name: p.bankName ?? "",
    bank_account_no: p.bankAccountNo ?? "",
    epf_no: p.epfNo ?? "",
    socso_no: p.socsoNo ?? "",
    tax_no: p.taxNo ?? "",
  };
  const [f, setF] = useState(asal);
  const [kp, setKp] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const set = (k: keyof typeof asal) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const ubah = (Object.keys(asal) as (keyof typeof asal)[]).filter((k) => f[k].trim() !== asal[k].trim());
  const perluKp = ubah.includes("full_name") || ubah.includes("ic_no");

  async function hantar() {
    if (!ubah.length) return onClose();
    if (perluKp && !kp) return setRalat(tr("Sila lampirkan gambar kad pengenalan untuk menukar nama penuh atau no. kad pengenalan."));
    setBusy(true);
    setRalat(null);
    try {
      const lampiran = perluKp && kp ? await muatNaikPeribadi(me.personId, "kad-pengenalan", kp) : null;
      await mohonKemasKini(employmentId, Object.fromEntries(ubah.map((k) => [k, f[k].trim() || null])), lampiran);
      onDone();
    } catch (e) {
      setRalat(e instanceof Error ? trRalat(e.message) : tr("Ralat"));
      setBusy(false);
    }
  }

  return (
    <Lembaran title={tr("Mohon kemas kini maklumat")} onClose={onClose}>
      <span className="text-xs leading-normal text-muted">{tr("Perubahan ini dihantar kepada HR untuk disahkan dan dikemas kini secara automatik selepas diluluskan. Anda akan dimaklumkan melalui WhatsApp.")}</span>
      <MedanBorang label={tr("Nama penuh (ikut kad pengenalan)")}>
        <input className={inputKecil} value={f.full_name} onChange={set("full_name")} />
      </MedanBorang>
      <MedanBorang label={tr("No. kad pengenalan")}>
        <input className={inputKecil} inputMode="numeric" value={f.ic_no} onChange={set("ic_no")} placeholder="900101-14-1234" />
      </MedanBorang>
      {perluKp && (
        <MedanBorang label={tr("Gambar kad pengenalan (wajib)")} nota={kp ? kp.name : tr("Diperlukan untuk menukar nama penuh atau no. kad pengenalan.")}>
          <input type="file" accept="image/*,application/pdf" capture="environment" onChange={(e) => setKp(e.target.files?.[0] ?? null)} className="text-sm" />
        </MedanBorang>
      )}
      <div className="grid grid-cols-2 gap-3">
        <MedanBorang label={tr("Status perkahwinan")}>
          <select className={inputKecil} value={f.marital_status} onChange={set("marital_status")}>
            <option value="">-</option>
            {Object.entries(LABEL_KAHWIN).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </MedanBorang>
        <MedanBorang label={tr("Anak (PCB)")}>
          <input type="number" min={0} max={30} className={inputKecil} value={f.children_count} onChange={set("children_count")} />
        </MedanBorang>
      </div>
      <MedanBorang label={tr("Bank")}>
        <select className={inputKecil} value={f.bank_name} onChange={set("bank_name")}>
          <option value="">{tr("Pilih bank")}</option>
          {[...new Set([...(f.bank_name && !BANK.includes(f.bank_name) ? [f.bank_name] : []), ...BANK])].map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </MedanBorang>
      <MedanBorang label={tr("No. akaun bank")}>
        <input className={inputKecil} inputMode="numeric" value={f.bank_account_no} onChange={set("bank_account_no")} />
      </MedanBorang>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MedanBorang label={tr("No. KWSP")}>
          <input className={inputKecil} value={f.epf_no} onChange={set("epf_no")} />
        </MedanBorang>
        <MedanBorang label={tr("No. PERKESO")}>
          <input className={inputKecil} value={f.socso_no} onChange={set("socso_no")} />
        </MedanBorang>
        <MedanBorang label={tr("No. cukai")}>
          <input className={inputKecil} value={f.tax_no} onChange={set("tax_no")} />
        </MedanBorang>
      </div>
      {ralat && <ErrorBox message={ralat} />}
      <button type="button" onClick={hantar} disabled={busy || !ubah.length} className="h-12 rounded-button bg-primary text-base font-extrabold text-white disabled:opacity-50">
        {busy ? tr("Menghantar…") : ubah.length ? tr("Hantar {0} perubahan kepada HR", ubah.length) : tr("Tiada perubahan")}
      </button>
    </Lembaran>
  );
}
