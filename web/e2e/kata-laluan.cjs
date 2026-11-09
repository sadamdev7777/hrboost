// Ujian hujung-ke-hujung log masuk e-mel & kata laluan (TEMPATAN SAHAJA):
//  1. Amin log masuk dengan e-mel + kata laluan; kata laluan salah ditolak.
//  2. Zulfa (belum ada kata laluan) log masuk dengan OTP WhatsApp → wajib tetapkan e-mel & kata laluan;
//     e-mel yang sudah digunakan ditolak; selepas itu boleh log masuk dengan e-mel.
//  3. Lupa kata laluan: pautan e-mel (pelayan Resend PALSU) → 4 digit IC salah ditolak → betul → kata laluan
//     baharu berfungsi, pautan tidak boleh digunakan semula, kata laluan lama tidak lagi sah.
//  4. Amin menukar kata laluan di Profil.
// Edge Function password-reset dijalankan dengan Deno (port 8000); panggilan pelayar ke
// /functions/v1/password-reset dihalakan ke situ.
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000. Jalankan: node web/e2e/kata-laluan.cjs
const os = require('os');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');
const { chromium } = require('playwright');
require('./_bahasa.cjs');

const ROOT = path.join(__dirname, '../..');
const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const shots = process.env.E2E_SHOTS || os.tmpdir();
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const status = JSON.parse(execSync('npx supabase status -o json', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString());
if (!/127\.0\.0\.1|localhost/.test(status.API_URL)) throw new Error('Ujian ini untuk Supabase tempatan sahaja');
const psql = (sql) => execSync(`docker exec -i supabase_db_hrboost psql -U postgres -tAc "${sql.replace(/"/g, '\\"')}"`).toString().trim();

// ---- Resend palsu ----
const emel = [];
const fake = http.createServer((req, res) => {
  let b = '';
  req.on('data', (c) => (b += c));
  req.on('end', () => {
    emel.push({ auth: req.headers.authorization, body: JSON.parse(b || '{}') });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ id: 'emel_' + emel.length }));
  });
});

async function mulaFungsi() {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'hrb-fn-'));
  execSync(`cp -r ${path.join(ROOT, 'supabase/functions')}/* ${work}/`);
  fs.writeFileSync(path.join(work, 'deno.json'), JSON.stringify({ nodeModulesDir: 'auto' }));
  const env = {
    ...process.env,
    SUPABASE_URL: status.API_URL,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    RESEND_API_KEY: 'kunci-palsu',
    RESEND_API_URL: 'http://127.0.0.1:4013/emails',
    APP_URL: BASE,
    NODE_USE_ENV_PROXY: '1',
    NO_PROXY: '127.0.0.1,localhost',
  };
  const p = spawn('npx', ['-y', 'deno@2', 'run', '-A', 'password-reset/index.ts'], { cwd: work, env, detached: true });
  p.henti = () => { try { process.kill(-p.pid, 'SIGTERM'); } catch { /* sudah berhenti */ } };
  let out = '';
  p.stdout.on('data', (d) => (out += d));
  p.stderr.on('data', (d) => (out += d));
  for (let i = 0; i < 240; i++) {
    try { await fetch('http://127.0.0.1:8000/', { method: 'OPTIONS' }); return p; } catch { await sleep(500); }
  }
  p.henti();
  throw new Error('password-reset tidak bermula:\n' + out.slice(-800));
}

async function halaman(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('**/functions/v1/password-reset', async (route) => {
    const r = route.request();
    if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    const res = await fetch('http://127.0.0.1:8000/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: r.postData() });
    return route.fulfill({ status: res.status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: await res.text() });
  });
  const p = await ctx.newPage();
  await p.addInitScript(() => { const st = document.createElement('style'); st.textContent = '#nl-badge-frame{display:none!important}'; document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st)); });
  p.on('pageerror', (e) => log('   [ralat halaman]', e.message));
  return { ctx, p };
}

async function masukEmel(p, email, pw) {
  await p.goto(BASE + '/masuk');
  await p.fill('input[type=email]', email);
  await p.fill('input[autocomplete=current-password]', pw);
  await p.click('button[type=submit]');
}

(async () => {
  await new Promise((r) => fake.listen(4013, '127.0.0.1', r));
  const fn = await mulaFungsi();
  const browser = await chromium.launch();
  try {
    log('1. Amin: log masuk dengan e-mel & kata laluan');
    let { ctx, p } = await halaman(browser);
    await masukEmel(p, 'amin@demo.hrboost.io', 'salah123');
    await p.waitForSelector('text=E-mel atau kata laluan tidak betul');
    expect(true, 'kata laluan salah ditolak');
    await p.screenshot({ path: `${shots}/kl-masuk.png` });
    await p.fill('input[autocomplete=current-password]', 'Demo1234');
    await p.click('button[type=submit]');
    await p.waitForURL(/\/(utama|pengurusan)$/, { timeout: 15000 });
    expect(true, 'e-mel + kata laluan betul → Utama');
    await ctx.close();

    log('2. Zulfa: OTP WhatsApp kali pertama → wajib tetapkan e-mel & kata laluan');
    psql("update auth.users set email = null, encrypted_password = '' where id = '00000000-0000-0000-0000-00000000a006'");
    psql("delete from auth.identities where user_id = '00000000-0000-0000-0000-00000000a006' and provider = 'email'");
    ({ ctx, p } = await halaman(browser));
    await p.goto(BASE + '/masuk');
    await p.click('a:has-text("Log masuk dengan kod WhatsApp")');
    await p.waitForURL('**/masuk/telefon');
    await p.fill('input[type=tel]', '100000006');
    await p.click('button:has-text("Hantar kod")');
    await p.waitForURL('**/masuk/kod');
    await p.fill('input[autocomplete=one-time-code]', '123456');
    await p.waitForURL('**/akaun/kata-laluan**', { timeout: 15000 });
    await p.waitForSelector('text=Tetapkan e-mel & kata laluan');
    expect(true, 'selepas OTP pertama terus ke skrin wajib e-mel & kata laluan');
    await p.goto(BASE + '/cuti');
    await p.waitForURL('**/akaun/kata-laluan**', { timeout: 15000 });
    expect(true, 'halaman lain dikunci sehingga kata laluan ditetapkan');
    await p.screenshot({ path: `${shots}/kl-wajib.png` });
    const pw = p.locator('input[autocomplete=new-password]');
    await p.fill('input[type=email]', 'amin@demo.hrboost.io');
    await pw.nth(0).fill('Zulfa2026');
    await pw.nth(1).fill('Zulfa2027');
    await p.click('button:has-text("Simpan & teruskan")');
    await p.waitForSelector('text=Kedua-dua kata laluan tidak sama');
    await pw.nth(1).fill('Zulfa2026');
    await p.click('button:has-text("Simpan & teruskan")');
    await p.waitForSelector('text=E-mel ini telah digunakan oleh akaun lain');
    expect(true, 'kata laluan tidak sama & e-mel pendua ditolak');
    await p.fill('input[type=email]', 'Zulfa@Contoh.my');
    await p.click('button:has-text("Simpan & teruskan")');
    await p.waitForURL('**/cuti', { timeout: 15000 }).catch(async (e) => { log('   [alert]', JSON.stringify(await p.locator('[role=alert]').allInnerTexts()), p.url(), (await p.innerText('body')).slice(0,300)); throw e; });
    expect(true, 'disimpan → kembali ke halaman asal (/cuti)');
    expect(psql("select email from persons where id = '00000000-0000-0000-0000-000000000006'") === 'zulfa@contoh.my', 'e-mel rekod pekerja diselaraskan');
    await ctx.close();
    ({ ctx, p } = await halaman(browser));
    await masukEmel(p, 'zulfa@contoh.my', 'Zulfa2026');
    await p.waitForURL(/\/(utama|pengurusan)$/, { timeout: 15000 });
    expect(true, 'Zulfa log masuk dengan e-mel tanpa kod WhatsApp');
    await ctx.close();

    log('3. Lupa kata laluan (Zulfa)');
    ({ ctx, p } = await halaman(browser));
    await p.goto(BASE + '/masuk');
    await p.click('a:has-text("Lupa kata laluan?")');
    await p.waitForURL('**/masuk/lupa');
    await p.waitForSelector('h1:has-text("Lupa kata laluan")');
    await p.fill('input[type=email]', 'tiada@contoh.my');
    await p.click('button:has-text("Hantar pautan")');
    await p.waitForSelector('text=Semak e-mel anda');
    expect(emel.length === 0, 'e-mel tidak berdaftar: mesej sama, tiada e-mel dihantar');
    await p.goto(BASE + '/masuk/lupa');
    await p.fill('input[type=email]', 'zulfa@contoh.my');
    await p.click('button:has-text("Hantar pautan")');
    await p.waitForSelector('text=Semak e-mel anda');
    for (let i = 0; i < 20 && !emel.length; i++) await sleep(250);
    expect(emel.length === 1 && emel[0].body.to[0] === 'zulfa@contoh.my' && emel[0].auth === 'Bearer kunci-palsu', 'e-mel set semula dihantar melalui Resend');
    expect(/Tetapkan semula kata laluan/.test(emel[0].body.subject) && /Assalamualaikum Zulfa/.test(emel[0].body.text), 'subjek & kandungan dalam bahasa Melayu');
    const pautan = emel[0].body.text.match(/https?:\/\/\S+\/masuk\/set-semula\?t=[0-9a-f]{64}/)[0];
    expect(psql("select count(*) from password_resets where token_hash = '" + pautan.split('t=')[1] + "'") === '0', 'token disimpan sebagai cincangan sahaja');
    await p.goto(pautan);
    await p.fill('input[inputmode=numeric]', '1234');
    const npw = p.locator('input[autocomplete=new-password]');
    await npw.nth(0).fill('Baharu2026');
    await npw.nth(1).fill('Baharu2026');
    await p.click('button:has-text("Simpan kata laluan")');
    await p.waitForSelector('text=Baki cubaan: 4');
    expect(true, '4 digit IC salah ditolak (baki cubaan 4)');
    await p.screenshot({ path: `${shots}/kl-set-semula.png` });
    await p.fill('input[inputmode=numeric]', '6666');
    await p.click('button:has-text("Simpan kata laluan")');
    await p.waitForSelector('text=Kata laluan telah ditukar');
    expect(true, 'IC betul → kata laluan ditukar');
    await p.goto(pautan);
    await p.fill('input[inputmode=numeric]', '6666');
    await npw.nth(0).fill('Lagi20266');
    await npw.nth(1).fill('Lagi20266');
    await p.click('button:has-text("Simpan kata laluan")');
    await p.waitForSelector('text=Pautan tidak sah atau telah tamat tempoh');
    expect(true, 'pautan tidak boleh digunakan semula');
    await masukEmel(p, 'zulfa@contoh.my', 'Zulfa2026');
    await p.waitForSelector('text=E-mel atau kata laluan tidak betul');
    await p.fill('input[autocomplete=current-password]', 'Baharu2026');
    await p.click('button[type=submit]');
    await p.waitForURL(/\/(utama|pengurusan)$/, { timeout: 15000 });
    expect(true, 'kata laluan lama tidak sah; kata laluan baharu berfungsi');
    await ctx.close();

    log('4. Amin: tukar kata laluan di Profil');
    ({ ctx, p } = await halaman(browser));
    await masukEmel(p, 'amin@demo.hrboost.io', 'Demo1234');
    await p.waitForURL(/\/(utama|pengurusan)$/, { timeout: 15000 });
    await p.goto(BASE + '/profil');
    await p.click('a:has-text("E-mel & kata laluan")');
    await p.waitForURL('**/akaun/kata-laluan');
    expect((await p.inputValue('input[type=email]')) === 'amin@demo.hrboost.io', 'e-mel semasa dipaparkan');
    await p.locator('input[autocomplete=new-password]').nth(0).fill('Amin2026!');
    await p.locator('input[autocomplete=new-password]').nth(1).fill('Amin2026!');
    await p.click('button:has-text("Simpan")');
    await p.waitForSelector('text=Maklumat log masuk telah dikemas kini');
    await p.screenshot({ path: `${shots}/kl-profil.png` });
    expect(true, 'kata laluan ditukar dari Profil');
    psql("update auth.users set encrypted_password = extensions.crypt('Demo1234', extensions.gen_salt('bf')) where id = '00000000-0000-0000-0000-00000000a004'");
    await ctx.close();
    log('LULUS: log masuk e-mel & kata laluan');
  } finally {
    await browser.close();
    fn.henti();
    fake.close();
  }
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
