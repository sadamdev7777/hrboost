"use client";

import { tr } from "@/lib/i18n";
import { useState } from "react";
import { useData } from "@/lib/useData";
import { rpc } from "@/lib/admin";
import { tarikh, tarikhTempatan } from "@/lib/format";
import {
  getBaucar,
  getRingkasanLangganan,
  getSemuaInvois,
  getTetapanBil,
  LABEL_STATUS,
  rmSen,
  setLangganan,
  simpanBaucar,
  simpanTetapanBil,
  type Baucar,
  type StatusLangganan,
  type TetapanBil,
} from "@/lib/langganan";
import { ErrorBox, Loading } from "@/components/ui";
import { Tag } from "@/components/Senarai";

const medan = "h-11 rounded-[10px] border border-line bg-surface px-3 text-sm";
const tarikhInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

/** Pentadbir Platform: harga & penjual, kunci CHIP, kempen & baucar, status langganan syarikat, invois. */
export default function SaLangganan() {
  const [mesej, setMesej] = useState<string | null>(null);
  const [ralat, setRalat] = useState<string | null>(null);
  async function jalan(f: () => Promise<string | void>) {
    setMesej(null);
    setRalat(null);
    try {
      const m = await f();
      if (m) setMesej(m);
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
  }
  return (
    <>
      <h1 className="m-0 text-2xl font-extrabold">{tr("Langganan & bayaran")}</h1>
      {mesej && <span className="rounded-[12px] bg-success-soft px-3 py-2 text-sm font-semibold text-success">{mesej}</span>}
      {ralat && <ErrorBox message={ralat} />}
      <Tetapan jalan={jalan} />
      <KunciChip jalan={jalan} />
      <SenaraiBaucar jalan={jalan} />
      <Syarikat jalan={jalan} />
      <SenaraiInvois />
    </>
  );
}

type Jalan = (f: () => Promise<string | void>) => Promise<void>;

function Seksyen({ tajuk, children }: { tajuk: string; children: React.ReactNode }) {
  return (
    <>
      <span className="pt-2 text-xs font-bold tracking-[0.04em] text-[#4A5A57]">{tajuk}</span>
      <section className="flex flex-col gap-3 rounded-card bg-surface px-5 py-4 text-sm">{children}</section>
    </>
  );
}

function Tetapan({ jalan }: { jalan: Jalan }) {
  const d = useData(getTetapanBil, []);
  const [t, setT] = useState<TetapanBil | null>(null);
  const x = t ?? d.data;
  if (!x) return d.error ? <ErrorBox message={d.error} /> : <Loading />;
  const ubah = (p: Partial<TetapanBil>) => setT({ ...x, ...p });
  const penjual = (k: keyof TetapanBil["seller"], v: string) => setT({ ...x, seller: { ...x.seller, [k]: v } });
  return (
    <Seksyen tajuk={tr("HARGA & INVOIS")}>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 font-bold">
          {tr("Harga setahun (RM)")}
          <input className={medan} inputMode="decimal" value={x.price_sen / 100} onChange={(e) => ubah({ price_sen: Math.round(Number(e.target.value || 0) * 100) })} />
        </label>
        <label className="flex flex-col gap-1 font-bold">
          {tr("Hari percubaan percuma")}
          <input className={medan} inputMode="numeric" value={x.trial_days} onChange={(e) => ubah({ trial_days: Number(e.target.value || 0) })} />
        </label>
        <label className="flex flex-col gap-1 font-bold">
          {tr("Hari tangguh selepas tamat")}
          <input className={medan} inputMode="numeric" value={x.grace_days} onChange={(e) => ubah({ grace_days: Number(e.target.value || 0) })} />
        </label>
      </div>
      <span className="font-bold">{tr("Butiran penjual pada invois & resit")}</span>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["name", tr("Nama syarikat")],
            ["ssm", tr("No. SSM")],
            ["email", tr("E-mel")],
            ["phone", tr("Telefon")],
          ] as const
        ).map(([k, l]) => (
          <label key={k} className="flex flex-col gap-1 font-bold">
            {l}
            <input className={medan} value={x.seller?.[k] ?? ""} onChange={(e) => penjual(k, e.target.value)} />
          </label>
        ))}
        <label className="flex flex-col gap-1 font-bold sm:col-span-2">
          {tr("Alamat")}
          <textarea className={`${medan} h-auto min-h-20 py-2`} value={x.seller?.address ?? ""} onChange={(e) => penjual("address", e.target.value)} />
        </label>
      </div>
      <button
        type="button"
        onClick={() =>
          jalan(async () => {
            await simpanTetapanBil(x);
            d.reload();
            setT(null);
            return tr("Tetapan langganan disimpan.");
          })
        }
        className="h-11 self-start rounded-[10px] bg-primary px-5 font-bold text-white"
      >
        {tr("Simpan tetapan")}
      </button>
    </Seksyen>
  );
}

function KunciChip({ jalan }: { jalan: Jalan }) {
  const st = useData(() => rpc<{ name: string; is_set: boolean; hint: string | null }[]>("sa_platform_secrets"), []);
  const [nilai, setNilai] = useState<Record<string, string>>({});
  const item = (n: string) => (st.data ?? []).find((x) => x.name === n);
  return (
    <Seksyen tajuk={tr("CHIP (GERBANG BAYARAN)")}>
      <span className="text-subtle">
        {tr("Dapatkan Secret key & Brand ID di portal CHIP (Developers). Gunakan kunci sandbox untuk ujian dahulu. Kunci disimpan dalam Vault dan tidak dipaparkan semula.")}
      </span>
      {(
        [
          ["chip_secret_key", tr("Secret key")],
          ["chip_brand_id", tr("Brand ID")],
        ] as const
      ).map(([n, l]) => {
        const x = item(n);
        return (
          <div key={n} className="flex flex-wrap items-center gap-2">
            <span className="w-28 font-bold">{l}</span>
            <Tag tone={x?.is_set ? "success" : "warning"}>{x?.is_set ? tr("Ditetapkan (…{0})", x.hint ?? "") : tr("Belum ditetapkan")}</Tag>
            <input
              type="password"
              autoComplete="off"
              className={`${medan} min-w-0 grow`}
              placeholder={x?.is_set ? tr("Tukar…") : ""}
              value={nilai[n] ?? ""}
              onChange={(e) => setNilai({ ...nilai, [n]: e.target.value })}
              aria-label={l}
            />
            <button
              type="button"
              disabled={!(nilai[n] ?? "").trim()}
              onClick={() =>
                jalan(async () => {
                  await rpc("sa_platform_secret_set", { p_name: n, p_value: nilai[n].trim() });
                  setNilai({ ...nilai, [n]: "" });
                  st.reload();
                  return tr("{0} disimpan.", l);
                })
              }
              className="h-11 rounded-[10px] bg-primary px-4 font-bold text-white disabled:opacity-50"
            >
              {tr("Simpan")}
            </button>
          </div>
        );
      })}
    </Seksyen>
  );
}

const BAUCAR_KOSONG = { code: "", name: "", kind: "percent", value: "", starts_at: "", ends_at: "", max_redemptions: "", active: true, note: "" };

function SenaraiBaucar({ jalan }: { jalan: Jalan }) {
  const d = useData(getBaucar, []);
  const [f, setF] = useState<Record<string, string | boolean>>(BAUCAR_KOSONG);
  const [id, setId] = useState<string | null>(null);
  const ubah = (b: Baucar) => {
    setId(b.id);
    setF({ code: b.code ?? "", name: b.name, kind: b.kind, value: String(b.value), starts_at: tarikhInput(b.starts_at), ends_at: tarikhInput(b.ends_at), max_redemptions: b.max_redemptions ? String(b.max_redemptions) : "", active: b.active, note: b.note ?? "" });
  };
  const nilai = (b: Baucar) => (b.kind === "percent" ? `${Number(b.value)}%` : `RM${Number(b.value)}`);
  return (
    <Seksyen tajuk={tr("KEMPEN & KOD BAUCAR")}>
      <span className="text-subtle">
        {tr("Tanpa kod = kempen automatik untuk semua syarikat dalam tempoh. Dengan kod = pelanggan masukkan kod semasa bayar. Had = bilangan syarikat yang boleh menggunakannya (dikira selepas bayaran berjaya).")}
      </span>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 font-bold sm:col-span-2">
          {tr("Nama kempen")}
          <input className={medan} value={String(f.name)} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={tr("cth. Promosi Merdeka")} />
        </label>
        <label className="flex flex-col gap-1 font-bold">
          {tr("Kod (kosong = automatik)")}
          <input className={`${medan} uppercase`} value={String(f.code)} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="MERDEKA20" />
        </label>
        <label className="flex flex-col gap-1 font-bold">
          {tr("Had syarikat (kosong = tiada had)")}
          <input className={medan} inputMode="numeric" value={String(f.max_redemptions)} onChange={(e) => setF({ ...f, max_redemptions: e.target.value.replace(/\D/g, "") })} />
        </label>
        <label className="flex flex-col gap-1 font-bold">
          {tr("Jenis diskaun")}
          <select className={medan} value={String(f.kind)} onChange={(e) => setF({ ...f, kind: e.target.value })}>
            <option value="percent">{tr("Peratus (%)")}</option>
            <option value="fixed">{tr("Amaun tetap (RM)")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 font-bold">
          {tr("Nilai")}
          <input className={medan} inputMode="decimal" value={String(f.value)} onChange={(e) => setF({ ...f, value: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 font-bold">
          {tr("Mula")}
          <input className={medan} type="date" value={String(f.starts_at)} onChange={(e) => setF({ ...f, starts_at: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 font-bold">
          {tr("Tamat")}
          <input className={medan} type="date" value={String(f.ends_at)} onChange={(e) => setF({ ...f, ends_at: e.target.value })} />
        </label>
      </div>
      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" className="size-5 accent-primary" checked={!!f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
        {tr("Aktif")}
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            jalan(async () => {
              await simpanBaucar({ ...f, ends_at: f.ends_at ? `${f.ends_at}T23:59:59+08:00` : "", starts_at: f.starts_at ? `${f.starts_at}T00:00:00+08:00` : "" }, id);
              setF(BAUCAR_KOSONG);
              setId(null);
              d.reload();
              return tr("Kempen disimpan.");
            })
          }
          className="h-11 rounded-[10px] bg-primary px-5 font-bold text-white"
        >
          {id ? tr("Simpan perubahan") : tr("Cipta kempen")}
        </button>
        {id && (
          <button type="button" onClick={() => { setId(null); setF(BAUCAR_KOSONG); }} className="h-11 rounded-[10px] border border-line px-4 font-bold">
            {tr("Batal")}
          </button>
        )}
      </div>
      {d.data && d.data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-2">{tr("Kempen")}</th>
                <th>{tr("Kod")}</th>
                <th>{tr("Diskaun")}</th>
                <th>{tr("Tempoh")}</th>
                <th>{tr("Digunakan")}</th>
                <th />
              </tr>
            </thead>
            <tbody className="[&>tr]:border-t [&>tr]:border-[#EEF2F1]">
              {d.data.map((b) => (
                <tr key={b.id}>
                  <td className="py-2 font-bold">
                    {b.name} {!b.active && <Tag tone="neutral">{tr("Tidak aktif")}</Tag>}
                  </td>
                  <td>{b.code ?? <span className="text-muted">{tr("automatik")}</span>}</td>
                  <td>{nilai(b)}</td>
                  <td className="whitespace-nowrap">{b.starts_at || b.ends_at ? `${b.starts_at ? tarikh(tarikhTempatan(b.starts_at)) : "…"} – ${b.ends_at ? tarikh(tarikhTempatan(b.ends_at)) : "…"}` : "-"}</td>
                  <td>{b.max_redemptions ? `${b.used} / ${b.max_redemptions}` : b.used}</td>
                  <td>
                    <button type="button" onClick={() => ubah(b)} className="min-h-9 font-bold text-primary">
                      {tr("Ubah")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Seksyen>
  );
}

function Syarikat({ jalan }: { jalan: Jalan }) {
  const d = useData(getRingkasanLangganan, []);
  const label = LABEL_STATUS();
  return (
    <Seksyen tajuk={tr("SYARIKAT")}>
      {!d.data && <Loading />}
      {d.data && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-2">{tr("Syarikat")}</th>
                <th>{tr("Status")}</th>
                <th>{tr("Tamat")}</th>
                <th>{tr("Jumlah dibayar")}</th>
                <th>{tr("Tindakan")}</th>
              </tr>
            </thead>
            <tbody className="[&>tr]:border-t [&>tr]:border-[#EEF2F1]">
              {d.data.map((c) => (
                <tr key={c.company_id}>
                  <td className="py-2">
                    <b>{c.name}</b> <span className="text-muted">· {c.code}</span>
                  </td>
                  <td>
                    <Tag tone={c.billing_status === "active" || c.billing_status === "exempt" ? "success" : c.billing_status === "trial" ? "primary" : "danger"}>{label[c.billing_status]}</Tag>
                  </td>
                  <td className="whitespace-nowrap">{c.billing_status === "trial" ? (c.trial_ends_at ? tarikh(tarikhTempatan(c.trial_ends_at)) : "-") : c.paid_until ? tarikh(tarikhTempatan(c.paid_until)) : "-"}</td>
                  <td>{rmSen(Number(c.paid_total_sen))}</td>
                  <td>
                    <select
                      aria-label={tr("Tukar status {0}", c.name)}
                      className="h-9 rounded-[8px] border border-line bg-surface px-2"
                      value=""
                      onChange={(e) => {
                        const v = e.target.value as StatusLangganan | "lanjut";
                        if (!v) return;
                        void jalan(async () => {
                          if (v === "lanjut") {
                            const asas = c.paid_until && new Date(c.paid_until) > new Date() ? new Date(c.paid_until) : new Date();
                            asas.setFullYear(asas.getFullYear() + 1);
                            await setLangganan(c.company_id, "active", asas.toISOString());
                          } else await setLangganan(c.company_id, v);
                          d.reload();
                          return tr("Status {0} dikemas kini.", c.name);
                        });
                      }}
                    >
                      <option value="">{tr("Pilih…")}</option>
                      <option value="exempt">{tr("Kecualikan (percuma)")}</option>
                      <option value="lanjut">{tr("Lanjut 1 tahun (bayaran luar talian)")}</option>
                      <option value="trial">{tr("Kembali ke percubaan")}</option>
                      <option value="readonly">{tr("Baca sahaja")}</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Seksyen>
  );
}

function SenaraiInvois() {
  const d = useData(getSemuaInvois, []);
  return (
    <Seksyen tajuk={tr("INVOIS")}>
      {!d.data && <Loading />}
      {d.data && d.data.length === 0 && <span className="text-muted">{tr("Belum ada invois.")}</span>}
      {d.data && d.data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-2">{tr("No. invois")}</th>
                <th>{tr("Syarikat")}</th>
                <th>{tr("Jumlah")}</th>
                <th>{tr("Diskaun")}</th>
                <th>{tr("Status")}</th>
                <th>{tr("Resit")}</th>
              </tr>
            </thead>
            <tbody className="[&>tr]:border-t [&>tr]:border-[#EEF2F1]">
              {d.data.map((i) => (
                <tr key={i.id}>
                  <td className="py-2 font-bold">{i.number}</td>
                  <td>{i.company_name}</td>
                  <td>{rmSen(i.total_sen)}</td>
                  <td>{i.discount_sen ? `${rmSen(i.discount_sen)}${i.voucher_label ? ` (${i.voucher_label})` : ""}` : "-"}</td>
                  <td>
                    <Tag tone={i.status === "paid" ? "success" : "warning"}>{i.status === "paid" ? tr("Dibayar") : tr("Belum dibayar")}</Tag>
                  </td>
                  <td>{i.receipt_number ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Seksyen>
  );
}
