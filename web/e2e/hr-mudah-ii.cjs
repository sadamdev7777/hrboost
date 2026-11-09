// Ujian hujung-ke-hujung "HR lebih mudah II" bahagian 1 (TEMPATAN SAHAJA):
//  kerja lebih masa → ketua lulus → masuk gaji; surat pengesahan gaji → HR keluarkan → pekerja muat turun;
//  pengumuman → kad Utama → dibaca; kalendar pasukan.
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000. Jalankan: node web/e2e/hr-mudah-ii.cjs
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');
require('./_bahasa.cjs');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const shots = process.env.E2E_SHOTS || os.tmpdir();
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };
const V = (s) => `${s} >> visible=true`;
const DESKTOP = { width: 1440, height: 900 };
const TELEFON = { width: 390, height: 844 };

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
  const kelmarin = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);

  log('0. Kerja lebih masa ialah pilihan (lalai: tidak digunakan)');
  let { ctx, p } = await masuk(b, 'amin@demo.hrboost.io', TELEFON);
  await p.goto(BASE + '/mohon');
  await p.waitForSelector(V('a:has-text("Surat")'));
  expect(!(await p.locator(V('a:has-text("Kerja lebih masa")')).count()), 'pilihan Kerja lebih masa disorok secara lalai');
  await ctx.close();
  ({ ctx, p } = await masuk(b, 'lily@demo.hrboost.io', DESKTOP));
  await p.goto(BASE + '/pengurusan/tetapan/syarikat');
  await p.click(V('[role=switch][aria-label="Kerja lebih masa"]'));
  await p.waitForSelector(V('text=Kerja lebih masa dihidupkan.'));
  expect(true, 'HR menghidupkan kerja lebih masa dalam Tetapan → Syarikat');
  await ctx.close();

  log('1. Amin mohon kerja lebih masa & surat pengesahan gaji');
  ({ ctx, p } = await masuk(b, 'amin@demo.hrboost.io', TELEFON));
  await p.goto(BASE + '/mohon');
  await p.click(V('a:has-text("Kerja lebih masa")'));
  await p.waitForURL('**/mohon/lebih-masa');
  await p.fill('input[type=date]', kelmarin);
  await p.fill('input[aria-label="Bilangan jam"]', '3');
  await p.fill('textarea', 'Menyambut kumpulan pelancong di KLIA');
  await p.click(V('button:has-text("Hantar permohonan")'));
  await p.waitForURL(/\/permohonan\//, { timeout: 15000 });
  expect(true, 'permohonan kerja lebih masa dihantar');
  await p.goto(BASE + '/mohon/surat');
  await p.click(V('button:has-text("Surat pengesahan gaji")'));
  await p.fill('input[placeholder="Contoh: Permohonan pinjaman perumahan"]', 'Permohonan pinjaman perumahan');
  await p.fill('input[placeholder="Contoh: Maybank Berhad"]', 'Maybank Berhad');
  await p.click(V('button:has-text("Mohon surat")'));
  await p.waitForSelector(V('text=Menunggu HR'));
  expect(true, 'permohonan surat dihantar (Menunggu HR)');
  await ctx.close();

  log('2. Zuerin (ketua) meluluskan kerja lebih masa');
  ({ ctx, p } = await masuk(b, 'zuerin@demo.hrboost.io', DESKTOP));
  await p.goto(BASE + '/kelulusan');
  await p.waitForSelector(V('text=Kerja lebih masa 3 jam'));
  await p.click(V('text=Kerja lebih masa 3 jam'));
  await p.click(V('button:text-is("Lulus")'));
  await p.waitForSelector(V('text=Tiada permohonan menunggu kelulusan anda'), { timeout: 20000 });
  expect(true, 'ketua meluluskan kerja lebih masa');
  await ctx.close();

  log('3. Lily — keluarkan surat, siar pengumuman, kalendar, gaji dengan OT');
  ({ ctx, p } = await masuk(b, 'lily@demo.hrboost.io', DESKTOP));
  await p.waitForSelector(V('text=permohonan surat pengesahan menunggu dikeluarkan'));
  expect(true, 'Papan Pemuka: surat menunggu dalam Perlu tindakan');
  await p.click(V('aside >> text=Surat'));
  await p.waitForURL('**/pengurusan/surat');
  await p.click(V('button:has-text("Keluarkan")'));
  await p.click('[role=alertdialog] button:has-text("Keluarkan surat")');
  await p.waitForURL(/\/surat\/[0-9a-f-]+$/);
  await p.waitForSelector(V('text=PENGESAHAN JAWATAN DAN GAJI'));
  const surat = await p.locator(V('article')).innerText();
  expect(/Maybank Berhad/.test(surat) && /RM\s?[\d,]+\.\d\d/.test(surat) && /DEMO\/HR\/\d{4}\/0001/.test(surat), 'surat dijana: penerima, gaji & rujukan');
  await p.screenshot({ path: path.join(shots, 'hrmudahii-surat.png') });

  await p.goto(BASE + '/pengurusan/pengumuman');
  await p.fill('input[placeholder="Contoh: Cuti umum ganti pada Isnin"]', 'Majlis makan malam syarikat');
  await p.fill('textarea', 'Majlis makan malam tahunan akan diadakan pada 12 Disember. Semua pekerja dijemput hadir.');
  await p.click(V('button:has-text("Siarkan")'));
  await p.click('[role=alertdialog] button:has-text("Siarkan")');
  await p.waitForSelector(V('text=Dibaca 1/6'));
  expect(true, 'pengumuman disiarkan (dibaca 1/6)');

  await p.goto(BASE + '/kalendar');
  await p.waitForSelector(V('text=Kalendar pasukan'));
  await p.waitForSelector(V('text=Isn'));
  expect(true, 'kalendar bulanan dipaparkan');
  await p.screenshot({ path: path.join(shots, 'hrmudahii-kalendar.png') });

  const bulan = kelmarin.slice(0, 7);
  await p.goto(BASE + `/pengurusan/gaji?y=${bulan.slice(0, 4)}&m=${Number(bulan.slice(5, 7))}`);
  await p.click(V('button:has-text("Kira Gaji")'));
  await p.waitForSelector(V('text=Lihat semua'), { timeout: 30000 });
  await p.click(V('button:has-text("Lihat semua")'));
  await p.click(V('a:has-text("Amin")'));
  await p.waitForSelector(V('text=Kerja Lebih Masa (diluluskan)'), { timeout: 15000 });
  expect(true, 'slip Amin: Kerja Lebih Masa (diluluskan)');
  await ctx.close();

  log('4. Amin — pengumuman di Utama & muat turun surat');
  ({ ctx, p } = await masuk(b, 'amin@demo.hrboost.io', TELEFON));
  await p.waitForSelector(V('text=PENGUMUMAN BAHARU (1)'));
  await p.click(V('section[aria-label=Pengumuman] button:has-text("Tandakan dibaca")'));
  await p.waitForSelector('text=PENGUMUMAN BAHARU', { state: 'detached' });
  expect(true, 'pengumuman ditandakan dibaca');
  await p.goto(BASE + '/mohon/surat');
  await p.click(V('a:has-text("Muat turun")'));
  await p.waitForSelector(V('text=PENGESAHAN JAWATAN DAN GAJI'));
  expect(true, 'pekerja membuka surat yang dikeluarkan');
  await p.goto(BASE + '/kalendar');
  await p.waitForSelector(V('text=Anda melihat cuti jabatan anda sahaja'));
  expect(true, 'pekerja melihat kalendar jabatan sendiri sahaja');
  await ctx.close();
  await b.close();
  log('LULUS: HR mudah II');
})().catch((e) => { console.error(e); process.exit(1); });
