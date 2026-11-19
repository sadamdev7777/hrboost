// Ujian hujung-ke-hujung: daftar masuk / keluar melalui telefon (GPS + swafoto).
//  1. Lily (HR, komputer): Tetapan → Kehadiran → hidupkan & tambah lokasi "Pejabat HQ" (Guna lokasi saya sekarang).
//  2. Amin (telefon 390px, ~45 m dari pejabat): Utama → Daftar masuk → lokasi + swafoto → "Di Pejabat HQ".
//  3. Amin (~16 km dari pejabat): Daftar keluar → "Luar lokasi"; kad Utama menunjukkan masuk & keluar.
//  4. Lily: Kehadiran harian → Amin ditanda "Luar lokasi", pautan Peta & Swafoto; akses swafoto direkod.
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000. Jalankan: node web/e2e/kehadiran-gps.cjs
const os = require('os');
const { execSync } = require('child_process');
const { chromium } = require('playwright');
require('./_bahasa.cjs');
const { emelDemo } = require('./_demo.cjs');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const shots = process.env.E2E_SHOTS || os.tmpdir();
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };
const sql = (q) => execSync(`psql -h 127.0.0.1 -p 54322 -U postgres -Atc "${q.replace(/"/g, '\\"')}"`, { env: { ...process.env, PGPASSWORD: 'postgres' } }).toString().trim();
// Gambar PNG 8x8 (swafoto ujian)
const SWAFOTO = { name: 'swafoto.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC', 'base64') };
const HQ = { latitude: 3.073800, longitude: 101.518300 };

async function login(browser, phone, viewport, geolocation) {
  const ctx = await browser.newContext({ viewport, geolocation, permissions: ['geolocation'] });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => log('   [ralat halaman]', e.message));
  await p.goto(BASE + '/masuk');
  await p.fill('input[type=email]', emelDemo(phone));
  await p.fill('input[autocomplete=current-password]', 'Demo1234');
  await p.click('button[type=submit]');
  await p.waitForURL(/\/(utama|pengurusan)$/, { timeout: 30000 });
  return { ctx, p };
}

(async () => {
  const AMIN = sql(`select id from employments where employee_no = 'DEMO004'`);
  // Keadaan awal (ujian boleh diulang)
  sql(`delete from attendance_punches where source = 'gps'; delete from attendance_records where source in ('gps','campuran'); delete from company_locations; delete from data_access_log where resource = 'attendance_selfie'; update companies set gps_attendance = false where code = 'DEMO'`);
  const browser = await chromium.launch();

  log('1. Lily: hidupkan daftar masuk telefon & tambah lokasi');
  const lily = await login(browser, '100000002', { width: 1280, height: 900 }, HQ);
  let p = lily.p;
  await p.goto(BASE + '/pengurusan/tetapan/kehadiran');
  const suis = p.locator('button[role=switch][aria-label="Benarkan daftar masuk melalui telefon"]');
  await suis.waitFor({ timeout: 20000 });
  expect((await suis.getAttribute('aria-checked')) === 'false', 'dimatikan secara lalai');
  await suis.click();
  await p.waitForSelector('button[role=switch][aria-label="Benarkan daftar masuk melalui telefon"][aria-checked=true]');
  await p.click('button:has-text("+ Tambah lokasi")');
  await p.fill('[role=dialog] input[placeholder="Contoh: Pejabat HQ"]', 'Pejabat HQ');
  await p.click('[role=dialog] button:has-text("Guna lokasi saya sekarang")');
  await p.waitForFunction(() => document.querySelector('[role=dialog] input[placeholder="3.139003"]')?.value === '3.073800', null, { timeout: 15000 }).catch(async (e) => { console.log(await p.innerText('[role=dialog]')); throw e; });
  await p.fill('[role=dialog] label:has-text("Radius") input', '200');
  await p.click('[role=dialog] button:has-text("Simpan")');
  await p.waitForSelector('[data-lokasi="Pejabat HQ"]');
  // Komputer tanpa lokasi: tampal pautan Google Maps
  await p.click('button:has-text("+ Tambah lokasi")');
  await p.fill('[role=dialog] input[placeholder="Contoh: Pejabat HQ"]', 'Cawangan');
  await p.fill('[role=dialog] label:has-text("tampal pautan") input', 'https://www.google.com/maps/place/X/@3.1,101.6,17z/data=!3m1!4b1!3d3.139003!4d101.686855');
  expect((await p.inputValue('[role=dialog] input[placeholder="3.139003"]')) === '3.139003', 'pautan Google Maps → koordinat diisi');
  await p.click('[role=dialog] button:has-text("Simpan")');
  await p.waitForSelector('[data-lokasi="Cawangan"]');
  await p.locator('[data-lokasi="Cawangan"] button:has-text("Padam")').click();
  await p.click('[role=dialog] button:has-text("Padam"), [role=alertdialog] button:has-text("Padam")');
  await p.waitForSelector('[data-lokasi="Cawangan"]', { state: 'detached' });
  expect(sql(`select gps_attendance from companies where code = 'DEMO'`) === 't', 'GPS dihidupkan');
  expect(sql(`select lat || ',' || lng || ',' || radius_m from company_locations where name = 'Pejabat HQ'`) === '3.073800,101.518300,200', 'lokasi disimpan daripada GPS komputer');
  await p.screenshot({ path: `${shots}/gps-tetapan.png`, fullPage: true });

  log('2. Amin: daftar masuk dalam lokasi');
  const amin = await login(browser, '100000004', { width: 390, height: 844 }, { latitude: 3.0742, longitude: 101.5183 });
  const q = amin.p;
  await q.goto(BASE + '/utama');
  const kad = q.locator('section[aria-label="Kehadiran hari ini"]');
  await kad.waitFor({ timeout: 20000 });
  expect((await kad.innerText()).includes('Belum daftar masuk'), 'kad Utama: belum daftar masuk');
  await kad.locator('a:has-text("Daftar masuk")').click();
  await q.waitForURL('**/kehadiran/daftar');
  await q.waitForSelector('text=Lokasi dikesan');
  const btn = q.locator('.bar-bawah button:has-text("Daftar masuk")');
  expect(await btn.isDisabled(), 'butang dikunci sebelum swafoto');
  await q.setInputFiles('input[capture=user]', SWAFOTO);
  await q.waitForSelector('img[alt="Swafoto yang diambil"]');
  await q.screenshot({ path: `${shots}/gps-daftar.png`, fullPage: true });
  await btn.click();
  await q.waitForSelector('text=Daftar masuk direkod', { timeout: 20000 });
  expect((await q.innerText('main')).includes('Di Pejabat HQ'), 'dalam lokasi: "Di Pejabat HQ"');
  expect(sql(`select source || ',' || kind || ',' || outside || ',' || (selfie_path like person_id || '/%') from attendance_punches ap join employments e on e.id = ap.employment_id where ap.employment_id = '${AMIN}'`) === 'gps,in,false,true', 'punch GPS dengan swafoto dalam folder Amin');
  expect(sql(`select source from attendance_records where employment_id = '${AMIN}' and work_date = (now() at time zone 'Asia/Kuala_Lumpur')::date`) === 'gps', 'rekod kehadiran hari ini');

  log('3. Amin: daftar keluar di luar lokasi');
  sql(`update attendance_punches set punched_at = punched_at - interval '3 minutes' where employment_id = '${AMIN}'`);
  await amin.ctx.setGeolocation({ latitude: 3.139, longitude: 101.6869 });
  await q.goto(BASE + '/kehadiran/daftar');
  await q.waitForSelector('text=Lokasi dikesan');
  await q.setInputFiles('input[capture=user]', SWAFOTO);
  await q.click('.bar-bawah button:has-text("Daftar keluar")');
  await q.waitForSelector('text=Daftar keluar direkod', { timeout: 20000 });
  const hasil = await q.innerText('main');
  expect(hasil.includes('Luar lokasi') && /dari Pejabat HQ/.test(hasil), 'luar lokasi ditanda dengan jarak: ' + hasil.replace(/\s+/g, ' ').slice(0, 120));
  await q.screenshot({ path: `${shots}/gps-luar.png`, fullPage: true });
  await q.click('a:has-text("Selesai")');
  await kad.waitFor();
  await q.waitForFunction(() => /Keluar/.test(document.querySelector('section[aria-label="Kehadiran hari ini"]')?.textContent || ''));
  expect((await kad.innerText()).includes('Luar lokasi'), 'kad Utama: masuk, keluar & luar lokasi');
  await q.goto(BASE + '/kehadiran');
  await q.waitForSelector('text=Telefon');
  expect(true, 'Kehadiran saya: sumber telefon');
  await amin.ctx.close();

  log('4. Lily: Kehadiran harian');
  await p.goto(BASE + '/pengurusan/kehadiran');
  const baris = p.locator('tr', { hasText: 'Amin' });
  await baris.waitFor({ timeout: 20000 });
  const t = await baris.innerText();
  expect(t.includes('Luar lokasi') && t.includes('Peta') && t.includes('Swafoto'), 'Amin ditanda luar lokasi; peta & swafoto');
  const [tab] = await Promise.all([lily.ctx.waitForEvent('page'), baris.locator('button:has-text("Swafoto")').first().click()]);
  await tab.waitForLoadState().catch(() => {});
  expect(/peribadi/.test(tab.url()), 'swafoto dibuka melalui URL bertandatangan');
  expect(sql(`select count(*) from data_access_log where resource = 'attendance_selfie'`) === '1', 'akses swafoto direkod');
  await p.screenshot({ path: `${shots}/gps-hr.png`, fullPage: true });
  await lily.ctx.close();

  await browser.close();
  log('\nLULUS: kehadiran GPS');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
