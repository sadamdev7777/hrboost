// Ujian hujung-ke-hujung: notifikasi telefon (Web Push).
//  1. Saya → Notifikasi telefon → hidupkan: kebenaran pelayar + langganan disimpan untuk pengguna ini.
//  2. push_next memulangkan notifikasi baharu untuk peranti itu (bahasa penerima), sekali sahaja.
//  3. Cadangan "Hidupkan notifikasi telefon?" di Papan Pemuka (komputer), "Nanti" menyorok.
//  4. Log keluar memadam langganan peranti ini.
// Pelayan push sebenar (FCM / Apple) tidak dapat dicapai dalam ujian: PushManager.subscribe digantikan dengan
// langganan tiruan (kunci P-256 sebenar dijana dalam pelayar). Penghantaran & penyulitan diuji oleh
// supabase/functions/_shared/webpush.uji.mts.
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000. Jalankan: node web/e2e/notifikasi-push.cjs
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
const svc = (q) => sql(`select set_config('request.jwt.claims', '{\\"role\\":\\"service_role\\"}', true); ${q}`).split('\n').pop();

// Langganan tiruan: kekal dalam localStorage supaya getSubscription() berfungsi selepas muat semula
const TIRUAN = () => {
  const K = 'ujian_push_sub';
  const b64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  // Chromium tanpa paparan sentiasa melaporkan 'denied': tiru kebenaran (default → granted selepas diminta)
  let izin = 'default';
  try { izin = localStorage.getItem('ujian_izin') || 'default'; } catch { /* about:blank */ }
  Object.defineProperty(Notification, 'permission', { get: () => izin, configurable: true });
  Notification.requestPermission = async () => { izin = 'granted'; localStorage.setItem('ujian_izin', izin); return izin; };
  const jadi = (j) => j &&{ endpoint: j.endpoint, toJSON: () => j, unsubscribe: async () => { localStorage.removeItem(K); return true; } };
  PushManager.prototype.getSubscription = async function () { return jadi(JSON.parse(localStorage.getItem(K) || 'null')); };
  PushManager.prototype.subscribe = async function (o) {
    if (!o || !o.applicationServerKey) throw new Error('tiada applicationServerKey');
    const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const j = { endpoint: 'https://push.ujian.example/' + crypto.randomUUID(), keys: { p256dh: b64(await crypto.subtle.exportKey('raw', kp.publicKey)), auth: b64(crypto.getRandomValues(new Uint8Array(16))) } };
    localStorage.setItem(K, JSON.stringify(j));
    return jadi(j);
  };
};

async function login(browser, phone, viewport) {
  const ctx = await browser.newContext({ viewport, permissions: ['notifications'] });
  await ctx.addInitScript(TIRUAN);
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
  // Kunci awam VAPID (dijana oleh notify-sender di pelayan sebenar)
  sql(`insert into platform_settings(key, value) values ('push', '{\\"vapid_public\\": \\"${'B'.repeat(87)}\\"}') on conflict (key) do update set value = excluded.value`);
  sql(`delete from push_subscriptions`);
  const AMIN_P = sql(`select person_id from employments where employee_no = 'DEMO004'`);
  const browser = await chromium.launch();

  log('1. Amin: Saya → Notifikasi telefon → hidupkan');
  let { ctx, p } = await login(browser, '100000004', { width: 390, height: 844 });
  await p.goto(BASE + '/saya');
  const suis = p.locator('button[role=switch][aria-label="Notifikasi telefon"]');
  await suis.waitFor({ timeout: 20000 });
  expect((await suis.getAttribute('aria-checked')) === 'false', 'suis mati pada mulanya');
  await suis.click();
  await p.waitForSelector('text=Notifikasi telefon dihidupkan untuk peranti ini.');
  await p.waitForSelector('button[role=switch][aria-label="Notifikasi telefon"][aria-checked=true]');
  expect(sql(`select count(*) from push_subscriptions where person_id = '${AMIN_P}' and endpoint like 'https://push.ujian.example/%' and length(p256dh) = 87`) === '1', 'langganan disimpan untuk Amin (kunci P-256)');
  await p.screenshot({ path: `${shots}/push-saya.png`, fullPage: true });
  await p.reload();
  await p.waitForSelector('button[role=switch][aria-label="Notifikasi telefon"][aria-checked=true]', { timeout: 20000 });
  expect(true, 'status kekal selepas muat semula');

  log('2. push_next: notifikasi baharu untuk peranti Amin');
  sql(`insert into notifications(company_id, person_id, message) select company_id, person_id, 'Permohonan cuti anda telah diluluskan.' from employments where employee_no = 'DEMO004'`);
  const r = svc(`select count(*) || '|' || max(language) || '|' || max(message) from push_next(50)`).split('|');
  expect(r[0] === '1' && r[1] === sql(`select coalesce(language, 'en') from persons where id = '${AMIN_P}'`) && /diluluskan|approved/.test(r[2]), `push_next memulangkan 1 notifikasi (${r[1]}): ${r[2]}`);
  expect(svc(`select count(*) from push_next(50)`) === '0', 'tidak dihantar semula');

  log('3. Matikan & hidupkan semula');
  await suis.click();
  await p.waitForSelector('button[role=switch][aria-label="Notifikasi telefon"][aria-checked=false]');
  expect(sql(`select count(*) from push_subscriptions where person_id = '${AMIN_P}'`) === '0', 'dimatikan: langganan dipadam');
  await p.locator('button[role=switch][aria-label="Notifikasi telefon"]').click();
  await p.waitForSelector('button[role=switch][aria-label="Notifikasi telefon"][aria-checked=true]');

  log('4. Log keluar memadam langganan peranti ini');
  await p.click('button:has-text("Log keluar")');
  await p.waitForURL(/\/masuk/);
  expect(sql(`select count(*) from push_subscriptions where person_id = '${AMIN_P}'`) === '0', 'log keluar: tiada lagi notifikasi Amin ke peranti ini');
  await ctx.close();

  log('5. Lily (HR, komputer): cadangan di Papan Pemuka');
  ({ ctx, p } = await login(browser, '100000002', { width: 1280, height: 900 }));
  await p.goto(BASE + '/pengurusan');
  const kad = p.locator('[role=region][aria-label="Notifikasi telefon"]');
  await kad.waitFor({ timeout: 20000 });
  expect((await kad.innerText()).includes('Hidupkan notifikasi telefon?'), 'cadangan dipaparkan');
  await kad.locator('button:has-text("Nanti")').click();
  await kad.waitFor({ state: 'detached' });
  await p.reload();
  await p.waitForTimeout(2500);
  expect((await kad.count()) === 0, '"Nanti" menyorok cadangan');
  await ctx.close();

  log('6. Telefon belum dipasang: tiada cadangan notifikasi (cadangan Pasang didahulukan)');
  ({ ctx, p } = await login(browser, '100000001', { width: 390, height: 844 }));
  await p.goto(BASE + '/utama');
  await p.waitForTimeout(3000);
  expect((await p.locator('[role=region][aria-label="Notifikasi telefon"]').count()) === 0, 'tiada cadangan notifikasi sebelum dipasang');
  await ctx.close();

  await browser.close();
  log('\nLULUS: notifikasi telefon');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
