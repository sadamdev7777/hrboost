// Ujian hujung-ke-hujung penambahbaikan audit HR (TEMPATAN SAHAJA):
//  Kelulusan desktop (senarai + butiran, konteks baki/rakan, lulus ramai), carian Ctrl+K,
//  Gaji bertab (Sejarah), data gaji terkumpul diisi sekali gus → amaran PCB hilang,
//  jadual Pekerja (isih, tapis jabatan, eksport CSV), Profil Pekerja (tajuk & ⋯ Lagi), loceng pemberitahuan.
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000. Jalankan: node web/e2e/audit-hr.cjs
const os = require('os');
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

async function mohonCuti(b, email, hariDepan) {
  const { ctx, p } = await masuk(b, email, { width: 390, height: 844 });
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
  const DESKTOP = { width: 1440, height: 900 };

  log('0. Data: Amin & Zulfa (jabatan sama) mohon cuti pada hari yang sama; ketua meluluskan');
  await mohonCuti(b, 'amin@demo.hrboost.io', 14);
  await mohonCuti(b, 'zulfa@demo.hrboost.io', 14);
  let { ctx, p } = await masuk(b, 'zuerin@demo.hrboost.io', DESKTOP);
  await p.goto(BASE + '/kelulusan');
  await p.waitForSelector(V('text=Pilih semua'));
  await p.check(V('label:has-text("Pilih semua") input'));
  await p.click(V('button:has-text("Lulus 2 dipilih")'));
  await p.waitForSelector(V('text=Tiada permohonan menunggu kelulusan anda'), { timeout: 20000 });
  expect(true, 'ketua jabatan: lulus 2 permohonan sekali gus');
  await ctx.close();

  log('1. Lily — Kelulusan desktop');
  ({ ctx, p } = await masuk(b, 'lily@demo.hrboost.io', DESKTOP));
  await p.goto(BASE + '/kelulusan');
  await p.waitForSelector(V('text=Pilih semua'));
  await p.waitForSelector(V('text=1 rakan bercuti'));
  const senarai = await p.locator('main').innerText();
  expect(/Baki selepas: \d/.test(senarai) && senarai.includes('1 rakan bercuti (Zulfa)') && senarai.includes('1 rakan bercuti (Amin)'), 'konteks: baki selepas & rakan sejabatan bercuti');
  await p.waitForSelector(V('text=Aliran kelulusan'));
  expect(true, 'butiran permohonan dipaparkan di sebelah senarai');
  await p.screenshot({ path: `${shots}/audit-kelulusan.png` });
  await p.locator(V('main >> div.cursor-pointer')).nth(1).click();
  await p.waitForTimeout(800);
  await p.click(V('main button:has-text("Lulus") >> nth=-1'));
  await p.waitForFunction(() => /Menunggu · 1/.test(document.querySelector('main')?.innerText ?? ''), null, { timeout: 15000 });
  expect(true, 'lulus dari panel butiran; senarai dikemas kini');

  log('2. Carian Ctrl+K');
  await p.keyboard.press('Control+k');
  await p.fill('[role=dialog][aria-label="Carian pantas"] input', 'zuer');
  await p.waitForSelector('[role=dialog][aria-label="Carian pantas"] button:has-text("Zuerin")');
  await p.keyboard.press('Enter');
  await p.waitForURL(/\/pengurusan\/pekerja\/[0-9a-f-]+$/);
  await p.waitForSelector(V('h1:has-text("Zuerin")'));
  expect(true, 'Ctrl+K → "zuer" → profil Zuerin');
  await p.click(V('summary:has-text("Lagi")'));
  expect(await p.locator(V('text=Tamatkan pekerjaan')).count() === 1, 'Profil Pekerja: tajuk & menu ⋯ Lagi (Tamatkan)');
  await p.keyboard.press('Control+k');
  await p.fill('[role=dialog][aria-label="Carian pantas"] input', 'sejarah');
  await p.waitForSelector('[role=dialog][aria-label="Carian pantas"] button:has-text("Sejarah gaji")');
  await p.keyboard.press('Enter');
  await p.waitForURL('**/pengurusan/gaji/sejarah');
  expect(true, 'Ctrl+K → tindakan "Sejarah gaji"');

  log('3. Gaji: data terkumpul');
  await p.click(V('a:has-text("Bulan ini")'));
  await p.waitForSelector(V('text=tiada data gaji terkumpul'));
  await p.click(V('a:has-text("Isi atau import Excel")'));
  await p.waitForURL('**/pengurusan/gaji/data-terkumpul');
  for (const nama of ['Sadam', 'Lily', 'Zuerin', 'Amin', 'Farah', 'Zulfa']) {
    await p.fill(`input[aria-label="gross ${nama}"]`, '30000');
    await p.fill(`input[aria-label="epf ${nama}"]`, '3300');
    await p.fill(`input[aria-label="pcb ${nama}"]`, '400');
  }
  await p.click(V('button:has-text("Simpan semua")'));
  await p.waitForSelector(V('text=6 pekerja disimpan'));
  await p.goto(BASE + '/pengurusan/gaji');
  await p.waitForSelector(V('text=Semak data'));
  await p.waitForTimeout(1500);
  expect(!(await p.locator(V('text=tiada data gaji terkumpul')).count()), 'amaran PCB hilang selepas data terkumpul diisi');

  log('4. Jadual Pekerja');
  await p.goto(BASE + '/pengurusan/pekerja');
  await p.waitForSelector(V('table'));
  await p.selectOption('select[aria-label="Tapis jabatan"]', 'Pelancongan');
  expect((await p.locator(V('table tbody tr')).count()) === 3, 'tapis jabatan Pelancongan: 3 pekerja');
  await p.click(V('th button:has-text("NAMA")'));
  const n1 = await p.locator(V('table tbody tr')).first().innerText();
  await p.click(V('th button:has-text("NAMA")'));
  const n2 = await p.locator(V('table tbody tr')).first().innerText();
  expect(n1.includes('Amin') && n2.includes('Zulfa'), 'isih nama menaik / menurun');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click(V('button:has-text("Eksport CSV")'))]);
  expect(dl.suggestedFilename() === 'pekerja-DEMO.csv', 'eksport CSV');

  log('5. Loceng pemberitahuan');
  await p.goto(BASE + '/pengurusan');
  await p.click(V('button[aria-label^="Pemberitahuan"]'));
  await p.waitForSelector(V('[role=dialog][aria-label="Pemberitahuan"]'));
  expect(true, 'panel pemberitahuan dibuka');
  await ctx.close();

  log('6. Telefon: carian & butang tambah');
  ({ ctx, p } = await masuk(b, 'lily@demo.hrboost.io', { width: 390, height: 844 }));
  await p.waitForSelector(V('text=PERLU TINDAKAN ANDA'));
  expect(await p.locator(V('a[aria-label="Tambah pekerja"]')).count() === 1, 'butang + Tambah pekerja (telefon)');
  await p.click(V('button[aria-label="Cari pekerja"]'));
  await p.fill('[role=dialog][aria-label="Carian pantas"] input', 'farah');
  await p.waitForSelector('[role=dialog][aria-label="Carian pantas"] button:has-text("Farah")');
  await p.keyboard.press('Enter');
  await p.waitForSelector(V('h1:has-text("Farah")'));
  expect(true, 'carian di telefon → profil Farah');
  await ctx.close();

  await b.close();
  log('LULUS: audit HR');
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
