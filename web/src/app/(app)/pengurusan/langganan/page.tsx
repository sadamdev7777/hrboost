"use client";

import { tr, trRalat } from "@/lib/i18n";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { tarikh, tarikhTempatan } from "@/lib/format";
import { getInvois, getLangganan, LABEL_STATUS, mulaBayar, rmSen, sebutHarga, type Invois } from "@/lib/langganan";
import { simpanAtauKongsiBil } from "@/lib/bilPdf";
import { beritahu } from "@/components/Dialog";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { HadPeranan, inputKecil, Seksyen, Tag } from "@/components/Senarai";

/** Tetapan → Langganan: status, harga, kod baucar, bayar dengan CHIP, invois & resit. */
export default function LanggananPage() {
  return (
    <HadPeranan roles={["admin", "hr", "ceo", "finance"]} back="/pengurusan/tetapan">
      <Suspense fallback={<Loading />}>
        <Kandungan />
      </Suspense>
    </HadPeranan>
  );
}

const TERMASUK = () => [
  tr("Semua modul: cuti, tuntutan, kehadiran, gaji, surat, prestasi, inventori"),
  tr("Pekerja tanpa had"),
  tr("Gaji, KWSP, PERKESO, SIP & PCB automatik"),
  tr("Kemas kini kadar berkanun & cuti umum"),
];

function Kandungan() {
  const me = useMe();
  const cid = me.active!.companyId;
  const st = useData(() => getLangganan(cid), [cid]);
  const inv = useData(() => getInvois(cid), [cid]);
  const [kod, setKod] = useState("");
  const [kodDipakai, setKodDipakai] = useState("");
  const q = useData(() => sebutHarga(cid, kodDipakai), [cid, kodDipakai]);
  const [sibuk, setSibuk] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const s = st.data;
  const label = LABEL_STATUS();
  // Pelan "Langgan terus" dari pendaftaran: halaman ini dibuka terus selepas e-mel disahkan
  const baru = useSearchParams().get("bayar") === "1" && s?.status === "trial";

  async function bayar() {
    setSibuk(true);
    setRalat(null);
    try {
      window.location.href = await mulaBayar(cid, kodDipakai);
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
      setSibuk(false);
    }
  }

  async function pdf(i: Invois, jenis: "invois" | "resit") {
    try {
      await simpanAtauKongsiBil(i, jenis, false);
    } catch (e) {
      beritahu(e instanceof Error ? e.message : tr("Ralat"), "ralat");
    }
  }

  const ton = s?.status === "active" || s?.status === "exempt" ? "success" : s?.status === "trial" ? "primary" : "danger";
  return (
    <Screen lebar="lebar">
      <BackHeader title={tr("Langganan")} href="/pengurusan/tetapan" />
      <main className="flex grow flex-col gap-4 px-4 pt-1 pb-8 lg:px-0">
        {st.error && <ErrorBox message={st.error} />}
        {!s && !st.error && <Loading />}
        {baru && (
          <section className="flex flex-col gap-1.5 rounded-card bg-[#E3F1EE] px-4 py-4 lg:px-5">
            <b className="text-base font-extrabold">{tr("Lengkapkan langganan anda")}</b>
            <span className="text-sm text-subtle">{tr("Syarikat anda telah didaftarkan. Bayar RM{0} untuk mengaktifkan langganan setahun, kemudian teruskan persediaan syarikat.", (s!.price_sen / 100).toFixed(0))}</span>
            <Link href="/mula" className="inline-flex min-h-11 items-center self-start text-sm font-bold">
              {tr("Bayar kemudian — guna percubaan 7 hari dahulu")}
            </Link>
          </section>
        )}
        {s && !baru && (
          <section className="flex flex-col gap-2 rounded-card bg-surface px-4 py-4 lg:px-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <b className="text-lg font-extrabold">{tr("HRBoost untuk {0}", me.active!.companyName)}</b>
              <Tag tone={ton}>{label[s.status]}</Tag>
            </div>
            <span className="text-sm text-subtle">
              {s.status === "exempt"
                ? tr("Syarikat anda dikecualikan daripada yuran langganan.")
                : s.status === "trial"
                  ? tr("Percubaan percuma tamat pada {0} ({1} hari lagi).", tarikh(tarikhTempatan(s.ends_at!)), Math.max(0, s.days_left ?? 0))
                  : s.status === "active"
                    ? tr("Langganan aktif sehingga {0}.", tarikh(tarikhTempatan(s.ends_at!)))
                    : s.status === "grace"
                      ? tr("Langganan telah tamat. Bayar sebelum {0} untuk mengelakkan mod baca sahaja.", tarikh(tarikhTempatan(s.readonly_at!)))
                      : tr("Langganan telah tamat. Sistem dalam mod baca sahaja sehingga langganan diperbaharui.")}
            </span>
          </section>
        )}

        {s && s.status !== "exempt" && (
          <section className="grid gap-4 rounded-card bg-surface px-4 py-4 lg:grid-cols-2 lg:px-5">
            <div className="flex flex-col gap-2">
              <Seksyen>{tr("PELAN")}</Seksyen>
              <b className="text-[28px] leading-none font-extrabold">
                RM{(s.price_sen / 100).toFixed(0)} <span className="text-base font-bold text-subtle">{tr("setahun")}</span>
              </b>
              <span className="text-sm text-subtle">{tr("Satu harga untuk seluruh syarikat — bukan setiap pekerja.")}</span>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0 pt-1 text-sm">
                {TERMASUK().map((t) => (
                  <li key={t} className="flex gap-2">
                    <span aria-hidden="true" className="font-bold text-primary">✓</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-3">
              {s.can_pay ? (
                <>
                  <label className="flex flex-col gap-1.5 text-sm font-bold">
                    {tr("Kod baucar (pilihan)")}
                    <span className="flex gap-2">
                      <input className={`${inputKecil} grow uppercase`} value={kod} onChange={(e) => setKod(e.target.value)} placeholder={tr("cth. RAYA50")} />
                      <button type="button" onClick={() => setKodDipakai(kod.trim())} className="h-11 shrink-0 rounded-button border border-line px-4 text-sm font-bold">
                        {tr("Guna")}
                      </button>
                    </span>
                  </label>
                  {q.data?.code_error && kodDipakai && <span className="text-[13px] font-semibold text-danger">{trRalat(q.data.code_error)}</span>}
                  {q.data && (
                    <div className="flex flex-col gap-1 rounded-[14px] bg-page px-4 py-3 text-sm">
                      <span className="flex justify-between">
                        <span>{tr("Langganan 1 tahun")}</span>
                        <span>{rmSen(q.data.price_sen)}</span>
                      </span>
                      {q.data.discount_sen > 0 && (
                        <span className="flex justify-between text-primary">
                          <span>{tr("Diskaun: {0}", q.data.voucher_code ?? q.data.voucher_name ?? "")}</span>
                          <span>-{rmSen(q.data.discount_sen)}</span>
                        </span>
                      )}
                      <span className="flex justify-between border-t border-line-soft pt-1.5 text-base font-extrabold">
                        <span>{tr("Jumlah")}</span>
                        <span>{rmSen(q.data.total_sen)}</span>
                      </span>
                    </div>
                  )}
                  {ralat && <ErrorBox message={ralat} />}
                  <button type="button" disabled={sibuk || !q.data} onClick={bayar} className="h-12 rounded-button bg-primary text-base font-extrabold text-white disabled:opacity-60">
                    {sibuk ? tr("Membuka halaman bayaran…") : s.status === "active" ? tr("Perbaharui untuk setahun lagi") : tr("Bayar {0}", q.data ? rmSen(q.data.total_sen) : "")}
                  </button>
                  <span className="text-xs text-muted">{tr("Bayaran selamat melalui CHIP: FPX (perbankan dalam talian), kad debit / kredit atau e-dompet. Invois & resit rasmi HRBoost dikeluarkan secara automatik.")}</span>
                </>
              ) : (
                <span className="text-sm text-subtle">{tr("Hanya Pentadbir, HR, CEO atau Kewangan syarikat boleh membuat bayaran.")}</span>
              )}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <Seksyen>{tr("INVOIS & RESIT")}</Seksyen>
          {inv.error && <ErrorBox message={inv.error} />}
          {inv.data && inv.data.length === 0 && <div className="rounded-card bg-surface px-4 py-6 text-center text-sm text-muted">{tr("Belum ada invois.")}</div>}
          {inv.data && inv.data.length > 0 && (
            <div className="flex flex-col rounded-card bg-surface px-4 lg:px-5 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              {inv.data.map((i) => (
                <div key={i.id} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 py-3 text-sm">
                  <span className="flex min-w-0 grow basis-56 flex-col gap-0.5">
                    <b className="font-bold">
                      {i.number} · {rmSen(i.total_sen)}
                    </b>
                    <span className="text-xs text-muted">
                      {i.period_start && i.period_end ? tr("Tempoh {0} – {1}", tarikh(i.period_start), tarikh(i.period_end)) : ""}
                      {i.paid_at ? tr(" · dibayar {0}", tarikh(tarikhTempatan(i.paid_at))) : ""}
                    </span>
                  </span>
                  <Tag tone={i.status === "paid" ? "success" : "warning"}>{i.status === "paid" ? tr("Dibayar") : tr("Belum dibayar")}</Tag>
                  <button type="button" onClick={() => pdf(i, "invois")} className="flex h-10 items-center rounded-full border border-line px-4 text-[13px] font-bold">
                    {tr("Invois")}
                  </button>
                  {i.status === "paid" && (
                    <button type="button" onClick={() => pdf(i, "resit")} className="flex h-10 items-center rounded-full border border-primary px-4 text-[13px] font-bold text-primary">
                      {tr("Resit")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </Screen>
  );
}
