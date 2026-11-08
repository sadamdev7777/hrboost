// Ujian hujung-ke-hujung Fasa B (bahagian 3):
//   A. HR menjemput pekerja baharu -> pekerja buka pautan, sahkan IC + OTP -> 8 langkah orientasi.
//   B. Amin mohon MC dengan gambar sijil -> ketua jabatan boleh membuka sijil.
// Prasyarat: `npx supabase db reset` (data demo), aplikasi di localhost:3000, Playwright + Chromium.
// Jalankan: node web/e2e/orientasi.cjs   (tangkapan skrin ke $E2E_SHOTS, lalai folder tmp)

const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');
const { createClient } = require(path.join(__dirname, '../node_modules/@supabase/supabase-js'));

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const shots = process.env.E2E_SHOTS || os.tmpdir();
const env = Object.fromEntries(
  fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => l.split(/=(.*)/s).slice(0, 2)),
);
const log = (...a) => console.log(...a);
const expect = (ok, msg) => { if (!ok) throw new Error('SEMAKAN GAGAL: ' + msg); log('   ✔ ' + msg); };

async function gambarUjian(browser, file, label, w = 800, h = 600) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  await p.setContent(`<body style="margin:0;background:#cfe;display:flex;align-items:center;justify-content:center;font:bold 60px sans-serif">${label}</body>`);
  await p.screenshot({ path: file, type: 'jpeg', quality: 80 });
  await p.close();
  return file;
}

async function loginUI(browser, phoneLocal) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  // Lencana Netlify di staging menutup butang bawah
  await p.addInitScript(() => { const st = document.createElement('style'); st.textContent = '#nl-badge-frame{display:none!important}'; document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st)); });
  await p.goto(BASE + '/masuk/telefon');
  await p.fill('input[type=tel]', phoneLocal);
  await p.click('button:has-text("Hantar kod")');
  await p.waitForURL('**/masuk/kod');
  await p.fill('input[autocomplete=one-time-code]', '123456');
  await p.waitForURL('**/utama', { timeout: 15000 });
  return { ctx, p };
}

(async () => {
  const browser = await chromium.launch();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hrb-e2e-'));
  const selfie = await gambarUjian(browser, path.join(tmp, 'swafoto.jpg'), 'SWAFOTO', 600, 800);
  const icDepan = await gambarUjian(browser, path.join(tmp, 'ic-depan.jpg'), 'IC HADAPAN');
  const icBelakang = await gambarUjian(browser, path.join(tmp, 'ic-belakang.jpg'), 'IC BELAKANG');
  const mc = await gambarUjian(browser, path.join(tmp, 'mc.jpg'), 'SIJIL MC');

  // ---------- A. HR jemput pekerja baharu ----------
  log('A. Jemputan & orientasi');
  const hr = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const v = await hr.auth.verifyOtp({ phone: '60100000002', token: '123456', type: 'sms' }); // Lily (HR)
  expect(!v.error, 'HR log masuk');
  const { data: eid, error: e1 } = await hr.rpc('add_employee', {
    p_company: '00000000-0000-0000-0000-0000000000c1', p_full_name: 'Nurin Syafiqah binti Demo', p_preferred: 'Nurin',
    p_phone: '60100000008', p_ic: '981128-14-5521', p_department: '00000000-0000-0000-0000-0000000000d1',
    p_position: 'Eksekutif Pelancongan', p_join: '2026-12-01', p_type: 'permanent', p_probation_months: 3, p_basic: 2500,
  });
  expect(!e1 && eid, 'HR tambah pekerja baharu (Nurin)');
  const { data: token, error: e2 } = await hr.rpc('create_invite', { p_employment: eid });
  expect(!e2 && token, 'HR jana pautan jemputan');

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => log('   [ralat halaman]', e.message));
  await p.goto(`${BASE}/jemputan/${token}`);
  await p.waitForSelector('text=Selamat datang ke DEMO, Nurin');
  await p.screenshot({ path: `${shots}/o1-daftar.png` });
  expect((await p.innerText('main, body')).includes('Percubaan 3 bulan'), 'paparan jemputan: jawatan, ketua, percubaan');
  await p.fill('input[inputmode=numeric]', '5521');
  await p.click('button:has-text("Aktifkan akaun")');
  await p.waitForURL('**/masuk/kod');
  await p.fill('input[autocomplete=one-time-code]', '123456');
  await p.waitForURL('**/akaun/kata-laluan**', { timeout: 20000 });
  await p.fill('input[type=email]', 'nurul@contoh.my');
  await p.locator('input[autocomplete=new-password]').nth(0).fill('Rahsia123');
  await p.locator('input[autocomplete=new-password]').nth(1).fill('Rahsia123');
  await p.click('button:has-text("Simpan & teruskan")');
  expect(true, 'langkah wajib: e-mel & kata laluan ditetapkan selepas OTP pertama');
  await p.waitForURL('**/orientasi', { timeout: 20000 });
  await p.waitForSelector('text=1 daripada 8 selesai');
  await p.screenshot({ path: `${shots}/o2-senarai.png` });
  expect(true, 'akaun diaktifkan (IC + OTP) -> senarai orientasi 1/8');

  await p.click('a:has-text("Teruskan")');
  await p.waitForURL('**/orientasi/nama');
  await p.fill('input[autocomplete=nickname]', 'Nurin');
  await p.screenshot({ path: `${shots}/o3-nama.png` });
  await p.click('button:has-text("Simpan & seterusnya")');

  await p.waitForURL('**/orientasi/swafoto');
  await p.setInputFiles('input[capture=user]', selfie);
  await p.waitForSelector('text=Gunakan gambar ini');
  await p.screenshot({ path: `${shots}/o4-swafoto.png` });
  await p.click('button:has-text("Gunakan gambar ini")');

  await p.waitForURL('**/orientasi/bank');
  await p.waitForSelector('text=AKAUN BANK GAJI');
  await p.selectOption('select >> nth=0', 'Maybank');
  await p.fill('input[placeholder^="Contoh: 1234"]', '1234 5678 9012');
  await p.fill('input[placeholder="Nama penuh waris"]', 'Ali bin Demo');
  await p.selectOption('select >> nth=1', 'Bapa');
  await p.fill('input[type=tel]', '0123456789');
  await p.screenshot({ path: `${shots}/o5-bank.png` });
  await p.click('button:has-text("Simpan & seterusnya")');

  await p.waitForURL('**/orientasi/kad-pengenalan');
  await p.setInputFiles('input[aria-label="Gambar hadapan kad pengenalan"]', icDepan);
  await p.setInputFiles('input[aria-label="Gambar belakang kad pengenalan"]', icBelakang);
  await p.waitForSelector('text=Hadapan ✓');
  await p.waitForSelector('text=••••••-••-5521');
  await p.screenshot({ path: `${shots}/o6-ic.png` });
  await p.click('button:has-text("Simpan & seterusnya")');

  await p.waitForURL('**/orientasi/peribadi');
  await p.waitForSelector('text=STATUS PERKAHWINAN');
  await p.fill('input[autocomplete=street-address]', 'No. 1, Jalan Demo, Kuala Lumpur');
  await p.click('button:has-text("Berkahwin")');
  await p.click('button[aria-label="Tambah anak"]');
  await p.fill('input[placeholder="Contoh: 12345678"]', '12345678');
  await p.screenshot({ path: `${shots}/o7-peribadi.png` });
  await p.click('button:has-text("Simpan & seterusnya")');

  await p.waitForURL('**/orientasi/buku-panduan');
  await p.waitForSelector('text=8 hari');
  expect(await p.isDisabled('button:has-text("Sila tandakan dahulu")'), 'buku panduan: butang dikunci sebelum tanda faham');
  await p.check('input[type=checkbox]');
  await p.screenshot({ path: `${shots}/o8-buku.png` });
  await p.click('button:has-text("Seterusnya")');

  await p.waitForURL('**/orientasi/pasang');
  await p.screenshot({ path: `${shots}/o9-pasang.png` });
  await p.click('button:has-text("Sudah dipasang — selesai")');
  await p.waitForURL('**/orientasi/selesai');
  await p.waitForSelector('text=Selamat datang ke pasukan, Nurin!');
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${shots}/o10-selesai.png` });
  expect(await p.locator('img[alt="Gambar profil Nurin"]').count() === 1, 'orientasi 8/8 selesai, swafoto dipaparkan (URL bertandatangan)');
  await p.click('a:has-text("Masuk ke HRBoost")');
  await p.waitForURL('**/utama');
  await p.waitForSelector('text=Baki cuti tahunan');
  expect((await p.locator('text=Lengkapkan akaun anda').count()) === 0, 'tab Utama tanpa peringatan orientasi');

  // Semak data tersimpan (sebagai HR)
  const { data: rec } = await hr.from('persons').select('full_name, preferred_name, bank_name, marital_status, children_count, photo_path').eq('phone_whatsapp', '60100000008').single();
  expect(rec && rec.full_name === 'NURIN SYAFIQAH BINTI DEMO' && rec.bank_name === 'Maybank' && rec.marital_status === 'berkahwin' && rec.children_count === 1 && rec.photo_path,
    'data orientasi tersimpan (nama, bank, status, anak, swafoto)');
  const { data: docs } = await hr.from('employee_documents').select('doc_type').eq('employment_id', eid);
  expect(docs.length === 2, 'dua gambar kad pengenalan direkod dalam dokumen pekerja');
  await ctx.close();

  // ---------- B. MC dengan sijil ----------
  log('B. MC dengan sijil');
  let { ctx: c2, p: amin } = await loginUI(browser, '10 000 0004');
  await amin.goto(BASE + '/mohon/cuti');
  await amin.waitForSelector('text=Akan diluluskan oleh');
  await amin.click('button:has-text("Sakit (MC)")');
  await amin.waitForSelector('text=Sijil sokongan');
  expect(await amin.isDisabled('button:has-text("Hantar Permohonan")'), 'MC tanpa sijil tidak boleh dihantar');
  // MC pada hari bekerja terakhir (dibenarkan tarikh lepas)
  const d = new Date(); do { d.setDate(d.getDate() - 1); } while ([0, 6].includes(d.getDay()));
  const iso = d.toISOString().slice(0, 10);
  const dates = amin.locator('input[type=date]');
  await dates.nth(0).fill(iso);
  await dates.nth(1).fill(iso);
  await amin.setInputFiles('input[capture=environment]', mc);
  await amin.waitForSelector('text=Dilampirkan: mc.jpg');
  await amin.screenshot({ path: `${shots}/o11-mc.png` });
  await amin.click('button:has-text("Hantar Permohonan")');
  await amin.waitForURL('**/permohonan', { timeout: 15000 });
  expect(true, 'MC dengan sijil dihantar');
  await c2.close();

  ({ ctx: c2, p: amin } = await loginUI(browser, '10 000 0003')); // Zuerin (ketua)
  await amin.goto(BASE + '/kelulusan');
  await amin.click('main a[href^="/kelulusan/"]');
  await amin.waitForSelector('text=Lihat sijil');
  const [pop] = await Promise.all([amin.waitForEvent('popup'), amin.click('button:has-text("Lihat sijil")')]);
  const res = await pop.waitForLoadState().then(() => pop.evaluate(() => document.contentType));
  expect(/image\/jpeg/.test(res), 'ketua jabatan boleh membuka sijil MC (URL bertandatangan)');
  await amin.screenshot({ path: `${shots}/o12-butiran-mc.png` });
  await c2.close();

  await browser.close();
  log('LULUS: jemputan, orientasi 8 langkah dan MC bersijil');
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
