// Ujian hujung-ke-hujung cadangan 5–17 (TEMPATAN SAHAJA):
//  1. Cuti ganti automatik dipaparkan di Tetapan → Cuti umum.
//  2. Laporan bulanan CEO: suis & pratonton di Automasi.
//  3. Penilaian prestasi: HR cipta & buka kitaran → Amin kendiri → Zuerin (ketua) menilai → HR muktamad → Amin nampak markah.
//  4. Slip gaji sebagai fail PDF sebenar.
//  5. Pentadbir Platform: Ralat aplikasi.
//  6. Integrasi Akaun: kad sambungan QuickBooks.
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000. Jalankan: node web/e2e/cadangan.cjs
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');
const { chromium } = require('playwright');
require('./_bahasa.cjs');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };
const V = (s) => `${s} >> visible=true`;
const sql = (q) => execSync(`psql -h 127.0.0.1 -p 54322 -U postgres -Atc "${q}"`, { env: { ...process.env, PGPASSWORD: 'postgres' } }).toString().trim();
const C = '00000000-0000-0000-0000-0000000000c1';

async function masuk(b, email, vp = { width: 1440, height: 900 }) {
  const ctx = await b.newContext({ viewport: vp, acceptDownloads: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => log('   [ralat halaman]', e.message));
  await p.goto(BASE + '/masuk');
  await p.fill('input[type=email]', email);
  await p.fill('input[autocomplete=current-password]', 'Demo1234');
  await p.click('button[type=submit]');
  await p.waitForURL(/\/(utama|pengurusan)$/, { timeout: 30000 });
  return { ctx, p };
}
const sahkanDialog = async (p, ok) => {
  await p.locator(V(`[role=alertdialog] button:has-text("${ok}")`)).last().click();
};

(async () => {
  // Data ujian: cuti umum syarikat pada Ahad 3 Jan 2027 (halaman Cuti umum memaparkan tahun hadapan dari Oktober)
  const y = new Date().getMonth() >= 9 ? new Date().getFullYear() + 1 : new Date().getFullYear();
  const ahad = (() => { const d = new Date(Date.UTC(y, 0, 1)); while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })();
  sql(`insert into public_holidays(holiday_date, name, is_adhoc, company_id) values ('${ahad}', 'Cuti Ujian E2E', true, '${C}') on conflict do nothing`);
  // Slip gaji bulan lepas dilepaskan kepada Amin
  sql(`insert into payroll_runs(id, company_id, period_year, period_month, status, payslip_release_at) values ('00000000-0000-0000-0000-00000000e2e1', '${C}', 2026, 10, 'paid', now() - interval '1 day')`);
  sql(`insert into payslips(id, payroll_run_id, employment_id, gross, total_deduction, net, epf_employee, epf_employer, socso_employee, socso_employer, eis_employee, eis_employer, pcb)
       select '00000000-0000-0000-0000-00000000e2e2', '00000000-0000-0000-0000-00000000e2e1', e.id, 3500, 409.15, 3090.85, 385, 455, 17.25, 60.35, 6.90, 6.90, 0 from employments e where e.employee_no = 'DEMO004'`);
  sql(`insert into payslip_lines(payslip_id, component_code, description, kind, amount) values
       ('00000000-0000-0000-0000-00000000e2e2', 'BASIC', 'Gaji Pokok', 'earning', 3500), ('00000000-0000-0000-0000-00000000e2e2', 'EPF', 'KWSP', 'deduction', 385),
       ('00000000-0000-0000-0000-00000000e2e2', 'SOCSO', 'PERKESO', 'deduction', 17.25), ('00000000-0000-0000-0000-00000000e2e2', 'EIS', 'SIP', 'deduction', 6.90),
       ('00000000-0000-0000-0000-00000000e2e2', 'EPF_ER', 'KWSP', 'employer', 455)`);
  sql(`select log_client_error('E2E ralat ujian', 'Error: E2E ralat ujian\n    at x (a.js:1:1)', '/ujian?token=rahsia', 'Playwright', 'e2e')`);
  sql(`update companies set accounting_system = 'quickbooks' where id = '${C}'`);

  const b = await chromium.launch();

  log('1. Cuti ganti automatik');
  let { ctx, p } = await masuk(b, 'lily@demo.hrboost.io');
  await p.goto(BASE + '/pengurusan/tetapan/cuti-umum');
  await p.waitForSelector(V(`text=CUTI GANTI ${y} (AUTOMATIK)`), { timeout: 20000 });
  const ganti = await p.locator('section[aria-label="Cuti ganti"]').innerText();
  log('   ', ganti.replace(/\s+/g, ' ').slice(0, 200));
  expect(/Cuti ganti: Cuti Ujian E2E/.test(ganti) && /4 Jan/.test(ganti), 'cuti pada Ahad diganti Isnin');

  log('2. Laporan bulanan CEO');
  await p.goto(BASE + '/pengurusan/tetapan/automasi');
  await p.waitForSelector(V('text=Laporan bulanan kepada CEO'), { timeout: 20000 });
  await p.click('button:has-text("Pratonton laporan bulan lepas")');
  const pr = await p.locator('pre').last().innerText();
  log('   ', pr.split('\n').slice(0, 3).join(' | '));
  expect(/^Laporan bulanan /.test(pr) && /Kos gaji|belum diluluskan/.test(pr), 'pratonton laporan');

  log('3. Penilaian prestasi');
  await p.goto(BASE + '/pengurusan/prestasi');
  await p.click(V('button:has-text("+ Kitaran baharu")'));
  await p.fill(V('[role=dialog] label:has-text("Nama kitaran") input'), 'Penilaian E2E');
  await p.click(V('[role=dialog] button:has-text("Simpan")'));
  await p.waitForSelector(V('button:has-text("Buka kepada pekerja")'), { timeout: 20000 });
  await p.click(V('button:has-text("Buka kepada pekerja")'));
  await sahkanDialog(p, 'Buka');
  await p.waitForSelector(V('text=Amin'), { timeout: 20000 });
  expect(await p.locator(V('text=Pelulus: Zuerin')).count() > 0, 'pelulus Amin = Zuerin');
  await ctx.close();

  ({ ctx, p } = await masuk(b, 'amin@demo.hrboost.io', { width: 390, height: 844 }));
  await p.goto(BASE + '/saya');
  await p.click(V('a:has-text("Penilaian prestasi")'));
  await p.click(V('a:has-text("Penilaian E2E")'));
  await p.waitForSelector(V('text=KPI & MATLAMAT'), { timeout: 20000 });
  const kumpulan = p.locator('[role=radiogroup][aria-label^="Markah kendiri"]');
  const n = await kumpulan.count();
  for (let i = 0; i < n; i++) await kumpulan.nth(i).locator('[role=radio]').nth(3).click();
  await p.fill(V('textarea'), 'Tahun yang produktif');
  await p.click(V('button:has-text("Hantar penilaian")'));
  await sahkanDialog(p, 'Hantar');
  await p.waitForURL('**/prestasi', { timeout: 20000 });
  expect(n === 4, `${n} KPI dinilai sendiri`);
  await ctx.close();

  ({ ctx, p } = await masuk(b, 'zuerin@demo.hrboost.io', { width: 390, height: 844 }));
  await p.goto(BASE + '/prestasi');
  await p.click(V('a:has-text("Amin")'));
  await p.waitForSelector(V('text=ULASAN PEKERJA'), { timeout: 20000 });
  const kp = p.locator('[role=radiogroup][aria-label^="Markah pelulus"]');
  for (let i = 0; i < (await kp.count()); i++) await kp.nth(i).locator('[role=radio]').nth(4).click();
  await p.click(V('button:has-text("Hantar penilaian")'));
  await sahkanDialog(p, 'Hantar');
  await p.waitForURL('**/prestasi', { timeout: 20000 });
  log('   Zuerin menilai Amin: 5/5');
  await ctx.close();

  ({ ctx, p } = await masuk(b, 'lily@demo.hrboost.io'));
  await p.goto(BASE + '/pengurusan/prestasi');
  await p.click(V('a:has-text("Amin")'));
  await p.waitForSelector(V('text=MUKTAMADKAN (HR)'), { timeout: 20000 });
  await p.click(V('button:has-text("Muktamadkan")'));
  await p.waitForURL('**/pengurusan/prestasi', { timeout: 20000 });
  await ctx.close();

  ({ ctx, p } = await masuk(b, 'amin@demo.hrboost.io', { width: 390, height: 844 }));
  await p.goto(BASE + '/prestasi');
  await p.click(V('a:has-text("Penilaian E2E")'));
  await p.waitForSelector(V('text=MARKAH AKHIR'), { timeout: 20000 });
  expect(await p.locator(V('text=5.00 / 5')).count() > 0, 'Amin melihat markah akhir 5.00');

  log('4. Slip gaji PDF');
  await p.goto(BASE + '/gaji/00000000-0000-0000-0000-00000000e2e2');
  await p.waitForSelector(V('button:has-text("Muat turun PDF")'), { timeout: 20000 });
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click(V('button:has-text("Muat turun PDF")'))]);
  const fail = os.tmpdir() + '/slip-e2e.pdf';
  await dl.saveAs(fail);
  const isi = fs.readFileSync(fail);
  log('   ', dl.suggestedFilename(), isi.length, 'bait');
  expect(isi.slice(0, 5).toString() === '%PDF-' && isi.length > 1500, 'fail PDF sebenar');
  expect(/^Slip-Gaji-2026-10-/.test(dl.suggestedFilename()), 'nama fail slip');
  await ctx.close();

  log('5. Ralat aplikasi (Pentadbir Platform)');
  ({ ctx, p } = await masuk(b, 'owner@demo.hrboost.io').catch(async () => {
    const ctx2 = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const p2 = await ctx2.newPage();
    await p2.goto(BASE + '/masuk');
    await p2.fill('input[type=email]', 'owner@demo.hrboost.io');
    await p2.fill('input[autocomplete=current-password]', 'Demo1234');
    await p2.click('button[type=submit]');
    await p2.waitForURL((u) => !u.pathname.startsWith('/masuk'), { timeout: 30000 });
    return { ctx: ctx2, p: p2 };
  }));
  await p.goto(BASE + '/admin/ralat');
  await p.waitForSelector(V('text=E2E ralat ujian'), { timeout: 20000 });
  const r = await p.locator(V('button:has-text("E2E ralat ujian")')).innerText();
  expect(/\/ujian/.test(r) && !/token/.test(r), 'ralat dipaparkan tanpa query string');
  await ctx.close();

  log('6. QuickBooks');
  ({ ctx, p } = await masuk(b, 'farah@demo.hrboost.io'));
  await p.goto(BASE + '/pengurusan/tetapan/akaun');
  await p.waitForSelector(V('button:has-text("Sambung QuickBooks")'), { timeout: 20000 });
  expect(true, 'butang Sambung QuickBooks dipaparkan kepada Kewangan');
  await ctx.close();

  log('7. Bahasa pekerja (lalai English, HR boleh tukar)');
  ({ ctx, p } = await masuk(b, 'lily@demo.hrboost.io'));
  const amin = sql(`select id from employments where employee_no = 'DEMO004'`);
  expect(sql(`select language from persons p join employments e on e.person_id = p.id where e.id = '${amin}'`) === 'en', 'lalai English');
  await p.goto(BASE + `/pengurusan/pekerja/${amin}`);
  await p.selectOption(V('select[aria-label="Bahasa Amin"]'), 'ms');
  await p.waitForSelector(V('text=Bahasa Amin dikemas kini.'), { timeout: 20000 });
  expect(sql(`select language from persons p join employments e on e.person_id = p.id where e.id = '${amin}'`) === 'ms', 'HR menukar bahasa Amin ke BM');
  await p.goto(BASE + '/pengurusan/pekerja/baru');
  expect((await p.getAttribute(V('[role=radiogroup][aria-label="Bahasa"] button:has-text("English")'), 'aria-checked')) === 'true', 'Tambah pekerja: English dipilih secara lalai');
  await ctx.close();

  await b.close();
  log('LULUS: cadangan 5–17');
})().catch((e) => {
  console.error('GAGAL:', e.message);
  process.exit(1);
});
