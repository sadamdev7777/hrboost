// Ujian hujung-ke-hujung Fasa E: Amin lihat kehadiran & mohon pembetulan masa → Zuerin lulus →
// rekod dibetulkan; Lily (HR) sambung CrossChex (kunci ke Vault, tidak dipaparkan semula).
// Prasyarat: `npx supabase db reset` (data demo minggu ini), aplikasi di localhost:3000.
// Jalankan: node web/e2e/kehadiran.cjs
const os = require('os');
const { chromium } = require('playwright');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const shots = process.env.E2E_SHOTS || os.tmpdir();
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };

async function login(browser, phone) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.addInitScript(() => { const st = document.createElement('style'); st.textContent = '#nl-badge-frame{display:none!important}'; document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st)); });
  p.on('pageerror', (e) => log('   [ralat halaman]', e.message));
  await p.goto(BASE + '/masuk/telefon');
  await p.fill('input[type=tel]', phone);
  await p.click('button:has-text("Hantar kod")');
  await p.waitForURL('**/masuk/kod');
  await p.fill('input[autocomplete=one-time-code]', '123456');
  await p.waitForURL(/\/(utama|pengurusan)$/, { timeout: 15000 });
  return { ctx, p };
}

(async () => {
  const browser = await chromium.launch();

  log('1. Amin: Kehadiran & Betulkan masa');
  const amin = await login(browser, '100000004');
  let p = amin.p;
  await p.goto(BASE + '/kehadiran');
  await p.waitForSelector('text=Hari hadir');
  await p.waitForSelector('a:has-text("Betulkan")');
  await p.screenshot({ path: `${shots}/e-kehadiran.png` });
  const n0 = await p.locator('a:has-text("Betulkan")').count();
  expect(n0 > 0, `${n0} hari boleh dibetulkan (tiada daftar keluar / lewat)`);
  await p.locator('a:has-text("Betulkan")').first().click();
  await p.waitForURL('**/kehadiran/betulkan?tarikh=*');
  await p.waitForSelector('text=REKOD MESIN');
  const tarikh = new URL(p.url()).searchParams.get('tarikh');
  await p.click('button:has-text("Bertugas di luar pejabat")');
  await p.fill('input[placeholder^="Contoh: berjumpa"]', 'Berjumpa pelanggan di KLIA');
  await p.screenshot({ path: `${shots}/e-betulkan.png` });
  await p.click('button:has-text("Hantar permohonan")');
  await p.waitForURL('**/kehadiran');
  await p.waitForSelector('text=Menunggu');
  expect(true, `pembetulan ${tarikh} dihantar, menunggu kelulusan`);

  log('2. Zuerin (Ketua Jabatan) meluluskan');
  const z = await login(browser, '100000003');
  await z.p.goto(BASE + '/kelulusan');
  await z.p.click('main a[href^="/kelulusan/"]:has-text("Betulkan masa")');
  await z.p.waitForSelector('text=Masuk sebenar');
  await z.p.waitForSelector('text=Bertugas di luar pejabat: Berjumpa pelanggan di KLIA');
  await z.p.screenshot({ path: `${shots}/e-lulus.png` });
  await z.p.click('button:has-text("Lulus")');
  await z.p.waitForURL('**/kelulusan');
  expect(true, 'Zuerin meluluskan pembetulan masa');
  await z.ctx.close();

  log('3. Amin: rekod dibetulkan');
  await p.reload();
  await p.waitForSelector('text=Dibetulkan');
  expect(true, 'hari itu ditanda Dibetulkan, lewat dibatalkan');
  await amin.ctx.close();

  log('4. Lily (HR): sambung CrossChex');
  const l = await login(browser, '100000002');
  p = l.p;
  await p.goto(BASE + '/pengurusan/tetapan/kehadiran');
  await p.waitForSelector('text=Belum disambung');
  await p.click('button:has-text("Isi")');
  await p.fill('[role=dialog] label:has-text("Kunci API") input', 'KUNCI-DEMO-123');
  await p.fill('[role=dialog] label:has-text("Rahsia API") input', 'RAHSIA-DEMO-456');
  await p.click('[role=dialog] button:has-text("Simpan")');
  await p.waitForSelector('[role=dialog]', { state: 'detached' });
  await p.waitForSelector('text=Belum ditarik');
  const t = await p.innerText('main');
  expect(!t.includes('KUNCI-DEMO') && !t.includes('RAHSIA-DEMO') && t.includes('••••••••'), 'kunci disimpan dan tidak dipaparkan semula');
  await p.click('button:has-text("15 min")');
  await p.waitForSelector('button.bg-primary:has-text("15 min")');
  expect(true, 'kekerapan tarikan ditukar kepada 15 minit');
  await p.screenshot({ path: `${shots}/e-integrasi.png` });
  await l.ctx.close();
  await browser.close();
  log('LULUS: kehadiran & pembetulan masa');
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
