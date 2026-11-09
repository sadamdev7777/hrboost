// Ujian hujung-ke-hujung Fasa G: syarikat baharu mendaftar sendiri (laman utama → daftar → OTP),
// melengkapkan 6 langkah persediaan (import CSV, ketua jabatan, peranan, jemputan), kemudian
// Pentadbir Platform (Owner) melihat syarikat itu, menyahaktif & mengaktifkan semula.
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000. Nombor ujian 60100000008 (OTP 123456).
// Jalankan: node web/e2e/syarikat-baharu.cjs
const os = require('os');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
require('./_bahasa.cjs');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const shots = process.env.E2E_SHOTS || os.tmpdir();
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };

(async () => {
  const browser = await chromium.launch();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hrb-import-'));
  const csv = path.join(tmp, 'senarai_staff.csv');
  fs.writeFileSync(csv, [
    'Nama Pekerja,Panggilan,H/P,No KP,Bahagian,Designation,Report To,Date Joined,Basic Salary',
    'SITI AMINAH BINTI ALI,Siti,012-3456781,900101-14-5678,Operasi,Pengurus,,01/03/2020,4500',
    'AHMAD FIRDAUS BIN RAHMAN,Firdaus,019-8765432,950505-10-1234,Operasi,Eksekutif,Siti Aminah Binti Ali,15/01/2024,3000',
    'KAMAL HISHAM BIN OMAR,Kamal,011-22223333,920202-08-5555,Tiket,Eksekutif,,01/06/2023,2800',
    'NUR AISYAH BINTI RAHIM,Aisyah,,980808-14-4444,Akaun,Kerani,,01/02/2025,2500',
  ].join('\n'));

  log('1. Laman utama → Daftar syarikat → OTP');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.addInitScript(() => { const st = document.createElement('style'); st.textContent = '#nl-badge-frame{display:none!important}'; document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st)); });
  p.on('pageerror', (e) => log('   [ralat halaman]', e.message));
  await p.goto(BASE + '/');
  await p.waitForSelector('text=Urus HR syarikat terus melalui WhatsApp.');
  await p.screenshot({ path: `${shots}/g-home.png`, fullPage: false });
  await p.click('a:has-text("Daftar syarikat — percuma")');
  await p.waitForURL('**/daftar');
  await p.fill('input[placeholder^="Contoh: Syarikat ABC"]', 'Syarikat Ujian Kenari Sdn Bhd');
  await p.click('button:has-text("1–10")');
  await p.fill('input[placeholder="Nama anda"]', 'Faizal bin Hashim');
  await p.fill('input[type=tel]', '0100000008');
  await p.fill('input[type=email]', 'faizal@kenari.my');
  await p.check('input[type=checkbox]');
  await p.screenshot({ path: `${shots}/g-daftar.png` });
  await p.click('button:has-text("Daftar & hantar kod WhatsApp")');
  await p.waitForURL('**/daftar/sahkan');
  await p.fill('input[autocomplete=one-time-code]', '123456');
  await p.click('button:has-text("Sahkan & cipta syarikat")');
  await p.waitForURL('**/akaun/kata-laluan**', { timeout: 20000 });
  await p.fill('input[type=email]', 'faizal@kenari.my');
  await p.locator('input[autocomplete=new-password]').nth(0).fill('Rahsia123');
  await p.locator('input[autocomplete=new-password]').nth(1).fill('Rahsia123');
  await p.click('button:has-text("Simpan & teruskan")');
  expect(true, 'langkah wajib: e-mel & kata laluan ditetapkan selepas OTP pertama');
  await p.waitForURL('**/mula', { timeout: 20000 });
  await p.waitForSelector('text=1 daripada 6 selesai');
  expect(true, 'syarikat dicipta; Faizal menjadi Pentadbir');
  await p.screenshot({ path: `${shots}/g-mula.png` });

  log('2. Langkah 2: maklumat syarikat (kod KENARI)');
  await p.click('a:has-text("Teruskan")');
  await p.waitForURL('**/mula/syarikat');
  await p.fill('label:has-text("Kod pendek") input', 'KNR');
  await p.selectOption('label:has-text("Negeri") select', 'Selangor');
  await p.click('button:has-text("Simpan & seterusnya")');
  await p.waitForURL('**/mula/import');
  expect(true, 'maklumat syarikat disimpan');

  log('3. Langkah 3: import CSV (lajur berbeza dipadankan automatik)');
  await p.setInputFiles('input[aria-label="Pilih fail Excel pekerja"]', csv);
  await p.waitForSelector('text=Sistem menemui 4 pekerja.');
  const t3 = await p.innerText('main');
  expect(t3.includes('Tiada no. WhatsApp') && t3.includes('Tiada ketua'), 'isu dikesan: tiada WhatsApp (Aisyah), tiada ketua (Tiket/Akaun)');
  await p.screenshot({ path: `${shots}/g-import.png` });
  await p.click('button:has-text("Import 4 pekerja")');
  await p.waitForURL('**/mula/jabatan', { timeout: 20000 });
  expect(true, '4 pekerja diimport');

  log('4. Langkah 4: ketua jabatan (butang dikunci hingga semua ada ketua)');
  await p.waitForSelector('text=Operasi');
  await p.waitForSelector('button:has-text("jabatan belum mempunyai ketua")');
  await p.screenshot({ path: `${shots}/g-jabatan.png` });
  for (let i = 0; i < 3; i++) {
    const b = p.locator('button:has-text("Pilih ketua")').first();
    if (!(await b.count())) break;
    await b.click();
    await p.click('[role=dialog] button:has-text("Tetapkan ketua")');
    await p.waitForSelector('[role=dialog]', { state: 'detached' });
  }
  await p.click('button:has-text("Simpan & seterusnya")');
  await p.waitForURL('**/mula/peranan');
  expect(true, 'semua jabatan mempunyai ketua');

  log('5. Langkah 5: peranan — tambah Kewangan');
  await p.click('button[aria-label="Tambah Kewangan"]');
  await p.selectOption('[role=dialog] select', { label: 'Aisyah · KNR005' });
  await p.click('[role=dialog] button:has-text("Tambah")');
  await p.waitForSelector('[role=dialog]', { state: 'detached' });
  await p.waitForSelector('text=Aisyah');
  await p.screenshot({ path: `${shots}/g-peranan.png` });
  await p.click('button:has-text("Simpan & seterusnya")');
  await p.waitForURL('**/mula/jemput');

  log('6. Langkah 6: jemput');
  await p.waitForSelector('text=Aisyah — tiada WhatsApp');
  await p.screenshot({ path: `${shots}/g-jemput.png` });
  await p.click('button:has-text("Hantar 3 jemputan sekarang")');
  await p.waitForURL('**/mula/selesai');
  await p.waitForSelector('text=sudah sedia!');
  const t6 = await p.innerText('main');
  expect(t6.includes('3 jemputan dihantar') && t6.includes('Salin pautan'), '3 jemputan WhatsApp + pautan disalin untuk Aisyah');
  await p.screenshot({ path: `${shots}/g-selesai.png` });
  await ctx.close();

  log('7. Pentadbir Platform: konsol /admin');
  const a = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const q = await a.newPage();
  q.on('pageerror', (e) => log('   [ralat halaman]', e.message));
  await q.goto(BASE + '/masuk/telefon');
  await q.fill('input[type=tel]', '100000007');
  await q.click('button:has-text("Hantar kod")');
  await q.waitForURL('**/masuk/kod');
  await q.fill('input[autocomplete=one-time-code]', '123456');
  await q.waitForURL('**/admin', { timeout: 15000 });
  await q.waitForSelector('text=Ringkasan platform');
  await q.screenshot({ path: `${shots}/g-sa-dashboard.png` });
  expect(true, 'Pentadbir Platform terus ke konsol /admin');
  await q.click('nav >> text=Syarikat');
  await q.waitForSelector('text=SYARIKAT UJIAN KENARI SDN BHD');
  const tSa = await q.innerText('main');
  expect(!tSa.includes('900101') && !tSa.includes('4500'), 'tiada IC atau gaji dipaparkan kepada Pentadbir Platform');
  await q.click('tr:has-text("KENARI") >> text=Lihat');
  await q.waitForSelector('text=Zon bahaya');
  await q.click('button:has-text("Nyahaktifkan syarikat")');
  await q.click('button:has-text("Ya, nyahaktifkan")');
  await q.waitForSelector('text=Aktifkan semula');
  await q.screenshot({ path: `${shots}/g-sa-butiran.png` });
  await q.click('button:has-text("Aktifkan semula")');
  await q.waitForSelector('button:has-text("Nyahaktifkan syarikat")');
  expect(true, 'syarikat dinyahaktif dan diaktifkan semula');
  await q.click('nav >> text=Log audit');
  await q.waitForSelector('text=Nyahaktifkan syarikat');
  await q.screenshot({ path: `${shots}/g-sa-log.png` });
  expect(true, 'tindakan direkod dalam log audit');
  for (const [m, teks] of [['Pengguna', 'SYARIKAT · PERANAN'], ['Permohonan akses', 'MENUNGGU KELULUSAN'], ['Tetapan platform', 'PENDAFTARAN & HAD']]) {
    await q.click(`nav >> text=${m}`);
    await q.waitForSelector(`text=${teks}`);
  }
  expect(true, 'semua halaman konsol dibuka');
  await a.close();
  await browser.close();
  log('LULUS: syarikat baharu & Pentadbir Platform');
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
