"use client";

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
import { getKalendarBerkanun, getTarikhTamat, tandaDihantar, type KewajipanBerkanun } from "@/lib/berkanun";
import { beritahu, mintaTeks } from "@/components/Dialog";

const AV = ["bg-[#FDEBD7] text-warning", "bg-[#E3F1EE] text-primary", "bg-[#EDE9F8] text-ai"];
const JENIS: Record<string, string> = { leave: "Cuti", claim: "Tuntutan", attendance_correction: "Pembetulan", payroll_run: "Gaji", overtime: "Lebih masa", salary_advance: "Pendahuluan" };
const PERHATIAN: Record<Dashboard["attention"][number]["kind"], { tag: string; tone: "danger" | "warning" | "ai" | "primary"; aksi: string }> = {
  sla: { tag: "Tertangguh", tone: "danger", aksi: "Lihat" },
  probation: { tag: "Percubaan", tone: "warning", aksi: "Sahkan" },
  bank: { tag: "Bank", tone: "primary", aksi: "Semak" },
  late: { tag: "Kehadiran", tone: "ai", aksi: "Profil" },
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
    const [asas, tambahan, tugas, jadi, berkanun, tamat, semak, surat, soalan, fleksibel] = await Promise.all([
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
    ]);
    return { asas, tambahan, tugas, jadi: must(jadi) ?? [], berkanun, tamat, semak: ringkasSemakHr(semak), surat: surat.filter((s) => s.status === "pending").length,
      soalan: soalan.filter((q) => q.status === "open").length,
      fleksibel: fleksibel.filter((f) => f.status === "pending"),
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
  const tindakan = x && a ? x.tugas.length + a.attention.length + (t?.no_salary ? 1 : 0) + x.tamat.length + x.semak.length + (x.surat ? 1 : 0) + (x.soalan ? 1 : 0) + x.fleksibel.length : 0;

  async function tanda(k: KewajipanBerkanun) {
    const ruj = await mintaTeks({
      tajuk: `Tanda ${k.label} telah dihantar`,
      label: "No. rujukan / resit (pilihan)",
      ok: "Tanda dihantar",
      wajib: false,
    });
    if (ruj === null) return;
    try {
      await tandaDihantar(emp.companyId, k, ruj);
      beritahu(`${k.label} ditanda telah dihantar.`);
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
          <h1 className="m-0 text-xl font-extrabold lg:text-2xl">
            {ucapan()} {me.name}
          </h1>
        </div>
        <span className="flex items-center gap-2">
          {!lebar && (
            <button type="button" onClick={bukaCari} aria-label="Cari pekerja" className="flex size-10 items-center justify-center rounded-full bg-surface">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </button>
          )}
          <ButangBantuan id="papan" />
          <Loceng />
        </span>
      </header>
      <main className="flex grow flex-col gap-4 px-4 pt-2 pb-5 lg:px-0">
        <KadPanduan id="papan" />
        {d.error && <ErrorBox message={d.error} />}
        {ralat && <ErrorBox message={ralat} />}
        {d.loading && !x && <Loading />}
        {x && a && t && (
          <>
            <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-3 lg:overflow-visible lg:px-0 lg:pb-0">
              <Kad label="Pekerja aktif" nilai={String(a.headcount)} href="/pengurusan/pekerja" />
              {t.attendance_connected ? (
                <Kad
                  label="Hadir hari ini"
                  nilai={`${t.present_today}/${dijangka}`}
                  kecil={a.late_today ? `${a.late_today} lewat masuk` : dijangka ? `${Math.round((t.present_today / dijangka) * 100)}%` : undefined}
                  tone={a.late_today ? "warning" : undefined}
                />
              ) : (
                <Kad label="Hadir hari ini" nilai="—" kecil="Sambung mesin kehadiran" href="/pengurusan/tetapan/kehadiran" />
              )}
              <Kad label="Cuti / MC hari ini" nilai={String(a.on_leave.length)} />
              <Kad
                label="Menunggu kelulusan anda"
                nilai={String(x.tugas.length)}
                kecil={a.sla_breached ? `${a.sla_breached} melepasi tempoh` : undefined}
                tone={a.sla_breached ? "danger" : x.tugas.length ? "primary" : undefined}
                href="/kelulusan"
              />
            </div>

            <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start lg:gap-5">
              <div className="flex flex-col gap-4">
                <Panel tajuk={`PERLU TINDAKAN ANDA${tindakan ? ` (${tindakan})` : ""}`}>
                  {tindakan === 0 && <span className="py-4 text-sm text-muted">Tiada tindakan diperlukan. Semua urusan terkini.</span>}
                  {x.tugas.slice(0, 6).map((k) => (
                    <div key={k.task_id} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 py-2.5 text-sm">
                      <Tag tone={k.sla_breached ? "danger" : "primary"}>{JENIS[k.request_type] ?? "Permohonan"}</Tag>
                      <span className="flex min-w-0 grow basis-40 flex-col">
                        <b className="truncate font-bold">{k.title}</b>
                        <span className="truncate text-xs text-muted">
                          {[k.requester_nickname, `peringkat ${k.step_name}`, tarikh(k.submitted_at)].filter(Boolean).join(" · ")}
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
                            {sibuk === k.task_id ? "…" : "Lulus"}
                          </button>
                        )}
                        <Link href={`/kelulusan/${k.task_id}`} className="flex h-10 items-center rounded-full border border-line px-4 text-[13px] font-bold">
                          Butiran
                        </Link>
                      </span>
                    </div>
                  ))}
                  {x.tugas.length > 6 && (
                    <Link href="/kelulusan" className="flex min-h-11 items-center text-[13px] font-bold">
                      Lihat semua {x.tugas.length} permohonan
                    </Link>
                  )}
                  {t.no_salary ? (
                    <Baris tag="Gaji" tone="warning" teks={`${t.no_salary} pekerja belum mempunyai gaji pokok`} href="/pengurusan/gaji/pekerja" aksi="Tetapkan" />
                  ) : null}
                  {x.soalan > 0 && <Baris tag="Soalan" tone="primary" teks={`${x.soalan} soalan pekerja belum dijawab`} href="/pengurusan/soalan" aksi="Jawab" />}
                  {x.fleksibel.map((f) => (
                    <Baris
                      key={"fwa" + f.id}
                      tag="Fleksibel"
                      tone={f.days_left <= 14 ? "danger" : "warning"}
                      teks={`${f.name} memohon kerja fleksibel · jawapan bertulis sebelum ${tarikh(f.due_date)} (${f.days_left} hari)`}
                      href="/pengurusan/kerja-fleksibel"
                      aksi="Putuskan"
                    />
                  ))}
                  {x.surat > 0 && <Baris tag="Surat" tone="primary" teks={`${x.surat} permohonan surat pengesahan menunggu dikeluarkan`} href="/pengurusan/surat" aksi="Keluarkan" />}
                  {x.semak.map((s) => (
                    <Baris
                      key={"semak" + s.employment_id}
                      tag="Orientasi"
                      tone={s.lewat ? "danger" : "primary"}
                      teks={`${s.name}: ${s.n} perkara senarai semak pekerja baharu${s.lewat ? ` (${s.lewat} lewat)` : ""}`}
                      href={`/pengurusan/pekerja/${s.employment_id}`}
                      aksi="Semak"
                    />
                  ))}
                  {x.tamat.map((m) => (
                    <Baris
                      key={m.kind + m.employment_id + m.expiry}
                      tag={TAMAT[m.kind]}
                      tone={m.days_left <= 7 ? "danger" : "warning"}
                      teks={`${m.text} (${m.days_left < 0 ? `lewat ${-m.days_left} hari` : m.days_left === 0 ? "hari ini" : `${m.days_left} hari lagi`})`}
                      href={`/pengurusan/pekerja/${m.employment_id}`}
                      aksi="Profil"
                    />
                  ))}
                  {a.attention.map((p, i) => (
                    <Baris
                      key={i}
                      tag={PERHATIAN[p.kind].tag}
                      tone={PERHATIAN[p.kind].tone}
                      teks={p.text}
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
                <Panel tajuk="SIAPA TIADA HARI INI">
                  {a.on_leave.length === 0 && t.late_names.length === 0 && <span className="py-4 text-sm text-muted">Semua pekerja bertugas hari ini.</span>}
                  {a.on_leave.map((c, i) => (
                    <Orang
                      key={c.employment_id + i}
                      i={i}
                      nama={c.name}
                      href={`/pengurusan/pekerja/${c.employment_id}`}
                      kanan={c.half_day !== "full" ? "Separuh hari" : c.leave === "MC" ? "MC" : c.leave === "AL" ? "Cuti tahunan" : c.leave_name}
                      kecil={c.department}
                    />
                  ))}
                  {t.late_names.map((l, i) => (
                    <Orang key={l.employment_id} i={i + 1} nama={l.name} href={`/pengurusan/pekerja/${l.employment_id}`} kanan={`Lewat · ${masa(l.clock_in)}`} kananTone="text-warning" />
                  ))}
                </Panel>

                <Panel tajuk="MINGGU INI">
                  {x.jadi.length === 0 && t.joiners.length === 0 && <span className="py-4 text-sm text-muted">Tiada hari jadi atau pekerja baharu minggu ini.</span>}
                  {x.jadi.map((b, i) => (
                    <Orang key={b.person_id} i={i} nama={b.name} kecil={b.department} kanan={`Hari jadi · ${b.day} ${BULAN_PENUH[b.month - 1].slice(0, 3)}`} />
                  ))}
                  {t.joiners.map((j, i) => (
                    <Orang
                      key={j.employment_id}
                      i={i + 2}
                      nama={j.name}
                      kecil={j.department}
                      href={`/pengurusan/pekerja/${j.employment_id}`}
                      kanan={`${j.join_date <= hariIni ? "Mula bekerja" : "Akan mula"} · ${tarikh(j.join_date)}`}
                    />
                  ))}
                </Panel>

                <Panel tajuk="BULAN INI">
                  <div className="flex min-h-12 items-center justify-between text-sm">
                    <span className="text-subtle">Tuntutan diluluskan</span>
                    <b>{ringgit(a.claims_approved_month)}</b>
                  </div>
                  <Link href="/pengurusan/akses" className="flex min-h-11 items-center text-[13px] font-bold">
                    Anda hanya boleh melihat {a.company_code}. Mohon akses syarikat lain
                  </Link>
                </Panel>
              </div>
            </div>
          </>
        )}
      </main>
      {!lebar && hasRole(me, ["hr", "admin"]) && (
        <Link
          href="/pengurusan/pekerja/baru"
          aria-label="Tambah pekerja"
          className="fixed right-4 bottom-[92px] z-20 flex size-14 items-center justify-center rounded-full bg-primary text-white! shadow-lg"
        >
          <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </Link>
      )}
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
  const cls = "flex min-h-[76px] min-w-[148px] shrink-0 snap-start flex-col gap-0.5 rounded-card bg-surface px-4 py-3 lg:min-h-[92px] lg:min-w-0 lg:gap-1 lg:px-5 lg:py-4";
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

function Baris({ tag, tone, teks, href, aksi }: { tag: string; tone: "danger" | "warning" | "ai" | "primary"; teks: string; href: string; aksi: string }) {
  return (
    <div className="flex min-h-14 items-center gap-3 py-2.5 text-sm">
      <Tag tone={tone}>{tag}</Tag>
      <span className="min-w-0 grow">{teks}</span>
      <Link href={href} className="flex h-10 items-center rounded-full border border-line px-4 text-[13px] font-bold">
        {aksi}
      </Link>
    </div>
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

const TAMAT: Record<string, string> = { contract: "Kontrak", permit: "Permit", passport: "Pasport", document: "Dokumen" };

function PanelBerkanun({ senarai, boleh, onTanda }: { senarai: KewajipanBerkanun[]; boleh: boolean; onTanda: (k: KewajipanBerkanun) => void }) {
  return (
    <Panel tajuk="TARIKH AKHIR BERKANUN">
      {senarai.map((k) => {
        const lewat = k.days_left < 0;
        const dekat = k.days_left <= 5;
        return (
          <div key={`${k.kind}-${k.period_year}-${k.period_month}`} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 text-sm">
            <span className="flex min-w-0 grow basis-40 flex-col">
              <b className="font-bold">{k.label}</b>
              <span className="text-xs text-muted">
                {k.period_month ? `Gaji ${BULAN_PENUH[k.period_month - 1]} ${k.period_year}` : `Tahun ${k.period_year}`} · akhir {tarikh(k.due_date)}
                {!k.payroll_ready && k.period_month ? " · gaji belum diluluskan" : ""}
              </span>
            </span>
            <span className={`text-xs font-bold ${lewat ? "text-danger" : dekat ? "text-warning" : "text-subtle"}`}>
              {lewat ? `Lewat ${-k.days_left} hari` : k.days_left === 0 ? "Hari ini" : `${k.days_left} hari lagi`}
            </span>
            {boleh && (
              <span className="flex gap-2">
                {k.payroll_ready && (
                  <Link href="/pengurusan/gaji/sejarah" className="flex h-9 items-center rounded-full border border-line px-3 text-xs font-bold">
                    Fail
                  </Link>
                )}
                <button type="button" onClick={() => onTanda(k)} className="flex h-9 items-center rounded-full border border-line px-3 text-xs font-bold text-primary">
                  Tanda dihantar
                </button>
              </span>
            )}
          </div>
        );
      })}
      <span className="py-2 text-[11px] leading-snug text-muted">Peringatan WhatsApp dihantar kepada HR dan Kewangan 5 hari dan 1 hari sebelum tarikh akhir.</span>
    </Panel>
  );
}

const LANGKAH_GAJI = ["Semak data", "Kira", "Kelulusan", "Bayar"];

type StatusGaji = { year: number; month: number; status: string | null; gross: number | null; net: number | null; employer: number | null };

function KadGaji({ p, boleh }: { p: StatusGaji; boleh: boolean }) {
  const s = p.status;
  const n = !s || s === "draft" ? 1 : s === "calculated" || s === "returned" ? 2 : s === "pending" ? 3 : s === "approved" ? 4 : 5;
  const label =
    !s || s === "draft"
      ? "Belum dikira"
      : s === "calculated"
        ? "Dikira — belum dihantar"
        : s === "returned"
          ? "Dikembalikan untuk semakan"
          : s === "pending"
            ? "Menunggu kelulusan"
            : s === "approved"
              ? "Diluluskan — sedia dibayar"
              : s === "rejected"
                ? "Ditolak"
                : "Telah dibayar";
  return (
    <section className="flex flex-col gap-3 rounded-card bg-surface px-4 py-4 lg:px-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="m-0 text-xs font-bold tracking-[0.04em] text-[#4A5A57]">
          GAJI {BULAN_PENUH[p.month - 1].toUpperCase()} {p.year}
        </h2>
        <span className={`text-xs font-bold ${s === "returned" || s === "rejected" ? "text-danger" : n >= 5 ? "text-primary" : "text-warning"}`}>{label}</span>
      </div>
      <ol className="m-0 grid list-none grid-cols-4 gap-1.5 p-0" aria-label="Langkah proses gaji">
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
            <span className="text-xs text-muted">Kasar</span>
            <b className="tabular-nums">{ringgit(p.gross)}</b>
          </span>
          <span className="flex flex-col">
            <span className="text-xs text-muted">Bersih</span>
            <b className="tabular-nums">{ringgit(p.net)}</b>
          </span>
          <span className="flex flex-col">
            <span className="text-xs text-muted">Caruman majikan</span>
            <b className="tabular-nums">{ringgit(p.employer)}</b>
          </span>
        </div>
      )}
      {boleh && n < 5 && (
        <div className="flex flex-wrap gap-2">
          <Link href="/pengurusan/gaji" className="flex h-10 items-center rounded-full bg-primary px-4 text-[13px] font-bold text-white!">
            {n === 1 ? "Mula proses gaji" : "Teruskan"}
          </Link>
          <Link href="/pengurusan/gaji/pekerja" className="flex h-10 items-center rounded-full border border-line px-4 text-[13px] font-bold">
            Gaji pekerja
          </Link>
        </div>
      )}
    </section>
  );
}
