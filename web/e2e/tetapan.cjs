// Ujian hujung-ke-hujung Fasa D3 (Tetapan): Lily (HR) ubah had CEO tuntutan & wakil kelulusan,
// buka setiap sub-skrin; Sadam (Pentadbir) ubah waktu kerja & beri/tarik balik peranan;
// Amin melihat had baharu dalam borang tuntutan.
// Prasyarat: `npx supabase db reset` (data demo), aplikasi di localhost:3000.
// Jalankan: node web/e2e/tetapan.cjs
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
  p.on('dialog', (d) => d.accept());
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

  log('1. Lily (HR): menu Tetapan & sub-skrin');
  let { ctx, p } = await login(browser, '100000002');
  await p.goto(BASE + '/saya');
  await p.click('a:has-text("Tetapan")');
  await p.waitForSelector('text=KELULUSAN & AUTOMASI');
  await p.waitForSelector('text=4 jenis');
  await p.screenshot({ path: `${shots}/t-menu.png` });
  expect(true, 'menu Tetapan dengan ringkasan');

  await p.click('a:has-text("Aliran Kelulusan")');
  await p.click('button[role=tab]:has-text("Tuntutan")');
  await p.waitForSelector('text=hanya jika melebihi RM1,000');
  expect((await p.innerText('main')).includes('Kewangan'), 'aliran tuntutan: Ketua Jabatan → Kewangan → CEO (> RM1,000)');
  await p.screenshot({ path: `${shots}/t-aliran.png` });

  await p.goto(BASE + '/pengurusan/tetapan/tuntutan');
  await p.waitForSelector('input[aria-label="Had kelulusan CEO (RM)"]');
  await p.fill('input[aria-label="Had kelulusan CEO (RM)"]', '1500');
  await p.click('text=Bayar melalui');
  await p.waitForSelector('text=Disimpan.');
  expect(true, 'had kelulusan CEO ditukar kepada RM1,500');
  await p.screenshot({ path: `${shots}/t-tuntutan.png` });

  await p.goto(BASE + '/pengurusan/tetapan/wakil');
  await p.waitForSelector('text=TAMBAH WAKIL');
  await p.selectOption('label:has-text("Pelulus") select', { label: 'Zuerin' });
  await p.selectOption('label:has-text("Wakil") select', { label: 'Amin' });
  await p.click('button:has-text("Simpan wakil")');
  await p.waitForSelector('text=Zuerin → Amin');
  expect(true, 'wakil Zuerin → Amin disimpan');
  await p.screenshot({ path: `${shots}/t-wakil.png` });

  for (const [path, teks] of [
    ['automasi', 'HANTAR KEPADA'],
    ['cuti', 'MENGIKUT AKTA KERJA'],
    ['cuti-umum', 'Cuti Umum'],
    ['kadar', 'JADUAL SEMASA'],
    ['syarikat', 'WAKTU KERJA'],
    ['pengguna', 'PERANAN KHAS'],
  ]) {
    await p.goto(`${BASE}/pengurusan/tetapan/${path}`);
    await p.waitForSelector(`text=${teks}`);
  }
  expect(true, 'semua sub-skrin Tetapan dibuka tanpa ralat');
  await p.goto(BASE + '/pengurusan/tetapan/cuti');
  await p.waitForSelector('text=8 / 12 / 16 hari');
  await p.screenshot({ path: `${shots}/t-cuti.png` });
  await ctx.close();

  log('2. Sadam (Pentadbir): waktu kerja & peranan');
  ({ ctx, p } = await login(browser, '100000001'));
  await p.goto(BASE + '/pengurusan/tetapan/syarikat');
  await p.waitForSelector('text=Dikira lewat selepas');
  await p.fill('label:has-text("Dikira lewat selepas") input', '15');
  await p.click('button:has-text("Simpan")');
  await p.waitForSelector('text=Profil syarikat disimpan.');
  await p.goto(BASE + '/pengurusan/tetapan');
  await p.waitForSelector('text=9:00 · 15 min');
  expect(true, 'tempoh lewat dikemas kini kepada 15 minit');
  await p.goto(BASE + '/pengurusan/tetapan/pengguna');
  await p.click('button:has-text("+ Berikan peranan")');
  await p.selectOption('[role=dialog] label:has-text("Pekerja") select', { label: 'Zulfa' });
  await p.selectOption('[role=dialog] label:has-text("Peranan") select', 'hr');
  await p.click('[role=dialog] button:has-text("Berikan")');
  await p.waitForSelector('button[aria-label="Tarik balik HR daripada Zulfa"]');
  await p.screenshot({ path: `${shots}/t-pengguna.png` });
  await p.click('button[aria-label="Tarik balik HR daripada Zulfa"]');
  await p.waitForSelector('button[aria-label="Tarik balik HR daripada Zulfa"]', { state: 'detached' });
  expect(true, 'peranan HR diberi kepada Zulfa dan ditarik balik');
  await ctx.close();

  log('3. Amin: borang tuntutan menunjukkan had baharu');
  ({ ctx, p } = await login(browser, '100000004'));
  await p.goto(BASE + '/tuntutan/baru');
  await p.click('button:has-text("Tuntutan perbatuan? Isi tanpa resit")');
  await p.waitForSelector('text=Melebihi RM1,500 → CEO juga.');
  expect(true, 'aliran dalam borang tuntutan: CEO jika melebihi RM1,500');
  await ctx.close();
  await browser.close();
  log('LULUS: Tetapan');
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
