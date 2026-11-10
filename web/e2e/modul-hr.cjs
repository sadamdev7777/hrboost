// Ujian hujung-ke-hujung menu HR baharu (TEMPATAN SAHAJA):
//  1. Menu sisi berkumpulan ikut modul; item ikut peranan (HR, Kewangan).
//  2. Halaman modul: Cuti (bercuti hari ini), Kehadiran (lewat), Tuntutan perbelanjaan, Orientasi, Carta organisasi.
//  3. Tab modul (Kalendar pasukan dalam Cuti, Kerja fleksibel dalam Kehadiran, Surat dalam Peti HR).
//  4. Telefon: tab "Lagi" menyenaraikan semua modul.
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000. Jalankan: node web/e2e/modul-hr.cjs
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { chromium } = require('playwright');
require('./_bahasa.cjs');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const shots = process.env.E2E_SHOTS || os.tmpdir();
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };
const V = (s) => `${s} >> visible=true`;
const DESKTOP = { width: 1440, height: 900 };
const TELEFON = { width: 390, height: 844 };
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
const teksMenu = (p) => p.locator('aside[aria-label="Menu sisi"]').innerText();

(async () => {
  // Data ujian tempatan: Amin bercuti hari ini (diluluskan), Zuerin masuk 9:15 (lewat), tuntutan Amin menunggu.
  const C = '00000000-0000-0000-0000-0000000000c1';
  sql(`insert into leave_requests(employment_id, leave_type_id, start_date, end_date, days, status)
       select '00000000-0000-0000-0000-0000000000e4', id, (now() at time zone 'Asia/Kuala_Lumpur')::date, (now() at time zone 'Asia/Kuala_Lumpur')::date, 1, 'approved' from leave_types where company_id='${C}' and code='AL'`);
  sql(`insert into attendance_records(employment_id, work_date, clock_in, late_minutes, source)
       values ('00000000-0000-0000-0000-0000000000e3', (now() at time zone 'Asia/Kuala_Lumpur')::date, ((now() at time zone 'Asia/Kuala_Lumpur')::date + time '09:15') at time zone 'Asia/Kuala_Lumpur', 15, 'manual')`);
  sql(`insert into claims(id, employment_id, title, total_amount, status) values ('00000000-0000-0000-0000-0000000c1a99','00000000-0000-0000-0000-0000000000e4','Tol ke Melaka',88.40,'pending')`);

  const b = await chromium.launch();
  log('1. Menu sisi (Lily, HR)');
  let { ctx, p } = await masuk(b, 'lily@demo.hrboost.io', DESKTOP);
  let m = await teksMenu(p);
  for (const t of ['Papan Pemuka', 'Kelulusan', 'Pengumuman', 'ORANG', 'Pekerja', 'Orientasi', 'MASA', 'Cuti', 'Kehadiran', 'WANG', 'Penggajian', 'Tuntutan perbelanjaan', 'LAIN-LAIN', 'Peti HR', 'Laporan', 'Tetapan'])
    expect(m.includes(t), `menu: ${t}`);
  expect(!/Kalendar pasukan|Kerja fleksibel|Soalan HR/.test(m), 'alat kecil tiada dalam menu (kini tab dalam modul)');
  await p.screenshot({ path: path.join(shots, 'modul-hr-menu.png') });

  log('2. Cuti');
  await p.click(V('aside a[href="/pengurusan/cuti"]'));
  await p.waitForURL(/\/pengurusan\/cuti$/);
  await p.waitForSelector(V('text=BERCUTI HARI INI'));
  const cuti = await p.locator('main:visible').innerText();
  expect(/BERCUTI HARI INI\s+Amin/.test(cuti), 'Amin dipapar dalam Bercuti hari ini');
  await p.click(V('nav[aria-label="Cuti"] >> text=Baki cuti'));
  await p.waitForSelector(V('table >> text=Amin'));
  expect(true, 'tab Baki cuti: jadual baki');
  await p.click(V('nav[aria-label="Cuti"] >> text=Kalendar pasukan'));
  await p.waitForURL(/\/kalendar$/);
  expect((await p.locator('aside a[aria-current=page]').innerText()).includes('Cuti'), 'Kalendar pasukan: menu Cuti kekal aktif');

  log('3. Kehadiran');
  await p.click(V('aside a[href="/pengurusan/kehadiran"]'));
  await p.waitForSelector(V('table >> text=Zuerin'));
  const hadir = await p.locator('table:visible').innerText();
  expect(/Zuerin\s+[^\n]*\s+9:15[\s\S]*?\d+ min[\s\S]*?Lewat/.test(hadir), 'Zuerin masuk 9:15, bertanda lewat');
  expect(/Amin[\s\S]*Cuti · AL/.test(hadir), 'Amin bertanda cuti');
  await p.click(V('nav[aria-label="Kehadiran"] >> text=Kerja fleksibel'));
  await p.waitForURL(/kerja-fleksibel$/);
  expect((await p.locator('aside a[aria-current=page]').innerText()).includes('Kehadiran'), 'Kerja fleksibel: menu Kehadiran kekal aktif');

  log('4. Tuntutan perbelanjaan');
  await p.click(V('aside a[href="/pengurusan/tuntutan"]'));
  await p.waitForSelector(V('text=Tol ke Melaka'));
  expect((await p.locator('main:visible').innerText()).includes('RM 88.40'), 'tuntutan Amin RM 88.40 dipapar');

  log('5. Orientasi & Carta organisasi');
  await p.click(V('aside a[href="/pengurusan/orientasi"]'));
  await p.waitForSelector(V('text=Pekerja baharu & percubaan'));
  expect(true, 'halaman Orientasi');
  await p.click(V('aside a[href="/pengurusan/pekerja"]'));
  await p.click(V('nav[aria-label="Pekerja"] >> text=Carta organisasi'));
  await p.waitForURL(/\/pengurusan\/carta$/);
  await p.waitForSelector(V('text=/\\d+ pekerja · \\d+ jabatan/'));
  const carta = await p.locator('main:visible').innerText();
  expect(carta.includes('Pelancongan') && carta.includes('Zuerin'), 'carta: jabatan Pelancongan dengan ketua Zuerin');

  log('6. Peti HR');
  await p.click(V('aside a[href="/pengurusan/soalan"]'));
  await p.click(V('nav[aria-label="Peti HR"] >> text=Permintaan surat'));
  await p.waitForURL(/\/pengurusan\/surat$/);
  expect((await p.locator('aside a[aria-current=page]').innerText()).includes('Peti HR'), 'Surat: menu Peti HR kekal aktif');

  log('7. Saya di bawah menu');
  await p.click(V('aside a[href="/saya"]'));
  await p.waitForURL(/\/saya$/);
  expect(true, 'pautan nama → Saya');
  await ctx.close();

  log('8. Kewangan (Farah): hanya modul berkaitan');
  ({ ctx, p } = await masuk(b, 'farah@demo.hrboost.io', DESKTOP));
  m = await teksMenu(p);
  expect(m.includes('Penggajian') && m.includes('Tuntutan perbelanjaan') && m.includes('Laporan'), 'Kewangan: Penggajian, Tuntutan, Laporan');
  const terlarang = await p.locator('aside a[href="/pengurusan/cuti"], aside a[href="/pengurusan/orientasi"], aside a[href="/pengurusan/soalan"], aside a[href="/pengurusan/pekerja"]').count();
  expect(terlarang === 0, 'Kewangan: tiada Cuti / Orientasi / Peti HR / Pekerja');
  await p.goto(BASE + '/pengurusan/tuntutan');
  await p.waitForSelector(V('text=Tol ke Melaka'));
  expect(true, 'Kewangan boleh melihat semua tuntutan');
  await ctx.close();

  log('9. Telefon: tab Lagi');
  ({ ctx, p } = await masuk(b, 'lily@demo.hrboost.io', TELEFON));
  await p.click(V('nav >> text=Lagi'));
  await p.waitForURL(/\/pengurusan\/menu$/);
  const lagi = await p.locator('main:visible').innerText();
  for (const t of ['Orientasi', 'Cuti', 'Kehadiran', 'Tuntutan perbelanjaan', 'Peti HR', 'Tetapan', 'Tukar ke Mod Pekerja']) expect(lagi.includes(t), `Lagi: ${t}`);
  await p.click(V('main >> text=Cuti'));
  await p.waitForURL(/\/pengurusan\/cuti$/);
  const aktif = await p.locator('nav.sticky a[aria-current=page]:visible').innerText();
  expect(aktif.includes('Lagi'), 'tab bawah "Lagi" aktif semasa di modul Cuti');
  await p.screenshot({ path: path.join(shots, 'modul-hr-telefon.png') });
  await ctx.close();
  await b.close();
  log('LULUS: menu HR baharu');
})().catch((e) => { console.error(e); process.exit(1); });
