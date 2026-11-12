"use client";

import { tawarLulusBerturut } from "@/lib/lulusBerturut";
import { tr, trRalat, trTajuk } from "@/lib/i18n";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { hasRole, useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { mesejRalat, must, useData } from "@/lib/useData";
import { getDashboard, getDashboardTambahan, getTugasSaya, type Dashboard } from "@/lib/hr";
import { BULAN_PENUH } from "@/lib/gaji";
import { addDays, hariTarikh, inisial, masa, ringgit, tarikh, todayISO, ucapan } from "@/lib/format";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { HadPeranan } from "@/components/Senarai";
import { TabNav } from "@/components/TabNav";
import { Loceng } from "@/components/Loceng";
import { bukaCari } from "@/components/CariPantas";
import { useSkrinLebar } from "@/lib/skrin";
import { ButangBantuan, KadPanduan } from "@/components/Panduan";
import { ringkasSemakHr } from "@/components/SenaraiSemak";
import { getTugasSemakSaya } from "@/lib/berkanun";
import { getFleksibel, getSoalan, getSurat } from "@/lib/urusan";
import { KadPengumuman } from "@/components/Pengumuman";
import { getTugasanHr } from "@/lib/modul";
import { getKalendarBerkanun, getTarikhTamat, tandaDihantar, type KewajipanBerkanun } from "@/lib/berkanun";
import { beritahu, mintaTeks } from "@/components/Dialog";

const AV = ["bg-[#FDEBD7] text-warning", "bg-[#E3F1EE] text-primary", "bg-[#EDE9F8] text-ai"];
const JENIS: Record<string, string> = { leave: tr("Cuti"), claim: tr("Tuntutan"), attendance_correction: tr("Pembetulan"), payroll_run: tr("Gaji"), overtime: tr("Lebih masa"), salary_advance: tr("Pendahuluan"), profile_change: tr("Profil") };
const PERHATIAN: Record<Dashboard["attention"][number]["kind"], { tag: string; tone: "danger" | "warning" | "ai" | "primary"; aksi: string }> = {
  sla: { tag: tr("Tertangguh"), tone: "danger", aksi: tr("Lihat") },
  probation: { tag: tr("Percubaan"), tone: "warning", aksi: tr("Sahkan") },
  bank: { tag: tr("Bank"), tone: "primary", aksi: tr("Semak") },
  late: { tag: tr("Kehadiran"), tone: "ai", aksi: tr("Profil") },
};

// Rujukan reka bentuk: design/DashboardHR.dc.html (disusun semula sebagai "Pusat Tindakan")
export default function DashboardHRPage() {
  return (
    <HadPeranan roles={["hr", "finance", "ceo", "admin"]}>
      <Kandungan />
    </HadPeranan>
  );
}

function Kandungan() {
  const me = useMe();
  const emp = me.active!;
  const hariIni = todayISO();
  const d = useData(async () => {
    const sb = getSupabase();
    const [asas, tambahan, tugas, jadi, berkanun, tamat, semak, surat, soalan, fleksibel, todo] = await Promise.all([
      getDashboard(emp.companyId),
      getDashboardTambahan(emp.companyId),
      getTugasSaya(emp.companyId),
      sb.rpc("team_birthdays", { p_company: emp.companyId, p_from: hariIni, p_to: addDays(hariIni, 6) }),
      getKalendarBerkanun(emp.companyId).catch(() => [] as KewajipanBerkanun[]),
      getTarikhTamat(emp.companyId).catch(() => []),
      getTugasSemakSaya(emp.companyId).catch(() => []),
      hasRole(me, ["hr", "admin"]) ? getSurat(emp.companyId).catch(() => []) : Promise.resolve([]),
      hasRole(me, ["hr", "admin"]) ? getSoalan(emp.companyId).catch(() => []) : Promise.resolve([]),
      hasRole(me, ["hr", "admin"]) ? getFleksibel(emp.companyId).catch(() => []) : Promise.resolve([]),
      getTugasanHr(emp.companyId).catch(() => null),
    ]);
    return { asas, tambahan, tugas, jadi: must(jadi) ?? [], berkanun, tamat, semak: ringkasSemakHr(semak), surat: surat.filter((s) => s.status === "pending").length,
      soalan: soalan.filter((q) => q.status === "open").length,
      fleksibel: fleksibel.filter((f) => f.status === "pending"),
      todo,
    };
  }, [emp.companyId]);
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [ralat, setRalat] = useState<string | null>(null);
  const x = d.data;

  async function lulus(taskId: string) {
    setSibuk(taskId);
    setRalat(null);
    const { error } = await getSupabase().rpc("approval_act", { p_task: taskId, p_action: "approve", p_via: "web" });
    setSibuk(null);
    if (error) setRalat(mesejRalat(error.message, error.code));
    d.reload();
    if (!error && (await tawarLulusBerturut(taskId, me.personId)) > 0) d.reload();
  }

  const lebar = useSkrinLebar();
  const urusGaji = hasRole(me, ["hr", "finance", "admin"]);
  const a = x?.asas;
  const t = x?.tambahan;
  const dijangka = a ? Math.max(a.headcount - a.on_leave.length, 0) : 0;
  const td = x?.todo;
  // Semua perkara "Perlu tindakan" sebagai satu senarai seragam, disusun ikut kesegeraan (Lewat → Minggu ini → Akan datang)
  const item: ItemTindakan[] = [];
  if (x && a && t) {
    const tambah = (i: ItemTindakan) => item.push(i);
    if ((td?.stuck ?? 0) > 0) tambah({ key: "stuck", jenis: tr("Kelulusan"), segera: 0, teks: tr("{0} permohonan melepasi tempoh kelulusan (SLA)", td!.stuck), href: "/kelulusan?tab=syarikat", aksi: tr("Ingatkan") });
    for (const p of a.attention) {
      const k = PERHATIAN[p.kind];
      tambah({
        key: "att" + p.kind + (p.request_id ?? p.employment_id ?? p.text),
        jenis: k.tag,
        segera: p.kind === "sla" ? 0 : p.kind === "probation" ? 1 : 2,
        teks: trRalat(p.text),
        href: p.request_id ? `/permohonan/${p.request_id}` : `/pengurusan/pekerja/${p.employment_id}`,
        aksi: k.aksi,
        kumpulan: p.kind,
      });
    }
    for (const m of x.tamat)
      tambah({
        key: "tamat" + m.kind + m.employment_id + m.expiry,
        jenis: TAMAT[m.kind],
        segera: m.days_left < 0 ? 0 : m.days_left <= 7 ? 1 : 2,
        teks: trRalat(m.text).replace(/\d{2}\/\d{2}\/\d{4}/, tarikh(m.expiry)),
        kecil: m.days_left < 0 ? tr("Lewat {0} hari", -m.days_left) : m.days_left === 0 ? tr("Hari ini") : tr("{0} hari lagi", m.days_left),
        href: `/pengurusan/pekerja/${m.employment_id}`,
        aksi: tr("Profil"),
        kumpulan: "tamat-" + m.kind,
        nama: m.name,
      });
    for (const f of x.fleksibel)
      tambah({
        key: "fwa" + f.id,
        jenis: tr("Fleksibel"),
        segera: f.days_left < 0 ? 0 : f.days_left <= 14 ? 1 : 2,
        teks: tr("{0} memohon kerja fleksibel", f.name),
        kecil: tr("Jawapan bertulis sebelum {0} · {1} hari lagi", tarikh(f.due_date), f.days_left),
        href: "/pengurusan/kerja-fleksibel",
        aksi: tr("Putuskan"),
        kumpulan: "fwa",
        nama: f.name,
      });
    for (const sm of x.semak)
      tambah({
        key: "semak" + sm.employment_id,
        jenis: tr("Orientasi"),
        segera: sm.lewat ? 0 : 2,
        teks: tr("{0}: {1} perkara senarai semak pekerja baharu", sm.name, sm.n),
        kecil: sm.lewat ? tr("{0} sudah lewat", sm.lewat) : undefined,
        href: `/pengurusan/pekerja/${sm.employment_id}`,
        aksi: tr("Semak"),
        kumpulan: "semak",
        nama: sm.name,
      });
    if (t.no_salary) tambah({ key: "gaji", jenis: tr("Gaji"), segera: 1, teks: tr("{0} pekerja belum mempunyai gaji pokok", t.no_salary), href: "/pengurusan/gaji/pekerja", aksi: tr("Tetapkan") });
    if (x.surat > 0) tambah({ key: "surat", jenis: tr("Surat"), segera: 1, teks: tr("{0} permohonan surat pengesahan menunggu dikeluarkan", x.surat), href: "/pengurusan/surat", aksi: tr("Keluarkan") });
    if (x.soalan > 0) tambah({ key: "soalan", jenis: tr("Peti HR"), segera: 1, teks: tr("{0} soalan pekerja belum dijawab", x.soalan), href: "/pengurusan/soalan", aksi: tr("Jawab") });
    if ((td?.probation_ending ?? 0) > 0 && !a.attention.some((p) => p.kind === "probation"))
      tambah({ key: "percubaan", jenis: tr("Percubaan"), segera: 2, teks: tr("{0} tempoh percubaan tamat dalam 30 hari", td!.probation_ending), href: "/pengurusan/orientasi", aksi: tr("Semak") });
    if (urusGaji && (td?.claims_unpaid.n ?? 0) > 0)
      tambah({ key: "tuntutan", jenis: tr("Tuntutan"), segera: 2, teks: tr("{0} tuntutan diluluskan belum dibayar ({1})", td!.claims_unpaid.n, ringgit(td!.claims_unpaid.amount)), href: "/pengurusan/tuntutan", aksi: tr("Lihat") });
    if ((td?.not_activated ?? 0) > 0) tambah({ key: "aktif", jenis: tr("Orientasi"), segera: 2, teks: tr("{0} pekerja belum mengaktifkan akaun", td!.not_activated), href: "/pengurusan/orientasi", aksi: tr("Jemput") });
    if ((td?.no_nickname ?? 0) > 0) tambah({ key: "nama", jenis: tr("Pekerja"), segera: 2, teks: tr("{0} pekerja belum mempunyai nama panggilan", td!.no_nickname), href: "/pengurusan/pekerja/nama", aksi: tr("Isi") });
  }
  const tindakan = (x?.tugas.length ?? 0) + item.length;

  async function tanda(k: KewajipanBerkanun) {
    const ruj = await mintaTeks({
      tajuk: tr("Tanda {0} telah dihantar", k.label),
      label: tr("No. rujukan / resit (pilihan)"),
      ok: tr("Tanda dihantar"),
      wajib: false,
    });
    if (ruj === null) return;
    try {
      await tandaDihantar(emp.companyId, k, ruj);
      beritahu(tr("{0} ditanda telah dihantar.", k.label));
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Screen lebar="lebar">
      <header className="flex items-start justify-between gap-3 px-4 pt-5 pb-1 lg:px-0 lg:pt-7">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] text-muted">{hariTarikh(hariIni)}</span>
          <h1 className="m-0 text-lg leading-tight font-extrabold lg:text-2xl">
            {ucapan()} {me.name}
          </h1>
        </div>
        <span className="flex items-center gap-2">
          {!lebar && (
            <button type="button" onClick={bukaCari} aria-label={tr("Cari pekerja")} className="flex size-10 items-center justify-center rounded-full bg-surface">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </button>
          )}
          <ButangBantuan id="papan" />
          <Loceng />
          {!lebar && hasRole(me, ["hr", "admin"]) && (
            <Link href="/pengurusan/pekerja/baru" aria-label={tr("Tambah pekerja")} className="flex size-10 items-center justify-center rounded-full bg-primary text-white!">
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </Link>
          )}
        </span>
      </header>
      <main className="flex grow flex-col gap-4 px-4 pt-2 pb-5 lg:px-0">
        <KadPanduan id="papan" />
        {d.error && <ErrorBox message={d.error} />}
        {ralat && <ErrorBox message={ralat} />}
        {d.loading && !x && <Loading />}
        {x && a && t && (
          <>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
              <Kad label={tr("Pekerja aktif")} nilai={String(a.headcount)} href="/pengurusan/pekerja" />
              {t.attendance_connected ? (
                <Kad
                  label={tr("Hadir hari ini")}
                  nilai={`${t.present_today}/${dijangka}`}
                  kecil={a.late_today ? tr("{0} lewat masuk", a.late_today) : dijangka ? `${Math.round((t.present_today / dijangka) * 100)}%` : undefined}
                  tone={a.late_today ? "warning" : undefined}
                />
              ) : (
                <Kad label={tr("Kehadiran hari ini")} nilai={tr("Belum disambung")} teks kecil={tr("Sambung mesin kehadiran ›")} tone="primary" href="/pengurusan/tetapan/kehadiran" />
              )}
              <Kad
                label={tr("Cuti / MC hari ini")}
                nilai={String(a.on_leave.length)}
                kecil={a.on_leave.length ? a.on_leave.slice(0, 2).map((c) => c.name).join(", ") + (a.on_leave.length > 2 ? tr(" +{0}", a.on_leave.length - 2) : "") : tr("Semua bertugas")}
              />
              <Kad
                label={tr("Menunggu kelulusan anda")}
                nilai={String(x.tugas.length)}
                kecil={a.sla_breached ? tr("{0} melepasi tempoh", a.sla_breached) : undefined}
                tone={a.sla_breached ? "danger" : x.tugas.length ? "primary" : undefined}
                href="/kelulusan"
              />
            </div>

            <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start lg:gap-5">
              <div className="flex flex-col gap-4">
                <PusatTindakan jumlah={tindakan} tugas={x.tugas} item={item} sibuk={sibuk} onLulus={lulus} />

                <KadGaji p={t.payroll} boleh={urusGaji} />
              </div>

              <div className="flex flex-col gap-4">
                <KadPengumuman companyId={emp.companyId} />
                {x.berkanun.length > 0 && <PanelBerkanun senarai={x.berkanun} boleh={urusGaji} onTanda={tanda} />}
                {(a.on_leave.length > 0 || t.late_names.length > 0) && (
                  <Panel tajuk={tr("SIAPA TIADA HARI INI")}>
                    {a.on_leave.map((c, i) => (
                      <Orang
                        key={c.employment_id + i}
                        i={i}
                        nama={c.name}
                        href={`/pengurusan/pekerja/${c.employment_id}`}
                        kanan={c.half_day !== "full" ? tr("Separuh hari") : c.leave === "MC" ? "MC" : c.leave === "AL" ? tr("Cuti tahunan") : trRalat(c.leave_name)}
                        kecil={c.department}
                      />
                    ))}
                    {t.late_names.map((l, i) => (
                      <Orang key={l.employment_id} i={i + 1} nama={l.name} href={`/pengurusan/pekerja/${l.employment_id}`} kanan={tr("Lewat · {0}", masa(l.clock_in))} kananTone="text-warning" />
                    ))}
                  </Panel>
                )}

                {(a.claims_approved_month > 0 || (urusGaji && (td?.claims_unpaid.amount ?? 0) > 0)) && (
                  <Panel tajuk={tr("TUNTUTAN BULAN INI")}>
                    <div className="flex min-h-12 items-center justify-between text-sm">
                      <span className="text-subtle">{tr("Diluluskan")}</span>
                      <b>{ringgit(a.claims_approved_month)}</b>
                    </div>
                    {urusGaji && td && (
                      <Link href="/pengurusan/tuntutan" className="flex min-h-12 items-center justify-between text-sm text-ink!">
                        <span className="text-subtle">{tr("Diluluskan, belum dibayar")}</span>
                        <b>{ringgit(td.claims_unpaid.amount)}</b>
                      </Link>
                    )}
                  </Panel>
                )}

                {(x.jadi.length > 0 || t.joiners.length > 0) && (
                  <Panel tajuk={tr("MINGGU INI")}>
                    {x.jadi.map((b, i) => (
                      <Orang key={b.person_id} i={i} nama={b.name} kecil={b.department} kanan={tr("Hari jadi · {0} {1}", b.day, BULAN_PENUH[b.month - 1].slice(0, 3))} />
                    ))}
                    {t.joiners.map((j, i) => (
                      <Orang
                        key={j.employment_id}
                        i={i + 2}
                        nama={j.name}
                        kecil={j.department}
                        href={`/pengurusan/pekerja/${j.employment_id}`}
                        kanan={`${j.join_date <= hariIni ? tr("Mula bekerja") : tr("Akan mula")} · ${tarikh(j.join_date)}`}
                      />
                    ))}
                  </Panel>
                )}
              </div>
            </div>
          </>
        )}
      </main>
      <TabNav />
    </Screen>
  );
}

function Kad({ label, nilai, kecil, tone, href, teks }: { label: string; nilai: string; kecil?: string; tone?: "warning" | "danger" | "primary"; href?: string; /** nilai berupa teks (bukan angka) */ teks?: boolean }) {
  const warna = tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : tone === "primary" ? "text-primary" : "text-muted";
  const isi = (
    <>
      <span className="text-xs font-semibold text-muted">{label}</span>
      <b className={`font-extrabold ${teks ? "text-base text-subtle lg:text-lg" : `text-xl lg:text-[28px] ${nilai === "0" ? "text-[#9AA8A5]" : tone === "primary" ? "text-primary" : ""}`}`}>{nilai}</b>
      {kecil && <span className={`text-xs font-semibold ${warna}`}>{kecil}</span>}
    </>
  );
  const cls = "flex min-h-[76px] min-w-0 flex-col gap-0.5 rounded-card bg-surface px-3.5 py-3 lg:min-h-[92px] lg:gap-1 lg:px-5 lg:py-4";
  return href ? (
    <Link href={href} className={`${cls} text-ink! hover:bg-[#F7F9F8]`}>
      {isi}
    </Link>
  ) : (
    <div className={cls}>{isi}</div>
  );
}

function Panel({ tajuk, children }: { tajuk: string; children: ReactNode }) {
  return (
    <section className="flex flex-col rounded-card bg-surface px-4 pt-3 pb-1 lg:px-5">
      <h2 className="m-0 pb-1 text-xs font-bold tracking-[0.04em] text-[#4A5A57]">{tajuk}</h2>
      <div className="flex flex-col [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">{children}</div>
    </section>
  );
}

function Orang({ i, nama, kecil, kanan, kananTone, href }: { i: number; nama: string; kecil?: string | null; kanan: string; kananTone?: string; href?: string }) {
  const isi = (
    <>
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${AV[i % 3]}`}>{inisial(nama)}</span>
      <span className="flex min-w-0 grow flex-col">
        <b className="truncate text-sm font-bold">{nama}</b>
        {kecil && <span className="truncate text-xs text-muted">{kecil}</span>}
      </span>
      <span className={`text-right text-xs font-semibold ${kananTone ?? "text-subtle"}`}>{kanan}</span>
    </>
  );
  const cls = "flex min-h-12 items-center gap-3 py-2 text-ink!";
  return href ? (
    <Link href={href} className={cls}>
      {isi}
    </Link>
  ) : (
    <div className={cls}>{isi}</div>
  );
}

type ItemTindakan = {
  key: string;
  /** Jenis (Kontrak, Percubaan, Orientasi…) — dipaparkan sebagai teks kecil, bukan label berwarna */
  jenis: string;
  /** 0 = lewat, 1 = minggu ini, 2 = akan datang */
  segera: 0 | 1 | 2;
  teks: string;
  kecil?: string;
  href: string;
  aksi: string;
  /** Item dengan kumpulan & kesegeraan yang sama digabung menjadi satu baris yang boleh dikembangkan */
  kumpulan?: string;
  nama?: string;
};

const KUMPULAN_TEKS: Record<string, (n: number) => string> = {
  "tamat-contract": (n) => tr("{0} kontrak tamat", n),
  "tamat-permit": (n) => tr("{0} permit kerja tamat", n),
  "tamat-passport": (n) => tr("{0} pasport tamat", n),
  "tamat-document": (n) => tr("{0} dokumen tamat", n),
  probation: (n) => tr("{0} tempoh percubaan tamat", n),
  sla: (n) => tr("{0} permohonan tertangguh", n),
  bank: (n) => tr("{0} akaun bank perlu disemak", n),
  late: (n) => tr("{0} pekerja kerap lewat", n),
  fwa: (n) => tr("{0} permohonan kerja fleksibel", n),
  semak: (n) => tr("{0} pekerja baharu: senarai semak belum selesai", n),
};
const SEGERA = [
  { tajuk: tr("LEWAT"), titik: "bg-danger" },
  { tajuk: tr("MINGGU INI"), titik: "bg-warning" },
  { tajuk: tr("AKAN DATANG"), titik: "bg-[#B9C6C3]" },
];

/** "Perlu tindakan anda": kelulusan dahulu, kemudian perkara lain ikut kesegeraan. Baris seragam & sebaris. */
function PusatTindakan({
  jumlah,
  tugas,
  item,
  sibuk,
  onLulus,
}: {
  jumlah: number;
  tugas: Awaited<ReturnType<typeof getTugasSaya>>;
  item: ItemTindakan[];
  sibuk: string | null;
  onLulus: (id: string) => void;
}) {
  const [buka, setBuka] = useState<string | null>(null);
  const kumpul = (xs: ItemTindakan[]) => {
    const out: (ItemTindakan | { gabung: ItemTindakan[] })[] = [];
    for (const i of xs) {
      const sama = i.kumpulan ? xs.filter((y) => y.kumpulan === i.kumpulan) : [i];
      if (sama.length < 2) out.push(i);
      else if (sama[0] === i) out.push({ gabung: sama });
    }
    return out;
  };
  return (
    <section className="flex flex-col rounded-card bg-surface px-4 pt-3 pb-1 lg:px-5">
      <h2 className="m-0 pb-1 text-xs font-bold tracking-[0.04em] text-[#4A5A57]">{tr("PERLU TINDAKAN ANDA{0}", jumlah ? ` (${jumlah})` : "")}</h2>
      {jumlah === 0 && <span className="py-4 text-sm text-muted">{tr("Tiada tindakan diperlukan. Semua urusan terkini.")}</span>}
      {tugas.length > 0 && (
        <div className="flex flex-col">
          <SubTajuk>{tr("MENUNGGU KELULUSAN ANDA ({0})", tugas.length)}</SubTajuk>
          <div className="flex flex-col [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
            {tugas.slice(0, 5).map((k) => (
              <div key={k.task_id} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 py-2.5 text-sm">
                <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${k.sla_breached ? "bg-danger" : "bg-primary"}`} />
                <span className="flex min-w-0 grow basis-40 flex-col">
                  <span className="truncate font-semibold">{trTajuk(k.title)}</span>
                  <span className="truncate text-xs text-muted">
                    {[JENIS[k.request_type] ?? tr("Permohonan"), k.requester_nickname, tr("peringkat {0}", k.step_name), tarikh(k.submitted_at)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="ml-auto flex gap-2">
                  {k.request_type !== "payroll_run" && (
                    <button type="button" onClick={() => onLulus(k.task_id)} disabled={sibuk === k.task_id} className="flex h-10 items-center rounded-full bg-primary px-4 text-[13px] font-bold text-white disabled:opacity-60">
                      {sibuk === k.task_id ? "…" : tr("Lulus")}
                    </button>
                  )}
                  <Link href={`/kelulusan/${k.task_id}`} className="flex h-10 items-center rounded-full border border-line px-4 text-[13px] font-bold">
                    {tr("Butiran")}
                  </Link>
                </span>
              </div>
            ))}
            {tugas.length > 5 && (
              <Link href="/kelulusan" className="flex min-h-11 items-center text-[13px] font-bold">
                {tr("Lihat semua {0} permohonan", tugas.length)}
              </Link>
            )}
          </div>
        </div>
      )}
      {([0, 1, 2] as const).map((sg) => {
        const xs = item.filter((i) => i.segera === sg);
        if (!xs.length) return null;
        return (
          <div key={sg} className="flex flex-col">
            <SubTajuk>{SEGERA[sg].tajuk}</SubTajuk>
            <div className="flex flex-col [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              {kumpul(xs).map((r) =>
                "gabung" in r ? (
                  <div key={"g" + r.gabung[0].key} className="flex flex-col">
                    <button
                      type="button"
                      aria-expanded={buka === r.gabung[0].key}
                      onClick={() => setBuka(buka === r.gabung[0].key ? null : r.gabung[0].key)}
                      className="flex min-h-14 items-center gap-3 py-2.5 text-left text-sm"
                    >
                      <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${SEGERA[sg].titik}`} />
                      <span className="flex min-w-0 grow flex-col gap-0.5">
                        <span className="font-semibold">{(KUMPULAN_TEKS[r.gabung[0].kumpulan!] ?? ((n: number) => `${n} × ${r.gabung[0].jenis}`))(r.gabung.length)}</span>
                        <span className={`truncate text-xs ${sg === 0 ? "font-semibold text-danger" : "text-muted"}`}>
                          {[r.gabung[0].jenis, r.gabung.map((g) => g.nama).filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-0.5 text-[13px] font-bold text-primary">
                        {buka === r.gabung[0].key ? tr("Tutup") : tr("Lihat")}
                      </span>
                    </button>
                    {buka === r.gabung[0].key && (
                      <div className="mb-2 ml-5.5 flex flex-col rounded-[12px] bg-page px-3 [&>*+*]:border-t [&>*+*]:border-[#E4EAE8]">
                        {r.gabung.map((g) => (
                          <BarisTindakan key={g.key} i={g} titik={null} />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <BarisTindakan key={r.key} i={r} titik={SEGERA[sg].titik} />
                ),
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function SubTajuk({ children }: { children: ReactNode }) {
  return <span className="pt-2.5 pb-0.5 text-[11px] font-bold tracking-[0.05em] text-muted">{children}</span>;
}

function BarisTindakan({ i, titik }: { i: ItemTindakan; titik: string | null }) {
  return (
    <Link href={i.href} className="flex min-h-14 items-center gap-3 py-2.5 text-sm text-ink! hover:bg-[#F7F9F8]">
      {titik && <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${titik}`} />}
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span className="leading-snug font-semibold">{i.teks}</span>
        <span className={`text-xs ${i.segera === 0 ? "font-semibold text-danger" : "text-muted"}`}>{[i.jenis, i.kecil].filter(Boolean).join(" · ")}</span>
      </span>
      <span className="flex shrink-0 items-center gap-0.5 text-[13px] font-bold text-primary">
        {i.aksi}
        <span aria-hidden="true" className="text-lg leading-none">
          ›
        </span>
      </span>
    </Link>
  );
}

const TAMAT: Record<string, string> = { contract: tr("Kontrak"), permit: tr("Permit"), passport: tr("Pasport"), document: tr("Dokumen") };

const NAMA_BERKANUN: Record<KewajipanBerkanun["kind"], string> = { epf: "KWSP", socso: tr("PERKESO & SIP"), pcb: "PCB", hrdf: "HRDF", ea: tr("Borang EA"), borang_e: tr("Borang E") };

/** Tarikh akhir berkanun dikumpul ikut tarikh: satu blok "Caruman Oktober — hantar sebelum 15 Nov" dengan senarai semak. */
function PanelBerkanun({ senarai, boleh, onTanda }: { senarai: KewajipanBerkanun[]; boleh: boolean; onTanda: (k: KewajipanBerkanun) => void }) {
  const kump = new Map<string, KewajipanBerkanun[]>();
  for (const k of senarai) {
    const kunci = `${k.due_date}|${k.period_year}|${k.period_month}`;
    kump.set(kunci, [...(kump.get(kunci) ?? []), k]);
  }
  return (
    <Panel tajuk={tr("TARIKH AKHIR BERKANUN")}>
      {[...kump.values()].map((xs) => {
        const k = xs[0];
        const lewat = k.days_left < 0;
        const dekat = k.days_left <= 5;
        const bulanan = k.period_month > 0;
        return (
          <div key={`${k.due_date}-${k.period_month}`} className="flex flex-col gap-2 py-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <span className="flex min-w-0 flex-col">
                <b className="font-bold">{bulanan ? tr("Caruman gaji {0} {1}", BULAN_PENUH[k.period_month - 1], k.period_year) : tr("Penyata tahunan {0}", k.period_year)}</b>
                <span className="text-xs text-muted">{tr("Hantar sebelum {0}", tarikh(k.due_date))}</span>
              </span>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${lewat ? "bg-danger-soft text-danger" : dekat ? "bg-warning-soft text-warning" : "bg-[#EEF2F1] text-subtle"}`}>
                {lewat ? tr("Lewat {0} hari", -k.days_left) : k.days_left === 0 ? tr("Hari ini") : tr("{0} hari lagi", k.days_left)}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {xs.map((x) =>
                boleh ? (
                  <button
                    key={x.kind}
                    type="button"
                    onClick={() => onTanda(x)}
                    aria-label={tr("Tanda {0} telah dihantar", tr(x.label))}
                    className="flex h-9 items-center gap-1.5 rounded-full border border-[#D5DEDC] bg-surface px-3 text-[13px] font-bold hover:border-primary"
                  >
                    <span aria-hidden className="flex size-4 items-center justify-center rounded-[5px] border-[1.5px] border-[#B9C6C3]" />
                    {NAMA_BERKANUN[x.kind]}
                  </button>
                ) : (
                  <span key={x.kind} className="flex h-9 items-center rounded-full bg-[#EEF2F1] px-3 text-[13px] font-bold">
                    {NAMA_BERKANUN[x.kind]}
                  </span>
                ),
              )}
            </div>
            {boleh && bulanan && (
              <span className="text-xs text-muted">
                {k.payroll_ready ? (
                  <Link href="/pengurusan/gaji/sejarah" className="font-bold">
                    {tr("Muat turun fail berkanun ›")}
                  </Link>
                ) : (
                  <>
                    {tr("Gaji {0} belum diproses dalam HRBoost. Tandakan selepas anda menghantar melalui sistem lain, atau ", BULAN_PENUH[k.period_month - 1])}
                    <Link href={`/pengurusan/gaji?y=${k.period_year}&m=${k.period_month}`} className="font-bold">
                      {tr("proses gaji ›")}
                    </Link>
                  </>
                )}
              </span>
            )}
          </div>
        );
      })}
      <span className="py-2 text-[11px] leading-snug text-muted">{tr("Tekan setiap item selepas dihantar. Peringatan WhatsApp kepada HR dan Kewangan 5 hari dan 1 hari sebelum tarikh akhir.")}</span>
    </Panel>
  );
}

const SETERUSNYA: Record<string, string> = {
  draft: tr("semak data dan kira gaji"),
  calculated: tr("semak jumlah dan hantar untuk kelulusan"),
  returned: tr("betulkan dan hantar semula untuk kelulusan"),
  rejected: tr("betulkan dan hantar semula untuk kelulusan"),
  pending: tr("menunggu pelulus"),
  approved: tr("bayar melalui bank dan tandakan telah dibayar"),
};
const BUTANG_GAJI: Record<string, string> = {
  draft: tr("Mula proses gaji"),
  calculated: tr("Hantar untuk kelulusan"),
  returned: tr("Betulkan gaji"),
  rejected: tr("Betulkan gaji"),
  pending: tr("Lihat status"),
  approved: tr("Bayar gaji"),
};
const LANGKAH_GAJI = [tr("Semak data"), tr("Kira"), tr("Kelulusan"), tr("Bayar")];

type StatusGaji = { year: number; month: number; status: string | null; gross: number | null; net: number | null; employer: number | null };

function KadGaji({ p, boleh }: { p: StatusGaji; boleh: boolean }) {
  const s = p.status;
  const n = !s || s === "draft" ? 1 : s === "calculated" || s === "returned" ? 2 : s === "pending" ? 3 : s === "approved" ? 4 : 5;
  const label =
    !s || s === "draft"
      ? tr("Belum dikira")
      : s === "calculated"
        ? tr("Dikira — belum dihantar")
        : s === "returned"
          ? tr("Dikembalikan untuk semakan")
          : s === "pending"
            ? tr("Menunggu kelulusan")
            : s === "approved"
              ? tr("Diluluskan — sedia dibayar")
              : s === "rejected"
                ? tr("Ditolak")
                : tr("Telah dibayar");
  return (
    <section className="flex flex-col gap-3 rounded-card bg-surface px-4 py-4 lg:px-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="m-0 text-xs font-bold tracking-[0.04em] text-[#4A5A57]">
          {tr("GAJI {0} {1}", BULAN_PENUH[p.month - 1].toUpperCase(), p.year)}</h2>
        <span className={`text-xs font-bold ${s === "returned" || s === "rejected" ? "text-danger" : n >= 5 ? "text-primary" : "text-warning"}`}>{label}</span>
      </div>
      <ol className="m-0 grid list-none grid-cols-4 gap-1.5 p-0" aria-label={tr("Langkah proses gaji")}>
        {LANGKAH_GAJI.map((l, i) => {
          const siap = n > i + 1;
          const kini = n === i + 1;
          return (
            <li key={l} className="flex flex-col gap-1.5">
              <span className={`h-1.5 rounded-full ${siap ? "bg-primary" : kini ? "bg-[#F2B266]" : "bg-[#E4EAE8]"}`} />
              <span className={`text-[11px] font-bold ${kini ? "text-ink" : "text-muted"}`}>{l}</span>
            </li>
          );
        })}
      </ol>
      {p.gross != null && (
        <div className="grid grid-cols-3 gap-2 text-sm">
          <span className="flex flex-col">
            <span className="text-xs text-muted">{tr("Kasar")}</span>
            <b className="tabular-nums">{ringgit(p.gross)}</b>
          </span>
          <span className="flex flex-col">
            <span className="text-xs text-muted">{tr("Bersih")}</span>
            <b className="tabular-nums">{ringgit(p.net)}</b>
          </span>
          <span className="flex flex-col">
            <span className="text-xs text-muted">{tr("Caruman majikan")}</span>
            <b className="tabular-nums">{ringgit(p.employer)}</b>
          </span>
        </div>
      )}
      {n < 5 && <span className="text-[13px] text-subtle">{tr("Langkah seterusnya: {0}", SETERUSNYA[s ?? "draft"] ?? SETERUSNYA.draft)}</span>}
      {boleh && n < 5 && (
        <div className="flex flex-wrap gap-2">
          <Link href="/pengurusan/gaji" className="flex h-10 items-center rounded-full bg-primary px-4 text-[13px] font-bold text-white!">
            {BUTANG_GAJI[s ?? "draft"] ?? tr("Teruskan")}
          </Link>
          <Link href="/pengurusan/gaji/pekerja" className="flex h-10 items-center rounded-full border border-line px-4 text-[13px] font-bold">
            {tr("Gaji pekerja")}</Link>
        </div>
      )}
    </section>
  );
}
