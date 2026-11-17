// Ujian jemputan pekerja melalui e-mel / WhatsApp / salin pautan (dialog JemputPekerja).
//  - Orientasi → Hantar jemputan → e-mel: notifikasi saluran e-mel ke alamat pekerja dengan pautan jemputan
//  - WhatsApp tanpa sambungan Murpati: wa.me dibuka ke nombor pekerja dengan mesej siap diisi
//  - Profil pekerja → Hantar semula jemputan → Salin pautan
// Prasyarat: `npx supabase db reset` (data demo), aplikasi di localhost:3000. Jalankan: node web/e2e/jemputan-saluran.cjs
const { execSync } = require('child_process');
const { chromium } = require('playwright');
require('./_bahasa.cjs');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };
const sql = (q) => execSync(`psql -h 127.0.0.1 -p 54322 -U postgres -Atc "${q}"`, { env: { ...process.env, PGPASSWORD: 'postgres' } }).toString().trim();

(async () => {
  const CO = '00000000-0000-0000-0000-0000000000c1';
  const PID = sql(`insert into persons(full_name, preferred_name, email, phone_whatsapp) values ('NURIN SYAFIQAH BINTI DEMO', 'Nurin', 'nurin@contoh.my', '60123456789') returning id`).split('\n')[0];
  const EID = sql(`insert into employments(person_id, company_id, employee_no, status, join_date) values ('${PID}', '${CO}', 'DEMO099', 'probation', current_date) returning id`).split('\n')[0];

  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => log('   [ralat halaman]', e.message));
  await p.goto(BASE + '/masuk');
  await p.fill('input[type=email]', 'lily@demo.hrboost.io');
  await p.fill('input[autocomplete=current-password]', 'Demo1234');
  await p.click('button[type=submit]');
  await p.waitForURL(/\/(utama|pengurusan)$/, { timeout: 30000 });

  log('1. Orientasi → Hantar jemputan → e-mel');
  await p.goto(BASE + '/pengurusan/orientasi');
  await p.locator('tr:has-text("Nurin") >> button:has-text("Hantar jemputan")').click();
  await p.waitForSelector('[role=dialog] >> text=nurin@contoh.my');
  expect((await p.innerText('[role=dialog]')).includes('60123456789'), 'dialog memaparkan e-mel & nombor WhatsApp pekerja');
  await p.click('[role=dialog] button:has-text("Hantar melalui e-mel")');
  await p.waitForSelector('text=Jemputan dihantar ke nurin@contoh.my.');
  const n = sql(`select channel || '|' || to_address || '|' || (message like '%/jemputan/%')::text || '|' || bypass_limit::text from notifications where person_id = '${PID}' order by created_at desc limit 1`);
  expect(n === 'email|nurin@contoh.my|true|true', `notifikasi e-mel dengan pautan jemputan (${n})`);
  expect(sql(`select count(*) from employee_invites where employment_id = '${EID}'`) !== '0', 'token jemputan dicipta');

  log('2. WhatsApp tanpa sambungan Murpati → wa.me ke nombor pekerja');
  await p.reload();
  await p.locator('tr:has-text("Nurin") >> button:has-text("Hantar semula")').click();
  const [wa] = await Promise.all([ctx.waitForEvent('page', { timeout: 15000 }), p.click('[role=dialog] button:has-text("Hantar melalui WhatsApp")')]);
  await wa.waitForLoadState('commit').catch(() => {});
  const waUrl = decodeURIComponent(wa.url());
  // wa.me dialihkan oleh WhatsApp ke api.whatsapp.com/send/?phone=…
  expect(/(wa\.me\/|phone=)60123456789/.test(waUrl) && waUrl.includes('/jemputan/'), 'wa.me dibuka ke nombor pekerja dengan pautan jemputan');
  await wa.close();

  log('3. Profil pekerja → Hantar semula jemputan → Salin pautan');
  await p.goto(`${BASE}/pengurusan/pekerja/${EID}`);
  await p.click('button:has-text("Hantar semula jemputan")');
  await p.click('[role=dialog] button:has-text("Salin pautan")');
  await p.waitForSelector('text=Pautan jemputan disalin');
  const salin = await p.evaluate(() => navigator.clipboard.readText());
  expect(/\/jemputan\/[A-Za-z0-9_-]+$/.test(salin), 'pautan jemputan disalin ke papan klip');

  await b.close();
  log('LULUS: jemputan e-mel & WhatsApp');
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
