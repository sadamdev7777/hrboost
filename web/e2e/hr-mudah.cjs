// Ujian hujung-ke-hujung "HR lebih mudah" (TEMPATAN SAHAJA):
//  Kalendar berkanun di Papan Pemuka (tanda dihantar), halaman Laporan (6 laporan + CSV),
//  tarikh tamat permit/kontrak dalam Profil Pekerja → Perlu Tindakan, semakan pintar selepas kira gaji.
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000. Jalankan: node web/e2e/hr-mudah.cjs
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');
require('./_bahasa.cjs');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const shots = process.env.E2E_SHOTS || os.tmpdir();
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };
const V = (s) => `${s} >> visible=true`;

async function masuk(b, email, vp) {
  const ctx = await b.newContext({ viewport: vp, acceptDownloads: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => log('   [ralat halaman]', e.message));
  await p.goto(BASE + '/masuk');
  await p.fill('input[type=email]', email);
  await p.fill('input[autocomplete=current-password]', 'Demo1234');
  await p.click('button[type=submit]');
  await p.waitForURL(/\/(utama|pengurusan)$/, { timeout: 30000 });
  return { ctx, p };
}

(async () => {
  const b = await chromium.launch();
  const DESKTOP = { width: 1440, height: 900 };
  let { ctx, p } = await masuk(b, 'lily@demo.hrboost.io', DESKTOP);

  log('1. Papan Pemuka — tarikh akhir berkanun');
  await p.goto(BASE + '/pengurusan');
  await p.waitForSelector(V('text=TARIKH AKHIR BERKANUN'));
  const sebelum = await p.locator(V('button:has-text("Tanda dihantar")')).count();
  expect(sebelum >= 3, `${sebelum} kewajipan berkanun dipaparkan`);
  expect(await p.locator(V('text=Caruman KWSP')).count() > 0, 'KWSP disenaraikan');
  await p.locator(V('button:has-text("Tanda dihantar")')).first().click();
  await p.fill('[role=alertdialog] textarea', 'RUJ-001');
  await p.locator('[role=dialog] button:has-text("Tanda dihantar"), [role=alertdialog] button:has-text("Tanda dihantar")').last().click();
  await p.waitForSelector(V('text=ditanda telah dihantar'));
  await p.waitForFunction((n) => document.querySelectorAll('button').length && [...document.querySelectorAll('button')].filter((x) => x.textContent === 'Tanda dihantar' && x.offsetParent).length === n - 1, sebelum, { timeout: 10000 });
  expect(true, 'tanda dihantar → kewajipan hilang dari senarai');
  await p.screenshot({ path: path.join(shots, 'hrmudah-papan.png') });

  log('2. Laporan');
  await p.click(V('aside >> text=Laporan'));
  await p.waitForURL(/\/pengurusan\/laporan/);
  for (const t of ['Bilangan & pusing ganti', 'Baki cuti', 'Cuti diambil', 'Kehadiran & lewat', 'Tuntutan', 'Kos gaji']) {
    await p.click(V(`[role=tab]:has-text("${t}")`));
    await p.waitForSelector(V(`[role=tab][aria-selected=true]:has-text("${t}")`));
    await p.waitForSelector(V('table, :text("Tiada data bagi tempoh ini.")'), { timeout: 15000 });
  }
  expect(true, '6 laporan dimuatkan');
  await p.click(V('[role=tab]:has-text("Bilangan & pusing ganti")'));
  await p.waitForSelector(V('table'));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click(V('button:has-text("Eksport CSV")'))]);
  expect(/laporan-pekerja-.*\.csv$/.test(dl.suggestedFilename()), 'CSV dimuat turun: ' + dl.suggestedFilename());
  await p.click(V('[role=tab]:has-text("Kehadiran & lewat")'));
  await p.waitForSelector(V('th:has-text("Purata lewat")'));
  await p.screenshot({ path: path.join(shots, 'hrmudah-laporan.png') });

  log('3. Tarikh tamat permit — Amin');
  await p.goto(BASE + '/pengurusan/pekerja');
  await p.click(V('a:has-text("Amin")'));
  await p.waitForSelector(V('text=⋯ Lagi'));
  await p.click(V('summary:has-text("⋯ Lagi")'));
  await p.click(V('button:has-text("Tarikh tamat kontrak")'));
  const dlm = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const dlg = p.locator(V('[role=dialog]'));
  await dlg.locator('input[type=date]').nth(1).fill(dlm(20));
  await dlg.locator('button:has-text("Simpan")').click();
  await p.waitForSelector(V('text=Permit kerja tamat'));
  expect(true, 'tarikh tamat permit dipaparkan dalam profil');
  await p.goto(BASE + '/pengurusan');
  await p.waitForSelector(V('text=Permit kerja Amin tamat'));
  expect(true, 'Perlu Tindakan: permit kerja Amin akan tamat');

  log('4. Semakan pintar selepas kira gaji');
  await p.goto(BASE + '/pengurusan/gaji');
  await p.waitForSelector(V('button:has-text("Kira Gaji")'));
  await p.click(V('button:has-text("Kira Gaji")'));
  await p.waitForSelector(V(':text("SEMAKAN PINTAR"), :text("Semakan pintar: tiada perkara luar biasa")'), { timeout: 30000 });
  const teks = await p.locator(V('main')).innerText();
  expect(/SEMAKAN PINTAR|Semakan pintar/.test(teks), 'semakan pintar dipaparkan');
  await p.screenshot({ path: path.join(shots, 'hrmudah-gaji.png') });
  await ctx.close();

  log('5. Telefon — Papan Pemuka & Laporan');
  ({ ctx, p } = await masuk(b, 'lily@demo.hrboost.io', { width: 390, height: 844 }));
  await p.goto(BASE + '/pengurusan/laporan?jenis=baki_cuti');
  await p.waitForSelector(V('[role=tab][aria-selected=true]:has-text("Baki cuti")'));
  const lebar = await p.evaluate(() => document.documentElement.scrollWidth);
  expect(lebar <= 391, 'tiada skrol mendatar pada telefon');
  await ctx.close();

  // Bukan HR: laporan tidak boleh dibuka
  ({ ctx, p } = await masuk(b, 'amin@demo.hrboost.io', { width: 390, height: 844 }));
  await p.goto(BASE + '/pengurusan/laporan');
  await p.waitForSelector(V('text=Tiada akses'), { timeout: 15000 });
  expect(!(await p.locator(V('[role=tab]:has-text("Baki cuti")')).count()), 'pekerja biasa tidak nampak laporan');
  await ctx.close();
  await b.close();
  log('LULUS: HR mudah');
})().catch((e) => { console.error(e); process.exit(1); });
