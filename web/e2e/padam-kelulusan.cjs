// Ujian hujung-ke-hujung:
//  1. Kelulusan memaparkan keputusan di luar enjin kelulusan ikut peranan (surat, inventori, akaun bank, soalan HR)
//     dan tindakan terus (Sahkan inventori, Jawab soalan, Tolak akaun bank) berfungsi; pekerja biasa tidak nampak.
//  2. Padam dengan sejarah: pengumuman & dokumen dipadam → Tetapan → Rekod dipadam → Pulihkan.
// Prasyarat: `npx supabase db reset` (data demo), aplikasi di localhost:3000.
// Jalankan: node web/e2e/padam-kelulusan.cjs
const os = require('os');
const { execSync } = require('child_process');
const { chromium } = require('playwright');
require('./_bahasa.cjs');
const { emelDemo } = require('./_demo.cjs');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const shots = process.env.E2E_SHOTS || os.tmpdir();
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };
const sql = (q) => execSync(`psql -h 127.0.0.1 -p 54322 -U postgres -Atc "${q}"`, { env: { ...process.env, PGPASSWORD: 'postgres' } }).toString().trim();
const AMIN = sql(`select id from employments where employee_no = 'DEMO004'`);
const AMIN_P = sql(`select person_id from employments where id = '${AMIN}'`);
const CO = sql(`select company_id from employments where id = '${AMIN}'`);

async function login(browser, phone, viewport) {
  const ctx = await browser.newContext({ viewport });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => log('   [ralat halaman]', e.message));
  await p.goto(BASE + '/masuk');
  await p.fill('input[type=email]', emelDemo(phone));
  await p.fill('input[autocomplete=current-password]', 'Demo1234');
  await p.click('button[type=submit]');
  await p.waitForURL(/\/(utama|pengurusan)$/, { timeout: 30000 });
  return { ctx, p };
}

(async () => {
  // Data: permintaan surat, inventori, akaun bank, soalan HR, pengumuman, dokumen
  sql(`insert into letter_requests(company_id, employment_id, kind, purpose, source) values ('${CO}', '${AMIN}', 'employment', 'Pinjaman perumahan', 'employee')`);
  sql(`insert into company_assets(company_id, employment_id, name, status, created_by) values ('${CO}', '${AMIN}', 'Telefon Samsung A55', 'pending', '${AMIN_P}')`);
  sql(`insert into bank_change_requests(person_id, bank_name, bank_account_no) values ('${AMIN_P}', 'CIMB', '7000123456')`);
  sql(`insert into hr_questions(company_id, employment_id, question) values ('${CO}', '${AMIN}', 'Adakah cuti haji dibayar penuh?')`);
  sql(`insert into announcements(company_id, title, body) values ('${CO}', 'Hari keluarga', 'Sabtu ini di Taman Tasik')`);
  sql(`insert into employee_documents(employment_id, doc_type, title, storage_path) values ('${AMIN}', 'contract', 'Kontrak 2026', 'x/kontrak.pdf')`);

  const browser = await chromium.launch();
  let { ctx, p } = await login(browser, '100000002', { width: 390, height: 844 });

  log('1. Kelulusan: keputusan lain ikut peranan (Lily, HR)');
  await p.goto(BASE + '/kelulusan');
  await p.waitForSelector('text=Telefon Samsung A55', { timeout: 20000 });
  const teks = await p.innerText('main');
  expect(teks.includes('Memohon surat pengesahan majikan') && teks.includes('Pinjaman perumahan'), 'permintaan surat dipaparkan');
  expect(teks.includes('Tukar akaun bank: CIMB (…3456)'), 'akaun bank (4 digit akhir sahaja)');
  expect(teks.includes('Adakah cuti haji dibayar penuh?'), 'soalan HR dipaparkan');
  for (const c of ['Surat · 1', 'Inventori · 1', 'Akaun bank · 1', 'Soalan HR · 1']) expect((await p.locator(`button[aria-pressed]:has-text("${c}")`).count()) === 1, `cip ${c}`);
  await p.click('button[aria-pressed]:has-text("Inventori · 1")');
  expect(!(await p.innerText('main')).includes('Pinjaman perumahan'), 'tapis Inventori menyorok jenis lain');
  await p.screenshot({ path: `${shots}/kelulusan-lain.png`, fullPage: true });
  await p.click('main button:has-text("Sahkan")');
  await p.waitForSelector('text=Inventori disahkan.');
  expect(sql(`select status from company_assets where name = 'Telefon Samsung A55'`) === 'verified', 'inventori disahkan terus dari Kelulusan');
  await p.click('button[aria-pressed]:has-text("Semua")');
  await p.locator('div:has(> a:has-text("Adakah cuti haji")) >> button:has-text("Jawab")').click();
  await p.fill('[role=alertdialog] textarea, [role=alertdialog] input', 'Ya, cuti haji dibayar penuh sekali sepanjang perkhidmatan.');
  await p.click('[role=alertdialog] button:has-text("Hantar jawapan")');
  await p.waitForSelector('text=Jawapan dihantar');
  expect(sql(`select status from hr_questions where question like 'Adakah cuti haji%'`) === 'answered', 'soalan dijawab terus dari Kelulusan');
  await p.locator('div:has(> a:has-text("Tukar akaun bank")) >> button:has-text("Tolak")').click();
  await p.fill('[role=alertdialog] textarea, [role=alertdialog] input', 'Nama pemegang akaun tidak sepadan');
  await p.click('[role=alertdialog] button:has-text("Tolak")');
  await p.waitForSelector('text=Ditolak. Pekerja dimaklumkan.');
  expect(sql(`select status from bank_change_requests where bank_name = 'CIMB'`) === 'rejected', 'akaun bank ditolak terus dari Kelulusan');
  await ctx.close();

  log('2. Pekerja biasa (Amin): tiada keputusan HR');
  ({ ctx, p } = await login(browser, '100000004', { width: 390, height: 844 }));
  await p.goto(BASE + '/kelulusan');
  await p.waitForSelector('[role=tablist]');
  await p.waitForTimeout(1500);
  expect(!(await p.innerText('main')).includes('Pinjaman perumahan'), 'pekerja tidak nampak permintaan surat');
  await ctx.close();

  log('3. Padam pengumuman & dokumen → Rekod dipadam → Pulihkan');
  ({ ctx, p } = await login(browser, '100000002', { width: 1280, height: 900 }));
  await p.goto(BASE + '/pengurusan/pengumuman');
  await p.waitForSelector('text=Hari keluarga', { timeout: 20000 });
  await p.locator('div:has(> div:has-text("Hari keluarga")) >> button:has-text("Padam")').first().click();
  await p.click('[role=alertdialog] button:has-text("Padam")');
  await p.waitForSelector('text=Pengumuman dipadam');
  expect(sql(`select count(*) from announcements where title = 'Hari keluarga'`) === '0', 'pengumuman dipadam');
  await p.goto(`${BASE}/pengurusan/pekerja/${AMIN}`);
  await p.click('button:has-text("Dokumen")');
  await p.waitForSelector('text=Kontrak 2026');
  await p.click('button[aria-label="Padam Kontrak 2026"]');
  await p.click('[role=alertdialog] button:has-text("Padam")');
  await p.waitForSelector('text=Dokumen pekerja dipadam');
  expect(sql(`select count(*) from employee_documents where title = 'Kontrak 2026'`) === '0', 'dokumen dipadam');
  await p.goto(BASE + '/pengurusan/tetapan/rekod-dipadam');
  await p.waitForSelector('main >> text=Hari keluarga', { timeout: 20000 });
  const rekod = await p.innerText('main');
  expect(rekod.includes('Kontrak 2026') && rekod.includes('Dipadam oleh'), 'rekod dipadam disenaraikan dengan siapa memadam');
  await p.screenshot({ path: `${shots}/rekod-dipadam.png`, fullPage: true });
  await p.locator('div:has(> span b:text-is("Hari keluarga")) >> button:has-text("Pulihkan")').click();
  await p.click('[role=alertdialog] button:has-text("Pulihkan")');
  await p.waitForSelector('text=Dipulihkan.');
  expect(sql(`select count(*) from announcements where title = 'Hari keluarga'`) === '1', 'pengumuman dipulihkan');
  await p.goto(BASE + '/pengurusan/pengumuman');
  await p.waitForSelector('text=Hari keluarga');
  expect(true, 'pengumuman kembali dalam senarai');
  await ctx.close();

  await browser.close();
  log('LULUS: padam & kelulusan');
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
