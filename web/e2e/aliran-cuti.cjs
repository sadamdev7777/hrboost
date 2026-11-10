// Ujian hujung-ke-hujung Fasa B: Amin mohon cuti -> 3 peringkat lulus dari telefon -> baki betul.
// Prasyarat: `npx supabase db reset` (data demo), aplikasi berjalan di localhost:3000, Playwright + Chromium.
// Jalankan: node web/e2e/aliran-cuti.cjs   (tangkapan skrin ke $E2E_SHOTS, lalai folder tmp)

const { chromium } = require('playwright');
require('./_bahasa.cjs');
const { emelDemo } = require('./_demo.cjs');
const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const shots = process.env.E2E_SHOTS || require('os').tmpdir();
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };

async function login(browser, phoneLocal, who) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  // Lencana Netlify di staging menutup butang bawah
  await p.addInitScript(() => { const st = document.createElement('style'); st.textContent = '#nl-badge-frame{display:none!important}'; document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st)); });
  p.on('pageerror', (e) => log(`  [${who}] ralat halaman:`, e.message));
  await p.goto(BASE + '/masuk');
  await p.fill('input[type=email]', emelDemo(phoneLocal));
  await p.fill('input[autocomplete=current-password]', 'Demo1234');
  await p.click('button[type=submit]');
  await p.waitForURL(/\/(utama|pengurusan)$/, { timeout: 15000 });
  await p.waitForLoadState('networkidle');
  return { ctx, p };
}
const text = async (p, sel) => (await p.locator(sel).first().innerText()).replace(/\s+/g, ' ').trim();

(async () => {
  const b = await chromium.launch();

  // 1. Amin mohon cuti
  let { ctx, p } = await login(b, '10 000 0004', 'Amin');
  await p.waitForSelector('text=Baki cuti tahunan');
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${shots}/01-amin-utama.png` });
  log('1. Amin Utama:', await text(p, 'section'));
  expect((await text(p, 'section')).includes('8 hari'), 'baki awal Amin 8 hari');
  await p.click('text=Mohon Cuti');
  await p.waitForURL('**/mohon/cuti');
  await p.waitForSelector('text=Akan diluluskan oleh');
  const dates = p.locator('input[type=date]');
  await dates.nth(0).fill('2026-12-23');
  await dates.nth(1).fill('2026-12-28');
  await p.fill('input[type=text]', 'Pulang ke kampung');
  await p.waitForSelector('text=3 hari bekerja');
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${shots}/02-amin-mohon-cuti.png` });
  log('2. Kiraan:', await text(p, 'text=hari bekerja'), '|', await text(p, 'text=tidak dikira'));
  expect((await text(p, 'text=tidak dikira')).includes('Krismas'), 'Krismas dan hujung minggu tidak dikira');
  log('   Pengganti:', await p.locator('select').inputValue() ? 'dipilih' : 'tiada', '| Aliran:', await text(p, 'text=Akan diluluskan oleh >> xpath=..'));
  await p.click('button:has-text("Hantar Permohonan")');
  await p.waitForURL('**/permohonan', { timeout: 15000 });
  await p.waitForSelector('text=Menunggu >> nth=1');
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${shots}/03-amin-permohonan.png` });
  log('3. Permohonan Amin:', await text(p, 'main >> div.rounded-card'));
  await ctx.close();

  // 2-4. Tiga peringkat kelulusan dari telefon
  for (const [phone, who, via] of [['10 000 0003', 'Zuerin (Ketua)', 'butiran'], ['10 000 0002', 'Lily (HR)', 'senarai'], ['10 000 0001', 'Sadam (CEO)', 'butiran']]) {
    ({ ctx, p } = await login(b, phone, who));
    await p.goto(BASE + '/kelulusan');
    await p.waitForSelector('text=Menunggu · 1', { timeout: 15000 });
    await p.waitForTimeout(500);
    const n = who.split(' ')[0].toLowerCase();
    await p.screenshot({ path: `${shots}/04-${n}-kelulusan.png` });
    if (via === 'butiran') {
      await p.click('main a[href^="/kelulusan/"]');
      await p.waitForSelector('text=Aliran kelulusan');
      await p.waitForSelector('text=(anda)');
      await p.waitForTimeout(500);
      await p.screenshot({ path: `${shots}/05-${n}-butiran.png` });
      log(`   ${who} butiran:`, await text(p, 'section >> nth=0'));
      await p.click('button:has-text("Lulus")');
      await p.waitForURL('**/kelulusan');
    } else {
      await p.click('main button:has-text("Lulus")');
    }
    await p.waitForSelector('text=Menunggu · 0', { timeout: 15000 });
    log(`4. ${who} meluluskan melalui ${via}: OK`);
    await ctx.close();
  }

  // 5. Amin semak status & baki
  ({ ctx, p } = await login(b, '10 000 0004', 'Amin'));
  await p.waitForSelector('text=Lulus', { timeout: 15000 });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${shots}/06-amin-selepas-lulus.png` });
  log('5. Amin Utama selepas lulus:', await text(p, 'section'));
  expect((await text(p, 'section')).includes('5 hari'), 'baki akhir Amin 5 hari (8 - 3)');
  await p.goto(BASE + '/permohonan');
  await p.click('main a[href^="/permohonan/"]');
  await p.waitForSelector('text=Aliran kelulusan');
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${shots}/07-amin-butiran.png` });
  const aliran = await text(p, 'section:has-text("Aliran kelulusan")');
  log('   Aliran:', aliran);
  expect(!aliran.includes('Menunggu') && aliran.includes('3 · CEO'), 'ketiga-tiga peringkat diluluskan');
  log('LULUS: aliran cuti 3 peringkat');
  await ctx.close();
  await b.close();
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
