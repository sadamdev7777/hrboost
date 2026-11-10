// Ujian profil pekerja lanjutan (TEMPATAN SAHAJA):
//  Garis masa kerja automatik (mula bekerja + tukar jawatan), tambah peristiwa manual, Latihan & sijil (amaran tamat),
//  Aset syarikat, Keluarga, Warganegara; pekerja biasa boleh membaca rekod sendiri tetapi tidak menulis.
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000. Jalankan: node web/e2e/profil-lanjut.cjs
const { execSync } = require('child_process');
const { chromium } = require('playwright');
require('./_bahasa.cjs');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };
const V = (s) => `${s} >> visible=true`;
const sql = (q) => execSync(`psql -h 127.0.0.1 -p 54322 -U postgres -Atc "${q}"`, { env: { ...process.env, PGPASSWORD: 'postgres' } }).toString().trim();
const AMIN = '00000000-0000-0000-0000-0000000000e4';
const dlm = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

(async () => {
  log('0. Garis masa automatik: tukar jawatan Amin');
  expect(Number(sql(`select count(*) from job_timeline where employment_id = '${AMIN}' and event = 'started'`)) === 1, 'rekod "Mula bekerja" diisi untuk pekerja sedia ada');
  sql(`insert into positions(id, company_id, title) values ('00000000-0000-0000-0000-00000000f001', employment_company('${AMIN}'), 'Eksekutif Kanan Pelancongan') on conflict do nothing`);
  sql(`update employments set position_id = '00000000-0000-0000-0000-00000000f001' where id = '${AMIN}'`);
  expect(sql(`select event from job_timeline where employment_id = '${AMIN}' order by created_at desc limit 1`) === 'promoted', 'tukar jawatan → peristiwa "Kenaikan / tukar jawatan" direkod automatik');

  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => log('   [ralat halaman]', e.message));
  await p.goto(BASE + '/masuk');
  await p.fill('input[type=email]', 'lily@demo.hrboost.io');
  await p.fill('input[autocomplete=current-password]', 'Demo1234');
  await p.click('button[type=submit]');
  await p.waitForURL(/\/pengurusan$/);
  await p.goto(BASE + '/pengurusan/pekerja/' + AMIN);

  log('1. Tab Kerjaya: garis masa & latihan');
  await p.click(V('[role=tab]:has-text("Kerjaya")'));
  await p.waitForSelector(V('section[aria-label="GARIS MASA KERJA"] >> text=Kenaikan / tukar jawatan'));
  expect(true, 'garis masa memaparkan peristiwa automatik');
  const dlg = p.locator(V('[role=dialog]'));
  await p.click(V('button:has-text("+ Tambah peristiwa")'));
  await dlg.locator('input[type=date]').fill('2024-01-15');
  await dlg.locator('select').first().selectOption('transferred');
  await dlg.locator('label:has-text("Catatan") input').fill('Pertukaran ke cawangan Shah Alam');
  await dlg.locator('button:has-text("Simpan")').click();
  await p.waitForSelector(V('text=Pertukaran ke cawangan Shah Alam'));
  expect(true, 'peristiwa manual ditambah');
  await p.click(V('button:has-text("+ Tambah latihan / sijil")'));
  await dlg.locator('select').first().selectOption('certification');
  await dlg.locator('label:has-text("Tajuk") input').fill('Sijil Keselamatan Makanan');
  await dlg.locator('label:has-text("Sijil tamat tempoh") input').fill(dlm(30));
  await dlg.locator('button:has-text("Simpan")').click();
  await p.waitForSelector(V('text=Sijil Keselamatan Makanan'));
  expect(await p.locator(V('text=/Tamat dalam (29|30) hari/')).count() === 1, 'sijil: amaran "Tamat dalam 30 hari"');

  log('2. Tab Aset');
  await p.click(V('[role=tab]:has-text("Aset")'));
  await p.click(V('button:has-text("+ Tambah aset")'));
  await dlg.locator('label:has-text("Nama aset") input').fill('MacBook Air M2');
  await dlg.locator('label:has-text("No. siri") input').fill('C02XK1');
  await dlg.locator('button:has-text("Simpan")').click();
  await p.waitForSelector(V('text=MacBook Air M2'));
  expect(await p.locator(V('text=Dipegang')).count() >= 1, 'aset ditambah (status Dipegang)');

  log('3. Maklumat: keluarga & warganegara');
  await p.click(V('[role=tab]:has-text("Maklumat")'));
  await p.waitForSelector(V('text=Warganegara'));
  await p.click(V('button:has-text("+ Tambah ahli keluarga")'));
  await dlg.locator('select').first().selectOption('child');
  await dlg.locator('label:has-text("Nama") input').first().fill('Aisyah binti Amin');
  await dlg.locator('button:has-text("Simpan")').click();
  await p.waitForSelector(V('text=Aisyah binti Amin'));
  expect(true, 'anak ditambah dalam Keluarga');
  await ctx.close();

  log('4. Kebenaran: Amin (pekerja) boleh membaca rekod sendiri, tidak boleh menulis');
  const amin = sql(`select p.auth_user_id from persons p join employments e on e.person_id = p.id where e.id = '${AMIN}'`);
  const sebagai = (q) => sql(`begin; set local role authenticated; set local request.jwt.claims = '{\\"sub\\":\\"${amin}\\",\\"role\\":\\"authenticated\\"}'; ${q}; commit;`);
  expect(/\b1\b/.test(sebagai(`select count(*) from company_assets where employment_id = '${AMIN}'`)), 'Amin melihat aset sendiri');
  let ditolak = false;
  try { sebagai(`insert into company_assets(employment_id, name) values ('${AMIN}', 'Telefon curi')`); } catch { ditolak = true; }
  expect(ditolak, 'Amin tidak boleh menambah aset');

  await b.close();
  log('LULUS: profil pekerja lanjutan');
})().catch((e) => { console.error(e); process.exit(1); });
