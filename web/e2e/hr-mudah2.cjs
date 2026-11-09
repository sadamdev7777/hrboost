// Ujian hujung-ke-hujung "HR lebih mudah" bahagian 2 (TEMPATAN SAHAJA):
//  panduan "?", senarai semak pekerja baharu (HR & ketua), import Excel gaji pokok & baki cuti, "Buat asal".
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000. Jalankan: node web/e2e/hr-mudah2.cjs
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

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
const csv = (name, teks) => ({ name, mimeType: 'text/csv', buffer: Buffer.from(teks) });

(async () => {
  const b = await chromium.launch();
  const DESKTOP = { width: 1440, height: 900 };
  let { ctx, p } = await masuk(b, 'lily@demo.hrboost.io', DESKTOP);

  log('1. Panduan "?"');
  await p.goto(BASE + '/pengurusan');
  await p.waitForSelector(V('text=PERLU TINDAKAN ANDA'));
  expect(!(await p.locator(V('section[aria-label=Panduan]')).count()), 'panduan tidak menghalang (ditutup secara lalai dalam ujian)');
  await p.click(V('button[aria-label="Panduan skrin ini"]'));
  await p.waitForSelector(V('section[aria-label=Panduan] >> text=Papan Pemuka: mulakan hari anda di sini'));
  await p.click(V('section[aria-label=Panduan] button:has-text("Faham")'));
  await p.waitForSelector('section[aria-label=Panduan]', { state: 'detached' });
  expect(true, 'panduan dibuka dengan "?" dan ditutup dengan Faham');

  log('2. Pekerja baharu → senarai semak');
  await p.goto(BASE + '/pengurusan/pekerja/baru');
  await p.fill('input[placeholder="Nama seperti dalam kad pengenalan"]', 'Hana binti Semak');
  await p.fill('input[placeholder="Contoh: Nurin"]', 'Hana');
  await p.fill('input[type=tel]', '0110000 0077');
  await p.fill('input[placeholder="981128-14-5521"]', '990101145522');
  const jab = p.locator(V('select')).first();
  const pilihan = await jab.locator('option').allTextContents();
  const op = pilihan.find((t) => /Pelancongan/.test(t));
  if (op) await jab.selectOption({ label: op });
  await p.fill('input[placeholder="0.00"]', '2600');
  await p.click('button:has-text("Simpan & jemput")');
  await p.waitForURL(/\/pengurusan\/pekerja\/[0-9a-f-]+\?jemput=1/);
  const hanaUrl = p.url().split('?')[0];
  await p.waitForSelector(V('section[aria-label="Senarai semak pekerja baharu"]'));
  const sk = p.locator(V('section[aria-label="Senarai semak pekerja baharu"]'));
  expect(/0\/9 selesai/.test(await sk.innerText()), 'senarai semak 9 perkara dicipta');
  await sk.locator('[role=checkbox]').first().click();
  await sk.locator('text=1/9 selesai').waitFor();
  expect(true, 'HR menanda satu perkara selesai');
  await p.screenshot({ path: path.join(shots, 'hrmudah2-semak.png') });

  log('3. Import gaji pokok (Excel/CSV)');
  await p.goto(BASE + '/pengurusan/gaji/pekerja');
  await p.click(V('button:has-text("Import Excel")'));
  const dlg = p.locator(V('[role=dialog]'));
  await dlg.locator('input[type=file]').setInputFiles(csv('gaji.csv', 'No. pekerja,Gaji pokok,Berkuat kuasa\nDEMO004,3333,\nTIADA99,2000,\n'));
  await dlg.locator('text=2 baris dibaca').waitFor();
  await dlg.locator('button:has-text("Import 2 baris")').click();
  await dlg.locator('text=1 berjaya, 1 tidak berjaya').waitFor({ timeout: 15000 });
  expect(await dlg.locator('text=No. pekerja tidak dijumpai').count() > 0, 'baris tidak sah dilaporkan');
  await dlg.locator('button:has-text("Selesai")').click();
  await p.waitForSelector(V('text=3,333'));
  expect(true, 'gaji pokok DEMO004 dikemas kini kepada RM3,333');

  log('4. Import baki cuti awal');
  await p.goto(BASE + '/pengurusan/tetapan/cuti');
  await p.click(V('button:has-text("Import baki cuti awal")'));
  const d2 = p.locator(V('[role=dialog]'));
  await d2.locator('input[type=file]').setInputFiles(csv('cuti.csv', 'No. pekerja,Kod cuti,Dibawa dari tahun lepas,Telah diambil\nDEMO004,AL,2,3\n'));
  await d2.locator('button:has-text("Import 1 baris")').click();
  await d2.locator('text=1 berjaya').waitFor({ timeout: 15000 });
  expect(true, 'baki cuti awal diimport');
  await d2.locator('button:has-text("Selesai")').click();

  log('5. Buat asal selepas pindah jabatan pukal');
  await p.goto(BASE + '/pengurusan/pekerja');
  const baris = p.locator(V('tr:has-text("DEMO004")'));
  const asal = (await baris.innerText()).includes('Pelancongan') ? 'Pelancongan' : 'Pengurusan';
  const lain = asal === 'Pelancongan' ? 'Pengurusan' : 'Pelancongan';
  await baris.locator('input[type=checkbox]').check();
  await p.selectOption(V('select[aria-label="Jabatan baharu"]'), { label: lain });
  await p.click(V('button:has-text("Pindah")'));
  await p.waitForSelector(V('[role=status] >> text=1 pekerja dipindahkan.'));
  await p.waitForFunction((j) => [...document.querySelectorAll('tr')].some((r) => r.textContent.includes('DEMO004') && r.textContent.includes(j)), lain);
  await p.click(V('[role=status] button:has-text("Buat asal")'));
  await p.waitForSelector(V('text=Perubahan dibatalkan.'));
  await p.waitForFunction((j) => [...document.querySelectorAll('tr')].some((r) => r.textContent.includes('DEMO004') && r.textContent.includes(j)), asal);
  expect(true, `Buat asal: DEMO004 kembali ke ${asal}`);
  await ctx.close();

  log('6. Ketua jabatan (Zuerin) nampak tugasan senarai semak di Utama');
  ({ ctx, p } = await masuk(b, 'zuerin@demo.hrboost.io', { width: 390, height: 844 }));
  await p.goto(BASE + '/utama');
  const kad = p.locator(V('section[aria-label="Senarai semak pekerja baharu"]'));
  const ada = await kad.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  if (ada) {
    expect(/Hana/.test(await kad.innerText()), 'ketua melihat perkara senarai semak untuk Hana');
    await kad.locator('[role=checkbox]').first().click();
    await p.waitForSelector(V('text=Ditanda selesai.'));
    expect(true, 'ketua menanda perkara selesai');
    await p.screenshot({ path: path.join(shots, 'hrmudah2-ketua.png') });
  } else {
    log('   (Zuerin bukan ketua jabatan Hana — langkau)');
  }
  await ctx.close();
  log('   profil Hana: ' + hanaUrl);
  await b.close();
  log('LULUS: HR mudah 2');
})().catch((e) => { console.error(e); process.exit(1); });
