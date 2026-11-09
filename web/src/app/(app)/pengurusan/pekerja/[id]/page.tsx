"use client";

import { mintaTeks, sahkan } from "@/components/Dialog";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState, useSyncExternalStore } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import {
  batalPenamatan,
  bukaMaklumatSensitif,
  getButiranPekerja,
  getDokumen,
  getGajiSemasa,
  getJabatan,
  jemputPekerja,
  JENIS_DOKUMEN,
  JENIS_PEKERJAAN,
  kemasKiniPekerjaan,
  labelJenis,
  putuskanBank,
  simpanDokumen,
  tamatkanPekerjaan,
  type ButiranPekerja,
  type MaklumatSensitif,
} from "@/lib/hr";
import { muatNaikPeribadi, urlSementara } from "@/lib/upload";
import { setTarikhTamat } from "@/lib/berkanun";
import { SenaraiSemakPekerja } from "@/components/SenaraiSemak";
import { hari, julatTarikh, masa, paparTelefon, ringgit, tarikh, todayISO, type StatusPermohonan } from "@/lib/format";
import { Avatar, BackHeader, ErrorBox, Loading, Screen, StatusPill } from "@/components/ui";
import { RingkasanKiraan, UbahGaji, usePratonton } from "@/components/GajiPekerja";
import type { KomponenTetap } from "@/lib/gaji";
import { HadPeranan, Kotak, Lembaran, Medan, MedanBorang, Seksyen, Tag, inputKecil } from "@/components/Senarai";

const TABS = ["Maklumat", "Cuti", "Tuntutan", "Kehadiran", "Gaji", "Dokumen"] as const;
type TabId = (typeof TABS)[number];
const BULAN = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];
const tarikhPenuh = (iso: string) => `${Number(iso.slice(8, 10))} ${BULAN[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

// Rujukan reka bentuk: design/ProfilPekerja.dc.html
export default function ProfilPekerjaPage() {
  return (
    <HadPeranan roles={["hr", "ceo", "admin"]} back="/pengurusan/pekerja">
      <Suspense fallback={<Loading />}>
        <Profil />
      </Suspense>
    </HadPeranan>
  );
}

function Profil() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const me = useMe();
  const p = useData(() => getButiranPekerja(id), [id]);
  const [tab, setTab] = useState<TabId>("Maklumat");
  const bolehUbah = me.roles.includes("hr") || me.roles.includes("admin");

  return (
    <Screen>
      <BackHeader title={p.data ? "" : ""} href="/pengurusan/pekerja" />
      {p.data && <KepalaPekerja p={p.data} />}
      {p.data && <RingkasanPekerja id={id} grace={me.active!.graceMinutes} />}
      <div role="tablist" className="flex gap-0.5 overflow-x-auto border-b border-line-soft px-3 lg:px-0">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`h-10 shrink-0 border-b-[3px] px-3 text-sm whitespace-nowrap ${tab === t ? "border-primary font-extrabold text-primary" : "border-transparent font-semibold text-[#4A5A57]"}`}
          >
            {t}
          </button>
        ))}
      </div>
      <main className="flex grow flex-col gap-3 px-4 py-4 lg:px-0">
        {p.error && <ErrorBox message={p.error} />}
        {p.loading && !p.data && <Loading />}
        {p.data && tab === "Maklumat" && <Maklumat p={p.data} reload={p.reload} bolehUbah={bolehUbah} baru={sp.get("jemput") === "1"} keDokumen={() => setTab("Dokumen")} />}
        {p.data && tab === "Cuti" && <TabCuti id={id} />}
        {p.data && tab === "Tuntutan" && <TabTuntutan id={id} />}
        {p.data && tab === "Kehadiran" && <TabKehadiran id={id} />}
        {p.data && tab === "Gaji" && <TabGaji id={id} nama={p.data.name} tarikhMula={p.data.joinDate} />}
        {p.data && tab === "Dokumen" && <TabDokumen p={p.data} bolehUbah={bolehUbah} />}
      </main>
    </Screen>
  );
}

// ------------------------------------------------------------------ Maklumat

function bacaPautan(id: string) {
  try {
    return sessionStorage.getItem(`hrb_pautan_jemputan:${id}`);
  } catch {
    return null;
  }
}

function Maklumat({ p, reload, bolehUbah, baru, keDokumen }: { p: ButiranPekerja; reload: () => void; bolehUbah: boolean; baru: boolean; keDokumen: () => void }) {
  const [lembaran, setLembaran] = useState<null | "ubah" | "tamat" | "tarikh">(null);
  // HR terus melihat maklumat peribadi; setiap paparan direkodkan dalam data_access_log (hr_view_sensitive).
  const sd = useData(() => (bolehUbah ? bukaMaklumatSensitif(p.id) : Promise.resolve(null as MaklumatSensitif | null)), [p.id, bolehUbah]);
  const sensitif = sd.data;
  const [ralat, setRalat] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pautanBaru, setPautanBaru] = useState<string | null>(null);
  const simpanan = useSyncExternalStore(
    () => () => {},
    () => bacaPautan(p.id),
    () => null,
  );
  const pautan = pautanBaru ?? simpanan;
  const tamat = !["probation", "active"].includes(p.status);
  const status = tamat
    ? { label: { resigned: "Letak jawatan", terminated: "Ditamatkan", retired: "Bersara" }[p.status as string] ?? "Tamat", tone: "neutral" as const }
    : !p.activated
      ? { label: "Belum aktif", tone: "neutral" as const }
      : p.status === "probation"
        ? { label: "Percubaan", tone: "warning" as const }
        : { label: "Aktif", tone: "success" as const };

  async function jemputSemula() {
    setRalat(null);
    setBusy(true);
    try {
      const tok = await jemputPekerja(p.id);
      const url = `${window.location.origin}/jemputan/${tok}`;
      try {
        sessionStorage.setItem(`hrb_pautan_jemputan:${p.id}`, url);
      } catch {}
      setPautanBaru(url);
      reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
    }
    setBusy(false);
  }

  async function bank(lulus: boolean) {
    if (!sensitif?.bank_change) return;
    const nota = lulus ? "" : ((await mintaTeks({ tajuk: "Tolak pertukaran akaun bank", mesej: "Sebab ini dihantar kepada pekerja.", label: "Sebab", ok: "Tolak", bahaya: true })) ?? "");
    if (!lulus && !nota.trim()) return;
    setRalat(null);
    try {
      await putuskanBank(sensitif.bank_change.id, lulus, nota);
      sd.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
    }
  }

  return (
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5">
      <div className="flex flex-col gap-3">
      {baru && <div className="rounded-[14px] bg-success-soft px-4 py-3 text-[13px] font-semibold text-success">Pekerja ditambah. Jemputan WhatsApp telah dimasukkan ke barisan penghantaran.</div>}
      <div className="flex flex-col gap-2.5 rounded-card bg-surface px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <b className="text-sm font-extrabold uppercase">{p.companyName}</b>
          <Tag tone={status.tone}>{status.label}</Tag>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Butir label="No. pekerja">{p.employeeNo}</Butir>
          <Butir label="Jabatan">{p.department ?? "-"}</Butir>
          <Butir label="Ketua">{p.headName ?? "-"}</Butir>
          <Butir label="Mula">{tarikhPenuh(p.joinDate)}</Butir>
          <Butir label="Jenis">{labelJenis(p.type)}</Butir>
          <Butir label="Masuk kerja">{(p.workStart ?? p.companyWorkStart).slice(0, 5)}</Butir>
          {p.position && <Butir label="Jawatan">{p.position}</Butir>}
          {p.status === "probation" && p.probationEnd && <Butir label="Tamat percubaan">{tarikhPenuh(p.probationEnd)}</Butir>}
          {tamat && p.endDate && <Butir label="Tarikh akhir">{tarikhPenuh(p.endDate)}</Butir>}
          {p.contractEnd && <Butir label="Kontrak tamat"><TarikhAmaran iso={p.contractEnd} /></Butir>}
          {p.permitExpiry && <Butir label="Permit kerja tamat"><TarikhAmaran iso={p.permitExpiry} /></Butir>}
          {p.passportExpiry && <Butir label="Pasport tamat"><TarikhAmaran iso={p.passportExpiry} /></Butir>}
        </div>
      </div>

      {!tamat && p.endStatus && p.endDate && (
        <div className="flex items-center gap-2.5 rounded-[14px] bg-danger-soft px-3.5 py-3 text-[13px] font-semibold text-danger">
          <span className="grow">
            {{ resigned: "Letak jawatan", terminated: "Ditamatkan", retired: "Bersara" }[p.endStatus as string]} · hari bekerja terakhir {tarikhPenuh(p.endDate)}
          </span>
          {bolehUbah && (
            <button
              type="button"
              className="h-9 shrink-0 rounded-[10px] bg-surface px-3 font-bold"
              onClick={async () => {
                try {
                  await batalPenamatan(p.id);
                  reload();
                } catch (e) {
                  setRalat(e instanceof Error ? e.message : "Ralat");
                }
              }}
            >
              Batal
            </button>
          )}
        </div>
      )}

      {p.otherCompanies > 0 && (
        <div className="flex items-center gap-2.5 rounded-[14px] bg-surface px-3.5 py-3 text-[13px] text-[#4A5A57]">
          {p.name} juga bekerja di {p.otherCompanies} syarikat lain. Butiran di sana hanya boleh dilihat oleh HR syarikat tersebut.
        </div>
      )}

      {!p.activated && !tamat && (pautan || p.inviteSentAt) && (
        <div className="flex flex-col gap-2 rounded-[14px] bg-surface px-4 py-3 text-[13px] text-[#4A5A57]">
          {p.inviteSentAt && <span>Jemputan terakhir: {tarikh(p.inviteSentAt)}, {masa(p.inviteSentAt)}</span>}
          {pautan && (
            <>
              <span className="font-mono text-xs break-all text-ink">{pautan}</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => navigator.clipboard?.writeText(pautan)} className="h-10 grow rounded-[12px] border border-line text-[13px] font-bold">
                  Salin pautan
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {bolehUbah && !tamat && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setLembaran("ubah")} className="flex h-11 items-center rounded-full bg-primary px-4 text-sm font-bold text-white">
            Ubah gaji &amp; jawatan
          </button>
          {p.status === "probation" && (
            <button
              type="button"
              onClick={async () => {
                if (!(await sahkan({ tajuk: `Sahkan jawatan ${p.name}?`, mesej: "Tempoh percubaan tamat dan jawatan disahkan mulai hari ini.", ok: "Sahkan jawatan" }))) return;
                try {
                  await kemasKiniPekerjaan(p.id, { confirm: true });
                  reload();
                } catch (e) {
                  setRalat(e instanceof Error ? e.message : "Ralat");
                }
              }}
              className="flex h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-bold"
            >
              Sahkan jawatan
            </button>
          )}
          <button type="button" onClick={keDokumen} className="flex h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-bold">
            Dokumen
          </button>
          <details className="relative">
            <summary className="flex h-11 cursor-pointer list-none items-center rounded-full border border-line bg-surface px-4 text-sm font-bold [&::-webkit-details-marker]:hidden">
              ⋯ Lagi
            </summary>
            <div className="absolute right-0 z-20 mt-1 flex w-64 flex-col overflow-hidden rounded-[14px] border border-line bg-surface shadow-lg [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              {!p.activated && (
                <button type="button" onClick={jemputSemula} disabled={busy} className="min-h-11 px-4 text-left text-sm font-semibold disabled:opacity-60">
                  {busy ? "Menghantar…" : "Hantar semula jemputan"}
                </button>
              )}
              <Link href={`/pembantu-ai?pekerja=${p.id}&surat=1`} className="flex min-h-11 items-center px-4 text-sm font-semibold text-[#4A3B8C]!">
                Draf surat (AI): pengesahan, amaran…
              </Link>
              <button type="button" onClick={() => setLembaran("tarikh")} className="min-h-11 px-4 text-left text-sm font-semibold">
                Tarikh tamat kontrak, permit &amp; pasport
              </button>
              <button type="button" onClick={() => setLembaran("tamat")} disabled={!!p.endStatus} className="min-h-11 px-4 text-left text-sm font-semibold text-danger disabled:opacity-50">
                Tamatkan pekerjaan
              </button>
            </div>
          </details>
        </div>
      )}
      {bolehUbah && !tamat && <SenaraiSemakPekerja employmentId={p.id} hr />}
      </div>
      <div className="flex flex-col gap-3">
      {bolehUbah && (
        <>
          <Seksyen>MAKLUMAT PERIBADI</Seksyen>
          {sd.error && <ErrorBox message={sd.error} />}
          {!sensitif ? (
            !sd.error && <Loading />
          ) : (
            <>
              <Kotak>
                <Medan label="Nama penuh">{sensitif.full_name}</Medan>
                <Medan label="No. kad pengenalan">{sensitif.ic_no ?? "-"}</Medan>
                <Medan label="WhatsApp">{sensitif.phone ? paparTelefon(sensitif.phone) : "-"}</Medan>
                <Medan label="Alamat">{sensitif.address ?? "-"}</Medan>
                <Medan label="Status perkahwinan">{sensitif.marital_status ?? "-"}</Medan>
                <Medan label="Anak (PCB)">{sensitif.children_count}</Medan>
                <Medan label="Bank">{sensitif.bank_name ? `${sensitif.bank_name} · ${sensitif.bank_account_no}` : "-"}</Medan>
                <Medan label="KWSP / PERKESO / Cukai">{[sensitif.epf_no, sensitif.socso_no, sensitif.tax_no].map((x) => x ?? "-").join(" / ")}</Medan>
                {(sensitif.emergency ?? []).map((w, i) => (
                  <Medan key={i} label={`Waris: ${w.name}`}>
                    {[w.relationship, w.phone].filter(Boolean).join(" · ")}
                  </Medan>
                ))}
              </Kotak>
              {sensitif.bank_change && (
                <div className="flex flex-col gap-2.5 rounded-[14px] bg-warning-soft px-4 py-3">
                  <span className="text-[13px] font-semibold text-warning">
                    Mohon tukar akaun bank ke {sensitif.bank_change.bank_name} · {sensitif.bank_change.bank_account_no} ({tarikh(sensitif.bank_change.requested_at)})
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => bank(false)} className="h-11 rounded-[12px] border border-danger bg-surface text-sm font-bold text-danger">
                      Tolak
                    </button>
                    <button type="button" onClick={() => bank(true)} className="h-11 rounded-[12px] bg-primary text-sm font-bold text-white">
                      Sahkan akaun
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

        </>
      )}
      {ralat && <ErrorBox message={ralat} />}
      <span className="text-xs text-muted">Kad pengenalan, akaun bank dan rekod cuti sakit hanya boleh dilihat oleh HR. Setiap akses direkodkan.</span>
      </div>

      {lembaran === "ubah" && (
        <UbahPekerjaan
          p={p}
          onClose={() => setLembaran(null)}
          onDone={() => {
            setLembaran(null);
            reload();
          }}
        />
      )}
      {lembaran === "tarikh" && (
        <UbahTarikhTamat
          p={p}
          onClose={() => setLembaran(null)}
          onDone={() => {
            setLembaran(null);
            reload();
          }}
        />
      )}
      {lembaran === "tamat" && (
        <Tamatkan
          p={p}
          onClose={() => setLembaran(null)}
          onDone={() => {
            setLembaran(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function KadRingkas({ l, v, s, tone }: { l: string; v: string; s?: string; tone?: string }) {
  return (
    <div className="flex min-w-[130px] shrink-0 flex-col gap-0.5 rounded-[14px] bg-surface px-3.5 py-2.5 lg:min-w-0">
      <span className="text-[11px] font-semibold text-muted">{l}</span>
      <b className={`text-lg font-extrabold ${tone ?? ""}`}>{v}</b>
      {s && <span className="text-[11px] text-muted">{s}</span>}
    </div>
  );
}

/** Ringkasan pantas: baki cuti tahunan, kehadiran bulan ini, tuntutan menunggu. */
function RingkasanPekerja({ id, grace }: { id: string; grace: number }) {
  const t = todayISO();
  const d = useData(async () => {
    const sb = getSupabase();
    const [baki, hadir, tuntut] = await Promise.all([
      sb.from("leave_balances").select("available, leave_types!inner(code)").eq("employment_id", id).eq("year", Number(t.slice(0, 4))).eq("leave_types.code", "AL").maybeSingle(),
      sb.from("attendance_records").select("late_minutes, clock_in").eq("employment_id", id).gte("work_date", `${t.slice(0, 7)}-01`),
      sb.from("claims").select("total_amount").eq("employment_id", id).eq("status", "pending"),
    ]);
    const rekod = hadir.data ?? [];
    return {
      baki: baki.data ? Number(baki.data.available) : null,
      hadir: rekod.filter((r) => r.clock_in).length,
      lewat: rekod.filter((r) => r.late_minutes > grace).length,
      tuntutan: (tuntut.data ?? []).length,
      jumlah: (tuntut.data ?? []).reduce((a, c) => a + Number(c.total_amount ?? 0), 0),
    };
  }, [id]);
  const x = d.data;
  if (!x) return null;
  return (
    <div className="-mx-0 flex gap-2 overflow-x-auto px-4 pb-3 lg:grid lg:max-w-[760px] lg:grid-cols-3 lg:overflow-visible lg:px-0">
      <KadRingkas l="Baki cuti tahunan" v={x.baki === null ? "—" : `${hari(x.baki)} hari`} />
      <KadRingkas l="Hadir bulan ini" v={`${x.hadir} hari`} s={x.lewat ? `${x.lewat} kali lewat` : undefined} tone={x.lewat ? "text-warning" : ""} />
      <KadRingkas l="Tuntutan menunggu" v={String(x.tuntutan)} s={x.tuntutan ? ringgit(x.jumlah) : undefined} />
    </div>
  );
}

/** Tajuk profil: avatar, nama, jawatan · jabatan, status — dipaparkan pada semua tab. */
function KepalaPekerja({ p }: { p: ButiranPekerja }) {
  const tamat = !["probation", "active"].includes(p.status);
  const st = tamat
    ? { label: "Tamat", tone: "neutral" as const }
    : !p.activated
      ? { label: "Belum aktif", tone: "neutral" as const }
      : p.status === "probation"
        ? { label: "Percubaan", tone: "warning" as const }
        : { label: "Aktif", tone: "success" as const };
  return (
    <div className="flex items-center gap-3 px-4 pt-1 pb-3 lg:px-0">
      <Avatar name={p.name} size={56} />
      <div className="flex min-w-0 grow flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <h1 className="m-0 text-xl font-extrabold lg:text-2xl">{p.name}</h1>
          <Tag tone={st.tone}>{st.label}</Tag>
        </span>
        <span className="truncate text-[13px] text-muted">
          {[p.position, p.department, p.employeeNo].filter(Boolean).join(" · ")}
        </span>
      </div>
    </div>
  );
}

function Butir({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted">{label}</span>
      <b className="text-sm font-bold">{children}</b>
    </div>
  );
}

function UbahPekerjaan({ p, onClose, onDone }: { p: ButiranPekerja; onClose: () => void; onDone: () => void }) {
  const me = useMe();
  const jab = useData(() => getJabatan(me.active!.companyId), [me.active!.companyId]);
  const [f, setF] = useState({
    department_id: p.departmentId ?? "",
    position: p.position ?? "",
    employment_type: p.type as string,
    work_start: p.workStart?.slice(0, 5) ?? "",
    basic: "",
    effective_from: todayISO(),
  });
  const [ralat, setRalat] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function simpan() {
    setBusy(true);
    setRalat(null);
    try {
      const d: Record<string, unknown> = { ...f };
      if (!f.basic) {
        delete d.basic;
        delete d.effective_from;
      }
      await kemasKiniPekerjaan(p.id, d);
      onDone();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
      setBusy(false);
    }
  }
  return (
    <Lembaran title="Ubah gaji & jawatan" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2.5">
        <MedanBorang label="Jabatan">
          <select className={inputKecil} value={f.department_id} onChange={(e) => setF({ ...f, department_id: e.target.value })}>
            <option value="">Tiada</option>
            {(jab.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </MedanBorang>
        <MedanBorang label="Jawatan">
          <input className={inputKecil} value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })} />
        </MedanBorang>
        <MedanBorang label="Jenis">
          <select className={inputKecil} value={f.employment_type} onChange={(e) => setF({ ...f, employment_type: e.target.value })}>
            {JENIS_PEKERJAAN.map((j) => (
              <option key={j.value} value={j.value}>
                {j.label}
              </option>
            ))}
          </select>
        </MedanBorang>
        <MedanBorang label="Masuk kerja" nota={`Kosong = ikut syarikat (${p.companyWorkStart.slice(0, 5)})`}>
          <input className={inputKecil} type="time" value={f.work_start} onChange={(e) => setF({ ...f, work_start: e.target.value })} />
        </MedanBorang>
        <MedanBorang label="Gaji pokok baharu (RM)" nota="Kosong = tiada perubahan">
          <input className={inputKecil} inputMode="decimal" value={f.basic} onChange={(e) => setF({ ...f, basic: e.target.value.replace(/[^\d.]/g, "") })} />
        </MedanBorang>
        <MedanBorang label="Berkuat kuasa">
          <input className={inputKecil} type="date" value={f.effective_from} onChange={(e) => setF({ ...f, effective_from: e.target.value })} />
        </MedanBorang>
      </div>
      {ralat && <ErrorBox message={ralat} />}
      <button type="button" onClick={simpan} disabled={busy} className="h-12 rounded-button bg-primary text-base font-extrabold text-white disabled:opacity-60">
        {busy ? "Menyimpan…" : "Simpan"}
      </button>
    </Lembaran>
  );
}

/** Tarikh dengan warna amaran: merah jika telah lepas / ≤ 30 hari, kuning jika ≤ 60 hari. */
function TarikhAmaran({ iso }: { iso: string }) {
  const baki = Math.round((Date.parse(iso) - Date.parse(todayISO())) / 86400000);
  const warna = baki <= 30 ? "text-danger" : baki <= 60 ? "text-warning" : "";
  return (
    <span className={warna}>
      {tarikhPenuh(iso)}
      {baki < 0 ? " (telah tamat)" : baki <= 60 ? ` (${baki} hari lagi)` : ""}
    </span>
  );
}

function UbahTarikhTamat({ p, onClose, onDone }: { p: ButiranPekerja; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ kontrak: p.contractEnd ?? "", permit: p.permitExpiry ?? "", pasport: p.passportExpiry ?? "" });
  const [ralat, setRalat] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function simpan() {
    setBusy(true);
    setRalat(null);
    try {
      await setTarikhTamat(p.id, f.kontrak || null, f.pasport || null, f.permit || null);
      onDone();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
      setBusy(false);
    }
  }
  return (
    <Lembaran title="Tarikh tamat" onClose={onClose}>
      <span className="text-[13px] leading-snug text-subtle">Anda akan diingatkan dalam Papan Pemuka sebelum tarikh ini (kontrak 30 hari, permit &amp; pasport 60 hari).</span>
      <MedanBorang label="Kontrak tamat" nota="Untuk pekerja kontrak atau pelatih">
        <input className={inputKecil} type="date" value={f.kontrak} onChange={(e) => setF({ ...f, kontrak: e.target.value })} />
      </MedanBorang>
      <div className="grid grid-cols-2 gap-2.5">
        <MedanBorang label="Permit kerja tamat">
          <input className={inputKecil} type="date" value={f.permit} onChange={(e) => setF({ ...f, permit: e.target.value })} />
        </MedanBorang>
        <MedanBorang label="Pasport tamat">
          <input className={inputKecil} type="date" value={f.pasport} onChange={(e) => setF({ ...f, pasport: e.target.value })} />
        </MedanBorang>
      </div>
      {ralat && <ErrorBox message={ralat} />}
      <button type="button" onClick={simpan} disabled={busy} className="h-12 rounded-button bg-primary text-base font-extrabold text-white disabled:opacity-60">
        {busy ? "Menyimpan…" : "Simpan"}
      </button>
    </Lembaran>
  );
}

function Tamatkan({ p, onClose, onDone }: { p: ButiranPekerja; onClose: () => void; onDone: () => void }) {
  const [status, setStatus] = useState<"resigned" | "terminated" | "retired">("resigned");
  const [tarikhAkhir, setTarikhAkhir] = useState(todayISO());
  const [sebab, setSebab] = useState("");
  const [ralat, setRalat] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function sahkan() {
    setBusy(true);
    setRalat(null);
    try {
      await tamatkanPekerjaan(p.id, status, tarikhAkhir, sebab);
      onDone();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
      setBusy(false);
    }
  }
  return (
    <Lembaran title={`Tamatkan pekerjaan ${p.name}`} onClose={onClose}>
      <MedanBorang label="Sebab tamat">
        <select className={inputKecil} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="resigned">Letak jawatan</option>
          <option value="terminated">Ditamatkan</option>
          <option value="retired">Bersara</option>
        </select>
      </MedanBorang>
      <MedanBorang label="Hari bekerja terakhir">
        <input className={inputKecil} type="date" value={tarikhAkhir} onChange={(e) => setTarikhAkhir(e.target.value)} />
      </MedanBorang>
      <MedanBorang label="Catatan (pilihan)">
        <textarea className={`${inputKecil} h-20 py-2`} value={sebab} onChange={(e) => setSebab(e.target.value)} />
      </MedanBorang>
      <span className="text-xs text-muted">Pekerja kekal aktif hingga hari bekerja terakhir. Selepas itu peranan dan jemputan dalam syarikat ini dibatalkan. Rekod gaji dan cuti kekal untuk audit.</span>
      {ralat && <ErrorBox message={ralat} />}
      <button type="button" onClick={sahkan} disabled={busy} className="h-12 rounded-button bg-danger text-base font-extrabold text-white disabled:opacity-60">
        {busy ? "Memproses…" : "Tamatkan pekerjaan"}
      </button>
    </Lembaran>
  );
}

// ------------------------------------------------------------------ Tab lain

function TabCuti({ id }: { id: string }) {
  const y = Number(todayISO().slice(0, 4));
  const d = useData(async () => {
    const sb = getSupabase();
    const [bal, req] = await Promise.all([
      sb.from("leave_balances").select("available, entitled, used, leave_types(code, name)").eq("employment_id", id).eq("year", y),
      sb
        .from("leave_requests")
        .select("id, start_date, end_date, days, status, approval_request_id, leave_types(code, name)")
        .eq("employment_id", id)
        .neq("status", "draft")
        .order("start_date", { ascending: false })
        .limit(30),
    ]);
    return { bal: must(bal) ?? [], req: must(req) ?? [] };
  }, [id, y]);
  if (d.error) return <ErrorBox message={d.error} />;
  if (!d.data) return <Loading />;
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {d.data.bal.map((b, i) => (
          <div key={i} className="flex flex-col gap-0.5 rounded-[14px] bg-surface px-3.5 py-3">
            <b className="text-lg font-extrabold">{Number(b.available)}</b>
            <span className="text-xs text-muted">{b.leave_types?.name}</span>
          </div>
        ))}
      </div>
      <Seksyen>PERMOHONAN</Seksyen>
      <Senarai kosong="Tiada permohonan cuti.">
        {d.data.req.map((r) => (
          <BarisRekod
            key={r.id}
            href={r.approval_request_id ? `/permohonan/${r.approval_request_id}` : undefined}
            tajuk={`${r.leave_types?.name ?? "Cuti"} · ${julatTarikh(r.start_date, r.end_date)}`}
            kecil={`${hari(Number(r.days))} hari`}
            status={r.status as StatusPermohonan}
          />
        ))}
      </Senarai>
    </>
  );
}

function TabTuntutan({ id }: { id: string }) {
  const d = useData(async () => {
    return (
      must(
        await getSupabase()
          .from("claims")
          .select("id, title, total_amount, status, paid_at, approval_request_id, created_at")
          .eq("employment_id", id)
          .neq("status", "draft")
          .order("created_at", { ascending: false })
          .limit(30),
      ) ?? []
    );
  }, [id]);
  if (d.error) return <ErrorBox message={d.error} />;
  if (!d.data) return <Loading />;
  return (
    <Senarai kosong="Tiada tuntutan.">
      {d.data.map((c) => (
        <BarisRekod
          key={c.id}
          href={c.approval_request_id ? `/permohonan/${c.approval_request_id}` : undefined}
          tajuk={c.title}
          kecil={`${ringgit(Number(c.total_amount))} · ${tarikh(c.created_at)}${c.paid_at ? " · Dibayar" : ""}`}
          status={c.status as StatusPermohonan}
        />
      ))}
    </Senarai>
  );
}

function TabKehadiran({ id }: { id: string }) {
  const dari = todayISO().slice(0, 8) + "01";
  const d = useData(async () => {
    return (
      must(
        await getSupabase()
          .from("attendance_records")
          .select("work_date, clock_in, clock_out, late_minutes")
          .eq("employment_id", id)
          .gte("work_date", dari)
          .order("work_date", { ascending: false }),
      ) ?? []
    );
  }, [id, dari]);
  if (d.error) return <ErrorBox message={d.error} />;
  if (!d.data) return <Loading />;
  const lewat = d.data.filter((r) => r.late_minutes > 0).length;
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5 rounded-[14px] bg-surface px-3.5 py-3">
          <b className="text-lg font-extrabold">{d.data.length}</b>
          <span className="text-xs text-muted">Hari hadir bulan ini</span>
        </div>
        <div className={`flex flex-col gap-0.5 rounded-[14px] px-3.5 py-3 ${lewat ? "bg-warning-soft text-warning" : "bg-surface"}`}>
          <b className="text-lg font-extrabold">{lewat}</b>
          <span className="text-xs">Lewat masuk</span>
        </div>
      </div>
      <Senarai kosong="Tiada rekod kehadiran bulan ini.">
        {d.data.map((r) => (
          <div key={r.work_date} className="flex min-h-[50px] items-center justify-between gap-2 py-2 text-sm">
            <span className="font-bold">{tarikh(r.work_date)}</span>
            <span className="text-muted">
              {r.clock_in ? masa(r.clock_in) : "-"} – {r.clock_out ? masa(r.clock_out) : "-"}
            </span>
            {r.late_minutes > 0 ? <Tag tone="warning">Lewat {r.late_minutes} min</Tag> : <Tag tone="success">Tepat</Tag>}
          </div>
        ))}
      </Senarai>
    </>
  );
}

function TabGaji({ id, nama, tarikhMula }: { id: string; nama: string; tarikhMula: string }) {
  const me = useMe();
  const boleh = me.roles.some((r) => ["hr", "finance", "admin"].includes(r));
  const buka = boleh;
  const [ubah, setUbah] = useState(false);
  const d = useData(() => (buka ? getGajiSemasa(id) : Promise.resolve(null)), [id, buka]);
  const komp = useData(
    async () =>
      buka
        ? ((must(await getSupabase().from("pay_components").select("code, name, kind, epf_applicable, socso_applicable, taxable").eq("company_id", me.active!.companyId)) ?? [])
            .filter((c) => !["COMMISSION", "OT", "CLAIM", "UNPAID"].includes(c.code))
            .sort((a, b) => Number(a.code !== "BASIC") - Number(b.code !== "BASIC") || a.name.localeCompare(b.name))
            .map((c) => ({ code: c.code, name: c.name, kind: c.kind as "earning" | "deduction", epf: c.epf_applicable, socso: c.socso_applicable, taxable: c.taxable })) as KomponenTetap[])
        : [],
    [buka, me.active!.companyId],
  );
  const semasa = d.data ? Object.fromEntries(d.data.filter((c) => c.effective_from <= todayISO()).map((c) => [c.code, Number(c.amount)])) : null;
  const pr = usePratonton(id, semasa && semasa.BASIC ? semasa : null);
  if (!boleh) return <span className="text-sm text-muted">Maklumat gaji hanya untuk HR dan Kewangan.</span>;
  if (d.error) return <ErrorBox message={d.error} />;
  if (!d.data) return <Loading />;
  return (
    <>
      <Senarai kosong="Tiada komponen gaji direkodkan.">
        {d.data.map((c, i) => (
          <Medan key={i} label={`${c.name}${c.effective_from > todayISO() ? ` (mulai ${tarikh(c.effective_from)})` : ""}`}>
            {ringgit(Number(c.amount))}
          </Medan>
        ))}
      </Senarai>
      <RingkasanKiraan k={semasa?.BASIC ? pr.k : null} mengira={pr.mengira} />
      <button type="button" onClick={() => setUbah(true)} disabled={!komp.data} className="min-h-12 rounded-button bg-primary text-sm font-extrabold text-white disabled:opacity-60 lg:w-60">
        Ubah gaji &amp; elaun
      </button>
      <span className="text-xs text-muted">Akses ini direkodkan. Slip gaji bulanan dijana melalui Proses Gaji.</span>
      {ubah && komp.data && (
        <UbahGaji
          employmentId={id}
          nama={nama}
          komponen={komp.data}
          items={Object.fromEntries(d.data.filter((c) => c.effective_from <= todayISO()).map((c) => [c.code, Number(c.amount)]))}
          tarikhMula={tarikhMula}
          onClose={() => setUbah(false)}
          onDone={() => {
            setUbah(false);
            d.reload();
          }}
        />
      )}
      <BakiAwal id={id} />
    </>
  );
}

/** Data terkumpul tahun ini daripada sistem lama (untuk PCB yang tepat apabila mula pada pertengahan tahun). */
function BakiAwal({ id }: { id: string }) {
  const y = Number(todayISO().slice(0, 4));
  const d = useData(
    async () => must(await getSupabase().from("payroll_opening_balances").select("up_to_month, gross, epf, pcb").eq("employment_id", id).eq("year", y).maybeSingle()),
    [id, y],
  );
  const [f, setF] = useState<{ m: string; g: string; e: string; p: string } | null>(null);
  const [ralat, setRalat] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const v = f ?? (d.data ? { m: String(d.data.up_to_month), g: String(d.data.gross), e: String(d.data.epf), p: String(d.data.pcb) } : { m: String(Math.max(1, Number(todayISO().slice(5, 7)) - 1)), g: "", e: "", p: "" });
  const BULAN = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov"];
  async function simpan() {
    setRalat(null);
    try {
      must(await getSupabase().rpc("set_payroll_opening", { p_employment: id, p_year: y, p_up_to_month: Number(v.m), p_gross: Number(v.g) || 0, p_epf: Number(v.e) || 0, p_pcb: Number(v.p) || 0 }));
      setOk(true);
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
    }
  }
  const num = (k: "g" | "e" | "p") => (e: React.ChangeEvent<HTMLInputElement>) => {
    setOk(false);
    setF({ ...v, [k]: e.target.value.replace(/[^\d.]/g, "") });
  };
  return (
    <div className="mt-2 flex flex-col gap-2.5 rounded-card bg-surface px-4 py-3">
      <b className="text-sm font-extrabold">Data terkumpul {y} daripada sistem lama</b>
      <span className="text-xs text-muted">Untuk syarikat yang mula menggunakan HRBoost pada pertengahan tahun — diperlukan supaya PCB dikira dengan tepat.</span>
      <div className="grid grid-cols-2 gap-2.5">
        <MedanBorang label="Hingga bulan">
          <select className={inputKecil} value={v.m} onChange={(e) => setF({ ...v, m: e.target.value })}>
            {BULAN.map((b, i) => (
              <option key={b} value={i + 1}>
                Jan – {b}
              </option>
            ))}
          </select>
        </MedanBorang>
        <MedanBorang label="Saraan kasar (RM)">
          <input className={inputKecil} inputMode="decimal" value={v.g} onChange={num("g")} />
        </MedanBorang>
        <MedanBorang label="KWSP pekerja (RM)">
          <input className={inputKecil} inputMode="decimal" value={v.e} onChange={num("e")} />
        </MedanBorang>
        <MedanBorang label="PCB dibayar (RM)">
          <input className={inputKecil} inputMode="decimal" value={v.p} onChange={num("p")} />
        </MedanBorang>
      </div>
      {ralat && <ErrorBox message={ralat} />}
      {ok && <span className="text-sm font-semibold text-success">Disimpan.</span>}
      <button type="button" onClick={simpan} className="h-11 rounded-[12px] border border-primary text-sm font-bold text-primary">
        Simpan data terkumpul
      </button>
    </div>
  );
}

function TabDokumen({ p, bolehUbah }: { p: ButiranPekerja; bolehUbah: boolean }) {
  const me = useMe();
  const d = useData(() => getDokumen(p.id), [p.id]);
  const fail = useRef<HTMLInputElement>(null);
  const [jenis, setJenis] = useState("offer_letter");
  const [tajuk, setTajuk] = useState("");
  const [tamatDok, setTamatDok] = useState("");
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);

  async function muatNaik(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setRalat(null);
    try {
      const path = await muatNaikPeribadi(p.personId, `dokumen-${jenis}`, file);
      await simpanDokumen(p.id, me.personId, jenis, tajuk.trim() || (JENIS_DOKUMEN.find((j) => j.value === jenis)?.label ?? "Dokumen"), path, tamatDok);
      setTajuk("");
      setTamatDok("");
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
    }
    setBusy(false);
    if (fail.current) fail.current.value = "";
  }

  async function buka(path: string) {
    const w = window.open("", "_blank");
    const url = await urlSementara(path);
    if (w && url) w.location.href = url;
    else w?.close();
  }

  return (
    <>
      {bolehUbah && (
        <div className="flex flex-col gap-2.5 rounded-card bg-surface px-4 py-3">
          <div className="grid grid-cols-2 gap-2.5">
            <MedanBorang label="Jenis dokumen">
              <select className={inputKecil} value={jenis} onChange={(e) => setJenis(e.target.value)}>
                {JENIS_DOKUMEN.map((j) => (
                  <option key={j.value} value={j.value}>
                    {j.label}
                  </option>
                ))}
              </select>
            </MedanBorang>
            <MedanBorang label="Tajuk (pilihan)">
              <input className={inputKecil} value={tajuk} onChange={(e) => setTajuk(e.target.value)} />
            </MedanBorang>
            <MedanBorang label="Tarikh tamat (pilihan)" nota="Cth. sijil, lesen, permit">
              <input className={inputKecil} type="date" value={tamatDok} onChange={(e) => setTamatDok(e.target.value)} />
            </MedanBorang>
          </div>
          <button type="button" disabled={busy} onClick={() => fail.current?.click()} className="h-12 rounded-button bg-primary text-sm font-bold text-white disabled:opacity-60">
            {busy ? "Memuat naik…" : "Muat naik dokumen"}
          </button>
          <input ref={fail} type="file" accept="image/*,application/pdf" className="hidden" aria-label="Pilih fail dokumen" onChange={(e) => muatNaik(e.target.files?.[0])} />
        </div>
      )}
      {ralat && <ErrorBox message={ralat} />}
      {d.error && <ErrorBox message={d.error} />}
      {!d.data ? (
        <Loading />
      ) : (
        <Senarai kosong="Tiada dokumen.">
          {d.data.map((x) => (
            <button key={x.id} type="button" onClick={() => buka(x.storage_path)} className="flex min-h-12 items-center justify-between gap-2 py-2 text-left text-sm">
              <span className="flex flex-col gap-0.5">
                <b className="font-bold">{x.title}</b>
                <span className="text-xs text-muted">
                  {JENIS_DOKUMEN.find((j) => j.value === x.doc_type)?.label ?? x.doc_type} · {tarikh(x.created_at)}
                  {x.expiry_date && (
                    <>
                      {" · tamat "}
                      <TarikhAmaran iso={x.expiry_date} />
                    </>
                  )}
                </span>
              </span>
              <span className="text-[13px] font-bold text-primary">Buka</span>
            </button>
          ))}
        </Senarai>
      )}
    </>
  );
}

function Senarai({ children, kosong }: { children: React.ReactNode[]; kosong: string }) {
  if (children.length === 0) return <span className="text-sm text-muted">{kosong}</span>;
  return <Kotak>{children}</Kotak>;
}

function BarisRekod({ href, tajuk, kecil, status }: { href?: string; tajuk: string; kecil: string; status: StatusPermohonan }) {
  const isi = (
    <>
      <span className="flex min-w-0 flex-col gap-0.5">
        <b className="text-sm font-bold">{tajuk}</b>
        <span className="text-xs text-muted">{kecil}</span>
      </span>
      <StatusPill status={status} />
    </>
  );
  return href ? (
    <Link href={href} className="flex min-h-12 items-center justify-between gap-2 py-2 text-ink!">
      {isi}
    </Link>
  ) : (
    <div className="flex min-h-12 items-center justify-between gap-2 py-2">{isi}</div>
  );
}
