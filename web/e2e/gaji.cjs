// Ujian hujung-ke-hujung Fasa F: Lily (HR) proses gaji bulan semasa (komisen Amin) → kira →
// hantar → Sadam (CEO) & Farah (Kewangan) lulus → Lily muat turun fail & tanda dibayar →
// Amin melihat slip (jumlah tersembunyi secara lalai) dan slip A4.
// Prasyarat: `npx supabase db reset` (data demo dengan gaji), aplikasi di localhost:3000.
// Jalankan: node web/e2e/gaji.cjs
const os = require('os');
const { chromium } = require('playwright');
require('./_bahasa.cjs');
const { emelDemo } = require('./_demo.cjs');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const shots = process.env.E2E_SHOTS || os.tmpdir();
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };

async function login(browser, phone) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
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

  log('1. Lily (HR): semak data, komisen Amin, kira');
  const lily = await login(browser, '100000002');
  let p = lily.p;
  await p.goto(BASE + '/saya');
  await p.click('a:has-text("Proses Gaji")');
  await p.waitForSelector('text=DATA BULAN INI (AUTOMATIK)');
  await p.waitForSelector('text=tiada data gaji terkumpul');
  await p.screenshot({ path: `${shots}/f-proses.png` });
  await p.click('button:has-text("+ Tambah item")');
  await p.selectOption('[role=dialog] label:has-text("Pekerja") select', { label: 'Amin bin Demo · DEMO004' });
  await p.fill('[role=dialog] label:has-text("Jumlah (RM)") input', '500');
  await p.click('[role=dialog] button:has-text("Simpan")');
  await p.waitForSelector('text=Disimpan untuk Amin bin Demo.');
  await p.mouse.click(10, 10);
  await p.waitForSelector('[role=dialog]', { state: 'detached' });
  await p.click('button:has-text("Kira Gaji")');
  await p.waitForSelector('text=Jumlah kasar');
  const semak = await p.innerText('body');
  expect(/RM [\d,]+\.\d\d/.test(semak) && semak.includes('CEO → Kewangan'), 'gaji dikira; aliran CEO → Kewangan');
  await p.screenshot({ path: `${shots}/f-semak.png` });
  await p.click('section[aria-label="Slip pekerja"] a:has-text("Amin")');
  await p.waitForSelector('text=SLIP GAJI');
  await p.waitForTimeout(1500); const slipHr = await p.innerText("article"); if (!slipHr.includes("3,700.00")) console.log(slipHr.slice(0,800));
  expect(slipHr.includes('Komisen') && slipHr.includes('3,700.00'), 'pratonton slip Amin: komisen RM500, jumlah pendapatan RM3,700');
  await p.goBack();
  await p.waitForSelector('button:has-text("Hantar untuk kelulusan")');

  log('1b. Semakan PCB: data terkumpul tiada → hantar dikunci sehingga setiap pekerja diberi sebab');
  const pcb = p.locator('section[aria-label="Semakan PCB"]');
  await pcb.waitFor({ timeout: 15000 });
  expect((await pcb.innerText()).includes('Data terkumpul tiada: Jan'), 'pekerja ditanda: data terkumpul tiada');
  expect(await p.locator('button:has-text("Hantar untuk kelulusan")').isDisabled(), 'butang Hantar dikunci');
  await p.screenshot({ path: `${shots}/f-semakan-pcb.png`, fullPage: true });
  let n = 0;
  while ((await pcb.locator('select[aria-label^="Sebab untuk"]').count()) > 0) {
    const baris = pcb.locator('div[data-pcb]').filter({ has: p.locator('select') }).first();
    await baris.locator('select').selectOption('lain');
    await baris.locator('input[aria-label^="Nota untuk"]').fill('Gaji pertama dalam HRBoost; data terkumpul akan diisi');
    await baris.locator('button:has-text("Simpan sebab")').click();
    await p.waitForFunction((k) => document.querySelectorAll('section[aria-label="Semakan PCB"] select').length < k,
      await pcb.locator('select').count(), { timeout: 15000 });
    if (++n > 30) throw new Error('terlalu banyak baris');
  }
  await p.waitForSelector('text=Semua pekerja telah diberi sebab. Gaji boleh dihantar.');
  expect(!(await p.locator('button:has-text("Hantar untuk kelulusan")').isDisabled()), `${n} sebab disimpan; butang Hantar dibuka`);
  await p.click('button:has-text("Hantar untuk kelulusan")');
  await p.waitForSelector('text=Menunggu kelulusan');
  expect(true, 'dihantar untuk kelulusan');

  log('2. Sadam (CEO) kemudian Farah (Kewangan) meluluskan');
  for (const [phone, who] of [['100000001', 'Sadam'], ['100000005', 'Farah']]) {
    const a = await login(browser, phone);
    await a.p.goto(BASE + '/kelulusan');
    await a.p.click('main a[href^="/kelulusan/"]:has-text("Gaji")');
    await a.p.waitForSelector('text=Jumlah bersih');
    if (who === 'Farah') await a.p.screenshot({ path: `${shots}/f-lulus.png` });
    await a.p.click('button:has-text("Lulus")');
    if (who === 'Sadam') {
      // CEO juga boleh meluluskan peringkat Kewangan: tawaran "Lulus juga" dipaparkan — tolak supaya Kewangan meluluskan
      await a.p.waitForSelector('[role=alertdialog] >> text=Anda juga pelulus peringkat', { timeout: 15000 });
      expect(true, 'CEO ditawarkan meluluskan peringkat Kewangan juga');
      await a.p.click('[role=alertdialog] button:has-text("Batal")');
    }
    await a.p.waitForURL('**/kelulusan');
    expect(true, `${who} meluluskan gaji`);
    await a.ctx.close();
  }

  log('3. Lily: muat turun fail & tanda dibayar');
  await p.reload();
  await p.waitForSelector('text=Bayar gaji melalui bank');
  // Fail bayaran bank kini dibuka dalam dialog format bank (FailBank)
  await p.click('button:has-text("Fail bayaran bank")');
  await p.waitForSelector('[role=dialog] >> text=Fail bayaran bank >> visible=true');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[role=dialog] button:has-text("Muat turun fail") >> visible=true')]);
  await p.keyboard.press('Escape');
  const fs = require('fs');
  const isi = fs.readFileSync(await dl.path(), 'utf8');
  expect(isi.includes('Nama,No. Akaun,Bank,Kod Bank,Jumlah,Rujukan') && isi.trim().split(/\r?\n/).length >= 7, 'fail bayaran bank: 6 pekerja');
  await p.screenshot({ path: `${shots}/f-bayar.png` });
  await p.click('button:has-text("Tandakan telah dibayar")');
  await p.waitForSelector('text=Slip gaji telah dihantar kepada 6 pekerja');
  expect(true, 'gaji ditanda dibayar, slip dihantar');
  await lily.ctx.close();

  log('4. Amin: Slip Gaji');
  const amin = await login(browser, '100000004');
  p = amin.p;
  await p.goto(BASE + '/gaji');
  await p.waitForSelector('text=Gaji bersih');
  let t = await p.innerText('main');
  expect(/RM [\d,]+\.\d\d/.test(t) && t.includes('Komisen') && !t.includes('••••'), 'jumlah gaji dipaparkan terus');
  await p.screenshot({ path: `${shots}/f-gaji.png` });
  await p.click('a:has-text("Muat turun PDF")');
  await p.waitForSelector('text=GAJI BERSIH');
  expect((await p.innerText('article')).includes('951109-14-1234'), 'slip A4: no. kad pengenalan penuh');
  await p.screenshot({ path: `${shots}/f-slip.png`, fullPage: true });
  await amin.ctx.close();
  await browser.close();
  log('LULUS: proses gaji penuh');
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
