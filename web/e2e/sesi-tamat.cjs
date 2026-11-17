// Ujian sesi hilang semasa orientasi: sesi dibuang daripada pelayar (cth. diganti oleh tab lain) →
// "Simpan & seterusnya" tidak memaparkan "permission denied", tetapi membawa ke /masuk?seterusnya=…,
// dan selepas log masuk semula pengguna kembali ke halaman yang sama dan boleh menyimpan.
// Prasyarat: `npx supabase db reset` (data demo), aplikasi di localhost:3000. Jalankan: node web/e2e/sesi-tamat.cjs
const { chromium } = require('playwright');
require('./_bahasa.cjs');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };

async function logMasuk(p) {
  await p.fill('input[type=email]', 'amin@demo.hrboost.io');
  await p.fill('input[autocomplete=current-password]', 'Demo1234');
  await p.click('button[type=submit]');
}

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const ralat = [];
  p.on('response', (r) => { if (r.url().includes('save_onboarding_step') && r.status() >= 400) ralat.push(r.status()); });

  log('1. Log masuk & buka Orientasi → Nama');
  await p.goto(BASE + '/masuk');
  await logMasuk(p);
  await p.waitForURL(/\/(utama|pengurusan)$/, { timeout: 30000 });
  await p.goto(BASE + '/orientasi/nama');
  await p.waitForSelector('button:has-text("Simpan")', { timeout: 20000 });

  log('2. Sesi dibuang daripada pelayar (seperti diganti tab lain), kemudian tekan Simpan');
  await p.evaluate(() => {
    for (const s of [localStorage, sessionStorage]) for (const k of Object.keys(s)) if (k.startsWith('sb-')) s.removeItem(k);
  });
  await p.click('button:has-text("Simpan")');
  await p.waitForURL(/\/masuk\?seterusnya=%2Forientasi%2Fnama/, { timeout: 20000 });
  expect(true, 'dibawa ke log masuk dengan seterusnya=/orientasi/nama');
  expect(!(await p.innerText('body')).includes('permission denied'), 'tiada mesej "permission denied"');

  log('3. Log masuk semula → kembali ke Orientasi → Nama dan simpan berjaya');
  await logMasuk(p);
  await p.waitForURL(/\/orientasi\/nama$/, { timeout: 30000 });
  expect(true, 'kembali ke /orientasi/nama');
  ralat.length = 0;
  await p.waitForSelector('button:has-text("Simpan")');
  await p.click('button:has-text("Simpan")');
  await p.waitForResponse((r) => r.url().includes('save_onboarding_step'), { timeout: 20000 });
  await p.waitForTimeout(500);
  // Amin (data demo) telah menyiapkan orientasi: pelayan memulangkan 'Langkah ini telah selesai' (400), bukan 401
  expect(!ralat.includes(401), `permintaan dihantar dengan sesi log masuk (status: ${ralat.join(',') || 200})`);
  expect(!(await p.innerText('main')).includes('permission denied'), 'tiada mesej "permission denied"');

  await b.close();
  log('LULUS: sesi tamat semasa orientasi');
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
