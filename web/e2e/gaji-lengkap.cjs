// Ujian Gaji lengkap (TEMPATAN SAHAJA): Tetapan Gaji, Item gaji, maklumat berkanun pekerja (zakat),
// item bulan ini (bonus + keterangan), laporan varians, fail CP39 (panjang rekod), lepas slip, buka semula,
// kitaran tambahan (bonus), CP22 & PCB II.
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000. Jalankan: node web/e2e/gaji-lengkap.cjs
const { execSync } = require('child_process');
const fs = require('fs');
const { chromium } = require('playwright');
require('./_bahasa.cjs');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };
const V = (s) => `${s} >> visible=true`;
const sql = (q) => execSync(`psql -h 127.0.0.1 -p 54322 -U postgres -Atc "${q.replace(/"/g, '\\"')}"`, { env: { ...process.env, PGPASSWORD: 'postgres' } }).toString().trim();
const AMIN = '00000000-0000-0000-0000-0000000000e4';
const C = '00000000-0000-0000-0000-0000000000c1';

async function masuk(b, email) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => log('   [ralat halaman]', e.message));
  await p.goto(BASE + '/masuk');
  await p.fill('input[type=email]', email);
  await p.fill('input[autocomplete=current-password]', 'Demo1234');
  await p.click('button[type=submit]');
  await p.waitForURL(/\/(utama|pengurusan)/, { timeout: 30000 });
  return { ctx, p };
}

(async () => {
  const b = await chromium.launch();
  const { ctx, p } = await masuk(b, 'lily@demo.hrboost.io');

  log('1. Tetapan Gaji');
  await p.goto(BASE + '/pengurusan/gaji/tetapan');
  await p.waitForSelector(V('text=NOMBOR MAJIKAN'));
  await p.fill('label:has-text("No. majikan LHDN (E)") input', 'E 9876543-01');
  await p.fill('label:has-text("Hari gaji") input', '28');
  await p.fill('label:has-text("Nama penuh") input', 'Sadam Hussein');
  await p.click(V('[aria-label="Prorata (pekerja mula / berhenti pertengahan bulan)"] button:has-text("Hari bekerja")'));
  await p.waitForSelector(V('text=RM 3,000 ÷ 20'));
  await p.click(V('button:has-text("Simpan tetapan")'));
  await p.waitForSelector(V('text=Tetapan gaji disimpan.'));
  expect(sql(`select lhdn_employer_no || '|' || payday || '|' || prorate_basis || '|' || signatory_name from companies where id = '${C}'`) === 'E 9876543-01|28|working|Sadam Hussein', 'tetapan disimpan (no. E, hari gaji, asas prorata, penandatangan)');
  sql(`update companies set prorate_basis = 'calendar' where id = '${C}'`);

  log('2. Item gaji');
  await p.click(V('nav[aria-label="Penggajian"] a:has-text("Item gaji")'));
  await p.waitForSelector(V('text=Manfaat kereta (BIK)'));
  expect(true, 'katalog: pendapatan, potongan, manfaat (BIK)');
  await p.click(V('button:has-text("+ Tambah item")'));
  await p.fill('[role=dialog] label:has-text("Nama item") input', 'Elaun Projek');
  await p.click('[role=dialog] button[aria-label="Dikenakan KWSP"]');
  await p.click('[role=dialog] button:has-text("Simpan")');
  await p.waitForSelector(V('main >> text=Elaun Projek'));
  expect(sql(`select epf_applicable || '|' || ea_field || '|' || taxable from pay_components where company_id = '${C}' and name = 'Elaun Projek'`) === 'false|B1c|true', 'item baharu: tanpa KWSP, EA B1c, bercukai');

  log('3. Maklumat berkanun Amin (zakat)');
  await p.goto(BASE + `/pengurusan/pekerja/${AMIN}`);
  await p.click(V('[role=tab]:has-text("Gaji")'));
  await p.waitForSelector(V('text=Maklumat berkanun & cukai'));
  await p.click(V('section[aria-label="Maklumat berkanun & cukai"] button:has-text("Ubah")'));
  await p.fill('[role=dialog] label:has-text("Zakat sebulan (RM)") input', '50');
  await p.selectOption('[role=dialog] label:has-text("Kategori KWSP") select', 'citizen');
  await p.click('[role=dialog] button:has-text("Simpan")');
  await p.waitForSelector(V('section[aria-label="Maklumat berkanun & cukai"] >> text=RM 50.00'));
  expect(sql(`select zakat_monthly from employment_statutory where employment_id = '${AMIN}'`) === '50', 'zakat RM50 sebulan disimpan');
  const [cp22] = await Promise.all([p.waitForURL('**/cp22/**'), p.click(V('a:has-text("Borang CP22")'))]);
  void cp22;
  await p.waitForSelector(V('text=PEMBERITAHUAN MENGENAI PEKERJA BAHARU'));
  expect((await p.innerText('article')).includes('Sadam Hussein'), 'CP22: butiran pekerja & penandatangan');
  await p.goBack();

  log('4. Proses Gaji: item bulan ini, kira, varians');
  // data terkumpul Jan–Okt supaya PCB bulan ini dikira atas pendapatan setahun
  sql(`delete from payroll_opening_balances where employment_id = '${AMIN}'`);
  sql(`insert into payroll_opening_balances(employment_id, year, up_to_month, gross, epf, pcb) values ('${AMIN}', extract(year from current_date)::int, extract(month from current_date)::int - 1, 42000, 4620, 0)`);
  await p.goto(BASE + '/pengurusan/gaji');
  await p.waitForSelector(V('text=DATA BULAN INI (AUTOMATIK)'));
  await p.click(V('button:has-text("+ Tambah item")'));
  await p.selectOption('[role=dialog] label:has-text("Pekerja") select', { label: 'Amin · DEMO004' });
  await p.selectOption('[role=dialog] label:has-text("Item") select', 'BONUS');
  await p.fill('[role=dialog] label:has-text("Jumlah (RM)") input', '1000');
  await p.fill('[role=dialog] label:has-text("Keterangan pada slip") input', 'Bonus prestasi');
  await p.click('[role=dialog] button:has-text("Simpan")');
  await p.waitForSelector('text=Disimpan untuk Amin.');
  await p.keyboard.press('Escape');
  await p.waitForSelector(V('section[aria-label="Item bulan ini"] >> text=Bonus prestasi'));
  expect(true, 'item sekali dengan keterangan dipaparkan');
  await p.click(V('button:has-text("Kira Gaji")'));
  await p.waitForSelector(V('text=Jumlah kasar'));
  const run = sql(`select id from payroll_runs where company_id = '${C}' and cycle_no = 1 order by created_at desc limit 1`);
  const garis = sql(`select string_agg(l.component_code || '=' || l.amount, ',' order by l.component_code) from payslip_lines l join payslips s on s.id = l.payslip_id where s.payroll_run_id = '${run}' and s.employment_id = '${AMIN}'`);
  expect(garis.includes('BONUS=1000') && garis.includes('ZAKAT=50') && garis.includes('SKBBK=') && /PCB=\d/.test(garis), 'slip Amin: bonus, zakat, SKBBK & PCB: ' + garis);
  await p.click(V('button:has-text("Laporan varians")'));
  await p.waitForSelector(V('section[aria-label="Laporan varians"] table'));
  const [csv] = await Promise.all([p.waitForEvent('download'), p.click(V('button:has-text("Muat turun laporan varians (CSV)")'))]);
  expect(fs.readFileSync(await csv.path(), 'utf8').includes('Amin'), 'laporan varians dimuat turun (CSV)');

  log('5. Diluluskan → fail CP39, lepas slip, buka semula');
  sql(`update payroll_runs set status = 'approved' where id = '${run}'`);
  await p.reload();
  await p.waitForSelector(V('text=MUAT TURUN'));
  const [cp39] = await Promise.all([p.waitForEvent('download'), p.click(V('text=PCB CP39 (fail teks e-Data PCB) >> xpath=../.. >> button'))]);
  const teks = fs.readFileSync(await cp39.path(), 'utf8').split('\r\n');
  expect(teks[0].length === 57 && teks.length >= 2 && teks.slice(1).every((x) => x.length === 136), `CP39: rekod H 57 aksara, ${teks.length - 1} rekod D 136 aksara`);
  await p.waitForSelector(V('text=Slip belum dilepaskan'));
  await p.click(V('button:has-text("Lepaskan sekarang")'));
  await p.waitForSelector(V('text=Slip telah dilepaskan kepada pekerja'));
  expect(sql(`select payslip_release_at is not null from payroll_runs where id = '${run}'`) === 't', 'slip dilepaskan');
  await p.fill(V('label:has-text("No. resit bayaran PCB") input'), 'LHDN-123');
  await p.click(V('label:has-text("No. resit bayaran PCB") button'));
  await p.waitForSelector(V('label:has-text("No. resit bayaran PCB") button:has-text("Disimpan")'));
  await p.click(V('button:has-text("Buka semula gaji ini")'));
  await p.fill('[role=alertdialog] textarea', 'Silap jumlah bonus');
  await p.click('[role=alertdialog] button:has-text("Buka semula")');
  await p.waitForSelector(V('button:has-text("Kira semula")'));
  expect(sql(`select status || '|' || (payslip_release_at is null) from payroll_runs where id = '${run}'`) === 'calculated|true', 'dibuka semula: kembali ke Langkah 2, slip ditarik balik');

  log('6. Kitaran tambahan (bonus)');
  await p.click(V('button:has-text("+ Kitaran tambahan (bonus)")'));
  await p.fill('[role=alertdialog] textarea', 'Bonus Tahunan');
  await p.click('[role=alertdialog] button:has-text("Cipta")');
  await p.waitForSelector(V('button[aria-pressed=true]:has-text("Bonus Tahunan")'));
  await p.click(V('button:has-text("+ Tambah item")'));
  await p.selectOption('[role=dialog] label:has-text("Pekerja") select', { label: 'Amin · DEMO004' });
  await p.selectOption('[role=dialog] label:has-text("Item") select', 'BONUS');
  await p.fill('[role=dialog] label:has-text("Jumlah (RM)") input', '2000');
  await p.click('[role=dialog] button:has-text("Simpan")');
  await p.waitForSelector('text=Disimpan untuk Amin.');
  await p.keyboard.press('Escape');
  await p.click(V('button:has-text("Kira Gaji")'));
  await p.waitForSelector(V('text=Jumlah kasar'));
  const tb = sql(`select count(*) || '|' || max(s.gross) || '|' || max(s.socso_employee) from payslips s join payroll_runs r on r.id = s.payroll_run_id where r.company_id = '${C}' and r.kind = 'additional'`);
  expect(tb === '1|2000.00|0.00', 'kitaran tambahan: 1 slip, kasar RM2,000, tiada PERKESO: ' + tb);
  await p.click(V('button:has-text("Gaji bulanan")'));
  await p.waitForSelector(V('button:has-text("Kira semula")'));
  expect(true, 'tukar kembali ke gaji bulanan');

  log('7. Penyata PCB II');
  await p.goto(BASE + `/pengurusan/gaji/pcb/${AMIN}`);
  await p.waitForSelector(V('text=PENYATA POTONGAN CUKAI BULANAN'));
  expect(true, 'penyata PCB II dipaparkan');

  await ctx.close();
  await b.close();
  log('LULUS: Gaji lengkap');
})().catch((e) => { console.error(e); process.exit(1); });
