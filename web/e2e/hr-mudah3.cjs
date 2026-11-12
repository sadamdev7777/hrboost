// Ujian hujung-ke-hujung "HR lebih mudah" bahagian 3 (TEMPATAN SAHAJA):
//  pratonton slip oleh pekerja + lapor kesilapan → HR selesaikan; ringkasan harian WhatsApp (pratonton & suis).
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000. Jalankan: node web/e2e/hr-mudah3.cjs
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
  const ctx = await b.newContext({ viewport: vp });
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
  const TELEFON = { width: 390, height: 844 };

  log('1. Lily kira gaji bulan ini');
  let { ctx, p } = await masuk(b, 'lily@demo.hrboost.io', DESKTOP);
  await p.goto(BASE + '/pengurusan/gaji');
  await p.click(V('button:has-text("Kira Gaji")'));
  await p.waitForSelector(V('button:has-text("Hantar untuk kelulusan")'), { timeout: 30000 });
  await p.click(V('button:has-text("Pilihan lanjut")'));
  await p.waitForSelector(V('[role=switch][aria-label="Pekerja boleh pratonton slip"]'), { timeout: 30000 });
  expect((await p.getAttribute(V('[role=switch][aria-label="Pekerja boleh pratonton slip"]'), 'aria-checked')) === 'true', 'pratonton slip dihidupkan secara lalai');
  await ctx.close();

  log('2. Amin melihat pratonton & melaporkan kesilapan');
  ({ ctx, p } = await masuk(b, 'amin@demo.hrboost.io', TELEFON));
  await p.goto(BASE + '/gaji');
  await p.waitForSelector(V('text=belum diluluskan'));
  expect(await p.locator(V('button:has-text("pratonton")')).count() > 0, 'cip bulan bertanda pratonton');
  expect(!(await p.locator(V('text=Muat turun PDF')).count()), 'PDF tidak ditawarkan untuk slip draf');
  await p.click(V('button:has-text("Lapor kesilapan")'));
  await p.fill('[role=alertdialog] textarea', 'Elaun perjalanan RM200 bulan ini tiada');
  await p.click('[role=alertdialog] button:has-text("Hantar kepada HR")');
  await p.waitForSelector(V('text=Laporan anda sedang disemak oleh HR.'));
  expect(true, 'laporan dihantar; status "sedang disemak" dipaparkan');
  await p.screenshot({ path: path.join(shots, 'hrmudah3-pratonton.png') });
  await ctx.close();

  log('3. Lily menyelesaikan laporan');
  ({ ctx, p } = await masuk(b, 'lily@demo.hrboost.io', DESKTOP));
  await p.goto(BASE + '/pengurusan/gaji');
  await p.waitForSelector(V('text=LAPORAN DARIPADA PEKERJA (1 belum selesai)'));
  expect(await p.locator(V('text=Elaun perjalanan RM200')).count() > 0, 'HR melihat laporan Amin');
  await p.click(V('section[aria-label="Laporan daripada pekerja"] button:has-text("Tanda selesai")'));
  await p.fill('[role=alertdialog] textarea', 'Elaun ditambah');
  await p.click('[role=alertdialog] button:has-text("Tanda selesai")');
  await p.waitForSelector(V('text=LAPORAN DARIPADA PEKERJA (0 belum selesai)'));
  expect(true, 'laporan ditanda selesai');
  await p.screenshot({ path: path.join(shots, 'hrmudah3-laporan.png') });

  log('4. Ringkasan harian — Tetapan → Automasi');
  await p.goto(BASE + '/pengurusan/tetapan/automasi');
  await p.waitForSelector(V('text=Ringkasan harian kepada HR'));
  await p.click(V('button:has-text("Pratonton mesej hari ini")'));
  const pra = await p.locator(V('pre')).innerText();
  expect(/Ringkasan HR|Tiada perkara/.test(pra), 'pratonton ringkasan: ' + pra.split('\n')[0]);
  const suis = V('[role=switch][aria-label="Ringkasan harian kepada HR"]');
  await p.click(suis);
  await p.waitForFunction((s) => document.querySelector('[role=switch][aria-label="Ringkasan harian kepada HR"]')?.getAttribute('aria-checked') === 'false', null);
  expect(true, 'ringkasan harian boleh dimatikan');
  await ctx.close();
  await b.close();
  log('LULUS: HR mudah 3');
})().catch((e) => { console.error(e); process.exit(1); });
