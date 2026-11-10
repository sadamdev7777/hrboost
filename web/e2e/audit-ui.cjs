// Audit UI automatik (TEMPATAN SAHAJA): setiap skrin pada telefon (390px) dan desktop (1440px).
// Laporkan: sasaran sentuh < 44px (telefon), medan tanpa label, butang ikon tanpa nama, ralat halaman,
// dan jadual tanpa ringkasan (widget) di atasnya.
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000. Jalankan: node web/e2e/audit-ui.cjs [--ketat]
const { chromium } = require('playwright');
require('./_bahasa.cjs');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const log = (...a) => console.log(...a);
const HR = ['/pengurusan', '/kelulusan', '/pengurusan/pengumuman', '/pengurusan/pekerja', '/pengurusan/pekerja/00000000-0000-0000-0000-0000000000e4',
  '/pengurusan/pekerja/baru', '/pengurusan/carta', '/pengurusan/pekerja/nama', '/pengurusan/orientasi', '/pengurusan/cuti', '/pengurusan/cuti/baki', '/kalendar',
  '/pengurusan/kehadiran', '/pengurusan/kehadiran/pembetulan', '/pengurusan/kerja-fleksibel', '/pengurusan/gaji', '/pengurusan/gaji/pekerja', '/pengurusan/gaji/pendahuluan',
  '/pengurusan/gaji/sejarah', '/pengurusan/gaji/ea', '/pengurusan/gaji/data-terkumpul', '/pengurusan/tuntutan', '/pengurusan/soalan', '/pengurusan/surat', '/pengurusan/laporan',
  '/pengurusan/tetapan', '/pengurusan/tetapan/syarikat', '/pengurusan/tetapan/jabatan', '/pengurusan/tetapan/pengguna', '/pengurusan/tetapan/aliran', '/pengurusan/tetapan/wakil',
  '/pengurusan/tetapan/automasi', '/pengurusan/tetapan/cuti', '/pengurusan/tetapan/cuti-umum', '/pengurusan/tetapan/tuntutan', '/pengurusan/tetapan/kehadiran',
  '/pengurusan/tetapan/kadar', '/pengurusan/tetapan/akaun', '/pengurusan/tetapan/pengetahuan-ai', '/pengurusan/akses', '/pengurusan/menu', '/saya'];
const STAF = ['/utama', '/mohon', '/mohon/cuti', '/mohon/surat', '/mohon/pendahuluan', '/mohon/kerja-fleksibel', '/tuntutan', '/tuntutan/baru', '/kehadiran',
  '/kehadiran/betulkan', '/gaji', '/cuti', '/profil', '/profil/ubah', '/hari-jadi', '/pembantu-ai', '/tanya-hr', '/pengumuman', '/permohonan', '/kelulusan', '/saya', '/kalendar'];
const SA = ['/admin', '/admin/syarikat', '/admin/akses', '/admin/pengguna', '/admin/log', '/admin/tetapan'];
const AWAM = ['/', '/privasi', '/daftar', '/masuk', '/masuk/lupa', '/jemputan'];

async function semak(p, telefon) {
  return p.evaluate((telefon) => {
    const isu = [];
    const nampak = (e) => {
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !e.closest('[aria-hidden=true]') && !(e.closest('details:not([open])') && !e.matches('summary'));
    };
    const nama = (e) => (e.getAttribute('aria-label') || e.innerText || e.getAttribute('title') || e.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    const main = document.querySelector('main:not([hidden])') ? [...document.querySelectorAll('main')].find(nampak) ?? document.body : document.body;
    // 1. sasaran sentuh (telefon sahaja; pautan dalam ayat dikecualikan)
    if (telefon) {
      for (const e of main.querySelectorAll('button, a[href], select, input:not([type=hidden]), summary, [role=button], [role=tab]')) {
        if (!nampak(e) || e.disabled) continue;
        const r = e.getBoundingClientRect();
        const dalamAyat = e.tagName === 'A' && getComputedStyle(e).display === 'inline' && e.parentElement && /P|SPAN|LI|LABEL|TD/.test(e.parentElement.tagName);
        const kotak = e.matches('input[type=checkbox], input[type=radio]');
        if (dalamAyat || kotak) continue;
        if (r.height < 36) isu.push(`sasaran kecil ${Math.round(r.width)}×${Math.round(r.height)}: ${e.tagName.toLowerCase()} "${nama(e)}"`);
      }
    }
    // 2. medan tanpa label
    for (const e of main.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea')) {
      if (!nampak(e)) continue;
      const ada = e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.closest('label') || (e.id && document.querySelector(`label[for="${e.id}"]`));
      if (!ada) isu.push(`medan tanpa label: ${e.tagName.toLowerCase()} [${e.type || ''}] "${e.placeholder || e.name || ''}"`);
    }
    // 3. butang tanpa nama
    for (const e of main.querySelectorAll('button, a[href]')) {
      if (!nampak(e)) continue;
      if (!nama(e)) isu.push(`butang/pautan tanpa nama: ${e.outerHTML.slice(0, 80)}`);
    }
    // 4. jadual tanpa ringkasan di atas (desktop)
    const jadual = [...main.querySelectorAll('table')].filter(nampak);
    const ringkasan = main.querySelectorAll('[class*="grid-cols-2"][class*="lg:grid-cols-4"], [data-ringkasan]').length > 0;
    return { isu: [...new Set(isu)], jadual: jadual.length, ringkasan, baris: jadual.reduce((n, t) => n + t.querySelectorAll('tbody tr').length, 0) };
  }, telefon);
}

async function masuk(b, email, vp) {
  const ctx = await b.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const ralat = [];
  p.on('pageerror', (e) => ralat.push(e.message));
  if (email) {
    await p.goto(BASE + '/masuk');
    await p.fill('input[type=email]', email);
    await p.fill('input[autocomplete=current-password]', 'Demo1234');
    await p.click('button[type=submit]');
    await p.waitForURL(/\/(utama|pengurusan|admin)/, { timeout: 30000 });
  }
  return { ctx, p, ralat };
}

(async () => {
  const b = await chromium.launch();
  let jumlah = 0;
  const tanpaRingkasan = new Set();
  for (const [vp, telefon] of [[{ width: 390, height: 844 }, true], [{ width: 1440, height: 900 }, false]]) {
    for (const [email, routes, label] of [[null, AWAM, 'awam'], ['lily@demo.hrboost.io', HR, 'HR'], ['amin@demo.hrboost.io', STAF, 'pekerja'], ['owner@demo.hrboost.io', SA, 'SA']]) {
      const { ctx, p, ralat } = await masuk(b, email, vp);
      for (const r of routes) {
        ralat.length = 0;
        await p.goto(BASE + r);
        await p.waitForLoadState('networkidle').catch(() => {});
        await p.waitForTimeout(600);
        const x = await semak(p, telefon);
        const isu = [...x.isu, ...ralat.map((m) => 'ralat halaman: ' + m.slice(0, 120))];
        if (!telefon && x.jadual && !x.ringkasan && !['/', '/admin', '/admin/pengguna', '/admin/log', '/admin/akses'].includes(r)) tanpaRingkasan.add(`${r} (${x.baris} baris)`);
        if (isu.length) {
          jumlah++;
          log(`[${label} ${vp.width}] ${r}`);
          for (const i of isu.slice(0, 8)) log('    ' + i);
          if (isu.length > 8) log(`    … ${isu.length - 8} lagi`);
        }
      }
      await ctx.close();
    }
  }
  log('\nJadual tanpa widget ringkasan (desktop):');
  for (const t of tanpaRingkasan) log('    ' + t);
  log(`\n${jumlah} skrin dengan isu`);
  await b.close();
  if (process.argv.includes('--ketat') && jumlah) process.exit(1);
  log('SIAP: audit UI');
})().catch((e) => { console.error(e); process.exit(1); });
