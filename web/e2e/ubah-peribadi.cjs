// Ujian Profil Pekerja (TEMPATAN SAHAJA):
//  - semua tindakan dipaparkan terus (tiada menu "⋯ Lagi" tersembunyi)
//  - HR menekan "Ubah maklumat" → kemas kini alamat, anak, KWSP → disimpan, direkod (PDPA) & pekerja dimaklumkan
//  - nombor WhatsApp milik orang lain ditolak dengan mesej yang jelas
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000. Jalankan: node web/e2e/ubah-peribadi.cjs
const { execSync } = require('child_process');
const { chromium } = require('playwright');
require('./_bahasa.cjs');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };
const V = (s) => `${s} >> visible=true`;
const sql = (q) => execSync(`psql -h 127.0.0.1 -p 54322 -U postgres -Atc "${q}"`, { env: { ...process.env, PGPASSWORD: 'postgres' } }).toString().trim();
const AMIN = '00000000-0000-0000-0000-0000000000e4';

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => log('   [ralat halaman]', e.message));
  await p.goto(BASE + '/masuk');
  await p.fill('input[type=email]', 'lily@demo.hrboost.io');
  await p.fill('input[autocomplete=current-password]', 'Demo1234');
  await p.click('button[type=submit]');
  await p.waitForURL(/\/pengurusan$/);

  log('1. Tindakan dipaparkan terus');
  await p.goto(BASE + '/pengurusan/pekerja/' + AMIN);
  await p.waitForSelector(V('section[aria-label="Tindakan"]'));
  const t = await p.locator(V('section[aria-label="Tindakan"]')).innerText();
  for (const x of ['Ubah gaji & jawatan', 'Dokumen', 'Draf surat (AI)', 'Tarikh tamat kontrak', 'Tamatkan pekerjaan']) expect(t.includes(x), `tindakan kelihatan: ${x}`);
  expect((await p.locator('summary:has-text("Lagi")').count()) === 0, 'tiada menu "⋯ Lagi"');

  log('2. HR ubah maklumat peribadi');
  await p.click(V('button:has-text("Ubah maklumat")'));
  const dlg = p.locator(V('[role=dialog]'));
  await dlg.locator('textarea').fill('No 8, Jalan Melati, 43000 Kajang, Selangor');
  await dlg.locator('input[type=number]').fill('3');
  await dlg.locator('label:has-text("No. KWSP") input').fill('20889911');
  expect(/Simpan 3 perubahan/.test(await dlg.innerText()), 'butang menunjukkan bilangan perubahan (3)');
  await dlg.locator('button:has-text("Simpan")').click();
  await p.waitForSelector(V('text=No 8, Jalan Melati, 43000 Kajang, Selangor'));
  expect(true, 'alamat baharu dipaparkan dalam profil');
  const row = sql(`select p.children_count || '|' || e.epf_no from employments e join persons p on p.id = e.person_id where e.id = '${AMIN}'`);
  expect(row === '3|20889911', 'anak (PCB) & no. KWSP disimpan: ' + row);
  expect(Number(sql(`select count(*) from data_access_log where resource = 'profile_edit'`)) === 1, 'perubahan direkodkan dalam data_access_log');
  const msg = sql(`select count(*) from notifications n join employments e on e.person_id = n.person_id where e.id = '${AMIN}' and (n.message like '%address, number of children, EPF number%' or n.message like '%alamat, bilangan anak, no. KWSP%')`);
  expect(Number(msg) >= 1, 'pekerja dimaklumkan: medan yang diubah disenaraikan');

  log('3. Nombor WhatsApp milik orang lain ditolak');
  const lain = sql(`select phone_whatsapp from persons p join employments e on e.person_id = p.id where e.id <> '${AMIN}' and phone_whatsapp is not null limit 1`);
  await p.click(V('button:has-text("Ubah maklumat")'));
  await dlg.locator('input[inputmode=tel]').fill('0' + lain.slice(2));
  await dlg.locator('button:has-text("Simpan")').click();
  await p.waitForSelector(V('[role=dialog] >> text=sudah digunakan oleh orang lain'));
  expect(true, 'ralat jelas: nombor sudah digunakan');
  await p.keyboard.press('Escape');

  await b.close();
  log('LULUS: profil pekerja (tindakan & ubah maklumat peribadi)');
})().catch((e) => { console.error(e); process.exit(1); });
