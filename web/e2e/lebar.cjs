// Ujian susun atur skrin lebar (monitor panjang) — TEMPATAN SAHAJA.
// Buka setiap skrin pada 2560px dan 1440px (English) dan laporkan:
//  - butang / label pendek yang terbalut ke baris kedua
//  - kawasan yang terpotong (scrollWidth > clientWidth; jadual yang boleh diskrol dikecualikan) dan skrol mendatar halaman
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000. Jalankan: node web/e2e/lebar.cjs [--ketat]
const os = require('os');
const { chromium } = require('playwright');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const shots = process.env.E2E_SHOTS || os.tmpdir();
const log = (...a) => console.log(...a);
const ROUTES_HR = ['/pengurusan', '/pengurusan/pekerja', '/pengurusan/pekerja/baru', '/pengurusan/gaji', '/pengurusan/gaji/pekerja', '/pengurusan/gaji/sejarah',
  '/pengurusan/gaji/pendahuluan', '/pengurusan/gaji/data-terkumpul', '/pengurusan/laporan', '/pengurusan/akses', '/pengurusan/jabatan', '/pengurusan/tetapan',
  '/pengurusan/tetapan/aliran', '/pengurusan/tetapan/cuti', '/pengurusan/tetapan/tuntutan', '/pengurusan/tetapan/syarikat', '/pengurusan/tetapan/automasi',
  '/pengurusan/tetapan/pengguna', '/pengurusan/tetapan/cuti-umum', '/pengurusan/tetapan/kehadiran', '/pengurusan/tetapan/akaun', '/pengurusan/tetapan/pengetahuan-ai',
  '/pengurusan/tetapan/kadar-berkanun', '/pengurusan/tetapan/wakil', '/pengurusan/surat', '/pengurusan/pengumuman', '/pengurusan/soalan', '/pengurusan/kerja-fleksibel',
  '/kalendar', '/kelulusan', '/saya', '/mula'];
const ROUTES_STAF = ['/utama', '/mohon', '/mohon/cuti', '/mohon/surat', '/mohon/pendahuluan', '/mohon/kerja-fleksibel', '/tuntutan', '/tuntutan/baru', '/kehadiran',
  '/kehadiran/betulkan', '/gaji', '/cuti', '/profil', '/profil/ubah', '/hari-jadi', '/pembantu-ai', '/tanya-hr', '/pengumuman', '/permohonan', '/kelulusan', '/saya'];
const ROUTES_SA = ['/admin', '/admin/syarikat', '/admin/akses', '/admin/pengguna', '/admin/log', '/admin/tetapan'];
const ROUTES_AWAM = ['/', '/privasi', '/daftar', '/masuk'];

async function semak(p) {
  return p.evaluate(() => {
    const isu = [];
    const nampak = (e) => {
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const nama = (e) => (e.innerText || e.getAttribute('aria-label') || e.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    for (const e of document.querySelectorAll('button, a, summary, th, kbd, [role=tab], [role=radio], select, label, .tag, span.rounded-full')) {
      if (!nampak(e)) continue;
      const t = (e.innerText || '').trim();
      if (!t || t.includes('\n') || t.length > 26) continue;
      // satu nod teks yang pecah kepada lebih daripada satu baris = terbalut
      const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (!n.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        const tops = [...range.getClientRects()].filter((r) => r.width > 1).map((r) => Math.round(r.top));
        const s = getComputedStyle(n.parentElement);
        const lh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.4;
        if (tops.length > 1 && Math.max(...tops) - Math.min(...tops) > lh * 0.6) {
          isu.push(`terbalut: ${e.tagName.toLowerCase()} "${nama(e)}"`);
          break;
        }
      }
    }
    for (const ph of document.querySelectorAll('input[placeholder]')) {
      if (!nampak(ph) || ph.value) continue;
      const c = document.createElement('canvas').getContext('2d');
      const s = getComputedStyle(ph);
      c.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
      const ruang = ph.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
      if (c.measureText(ph.placeholder).width > ruang + 2) isu.push(`placeholder terpotong: "${ph.placeholder.slice(0, 40)}"`);
    }
    for (const e of document.querySelectorAll('main *, aside *')) {
      const s = getComputedStyle(e);
      if (!['auto', 'scroll', 'hidden'].includes(s.overflowX) || !nampak(e)) continue;
      if (e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 40 && !e.matches('input, textarea, select') && s.textOverflow !== 'ellipsis' && !/truncate|line-clamp/.test(e.className) && !e.querySelector('table'))
        isu.push(`terpotong (${e.scrollWidth}>${e.clientWidth}): ${e.tagName.toLowerCase()}.${String(e.className).split(' ').slice(0, 3).join('.')} "${nama(e).slice(0, 30)}"`);
    }
    if (document.documentElement.scrollWidth > innerWidth + 1) isu.push(`skrol mendatar halaman: ${document.documentElement.scrollWidth}>${innerWidth}`);
    return [...new Set(isu)];
  });
}

async function masuk(b, email, w, h) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  if (!email) return { ctx, p };
  await p.goto(BASE + '/masuk');
  await p.fill('input[type=email]', email);
  await p.fill('input[autocomplete=current-password]', 'Demo1234');
  await p.click('button[type=submit]');
  await p.waitForURL(/\/(utama|pengurusan|admin|mula)/, { timeout: 30000 });
  return { ctx, p };
}

async function imbas(b, email, routes, label, w, h, mod) {
  const { ctx, p } = await masuk(b, email, w, h);
  if (mod) await p.evaluate((m) => localStorage.setItem('hrb_mod', m), mod).catch(() => {});
  let n = 0;
  for (const r of routes) {
    await p.goto(BASE + r);
    await p.waitForLoadState('networkidle').catch(() => {});
    await p.waitForTimeout(700);
    const isu = await semak(p);
    if (isu.length) {
      n++;
      log(`   [${label} ${w}] ${r}`);
      for (const x of isu.slice(0, 10)) log('       ' + x);
    }
    if (w >= 2000 && ['/pengurusan', '/pengurusan/pekerja', '/utama', '/pengurusan/gaji/pekerja', '/admin'].includes(r))
      await p.screenshot({ path: `${shots}/lebar-${w}${r.replace(/\//g, '_') || '_'}.png` });
  }
  await ctx.close();
  return n;
}

(async () => {
  const b = await chromium.launch();
  let jumlah = 0;
  for (const [w, h] of [[2560, 1080], [1440, 900]]) {
    log(`== ${w}×${h}`);
    jumlah += await imbas(b, null, ROUTES_AWAM, 'awam', w, h);
    jumlah += await imbas(b, 'lily@demo.hrboost.io', ROUTES_HR, 'HR', w, h);
    jumlah += await imbas(b, 'amin@demo.hrboost.io', ROUTES_STAF, 'pekerja', w, h);
    jumlah += await imbas(b, 'sadam@demo.hrboost.io', ROUTES_SA, 'SA', w, h);
  }
  await b.close();
  log(`${jumlah} skrin dengan isu susun atur`);
  if (process.argv.includes('--ketat') && jumlah) process.exit(1);
  log('SIAP: imbasan skrin lebar');
})().catch((e) => { console.error(e); process.exit(1); });
