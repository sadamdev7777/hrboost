// Ujian laman utama awam (design/HomepageV2.dc.html): English lalai & BM, 1280px & 390px.
//  - tiada teks BM tertinggal dalam English; tiada dakwaan "balas LULUS" di WhatsApp
//  - seksyen demo & alat percuma disembunyikan (bendera lalai)
//  - tab skrin boleh digunakan dengan anak panah; kalkulator 25 pekerja → jimat RM4,601 setahun (selepas RM499)
//  - tiada bar daftar melekat; tiada limpahan mendatar; sasaran sentuh ≥ 44px
// Prasyarat: aplikasi di localhost:3000. Jalankan: node web/e2e/laman-utama.cjs
const os = require('os');
const { chromium } = require('playwright');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const shots = process.env.E2E_SHOTS || os.tmpdir();
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };
const BM = ['tiada', 'sila', 'untuk', 'dengan', 'belum', 'pekerja', 'cuti', 'gaji', 'tuntutan', 'kelulusan', 'tetapan', 'syarikat', 'permohonan',
  'diluluskan', 'menunggu', 'semak', 'tambah', 'lihat', 'baharu', 'jumlah', 'bulan', 'tahun', 'ketua', 'tarikh', 'tidak', 'anda', 'kami', 'akan', 'boleh', 'percuma'];

async function buka(browser, bahasa, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  if (bahasa) {
    await ctx.addCookies([{ name: 'hrb_bahasa', value: bahasa, url: BASE }]);
    await ctx.addInitScript((b) => { try { localStorage.setItem('hrb_bahasa', b); } catch {} }, bahasa);
  }
  const p = await ctx.newPage();
  const ralat = [];
  p.on('pageerror', (e) => ralat.push(e.message));
  await p.goto(BASE + '/');
  await p.waitForSelector('h1');
  await p.waitForTimeout(500);
  return { ctx, p, ralat };
}

async function semakUmum(p, label) {
  const teks = await p.innerText('body');
  expect(!/\bLULUS\b|\bTOLAK\b|balas .*WhatsApp|reply .*WhatsApp/i.test(teks), `${label}: tiada dakwaan balas LULUS/TOLAK di WhatsApp`);
  expect((await p.locator('#demo').count()) === 0 && (await p.locator('#alat').count()) === 0, `${label}: seksyen demo & alat percuma disembunyikan`);
  expect((await p.locator('a[href="#demo"], a[href="/demo"], a[href="/alat"], a[href="#"]').count()) === 0, `${label}: tiada pautan ke halaman kosong`);
  const limpah = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(limpah <= 0, `${label}: tiada limpahan mendatar`);
  const kecil = await p.evaluate(() =>
    [...document.querySelectorAll('a, button, summary')]
      .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden')
      .map((e) => ({ t: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 30), h: e.getBoundingClientRect().height }))
      .filter((x) => x.h < 44),
  );
  expect(kecil.length === 0, `${label}: sasaran sentuh ≥ 44px${kecil.length ? ' — ' + JSON.stringify(kecil) : ''}`);
}

(async () => {
  const browser = await chromium.launch();

  log('1. English (lalai), 1280px');
  let { ctx, p, ralat } = await buka(browser, null, { width: 1280, height: 900 });
  expect((await p.innerText('h1')).includes('Complete HR, without an HR officer'), 'tajuk English');
  const teksEn = (await p.innerText('body')).toLowerCase();
  const tinggal = BM.filter((w) => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(teksEn));
  expect(tinggal.length === 0, `tiada teks BM tertinggal${tinggal.length ? ': ' + tinggal.join(', ') : ''}`);
  await semakUmum(p, 'EN 1280');
  expect((await p.locator('a:text-is("Register free")').count()) === 0, 'tiada bar daftar melekat');
  // Tab: anak panah kanan
  const tab = p.locator('[role=tab]');
  expect((await tab.count()) === 4, '4 tab skrin');
  await tab.nth(0).focus();
  await p.keyboard.press('ArrowRight');
  expect((await tab.nth(1).getAttribute('aria-selected')) === 'true', 'anak panah kanan memilih tab kedua');
  expect((await p.locator('[role=tabpanel] img').getAttribute('src')).includes('pekerja-tuntutan'), 'imej skrin bertukar (Tuntutan)');
  await p.keyboard.press('ArrowLeft');
  await p.keyboard.press('ArrowLeft');
  expect((await tab.nth(3).getAttribute('aria-selected')) === 'true', 'anak panah kiri berpusing ke tab terakhir');
  // Kalkulator
  expect((await p.locator('output').innerText()).trim() === '20', 'kalkulator lalai 20 pekerja');
  await p.click('button[aria-label="More employees"]');
  expect((await p.locator('output').innerText()).trim() === '25', '+ menjadi 25');
  expect((await p.innerText('body')).includes('Save up to RM4,601 a year.'), 'jimat RM4,601 setahun (25 × 17 × 12 − RM499)');
  expect(!(await p.innerText('body')).includes('SAHKAN'), 'nota anggaran tanpa [SAHKAN SEBELUM DITERBITKAN]');
  for (let i = 0; i < 12; i++) await p.click('button[aria-label="More employees"]').catch(() => {});
  expect((await p.locator('output').innerText()).trim() === '50', 'had maksimum 50');
  await p.click('button[aria-label="More employees"]', { force: true }).catch(() => {});
  expect((await p.locator('output').innerText()).trim() === '50', 'kekal 50');
  await p.screenshot({ path: `${shots}/laman-en-1280.png`, fullPage: true });
  const meta = await p.evaluate(() => [document.title, document.querySelector('meta[property="og:title"]')?.getAttribute('content')]);
  expect(meta[0].includes('Complete HR') && (meta[1] || '').includes('Complete HR'), 'metadata & Open Graph English');
  expect(ralat.length === 0, 'tiada ralat halaman' + (ralat.length ? ': ' + ralat.join(' | ') : ''));
  await ctx.close();

  log('2. English, 390px');
  ({ ctx, p, ralat } = await buka(browser, null, { width: 390, height: 844 }));
  await semakUmum(p, 'EN 390');
  expect((await p.locator('a:text-is("Register free")').count()) === 0, 'tiada bar daftar melekat di telefon');
  const daftarSkrinPertama = await p.evaluate(() => [...document.querySelectorAll('a[href="/daftar"]')].filter((a) => { const r = a.getBoundingClientRect(); return r.height > 0 && r.top < window.innerHeight; }).length);
  expect(daftarSkrinPertama === 2, `hanya 2 butang daftar di skrin pertama (pengepala + hero): ${daftarSkrinPertama}`);
  expect(!(await p.innerText('main section')).includes('Employee?'), 'tiada "Employee? Log in" berulang di hero');
  const h1 = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('h1')).fontSize));
  expect(h1 === 31, `tajuk utama 31px di telefon (${h1})`);
  await p.screenshot({ path: `${shots}/laman-en-390.png`, fullPage: true });
  await ctx.close();

  log('3. Bahasa Melayu, 1280px & 390px');
  ({ ctx, p, ralat } = await buka(browser, 'ms', { width: 1280, height: 900 }));
  expect((await p.innerText('h1')).includes('Urusan HR yang lengkap, tanpa pegawai HR.'), 'tajuk BM');
  await semakUmum(p, 'BM 1280');
  const metaMs = await p.evaluate(() => document.title);
  expect(metaMs.includes('Urusan HR yang lengkap'), 'metadata BM');
  await p.screenshot({ path: `${shots}/laman-ms-1280.png`, fullPage: true });
  await ctx.close();
  ({ ctx, p, ralat } = await buka(browser, 'ms', { width: 390, height: 844 }));
  await semakUmum(p, 'BM 390');
  await p.screenshot({ path: `${shots}/laman-ms-390.png`, fullPage: true });
  // Suis bahasa di kaki halaman
  await p.click('button[aria-label="English"]');
  await p.waitForFunction(() => document.querySelector('h1')?.textContent?.includes('Complete HR'), null, { timeout: 15000 });
  expect(true, 'suis BM | EN di kaki halaman menukar bahasa');
  await ctx.close();

  await browser.close();
  log('LULUS: laman utama');
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
