// Ujian integrasi Fasa C (TEMPATAN SAHAJA): Edge Function notify-sender & whatsapp-inbound
// dijalankan dengan Deno terhadap Supabase tempatan, dengan pelayan Murpati PALSU yang
// merekod setiap mesej. Tiada mesej sebenar dihantar.
//
// Prasyarat: `npx supabase db reset` (data demo), Deno (npx deno@2), aplikasi web tidak perlu.
// Jalankan: node supabase/scripts/ujian-fungsi-whatsapp.cjs
const { spawn, execSync } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");
const os = require("os");

const ROOT = path.join(__dirname, "../..");
const { createClient } = require(path.join(ROOT, "web/node_modules/@supabase/supabase-js"));
const status = JSON.parse(execSync("npx supabase status -o json", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString());
const URL_ = status.API_URL;
if (!/127\.0\.0\.1|localhost/.test(URL_)) throw new Error("Ujian ini untuk Supabase tempatan sahaja");
const SERVICE = status.SERVICE_ROLE_KEY;
const ANON = status.ANON_KEY;
const SECRET = "rahsia-webhook-ujian";
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error("SEMAKAN GAGAL: " + msg); log("   ✔ " + msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Murpati palsu ----
const outbox = [];
const fake = http.createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    const j = JSON.parse(b || "{}");
    outbox.push({ auth: req.headers.authorization, ...j });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: "m-" + outbox.length }));
  });
});

// Salin fungsi ke folder sementara (elak deno menulis node_modules ke dalam repo)
const work = fs.mkdtempSync(path.join(os.tmpdir(), "hrb-fn-"));
execSync(`cp -r ${path.join(ROOT, "supabase/functions")}/* ${work}/`);
fs.writeFileSync(path.join(work, "deno.json"), JSON.stringify({ nodeModulesDir: "auto" }));

async function jalankan(fn, port = 8000) {
  const env = {
    ...process.env,
    SUPABASE_URL: URL_,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE,
    MURPATI_API_URL: "http://127.0.0.1:4010/hantar",
    MURPATI_API_KEY: "kunci-palsu",
    MURPATI_WEBHOOK_SECRET: SECRET,
    NODE_USE_ENV_PROXY: "1",
  };
  // Deno.serve() dalam fungsi mendengar pada port lalai 8000; fungsi dijalankan satu demi satu.
  const p = spawn("npx", ["-y", "deno@2", "run", "-A", `${fn}/index.ts`], { cwd: work, env, detached: true });
  p.henti = () => { try { process.kill(-p.pid, "SIGTERM"); } catch { /* sudah berhenti */ } };
  let out = "";
  p.stdout.on("data", (d) => (out += d));
  p.stderr.on("data", (d) => (out += d));
  for (let i = 0; i < 240; i++) {
    try {
      await fetch(`http://127.0.0.1:${port}/`, { method: "OPTIONS" });
      return p;
    } catch {
      await sleep(500);
    }
  }
  p.henti();
  throw new Error(`${fn} tidak bermula:\n${out.slice(-800)}`);
}

(async () => {
  await new Promise((r) => fake.listen(4010, "127.0.0.1", r));
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });

  log("1. Amin mohon cuti (PIC Zulfa) dari aplikasi");
  const amin = createClient(URL_, ANON, { auth: { persistSession: false } });
  await amin.auth.verifyOtp({ phone: "60100000004", token: "123456", type: "sms" });
  const { error: e1 } = await amin.rpc("submit_leave", {
    p_employment: "00000000-0000-0000-0000-0000000000e4", p_leave_code: "AL", p_start: "2026-12-23", p_end: "2026-12-28",
    p_half: "full", p_reason: "Balik kampung", p_via: "web", p_cover_person: "00000000-0000-0000-0000-000000000006",
  });
  expect(!e1, "permohonan dihantar");
  const { data: n1 } = await db.rpc("process_hr_events");
  expect(n1 >= 1, "events-worker memproses kejadian");

  log("2. notify-sender menghantar notifikasi beratur");
  const ns = await jalankan("notify-sender");
  const tolak = await fetch("http://127.0.0.1:8000/", { method: "POST", headers: { Authorization: "Bearer salah" } });
  expect(tolak.status === 401, "notify-sender menolak pemanggil tanpa kunci service role");
  const r1 = await (await fetch("http://127.0.0.1:8000/", { method: "POST", headers: { Authorization: `Bearer ${SERVICE}` } })).json();
  expect(r1.dihantar >= 3 && r1.gagal === 0, `notify-sender menghantar ${r1.dihantar} mesej`);
  const zuerin = outbox.find((m) => m.to === "60100000003" && /menunggu kelulusan anda/.test(m.message));
  const pic = outbox.find((m) => m.to === "60100000006" && /PIC ganti/.test(m.message));
  expect(zuerin && pic, "Zuerin (pelulus) dan Zulfa (PIC ganti) menerima WhatsApp");
  expect(outbox.every((m) => m.auth === "Bearer kunci-palsu"), "kunci API dihantar dalam pengepala");
  const { count: baki } = await db.from("notifications").select("id", { count: "exact", head: true }).eq("status", "pending");
  const { count: sent } = await db.from("notifications").select("id", { count: "exact", head: true }).eq("status", "sent");
  expect(sent === r1.dihantar && baki === 0, "status notifikasi dikemas kini kepada 'sent'");

  log("3. whatsapp-inbound: Zuerin membalas LULUS");
  ns.henti();
  await sleep(2000);
  const wi = await jalankan("whatsapp-inbound");
  const tanpaRahsia = await fetch("http://127.0.0.1:8000/", { method: "POST", body: JSON.stringify({ from: "60100000003", text: "LULUS" }) });
  expect(tanpaRahsia.status === 401, "webhook tanpa rahsia ditolak");
  const before = outbox.length;
  const r2 = await (await fetch("http://127.0.0.1:8000/", {
    method: "POST",
    headers: { "x-webhook-secret": SECRET, "content-type": "application/json" },
    body: JSON.stringify({ from: "+60 10-000 0003", text: "lulus" }),
  })).json();
  expect(r2.tindakan === "approve", "balasan LULUS ditafsir sebagai kelulusan");
  const balas = outbox.slice(before).find((m) => m.to === "60100000003");
  expect(balas && /^Diluluskan: Cuti Tahunan 23 Dis/.test(balas.message), "Zuerin menerima pengesahan melalui WhatsApp");
  const { data: tk } = await db.from("approval_tasks").select("step_order, status, acted_via").order("step_order");
  expect(tk.some((t) => t.step_order === 1 && t.status === "approved" && t.acted_via === "whatsapp") &&
    tk.some((t) => t.step_order === 2 && t.status === "pending"), "peringkat 1 diluluskan melalui WhatsApp, kini di HR");

  log("4. Teks bebas dibalas dengan panduan");
  const before2 = outbox.length;
  const r3 = await (await fetch("http://127.0.0.1:8000/", {
    method: "POST", headers: { "x-webhook-secret": SECRET }, body: JSON.stringify({ from: "60100000004", text: "Berapa baki cuti saya?" }),
  })).json();
  expect(r3.tindakan === "ai" && /balas LULUS atau TOLAK/.test(outbox.slice(before2)[0]?.message ?? ""), "teks bebas → balasan panduan (agent AI dalam fasa kemudian)");

  wi.henti(); fake.close();
  log("LULUS: notify-sender & whatsapp-inbound");
  process.exit(0);
})().catch((e) => { console.error("GAGAL:", e.message); process.exit(1); });
