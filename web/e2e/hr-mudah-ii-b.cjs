// Ujian hujung-ke-hujung "HR lebih mudah II" bahagian 2 (TEMPATAN SAHAJA):
//  Tanya HR → HR jawab; pendahuluan gaji (ketua → Kewangan → dibayar); kerja fleksibel (tolak bersebab);
//  penilaian percubaan oleh ketua → keputusan HR.
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000. Jalankan: node web/e2e/hr-mudah-ii-b.cjs
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { chromium } = require('playwright');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const shots = process.env.E2E_SHOTS || os.tmpdir();
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };
const V = (s) => `${s} >> visible=true`;
const DESKTOP = { width: 1440, height: 900 };
const TELEFON = { width: 390, height: 844 };
// Data ujian tempatan sahaja: Zulfa (jabatan Zuerin) dalam tempoh percubaan yang tamat 10 hari lagi
const sql = (q) => execSync(`psql -h 127.0.0.1 -p 54322 -U postgres -Atc "${q}"`, { env: { ...process.env, PGPASSWORD: 'postgres' } }).toString().trim();

async function masuk(b, email, vp) {
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
async function lulusSemua(b, email) {
  const { ctx, p } = await masuk(b, email, DESKTOP);
  await p.goto(BASE + '/kelulusan');
  await p.waitForSelector(V('text=Pendahuluan gaji RM500.00'));
  await p.click(V('text=Pendahuluan gaji RM500.00'));
  await p.click(V('button:text-is("Lulus")'));
  await p.waitForSelector(V('text=Tiada permohonan menunggu kelulusan anda'), { timeout: 20000 });
  await ctx.close();
}

(async () => {
  sql("update employments set status='probation', probation_end_date=current_date+10 where employee_no='DEMO006'");
  const b = await chromium.launch();

  log('1. Amin — Tanya HR, pendahuluan gaji, kerja fleksibel');
  let { ctx, p } = await masuk(b, 'amin@demo.hrboost.io', TELEFON);
  await p.goto(BASE + '/tanya-hr');
  await p.fill('textarea[aria-label=Soalan]', 'Bolehkah saya membawa baki cuti tahunan ke tahun hadapan?');
  await p.click(V('button:has-text("Tanya")'));
  // Pembantu AI tidak dikonfigurasi secara tempatan → soalan terus kepada HR; jika ada AI, hantar kepada HR
  const ai = await p.waitForSelector(V('text=JAWAPAN PEMBANTU AI'), { timeout: 8000 }).then(() => true).catch(() => false);
  if (ai) await p.click(V('button:has-text("Hantar kepada HR")'));
  await p.waitForSelector(V('text=Menunggu HR'), { timeout: 15000 });
  expect(true, 'soalan dihantar kepada HR');
  await p.goto(BASE + '/mohon/pendahuluan');
  await p.waitForSelector(V('text=Had pendahuluan'));
  await p.fill('input[aria-label=Jumlah]', '500');
  await p.fill('input[placeholder="Contoh: Kecemasan keluarga"]', 'Kecemasan keluarga');
  await p.click(V('button:has-text("Hantar permohonan")'));
  await p.waitForURL(/\/permohonan\//, { timeout: 15000 });
  expect(true, 'pendahuluan gaji RM500 dimohon');
  await p.goto(BASE + '/mohon/kerja-fleksibel');
  await p.click(V('button:has-text("Tempat bekerja")'));
  await p.fill('textarea', 'Bekerja dari rumah setiap Jumaat untuk menjaga anak.');
  await p.click(V('button:has-text("Hantar permohonan")'));
  await p.waitForSelector(V('text=Menunggu keputusan'));
  expect(true, 'permohonan kerja fleksibel dihantar');
  await ctx.close();

  log('2. Kelulusan pendahuluan: Zuerin (ketua) → Farah (Kewangan)');
  await lulusSemua(b, 'zuerin@demo.hrboost.io');
  await lulusSemua(b, 'farah@demo.hrboost.io');
  expect(true, 'pendahuluan diluluskan dua peringkat');

  log('3. Zuerin menilai Zulfa (percubaan)');
  ({ ctx, p } = await masuk(b, 'zuerin@demo.hrboost.io', TELEFON));
  await p.waitForSelector(V('text=PENILAIAN TEMPOH PERCUBAAN'));
  await p.click(V('section[aria-label="Penilaian percubaan"] a:has-text("Nilai")'));
  await p.waitForURL(/\/penilaian\//);
  for (const a of ['Kualiti kerja', 'Kehadiran & ketepatan masa', 'Sikap & disiplin', 'Kerjasama berpasukan']) await p.click(`[role=radio][aria-label^="${a}: 4"]`);
  await p.click(V('button:has-text("Sahkan jawatan")'));
  await p.click(V('button:has-text("Hantar penilaian")'));
  await p.waitForURL('**/utama');
  expect(true, 'penilaian dihantar kepada HR');
  await ctx.close();

  log('4. Lily — Papan Pemuka, jawab soalan, putuskan kerja fleksibel, pendahuluan, sahkan Zulfa');
  ({ ctx, p } = await masuk(b, 'lily@demo.hrboost.io', DESKTOP));
  await p.waitForSelector(V('text=1 soalan pekerja belum dijawab'));
  await p.waitForSelector(V('text=Amin memohon kerja fleksibel'));
  expect(true, 'Papan Pemuka: soalan & kerja fleksibel dalam Perlu tindakan');
  await p.goto(BASE + '/pengurusan/soalan');
  await p.fill('textarea[aria-label="Jawapan kepada Amin"]', 'Boleh, maksimum 5 hari dibawa ke tahun hadapan.');
  await p.click(V('button:has-text("Hantar jawapan")'));
  await p.waitForSelector(V('text=Tiada soalan yang belum dijawab'));
  expect(true, 'soalan dijawab');
  await p.goto(BASE + '/pengurusan/kerja-fleksibel');
  await p.click(V('button:has-text("Tidak lulus")'));
  await p.fill('[role=alertdialog] textarea', 'Peranan memerlukan kehadiran di pejabat pada hari Jumaat.');
  await p.click('[role=alertdialog] button:has-text("Tidak lulus")');
  await p.waitForSelector(V('text=Tidak diluluskan'));
  expect(true, 'kerja fleksibel tidak diluluskan dengan sebab bertulis');
  await p.goto(BASE + '/pengurusan/gaji/pendahuluan');
  await p.click(V('button:has-text("Tandakan dibayar")'));
  await p.click('[role=alertdialog] button:has-text("Tandakan dibayar")');
  await p.waitForSelector(V('text=Dibayar'));
  expect(true, 'pendahuluan ditandakan dibayar');
  await p.goto(BASE + '/pengurusan/pekerja');
  await p.click(V('a:has-text("Zulfa")'));
  await p.waitForSelector(V('section[aria-label="Tempoh percubaan"] >> text=Zuerin'));
  await p.screenshot({ path: path.join(shots, 'hrmudahii-percubaan.png') });
  await p.click(V('section[aria-label="Tempoh percubaan"] button:has-text("Sahkan jawatan")'));
  await p.click('[role=alertdialog] button:has-text("Sahkan jawatan")');
  await p.waitForSelector('section[aria-label="Tempoh percubaan"]', { state: 'detached', timeout: 15000 });
  expect(sql("select status from employments where employee_no='DEMO006'") === 'active', 'Zulfa disahkan jawatan');
  await ctx.close();

  log('5. Amin melihat jawapan HR');
  ({ ctx, p } = await masuk(b, 'amin@demo.hrboost.io', TELEFON));
  await p.goto(BASE + '/tanya-hr');
  await p.waitForSelector(V('text=Boleh, maksimum 5 hari'));
  expect(true, 'jawapan HR dipaparkan kepada pekerja');
  await ctx.close();
  await b.close();
  log('LULUS: HR mudah II (2)');
})().catch((e) => { console.error(e); process.exit(1); });
