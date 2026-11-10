// Ujian hujung-ke-hujung fail bayaran bank (TEMPATAN SAHAJA):
//  HR: Penggajian → Sejarah → Bank → pilih Maybank2u Biz → susun lajur → muat turun;
//  semak kandungan fail (kod SWIFT, no. KP tanpa sengkang, tarikh DD/MM/YYYY, huruf besar) dan format disimpan.
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000. Jalankan: node web/e2e/fail-bank.cjs
const fs = require('fs');
const { execSync } = require('child_process');
const { chromium } = require('playwright');
require('./_bahasa.cjs');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };
const V = (s) => `${s} >> visible=true`;
const sql = (q) => execSync(`psql -h 127.0.0.1 -p 54322 -U postgres -Atc "${q}"`, { env: { ...process.env, PGPASSWORD: 'postgres' } }).toString().trim();

(async () => {
  const C = '00000000-0000-0000-0000-0000000000c1';
  // Data ujian: gaji Oktober tahun ini diluluskan untuk semua pekerja DEMO
  const y = new Date().getFullYear();
  sql(`insert into payroll_runs(id, company_id, period_year, period_month, status, pay_date) values ('00000000-0000-0000-0000-0000000bb010', '${C}', ${y}, 10, 'approved', '${y}-10-28')`);
  sql(`insert into payslips(payroll_run_id, employment_id, gross, total_deduction, net, epf_employee, epf_employer, socso_employee, socso_employer, eis_employee, eis_employer, pcb, hrdf)
       select '00000000-0000-0000-0000-0000000bb010', e.id, 3500, 409.15, 3090.85, 385, 455, 17.25, 60.35, 6.90, 6.90, 0, 0 from employments e where e.company_id = '${C}'`);
  sql(`update persons set bank_name = 'Maybank', bank_account_no = '5140-1234-5678' where id = (select person_id from employments where employee_no = 'DEMO004')`);
  sql(`update persons set bank_name = 'Bank Tidak Dikenali' where id = (select person_id from employments where employee_no = 'DEMO006')`);

  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => log('   [ralat halaman]', e.message));
  await p.goto(BASE + '/masuk');
  await p.fill('input[type=email]', 'lily@demo.hrboost.io');
  await p.fill('input[autocomplete=current-password]', 'Demo1234');
  await p.click('button[type=submit]');
  await p.waitForURL(/\/pengurusan$/);
  await p.goto(BASE + '/pengurusan/gaji/sejarah');
  await p.click(V('button:text-is("Bank")'));
  await p.waitForSelector(V('[role=dialog] >> text=Fail bayaran bank'));
  await p.selectOption('[role=dialog] select >> nth=0', 'maybank');
  await p.waitForSelector(V('[role=dialog] >> text=Beneficiary Bank Code'));
  const dialog = await p.locator('[role=dialog]').innerText();
  expect(/MBBEMYKL/.test(dialog), 'pratonton: kod SWIFT Maybank (MBBEMYKL)');
  expect(/kod bank tidak dikenali \(Bank Tidak Dikenali\)/.test(dialog), 'amaran: bank pekerja tidak dikenali');
  // Susun lajur: buang lajur e-mel, tukar tajuk rujukan
  await p.click(V('button:has-text("Susun lajur ikut templat bank")'));
  await p.click(V('button[aria-label="Buang lajur 10"]'));
  await p.fill('input[aria-label="Tajuk lajur 5"]', 'Reference');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click(V('button:has-text("Muat turun fail CSV")'))]);
  const isi = fs.readFileSync(await dl.path(), 'utf8');
  const baris = isi.trim().split(/\r\n/);
  log('   ' + baris[0]);
  const amin = baris.find((x) => x.includes('AMIN'));
  log('   ' + amin);
  expect(baris[0] === 'Beneficiary Name,Beneficiary Account No,Beneficiary Bank Code,Payment Amount,Reference,Payment Description,ID Type,ID Number,Credit Date', 'tajuk lajur ikut susunan baharu (tanpa e-mel)');
  expect(/^AMIN BIN DEMO,514012345678,MBBEMYKL,3090\.85,GAJI10\d{4},GAJI 10\/\d{4},NRIC,\d{12},28\/10\/\d{4}$/.test(amin), 'baris Amin: huruf besar, akaun & KP tanpa sengkang, SWIFT, amaun, tarikh DD/MM/YYYY');
  expect(baris.length === 7, '6 pekerja + baris tajuk');
  const simpan = sql(`select bank_file_format->>'id' || ':' || jsonb_array_length(bank_file_format->'columns') from companies where id = '${C}'`);
  expect(simpan === 'maybank:9', 'format disimpan untuk syarikat (9 lajur)');
  expect(Number(sql(`select count(*) from data_access_log where resource = 'bank'`)) >= 6, 'akses akaun bank direkodkan');
  // Dibuka semula: format syarikat dipilih secara automatik
  await p.keyboard.press('Escape');
  await p.goto(BASE + '/pengurusan/gaji/sejarah');
  await p.click(V('button:text-is("Bank")'));
  await p.waitForSelector(V('[role=dialog] >> text=Reference'));
  expect(true, 'dibuka semula: susunan lajur syarikat digunakan');
  await b.close();
  log('LULUS: fail bayaran bank');
})().catch((e) => { console.error(e); process.exit(1); });
