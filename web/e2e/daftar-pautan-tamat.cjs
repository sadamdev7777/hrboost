// Ujian hujung-ke-hujung: pautan pengesahan pendaftaran yang telah diganti (otp_expired).
//  1. Daftar (pelan Langgan terus) → e-mel pertama.
//  2. E-mel baharu dihantar (pautan pertama tidak sah lagi).
//  3. Buka pautan PERTAMA dalam tab baharu → mesej "Pautan pengesahan telah tamat atau digunakan" (bukan "Semak e-mel").
//  4. "Hantar pautan baharu" (e-mel ditaip semula) → pautan terbaharu → syarikat dicipta → halaman bayaran.
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000, Mailpit di 127.0.0.1:54324.
// Jalankan: node web/e2e/daftar-pautan-tamat.cjs
const os = require('os');
const { chromium } = require('playwright');
require('./_bahasa.cjs');
const { pautanEmel } = require('./_demo.cjs');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const shots = process.env.E2E_SHOTS || os.tmpdir();
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };
const EMEL = `tamat${Date.now()}@ujian.my`;

(async () => {
  const browser = await chromium.launch();

  log('1. Daftar pelan Langgan terus');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => log('   [ralat halaman]', e.message));
  await p.goto(BASE + '/daftar?pelan=tahunan');
  await p.fill('input[placeholder^="Contoh: Syarikat ABC"]', 'Syarikat Pautan Tamat Sdn Bhd');
  await p.fill('input[placeholder="Nama anda"]', 'Rina binti Salleh');
  await p.fill('input[type=email]', EMEL);
  await p.fill('input[autocomplete=new-password]', 'Rahsia123');
  await p.check('input[type=checkbox]');
  let mula = Date.now() - 2000;
  await p.click('button:has-text("Daftar & teruskan ke bayaran")');
  await p.waitForURL('**/daftar/sahkan');
  await p.waitForSelector('text=Jika anda menerima lebih daripada satu e-mel, gunakan yang terbaharu sahaja.');
  const pautan1 = await pautanEmel(EMEL, { selepas: mula });
  expect(true, 'e-mel pertama diterima; nota "gunakan yang terbaharu" dipaparkan');

  log('2. E-mel baharu dihantar → pautan pertama tidak sah lagi');
  await new Promise((s) => setTimeout(s, 1500));
  mula = Date.now();
  const r = await fetch('http://127.0.0.1:54321/auth/v1/resend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: process.env.E2E_ANON || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' },
    body: JSON.stringify({ type: 'signup', email: EMEL, options: { email_redirect_to: BASE + '/daftar/sahkan' } }),
  });
  expect(r.ok, `pautan baharu dihantar (HTTP ${r.status})`);
  const pautan2 = await pautanEmel(EMEL, { selepas: mula });
  expect(pautan2 !== pautan1, 'pautan kedua berbeza');

  log('3. Pautan pertama dibuka dalam tab baharu (tiada maklumat pendaftaran dalam tab)');
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const q = await ctx2.newPage();
  q.on('pageerror', (e) => log('   [ralat halaman]', e.message));
  await q.goto(pautan1);
  await q.waitForSelector('text=Pautan pengesahan telah tamat atau digunakan', { timeout: 20000 });
  expect(!q.url().includes('#'), 'ralat dibuang daripada URL');
  expect((await q.locator('text=Semak e-mel anda').count()) === 0, 'bukan lagi "Semak e-mel anda"');
  await q.screenshot({ path: `${shots}/pautan-tamat.png`, fullPage: true });

  log('4. Hantar pautan baharu dari halaman ralat → sahkan → halaman bayaran');
  await q.fill('input[type=email]', EMEL);
  await q.waitForTimeout(61000); // had Supabase: satu e-mel pengesahan setiap 60 saat bagi setiap alamat
  mula = Date.now();
  await q.click('button:has-text("Hantar pautan baharu")');
  await q.waitForSelector('text=Pautan baharu telah dihantar.', { timeout: 15000 }).catch(async (e) => { console.log(await q.innerText('main')); throw e; });
  const pautan3 = await pautanEmel(EMEL, { selepas: mula });
  expect(pautan3 !== pautan2, 'pautan ketiga diterima');
  // Dibuka dalam tab asal (pendaftaran asal masih dalam metadata pengguna)
  await p.goto(pautan3);
  await p.waitForURL('**/pengurusan/langganan?bayar=1', { timeout: 30000 });
  await p.waitForSelector('text=Lengkapkan langganan anda');
  expect(true, 'pautan terbaharu: syarikat dicipta dan terus ke halaman bayaran');

  await browser.close();
  log('\nLULUS: pautan pengesahan tamat');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
