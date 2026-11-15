// Jana tangkapan skrin telefon untuk homepage (public/skrin/{ms,en}/*.webp) daripada data demo.
// Prasyarat: `npx supabase db reset` (data demo), aplikasi di localhost:3000.
// Jalankan: node web/e2e/skrin-homepage.cjs
const path = require('path');
const { chromium } = require('playwright');
const sharp = require(path.join(__dirname, '../node_modules/sharp'));
const { emelDemo } = require('./_demo.cjs');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const OUT = path.join(__dirname, '../public/skrin');
const os = require('os');
const { execSync } = require('child_process');
const GAMBAR = path.join(os.tmpdir(), 'hb-laptop.jpg');
const TELEFON = path.join(os.tmpdir(), 'hb-telefon.jpg');
const RESIT = path.join(os.tmpdir(), 'hb-resit.jpg');
const sql = (q) => execSync(`psql -h 127.0.0.1 -p 54322 -U postgres -Atc "${q}"`, { env: { ...process.env, PGPASSWORD: 'postgres' } }).toString().trim();

// Gambar contoh (dilukis dengan HTML) supaya tangkapan skrin kelihatan seperti penggunaan sebenar
async function lukis(browser, file, html, w, h) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  await p.setContent(`<body style="margin:0;width:${w}px;height:${h}px;overflow:hidden;font-family:sans-serif">${html}</body>`);
  await p.screenshot({ path: file, type: 'jpeg', quality: 85 });
  await p.close();
}
const HTML_LAPTOP = `<div style="width:100%;height:100%;background:linear-gradient(160deg,#c9b79c,#8a7457);display:flex;align-items:center;justify-content:center">
  <div style="transform:perspective(700px) rotateX(18deg)"><div style="width:420px;height:270px;background:#1d2327;border-radius:14px 14px 4px 4px;padding:14px;box-sizing:border-box">
  <div style="width:100%;height:100%;background:linear-gradient(135deg,#2c7a8c,#14404d);border-radius:4px"></div></div>
  <div style="width:500px;height:26px;margin-left:-40px;background:#a9b0b5;border-radius:0 0 18px 18px"></div></div></div>`;
const HTML_TELEFON = `<div style="width:100%;height:100%;background:linear-gradient(160deg,#dfe6e4,#9fb0ab);display:flex;align-items:center;justify-content:center">
  <div style="width:210px;height:420px;background:#111;border-radius:34px;padding:10px;box-sizing:border-box;transform:rotate(-8deg)">
  <div style="width:100%;height:100%;border-radius:26px;background:linear-gradient(160deg,#f4a261,#6d3b8a)"></div></div></div>`;
const HTML_RESIT = `<div style="width:100%;height:100%;background:#7d8b88;display:flex;align-items:center;justify-content:center">
  <div style="width:330px;background:#fbfaf6;padding:24px 22px;font:15px monospace;color:#222;transform:rotate(-3deg);box-shadow:0 8px 20px rgba(0,0,0,.35)">
  <div style="text-align:center;font-weight:bold;font-size:18px">RESTORAN SERI MELATI</div>
  <div style="text-align:center;font-size:12px">Seksyen 13, Shah Alam · SST 01-2345</div><hr>
  <div>Nasi lemak ayam x2 &nbsp;&nbsp;&nbsp; 19.40</div><div>Mee goreng mamak &nbsp;&nbsp;&nbsp;&nbsp; 14.50</div>
  <div>Teh tarik x3 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 12.60</div><hr>
  <div style="font-weight:bold;font-size:18px">JUMLAH &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; RM46.50</div>
  <div style="text-align:center;font-size:12px;margin-top:10px">Terima kasih</div></div></div>`;
const log = (...a) => console.log(...a);

async function masuk(browser, phone, bahasa) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: 'hrb_bahasa', value: bahasa, url: BASE }]);
  await ctx.addInitScript((b) => {
    try { localStorage.setItem('hrb_bahasa', b); } catch {}
  }, bahasa);
  const p = await ctx.newPage();
  await p.goto(BASE + '/masuk');
  await p.fill('input[type=email]', emelDemo(phone));
  await p.fill('input[autocomplete=current-password]', 'Demo1234');
  await p.click('button[type=submit]');
  await p.waitForURL(/\/(utama|pengurusan)$/, { timeout: 15000 });
  return { ctx, p };
}

async function simpan(p, bahasa, nama) {
  await p.waitForTimeout(600);
  const png = await p.screenshot();
  await sharp(png).resize(780, 1560, { fit: 'cover', position: 'top' }).webp({ quality: 82 }).toFile(`${OUT}/${bahasa}/${nama}.webp`);
  log(`   ${bahasa}/${nama}.webp`);
}

(async () => {
  const browser = await chromium.launch();
  await lukis(browser, GAMBAR, HTML_LAPTOP, 800, 600);
  await lukis(browser, TELEFON, HTML_TELEFON, 600, 600);
  await lukis(browser, RESIT, HTML_RESIT, 600, 800);

  log('Data: Amin rekod laptop & hantar tuntutan RM1,250; Lily sahkan laptop');
  let { ctx, p } = await masuk(browser, '100000004', 'ms');
  await p.goto(BASE + '/inventori');
  await p.click('button:has-text("+ Tambah item")');
  const fail = p.locator('[role=dialog] input[type=file]');
  await fail.nth(1).setInputFiles(GAMBAR);
  await p.waitForSelector('[role=dialog] button[aria-label="Buang fail"]', { timeout: 20000 });
  await p.fill('[role=dialog] label:has-text("Nama item") input', 'Laptop Dell Latitude 5440');
  await p.selectOption('[role=dialog] label:has-text("Kategori") select', 'Komputer riba');
  await p.fill('[role=dialog] label:has-text("No. siri / tag") input', 'MTB-LT-0142');
  await p.fill('[role=dialog] label:has-text("Harga (RM)") input', '4299');
  await fail.nth(3).setInputFiles(RESIT);
  await p.waitForFunction(() => document.querySelectorAll('[role=dialog] button[aria-label="Buang fail"]').length === 2, null, { timeout: 20000 });
  await p.click('[role=dialog] button:has-text("Hantar kepada HR")');
  await p.waitForSelector('text=Menunggu semakan HR', { timeout: 15000 });
  await p.click('button:has-text("+ Tambah item")');
  await p.locator('[role=dialog] input[type=file]').nth(1).setInputFiles(TELEFON);
  await p.waitForSelector('[role=dialog] button[aria-label="Buang fail"]', { timeout: 20000 });
  await p.fill('[role=dialog] label:has-text("Nama item") input', 'iPhone 15');
  await p.selectOption('[role=dialog] label:has-text("Kategori") select', 'Telefon');
  await p.fill('[role=dialog] label:has-text("Harga (RM)") input', '3999');
  await p.click('[role=dialog] button:has-text("Hantar kepada HR")');
  await p.waitForSelector('text=DIPEGANG OLEH SAYA · 2', { timeout: 15000 }).catch(async (e) => { await p.screenshot({ path: '/tmp/claude-0/gagal.png' }); throw e; });

  await p.goto(BASE + '/tuntutan/baru');
  await p.setInputFiles('input[aria-label="Ambil gambar resit"]', RESIT);
  await p.waitForSelector('text=1 resit dilampirkan');
  await p.selectOption('select', { label: 'Lain-lain' });
  await p.fill('input[inputmode=decimal]', '1250');
  await p.fill('input[placeholder^="Contoh: Menghantar"]', 'Hotel Kundasang');
  await p.click('button:has-text("Hantar RM 1,250.00")');
  await p.waitForURL('**/tuntutan');
  await ctx.close();

  ({ ctx, p } = await masuk(browser, '100000002', 'ms'));
  await p.goto(BASE + '/pengurusan/inventori');
  await p.click('text=Laptop Dell Latitude 5440 >> nth=0');
  await p.click('[role=dialog] button:has-text("Sahkan")');
  await p.waitForSelector('[role=dialog]', { state: 'detached' });
  await ctx.close();

  for (const bahasa of ['ms', 'en']) {
    log(`Tangkapan skrin (${bahasa})`);
    ({ ctx, p } = await masuk(browser, '100000003', bahasa));
    await p.goto(BASE + '/kelulusan');
    await p.locator('main a[href^="/kelulusan/"]').first().click();
    await p.waitForURL(/\/kelulusan\/.+/);
    await p.waitForSelector('main button', { timeout: 15000 });
    await simpan(p, bahasa, 'ketua-kelulusan');
    await ctx.close();

    ({ ctx, p } = await masuk(browser, '100000004', bahasa));
    await p.goto(BASE + '/inventori');
    await p.waitForSelector('text=Laptop Dell Latitude 5440');
    await simpan(p, bahasa, 'pekerja-inventori');

    // Bacaan AI resit (fungsi AI tidak dijalankan secara tempatan): jawapan contoh seperti hasil sebenar
    await p.route('**/functions/v1/ai-receipt', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, readable: true, amount: 46.5, claim_type: 'Makan (outstation)', purpose: bahasa === 'en' ? 'Lunch with client, Shah Alam' : 'Makan bersama pelanggan, Shah Alam' }) }));
    await p.goto(BASE + '/tuntutan/baru');
    await p.setInputFiles('input[type=file][capture=environment]', RESIT);
    await p.waitForFunction(() => document.querySelector('main input[inputmode=decimal]')?.value === '46.5', null, { timeout: 20000 });
    await p.waitForTimeout(800);
    await simpan(p, bahasa, 'pekerja-tuntutan');

    // Pekerja baharu separuh jalan: 3 daripada 8 langkah selesai
    sql(`delete from onboarding_progress where employment_id = (select id from employments where employee_no = 'DEMO004') and step not in ('activate','name','selfie')`);
    await p.goto(BASE + '/orientasi');
    await p.waitForSelector('main', { timeout: 15000 });
    await simpan(p, bahasa, 'pekerja-orientasi');
    await ctx.close();
  }
  await browser.close();
  log('SIAP: skrin homepage');
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
