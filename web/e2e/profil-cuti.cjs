// Ujian hujung-ke-hujung Fasa D2: Cuti (baki, kalendar pasukan, cuti umum), Profil,
// Ubah Profil (nama panggilan, waris, sembunyi hari jadi, tukar bank -> menunggu HR), Hari Jadi.
// Prasyarat: `npx supabase db reset` (data demo), aplikasi di localhost:3000.
// Jalankan: node web/e2e/profil-cuti.cjs
const os = require('os');
const { chromium } = require('playwright');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const shots = process.env.E2E_SHOTS || os.tmpdir();
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };

async function login(browser, phone) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  // Lencana Netlify di staging menutup butang bawah
  await p.addInitScript(() => { const st = document.createElement('style'); st.textContent = '#nl-badge-frame{display:none!important}'; document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st)); });
  p.on('pageerror', (e) => log('   [ralat halaman]', e.message));
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

  log('1. Amin: skrin Cuti');
  let { ctx, p } = await login(browser, '100000004');
  await p.goto(BASE + '/cuti');
  await p.waitForSelector('text=Tahunan');
  await p.waitForSelector('text=Pasukan');
  expect(await p.isVisible('text=Sakit (MC)'), 'baki Tahunan & Sakit (MC) dipaparkan');
  await p.click('button[aria-label="Bulan seterusnya"]');
  await p.waitForSelector('h2:has-text("Disember 2026")');
  await p.waitForSelector('span[title="Hari Krismas"]');
  expect(true, 'kalendar Disember menunjukkan Hari Krismas sebagai cuti umum');
  await p.screenshot({ path: `${shots}/d2-cuti.png` });

  log('2. Amin: Profil & Ubah Profil');
  await p.goto(BASE + '/profil');
  await p.waitForSelector('text=No. kad pengenalan');
  const teks = await p.innerText('main');
  expect(teks.includes('••••••-••-1234') && !teks.includes('951109'), 'no. kad pengenalan disorok');
  await p.screenshot({ path: `${shots}/d2-profil.png` });
  await p.click('a:has-text("Ubah")');
  await p.waitForURL('**/profil/ubah');
  await p.waitForSelector('text=BOLEH DIUBAH SENDIRI');
  await p.fill('label:has-text("Nama panggilan") input', 'Amin Z');
  await p.fill('label:has-text("Waris") input', 'Ibu Amin');
  await p.selectOption('label:has-text("Hubungan") select', 'Ibu');
  await p.fill('label:has-text("Telefon waris") input', '0123456789');
  await p.click('button[role=switch]');
  await p.selectOption('select[aria-label="Bank baharu"]', 'Maybank');
  await p.fill('input[aria-label="No. akaun baharu"]', '1234 5678 9012');
  await p.screenshot({ path: `${shots}/d2-ubah.png` });
  await p.click('button:has-text("Simpan")');
  await p.waitForURL('**/profil');
  await p.waitForSelector('text=menunggu pengesahan HR');
  const selepas = await p.innerText('main');
  expect(selepas.includes('Amin Z') && selepas.includes('Ibu Amin'), 'nama panggilan & waris dikemas kini');
  expect(selepas.includes('Maybank •••• •••• 9012'), 'tukar bank menunggu pengesahan HR (akaun lama kekal)');
  await ctx.close();

  log('3. Zulfa: Hari Jadi');
  ({ ctx, p } = await login(browser, '100000006'));
  await p.goto(BASE + '/hari-jadi');
  await p.waitForSelector('text=Minggu ini');
  await p.click('button[role=tab]:has-text("Bulan ini")');
  await p.waitForTimeout(500);
  const hj = await p.innerText('main');
  // Amin menyembunyikan hari jadi dalam langkah 2, jadi tidak lagi disenaraikan
  expect(!hj.includes('Amin'), 'hari jadi yang disembunyikan tidak dipaparkan');
  expect(!/\b(19|20)\d\d\b/.test(hj.replace('2026', '')), 'tiada tahun lahir dipaparkan');
  await p.screenshot({ path: `${shots}/d2-harijadi.png` });
  await ctx.close();

  await browser.close();
  log('LULUS: Cuti, Profil, Ubah Profil dan Hari Jadi');
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
