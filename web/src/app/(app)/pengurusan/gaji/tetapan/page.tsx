"use client";

import { tr } from "@/lib/i18n";
import { useState, type ReactNode } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { BANK } from "@/lib/senarai";
import { AKAUN_GL, LABEL_ASAS, contohAsas, getKatalog, getTetapanGaji, simpanTetapanGaji, type Asas, type TetapanGaji } from "@/lib/gajiLengkap";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { PengepalaAkar, TabNav } from "@/components/TabNav";
import { TabGaji } from "@/components/TabGaji";
import { ButangUtama, Cip, HadPeranan, MedanBorang, Seksyen, Suis, inputKecil } from "@/components/Senarai";
import { beritahu } from "@/components/Dialog";

/** Tetapan Gaji: nombor majikan, penandatangan, bank syarikat, asas kiraan, hari gaji, slip & peta akaun GL. */
export default function TetapanGajiPage() {
  return (
    <HadPeranan roles={["hr", "finance", "admin"]}>
      <Kandungan />
    </HadPeranan>
  );
}

function Kandungan() {
  const me = useMe();
  const cid = me.active!.companyId;
  const d = useData(async () => ({ t: await getTetapanGaji(cid), item: await getKatalog(cid) }), [cid]);
  return (
    <Screen lebar="lebar">
      <PengepalaAkar title={tr("Penggajian")} />
      <TabGaji />
      {d.error && (
        <div className="px-4 pt-3">
          <ErrorBox message={d.error} />
        </div>
      )}
      {!d.data && d.loading && <Loading />}
      {d.data && <Borang key={JSON.stringify(d.data.t)} cid={cid} awal={d.data.t} item={d.data.item} reload={d.reload} />}
      <TabNav />
    </Screen>
  );
}

function Borang({ cid, awal, item, reload }: { cid: string; awal: TetapanGaji; item: Awaited<ReturnType<typeof getKatalog>>; reload: () => void }) {
  const [f, setF] = useState<TetapanGaji | null>(awal);
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);

  const set = <K extends keyof TetapanGaji>(k: K, v: TetapanGaji[K]) => setF((x) => (x ? { ...x, [k]: v } : x));
  const teks = (k: keyof TetapanGaji) => ({
    value: (f?.[k] as string | null) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value as never),
    className: inputKecil,
  });

  async function simpan() {
    if (!f) return;
    setBusy(true);
    setRalat(null);
    try {
      await simpanTetapanGaji(cid, f);
      beritahu(tr("Tetapan gaji disimpan."));
      reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
    setBusy(false);
  }

  const pendapatan = item.filter((i) => i.kind === "earning" && i.active && !["BASIC", "CLAIM", "OT", "OT_LULUS"].includes(i.code));

  return (
    <>
      {f && (
        <>
          <main className="flex grow flex-col gap-3 px-4 pt-4 pb-4 lg:px-0">
            <Kad tajuk={tr("NOMBOR MAJIKAN")} nota={tr("Dicetak pada slip gaji, Borang EA, CP22 dan fail berkanun.")}>
              <Grid>
                <MedanBorang label={tr("No. pendaftaran SSM")}>
                  <input {...teks("reg_no")} />
                </MedanBorang>
                <MedanBorang label={tr("No. majikan LHDN (E)")} nota={tr("Cth. E 1234567-08")}>
                  <input {...teks("lhdn_employer_no")} />
                </MedanBorang>
                <MedanBorang label={tr("No. cukai syarikat (C)")}>
                  <input {...teks("lhdn_c_no")} />
                </MedanBorang>
                <MedanBorang label={tr("No. majikan KWSP")}>
                  <input {...teks("epf_employer_no")} />
                </MedanBorang>
                <MedanBorang label={tr("No. majikan PERKESO")}>
                  <input {...teks("socso_employer_no")} />
                </MedanBorang>
                <MedanBorang label={tr("No. majikan zakat")} nota={tr("Untuk potongan zakat melalui gaji")}>
                  <input {...teks("zakat_no")} />
                </MedanBorang>
              </Grid>
              <BarisSuis label={tr("Berdaftar dengan HRD Corp (levi HRDF)")} on={f.hrdf_registered} onChange={(v) => set("hrdf_registered", v)} />
            </Kad>

            <Kad tajuk={tr("PEGAWAI PENANDATANGAN")} nota={tr("Nama ini dicetak pada Borang EA, Borang E dan CP22.")}>
              <Grid>
                <MedanBorang label={tr("Nama penuh")}>
                  <input {...teks("signatory_name")} />
                </MedanBorang>
                <MedanBorang label={tr("Jawatan")}>
                  <input {...teks("signatory_position")} />
                </MedanBorang>
                <MedanBorang label={tr("No. kad pengenalan")}>
                  <input {...teks("signatory_ic")} />
                </MedanBorang>
                <MedanBorang label={tr("Telefon")}>
                  <input {...teks("signatory_phone")} inputMode="tel" />
                </MedanBorang>
                <MedanBorang label={tr("E-mel")}>
                  <input {...teks("signatory_email")} type="email" />
                </MedanBorang>
              </Grid>
            </Kad>

            <Kad tajuk={tr("AKAUN BANK SYARIKAT")} nota={tr("Digunakan dalam fail bayaran bank pukal.")}>
              <Grid>
                <MedanBorang label={tr("Bank")}>
                  <select className={inputKecil} value={f.company_bank_name ?? ""} onChange={(e) => set("company_bank_name", e.target.value || null)}>
                    <option value="">{tr("Pilih bank")}</option>
                    {BANK.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                </MedanBorang>
                <MedanBorang label={tr("No. akaun")}>
                  <input {...teks("company_bank_account")} inputMode="numeric" />
                </MedanBorang>
                <MedanBorang label={tr("ID korporat bank")} nota={tr("Pilihan, ikut keperluan perbankan korporat")}>
                  <input {...teks("bank_corporate_id")} />
                </MedanBorang>
                <MedanBorang label={tr("ID kelompok bayaran")}>
                  <input {...teks("bank_batch_id")} />
                </MedanBorang>
              </Grid>
            </Kad>

            <Kad tajuk={tr("ASAS PENGIRAAN")} nota={tr("Menentukan kadar sehari untuk prorata, cuti tanpa gaji dan kerja lebih masa.")}>
              <PilihAsas label={tr("Prorata (pekerja mula / berhenti pertengahan bulan)")} v={f.prorate_basis} onChange={(v) => set("prorate_basis", v)} hari={f.fixed_days} setHari={(n) => set("fixed_days", n)} />
              <PilihAsas label={tr("Potongan cuti tanpa gaji")} v={f.unpaid_basis} onChange={(v) => set("unpaid_basis", v)} hari={f.fixed_days} setHari={(n) => set("fixed_days", n)} />
              <PilihItem
                label={tr("Item dalam asas potongan cuti tanpa gaji (selain gaji pokok)")}
                item={pendapatan}
                pilih={f.unpaid_items}
                onChange={(v) => set("unpaid_items", v)}
              />
              <PilihAsas label={tr("Kadar kerja lebih masa")} v={f.ot_basis} onChange={(v) => set("ot_basis", v)} hari={f.fixed_days} setHari={(n) => set("fixed_days", n)} />
              <PilihItem label={tr("Item dalam asas kerja lebih masa (selain gaji pokok)")} item={pendapatan} pilih={f.ot_items} onChange={(v) => set("ot_items", v)} />
              <Grid>
                <MedanBorang label={tr("Jam bekerja sehari")} nota={tr("Kadar sejam = kadar sehari ÷ jam sehari")}>
                  <input className={inputKecil} inputMode="decimal" value={String(f.hours_per_day)} onChange={(e) => set("hours_per_day", Number(e.target.value.replace(/[^\d.]/g, "")) || 8)} />
                </MedanBorang>
                <MedanBorang label={tr("Hari gaji")} nota={tr("Hari dalam bulan gaji dibayar (1–31)")}>
                  <input
                    className={inputKecil}
                    inputMode="numeric"
                    value={String(f.payday)}
                    onChange={(e) => set("payday", Math.min(31, Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1)))}
                  />
                </MedanBorang>
              </Grid>
              <BarisSuis
                label={tr("Pekerja tempatan menyertai Lindung 24 Jam (SKBBK) secara lalai")}
                nota={tr("Pekerja boleh memilih untuk tidak menyertai; tetapkan dalam profil pekerja → Gaji. Wajib bagi pekerja asing.")}
                on={f.skbbk_default}
                onChange={(v) => set("skbbk_default", v)}
              />
            </Kad>

            <Kad tajuk={tr("SLIP GAJI")}>
              <BarisSuis
                label={tr("Lepaskan slip secara automatik apabila ditanda dibayar")}
                nota={tr("Jika dimatikan, lepaskan slip secara manual (serta-merta atau pada tarikh) dalam Langkah 4.")}
                on={f.payslip_options.auto_release}
                onChange={(v) => set("payslip_options", { ...f.payslip_options, auto_release: v })}
              />
              <BarisSuis label={tr("Papar ringkasan baki cuti")} on={f.payslip_options.leave_summary} onChange={(v) => set("payslip_options", { ...f.payslip_options, leave_summary: v })} />
              <BarisSuis label={tr("Papar jumlah terkumpul tahun ini (YTD)")} on={f.payslip_options.ytd} onChange={(v) => set("payslip_options", { ...f.payslip_options, ytd: v })} />
              <MedanBorang label={tr("Penafian di bawah slip (pilihan)")}>
                <textarea
                  className={`${inputKecil} h-20 py-2`}
                  maxLength={300}
                  value={f.payslip_options.disclaimer ?? ""}
                  placeholder={tr("Cth. Slip ini dijana oleh komputer dan tidak memerlukan tandatangan.")}
                  onChange={(e) => set("payslip_options", { ...f.payslip_options, disclaimer: e.target.value || null })}
                />
              </MedanBorang>
            </Kad>

            <Kad tajuk={tr("PETA AKAUN (JURNAL GAJI)")} nota={tr("Nama atau kod akaun dalam sistem perakaunan anda. Akaun bagi setiap item boleh ditetapkan dalam tab Item gaji.")}>
              <Grid>
                {AKAUN_GL.map((a) => (
                  <MedanBorang key={a.key} label={a.label}>
                    <input
                      className={inputKecil}
                      placeholder={a.lalai}
                      value={f.gl_accounts[a.key] ?? ""}
                      onChange={(e) => {
                        const g = { ...f.gl_accounts, [a.key]: e.target.value };
                        if (!e.target.value) delete g[a.key];
                        set("gl_accounts", g);
                      }}
                    />
                  </MedanBorang>
                ))}
              </Grid>
            </Kad>
            {ralat && <ErrorBox message={ralat} />}
          </main>
          <div className="bar-bawah sticky bottom-0 border-t border-line-soft bg-surface px-4 pt-3 pb-5 lg:px-0">
            <ButangUtama onClick={simpan} busy={busy}>
              {tr("Simpan tetapan")}
            </ButangUtama>
          </div>
        </>
      )}
    </>
  );
}

function Kad({ tajuk, nota, children }: { tajuk: string; nota?: string; children: ReactNode }) {
  return (
    <section aria-label={tajuk} className="flex flex-col gap-2">
      <Seksyen className="pt-1">{tajuk}</Seksyen>
      {nota && <span className="text-xs leading-snug text-muted">{nota}</span>}
      <div className="flex flex-col gap-3 rounded-card bg-surface px-4 py-4 lg:px-5">{children}</div>
    </section>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

function BarisSuis({ label, nota, on, onChange }: { label: string; nota?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex grow flex-col gap-0.5">
        <b className="text-sm font-bold">{label}</b>
        {nota && <span className="text-xs leading-snug text-muted">{nota}</span>}
      </span>
      <Suis on={on} onChange={onChange} label={label} />
    </div>
  );
}

function PilihAsas({ label, v, onChange, hari, setHari }: { label: string; v: Asas; onChange: (v: Asas) => void; hari: number; setHari: (n: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5" role="group" aria-label={label}>
      <span className="text-[13px] font-bold text-[#4A5A57]">{label}</span>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(LABEL_ASAS) as Asas[]).filter((a) => a !== "fixed26" || v === "fixed26").map((a) => (
          <Cip key={a} on={v === a} onClick={() => onChange(a)}>
            {LABEL_ASAS[a]}
          </Cip>
        ))}
      </div>
      {v === "fixed" && (
        <label className="flex items-center gap-2 text-[13px] font-bold text-[#4A5A57]">
          {tr("Bilangan hari tetap")}
          <input
            className="h-10 w-20 rounded-[10px] border border-[#D5DEDC] bg-surface px-2.5 text-sm font-semibold"
            inputMode="numeric"
            value={String(hari)}
            onChange={(e) => setHari(Math.min(31, Math.max(20, Number(e.target.value.replace(/\D/g, "")) || 26)))}
          />
        </label>
      )}
      <span className="text-xs text-muted">{tr("Contoh (Februari): {0}", contohAsas(v, 3000, hari))}</span>
    </div>
  );
}

function PilihItem({ label, item, pilih, onChange }: { label: string; item: { code: string; name: string }[]; pilih: string[]; onChange: (v: string[]) => void }) {
  if (!item.length) return null;
  return (
    <div className="flex flex-col gap-1.5" role="group" aria-label={label}>
      <span className="text-[13px] font-bold text-[#4A5A57]">{label}</span>
      <div className="flex flex-wrap gap-2">
        {item.map((i) => (
          <Cip key={i.code} on={pilih.includes(i.code)} onClick={() => onChange(pilih.includes(i.code) ? pilih.filter((x) => x !== i.code) : [...pilih, i.code])}>
            {i.name}
          </Cip>
        ))}
      </div>
    </div>
  );
}
