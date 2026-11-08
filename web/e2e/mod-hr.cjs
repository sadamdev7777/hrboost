// Ujian hujung-ke-hujung Mod HR, paparan desktop & Gaji Pekerja (TEMPATAN SAHAJA):
//  1. Lily (HR) di desktop: terus ke Papan Pemuka, menu sisi, jadual pekerja.
//  2. Gaji Pekerja: ubah gaji seorang (lembaran), ubah ramai sekali gus, jenis elaun baharu.
//  3. Proses Gaji menggunakan gaji & elaun baharu (slip Amin).
//  4. Telefon: tab Mod HR, tukar ke Mod Pekerja dan kembali.
//  5. Amin (pekerja biasa): tiada Mod HR, Gaji Pekerja disekat.
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000. Jalankan: node web/e2e/mod-hr.cjs
const os = require('os');
const { chromium } = require('playwright');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const shots = process.env.E2E_SHOTS || os.tmpdir();
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };
const V = (s) => `${s} >> visible=true`;

async function masuk(browser, email, viewport) {
  const ctx = await browser.newContext({ viewport });
  const p = await ctx.newPage();
  await p.addInitScript(() => { const st = document.createElement('style'); st.textContent = '#nl-badge-frame{display:none!important}'; document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st)); });
  p.on('pageerror', (e) => log('   [ralat halaman]', e.message));
  await p.goto(BASE + '/masuk');
  await p.fill('input[type=email]', email);
  await p.fill('input[autocomplete=current-password]', 'Demo1234');
  await p.click('button[type=submit]');
  return { ctx, p };
}
const navMobile = async (p) => (await p.locator('nav.sticky >> visible=true').locator('a').allInnerTexts()).map((x) => x.trim());

(async () => {
  const browser = await chromium.launch();
  const DESKTOP = { width: 1440, height: 900 };
  const TELEFON = { width: 390, height: 844 };

  log('1. Lily (HR) — desktop');
  let { ctx, p } = await masuk(browser, 'lily@demo.hrboost.io', DESKTOP);
  await p.waitForURL('**/pengurusan', { timeout: 20000 });
  await p.waitForSelector('text=PERLU PERHATIAN');
  expect(true, 'HR terus ke Papan Pemuka selepas log masuk');
  const sisi = await p.locator('aside').innerText();
  expect(['Papan Pemuka', 'Pekerja', 'Kelulusan', 'Gaji', 'Gaji Pekerja', 'Tetapan', 'Tukar ke Mod Pekerja'].every((t) => sisi.includes(t)), 'menu sisi desktop: menu HR + suis mod');
  expect(!(await p.locator('nav.sticky').isVisible()), 'navigasi bawah disorok di desktop');
  await p.screenshot({ path: `${shots}/hr-papan-desktop.png` });
  await p.click('aside a:has-text("Pekerja") >> nth=0');
  await p.waitForURL('**/pengurusan/pekerja');
  await p.waitForSelector(V('table >> text=NO. PEKERJA'));
  expect((await p.locator('table tbody tr').count()) === 6, 'jadual pekerja (6 baris) di desktop');

  log('2. Gaji Pekerja');
  await p.click('aside a:has-text("Gaji Pekerja")');
  await p.waitForURL('**/pengurusan/gaji/pekerja');
  await p.waitForSelector(V('text=Jumlah tetap sebulan'));
  await p.locator('tr', { hasText: 'Amin' }).locator('button:has-text("Ubah")').click();
  await p.waitForSelector('[role=dialog] >> text=Gaji Amin');
  await p.fill('[role=dialog] label:has-text("Gaji Pokok") input', '3500');
  await p.fill('[role=dialog] label:has-text("Elaun Tetap") input', '250');
  await p.screenshot({ path: `${shots}/hr-ubah-gaji.png` });
  await p.click('[role=dialog] button:has-text("Simpan gaji")');
  await p.waitForSelector('[role=dialog]', { state: 'detached' });
  await p.waitForSelector(V('tr:has-text("Amin") >> text=RM 3,750.00'));
  expect(true, 'gaji Amin dikemas kini: pokok 3,500 + elaun 250 = RM 3,750.00');

  await p.click('button:has-text("Ubah ramai sekali gus")');
  await p.fill('input[aria-label="Gaji Pokok Zulfa"]', '3000');
  await p.fill('input[aria-label="Elaun Tetap Farah"]', '150');
  await p.screenshot({ path: `${shots}/hr-ubah-ramai.png` });
  await p.click('button:has-text("Simpan semua")');
  await p.waitForSelector(V('tr:has-text("Zulfa") >> text=RM 3,000.00'));
  await p.waitForSelector(V('tr:has-text("Farah") >> text=RM 5,350.00'));
  expect(true, 'ubah ramai: Zulfa RM 3,000.00, Farah + elaun RM 5,350.00');

  await p.click('button:has-text("+ Jenis elaun")');
  await p.fill('[role=dialog] input[placeholder="Contoh: Elaun Telefon"]', 'Elaun Telefon');
  await p.click('[role=dialog] button:has-text("Tambah")');
  await p.waitForSelector(V('th:has-text("ELAUN TELEFON")'));
  expect(true, 'jenis elaun baharu menjadi lajur jadual');
  await p.screenshot({ path: `${shots}/hr-gaji-pekerja-desktop.png` });

  log('3. Proses Gaji menggunakan gaji baharu');
  await p.click('aside a:has-text("Gaji") >> nth=0');
  await p.waitForURL('**/pengurusan/gaji');
  await p.waitForSelector('text=Semak data');
  await p.click('button:has-text("Kira Gaji")');
  await p.waitForSelector('text=Jumlah kasar', { timeout: 30000 });
  await p.click('button:has-text("Lihat semua")');
  await p.click('a:has-text("Amin · DEMO004")');
  await p.waitForSelector('text=SLIP GAJI');
  await p.waitForTimeout(1000);
  const slip = await p.innerText('article');
  expect(slip.includes('3,500.00') && slip.includes('Elaun Tetap') && slip.includes('250.00'), 'slip Amin: gaji pokok 3,500.00 + Elaun Tetap 250.00');
  await ctx.close();

  log('4. Lily — telefon: tab Mod HR & tukar mod');
  ({ ctx, p } = await masuk(browser, 'lily@demo.hrboost.io', TELEFON));
  await p.waitForURL('**/pengurusan', { timeout: 20000 });
  await p.waitForSelector('text=PERLU PERHATIAN');
  let tab = await navMobile(p);
  expect(JSON.stringify(tab) === JSON.stringify(['Utama', 'Pekerja', 'Kelulusan', 'Gaji', 'Saya']), `tab Mod HR: ${tab.join(', ')}`);
  await p.screenshot({ path: `${shots}/hr-papan-telefon.png` });
  await p.click(V('nav.sticky a:has-text("Saya")'));
  await p.waitForURL('**/saya');
  await p.click(V('button:has-text("Tukar ke Mod Pekerja")'));
  await p.waitForURL('**/utama');
  await p.waitForSelector('text=Baki cuti tahunan');
  tab = await navMobile(p);
  expect(JSON.stringify(tab) === JSON.stringify(['Utama', 'Mohon', 'Kelulusan', 'Saya']), 'Mod Pekerja: 4 tab pekerja ' + JSON.stringify(tab));
  await p.reload();
  await p.waitForSelector('text=Baki cuti tahunan');
  expect(p.url().endsWith('/utama'), 'mod disimpan selepas muat semula');
  await p.click(V('nav.sticky a:has-text("Saya")'));
  await p.click(V('button:has-text("Tukar ke Mod HR")'));
  await p.waitForURL('**/pengurusan');
  expect(true, 'kembali ke Mod HR');
  await ctx.close();

  log('5. Amin (pekerja biasa)');
  ({ ctx, p } = await masuk(browser, 'amin@demo.hrboost.io', TELEFON));
  await p.waitForURL('**/utama', { timeout: 20000 });
  await p.waitForSelector('text=Baki cuti tahunan');
  tab = await navMobile(p);
  expect(tab.length === 4, 'pekerja biasa: 4 tab');
  await p.goto(BASE + '/saya');
  await p.waitForSelector(V('text=Log keluar'));
  expect((await p.locator(V('button:has-text("Tukar ke Mod")')).count()) === 0, 'tiada suis Mod HR');
  await p.goto(BASE + '/pengurusan/gaji/pekerja');
  await p.waitForSelector('text=Halaman ini hanya untuk', { timeout: 15000 }).catch(() => null);
  expect(!(await p.locator('text=Jumlah tetap sebulan').count()), 'Gaji Pekerja disekat untuk pekerja biasa');
  await ctx.close();

  await browser.close();
  log('LULUS: Mod HR, desktop & Gaji Pekerja');
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
