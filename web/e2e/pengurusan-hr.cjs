// Ujian hujung-ke-hujung Fasa D3: HR (Lily) — papan pemuka, senarai pekerja, tambah & jemput
// pekerja baharu, buka maklumat sensitif, sahkan tukar akaun bank Amin, ubah gaji, muat naik dokumen.
// Prasyarat: `npx supabase db reset` (data demo), aplikasi di localhost:3000.
// Jalankan: node web/e2e/pengurusan-hr.cjs
const os = require('os');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
require('./_bahasa.cjs');
const { emelDemo } = require('./_demo.cjs');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const shots = process.env.E2E_SHOTS || os.tmpdir();
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };

async function login(browser, phone) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.addInitScript(() => { const st = document.createElement('style'); st.textContent = '#nl-badge-frame{display:none!important}'; document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st)); });
  p.on('pageerror', (e) => log('   [ralat halaman]', e.message));
  await p.goto(BASE + '/masuk');
  await p.fill('input[type=email]', emelDemo(phone));
  await p.fill('input[autocomplete=current-password]', 'Demo1234');
  await p.click('button[type=submit]');
  await p.waitForURL(/\/(utama|pengurusan)$/, { timeout: 15000 });
  return { ctx, p };
}

(async () => {
  const browser = await chromium.launch();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hrb-dok-'));
  const dok = path.join(tmp, 'tawaran.pdf');
  fs.writeFileSync(dok, '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

  log('1. Amin: mohon tukar akaun bank');
  let { ctx, p } = await login(browser, '100000004');
  await p.goto(BASE + '/profil/ubah');
  await p.waitForSelector('text=PERLU DISAHKAN HR');
  await p.selectOption('select[aria-label="Bank baharu"]', 'CIMB Bank');
  await p.fill('input[aria-label="No. akaun baharu"]', '8000123456');
  await p.click('button:has-text("Simpan")');
  await p.waitForSelector('text=menunggu pengesahan HR');
  expect(true, 'permohonan tukar bank dihantar');
  const amin = { ctx, p }; // dikekalkan untuk langkah 5 (elak had kekerapan OTP)

  log('2. Lily (HR): papan pemuka & senarai pekerja');
  ({ ctx, p } = await login(browser, '100000002'));
  await p.goto(BASE + '/saya');
  await p.click('a:has-text("Papan Pemuka Syarikat")');
  await p.waitForSelector('text=PERLU TINDAKAN ANDA');
  await p.waitForSelector('text=Pertukaran akaun bank Amin menunggu pengesahan');
  expect(true, 'papan pemuka menunjukkan pertukaran bank menunggu');
  await p.screenshot({ path: `${shots}/d3-dashboard.png` });
  await p.goto(BASE + '/pengurusan/pekerja');
  await p.waitForSelector('text=Amin');
  expect(/Semua · \d+/.test(await p.innerText('main')), 'senarai pekerja dengan bilangan');
  await p.screenshot({ path: `${shots}/d3-pekerja.png` });

  log('3. Lily: tambah Nurin & jemput');
  await p.click('a[aria-label="Tambah pekerja"]');
  await p.waitForURL('**/pengurusan/pekerja/baru');
  await p.fill('input[placeholder="Nama seperti dalam kad pengenalan"]', 'Nurin Syafiqah binti Demo');
  await p.fill('input[placeholder="Contoh: Nurin"]', 'Nurin');
  await p.fill('input[type=tel]', '0110000 0099');
  await p.fill('input[placeholder="981128-14-5521"]', '981128145521');
  await p.fill('input[placeholder="Eksekutif"]', 'Eksekutif Tour');
  await p.fill('input[placeholder="0.00"]', '2500');
  await p.screenshot({ path: `${shots}/d3-tambah.png` });
  await p.click('button:has-text("Simpan & jemput")');
  await p.waitForURL(/\/pengurusan\/pekerja\/[0-9a-f-]+\?jemput=1/);
  await p.waitForSelector('text=Belum aktif');
  const t = await p.innerText('main');
  expect(t.includes('/jemputan/') && t.includes('Percubaan') === false, 'pautan jemputan dipaparkan untuk pekerja baharu');
  await p.screenshot({ path: `${shots}/d3-nurin.png` });

  log('4. Lily: profil Amin — maklumat sensitif, sahkan bank, ubah gaji, dokumen');
  await p.goto(BASE + '/pengurusan/pekerja');
  await p.click('a:has-text("Amin")');
  await p.waitForSelector('text=No. pekerja');
  // IC bertopeng sehingga HR menekan "Tunjuk"
  await p.waitForSelector('text=951109••••••34 >> visible=true');
  await p.click('button:has-text("Tunjuk") >> visible=true');
  await p.waitForSelector('text=951109-14-1234');
  expect(true, 'HR terus melihat kad pengenalan & bank (tanpa butang Papar)');
  await p.click('button:has-text("Sahkan akaun")');
  await p.waitForSelector('text=Mohon tukar akaun bank', { state: 'detached' });
  expect((await p.innerText('main')).includes('CIMB Bank · 8000123456'), 'akaun bank Amin disahkan');
  await p.click('button:has-text("Ubah gaji & jawatan")');
  await p.fill('label:has-text("Gaji pokok baharu") input', '3200');
  await p.click('[role=dialog] button:has-text("Simpan")');
  await p.waitForSelector('[role=dialog]', { state: 'detached' });
  await p.click('button[role=tab]:has-text("Gaji")');
  await p.waitForSelector('text=RM 3,200.00');
  await p.waitForSelector('text=Gaji bersih');
  expect(true, 'gaji pokok dikemas kini kepada RM3,200; KWSP/PERKESO/bersih dipaparkan terus');
  await p.click('button[role=tab]:has-text("Dokumen")');
  await p.setInputFiles('input[aria-label="Pilih fail dokumen"]', dok);
  await p.waitForSelector('text=Surat tawaran ·');
  expect(true, 'dokumen dimuat naik ke folder pekerja');
  await p.screenshot({ path: `${shots}/d3-dokumen.png` });
  await ctx.close();

  log('5. Amin: akaun bank baharu dipaparkan; tiada akses pengurusan');
  ({ ctx, p } = amin);
  await p.goto(BASE + '/profil');
  await p.waitForSelector('text=No. akaun');
  const prof = await p.innerText('main');
  expect(prof.includes('CIMB Bank') && prof.includes('•••• •••• 3456'), 'profil Amin menunjukkan CIMB •••• 3456');
  await p.goto(BASE + '/pengurusan/pekerja');
  await p.waitForSelector('text=Tiada akses');
  expect(true, 'pekerja biasa tidak boleh membuka Pengurusan');
  await ctx.close();
  await browser.close();
  log('LULUS: pengurusan HR');
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
