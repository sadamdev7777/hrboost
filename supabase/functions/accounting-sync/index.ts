// =====================================================================
//  accounting-sync — accounting_sync_queue → QuickBooks Online (CLAUDE.md §4, setiap 10 minit)
//   • claim       → Bill (pembekal = pekerja; akaun ikut jenis tuntutan, atau gl_accounts.claims_expense)
//   • payroll_run → JournalEntry (peta akaun GL dalam Tetapan Gaji)
//  Panggilan: pg_cron + pg_net dengan Authorization: Bearer <service role>, atau Kewangan
//  (JWT) { company_id } untuk "Segerak sekarang". Gagal → dicuba semula sehingga 5 kali.
// =====================================================================
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.105.0";
import { Qbo, QboError, qboDikonfigurasi, sesiSyarikat } from "../_shared/quickbooks.ts";
import { cors, json } from "../_shared/ai.ts";

const URL_SB = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Kerja = { id: string; company_id: string; entity_type: "claim" | "payroll_run"; entity_id: string; attempts: number };
type Bill = { vendor_name: string; txn_date: string; title: string; default_account: string | null; lines: { account: string | null; description: string; amount: number }[] };
type Jurnal = { txn_date: string; memo: string; doc_number: string; lines: { account: string; debit: number; credit: number }[] };

async function hantarTuntutan(sb: SupabaseClient, q: Qbo, k: Kerja): Promise<string> {
  const { data, error } = await sb.rpc("accounting_claim_bill", { p_claim: k.entity_id });
  if (error || !data) throw new QboError("data", error?.message ?? "Tuntutan tidak dijumpai");
  const b = data as Bill;
  const vendor = await q.pembekal(b.vendor_name);
  const baris = [];
  for (const l of b.lines) {
    const ruj = l.account ?? b.default_account;
    if (!ruj) throw new QboError("data", "Jenis tuntutan tiada akaun QuickBooks. Tetapkan di Tetapan → Integrasi Akaun.");
    baris.push({ DetailType: "AccountBasedExpenseLineDetail", Amount: Number(l.amount), Description: l.description, AccountBasedExpenseLineDetail: { AccountRef: { value: await q.akaun(ruj) } } });
  }
  const r = await q.panggil<{ Bill: { Id: string } }>("POST", "bill", {
    VendorRef: { value: vendor },
    TxnDate: b.txn_date,
    PrivateNote: `HRBoost: ${b.title}`.slice(0, 4000),
    Line: baris,
  });
  return r.Bill.Id;
}

async function hantarGaji(sb: SupabaseClient, q: Qbo, k: Kerja): Promise<string> {
  const { data, error } = await sb.rpc("accounting_payroll_journal", { p_run: k.entity_id });
  if (error || !data) throw new QboError("data", error?.message ?? "Gaji tidak dijumpai");
  const j = data as Jurnal;
  const dr = j.lines.reduce((a, l) => a + Number(l.debit), 0);
  const cr = j.lines.reduce((a, l) => a + Number(l.credit), 0);
  if (Math.abs(dr - cr) > 0.005) throw new QboError("data", `Jurnal tidak seimbang (debit ${dr.toFixed(2)}, kredit ${cr.toFixed(2)})`);
  const baris = [];
  for (const l of j.lines) {
    const amaun = Number(l.debit) || Number(l.credit);
    if (!amaun) continue;
    baris.push({
      DetailType: "JournalEntryLineDetail",
      Amount: amaun,
      Description: j.memo,
      JournalEntryLineDetail: { PostingType: Number(l.debit) ? "Debit" : "Credit", AccountRef: { value: await q.akaun(l.account) } },
    });
  }
  const r = await q.panggil<{ JournalEntry: { Id: string } }>("POST", "journalentry", { TxnDate: j.txn_date, DocNumber: j.doc_number.slice(0, 21), PrivateNote: `HRBoost: ${j.memo}`, Line: baris });
  return r.JournalEntry.Id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors() });
  const sb = createClient(URL_SB, SERVICE, { auth: { persistSession: false } });
  const auth = req.headers.get("Authorization") ?? "";
  let hadSyarikat: string | null = null;
  if (auth !== `Bearer ${SERVICE}`) {
    // Kewangan: "Segerak sekarang" bagi syarikat sendiri
    const pengguna = createClient(URL_SB, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { company_id } = (await req.json().catch(() => ({}))) as { company_id?: string };
    const { data: st } = await pengguna.rpc("qbo_status", { p_company: company_id });
    if (!st || !company_id) return json({ ok: false, error: "Tidak dibenarkan" }, 403);
    hadSyarikat = company_id;
  }
  if (!qboDikonfigurasi()) return json({ ok: false, error: "Sambungan QuickBooks belum dikonfigurasi." }, 503);

  const { data: kerja, error } = await sb.rpc("accounting_queue_next", { p_limit: 25 });
  if (error) return json({ ok: false, error: error.message }, 500);
  const sesi = new Map<string, Qbo | QboError>();
  let ok = 0, gagal = 0, dilangkau = 0;
  for (const k of (kerja ?? []) as Kerja[]) {
    if (hadSyarikat && k.company_id !== hadSyarikat) {
      // bukan syarikat ini: kembalikan percubaan & biarkan untuk jadual biasa
      await sb.from("accounting_sync_queue").update({ attempts: k.attempts - 1 }).eq("id", k.id);
      dilangkau++;
      continue;
    }
    try {
      if (!sesi.has(k.company_id)) sesi.set(k.company_id, await sesiSyarikat(sb, k.company_id).catch((e) => (e instanceof QboError ? e : new QboError("api", String(e)))));
      const q = sesi.get(k.company_id)!;
      if (q instanceof QboError) throw q;
      const ref = k.entity_type === "claim" ? await hantarTuntutan(sb, q, k) : await hantarGaji(sb, q, k);
      await sb.rpc("accounting_queue_done", { p_id: k.id, p_ok: true, p_ref: ref, p_error: null });
      ok++;
    } catch (e) {
      await sb.rpc("accounting_queue_done", { p_id: k.id, p_ok: false, p_ref: null, p_error: e instanceof Error ? e.message : String(e) });
      gagal++;
    }
  }
  return json({ ok: true, disegerak: ok, gagal, dilangkau });
});
