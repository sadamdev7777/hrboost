// Ujian hujung-ke-hujung Borang EA & nama panggilan pukal (TEMPATAN SAHAJA):
//  1. HR: Penggajian → Borang EA & E: angka 2025, lihat Borang EA, keluarkan kepada pekerja.
//  2. Pekerja (Amin): Slip Gaji → Borang EA 2025.
//  3. HR: Pekerja → Nama panggilan: cadangan automatik, ubah, simpan semua.
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000. Jalankan: node web/e2e/ea-nama.cjs
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { chromium } = require('playwright');
require('./_bahasa.cjs');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const shots = process.env.E2E_SHOTS || os.tmpdir();
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };
const V = (s) => `${s} >> visible=true`;
const sql = (q) => execSync(`psql -h 127.0.0.1 -p 54322 -U postgres -Atc "${q}"`, { env: { ...process.env, PGPASSWORD: 'postgres' } }).toString().trim();
const TAHUN = new Date().getFullYear() - 1;

async function masuk(b, email, vp = { width: 1440, height: 900 }) {
  const ctx = await b.newContext({ viewport: vp });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => log('   [ralat halaman]', e.message));
  await p.goto(BASE + '/masuk');
  await p.fill('input[type=email]', email);
  await p.fill('input[autocomplete=current-password]', 'Demo1234');
  await p.click('button[type=submit]');
  await p.waitForURL(/\/(utama|pengurusan)$/, { timeout: 30000 });
  return { ctx, p };
}

(async () => {
  // Data ujian: gaji 12 bulan tahun lepas (RM3,500 sebulan) untuk semua pekerja DEMO
  const C = '00000000-0000-0000-0000-0000000000c1';
  sql(`update companies set lhdn_employer_no = 'E 9876543210' where id = '${C}'`);
  sql(`insert into payroll_runs(company_id, period_year, period_month, status) select '${C}', ${TAHUN}, m, 'paid' from generate_series(1, 12) m`);
  sql(`insert into payslips(payroll_run_id, employment_id, gross, total_deduction, net, epf_employee, epf_employer, socso_employee, socso_employer, eis_employee, eis_employer, pcb, hrdf)
       select r.id, e.id, 3500, 0, 0, 385, 455, 17.25, 60.35, 6.90, 6.90, 0, 0 from payroll_runs r join employments e on e.company_id = r.company_id where r.period_year = ${TAHUN}`);
  sql(`insert into payslip_lines(payslip_id, component_code, description, kind, amount)
       select s.id, 'BASIC', 'Gaji Pokok', 'earning', 3500 from payslips s join payroll_runs r on r.id = s.payroll_run_id where r.period_year = ${TAHUN}`);
  sql(`update persons set preferred_name = null where id in (select person_id from employments where employee_no in ('DEMO005','DEMO006'))`);

  const b = await chromium.launch();
  log('1. HR: Borang EA & E');
  let { ctx, p } = await masuk(b, 'lily@demo.hrboost.io');
  await p.click(V('aside a[href="/pengurusan/gaji"]'));
  await p.click(V('nav[aria-label="Penggajian"] >> text=Borang EA & E'));
  await p.waitForURL(/\/pengurusan\/gaji\/ea$/);
  await p.waitForSelector(V('table >> text=Amin bin Demo'));
  const jadual = await p.locator('table:visible').innerText();
  expect(/Amin bin Demo[\s\S]*12[\s\S]*RM 42,000\.00[\s\S]*RM 4,620\.00[\s\S]*RM 289\.80/.test(jadual), 'Amin: 12 bulan, saraan RM 42,000.00, KWSP RM 4,620.00, PERKESO RM 289.80');
  expect((await p.locator('main:visible').innerText()).includes('BORANG E ' + TAHUN), 'ringkasan Borang E dipaparkan');
  await p.screenshot({ path: path.join(shots, 'ea-hr.png'), fullPage: true });
  await p.click(V('tr:has-text("Amin bin Demo") >> text=Lihat EA'));
  await p.waitForSelector(V('text=PENYATA SARAAN DARIPADA PENGGAJIAN'));
  const ea = await p.locator('article.ea:visible').innerText();
  expect(ea.includes('Amin bin Demo') && ea.includes('42,000.00') && ea.includes('E 9876543210'), 'Borang EA Amin: nama penuh, B1(a) 42,000.00, No. Majikan E');
  await p.screenshot({ path: path.join(shots, 'ea-borang.png'), fullPage: true });
  await p.goBack();
  await p.click(V('button:has-text("Keluarkan kepada pekerja")'));
  await p.click(V('[role=alertdialog] button:has-text("Keluarkan")'));
  await p.waitForSelector(V('text=/Dikeluarkan \\d+/'));
  expect(sql(`select count(*) from ea_releases where company_id = '${C}' and year = ${TAHUN}`) === '1', 'Borang EA dikeluarkan');
  await ctx.close();

  log('2. Pekerja: Borang EA sendiri');
  ({ ctx, p } = await masuk(b, 'amin@demo.hrboost.io', { width: 390, height: 844 }));
  await p.goto(BASE + '/gaji');
  await p.click(V('button:has-text("Borang EA")'));
  await p.click(V(`a:has-text("Borang EA ${TAHUN}")`));
  await p.waitForSelector(V('text=PENYATA SARAAN DARIPADA PENGGAJIAN'));
  expect((await p.locator('article.ea:visible').innerText()).includes('42,000.00'), 'Amin melihat Borang EA sendiri (42,000.00)');
  await ctx.close();

  log('3. Nama panggilan pukal');
  ({ ctx, p } = await masuk(b, 'lily@demo.hrboost.io'));
  await p.click(V('aside a[href="/pengurusan/pekerja"]'));
  await p.click(V('nav[aria-label="Pekerja"] >> text=Nama panggilan'));
  await p.waitForSelector(V('input[aria-label="Nama panggilan Farah binti Demo"]'));
  expect((await p.inputValue(V('input[aria-label="Nama panggilan Farah binti Demo"]'))) === 'Farah', 'cadangan automatik: Farah');
  await p.fill(V('input[aria-label="Nama panggilan Zulfa binti Demo"]'), 'Fa');
  await p.click(V('button:has-text("Simpan semua")'));
  await p.waitForSelector(V('text=Semua pekerja sudah mempunyai nama panggilan'));
  expect(sql(`select string_agg(preferred_name, ',' order by preferred_name) from persons p join employments e on e.person_id = p.id where e.employee_no in ('DEMO005','DEMO006')`) === 'Fa,Farah', 'disimpan: Farah, Fa');
  await ctx.close();
  await b.close();
  log('LULUS: Borang EA & nama panggilan');
})().catch((e) => { console.error(e); process.exit(1); });
