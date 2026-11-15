// Ujian hujung-ke-hujung surat HR: Lily jana surat tawaran & amaran untuk Amin → Amin nampak dalam Mohon → Surat;
// Amin berhenti → surat terima peletakan jawatan menyenaraikan laptop belum dipulangkan; memo pendahuluan gaji
// kepada Kewangan tidak dilihat oleh Amin.
// Prasyarat: `npx supabase db reset` (data demo), aplikasi di localhost:3000.
// Jalankan: node web/e2e/surat-hr.cjs
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

async function login(browser, phone, viewport) {
  const ctx = await browser.newContext({ viewport });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => log('   [ralat halaman]', e.message));
  await p.goto(BASE + '/masuk');
  await p.fill('input[type=email]', emelDemo(phone));
  await p.fill('input[autocomplete=current-password]', 'Demo1234');
  await p.click('button[type=submit]');
  await p.waitForURL(/\/(utama|pengurusan)$/, { timeout: 15000 });
  return { ctx, p };
}

async function janaDariProfil(p, jenis) {
  await p.goto(`${BASE}/pengurusan/pekerja/${AMIN}`);
  await p.waitForSelector('text=TINDAKAN', { timeout: 15000 });
  await p.click('button:has-text("Jana surat")');
  await p.click(`[role=dialog] button:has-text("${jenis}")`);
}

(async () => {
  const browser = await chromium.launch();
  let { ctx, p } = await login(browser, '100000002', { width: 1280, height: 900 });

  log('1. Lily: surat tawaran kerja untuk Amin (data diambil daripada rekod)');
  await janaDariProfil(p, 'Surat tawaran kerja');
  await p.waitForSelector('[role=dialog] >> text=Tarikh akhir menerima tawaran');
  await p.screenshot({ path: `${shots}/surat-dialog.png` });
  await p.click('[role=dialog] button:has-text("Keluarkan surat")');
  await p.waitForURL(/\/surat\/[0-9a-f-]+$/, { timeout: 15000 });
  await p.waitForSelector('article >> text=Tawaran pekerjaan', { timeout: 15000 });
  let teks = await p.innerText('article');
  expect(teks.includes('Amin bin Demo'), 'nama penuh pekerja');
  expect(/Gaji pokok bulanan\s*:\s*RM\s?[\d,]+\.\d\d/.test(teks), 'gaji pokok daripada rekod');
  expect(/akuan penerimaan/i.test(teks) && /HR\/\d{4}\/0001/.test(teks), 'ruang akuan & no. rujukan');
  await p.screenshot({ path: `${shots}/surat-tawaran.png`, fullPage: true });

  log('2. Lily: surat amaran (peringatan Akta Kerja s.14)');
  await janaDariProfil(p, 'Surat amaran');
  expect(await p.locator('[role=dialog] >> text=Akta Kerja 1955 s.14').count() > 0, 'peringatan siasatan wajar dipaparkan');
  await p.click('[role=dialog] button:has-text("Keluarkan surat")');
  await p.waitForSelector('[role=dialog] >> text=Sila isi: Butiran salah laku');
  expect(true, 'butiran salah laku wajib');
  await p.fill('[role=dialog] label:has-text("Butiran salah laku") textarea', 'Lewat hadir bekerja sebanyak 6 kali dalam bulan Oktober 2026 tanpa sebab yang munasabah.');
  await p.click('[role=dialog] button:has-text("Keluarkan surat")');
  await p.waitForSelector('article >> text=Surat amaran pertama', { timeout: 15000 });
  teks = await p.innerText('article');
  expect(teks.includes('Lewat hadir bekerja sebanyak 6 kali') && teks.includes('SULIT'), 'butiran amaran & tanda sulit');
  await p.screenshot({ path: `${shots}/surat-amaran.png`, fullPage: true });
  await ctx.close();

  log('3. Amin: surat HR dalam Mohon → Surat');
  ({ ctx, p } = await login(browser, '100000004', { width: 390, height: 844 }));
  await p.goto(BASE + '/mohon/surat');
  await p.waitForSelector('text=SURAT SAYA', { timeout: 15000 });
  teks = await p.innerText('main');
  expect(teks.includes('Surat tawaran kerja') && teks.includes('Surat amaran') && teks.includes('Dikeluarkan oleh HR'), 'tawaran & amaran kelihatan kepada pekerja');
  await p.screenshot({ path: `${shots}/surat-pekerja.png` });
  await ctx.close();

  log('4. Amin berhenti → surat terima peletakan jawatan dengan inventori belum dipulangkan');
  sql(`insert into company_assets(employment_id, company_id, name, serial_no, status) values ('${AMIN}', '00000000-0000-0000-0000-0000000000c1', 'Laptop Dell Latitude', 'SN-8842', 'verified')`);
  sql(`update employments set end_date = current_date + 30, end_status = 'resigned' where id = '${AMIN}'`);
  ({ ctx, p } = await login(browser, '100000002', { width: 1280, height: 900 }));
  await p.goto(`${BASE}/pengurusan/pekerja/${AMIN}`);
  await p.waitForSelector('text=hari bekerja terakhir', { timeout: 15000 });
  await p.locator('div:has-text("hari bekerja terakhir") >> button:has-text("Jana surat")').first().click();
  await p.waitForSelector('[role=dialog] >> text=Tarikh surat peletakan jawatan diterima');
  await p.click('[role=dialog] button:has-text("Keluarkan surat")');
  await p.waitForSelector('article >> text=Penerimaan peletakan jawatan', { timeout: 15000 });
  teks = await p.innerText('article');
  expect(teks.includes('Laptop Dell Latitude (No. siri: SN-8842)'), 'laptop belum dipulangkan disenaraikan');

  log('5. Memo pendahuluan gaji kepada Kewangan');
  sql(`insert into salary_advances(employment_id, amount, reason, status, deduct_year, deduct_month) values ('${AMIN}', 500, 'Kecemasan keluarga', 'approved', 2026, 12)`);
  await p.goto(BASE + '/pengurusan/gaji/pendahuluan');
  await p.click('button:has-text("Memo kepada Kewangan")');
  await p.click('[role=dialog] button:has-text("Keluarkan surat")');
  await p.waitForSelector('article >> text=MEMO DALAMAN', { timeout: 15000 });
  teks = await p.innerText('article');
  expect(teks.includes('Jabatan Kewangan') && /RM\s?500\.00/.test(teks), 'memo dialamatkan kepada Kewangan dengan jumlah');
  await p.goto(BASE + '/pengurusan/gaji/pendahuluan');
  await p.waitForSelector('a:has-text("Lihat memo")');
  expect(true, 'pautan Lihat memo menggantikan butang');
  await p.goto(`${BASE}/pengurusan/pekerja/${AMIN}`);
  await p.waitForSelector('text=SURAT · 4', { timeout: 15000 });
  expect(true, 'profil pekerja menyenaraikan 4 surat');
  await ctx.close();

  ({ ctx, p } = await login(browser, '100000004', { width: 390, height: 844 }));
  await p.goto(BASE + '/mohon/surat');
  await p.waitForSelector('text=SURAT SAYA', { timeout: 15000 });
  expect(!(await p.innerText('main')).includes('Memo pendahuluan gaji'), 'memo tidak dilihat oleh pekerja');
  await ctx.close();

  await browser.close();
  log('LULUS: surat HR');
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
