"use client";

import { tr, trRalat } from "@/lib/i18n";
import { beritahu, mintaTeks, sahkan } from "@/components/Dialog";
import { BANK } from "@/lib/senarai";
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
  kemasKiniPeribadi,
  tukarTarikhMula,
  labelJenis,
  putuskanBank,
  simpanDokumen,
  tamatkanPekerjaan,
  setBahasaPekerja,
  type ButiranPekerja,
  type MaklumatSensitif,
} from "@/lib/hr";
import { muatNaikPeribadi, urlSementara } from "@/lib/upload";
import { setTarikhTamat } from "@/lib/berkanun";
import { SenaraiSemakPekerja } from "@/components/SenaraiSemak";
import { PanelPercubaan } from "@/components/Percubaan";
import { SejarahPekerja } from "@/components/SejarahPekerja";
import { AsetSyarikat, GarisMasaKerja, Keluarga, LatihanSijil } from "@/components/ProfilLanjut";
import { hari, julatTarikh, masa, paparTelefon, ringgit, tarikh, todayISO, type StatusPermohonan } from "@/lib/format";
import { Avatar, BackHeader, ErrorBox, Loading, Screen, StatusPill } from "@/components/ui";
import { RingkasanKiraan, UbahGaji, usePratonton } from "@/components/GajiPekerja";
import { PanelBerkanun } from "@/components/PanelBerkanun";
import type { KomponenTetap } from "@/lib/gaji";
import { HadPeranan, Kotak, Lembaran, Medan, MedanBorang, Seksyen, Tag, inputKecil } from "@/components/Senarai";

const TABS = ["Maklumat", "Kerjaya", "Cuti", "Tuntutan", "Kehadiran", "Gaji", "Dokumen", "Aset", "Sejarah"] as const;
type TabId = (typeof TABS)[number];
const BULAN = [tr("Jan"), tr("Feb"), tr("Mac"), tr("Apr"), tr("Mei"), tr("Jun"), tr("Jul"), tr("Ogo"), tr("Sep"), tr("Okt"), tr("Nov"), tr("Dis")];
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
            {tr(t)}
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
        {p.data && tab === "Kerjaya" && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
            <GarisMasaKerja employmentId={id} boleh={bolehUbah} />
            <LatihanSijil employmentId={id} boleh={bolehUbah} />
          </div>
        )}
        {p.data && tab === "Dokumen" && <TabDokumen p={p.data} bolehUbah={bolehUbah} />}
        {p.data && tab === "Aset" && (
          <div className="lg:max-w-[760px]">
            <AsetSyarikat employmentId={id} boleh={bolehUbah} />
          </div>
        )}
        {p.data && tab === "Sejarah" && (bolehUbah ? <SejarahPekerja employmentId={id} /> : <span className="text-sm text-muted">{tr("Sejarah perubahan hanya untuk HR.")}</span>)}
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
  const [lembaran, setLembaran] = useState<null | "ubah" | "tamat" | "tarikh" | "peribadi">(null);
  // HR terus melihat maklumat peribadi; setiap paparan direkodkan dalam data_access_log (hr_view_sensitive).
  const sd = useData(() => (bolehUbah ? bukaMaklumatSensitif(p.id) : Promise.resolve(null as MaklumatSensitif | null)), [p.id, bolehUbah]);
  const sensitif = sd.data;
  // Permohonan kemas kini profil oleh pekerja (bank, perkahwinan, KWSP …) yang menunggu HR
  const kemasKini = useData(
    async () =>
      bolehUbah
        ? (((
            await getSupabase().from("profile_change_requests").select("changes").eq("employment_id", p.id).eq("status", "pending").maybeSingle()
          ).data as { changes: { label: string }[] } | null) ?? null)
        : null,
    [p.id, bolehUbah],
  );
  // IC & akaun bank bertopeng sehingga HR menekan "Tunjuk" (PDPA: kurangkan pendedahan di skrin).
  const [tunjuk, setTunjuk] = useState(false);
  const topeng = (v: string | null | undefined, depan: number, belakang: number) =>
    !v ? "-" : tunjuk || v.length <= depan + belakang ? v : v.slice(0, depan) + "•".repeat(Math.max(3, v.length - depan - belakang)) + v.slice(-belakang);
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
    ? { label: { resigned: tr("Letak jawatan"), terminated: tr("Ditamatkan"), retired: tr("Bersara") }[p.status as string] ?? tr("Tamat"), tone: "neutral" as const }
    : !p.activated
      ? { label: tr("Belum aktif"), tone: "neutral" as const }
      : p.status === "probation"
        ? { label: tr("Percubaan"), tone: "warning" as const }
        : { label: tr("Aktif"), tone: "success" as const };

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
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
    setBusy(false);
  }

  async function bank(lulus: boolean) {
    if (!sensitif?.bank_change) return;
    const nota = lulus ? "" : ((await mintaTeks({ tajuk: tr("Tolak pertukaran akaun bank"), mesej: tr("Sebab ini dihantar kepada pekerja."), label: tr("Sebab"), ok: tr("Tolak"), bahaya: true })) ?? "");
    if (!lulus && !nota.trim()) return;
    setRalat(null);
    try {
      await putuskanBank(sensitif.bank_change.id, lulus, nota);
      sd.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
  }

  return (
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5">
      <div className="flex flex-col gap-3">
      {baru && <div className="rounded-[14px] bg-success-soft px-4 py-3 text-[13px] font-semibold text-success">{tr("Pekerja ditambah. Jemputan WhatsApp telah dimasukkan ke barisan penghantaran.")}</div>}
      <div className="flex flex-col gap-2.5 rounded-card bg-surface px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <b className="text-sm font-extrabold uppercase">{p.companyName}</b>
          <Tag tone={status.tone}>{tr(status.label)}</Tag>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Butir label={tr("No. pekerja")}>{p.employeeNo}</Butir>
          <Butir label={tr("Jabatan")}>{p.department ?? "-"}</Butir>
          <Butir label={tr("Ketua")}>{p.headName ?? "-"}</Butir>
          <Butir label={tr("Mula")}>{tarikhPenuh(p.joinDate)}</Butir>
          <Butir label={tr("Jenis")}>{labelJenis(p.type)}</Butir>
          <Butir label={tr("Masuk kerja")}>{(p.workStart ?? p.companyWorkStart).slice(0, 5)}</Butir>
          <Butir label={tr("Bahasa")}>{bolehUbah && !tamat ? <BahasaPekerja p={p} reload={reload} /> : p.language === "ms" ? "Bahasa Melayu" : "English"}</Butir>
          {p.position && <Butir label={tr("Jawatan")}>{p.position}</Butir>}
          {p.status === "probation" && p.probationEnd && <Butir label={tr("Tamat percubaan")}>{tarikhPenuh(p.probationEnd)}</Butir>}
          {tamat && p.endDate && <Butir label={tr("Tarikh akhir")}>{tarikhPenuh(p.endDate)}</Butir>}
          {p.contractEnd && <Butir label={tr("Kontrak tamat")}><TarikhAmaran iso={p.contractEnd} /></Butir>}
          {p.permitExpiry && <Butir label={tr("Permit kerja tamat")}><TarikhAmaran iso={p.permitExpiry} /></Butir>}
          {p.passportExpiry && <Butir label={tr("Pasport tamat")}><TarikhAmaran iso={p.passportExpiry} /></Butir>}
        </div>
      </div>

      {!tamat && p.endStatus && p.endDate && (
        <div className="flex items-center gap-2.5 rounded-[14px] bg-danger-soft px-3.5 py-3 text-[13px] font-semibold text-danger">
          <span className="grow">
            {tr("{0} · hari bekerja terakhir {1}", { resigned: tr("Letak jawatan"), terminated: tr("Ditamatkan"), retired: tr("Bersara") }[p.endStatus as string], tarikhPenuh(p.endDate))}</span>
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
              {tr("Batal")}</button>
          )}
        </div>
      )}

      {p.otherCompanies > 0 && (
        <div className="flex items-center gap-2.5 rounded-[14px] bg-surface px-3.5 py-3 text-[13px] text-[#4A5A57]">
          {tr("{0} juga bekerja di {1} syarikat lain. Butiran di sana hanya boleh dilihat oleh HR syarikat tersebut.", p.name, p.otherCompanies)}</div>
      )}

      {!p.activated && !tamat && (pautan || p.inviteSentAt) && (
        <div className="flex flex-col gap-2 rounded-[14px] bg-surface px-4 py-3 text-[13px] text-[#4A5A57]">
          {p.inviteSentAt && <span>{tr("Jemputan terakhir: {0}, {1}", tarikh(p.inviteSentAt), masa(p.inviteSentAt))}</span>}
          {pautan && (
            <>
              <span className="font-mono text-xs break-all text-ink">{pautan}</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => navigator.clipboard?.writeText(pautan)} className="h-10 grow rounded-[12px] border border-line text-[13px] font-bold">
                  {tr("Salin pautan")}</button>
              </div>
            </>
          )}
        </div>
      )}

      {bolehUbah && !tamat && (
        <section aria-label={tr("Tindakan")} className="flex flex-col gap-2">
          <Seksyen>{tr("TINDAKAN")}</Seksyen>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Tindakan utama onClick={() => setLembaran("ubah")} tajuk={tr("Ubah gaji & jawatan")} keterangan={tr("Gaji, elaun, jawatan, jabatan, ketua")} />
            {p.status === "probation" && (
              <Tindakan
                onClick={async () => {
                  if (!(await sahkan({ tajuk: tr("Sahkan jawatan {0}?", p.name), mesej: tr("Tempoh percubaan tamat dan jawatan disahkan mulai hari ini."), ok: tr("Sahkan jawatan") }))) return;
                  try {
                    await kemasKiniPekerjaan(p.id, { confirm: true });
                    reload();
                  } catch (e) {
                    setRalat(e instanceof Error ? e.message : tr("Ralat"));
                  }
                }}
                tajuk={tr("Sahkan jawatan")}
                keterangan={tr("Tamatkan tempoh percubaan")}
              />
            )}
            <Tindakan onClick={keDokumen} tajuk={tr("Dokumen")} keterangan={tr("Kontrak, surat tawaran, sijil")} />
            <Tindakan href={`/pembantu-ai?pekerja=${p.id}&surat=1`} ai tajuk={tr("Draf surat (AI)")} keterangan={tr("Pengesahan, amaran, tawaran, pelepasan")} />
            <Tindakan onClick={() => setLembaran("tarikh")} tajuk={tr("Tarikh tamat kontrak, permit & pasport")} keterangan={tr("Peringatan sebelum tamat")} />
            {!p.activated && <Tindakan onClick={jemputSemula} disabled={busy} tajuk={busy ? tr("Menghantar…") : tr("Hantar semula jemputan")} keterangan={tr("Pautan pengaktifan baharu melalui WhatsApp")} />}
          </div>
          <button
            type="button"
            onClick={() => setLembaran("tamat")}
            disabled={!!p.endStatus}
            className="flex min-h-11 items-center self-start px-1 text-sm font-bold text-danger disabled:opacity-50"
          >
            {tr("Tamatkan pekerjaan")}
          </button>
        </section>
      )}
      {bolehUbah && p.status === "probation" && !p.endStatus && <PanelPercubaan employmentId={p.id} onTamatkan={() => setLembaran("tamat")} onUbah={reload} />}
      {bolehUbah && !tamat && <SenaraiSemakPekerja employmentId={p.id} hr />}
      </div>
      <div className="flex flex-col gap-3">
      {bolehUbah && (
        <>
          <div className="flex items-center justify-between gap-2">
            <Seksyen>{tr("MAKLUMAT PERIBADI")}</Seksyen>
            {sensitif && (
              <button type="button" onClick={() => setLembaran("peribadi")} className="flex h-10 items-center rounded-full border border-primary bg-surface px-4 text-[13px] font-bold text-primary">
                {tr("Ubah maklumat")}
              </button>
            )}
          </div>
          {sd.error && <ErrorBox message={sd.error} />}
          {!sensitif ? (
            !sd.error && <Loading />
          ) : (
            <>
              <Kotak>
                <Medan label={tr("Nama penuh")}>{sensitif.full_name}</Medan>
                <Medan label={tr("No. kad pengenalan")}>
                  <span className="flex items-center justify-end gap-2">
                    <span className="tabular-nums">{topeng(sensitif.ic_no, 6, 2)}</span>
                    {(sensitif.ic_no || sensitif.bank_account_no) && (
                      <button type="button" onClick={() => setTunjuk((x) => !x)} className="min-h-11 px-1 text-xs font-bold text-primary">
                        {tunjuk ? tr("Sorok") : tr("Tunjuk")}</button>
                    )}
                  </span>
                </Medan>
                <Medan label={tr("Warganegara")}>{sensitif.nationality === "MY" || !sensitif.nationality ? tr("Malaysia") : sensitif.nationality}</Medan>
                {sensitif.passport_no && <Medan label={tr("No. pasport")}>{sensitif.passport_no}</Medan>}
                <Medan label={tr("WhatsApp")}>{sensitif.phone ? paparTelefon(sensitif.phone) : "-"}</Medan>
                <Medan label={tr("E-mel peribadi")}>{sensitif.email ?? "-"}</Medan>
                <Medan label={tr("Alamat")}>{sensitif.address ?? "-"}</Medan>
                <Medan label={tr("Status perkahwinan")}>{sensitif.marital_status ?? "-"}</Medan>
                <Medan label={tr("Anak (PCB)")}>{sensitif.children_count}</Medan>
                <Medan label={tr("Bank")}>{sensitif.bank_name ? `${sensitif.bank_name} · ${topeng(sensitif.bank_account_no, 0, 4)}` : "-"}</Medan>
                <Medan label={tr("KWSP / PERKESO / Cukai")}>{[sensitif.epf_no, sensitif.socso_no, sensitif.tax_no].map((x) => x ?? "-").join(" / ")}</Medan>
                {(sensitif.emergency ?? []).map((w, i) => (
                  <Medan key={i} label={tr("Waris: {0}", w.name)}>
                    {[w.relationship, w.phone].filter(Boolean).join(" · ")}
                  </Medan>
                ))}
              </Kotak>
              <Keluarga employmentId={p.id} boleh={bolehUbah} />
              {kemasKini.data && (
                <Link href="/kelulusan" className="flex flex-col gap-1 rounded-[14px] bg-warning-soft px-4 py-3 text-[13px] text-warning!">
                  <b>{tr("Permohonan kemas kini profil menunggu")}</b>
                  <span>{kemasKini.data.changes.map((c) => trRalat(c.label)).join(", ")}</span>
                  <span className="font-bold">{tr("Semak dalam Kelulusan ›")}</span>
                </Link>
              )}
              {sensitif.bank_change && (
                <div className="flex flex-col gap-2.5 rounded-[14px] bg-warning-soft px-4 py-3">
                  <span className="text-[13px] font-semibold text-warning">
                    {tr("Mohon tukar akaun bank ke {0} · {1} ({2})", sensitif.bank_change.bank_name, sensitif.bank_change.bank_account_no, tarikh(sensitif.bank_change.requested_at))}</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => bank(false)} className="h-11 rounded-[12px] border border-danger bg-surface text-sm font-bold text-danger">
                      {tr("Tolak")}</button>
                    <button type="button" onClick={() => bank(true)} className="h-11 rounded-[12px] bg-primary text-sm font-bold text-white">
                      {tr("Sahkan akaun")}</button>
                  </div>
                </div>
              )}
            </>
          )}

        </>
      )}
      {ralat && <ErrorBox message={ralat} />}
      <span className="text-xs text-muted">{tr("Kad pengenalan, akaun bank dan rekod cuti sakit hanya boleh dilihat oleh HR. Setiap akses direkodkan.")}</span>
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
      {lembaran === "peribadi" && sensitif && (
        <UbahPeribadi
          employmentId={p.id}
          s={sensitif}
          tarikhMula={p.joinDate}
          onClose={() => setLembaran(null)}
          onDone={() => {
            setLembaran(null);
            sd.reload();
            reload();
            beritahu(tr("Maklumat peribadi dikemas kini. Pekerja dimaklumkan melalui WhatsApp."));
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
      <KadRingkas l={tr("Baki cuti tahunan")} v={x.baki === null ? "—" : tr("{0} hari", hari(x.baki))} />
      <KadRingkas l={tr("Hadir bulan ini")} v={tr("{0} hari", x.hadir)} s={x.lewat ? tr("{0} kali lewat", x.lewat) : undefined} tone={x.lewat ? "text-warning" : ""} />
      <KadRingkas l={tr("Tuntutan menunggu")} v={String(x.tuntutan)} s={x.tuntutan ? ringgit(x.jumlah) : undefined} />
    </div>
  );
}

/** Tajuk profil: avatar, nama, jawatan · jabatan, status — dipaparkan pada semua tab. */
function KepalaPekerja({ p }: { p: ButiranPekerja }) {
  const tamat = !["probation", "active"].includes(p.status);
  const st = tamat
    ? { label: tr("Tamat"), tone: "neutral" as const }
    : !p.activated
      ? { label: tr("Belum aktif"), tone: "neutral" as const }
      : p.status === "probation"
        ? { label: tr("Percubaan"), tone: "warning" as const }
        : { label: tr("Aktif"), tone: "success" as const };
  return (
    <div className="flex items-center gap-3 px-4 pt-1 pb-3 lg:px-0">
      <Avatar name={p.name} size={56} personId={p.personId} />
      <div className="flex min-w-0 grow flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <h1 className="m-0 text-xl font-extrabold lg:text-2xl">{p.name}</h1>
          <Tag tone={st.tone}>{tr(st.label)}</Tag>
        </span>
        <span className="truncate text-[13px] text-muted">
          {[p.position, p.department, p.employeeNo].filter(Boolean).join(" · ")}
        </span>
      </div>
    </div>
  );
}

/** Bahasa WhatsApp & aplikasi pekerja — HR boleh menukarnya terus di profil. */
function BahasaPekerja({ p, reload }: { p: ButiranPekerja; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <select
      aria-label={tr("Bahasa {0}", p.name)}
      value={p.language}
      disabled={busy}
      onChange={async (e) => {
        setBusy(true);
        try {
          await setBahasaPekerja(p.id, e.target.value as "en" | "ms");
          beritahu(tr("Bahasa {0} dikemas kini.", p.name));
          reload();
        } catch (err) {
          beritahu(err instanceof Error ? trRalat(err.message) : tr("Ralat"), "ralat");
        }
        setBusy(false);
      }}
      className="-ml-1 h-9 rounded-[10px] border border-[#D5DEDC] bg-surface px-1.5 text-sm font-bold"
    >
      <option value="en">English</option>
      <option value="ms">Bahasa Melayu</option>
    </select>
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
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
      setBusy(false);
    }
  }
  return (
    <Lembaran title={tr("Ubah gaji & jawatan")} onClose={onClose}>
      <div className="grid grid-cols-2 gap-2.5">
        <MedanBorang label={tr("Jabatan")}>
          <select className={inputKecil} value={f.department_id} onChange={(e) => setF({ ...f, department_id: e.target.value })}>
            <option value="">{tr("Tiada")}</option>
            {(jab.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </MedanBorang>
        <MedanBorang label={tr("Jawatan")}>
          <input className={inputKecil} value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })} />
        </MedanBorang>
        <MedanBorang label={tr("Jenis")}>
          <select className={inputKecil} value={f.employment_type} onChange={(e) => setF({ ...f, employment_type: e.target.value })}>
            {JENIS_PEKERJAAN.map((j) => (
              <option key={j.value} value={j.value}>
                {tr(j.label)}
              </option>
            ))}
          </select>
        </MedanBorang>
        <MedanBorang label={tr("Masuk kerja")} nota={tr("Kosong = ikut syarikat ({0})", p.companyWorkStart.slice(0, 5))}>
          <input className={inputKecil} type="time" value={f.work_start} onChange={(e) => setF({ ...f, work_start: e.target.value })} />
        </MedanBorang>
        <MedanBorang label={tr("Gaji pokok baharu (RM)")} nota={tr("Kosong = tiada perubahan")}>
          <input className={inputKecil} inputMode="decimal" value={f.basic} onChange={(e) => setF({ ...f, basic: e.target.value.replace(/[^\d.]/g, "") })} />
        </MedanBorang>
        <MedanBorang label={tr("Berkuat kuasa")}>
          <input className={inputKecil} type="date" value={f.effective_from} onChange={(e) => setF({ ...f, effective_from: e.target.value })} />
        </MedanBorang>
      </div>
      {ralat && <ErrorBox message={ralat} />}
      <button type="button" onClick={simpan} disabled={busy} className="h-12 rounded-button bg-primary text-base font-extrabold text-white disabled:opacity-60">
        {busy ? tr("Menyimpan…") : tr("Simpan")}
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
      {baki < 0 ? tr(" (telah tamat)") : baki <= 60 ? tr(" ({0} hari lagi)", baki) : ""}
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
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
      setBusy(false);
    }
  }
  return (
    <Lembaran title={tr("Tarikh tamat")} onClose={onClose}>
      <span className="text-[13px] leading-snug text-subtle">{tr("Anda akan diingatkan dalam Papan Pemuka sebelum tarikh ini (kontrak 30 hari, permit & pasport 60 hari).")}</span>
      <MedanBorang label={tr("Kontrak tamat")} nota={tr("Untuk pekerja kontrak atau pelatih")}>
        <input className={inputKecil} type="date" value={f.kontrak} onChange={(e) => setF({ ...f, kontrak: e.target.value })} />
      </MedanBorang>
      <div className="grid grid-cols-2 gap-2.5">
        <MedanBorang label={tr("Permit kerja tamat")}>
          <input className={inputKecil} type="date" value={f.permit} onChange={(e) => setF({ ...f, permit: e.target.value })} />
        </MedanBorang>
        <MedanBorang label={tr("Pasport tamat")}>
          <input className={inputKecil} type="date" value={f.pasport} onChange={(e) => setF({ ...f, pasport: e.target.value })} />
        </MedanBorang>
      </div>
      {ralat && <ErrorBox message={ralat} />}
      <button type="button" onClick={simpan} disabled={busy} className="h-12 rounded-button bg-primary text-base font-extrabold text-white disabled:opacity-60">
        {busy ? tr("Menyimpan…") : tr("Simpan")}
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
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
      setBusy(false);
    }
  }
  return (
    <Lembaran title={tr("Tamatkan pekerjaan {0}", p.name)} onClose={onClose}>
      <MedanBorang label={tr("Sebab tamat")}>
        <select className={inputKecil} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="resigned">{tr("Letak jawatan")}</option>
          <option value="terminated">{tr("Ditamatkan")}</option>
          <option value="retired">{tr("Bersara")}</option>
        </select>
      </MedanBorang>
      <MedanBorang label={tr("Hari bekerja terakhir")}>
        <input className={inputKecil} type="date" value={tarikhAkhir} onChange={(e) => setTarikhAkhir(e.target.value)} />
      </MedanBorang>
      <MedanBorang label={tr("Catatan (pilihan)")}>
        <textarea className={`${inputKecil} h-20 py-2`} value={sebab} onChange={(e) => setSebab(e.target.value)} />
      </MedanBorang>
      <span className="text-xs text-muted">{tr("Pekerja kekal aktif hingga hari bekerja terakhir. Selepas itu peranan dan jemputan dalam syarikat ini dibatalkan. Rekod gaji dan cuti kekal untuk audit.")}</span>
      {ralat && <ErrorBox message={ralat} />}
      <button type="button" onClick={sahkan} disabled={busy} className="h-12 rounded-button bg-danger text-base font-extrabold text-white disabled:opacity-60">
        {busy ? tr("Memproses…") : tr("Tamatkan pekerjaan")}
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
      <Seksyen>{tr("PERMOHONAN")}</Seksyen>
      <Senarai kosong={tr("Tiada permohonan cuti.")}>
        {d.data.req.map((r) => (
          <BarisRekod
            key={r.id}
            href={r.approval_request_id ? `/permohonan/${r.approval_request_id}` : undefined}
            tajuk={`${r.leave_types?.name ?? tr("Cuti")} · ${julatTarikh(r.start_date, r.end_date)}`}
            kecil={tr("{0} hari", hari(Number(r.days)))}
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
    <Senarai kosong={tr("Tiada tuntutan.")}>
      {d.data.map((c) => (
        <BarisRekod
          key={c.id}
          href={c.approval_request_id ? `/permohonan/${c.approval_request_id}` : undefined}
          tajuk={c.title}
          kecil={`${ringgit(Number(c.total_amount))} · ${tarikh(c.created_at)}${c.paid_at ? tr(" · Dibayar") : ""}`}
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
          <span className="text-xs text-muted">{tr("Hari hadir bulan ini")}</span>
        </div>
        <div className={`flex flex-col gap-0.5 rounded-[14px] px-3.5 py-3 ${lewat ? "bg-warning-soft text-warning" : "bg-surface"}`}>
          <b className="text-lg font-extrabold">{lewat}</b>
          <span className="text-xs">{tr("Lewat masuk")}</span>
        </div>
      </div>
      <Senarai kosong={tr("Tiada rekod kehadiran bulan ini.")}>
        {d.data.map((r) => (
          <div key={r.work_date} className="flex min-h-[50px] items-center justify-between gap-2 py-2 text-sm">
            <span className="font-bold">{tarikh(r.work_date)}</span>
            <span className="text-muted">
              {r.clock_in ? masa(r.clock_in) : "-"} – {r.clock_out ? masa(r.clock_out) : "-"}
            </span>
            {r.late_minutes > 0 ? <Tag tone="warning">{tr("Lewat {0} min", r.late_minutes)}</Tag> : <Tag tone="success">{tr("Tepat")}</Tag>}
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
        ? ((must(await getSupabase().from("pay_components").select("code, name, kind, epf_applicable, socso_applicable, taxable, active, in_table").eq("company_id", me.active!.companyId)) ?? [])
            .filter((c) => !["COMMISSION", "OT", "OT_LULUS", "CLAIM", "UNPAID", "ARREARS"].includes(c.code) && c.kind !== "benefit")
            .filter((c) => (c.active && c.in_table) || (d.data ?? []).some((x) => x.code === c.code))
            .sort((a, b) => Number(a.code !== "BASIC") - Number(b.code !== "BASIC") || a.name.localeCompare(b.name))
            .map((c) => ({ code: c.code, name: c.name, kind: c.kind as "earning" | "deduction", epf: c.epf_applicable, socso: c.socso_applicable, taxable: c.taxable })) as KomponenTetap[])
        : [],
    [buka, me.active!.companyId, (d.data ?? []).map((x) => x.code).join(",")],
  );
  const semasa = d.data ? Object.fromEntries(d.data.filter((c) => c.effective_from <= todayISO()).map((c) => [c.code, Number(c.amount)])) : null;
  const pr = usePratonton(id, semasa && semasa.BASIC ? semasa : null);
  if (!boleh) return <span className="text-sm text-muted">{tr("Maklumat gaji hanya untuk HR dan Kewangan.")}</span>;
  if (d.error) return <ErrorBox message={d.error} />;
  if (!d.data) return <Loading />;
  return (
    <>
      <Senarai kosong={tr("Tiada komponen gaji direkodkan.")}>
        {d.data.map((c, i) => (
          <Medan key={i} label={`${c.name}${c.effective_from > todayISO() ? tr(" (mulai {0})", tarikh(c.effective_from)) : ""}`}>
            {ringgit(Number(c.amount))}
          </Medan>
        ))}
      </Senarai>
      <RingkasanKiraan k={semasa?.BASIC ? pr.k : null} mengira={pr.mengira} />
      <button type="button" onClick={() => setUbah(true)} disabled={!komp.data} className="min-h-12 rounded-button bg-primary text-sm font-extrabold text-white disabled:opacity-60 lg:w-60">
        {tr("Ubah gaji & elaun")}</button>
      <span className="text-xs text-muted">{tr("Akses ini direkodkan. Slip gaji bulanan dijana melalui Proses Gaji.")}</span>
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
      <PanelBerkanun employmentId={id} nama={nama} />
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
  const BULAN = [tr("Jan"), tr("Feb"), tr("Mac"), tr("Apr"), tr("Mei"), tr("Jun"), tr("Jul"), tr("Ogo"), tr("Sep"), tr("Okt"), tr("Nov")];
  async function simpan() {
    setRalat(null);
    try {
      must(await getSupabase().rpc("set_payroll_opening", { p_employment: id, p_year: y, p_up_to_month: Number(v.m), p_gross: Number(v.g) || 0, p_epf: Number(v.e) || 0, p_pcb: Number(v.p) || 0 }));
      setOk(true);
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
  }
  const num = (k: "g" | "e" | "p") => (e: React.ChangeEvent<HTMLInputElement>) => {
    setOk(false);
    setF({ ...v, [k]: e.target.value.replace(/[^\d.]/g, "") });
  };
  return (
    <div className="mt-2 flex flex-col gap-2.5 rounded-card bg-surface px-4 py-3">
      <b className="text-sm font-extrabold">{tr("Data terkumpul {0} daripada sistem lama", y)}</b>
      <span className="text-xs text-muted">{tr("Untuk syarikat yang mula menggunakan HRBoost pada pertengahan tahun — diperlukan supaya PCB dikira dengan tepat.")}</span>
      <div className="grid grid-cols-2 gap-2.5">
        <MedanBorang label={tr("Hingga bulan")}>
          <select className={inputKecil} value={v.m} onChange={(e) => setF({ ...v, m: e.target.value })}>
            {BULAN.map((b, i) => (
              <option key={b} value={i + 1}>
                {tr("Jan – {0}", b)}</option>
            ))}
          </select>
        </MedanBorang>
        <MedanBorang label={tr("Saraan kasar (RM)")}>
          <input className={inputKecil} inputMode="decimal" value={v.g} onChange={num("g")} />
        </MedanBorang>
        <MedanBorang label={tr("KWSP pekerja (RM)")}>
          <input className={inputKecil} inputMode="decimal" value={v.e} onChange={num("e")} />
        </MedanBorang>
        <MedanBorang label={tr("PCB dibayar (RM)")}>
          <input className={inputKecil} inputMode="decimal" value={v.p} onChange={num("p")} />
        </MedanBorang>
      </div>
      {ralat && <ErrorBox message={ralat} />}
      {ok && <span className="text-sm font-semibold text-success">{tr("Disimpan.")}</span>}
      <button type="button" onClick={simpan} className="h-11 rounded-[12px] border border-primary text-sm font-bold text-primary">
        {tr("Simpan data terkumpul")}</button>
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
      await simpanDokumen(p.id, me.personId, jenis, tajuk.trim() || (JENIS_DOKUMEN.find((j) => j.value === jenis)?.label ?? tr("Dokumen")), path, tamatDok);
      setTajuk("");
      setTamatDok("");
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
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
            <MedanBorang label={tr("Jenis dokumen")}>
              <select className={inputKecil} value={jenis} onChange={(e) => setJenis(e.target.value)}>
                {JENIS_DOKUMEN.map((j) => (
                  <option key={j.value} value={j.value}>
                    {tr(j.label)}
                  </option>
                ))}
              </select>
            </MedanBorang>
            <MedanBorang label={tr("Tajuk (pilihan)")}>
              <input className={inputKecil} value={tajuk} onChange={(e) => setTajuk(e.target.value)} />
            </MedanBorang>
            <MedanBorang label={tr("Tarikh tamat (pilihan)")} nota={tr("Cth. sijil, lesen, permit")}>
              <input className={inputKecil} type="date" value={tamatDok} onChange={(e) => setTamatDok(e.target.value)} />
            </MedanBorang>
          </div>
          <button type="button" disabled={busy} onClick={() => fail.current?.click()} className="h-12 rounded-button bg-primary text-sm font-bold text-white disabled:opacity-60">
            {busy ? tr("Memuat naik…") : tr("Muat naik dokumen")}
          </button>
          <input ref={fail} type="file" accept="image/*,application/pdf" className="hidden" aria-label={tr("Pilih fail dokumen")} onChange={(e) => muatNaik(e.target.files?.[0])} />
        </div>
      )}
      {ralat && <ErrorBox message={ralat} />}
      {d.error && <ErrorBox message={d.error} />}
      {!d.data ? (
        <Loading />
      ) : (
        <Senarai kosong={tr("Tiada dokumen.")}>
          {d.data.map((x) => (
            <button key={x.id} type="button" onClick={() => buka(x.storage_path)} className="flex min-h-12 items-center justify-between gap-2 py-2 text-left text-sm">
              <span className="flex flex-col gap-0.5">
                <b className="font-bold">{x.title}</b>
                <span className="text-xs text-muted">
                  {JENIS_DOKUMEN.find((j) => j.value === x.doc_type)?.label ?? x.doc_type} · {tarikh(x.created_at)}
                  {x.expiry_date && (
                    <>
                      {tr(" · tamat ")}
                      <TarikhAmaran iso={x.expiry_date} />
                    </>
                  )}
                </span>
              </span>
              <span className="text-[13px] font-bold text-primary">{tr("Buka")}</span>
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

/** Butang tindakan profil pekerja: tajuk + keterangan ringkas, semua dipaparkan (tiada menu tersembunyi). */
function Tindakan({ tajuk, keterangan, onClick, href, utama, ai, disabled }: { tajuk: string; keterangan: string; onClick?: () => void; href?: string; utama?: boolean; ai?: boolean; disabled?: boolean }) {
  const cls = `flex min-h-14 flex-col justify-center gap-0.5 rounded-[14px] border px-4 py-2.5 text-left disabled:opacity-60 ${
    utama ? "border-primary bg-primary text-white!" : ai ? "border-[#D9D2F1] bg-[#F3F0FC] text-[#4A3B8C]! hover:border-ai" : "border-line bg-surface text-ink! hover:border-primary"
  }`;
  const isi = (
    <>
      <b className="text-sm font-extrabold">{tajuk}</b>
      <span className={`text-xs ${utama ? "text-white/80" : "text-muted"}`}>{keterangan}</span>
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {isi}
    </Link>
  ) : (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {isi}
    </button>
  );
}

const STATUS_KAHWIN = [
  { id: "bujang", label: tr("Bujang") },
  { id: "berkahwin", label: tr("Berkahwin") },
  { id: "duda_janda", label: tr("Duda / Janda") },
];

const kotak = "h-11 w-full rounded-[12px] border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary";
function Label({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[13px] font-bold text-[#4A5A57]">
      {t}
      {children}
    </label>
  );
}

/** HR mengemas kini maklumat peribadi pekerja. Hanya medan yang berubah dihantar. */
function UbahPeribadi({ employmentId, s, tarikhMula, onClose, onDone }: { employmentId: string; s: MaklumatSensitif; tarikhMula: string; onClose: () => void; onDone: () => void }) {
  const [mula, setMula] = useState(tarikhMula);
  const asal = {
    full_name: s.full_name ?? "",
    ic_no: s.ic_no ?? "",
    phone_whatsapp: s.phone ?? "",
    address: s.address ?? "",
    marital_status: s.marital_status ?? "",
    children_count: String(s.children_count ?? 0),
    bank_name: s.bank_name ?? "",
    bank_account_no: s.bank_account_no ?? "",
    epf_no: s.epf_no ?? "",
    socso_no: s.socso_no ?? "",
    tax_no: s.tax_no ?? "",
    nationality: s.nationality ?? "MY",
    email: s.email ?? "",
    passport_no: s.passport_no ?? "",
  };
  const [f, setF] = useState(asal);
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const set = (k: keyof typeof asal) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const ubah = (Object.keys(asal) as (keyof typeof asal)[]).filter((k) => f[k].trim() !== asal[k].trim());

  async function simpan() {
    const mulaBerubah = mula && mula !== tarikhMula;
    if (!ubah.length && !mulaBerubah) return onClose();
    setBusy(true);
    setRalat(null);
    try {
      if (mulaBerubah) await tukarTarikhMula(employmentId, mula);
      if (ubah.length) await kemasKiniPeribadi(employmentId, Object.fromEntries(ubah.map((k) => [k, k === "children_count" ? Number(f[k]) || 0 : f[k].trim() || null])));
      onDone();
    } catch (e) {
      setRalat(e instanceof Error ? trRalat(e.message) : tr("Ralat"));
    }
    setBusy(false);
  }

  return (
    <Lembaran title={tr("Ubah maklumat peribadi")} onClose={onClose}>
      <span className="text-xs leading-normal text-muted">{tr("Nama penuh dan no. kad pengenalan mesti sama seperti kad pengenalan (untuk slip gaji, KWSP dan Borang EA). Pekerja akan dimaklumkan tentang perubahan.")}</span>
      <Label t={tr("Nama penuh (ikut kad pengenalan)")}>
        <input value={f.full_name} onChange={set("full_name")} className={kotak} />
      </Label>
      <Label t={tr("Tarikh mula bekerja")}>
        <input type="date" value={mula} onChange={(e) => setMula(e.target.value)} className={kotak} />
      </Label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Label t={tr("No. kad pengenalan")}>
          <input value={f.ic_no} onChange={set("ic_no")} inputMode="numeric" placeholder="900101-14-1234" className={kotak} />
        </Label>
        <Label t={tr("WhatsApp")}>
          <input value={f.phone_whatsapp} onChange={set("phone_whatsapp")} inputMode="tel" placeholder="012-345 6789" className={kotak} />
        </Label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Label t={tr("Warganegara")}>
          <select value={f.nationality} onChange={set("nationality")} className={kotak}>
            {[["MY", tr("Malaysia")], ["ID", tr("Indonesia")], ["BD", tr("Bangladesh")], ["NP", tr("Nepal")], ["MM", tr("Myanmar")], ["IN", tr("India")], ["PH", tr("Filipina")], ["PK", tr("Pakistan")], ["VN", tr("Vietnam")], ["LAIN", tr("Lain-lain")]].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Label>
        <Label t={tr("No. pasport")}>
          <input value={f.passport_no} onChange={set("passport_no")} className={kotak} />
        </Label>
        <Label t={tr("E-mel peribadi")}>
          <input type="email" value={f.email} onChange={set("email")} className={kotak} />
        </Label>
      </div>
      <Label t={tr("Alamat")}>
        <textarea value={f.address} onChange={set("address")} rows={2} className="w-full rounded-[12px] border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
      </Label>
      <div className="grid grid-cols-2 gap-3">
        <Label t={tr("Status perkahwinan")}>
          <select value={f.marital_status} onChange={set("marital_status")} className={kotak}>
            <option value="">-</option>
            {STATUS_KAHWIN.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </Label>
        <Label t={tr("Anak (PCB)")}>
          <input type="number" min={0} max={30} value={f.children_count} onChange={set("children_count")} className={kotak} />
        </Label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Label t={tr("Bank")}>
          <select value={f.bank_name} onChange={set("bank_name")} className={kotak}>
            <option value="">-</option>
            {[...new Set([...(f.bank_name && !BANK.includes(f.bank_name) ? [f.bank_name] : []), ...BANK])].map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </Label>
        <Label t={tr("No. akaun bank")}>
          <input value={f.bank_account_no} onChange={set("bank_account_no")} inputMode="numeric" className={kotak} />
        </Label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Label t={tr("No. KWSP")}>
          <input value={f.epf_no} onChange={set("epf_no")} className={kotak} />
        </Label>
        <Label t={tr("No. PERKESO")}>
          <input value={f.socso_no} onChange={set("socso_no")} className={kotak} />
        </Label>
        <Label t={tr("No. cukai")}>
          <input value={f.tax_no} onChange={set("tax_no")} className={kotak} />
        </Label>
      </div>
      {ralat && <ErrorBox message={ralat} />}
      <button type="button" onClick={simpan} disabled={busy} className="flex h-12 items-center justify-center rounded-button bg-primary text-base font-extrabold text-white disabled:opacity-50">
        {busy ? tr("Menyimpan…") : ubah.length ? tr("Simpan {0} perubahan", ubah.length) : tr("Tiada perubahan")}
      </button>
    </Lembaran>
  );
}
