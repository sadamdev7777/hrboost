// Ujian integrasi AI (TEMPATAN SAHAJA): ai-receipt, ai-ic, pembantu-ai dijalankan dengan Deno terhadap
// Supabase tempatan dan pelayan Claude API PALSU (ANTHROPIC_BASE_URL). Tiada panggilan AI sebenar / kos.
// Prasyarat: `npx supabase db reset` (data demo), Deno (npx deno@2).
// Jalankan: node supabase/scripts/ujian-fungsi-ai.cjs
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
const COMPANY = "00000000-0000-0000-0000-0000000000c1";
const AMIN = "00000000-0000-0000-0000-000000000004";
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error("SEMAKAN GAGAL: " + msg); log("   ✔ " + msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Claude API palsu: merekod permintaan & memberi jawapan berskrip ----
const calls = [];
let skrip = [];
const fake = http.createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    const j = JSON.parse(b || "{}");
    calls.push({ url: req.url, headers: req.headers, body: j });
    const next = skrip.shift() ?? { stop_reason: "end_turn", content: [{ type: "text", text: "OK" }] };
    res.writeHead(200, { "content-type": "application/json", "request-id": "req_palsu" });
    res.end(JSON.stringify({ id: "msg_" + calls.length, type: "message", role: "assistant", model: j.model, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 }, ...next }));
  });
});

const work = fs.mkdtempSync(path.join(os.tmpdir(), "hrb-fn-"));
execSync(`cp -r ${path.join(ROOT, "supabase/functions")}/* ${work}/`);
fs.writeFileSync(path.join(work, "deno.json"), JSON.stringify({ nodeModulesDir: "auto" }));

async function jalankan(fn) {
  const env = {
    ...process.env,
    SUPABASE_URL: URL_,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE,
    SUPABASE_ANON_KEY: ANON,
    ANTHROPIC_API_KEY: "kunci-palsu",
    ANTHROPIC_BASE_URL: "http://127.0.0.1:4012",
    NODE_USE_ENV_PROXY: "1",
    NO_PROXY: "127.0.0.1,localhost",
  };
  const p = spawn("npx", ["-y", "deno@2", "run", "-A", `${fn}/index.ts`], { cwd: work, env, detached: true });
  p.henti = () => { try { process.kill(-p.pid, "SIGTERM"); } catch { /* sudah berhenti */ } };
  let out = "";
  p.stdout.on("data", (d) => (out += d));
  p.stderr.on("data", (d) => (out += d));
  for (let i = 0; i < 240; i++) {
    try {
      await fetch("http://127.0.0.1:8000/", { method: "OPTIONS" });
      return p;
    } catch {
      await sleep(500);
    }
  }
  p.henti();
  throw new Error(`${fn} tidak bermula:\n${out.slice(-800)}`);
}
const post = (jwt, body) => fetch("http://127.0.0.1:8000/", { method: "POST", headers: { Authorization: `Bearer ${jwt}`, "content-type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));

(async () => {
  await new Promise((r) => fake.listen(4012, "127.0.0.1", r));
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const amin = createClient(URL_, ANON, { auth: { persistSession: false } });
  await amin.auth.verifyOtp({ phone: "60100000004", token: "123456", type: "sms" });
  const jwt = (await amin.auth.getSession()).data.session.access_token;
  const lily = createClient(URL_, ANON, { auth: { persistSession: false } });
  await lily.auth.verifyOtp({ phone: "60100000002", token: "123456", type: "sms" });
  const jwtLily = (await lily.auth.getSession()).data.session.access_token;
  // resit kecil (PNG 1x1) dalam folder Amin
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const resit = `${AMIN}/resit-ujian.png`;
  await db.storage.from("peribadi").upload(resit, png, { contentType: "image/png", upsert: true });

  let fn = await jalankan("ai-receipt");
  try {
    log("1. ai-receipt");
    skrip = [{ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ merchant: "KLIA2 Parking", date: "2026-11-05", amount: 24.5, currency: "MYR", claim_type: "Parking & Tol", purpose: "Letak kereta KLIA2", readable: true }) }] }];
    let r = await post(jwt, { path: resit, company_id: COMPANY });
    expect(r.ok && r.amount === 24.5 && r.claim_type === "Parking & Tol", "resit dibaca: RM24.50, Letak kereta & Tol");
    const c = calls[calls.length - 1];
    expect(c.body.model === "claude-opus-5-5" && c.body.output_config?.format?.type === "json_schema", "model claude-opus-5-5 + output berstruktur JSON");
    expect(c.body.fallbacks === "default" && String(c.headers["anthropic-beta"]).includes("server-side-fallback-2026-07-01"), "sandaran pelayan (fallbacks: default) dihidupkan");
    expect(c.body.messages[0].content[0].type === "image", "gambar resit dihantar sebagai blok imej");
    r = await post(jwt, { path: `00000000-0000-0000-0000-000000000002/x.png`, company_id: COMPANY });
    expect(r.status === 403, "resit dalam folder orang lain ditolak (403)");
    skrip = [{ stop_reason: "refusal", stop_details: { type: "refusal", category: null, explanation: null }, content: [] }];
    r = await post(jwt, { path: resit, company_id: COMPANY });
    expect(r.status === 422 && r.code === "ditolak", "penolakan model ditangani (422)");
    const { data: u } = await db.from("usage_counters").select("ai_calls").eq("company_id", COMPANY);
    expect((u?.[0]?.ai_calls ?? 0) >= 2, `penggunaan AI dikira (${u?.[0]?.ai_calls})`);
  } finally {
    fn.henti();
    await sleep(800);
  }

  fn = await jalankan("pembantu-ai");
  try {
    log("2. pembantu-ai: baki cuti (alat diskopkan kepada Amin)");
    skrip = [
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "tu1", name: "baki_cuti", input: {} }] },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Baki cuti tahunan anda ialah 8 hari." }] },
    ];
    const n0 = calls.length;
    let r = await post(jwt, { mesej: "Berapakah baki cuti saya?", company_id: COMPANY });
    expect(r.ok && /8 hari/.test(r.balasan) && r.conversation_id, "balasan: " + r.balasan);
    const kedua = calls[n0 + 1].body;
    const hasilAlat = kedua.messages[kedua.messages.length - 1].content[0];
    expect(hasilAlat.type === "tool_result" && /Cuti Tahunan/.test(hasilAlat.content), "hasil alat baki_cuti dihantar semula kepada model");
    expect(kedua.tools.every((t) => t.strict === true) && /bahasa Melayu rasmi/.test(kedua.system), "alat strict + arahan sistem BM rasmi");

    log("3. pembantu-ai: mohon cuti bagi pihak pekerja (selepas pengesahan)");
    const tarikh = new Date(Date.now() + 30 * 86400e3);
    while ([0, 6].includes(tarikh.getDay())) tarikh.setDate(tarikh.getDate() + 1);
    const t = tarikh.toISOString().slice(0, 10);
    skrip = [
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "tu2", name: "mohon_cuti", input: { kod: "AL", mula: t, tamat: t, separuh_hari: "full", sebab: "Urusan keluarga", sahkan: true } }] },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Permohonan cuti anda telah dihantar." }] },
    ];
    r = await post(jwt, { mesej: "Ya, sahkan.", company_id: COMPANY, conversation_id: r.conversation_id });
    expect(r.ok, "balasan: " + r.balasan);
    const { data: lr } = await db.from("leave_requests").select("status, created_via").eq("start_date", t).eq("employment_id", "00000000-0000-0000-0000-0000000000e4");
    expect(lr?.[0]?.status === "pending" && lr[0].created_via === "ai_agent", "permohonan cuti dicipta melalui ai_agent, menunggu kelulusan");
    const { data: acts } = await amin.rpc("my_ai_actions", { p_limit: 5 });
    expect(acts?.[0]?.action === "submit_leave", "tindakan ejen direkodkan (my_ai_actions)");
    const { data: msgs } = await db.from("ai_messages").select("role").eq("conversation_id", r.conversation_id);
    expect(msgs?.length === 4, "perbualan disimpan (4 mesej)");

    log("4. pembantu-ai: soalan polisi tanpa jawapan → direkod untuk HR");
    skrip = [
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "tu3", name: "cari_polisi", input: { soalan: "cuti haji berapa hari" } }] },
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "tu4", name: "catat_soalan_tidak_terjawab", input: { soalan: "Berapa hari cuti haji?" } }] },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Maaf, saya tidak pasti. Sila tanya HR." }] },
    ];
    r = await post(jwt, { mesej: "Berapa hari cuti haji?", company_id: COMPANY });
    const { data: uq } = await lily.rpc("kb_unanswered", { p_company: COMPANY });
    expect(uq?.some((x) => /cuti haji/i.test(x.question)), "soalan tidak terjawab kelihatan kepada HR");

    log("5. Draf surat (HR sahaja)");
    skrip = [{ stop_reason: "end_turn", content: [{ type: "text", text: "SURAT PENGESAHAN JAWATAN\n\nAmin bin Demo ..." }] }];
    r = await post(jwtLily, { mode: "surat", employment_id: "00000000-0000-0000-0000-0000000000e4", jenis: "Pengesahan jawatan", nota: "" });
    expect(r.ok && /SURAT PENGESAHAN/.test(r.surat), "HR menerima draf surat");
    r = await post(jwt, { mode: "surat", employment_id: "00000000-0000-0000-0000-0000000000e2", jenis: "Amaran", nota: "" });
    expect(r.status === 403, "pekerja biasa tidak boleh menjana surat (403)");
  } finally {
    fn.henti();
    fake.close();
  }
  log("LULUS: fungsi AI");
  process.exit(0);
})().catch((e) => { console.error("GAGAL:", e.message); process.exit(1); });
