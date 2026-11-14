// Ujian hujung-ke-hujung Inventori: Amin (telefon) rekod laptop dengan gambar, harga & resit →
// Lily (HR, desktop) nampak dalam tab Inventori, sahkan → Amin nampak "Disahkan".
// Prasyarat: `npx supabase db reset` (data demo), aplikasi di localhost:3000.
// Jalankan: node web/e2e/inventori.cjs
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');
require('./_bahasa.cjs');
const { emelDemo } = require('./_demo.cjs');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const shots = process.env.E2E_SHOTS || os.tmpdir();
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };
const GAMBAR = path.join(__dirname, 'fixtures-inventori.jpg');
const RESIT = path.join(__dirname, 'fixtures-resit.jpg');

async function login(browser, phone, viewport) {
  const ctx = await browser.newContext({ viewport });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => log('   [ralat halaman]', e.message));
  await p.goto(BASE + '/masuk');
  await p.fill('input[type=email]', emelDemo(phone));
  await p.fill('input[autocomplete=current-password]', 'Demo1234');
  await p.click('button[type=submit]');
  await p.waitForURL(/\/(utama|pengurusan)$/, { timeout: 15000 });
  return { ctx, p };
}

(async () => {
  const browser = await chromium.launch();
  let { ctx, p } = await login(browser, '100000004', { width: 390, height: 844 });

  log('1. Amin: Saya → Inventori saya → tambah laptop dengan gambar & resit');
  await p.goto(BASE + '/saya');
  await p.click('a:has-text("Inventori saya")');
  await p.waitForURL('**/inventori');
  await p.waitForSelector('text=Belum ada item');
  await p.click('button:has-text("+ Tambah item")');
  await p.waitForSelector('[role=dialog] >> text=Tambah item inventori');
  const fail = p.locator('[role=dialog] input[type=file]');
  expect(await fail.nth(0).getAttribute('capture') === 'environment', 'butang Ambil gambar membuka kamera belakang');
  await fail.nth(1).setInputFiles(GAMBAR);           // gambar item (galeri)
  await p.waitForSelector('[role=dialog] button[aria-label="Buang fail"]', { timeout: 20000 });
  await p.fill('[role=dialog] label:has-text("Nama item") input', 'Laptop Dell Latitude');
  await p.selectOption('[role=dialog] label:has-text("Kategori") select', 'Komputer riba');
  await p.fill('[role=dialog] label:has-text("Jenama / model") input', 'Dell 5440');
  await p.fill('[role=dialog] label:has-text("No. siri / tag") input', 'SN-8842');
  await p.fill('[role=dialog] label:has-text("Harga (RM)") input', '4299');
  await fail.nth(3).setInputFiles(RESIT);            // resit (galeri)
  await p.waitForFunction(() => document.querySelectorAll('[role=dialog] button[aria-label="Buang fail"]').length === 2, null, { timeout: 20000 });
  await p.screenshot({ path: `${shots}/inv-borang.png`, fullPage: true });
  await p.click('[role=dialog] button:has-text("Hantar kepada HR")');
  await p.waitForSelector('text=DIPEGANG OLEH SAYA · 1', { timeout: 15000 });
  expect(await p.locator('text=Menunggu semakan HR').count() > 0, 'item menunggu semakan HR');
  await p.screenshot({ path: `${shots}/inv-pekerja.png` });
  await ctx.close();

  log('2. Lily (HR, desktop): Pekerja → Inventori → sahkan');
  ({ ctx, p } = await login(browser, '100000002', { width: 1280, height: 900 }));
  await p.goto(BASE + '/pengurusan/inventori');
  await p.waitForSelector('text=Laptop Dell Latitude', { timeout: 15000 });
  expect(await p.locator('a[href="/pengurusan/inventori"]').count() > 0, 'tab Inventori dalam modul Pekerja');
  const teks = await p.innerText('main');
  expect(teks.includes('Amin') && teks.includes('Menunggu semakan'), 'pemegang Amin & status menunggu dipaparkan');
  await p.click('tr:has-text("Laptop Dell Latitude")');
  await p.waitForSelector('[role=dialog] >> text=Resit');
  expect(await p.locator('[role=dialog] button[aria-label="Buka gambar"]').count() >= 2, 'gambar item & resit boleh dibuka oleh HR');
  await p.screenshot({ path: `${shots}/inv-hr-butiran.png` });
  await p.click('[role=dialog] button:has-text("Sahkan")');
  await p.waitForSelector('[role=dialog]', { state: 'detached' });
  await p.waitForSelector('tr:has-text("Laptop Dell Latitude") >> text=Disahkan', { timeout: 15000 });
  expect(/RM\s?4,299\.00/.test(await p.innerText('main')), 'nilai inventori dikira daripada item disahkan');
  await p.screenshot({ path: `${shots}/inv-hr.png` });
  await ctx.close();

  log('3. Amin: item disahkan tidak boleh diubah lagi');
  ({ ctx, p } = await login(browser, '100000004', { width: 390, height: 844 }));
  await p.goto(BASE + '/inventori');
  await p.waitForSelector('text=Disahkan', { timeout: 15000 });
  await p.click('button:has-text("Laptop Dell Latitude")');
  await p.waitForSelector('[role=dialog] >> text=SN-8842');
  expect(await p.locator('[role=dialog] button:text-is("Ubah")').count() === 0, 'tiada butang Ubah selepas disahkan');
  await ctx.close();

  log('4. Lily: tamatkan Amin → item belum dipulangkan dipaparkan → Dipulangkan');
  ({ ctx, p } = await login(browser, '100000002', { width: 1280, height: 900 }));
  await p.goto(BASE + '/pengurusan/pekerja');
  await p.click('a:has-text("Amin")');
  await p.waitForSelector('text=TINDAKAN', { timeout: 15000 });
  await p.click('button:has-text("Tamatkan pekerjaan")');
  await p.waitForSelector('[role=dialog] >> text=1 item syarikat belum dipulangkan', { timeout: 15000 });
  expect(await p.locator('[role=dialog] >> text=Laptop Dell Latitude').count() > 0, 'dialog Tamatkan menyenaraikan laptop yang belum dipulangkan');
  await p.screenshot({ path: `${shots}/inv-tamat.png` });
  await p.click('[role=dialog] button:text-is("Dipulangkan")');
  await p.waitForSelector('[role=dialog] >> text=1 item syarikat belum dipulangkan', { state: 'detached', timeout: 15000 });
  expect(true, 'item ditanda dipulangkan terus dari dialog');
  await ctx.close();

  await browser.close();
  log('LULUS: inventori');
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
