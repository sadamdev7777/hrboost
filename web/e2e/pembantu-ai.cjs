// Ujian hujung-ke-hujung skrin AI: Lily (HR) menambah dokumen pengetahuan (dipecah & boleh dicari),
// Amin membuka Pembantu AI. Tanpa kunci AI (tempatan/staging) skrin memaparkan mesej yang jelas.
// Logik ejen sebenar diuji oleh supabase/scripts/ujian-fungsi-ai.cjs (pelayan Claude palsu).
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000. Jalankan: node web/e2e/pembantu-ai.cjs
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
  log('1. Lily (HR): Pengetahuan AI');
  let { ctx, p } = await login(browser, '100000002');
  await p.goto(BASE + '/pengurusan/tetapan/pengetahuan-ai');
  await p.waitForSelector('text=Tetapan sistem');
  await p.click('button:has-text("+ Muat naik dokumen")');
  await p.fill('[role=dialog] label:has-text("Tajuk") input', 'Buku panduan pekerja');
  await p.fill('[role=dialog] textarea', 'Cuti kahwin\n\nPekerja tetap layak 3 hari cuti kahwin sekali sepanjang perkhidmatan.\n\nLetak kereta\n\nBayaran letak kereta di lapangan terbang boleh dituntut dengan resit apabila menghantar kumpulan pelanggan.');
  await p.click('[role=dialog] button:has-text("Simpan dokumen")');
  await p.waitForSelector('text=Buku panduan pekerja');
  expect((await p.innerText('main')).includes('bahagian'), 'dokumen disimpan dan dipecah kepada bahagian');
  await p.screenshot({ path: `${shots}/ai-kb.png` });
  await ctx.close();

  log('2. Amin: Pembantu AI');
  ({ ctx, p } = await login(browser, '100000004'));
  await p.goto(BASE + '/saya');
  await p.click('a:has-text("Pembantu AI")');
  await p.waitForSelector('text=CUBA TANYA');
  await p.screenshot({ path: `${shots}/ai-pembantu.png` });
  await p.click('button:has-text("Berapakah baki cuti saya?")');
  await p.waitForFunction(() => /belum diaktifkan|tidak dapat|Baki/i.test(document.querySelector('main')?.innerText ?? ''), null, { timeout: 30000 });
  const t = await p.innerText('main');
  expect(t.includes('Berapakah baki cuti saya?') && (/belum diaktifkan|tidak dapat|Baki/i.test(t)), 'soalan dihantar; tanpa kunci AI mesej jelas dipaparkan');
  await ctx.close();
  await browser.close();
  log('LULUS: skrin AI');
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
