// Ujian hujung-ke-hujung Tetapan → Jabatan (TEMPATAN SAHAJA): tambah, nama pendua ditolak,
// namakan semula, pilih ketua, padam jabatan kosong.
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000. Jalankan: node web/e2e/jabatan.cjs
const os = require('os');
const { chromium } = require('playwright');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const shots = process.env.E2E_SHOTS || os.tmpdir();
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };
const V = (s) => `${s} >> visible=true`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => log('   [ralat halaman]', e.message));
  await p.goto(BASE + '/masuk');
  await p.fill('input[type=email]', 'lily@demo.hrboost.io');
  await p.fill('input[autocomplete=current-password]', 'Demo1234');
  await p.click('button[type=submit]');
  await p.waitForURL('**/pengurusan', { timeout: 20000 });

  log('1. Lily: Tetapan → Jabatan');
  await p.click('aside a:has-text("Jabatan")');
  await p.waitForURL('**/pengurusan/tetapan/jabatan');
  await p.waitForSelector(V('text=Pelancongan'));
  expect(true, 'menu sisi → Jabatan; senarai jabatan sedia ada');

  await p.click('button:has-text("+ Tambah jabatan")');
  await p.fill('[role=dialog] input', 'Pelancongan');
  await p.click('[role=dialog] button:has-text("Tambah")');
  await p.waitForSelector('[role=dialog] >> text=Nama jabatan ini sudah wujud');
  expect(true, 'nama jabatan pendua ditolak');
  await p.fill('[role=dialog] input', 'Operasi');
  await p.click('[role=dialog] button:has-text("Tambah")');
  await p.waitForSelector('[role=dialog]', { state: 'detached' });
  await p.waitForSelector(V('b:has-text("Operasi")'));
  expect(true, 'jabatan Operasi ditambah');

  const baris = () => p.locator(V('div.min-h-16:has(b:text-is("Operasi Darat"))')).first();
  await p.locator(V('div.min-h-16:has(b:text-is("Operasi"))')).first().locator('button:has-text("Namakan semula")').click();
  await p.fill('[role=dialog] input', 'Operasi Darat');
  await p.click('[role=dialog] button:has-text("Simpan")');
  await p.waitForSelector('[role=dialog]', { state: 'detached' });
  await p.waitForSelector(V('b:text-is("Operasi Darat")'));
  expect(true, 'dinamakan semula kepada Operasi Darat');

  await baris().locator('button:has-text("Pilih ketua")').click();
  await p.selectOption('[role=dialog] select', { label: 'Zulfa · DEMO006 (jabatan lain)' });
  await p.click('[role=dialog] button:has-text("Tetapkan ketua")');
  await p.waitForSelector('[role=dialog]', { state: 'detached' });
  await p.waitForSelector(V('div.min-h-16:has(b:text-is("Operasi Darat")) >> text=Zulfa'));
  expect(true, 'Zulfa ditetapkan sebagai ketua Operasi Darat');
  await p.screenshot({ path: `${shots}/jabatan.png` });

  await baris().locator('button:has-text("Padam")').click();
  await baris().locator('button:has-text("Sahkan padam")').click();
  await p.waitForSelector(V('b:text-is("Operasi Darat")'), { state: 'detached' });
  expect(true, 'jabatan kosong dipadam');
  expect(!(await p.locator(V('div.min-h-16:has(b:text-is("Pelancongan")) >> button:has-text("Padam")')).count()), 'jabatan yang ada pekerja tidak boleh dipadam');

  await browser.close();
  log('LULUS: Jabatan');
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
