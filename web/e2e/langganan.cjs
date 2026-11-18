// Ujian hujung-ke-hujung: langganan RM499 setahun melalui CHIP (pelayan CHIP tiruan tempatan).
//  1. Pentadbir Platform mencipta kempen kod UJIAN20 (20%, had 1 syarikat) di /admin/langganan.
//  2. Syarikat demo dalam percubaan: jalur percubaan → Tetapan → Langganan → kod → bayar → halaman CHIP tiruan
//     → kembali ke /langganan/selesai → bayaran disahkan (GET CHIP) → langganan aktif + resit PDF.
//  3. Kod dikira 1/1; invois & resit boleh dimuat turun; jalur hilang.
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000, dan fungsi billing dijalankan secara tempatan
// pada 127.0.0.1:8791 dengan CHIP_API_URL=http://127.0.0.1:8790/api/v1 (cth. Deno: DENO_SERVE_ADDRESS=tcp:127.0.0.1:8791
// deno run -A --node-modules-dir=none supabase/functions/billing/index.ts). Panggilan /functions/v1/billing dihala ke situ.
// Jalankan: node web/e2e/langganan.cjs
const os = require('os');
const http = require('http');
const fs = require('fs');
const { execSync } = require('child_process');
const { chromium } = require('playwright');
require('./_bahasa.cjs');
const { emelDemo, pautanEmel } = require('./_demo.cjs');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const FUNGSI = process.env.E2E_BILLING || 'http://127.0.0.1:8791/';
const shots = process.env.E2E_SHOTS || os.tmpdir();
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };
const sql = (q) => execSync(`psql -h 127.0.0.1 -p 54322 -U postgres -Atc "${q}"`, { env: { ...process.env, PGPASSWORD: 'postgres' } }).toString().trim();
const CO = sql(`select company_id from employments where employee_no = 'DEMO001'`);

// ---- CHIP tiruan: POST /api/v1/purchases/, GET /api/v1/purchases/{id}/, halaman bayar /bayar/{id}
const pembelian = new Map();
const chip = http.createServer((req, res) => {
  let badan = '';
  req.on('data', (c) => (badan += c));
  req.on('end', () => {
    const u = new URL(req.url, 'http://x');
    const hantar = (kod, o, jenis = 'application/json') => { res.writeHead(kod, { 'Content-Type': jenis }); res.end(typeof o === 'string' ? o : JSON.stringify(o)); };
    if (u.pathname.startsWith('/api/') && req.headers.authorization !== 'Bearer ujian-tempatan') return hantar(401, { error: 'unauthorized' });
    if (req.method === 'POST' && u.pathname === '/api/v1/purchases/') {
      const b = JSON.parse(badan);
      const id = 'chip-' + (pembelian.size + 1);
      pembelian.set(id, { id, status: 'created', reference: b.reference, harga: b.purchase.products[0].price, kembali: b.success_redirect, brand: b.brand_id });
      return hantar(201, { id, checkout_url: `http://127.0.0.1:8790/bayar/${id}`, status: 'created', reference: b.reference });
    }
    const m = u.pathname.match(/^\/api\/v1\/purchases\/([^/]+)\/$/);
    if (req.method === 'GET' && m) {
      const p = pembelian.get(m[1]);
      if (!p) return hantar(404, { error: 'not found' });
      return hantar(200, { id: p.id, status: p.status, reference: p.reference, transaction_data: p.status === 'paid' ? { payment_method: 'fpx' } : {} });
    }
    const b = u.pathname.match(/^\/bayar\/([^/]+)$/);
    if (b && pembelian.has(b[1])) {
      const p = pembelian.get(b[1]);
      if (req.method === 'POST') {
        p.status = 'paid';
        res.writeHead(302, { Location: p.kembali });
        return res.end();
      }
      return hantar(200, `<html><body><h1>CHIP tiruan</h1><p>Rujukan ${p.reference} · RM${(p.harga / 100).toFixed(2)}</p><form method="post"><button>Bayar FPX</button></form></body></html>`, 'text/html');
    }
    hantar(404, { error: 'tiada' });
  });
});

async function login(browser, phone, viewport) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => log('   [ralat halaman]', e.message));
  // Fungsi billing dijalankan di luar runtime Supabase tempatan
  await p.route('**/functions/v1/billing**', async (r) => {
    const resp = await r.fetch({ url: FUNGSI + (r.request().url().includes('webhook=1') ? '?webhook=1' : '') });
    await r.fulfill({ response: resp });
  });
  await p.goto(BASE + '/masuk');
  await p.fill('input[type=email]', emelDemo(phone));
  await p.fill('input[autocomplete=current-password]', 'Demo1234');
  await p.click('button[type=submit]');
  await p.waitForURL(/\/(utama|pengurusan|admin)$/, { timeout: 30000 });
  return { ctx, p };
}

async function muatTurun(p, butang) {
  const [d] = await Promise.all([p.waitForEvent('download'), butang.click()]);
  const fail = await d.path();
  const bait = fs.readFileSync(fail);
  fs.copyFileSync(fail, `${shots}/${d.suggestedFilename()}`);
  return { nama: d.suggestedFilename(), pdf: bait.subarray(0, 5).toString() === '%PDF-', saiz: bait.length };
}

(async () => {
  await new Promise((s) => chip.listen(8790, '127.0.0.1', s));
  // Syarikat demo dalam percubaan (3 hari lagi); butiran penjual HRBoost
  sql(`update companies set billing_status = 'trial', trial_ends_at = now() + interval '2 days 23 hours', paid_until = null where id = '${CO}'`);
  sql(`update platform_settings set value = jsonb_set(value, '{seller}', '{\\"name\\":\\"HRBoost Ujian Sdn Bhd\\",\\"ssm\\":\\"202601000001\\",\\"address\\":\\"Kuala Lumpur\\",\\"email\\":\\"bil@hrboost.io\\",\\"phone\\":\\"\\"}') where key = 'billing'`);

  const browser = await chromium.launch();

  log('1. Pentadbir Platform: cipta kempen UJIAN20 (20%, had 1 syarikat)');
  let { ctx, p } = await login(browser, '100000007', { width: 1280, height: 900 });
  await p.goto(BASE + '/admin/langganan');
  await p.waitForSelector('text=KEMPEN & KOD BAUCAR');
  await p.fill('label:has-text("Nama kempen") input', 'Promosi Ujian');
  await p.fill('label:has-text("Kod (kosong = automatik)") input', 'ujian20');
  await p.fill('label:has-text("Had syarikat") input', '1');
  await p.fill('label:has-text("Nilai") >> nth=0 >> input', '20');
  await p.click('button:has-text("Cipta kempen")');
  await p.waitForSelector('text=Kempen disimpan.');
  await p.waitForSelector('td:has-text("UJIAN20")');
  expect(true, 'kempen dicipta (kod ditukar ke huruf besar)');
  await ctx.close();

  log('2. Pentadbir syarikat (Sadam): jalur percubaan → Langganan');
  ({ ctx, p } = await login(browser, '100000001', { width: 390, height: 844 }));
  await p.goto(BASE + '/pengurusan');
  const jalur = p.locator('a[href="/pengurusan/langganan"]:has-text("Percubaan percuma")');
  await jalur.waitFor({ timeout: 20000 });
  expect(/3 hari lagi/.test(await jalur.innerText()), 'jalur percubaan: 3 hari lagi');
  await jalur.click();
  await p.waitForURL('**/pengurusan/langganan');
  await p.waitForSelector('text=PELAN');
  let teks = await p.innerText('main');
  expect(teks.includes('RM499') && teks.includes('Pekerja tanpa had'), 'pelan RM499 setahun dipaparkan');

  await p.fill('input[placeholder="cth. RAYA50"]', 'TIADA99');
  await p.click('button:has-text("Guna")');
  await p.waitForSelector('text=Kod baucar tidak sah');
  expect(true, 'kod tidak sah ditolak');
  await p.fill('input[placeholder="cth. RAYA50"]', 'ujian20');
  await p.click('button:has-text("Guna")');
  await p.waitForSelector('text=Diskaun: UJIAN20');
  teks = await p.innerText('main');
  expect(teks.includes('-RM99.80') && teks.includes('RM399.20'), 'diskaun 20%: RM499.00 − RM99.80 = RM399.20');
  await p.screenshot({ path: `${shots}/langganan-bayar.png`, fullPage: true });

  log('3. Bayar melalui CHIP (tiruan) → kembali → disahkan');
  await p.click('button:has-text("Bayar RM399.20")');
  await p.waitForURL('http://127.0.0.1:8790/bayar/**', { timeout: 20000 });
  expect((await p.innerText('body')).includes('RM399.20'), 'halaman CHIP menerima amaun RM399.20');
  const inv = sql(`select number from billing_invoices where company_id = '${CO}' and status = 'pending'`);
  expect((await p.innerText('body')).includes(inv), `rujukan CHIP = nombor invois ${inv}`);
  await p.click('button:has-text("Bayar FPX")');
  await p.waitForURL('**/langganan/selesai**', { timeout: 20000 });
  await p.waitForSelector('text=Terima kasih!', { timeout: 30000 });
  await p.screenshot({ path: `${shots}/langganan-selesai.png`, fullPage: true });
  expect(sql(`select billing_status from companies where id = '${CO}'`) === 'active', 'syarikat kini aktif');
  expect(sql(`select (paid_until::date - current_date) between 364 and 367 from companies where id = '${CO}'`) === 't', 'aktif sehingga setahun lagi');
  expect(sql(`select payment_method || ' ' || (receipt_number is not null) from billing_invoices where number = '${inv}'`) === 'fpx true', 'invois dibayar (FPX) dengan nombor resit');
  const r = await muatTurun(p, p.locator('button:has-text("Muat turun resit")'));
  expect(r.pdf && r.nama.startsWith('Resit-'), `resit PDF dimuat turun (${r.nama}, ${r.saiz} bait)`);

  log('4. Senarai invois & resit; jalur hilang');
  await p.goto(BASE + '/pengurusan/langganan');
  await p.waitForSelector(`text=${inv}`);
  teks = await p.innerText('main');
  expect(teks.includes('Aktif') && teks.includes('Langganan aktif sehingga') && teks.includes('Dibayar'), 'status Aktif & invois Dibayar');
  const i = await muatTurun(p, p.locator('main button:has-text("Invois")').first());
  expect(i.pdf && i.nama.startsWith('Invois-'), `invois PDF (${i.nama})`);
  expect((await p.locator('a[href="/pengurusan/langganan"]:has-text("Percubaan percuma")').count()) === 0, 'jalur percubaan hilang selepas bayar');
  await ctx.close();

  log('5. Pentadbir Platform: kod digunakan 1/1');
  ({ ctx, p } = await login(browser, '100000007', { width: 1280, height: 900 }));
  await p.goto(BASE + '/admin/langganan');
  await p.waitForSelector('td:has-text("UJIAN20")');
  expect((await p.innerText('tr:has-text("UJIAN20")')).includes('1 / 1'), 'kod UJIAN20 digunakan 1 / 1');
  await p.screenshot({ path: `${shots}/langganan-admin.png`, fullPage: true });
  await ctx.close();

  log('6. Baca sahaja: jalur amaran untuk semua & permohonan disekat');
  sql(`update companies set billing_status = 'readonly' where id = '${CO}'`);
  ({ ctx, p } = await login(browser, '100000004', { width: 390, height: 844 }));
  await p.goto(BASE + '/utama');
  await p.waitForSelector('text=Langganan syarikat telah tamat. Sila hubungi Pentadbir syarikat.', { timeout: 20000 });
  expect(true, 'pekerja melihat makluman langganan tamat');
  await ctx.close();
  sql(`update companies set billing_status = 'exempt' where id = '${CO}'`);

  log('7. Laman utama → Langgan terus RM499 → daftar → sahkan e-mel → bayar → persediaan');
  {
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const q = await ctx2.newPage();
    q.on('pageerror', (e) => log('   [ralat halaman]', e.message));
    await q.route('**/functions/v1/billing**', async (r) => {
      const resp = await r.fetch({ url: FUNGSI });
      await r.fulfill({ response: resp });
    });
    await q.goto(BASE + '/');
    await q.click('#harga a[href="/daftar?pelan=tahunan"]');
    await q.waitForURL('**/daftar?pelan=tahunan');
    await q.waitForSelector('text=Langgan terus: RM499 setahun');
    await q.fill('input[placeholder^="Contoh: Syarikat ABC"]', 'Syarikat Langgan Terus Sdn Bhd');
    await q.fill('input[placeholder="Nama anda"]', 'Hafiz bin Omar');
    await q.fill('input[type=email]', 'hafiz@langgan.my');
    await q.fill('input[autocomplete=new-password]', 'Rahsia123');
    await q.check('input[type=checkbox]');
    const mula = Date.now() - 2000;
    await q.click('button:has-text("Daftar & teruskan ke bayaran")');
    await q.waitForURL('**/daftar/sahkan');
    await q.waitForSelector('text=Anda akan dibawa terus ke halaman bayaran langganan RM499 setahun.');
    await q.goto(await pautanEmel('hafiz@langgan.my', { selepas: mula }));
    await q.waitForURL('**/pengurusan/langganan?bayar=1', { timeout: 30000 });
    await q.waitForSelector('text=Lengkapkan langganan anda');
    expect(true, 'selepas e-mel disahkan: terus ke halaman bayaran (bukan persediaan)');
    const co2 = sql(`select id from companies where name ilike 'Syarikat Langgan Terus Sdn Bhd'`);
    expect(sql(`select billing_status || ' ' || (trial_ends_at::date - current_date) from companies where id = '${co2}'`) === 'trial 7', 'percubaan 7 hari sebagai sandaran jika bayaran tidak diselesaikan');
    await q.screenshot({ path: `${shots}/langganan-terus.png`, fullPage: true });
    await q.click('button:has-text("Bayar RM499.00")');
    await q.waitForURL('http://127.0.0.1:8790/bayar/**', { timeout: 20000 });
    await q.click('button:has-text("Bayar FPX")');
    await q.waitForURL('**/langganan/selesai**', { timeout: 20000 });
    await q.waitForSelector('text=Terima kasih!', { timeout: 30000 });
    expect(sql(`select billing_status from companies where id = '${co2}'`) === 'active', 'langganan aktif setahun selepas bayar');
    await q.click('a:has-text("Teruskan persediaan syarikat")');
    await q.waitForURL('**/mula');
    expect(true, 'teruskan ke persediaan syarikat');
    await ctx2.close();
  }

  await browser.close();
  chip.close();
  log('\nLULUS: langganan & bayaran CHIP');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
