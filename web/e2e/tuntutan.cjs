// Ujian hujung-ke-hujung Fasa D: Amin hantar tuntutan RM1,250 dengan gambar resit ->
// Ketua Jabatan -> Kewangan -> CEO (syarat > RM1,000) -> lulus; draf boleh disimpan & dipadam.
// Prasyarat: `npx supabase db reset` (data demo), aplikasi di localhost:3000.
// Jalankan: node web/e2e/tuntutan.cjs
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const shots = process.env.E2E_SHOTS || os.tmpdir();
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };

async function login(browser, phone) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  // Lencana Netlify di staging menutup butang bawah
  await p.addInitScript(() => { const st = document.createElement('style'); st.textContent = '#nl-badge-frame{display:none!important}'; document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st)); });
  p.on('pageerror', (e) => log('   [ralat halaman]', e.message));
  await p.goto(BASE + '/masuk');
  await p.fill('input[type=tel]', phone);
  await p.click('button:has-text("Hantar kod")');
  await p.waitForURL('**/masuk/kod');
  await p.fill('input[autocomplete=one-time-code]', '123456');
  await p.waitForURL('**/utama', { timeout: 15000 });
  return { ctx, p };
}

(async () => {
  const browser = await chromium.launch();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hrb-resit-'));
  const pg = await browser.newPage({ viewport: { width: 600, height: 900 } });
  await pg.setContent('<body style="margin:0;background:#fff;font:bold 40px monospace;padding:40px">RESIT<br>HOTEL KUNDASANG<br>JUMLAH RM 1,250.00</body>');
  const resit = path.join(tmp, 'resit.jpg');
  await pg.screenshot({ path: resit, type: 'jpeg', quality: 80 });
  await pg.close();

  let ctx, p;
  // E2E_DARI=2 melangkau langkah 1 (contoh: tuntutan sudah dihantar di staging)
  if (Number(process.env.E2E_DARI || 1) <= 1) {
  log('1. Amin: draf, kemudian hantar tuntutan RM1,250');
  ({ ctx, p } = await login(browser, '100000004'));
  await p.goto(BASE + '/tuntutan');
  await p.waitForSelector('a:has-text("Ambil gambar")'); // senarai mungkin sudah berisi data di staging
  await p.click('a:has-text("Ambil gambar")');
  await p.waitForURL('**/tuntutan/baru');
  await p.waitForSelector('text=Tambah resit');
  await p.screenshot({ path: `${shots}/t1-tambah-resit.png` });
  await p.setInputFiles('input[aria-label="Ambil gambar resit"]', resit);
  await p.waitForSelector('text=1 resit dilampirkan');
  await p.selectOption('select', { label: 'Lain-lain' });
  await p.fill('input[inputmode=decimal]', '1250');
  await p.fill('input[placeholder^="Contoh: Menghantar"]', 'Penginapan lawatan Kundasang');
  await p.waitForSelector('text=Melebihi RM1,000 → CEO juga.');
  await p.screenshot({ path: `${shots}/t2-borang.png` });
  await p.click('button:has-text("Simpan draf")');
  await p.waitForURL('**/tuntutan');
  await p.waitForSelector('text=Draf · belum dihantar');
  expect(true, 'draf disimpan bersama resit');
  await p.locator('a:has-text("Penginapan lawatan Kundasang")').first().click();
  await p.waitForSelector('text=Ubah Tuntutan');
  await p.waitForSelector('text=1 resit dilampirkan');
  await p.click('button:has-text("Hantar RM 1,250.00")');
  await p.waitForURL('**/tuntutan');
  await p.waitForSelector('text=Di Ketua Jabatan');
  await p.screenshot({ path: `${shots}/t3-senarai.png` });
  expect((await p.innerText('main')).includes('RM 1,250.00'), 'tuntutan dihantar, menunggu Ketua Jabatan');

  // Draf kedua dipadam
  await p.goto(BASE + '/tuntutan/baru');
  await p.click('button:has-text("Tuntutan perbatuan? Isi tanpa resit")');
  await p.fill('input[inputmode=decimal]', '284');
  await p.waitForSelector('text=RM 170.40');
  await p.fill('input[placeholder^="Contoh: Menghantar"]', 'Perbatuan Melaka');
  await p.click('button:has-text("Simpan draf")');
  await p.waitForURL('**/tuntutan');
  await p.click('a:has-text("Perbatuan Melaka")');
  await p.click('button:has-text("Padam draf")');
  await p.waitForURL('**/tuntutan');
  await p.locator('text=Perbatuan Melaka').first().waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  expect((await p.locator('text=Perbatuan Melaka').count()) === 0, 'perbatuan 284 km × RM0.60 = RM170.40; draf boleh dipadam');
  await ctx.close();
  }

  log('2. Kelulusan: Ketua Jabatan -> Kewangan -> CEO');
  for (const [phone, who] of [['100000003', 'Zuerin (Ketua)'], ['100000005', 'Farah (Kewangan)'], ['100000001', 'Sadam (CEO)']]) {
    ({ ctx, p } = await login(browser, phone));
    await p.goto(BASE + '/kelulusan');
    await p.waitForSelector('text=Tuntutan · 1');
    await p.click('main a[href^="/kelulusan/"]');
    await p.waitForSelector('text=Lihat resit');
    if (who.startsWith('Farah')) {
      const [pop] = await Promise.all([p.waitForEvent('popup'), p.click('button:has-text("Lihat resit")')]);
      await pop.waitForLoadState();
      expect(/image\/jpeg/.test(await pop.evaluate(() => document.contentType)), 'Kewangan boleh membuka resit');
      await pop.close();
      await p.screenshot({ path: `${shots}/t4-butiran-kewangan.png` });
    }
    await p.click('button:has-text("Lulus")');
    await p.waitForURL('**/kelulusan');
    await p.waitForSelector('text=Menunggu · 0');
    expect(true, `${who} meluluskan`);
    await ctx.close();
  }

  log('3. Amin: tuntutan lulus');
  ({ ctx, p } = await login(browser, '100000004'));
  await p.goto(BASE + '/tuntutan');
  await p.waitForSelector('text=Lulus');
  await p.screenshot({ path: `${shots}/t5-lulus.png` });
  const aliran = await p.goto(BASE + '/permohonan').then(() => p.click('main a[href^="/permohonan/"]')).then(() => p.waitForSelector('text=Aliran kelulusan')).then(() => p.innerText('section:has-text("Aliran kelulusan")'));
  expect(/3 · CEO/.test(aliran) && !/Menunggu/.test(aliran), 'tiga peringkat termasuk CEO diluluskan');
  await ctx.close();
  await browser.close();
  log('LULUS: tuntutan RM1,250 naik ke CEO');
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
