"use client";

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
import { HadPeranan, Tag } from "@/components/Senarai";
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
  }

  const lebar = useSkrinLebar();
  const urusGaji = hasRole(me, ["hr", "finance", "admin"]);
  const a = x?.asas;
  const t = x?.tambahan;
  const dijangka = a ? Math.max(a.headcount - a.on_leave.length, 0) : 0;
  const td = x?.todo;
  const tambahHr = td ? [td.stuck, td.not_activated, td.probation_ending, td.no_nickname, urusGaji ? td.claims_unpaid.n : 0].filter((v) => (v ?? 0) > 0).length : 0;
  const tindakan = x && a ? x.tugas.length + a.attention.length + (t?.no_salary ? 1 : 0) + x.tamat.length + x.semak.length + (x.surat ? 1 : 0) + (x.soalan ? 1 : 0) + x.fleksibel.length + tambahHr : 0;

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
                <Kad label={tr("Hadir hari ini")} nilai="—" kecil={tr("Sambung mesin kehadiran")} href="/pengurusan/tetapan/kehadiran" />
              )}
              <Kad label={tr("Cuti / MC hari ini")} nilai={String(a.on_leave.length)} />
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
                <Panel tajuk={tr("PERLU TINDAKAN ANDA{0}", tindakan ? ` (${tindakan})` : "")}>
                  {tindakan === 0 && <span className="py-4 text-sm text-muted">{tr("Tiada tindakan diperlukan. Semua urusan terkini.")}</span>}
                  {x.tugas.slice(0, 6).map((k) => (
                    <div key={k.task_id} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 py-2.5 text-sm">
                      <Tag tone={k.sla_breached ? "danger" : "primary"}>{JENIS[k.request_type] ?? tr("Permohonan")}</Tag>
                      <span className="flex min-w-0 grow basis-40 flex-col">
                        <b className="truncate font-bold">{trTajuk(k.title)}</b>
                        <span className="truncate text-xs text-muted">
                          {[k.requester_nickname, tr("peringkat {0}", k.step_name), tarikh(k.submitted_at)].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="ml-auto flex gap-2">
                        {k.request_type !== "payroll_run" && (
                          <button
                            type="button"
                            onClick={() => lulus(k.task_id)}
                            disabled={sibuk === k.task_id}
                            className="flex h-10 items-center rounded-full bg-primary px-4 text-[13px] font-bold text-white disabled:opacity-60"
                          >
                            {sibuk === k.task_id ? "…" : tr("Lulus")}
                          </button>
                        )}
                        <Link href={`/kelulusan/${k.task_id}`} className="flex h-10 items-center rounded-full border border-line px-4 text-[13px] font-bold">
                          {tr("Butiran")}</Link>
                      </span>
                    </div>
                  ))}
                  {x.tugas.length > 6 && (
                    <Link href="/kelulusan" className="flex min-h-11 items-center text-[13px] font-bold">
                      {tr("Lihat semua {0} permohonan", x.tugas.length)}</Link>
                  )}
                  {(td?.stuck ?? 0) > 0 && (
                    <Baris tag={tr("Tersangkut")} tone="danger" teks={tr("{0} permohonan melepasi tempoh kelulusan (SLA)", td!.stuck)} href="/kelulusan?tab=syarikat" aksi={tr("Ingatkan")} />
                  )}
                  {(td?.not_activated ?? 0) > 0 && (
                    <Baris tag={tr("Orientasi")} tone="warning" teks={tr("{0} pekerja belum mengaktifkan akaun", td!.not_activated)} href="/pengurusan/orientasi" aksi={tr("Jemput")} />
                  )}
                  {(td?.no_nickname ?? 0) > 0 && (
                    <Baris tag={tr("Pekerja")} tone="primary" teks={tr("{0} pekerja belum mempunyai nama panggilan", td!.no_nickname)} href="/pengurusan/pekerja/nama" aksi={tr("Isi")} />
                  )}
                  {(td?.probation_ending ?? 0) > 0 && !a.attention.some((p) => p.kind === "probation") && (
                    <Baris tag={tr("Percubaan")} tone="warning" teks={tr("{0} tempoh percubaan tamat dalam 30 hari", td!.probation_ending)} href="/pengurusan/orientasi" aksi={tr("Semak")} />
                  )}
                  {urusGaji && (td?.claims_unpaid.n ?? 0) > 0 && (
                    <Baris tag={tr("Tuntutan")} tone="primary" teks={tr("{0} tuntutan diluluskan belum dibayar ({1})", td!.claims_unpaid.n, ringgit(td!.claims_unpaid.amount))} href="/pengurusan/tuntutan" aksi={tr("Lihat")} />
                  )}
                  {t.no_salary ? (
                    <Baris tag={tr("Gaji")} tone="warning" teks={tr("{0} pekerja belum mempunyai gaji pokok", t.no_salary)} href="/pengurusan/gaji/pekerja" aksi={tr("Tetapkan")} />
                  ) : null}
                  {x.soalan > 0 && <Baris tag={tr("Soalan")} tone="primary" teks={tr("{0} soalan pekerja belum dijawab", x.soalan)} href="/pengurusan/soalan" aksi={tr("Jawab")} />}
                  {x.fleksibel.map((f) => (
                    <Baris
                      key={"fwa" + f.id}
                      tag={tr("Fleksibel")}
                      tone={f.days_left <= 14 ? "danger" : "warning"}
                      teks={tr("{0} memohon kerja fleksibel", f.name)}
                      kecil={tr("Jawapan bertulis sebelum {0} · {1} hari lagi", tarikh(f.due_date), f.days_left)}
                      href="/pengurusan/kerja-fleksibel"
                      aksi={tr("Putuskan")}
                    />
                  ))}
                  {x.surat > 0 && <Baris tag={tr("Surat")} tone="primary" teks={tr("{0} permohonan surat pengesahan menunggu dikeluarkan", x.surat)} href="/pengurusan/surat" aksi={tr("Keluarkan")} />}
                  {x.semak.map((s) => (
                    <Baris
                      key={"semak" + s.employment_id}
                      tag={tr("Orientasi")}
                      tone={s.lewat ? "danger" : "primary"}
                      teks={tr("{0}: {1} perkara senarai semak pekerja baharu", s.name, s.n)}
                      kecil={s.lewat ? tr("{0} sudah lewat", s.lewat) : undefined}
                      href={`/pengurusan/pekerja/${s.employment_id}`}
                      aksi={tr("Semak")}
                    />
                  ))}
                  {x.tamat.map((m) => (
                    <Baris
                      key={m.kind + m.employment_id + m.expiry}
                      tag={TAMAT[m.kind]}
                      tone={m.days_left <= 7 ? "danger" : "warning"}
                      teks={trRalat(m.text).replace(/\d{2}\/\d{2}\/\d{4}/, tarikh(m.expiry))}
                      kecil={m.days_left < 0 ? tr("Lewat {0} hari", -m.days_left) : m.days_left === 0 ? tr("Hari ini") : tr("{0} hari lagi", m.days_left)}
                      href={`/pengurusan/pekerja/${m.employment_id}`}
                      aksi={tr("Profil")}
                    />
                  ))}
                  {a.attention.map((p, i) => (
                    <Baris
                      key={i}
                      tag={PERHATIAN[p.kind].tag}
                      tone={PERHATIAN[p.kind].tone}
                      teks={trRalat(p.text)}
                      href={p.request_id ? `/permohonan/${p.request_id}` : `/pengurusan/pekerja/${p.employment_id}`}
                      aksi={PERHATIAN[p.kind].aksi}
                    />
                  ))}
                </Panel>

                <KadGaji p={t.payroll} boleh={urusGaji} />
              </div>

              <div className="flex flex-col gap-4">
                <KadPengumuman companyId={emp.companyId} />
                {x.berkanun.length > 0 && <PanelBerkanun senarai={x.berkanun} boleh={urusGaji} onTanda={tanda} />}
                <Panel tajuk={tr("SIAPA TIADA HARI INI")}>
                  {a.on_leave.length === 0 && t.late_names.length === 0 && <span className="py-4 text-sm text-muted">{tr("Semua pekerja bertugas hari ini.")}</span>}
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

                <Panel tajuk={tr("MINGGU INI")}>
                  {x.jadi.length === 0 && t.joiners.length === 0 && <span className="py-4 text-sm text-muted">{tr("Tiada hari jadi atau pekerja baharu minggu ini.")}</span>}
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

                <Panel tajuk={tr("BULAN INI")}>
                  <div className="flex min-h-12 items-center justify-between text-sm">
                    <span className="text-subtle">{tr("Tuntutan diluluskan")}</span>
                    <b>{ringgit(a.claims_approved_month)}</b>
                  </div>
                  {urusGaji && td && (
                    <Link href="/pengurusan/tuntutan" className="flex min-h-12 items-center justify-between text-sm text-ink!">
                      <span className="text-subtle">{tr("Diluluskan, belum dibayar")}</span>
                      <b>{ringgit(td.claims_unpaid.amount)}</b>
                    </Link>
                  )}
                </Panel>
                <Link href="/pengurusan/akses" className="flex min-h-11 items-center px-1 text-xs font-semibold text-muted!">
                  {tr("Anda hanya boleh melihat {0}. Mohon akses syarikat lain ›", a.company_code)}</Link>
              </div>
            </div>
          </>
        )}
      </main>
      <TabNav />
    </Screen>
  );
}

function Kad({ label, nilai, kecil, tone, href }: { label: string; nilai: string; kecil?: string; tone?: "warning" | "danger" | "primary"; href?: string }) {
  const warna = tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : tone === "primary" ? "text-primary" : "text-muted";
  const isi = (
    <>
      <span className="text-xs font-semibold text-muted">{label}</span>
      <b className={`text-xl font-extrabold lg:text-[28px] ${tone === "primary" ? "text-primary" : ""}`}>{nilai}</b>
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

function Baris({ tag, tone, teks, kecil, href, aksi }: { tag: string; tone: "danger" | "warning" | "ai" | "primary"; teks: string; kecil?: string; href: string; aksi: string }) {
  // Seluruh baris boleh ditekan: label & teks disusun menegak supaya teks tidak terhimpit di telefon
  return (
    <Link href={href} className="flex min-h-14 items-center gap-3 py-2.5 text-sm text-ink! hover:bg-[#F7F9F8]">
      <span className="flex min-w-0 grow flex-col items-start gap-1 lg:flex-row lg:items-center lg:gap-3">
        <Tag tone={tone}>{tag}</Tag>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="leading-snug">{teks}</span>
          {kecil && <span className={`text-xs font-semibold ${tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-muted"}`}>{kecil}</span>}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-0.5 text-[13px] font-bold text-primary">
        {aksi}
        <span aria-hidden="true" className="text-lg leading-none">
          ›
        </span>
      </span>
    </Link>
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

const TAMAT: Record<string, string> = { contract: tr("Kontrak"), permit: tr("Permit"), passport: tr("Pasport"), document: tr("Dokumen") };

function PanelBerkanun({ senarai, boleh, onTanda }: { senarai: KewajipanBerkanun[]; boleh: boolean; onTanda: (k: KewajipanBerkanun) => void }) {
  return (
    <Panel tajuk={tr("TARIKH AKHIR BERKANUN")}>
      {senarai.map((k) => {
        const lewat = k.days_left < 0;
        const dekat = k.days_left <= 5;
        return (
          <div key={`${k.kind}-${k.period_year}-${k.period_month}`} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 text-sm">
            <span className="flex min-w-0 grow basis-40 flex-col">
              <b className="font-bold">{tr(k.label)}</b>
              <span className="text-xs text-muted">
                {tr("{0} · akhir {1}{2}", k.period_month ? tr("Gaji {0} {1}", BULAN_PENUH[k.period_month - 1], k.period_year) : tr("Tahun {0}", k.period_year), tarikh(k.due_date), !k.payroll_ready && k.period_month ? tr(" · gaji belum diluluskan") : "")}</span>
            </span>
            <span className={`text-xs font-bold ${lewat ? "text-danger" : dekat ? "text-warning" : "text-subtle"}`}>
              {lewat ? tr("Lewat {0} hari", -k.days_left) : k.days_left === 0 ? tr("Hari ini") : tr("{0} hari lagi", k.days_left)}
            </span>
            {boleh && (
              <span className="flex gap-2">
                {k.payroll_ready && (
                  <Link href="/pengurusan/gaji/sejarah" className="flex h-9 items-center rounded-full border border-line px-3 text-xs font-bold">
                    {tr("Fail")}</Link>
                )}
                <button type="button" onClick={() => onTanda(k)} className="flex h-9 items-center rounded-full border border-line px-3 text-xs font-bold text-primary">
                  {tr("Tanda dihantar")}</button>
              </span>
            )}
          </div>
        );
      })}
      <span className="py-2 text-[11px] leading-snug text-muted">{tr("Peringatan WhatsApp dihantar kepada HR dan Kewangan 5 hari dan 1 hari sebelum tarikh akhir.")}</span>
    </Panel>
  );
}

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
      {boleh && n < 5 && (
        <div className="flex flex-wrap gap-2">
          <Link href="/pengurusan/gaji" className="flex h-10 items-center rounded-full bg-primary px-4 text-[13px] font-bold text-white!">
            {n === 1 ? tr("Mula proses gaji") : tr("Teruskan")}
          </Link>
          <Link href="/pengurusan/gaji/pekerja" className="flex h-10 items-center rounded-full border border-line px-4 text-[13px] font-bold">
            {tr("Gaji pekerja")}</Link>
        </div>
      )}
    </section>
  );
}
