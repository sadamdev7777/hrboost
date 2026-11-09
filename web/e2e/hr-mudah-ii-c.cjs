// Ujian hujung-ke-hujung "HR lebih mudah II" bahagian 3 (TEMPATAN SAHAJA):
//  jadual Pekerja (lajur pilihan, paparan tersimpan, penapis diingati), pintasan papan kekunci Kelulusan,
//  tab Sejarah dalam Profil Pekerja.
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000. Jalankan: node web/e2e/hr-mudah-ii-c.cjs
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

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
async function mohonCuti(b, email, hariDepan) {
  const { ctx, p } = await masuk(b, email, TELEFON);
  await p.goto(BASE + '/mohon/cuti');
  await p.waitForSelector('text=Hantar Permohonan');
  const t = new Date(Date.now() + hariDepan * 864e5);
  while ([0, 6].includes(t.getDay())) t.setDate(t.getDate() + 1);
  const iso = t.toISOString().slice(0, 10);
  const tarikh = p.locator('input[type=date]');
  await tarikh.nth(0).fill(iso);
  await tarikh.nth(1).fill(iso);
  await p.waitForTimeout(1200);
  await p.click('button:has-text("Hantar Permohonan")');
  await p.waitForURL(/\/permohonan/, { timeout: 15000 });
  await ctx.close();
}

(async () => {
  const b = await chromium.launch();

  log('1. Jadual Pekerja — lajur, paparan tersimpan, penapis diingati');
  let { ctx, p } = await masuk(b, 'lily@demo.hrboost.io', DESKTOP);
  await p.goto(BASE + '/pengurusan/pekerja');
  await p.waitForSelector(V('table'));
  await p.click(V('summary:has-text("Lajur")'));
  await p.check(V('label:has-text("Tarikh mula") input'));
  await p.uncheck(V('label:has-text("Peranan") input'));
  await p.click(V('summary:has-text("Lajur")'));
  expect((await p.locator(V('th:has-text("TARIKH MULA")')).count()) === 1 && (await p.locator(V('th:has-text("PERANAN")')).count()) === 0, 'lajur Tarikh mula ditambah, Peranan disorok');
  await p.selectOption(V('select[aria-label="Tapis jabatan"]'), { label: 'Pelancongan' });
  await p.click(V('button:has-text("+ Simpan paparan")'));
  await p.fill('[role=alertdialog] textarea', 'Pelancongan');
  await p.click('[role=alertdialog] button:has-text("Simpan")');
  await p.waitForSelector(V('[aria-label="Paparan tersimpan"] >> text=Pelancongan'));
  await p.reload();
  await p.waitForSelector(V('table'));
  const baris = await p.locator(V('tbody tr')).allInnerTexts();
  expect(baris.length > 0 && baris.every((r) => r.includes('Pelancongan')), 'selepas muat semula: penapis jabatan diingati');
  expect((await p.locator(V('th:has-text("TARIKH MULA")')).count()) === 1, 'pilihan lajur diingati');
  await p.selectOption(V('select[aria-label="Tapis jabatan"]'), { label: 'Semua jabatan' });
  await p.click(V('[aria-label="Paparan tersimpan"] button:has-text("Pelancongan")'));
  await p.waitForFunction(() => document.querySelector('select[aria-label="Tapis jabatan"]')?.value === 'Pelancongan');
  expect(true, 'paparan tersimpan digunakan semula');
  await p.screenshot({ path: path.join(shots, 'hrmudahii-jadual.png') });

  log('2. Sejarah — pindah jabatan, kemudian lihat tab Sejarah');
  const amin = p.locator(V('tr:has-text("DEMO004")'));
  await amin.locator('input[type=checkbox]').check();
  await p.selectOption(V('select[aria-label="Jabatan baharu"]'), { label: 'Pengurusan' });
  await p.click(V('button:has-text("Pindah")'));
  await p.waitForSelector(V('[role=status] >> text=1 pekerja dipindahkan.'));
  await p.goto(BASE + '/pengurusan/pekerja');
  await p.selectOption(V('select[aria-label="Tapis jabatan"]'), { label: 'Semua jabatan' });
  await p.click(V('a:has-text("Amin")'));
  await p.click(V('[role=tab]:has-text("Sejarah")'));
  await p.waitForSelector(V('text=Jabatan: Pelancongan → Pengurusan'));
  expect(await p.locator(V('ol[aria-label="Sejarah perubahan"] >> text=Lily')).count() > 0, 'Sejarah: perubahan jabatan oleh Lily');
  await p.click(V('[role=switch][aria-label="Termasuk log akses data"]'));
  await p.waitForSelector(V('text=Melihat profil & maklumat peribadi'));
  expect(true, 'Sejarah: log akses data dipaparkan');
  await p.screenshot({ path: path.join(shots, 'hrmudahii-sejarah.png') });
  await ctx.close();

  log('3. Pintasan papan kekunci dalam Kelulusan');
  await mohonCuti(b, 'zulfa@demo.hrboost.io', 20);
  await mohonCuti(b, 'zulfa@demo.hrboost.io', 27);
  ({ ctx, p } = await masuk(b, 'zuerin@demo.hrboost.io', DESKTOP));
  await p.goto(BASE + '/kelulusan');
  await p.waitForSelector(V('text=Pintasan:'));
  const sebelum = await p.locator(V('[aria-current=true]')).innerText();
  await p.keyboard.press('j');
  await p.waitForFunction((s) => document.querySelector('[aria-current=true]')?.textContent !== s, sebelum);
  expect(true, 'J memilih permohonan seterusnya');
  await p.keyboard.press('a');
  await p.waitForSelector(V('[role=status] >> text=Diluluskan.'));
  await p.keyboard.press('a');
  await p.waitForSelector(V('text=Tiada permohonan menunggu kelulusan anda'), { timeout: 20000 });
  expect(true, 'A meluluskan; kedua-dua permohonan selesai');
  await ctx.close();
  await b.close();
  log('LULUS: HR mudah II (3)');
})().catch((e) => { console.error(e); process.exit(1); });
