// Ujian hujung-ke-hujung log masuk e-mel & kata laluan (TEMPATAN SAHAJA):
//  1. Amin log masuk dengan e-mel + kata laluan; kata laluan salah ditolak.
//  2. Akaun baharu yang belum mengesahkan e-mel: log masuk ditolak dengan mesej jelas + hantar semula pautan.
//  3. Lupa kata laluan: pautan e-mel (Supabase Auth, Mailpit tempatan) → kata laluan baharu → terus log masuk;
//     kata laluan lama tidak lagi sah; pautan tidak boleh digunakan semula; e-mel tidak berdaftar tidak mendedahkan apa-apa.
//  4. Amin menukar kata laluan di Profil.
// Prasyarat: `npx supabase db reset` (enable_confirmations = true), aplikasi di localhost:3000, Mailpit 127.0.0.1:54324.
// Jalankan: node web/e2e/kata-laluan.cjs
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');
require('./_bahasa.cjs');
const { pautanEmel } = require('./_demo.cjs');

const ROOT = path.join(__dirname, '../..');
const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const shots = process.env.E2E_SHOTS || os.tmpdir();
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };
const status = JSON.parse(execSync('npx supabase status -o json', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString());
if (!/127\.0\.0\.1|localhost/.test(status.API_URL)) throw new Error('Ujian ini untuk Supabase tempatan sahaja');
const psql = (sql) => execSync(`docker exec -i supabase_db_hrboost psql -U postgres -tAc "${sql.replace(/"/g, '\\"')}"`).toString().trim();

async function halaman(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
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

    log('2. Akaun baharu belum disahkan');
    const sb = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false } });
    const mula2 = Date.now() - 2000;
    const su = await sb.auth.signUp({ email: 'baru@contoh.my', password: 'Rahsia123' });
    expect(!su.error && !su.data.session, 'daftar: tiada sesi sehingga e-mel disahkan');
    await pautanEmel('baru@contoh.my', { selepas: mula2 });
    ({ ctx, p } = await halaman(browser));
    await masukEmel(p, 'baru@contoh.my', 'Rahsia123');
    await p.waitForSelector('text=E-mel anda belum disahkan');
    await p.waitForTimeout(2500); // Supabase: had kekerapan e-mel bagi setiap alamat
    const mula2b = Date.now() - 1000;
    await p.click('button:has-text("Hantar semula pautan pengesahan")');
    await p.waitForSelector('text=Pautan pengesahan telah dihantar semula');
    await pautanEmel('baru@contoh.my', { selepas: mula2b });
    expect(true, 'log masuk ditolak dengan mesej jelas; pautan pengesahan dihantar semula');
    await ctx.close();

    log('3. Lupa kata laluan (Zulfa)');
    ({ ctx, p } = await halaman(browser));
    await p.goto(BASE + '/masuk');
    await p.click('a:has-text("Lupa kata laluan?")');
    await p.waitForURL('**/masuk/lupa');
    await p.fill('input[type=email]', 'tiada@contoh.my');
    await p.click('button:has-text("Hantar pautan")');
    await p.waitForSelector('text=Semak e-mel anda');
    const tiada = await pautanEmel('tiada@contoh.my', { tunggu: 3000 }).then(() => true).catch(() => false);
    expect(!tiada, 'e-mel tidak berdaftar: mesej sama, tiada e-mel dihantar');
    await p.goto(BASE + '/masuk/lupa');
    await p.fill('input[type=email]', 'zulfa@demo.hrboost.io');
    const mula3 = Date.now() - 2000;
    await p.click('button:has-text("Hantar pautan")');
    await p.waitForSelector('text=Semak e-mel anda');
    const pautan = await pautanEmel('zulfa@demo.hrboost.io', { selepas: mula3 });
    expect(/type=recovery/.test(pautan), 'pautan set semula kata laluan diterima dalam e-mel');
    await ctx.close();
    ({ ctx, p } = await halaman(browser));
    await p.goto(pautan);
    await p.waitForSelector('text=Tetapkan kata laluan baharu');
    const pw = p.locator('input[autocomplete=new-password]');
    await pw.nth(0).fill('Zulfa2026');
    await pw.nth(1).fill('Zulfa2027');
    await p.click('button:has-text("Simpan kata laluan")');
    await p.waitForSelector('text=Kedua-dua kata laluan tidak sama');
    await pw.nth(1).fill('Zulfa2026');
    await p.click('button:has-text("Simpan kata laluan")');
    await p.waitForURL(/\/(utama|pengurusan)$/, { timeout: 15000 });
    expect(true, 'kata laluan baharu disimpan → terus log masuk');
    await p.screenshot({ path: `${shots}/kl-set-semula.png` });
    await ctx.close();
    ({ ctx, p } = await halaman(browser));
    await masukEmel(p, 'zulfa@demo.hrboost.io', 'Demo1234');
    await p.waitForSelector('text=E-mel atau kata laluan tidak betul');
    expect(true, 'kata laluan lama tidak lagi sah');
    await masukEmel(p, 'zulfa@demo.hrboost.io', 'Zulfa2026');
    await p.waitForURL(/\/(utama|pengurusan)$/, { timeout: 15000 });
    expect(true, 'log masuk dengan kata laluan baharu');
    await ctx.close();
    ({ ctx, p } = await halaman(browser));
    await p.goto(pautan);
    await p.waitForSelector('text=Pautan tidak sah atau telah tamat', { timeout: 15000 });
    expect(true, 'pautan tidak boleh digunakan semula');
    await ctx.close();
    psql("update auth.users set encrypted_password = extensions.crypt('Demo1234', extensions.gen_salt('bf')) where id = '00000000-0000-0000-0000-00000000a006'");

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
  }
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
