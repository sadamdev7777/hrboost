// Ujian Profil Saya (TEMPATAN SAHAJA):
//  Amin: meter kelengkapan, tukar gambar profil (galeri), ubah alamat & e-mel terus, mohon tukar bank & status perkahwinan (perlu HR)
//  → Lily (HR) melihat permohonan dalam Kelulusan (gambar profil pemohon, perbezaan lama → baharu) dan meluluskan → data dikemas kini automatik.
//  Kebenaran: bilangan anak tidak boleh diubah terus; gambar boleh dilihat rakan sekerja, tidak oleh orang luar syarikat.
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000. Jalankan: node web/e2e/profil-saya.cjs
const { execSync } = require('child_process');
const { chromium } = require('playwright');
require('./_bahasa.cjs');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };
const V = (s) => `${s} >> visible=true`;
const sql = (q) => execSync(`psql -h 127.0.0.1 -p 54322 -U postgres -Atc "${q.replace(/"/g, '\\"')}"`, { env: { ...process.env, PGPASSWORD: 'postgres' } }).toString().trim();
const sebagai = (email, q) => {
  const u = sql(`select id from auth.users where email = '${email}'`);
  return execSync(`psql -h 127.0.0.1 -p 54322 -U postgres -v ON_ERROR_STOP=1 -Atc "begin; set local role authenticated; set local request.jwt.claims = '{\\"sub\\":\\"${u}\\",\\"role\\":\\"authenticated\\"}'; ${q.replace(/"/g, '\\"')}; commit;"`,
    { env: { ...process.env, PGPASSWORD: 'postgres' }, stdio: 'pipe' }).toString().trim();
};

async function masuk(b, email) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
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

  log('1. Amin: Profil Saya & meter kelengkapan');
  let { ctx, p } = await masuk(b, 'amin@demo.hrboost.io');
  await p.waitForSelector(V('text=Lengkapkan profil anda'));
  expect(true, 'Utama: kad "Lengkapkan profil anda"');
  await p.click(V('a[aria-label="Profil Saya"]'));
  await p.waitForURL('**/profil');
  const awal = Number((await p.locator(V('text=/Profil \\d+% lengkap/')).innerText()).match(/\d+/)[0]);
  expect(awal < 100, `meter kelengkapan dipaparkan (${awal}%)`);

  log('2. Tukar gambar profil');
  await p.click(V('button[aria-label="Tukar gambar profil"]'));
  const png = Buffer.from(await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 900; c.height = 600;
    const g = c.getContext('2d'); g.fillStyle = '#0F6B5F'; g.fillRect(0, 0, 900, 600); g.fillStyle = '#fff'; g.beginPath(); g.arc(450, 300, 200, 0, 7); g.fill();
    return [...new Uint8Array(await (await new Promise((r) => c.toBlob(r, 'image/png'))).arrayBuffer())];
  }));
  await p.setInputFiles('input[aria-label="Pilih dari galeri"]', { name: 'saya.png', mimeType: 'image/png', buffer: png });
  await p.click(V('button:has-text("Guna gambar ini")'));
  await p.waitForSelector(V('button[aria-label="Tukar gambar profil"] img'));
  const lalu = sql(`select avatar_path from persons where id = (select person_id from employments where employee_no = 'DEMO004')`);
  expect(/^[0-9a-f-]+\/profil-\d+\.jpg$/.test(lalu), 'gambar disimpan dalam folder sendiri (JPEG 512px): ' + lalu);
  await p.waitForSelector(V('aside[aria-label="Menu sisi"] img'));
  expect(true, 'menu sisi memaparkan gambar profil');

  log('3. Ubah terus: alamat & e-mel');
  await p.click(V('section[aria-label="PERIBADI"] button:has-text("Ubah")'));
  const dlg = p.locator(V('[role=dialog]'));
  await dlg.locator('textarea').fill('No 3, Jalan Ampang, 50450 Kuala Lumpur');
  await dlg.locator('input[type=email]').fill('amin.peribadi@contoh.my');
  await dlg.locator('button:has-text("Simpan")').click();
  await p.waitForSelector(V('text=No 3, Jalan Ampang, 50450 Kuala Lumpur'));
  expect(true, 'alamat & e-mel disimpan terus');

  log('4. Perlu HR: tukar bank & status perkahwinan');
  await p.click(V('button:has-text("Mohon kemas kini")'));
  await dlg.locator('label:has-text("Status perkahwinan") select').selectOption('berkahwin');
  await dlg.locator('label:has-text("Bank") select').selectOption('CIMB Bank');
  await dlg.locator('label:has-text("No. akaun bank") input').fill('8001234567');
  await dlg.locator('button:has-text("Hantar")').click();
  await p.waitForSelector(V('text=Menunggu pengesahan HR'));
  expect(sql(`select bank_account_no is distinct from '8001234567' from persons where id = (select person_id from employments where employee_no = 'DEMO004')`) === 't', 'bank belum berubah sebelum HR lulus');
  expect(await p.locator(V('button:has-text("Mohon kemas kini")')).count() === 0, 'butang "Mohon kemas kini" disorok semasa menunggu');
  await ctx.close();

  log('5. Lily (HR): luluskan dalam Kelulusan');
  ({ ctx, p } = await masuk(b, 'lily@demo.hrboost.io'));
  await p.goto(BASE + '/kelulusan');
  await p.waitForSelector(V('main >> text=Kemas kini profil: bank'));
  expect(await p.locator(V('main img[alt="Amin"]')).count() >= 1, 'kelulusan memaparkan gambar profil pemohon');
  await p.waitForSelector(V('text=8001234567'));
  expect(await p.locator(V('text=Berkahwin')).count() >= 1 && await p.locator(V('text=Maybank')).count() >= 1, 'butiran: perbezaan lama → baharu (bank & status perkahwinan)');
  await p.click(V('button:text-is("Lulus")'));
  await p.waitForTimeout(2500);
  const lepas = sql(`select bank_name || '|' || bank_account_no || '|' || marital_status from persons where id = (select person_id from employments where employee_no = 'DEMO004')`);
  expect(lepas === 'CIMB Bank|8001234567|berkahwin', 'diluluskan → profil dikemas kini automatik: ' + lepas);
  await ctx.close();

  log('6. Kebenaran');
  let tolak = false;
  try { sebagai('amin@demo.hrboost.io', `select update_my_profile('{"children_count": 3}'::jsonb)`); } catch (e) { tolak = /disahkan oleh HR/.test(String(e.stderr)); }
  expect(tolak, 'bilangan anak tidak boleh diubah terus (perlu HR)');
  expect(sebagai('zuerin@demo.hrboost.io', `select count(*) from storage.objects where bucket_id = 'avatar' and name = '${lalu}'`).split('\n').includes('1'), 'rakan sekerja (Zuerin) boleh melihat gambar Amin');
  expect(sebagai('owner@demo.hrboost.io', `select count(*) from storage.objects where bucket_id = 'avatar' and name = '${lalu}'`).split('\n').includes('0'), 'orang luar syarikat tidak boleh melihat gambar Amin');

  await b.close();
  log('LULUS: Profil Saya');
})().catch((e) => { console.error(e); process.exit(1); });
