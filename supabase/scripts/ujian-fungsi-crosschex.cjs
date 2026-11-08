// Ujian integrasi Fasa E (TEMPATAN SAHAJA): Edge Function crosschex-sync dijalankan dengan Deno
// terhadap Supabase tempatan, dengan pelayan CrossChex PALSU. Tiada panggilan ke CrossChex sebenar.
//
// Prasyarat: `npx supabase db reset` (data demo), Deno (npx deno@2).
// Jalankan: node supabase/scripts/ujian-fungsi-crosschex.cjs
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
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error("SEMAKAN GAGAL: " + msg); log("   ✔ " + msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- CrossChex palsu ----
const calls = [];
let tokenKe = 0;
let luputSekali = false;
const today = new Date();
const ymd = today.toISOString().slice(0, 10);
const REKOD = [
  // Amin (workno 1004): masuk 9:22 pg MYT = 01:22 UTC, keluar 6:05 ptg = 10:05 UTC
  { uuid: "cc-1", checktime: `${ymd}T01:22:00+00:00`, checktype: 0, device: { serial_number: "SN1", name: "Pintu utama" }, employee: { workno: "1004" } },
  { uuid: "cc-2", checktime: `${ymd} 10:05:00`, checktype: 1, device: { serial_number: "SN1", name: "Pintu utama" }, employee: { workno: "1004" } },
  // ID mesin belum dipadankan
  { uuid: "cc-3", checktime: `${ymd}T00:55:00+00:00`, checktype: 0, device: { serial_number: "SN1" }, employee: { workno: "1023" } },
];
const fake = http.createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    const j = JSON.parse(b || "{}");
    calls.push(j);
    const send = (o) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    if (j.header?.nameSpace === "authorize.token") {
      if (j.payload?.api_key !== "KUNCI-UJIAN" || j.payload?.api_secret !== "RAHSIA-UJIAN") return send({ header: { nameSpace: "System" }, payload: { type: "AUTH_FAILED" } });
      tokenKe++;
      return send({ header: { nameSpace: "authorize.token", nameAction: "token" }, payload: { token: `tok-${tokenKe}`, expires: new Date(Date.now() + 3600e3).toISOString() } });
    }
    if (j.header?.nameSpace === "attendance.record") {
      if (luputSekali) { luputSekali = false; return send({ header: { nameSpace: "System" }, payload: { type: "TOKEN_EXPIRES" } }); }
      if (j.authorize?.token !== `tok-${tokenKe}`) return send({ header: { nameSpace: "System" }, payload: { type: "TOKEN_EXPIRES" } });
      const page = j.payload.page;
      const list = page === 1 ? REKOD.slice(0, 2) : page === 2 ? REKOD.slice(2) : [];
      return send({ header: { nameSpace: "attendance.record", nameAction: "getrecord" }, payload: { count: REKOD.length, page, pageCount: 2, list } });
    }
    send({ header: { nameSpace: "System" }, payload: { type: "UNKNOWN" } });
  });
});

const work = fs.mkdtempSync(path.join(os.tmpdir(), "hrb-fn-"));
execSync(`cp -r ${path.join(ROOT, "supabase/functions")}/* ${work}/`);
fs.writeFileSync(path.join(work, "deno.json"), JSON.stringify({ nodeModulesDir: "auto" }));

async function jalankan(fn, port = 8000) {
  const env = {
    ...process.env,
    SUPABASE_URL: URL_,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE,
    SUPABASE_ANON_KEY: ANON,
    CROSSCHEX_URL_OVERRIDE: "http://127.0.0.1:4011",
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
      await fetch(`http://127.0.0.1:${port}/`, { method: "OPTIONS" });
      p.out = () => out;
      return p;
    } catch {
      await sleep(500);
    }
  }
  p.henti();
  throw new Error(`${fn} tidak bermula:\n${out.slice(-800)}`);
}

(async () => {
  await new Promise((r) => fake.listen(4011, "127.0.0.1", r));
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const lily = createClient(URL_, ANON, { auth: { persistSession: false } });
  await lily.auth.verifyOtp({ phone: "60100000002", token: "123456", type: "sms" });
  const amin = createClient(URL_, ANON, { auth: { persistSession: false } });
  await amin.auth.verifyOtp({ phone: "60100000004", token: "123456", type: "sms" });
  const lilyJwt = (await lily.auth.getSession()).data.session.access_token;
  const aminJwt = (await amin.auth.getSession()).data.session.access_token;

  log("1. Lily (HR) simpan kunci CrossChex & padankan Amin = 1004");
  let r = await lily.rpc("set_attendance_integration", { p_company: COMPANY, p_api_url: "https://api.eu.crosschexcloud.com", p_key: "KUNCI-UJIAN", p_secret: "RAHSIA-UJIAN", p_minutes: 5 });
  expect(!r.error, "kunci disimpan dalam Vault " + (r.error?.message ?? ""));
  r = await lily.rpc("match_attendance_workno", { p_employment: "00000000-0000-0000-0000-0000000000e4", p_workno: "1004" });
  expect(!r.error, "workno 1004 dipadankan kepada Amin");
  const { data: raw } = await db.from("attendance_integrations").select("*").eq("company_id", COMPANY).single();
  expect(!JSON.stringify(raw).includes("KUNCI-UJIAN"), "kunci tidak disimpan sebagai teks biasa dalam jadual");
  const st0 = (await lily.rpc("attendance_integration_status", { p_company: COMPANY })).data;
  expect(st0.configured && !JSON.stringify(st0).includes("RAHSIA"), "status integrasi tanpa rahsia");

  const fn = await jalankan("crosschex-sync");
  try {
    log("2. Keselamatan: pekerja biasa tidak boleh mencetuskan tarikan");
    let res = await fetch("http://127.0.0.1:8000/", { method: "POST", headers: { Authorization: `Bearer ${aminJwt}`, "content-type": "application/json" }, body: JSON.stringify({ company_id: COMPANY, mode: "pull" }) });
    expect(res.status === 403, "Amin ditolak (403)");
    res = await fetch("http://127.0.0.1:8000/", { method: "POST" });
    expect(res.status === 401, "tanpa kunci ditolak (401)");

    log("3. Lily: Uji sambungan");
    res = await fetch("http://127.0.0.1:8000/", { method: "POST", headers: { Authorization: `Bearer ${lilyJwt}`, "content-type": "application/json" }, body: JSON.stringify({ company_id: COMPANY, mode: "test" }) });
    let j = await res.json();
    expect(j.ok === true, "ujian sambungan berjaya: " + j.message);

    log("4. pg_cron (service role): tarik semua syarikat yang tiba masanya");
    await db.from("attendance_integrations").update({ next_run_at: new Date(Date.now() - 1000).toISOString() }).eq("company_id", COMPANY);
    res = await fetch("http://127.0.0.1:8000/", { method: "POST", headers: { Authorization: `Bearer ${SERVICE}` } });
    j = await res.json();
    expect(j.syarikat === 1 && j.hasil[0].records === 3, "3 rekod ditarik (2 halaman): " + JSON.stringify(j.hasil[0]));
    expect(calls.filter((c) => c.header?.nameSpace === "authorize.token").length === 1, "token diguna semula (satu permintaan token sahaja)");
    const { data: rec } = await db.from("attendance_records").select("clock_in, clock_out, late_minutes").eq("employment_id", "00000000-0000-0000-0000-0000000000e4").eq("work_date", ymd).single();
    expect(rec && rec.clock_out && rec.late_minutes === 22, `rekod kehadiran Amin dibina (lewat ${rec?.late_minutes} minit)`);
    const st = (await lily.rpc("attendance_integration_status", { p_company: COMPANY })).data;
    expect(st.unmatched.length === 1 && st.unmatched[0].workno === "1023", "ID mesin 1023 belum dipadankan dipaparkan");

    log("5. Token luput → diperbaharui; tarikan berulang tidak menggandakan rekod");
    luputSekali = true;
    res = await fetch("http://127.0.0.1:8000/", { method: "POST", headers: { Authorization: `Bearer ${lilyJwt}`, "content-type": "application/json" }, body: JSON.stringify({ company_id: COMPANY, mode: "pull" }) });
    j = await res.json();
    expect(j.ok === true, "tarikan selepas token luput berjaya: " + j.message);
    const { count } = await db.from("attendance_punches").select("*", { count: "exact", head: true }).eq("company_id", COMPANY);
    expect(count === 3, "imbasan tidak berganda (3)");
    const log2 = (await lily.rpc("attendance_integration_status", { p_company: COMPANY })).data.log.map((l) => l.message);
    expect(log2.some((m) => /Token luput/.test(m)), "log: Token luput → diperbaharui");

    log("6. Kunci salah direkodkan sebagai ralat");
    await lily.rpc("set_attendance_integration", { p_company: COMPANY, p_api_url: "https://api.eu.crosschexcloud.com", p_key: "SALAH", p_secret: "SALAH", p_minutes: 15 });
    res = await fetch("http://127.0.0.1:8000/", { method: "POST", headers: { Authorization: `Bearer ${lilyJwt}`, "content-type": "application/json" }, body: JSON.stringify({ company_id: COMPANY, mode: "test" }) });
    j = await res.json();
    expect(j.ok === false && /AUTH_FAILED/.test(j.message), "ralat: " + j.message);
  } finally {
    fn.henti();
    fake.close();
  }
  log("LULUS: crosschex-sync");
  process.exit(0);
})().catch((e) => { console.error("GAGAL:", e.message); process.exit(1); });
