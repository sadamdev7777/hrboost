// Ujian logo syarikat (TEMPATAN SAHAJA):
//  HR seret & lepas logo di Tetapan → Profil Syarikat → logo dikecilkan & disimpan (bucket awam `logo`)
//  → dipaparkan di menu sisi HR, pada surat rasmi dan dalam panel Pentadbir Platform; pekerja biasa tidak boleh menukar logo.
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000. Jalankan: node web/e2e/logo.cjs
const { execSync } = require('child_process');
const { chromium } = require('playwright');
require('./_bahasa.cjs');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };
const V = (s) => `${s} >> visible=true`;
const sql = (q) => execSync(`psql -h 127.0.0.1 -p 54322 -U postgres -Atc "${q.replace(/"/g, '\\"')}"`, { env: { ...process.env, PGPASSWORD: 'postgres' } }).toString().trim();
const C = '00000000-0000-0000-0000-0000000000c1';

async function masuk(b, email, w = 1440) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => log('   [ralat halaman]', e.message));
  await p.goto(BASE + '/masuk');
  await p.fill('input[type=email]', email);
  await p.fill('input[autocomplete=current-password]', 'Demo1234');
  await p.click('button[type=submit]');
  await p.waitForURL(/\/(utama|pengurusan|admin)/, { timeout: 30000 });
  return { ctx, p };
}

(async () => {
  const b = await chromium.launch();

  log('1. Lily (HR): seret & lepas logo');
  const { ctx, p } = await masuk(b, 'lily@demo.hrboost.io');
  await p.goto(BASE + '/pengurusan/tetapan/syarikat');
  const zon = p.locator(V('[aria-label="Muat naik logo syarikat"]'));
  await zon.waitFor();
  const teks = await zon.innerText();
  expect(/600 × 200 px/.test(teks) && /PNG/.test(teks), 'saiz dicadangkan dipaparkan (600 × 200 px, PNG)');
  // Logo besar 1800×600 dengan latar lutsinar, dilepaskan ke zon (DataTransfer)
  await zon.evaluate(async (el) => {
    const c = document.createElement('canvas');
    c.width = 1800;
    c.height = 600;
    const g = c.getContext('2d');
    g.fillStyle = '#0F6B5F';
    g.fillRect(0, 150, 600, 300);
    g.font = 'bold 200px sans-serif';
    g.fillText('DEMO', 700, 420);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'logo-demo.png', { type: 'image/png' }));
    el.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
    el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  await p.waitForSelector(V('text=Seret logo baharu ke sini'), { timeout: 20000 });
  const laluan = sql(`select logo_path from companies where id = '${C}'`);
  expect(new RegExp(`^${C}/logo-\\d+\\.png$`).test(laluan), 'logo_path disimpan dalam folder syarikat: ' + laluan);
  const saiz = await p.evaluate(async () => {
    const img = document.querySelector('[aria-label="Muat naik logo syarikat"] img');
    await img.decode();
    return [img.naturalWidth, img.naturalHeight, img.src];
  });
  expect(saiz[0] === 1200 && saiz[1] === 400, `logo dikecilkan ke 1200 × 400 (asal 1800 × 600): ${saiz[0]} × ${saiz[1]}`);
  const r = await p.request.get(saiz[2]);
  expect(r.ok() && r.headers()['content-type'] === 'image/png', 'logo boleh dimuat melalui URL awam (image/png)');

  log('2. Logo dipaparkan di menu sisi HR & pada surat');
  await p.goto(BASE + '/pengurusan');
  await p.waitForSelector(V('aside[aria-label="Menu sisi"] img[alt^="Logo"]'));
  expect(true, 'menu sisi: logo syarikat');
  const L = '00000000-0000-0000-0000-00000000aa01';
  sql(`insert into letter_requests(id, company_id, employment_id, kind, purpose, status, ref_no, issued_at)
       values ('${L}', '${C}', '00000000-0000-0000-0000-0000000000e4', 'employment', 'Pinjaman', 'issued', 'DEMO/HR/2026/0001', now())`);
  sql(`update letter_requests set snapshot = letter_build_snapshot('${L}') where id = '${L}'`);
  await p.goto(BASE + '/surat/' + L);
  await p.waitForSelector(V('article.kertas header img[alt^="Logo"]'));
  expect(true, 'surat rasmi: logo di kepala surat');

  log('3. Tukar logo: logo lama dibuang daripada storan');
  await p.goto(BASE + '/pengurusan/tetapan/syarikat');
  await p.setInputFiles('[aria-label="Muat naik logo syarikat"] input[type=file]', {
    name: 'logo.jpg', mimeType: 'image/jpeg',
    buffer: Buffer.from(await p.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 300; c.height = 100;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 300, 100); g.fillStyle = '#B42318'; g.fillRect(20, 20, 260, 60);
      return [...new Uint8Array(await (await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9))).arrayBuffer())];
    })),
  });
  await p.waitForFunction((lama) => { const i = document.querySelector('[aria-label="Muat naik logo syarikat"] img'); return i && !i.src.includes(lama); }, laluan.split('/')[1], { timeout: 20000 });
  const baru = sql(`select logo_path from companies where id = '${C}'`);
  expect(/\.jpg$/.test(baru), 'logo JPG kekal JPG');
  expect(sql(`select count(*) from storage.objects where bucket_id = 'logo' and name = '${laluan}'`) === '0', 'fail logo lama dibuang');
  await ctx.close();

  log('4. Pekerja biasa tidak boleh menukar logo');
  const amin = sql(`select p.auth_user_id from persons p join employments e on e.person_id = p.id where e.employee_no = 'DEMO004'`);
  let ditolak = false;
  try {
    execSync(`psql -h 127.0.0.1 -p 54322 -U postgres -v ON_ERROR_STOP=1 -Atc "begin; set local role authenticated; set local request.jwt.claims = '{\\"sub\\":\\"${amin}\\",\\"role\\":\\"authenticated\\"}'; select set_company_logo('${C}', null); commit;"`,
      { env: { ...process.env, PGPASSWORD: 'postgres' }, stdio: 'pipe' });
  } catch (e) {
    ditolak = /Hanya HR/.test(String(e.stderr));
  }
  expect(ditolak, 'set_company_logo ditolak untuk pekerja biasa');
  expect(sql(`select logo_path from companies where id = '${C}'`) === baru, 'logo tidak berubah');

  log('5. Pentadbir Platform: logo dalam senarai syarikat');
  const sa = await masuk(b, 'owner@demo.hrboost.io');
  await sa.p.goto(BASE + '/admin/syarikat');
  await sa.p.waitForSelector(V('table img[alt^="Logo"]'));
  expect(true, 'panel Pentadbir Platform: logo syarikat dipaparkan');
  await sa.ctx.close();

  await b.close();
  log('LULUS: logo syarikat');
})().catch((e) => { console.error(e); process.exit(1); });
