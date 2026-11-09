"use client";

import Link from "next/link";
import { useMe, type Me } from "@/lib/me";
import { useData } from "@/lib/useData";
import { kehadiranDisambung } from "@/lib/kehadiran";
import { getBaki, getKehadiranMinggu, type Baki, getPermohonanSaya, kiniDi, paparPermohonan } from "@/lib/data";
import { hari, hariPendek, masaRingkas, todayISO } from "@/lib/format";
import { IconCalendar, IconClock, IconReceipt } from "@/components/icons";
import { Greeting } from "@/components/Greeting";
import { OrientasiBanner } from "@/components/OrientasiBanner";
import { ErrorBox, Screen, StatusPill, StepBar } from "@/components/ui";
import { TabNav } from "@/components/TabNav";
import { KetuaUtama } from "./KetuaUtama";

// Rujukan reka bentuk: design/Main.dc.html (pekerja) dan design/KetuaUtama.dc.html (ketua jabatan)
export default function UtamaPage() {
  const me = useMe();
  return (
    <Screen>
      {me.isHead ? <KetuaUtama /> : <StaffUtama me={me} />}
      <TabNav />
    </Screen>
  );
}

function StaffUtama({ me }: { me: Me }) {
  const emp = me.active;
  const baki = useData(() => (emp ? getBaki(emp) : Promise.resolve({} as Record<string, Baki>)), [emp?.id]);
  const mohon = useData(() => getPermohonanSaya(2), [emp?.id]);
  const hadir = useData(() => (emp ? getKehadiranMinggu(emp) : Promise.resolve([])), [emp?.id]);
  const sambung = useData(() => (emp ? kehadiranDisambung(emp.companyId) : Promise.resolve(false)), [emp?.companyId]);

  const al = baki.data?.AL;
  const mc = baki.data?.MC;
  const year = todayISO().slice(0, 4);
  const usedPct = al && al.entitled > 0 ? Math.min(100, (al.used / al.entitled) * 100) : 0;
  const pendPct = al && al.entitled > 0 ? Math.min(100 - usedPct, (al.pending / al.entitled) * 100) : 0;

  return (
    <main className="flex grow flex-col gap-5 px-4 pt-4 pb-4">
      <Greeting me={me} />
      {emp && <OrientasiBanner employmentId={emp.id} />}

      {!emp && <ErrorBox message="Tiada pekerjaan aktif ditemui untuk akaun ini. Sila hubungi HR." />}

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-3 rounded-[20px] bg-primary p-5 text-white">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-[13px] opacity-90">Baki cuti tahunan {year}</span>
                <span className="text-[40px] leading-none font-extrabold">
                  {al ? hari(al.available) : "–"} <span className="text-lg font-semibold">hari</span>
                </span>
              </div>
              {al && al.pending > 0 && (
                <span className="rounded-xl bg-white/16 px-2.5 py-1.5 text-xs font-semibold">
                  {hari(al.pending)} hari menunggu
                </span>
              )}
            </div>
            <div className="flex h-2 overflow-hidden rounded bg-white/22" aria-hidden="true">
              <div className="bg-white" style={{ width: `${usedPct}%` }} />
              <div className="bg-[#9ED9CE]" style={{ width: `${pendPct}%` }} />
            </div>
            <span className="text-[13px] opacity-90">
              {al ? `Kelayakan ${hari(al.entitled)} hari` : "Memuatkan baki…"}
              {mc ? ` · baki MC ${hari(mc.available)} hari` : ""}
            </span>
          </section>

          <div className="grid grid-cols-3 gap-2.5">
            <QuickAction href="/mohon/cuti" label="Mohon Cuti" icon={<IconCalendar size={22} />} />
            <QuickAction href="/tuntutan/baru" label="Buat Tuntutan" icon={<IconReceipt size={22} />} />
            <QuickAction href="/kehadiran/betulkan" label="Betulkan Masa" icon={<IconClock size={22} />} />
          </div>
          {emp && sambung.data === true && (
            <section className="flex flex-col gap-3 rounded-card bg-surface px-4 py-3">
              <div className="flex items-center justify-between">
                <h2 className="m-0 text-base font-extrabold">Kehadiran minggu ini</h2>
                <span className="text-xs text-muted">Waktu masuk {emp.workStart.replace(/^0/, "")}</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {(hadir.data ?? []).map((d) => {
                  const future = d.date > todayISO();
                  const none = !d.clockIn;
                  return (
                    <div
                      key={d.date}
                      className={`flex flex-col items-center gap-1 rounded-[10px] py-2 ${
                        d.late ? "bg-warning-soft" : none ? "border-[1.5px] border-dashed border-line-strong" : "bg-page"
                      }`}
                    >
                      <span className={`text-[11px] ${d.late ? "text-warning" : "text-muted"}`}>{hariPendek(d.date)}</span>
                      <span className={`text-[13px] font-bold ${d.late ? "text-warning" : none ? "text-muted" : ""}`}>
                        {d.clockIn ? masaRingkas(d.clockIn) : future ? "—" : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
          <section className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <h2 className="m-0 text-base font-extrabold">Permohonan saya</h2>
              <Link href="/permohonan" className="text-[13px] font-bold">
                Lihat semua
              </Link>
            </div>
            {mohon.error && <ErrorBox message={mohon.error} />}
            {mohon.data?.length === 0 && (
              <div className="rounded-card bg-surface px-4 py-3 text-[13px] text-muted">Tiada permohonan lagi.</div>
            )}
            {mohon.data?.map((p) => {
              const v = paparPermohonan(p);
              const where = p.status === "pending" ? kiniDi(p.waitingFor) : null;
              return (
                <Link
                  key={p.id}
                  href={`/permohonan/${p.id}`}
                  className="flex flex-col gap-2.5 rounded-card bg-surface px-4 py-3 text-ink!"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold">{v.title}</span>
                    <StatusPill status={p.status} />
                  </div>
                  {(p.status === "pending" || p.status === "approved") && p.totalSteps > 0 && (
                    <StepBar total={p.totalSteps} current={p.currentStep} status={p.status} />
                  )}
                  <span className="text-[13px] text-muted">
                    {[where, v.sub].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              );
            })}
          </section>
      </div>
    </main>
  );
}

function QuickAction({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-2 rounded-card bg-surface px-2 py-4 text-ink!">
      <span className="flex size-11 items-center justify-center rounded-[14px] bg-primary-soft text-primary">{icon}</span>
      <span className="text-center text-[13px] font-bold">{label}</span>
    </Link>
  );
}
