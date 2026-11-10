// Ujian bahasa English (lalai) — TEMPATAN SAHAJA. Tidak memuatkan _bahasa.cjs.
//  1. Laman log masuk dalam English; suis EN/BM bertukar dan diingati.
//  2. Imbas skrin utama sebagai HR (Lily) dan pekerja (Amin): laporkan perkataan Bahasa Melayu yang tertinggal.
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000. Jalankan: node web/e2e/bahasa-en.cjs [--ketat]
const { chromium } = require('playwright');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };
const V = (s) => `${s} >> visible=true`;
// Perkataan BM lazim yang tidak sepatutnya muncul dalam antara muka English
const BM = ['tiada', 'sila', 'untuk', 'dengan', 'belum', 'pekerja', 'cuti', 'gaji', 'tuntutan', 'kelulusan', 'tetapan', 'simpan', 'batal', 'mohon',
  'hari ini', 'jabatan', 'syarikat', 'permohonan', 'diluluskan', 'menunggu', 'semak', 'tambah', 'lihat', 'kembali', 'baharu', 'jumlah', 'bulan', 'tahun',
  'laporan', 'pengumuman', 'kehadiran', 'peranan', 'ketua', 'pelulus', 'aliran', 'tarikh', 'masa', 'tidak', 'anda', 'kami', 'akan', 'boleh', 'telah'];
const ROUTES_HR = ['/pengurusan', '/pengurusan/pekerja', '/pengurusan/gaji', '/pengurusan/gaji/pekerja', '/pengurusan/gaji/sejarah', '/pengurusan/gaji/pendahuluan',
  '/pengurusan/laporan', '/pengurusan/tetapan', '/pengurusan/tetapan/aliran', '/pengurusan/tetapan/cuti', '/pengurusan/tetapan/tuntutan', '/pengurusan/tetapan/syarikat',
  '/pengurusan/tetapan/automasi', '/pengurusan/tetapan/pengguna', '/pengurusan/tetapan/jabatan', '/pengurusan/surat', '/pengurusan/pengumuman', '/pengurusan/soalan',
  '/pengurusan/kerja-fleksibel', '/kalendar', '/kelulusan', '/saya', '/pengurusan/pekerja/00000000-0000-0000-0000-0000000000e4', '/pengurusan/cuti', '/pengurusan/cuti/baki',
  '/pengurusan/kehadiran', '/pengurusan/kehadiran/pembetulan', '/pengurusan/tuntutan', '/pengurusan/orientasi', '/pengurusan/carta', '/pengurusan/menu', '/pengurusan/gaji/ea', '/pengurusan/pekerja/nama'];
const ROUTES_STAF = ['/utama', '/mohon', '/mohon/cuti', '/mohon/surat', '/mohon/pendahuluan', '/mohon/kerja-fleksibel', '/tuntutan', '/tuntutan/baru', '/kehadiran',
  '/kehadiran/betulkan', '/gaji', '/cuti', '/profil', '/hari-jadi', '/pembantu-ai', '/tanya-hr', '/pengumuman', '/permohonan', '/saya'];

async function masuk(b, email) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => log('   [ralat halaman]', e.message));
  await p.goto(BASE + '/masuk');
  await p.fill('input[type=email]', email);
  await p.fill('input[autocomplete=current-password]', 'Demo1234');
  await p.click('button[type=submit]');
  await p.waitForURL(/\/(utama|pengurusan)$/, { timeout: 30000 });
  return { ctx, p };
}

async function imbas(p, routes, label) {
  const temuan = [];
  for (const r of routes) {
    await p.goto(BASE + r);
    await p.waitForLoadState('networkidle').catch(() => {});
    await p.waitForTimeout(600);
    const teks = await p.locator('body').innerText();
    const baris = teks.split('\n').map((x) => x.trim()).filter(Boolean);
    const salah = baris.filter((x) => BM.some((w) => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`, 'i').test(x)) && !/binti|bin |SDN BHD|BERHAD|Demo|^Variables:/i.test(x));
    if (salah.length) temuan.push({ r, salah: [...new Set(salah)].slice(0, 8) });
  }
  log(`   ${label}: ${routes.length} skrin diimbas, ${temuan.length} dengan teks BM`);
  for (const t of temuan) log(`     ${t.r}: ${t.salah.map((s) => JSON.stringify(s.slice(0, 70))).join(' | ')}`);
  return temuan;
}

(async () => {
  const b = await chromium.launch();
  log('1. Log masuk & suis bahasa');
  let ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  let p = await ctx.newPage();
  await p.goto(BASE + '/masuk');
  await p.waitForSelector(V('button[type=submit]:has-text("Log in")'));
  expect(true, 'lalai English: butang "Log in"');
  await p.click(V('[role=radio][aria-label="Bahasa Melayu"]'));
  await p.waitForSelector(V('button[type=submit]:has-text("Log masuk")'));
  expect(true, 'suis BM: butang "Log masuk"');
  await p.reload();
  await p.waitForSelector(V('button[type=submit]:has-text("Log masuk")'));
  expect(true, 'pilihan BM diingati selepas muat semula');
  await p.click(V('[role=radio][aria-label="English"]'));
  await p.waitForSelector(V('button[type=submit]:has-text("Log in")'));
  expect(true, 'kembali ke English');
  await ctx.close();

  log('2. Imbas teks BM yang tertinggal (English)');
  ({ ctx, p } = await masuk(b, 'lily@demo.hrboost.io'));
  const a = await imbas(p, ROUTES_HR, 'HR');
  await ctx.close();
  ({ ctx, p } = await masuk(b, 'amin@demo.hrboost.io'));
  const s = await imbas(p, ROUTES_STAF, 'Pekerja');
  await ctx.close();
  await b.close();
  if (process.argv.includes('--ketat')) expect(!a.length && !s.length, 'tiada teks BM tertinggal');
  log('LULUS: bahasa English');
})().catch((e) => { console.error(e); process.exit(1); });
