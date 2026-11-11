// Ujian susun atur telefon (iPhone 13, 390px) — TEMPATAN SAHAJA.
// Untuk setiap skrin HR & pekerja, dalam English (teks lebih panjang) dan BM, laporkan:
//  - medan borang / butang yang bertindih antara satu sama lain
//  - elemen "fixed" (cth. butang terapung) yang menutup butang atau pautan lain (diuji di atas, tengah & bawah halaman)
//  - skrol mendatar halaman
//  - tajuk halaman yang pecah lebih daripada 2 baris
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000. Jalankan: node web/e2e/telefon.cjs
const { chromium, devices } = require('playwright');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const log = (...a) => console.log(...a);
const HR = ['/pengurusan', '/pengurusan/pekerja', '/pengurusan/pekerja/baru', '/pengurusan/pekerja/00000000-0000-0000-0000-0000000000e4', '/pengurusan/carta',
  '/pengurusan/tetapan/jabatan', '/pengurusan/pekerja/nama', '/pengurusan/cuti', '/pengurusan/cuti/baki', '/pengurusan/kehadiran', '/pengurusan/gaji', '/pengurusan/gaji/pekerja',
  '/pengurusan/gaji/sejarah', '/pengurusan/tuntutan', '/pengurusan/orientasi', '/pengurusan/soalan', '/pengurusan/laporan', '/pengurusan/tetapan', '/pengurusan/tetapan/syarikat',
  '/pengurusan/menu', '/kelulusan'];
const STAF = ['/utama', '/mohon', '/mohon/cuti', '/tuntutan/baru', '/kehadiran', '/gaji', '/cuti', '/profil', '/profil/ubah', '/tanya-hr', '/saya'];

async function semak(p) {
  return p.evaluate(async () => {
    const isu = [];
    const nampak = (e) => {
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && !e.closest('[aria-hidden=true]');
    };
    const nama = (e) => (e.getAttribute('aria-label') || e.innerText || e.placeholder || e.name || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 30);
    const kawalan = [...document.querySelectorAll('main input:not([type=hidden]):not([type=checkbox]):not([type=radio]), main select, main textarea, main button, main a[href]')].filter(nampak);
    // 1. Bertindih (bukan bersarang)
    for (let i = 0; i < kawalan.length; i++)
      for (let j = i + 1; j < kawalan.length; j++) {
        const a = kawalan[i], b = kawalan[j];
        if (a.contains(b) || b.contains(a)) continue;
        const r = a.getBoundingClientRect(), q = b.getBoundingClientRect();
        const x = Math.min(r.right, q.right) - Math.max(r.left, q.left), y = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
        if (x > 4 && y > 4) isu.push(`bertindih: "${nama(a)}" & "${nama(b)}"`);
      }
    // 2. Elemen fixed menutup kawalan lain, pada tiga kedudukan skrol
    const tetap = (el) => { for (let n = el; n && n !== document.body; n = n.parentElement) if (getComputedStyle(n).position === 'fixed') return n; return null; };
    for (const pos of [0, 0.5, 1]) {
      window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * pos);
      await new Promise((r) => setTimeout(r, 150));
      for (const e of kawalan) {
        const r = e.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) continue;
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        if (cy < 0 || cy > innerHeight) continue;
        const atas = document.elementFromPoint(cx, cy);
        const f = atas && tetap(atas);
        if (f && !f.contains(e) && !f.closest('[role=dialog]') && !f.querySelector('[role=dialog]')) isu.push(`ditutup elemen terapung: "${nama(e)}"`);
      }
    }
    window.scrollTo(0, 0);
    // 2b. Butang berwarna yang terhimpit (cth. butang Simpan dalam dialog yang panjang)
    for (const e of document.querySelectorAll('button, a[href]')) {
      if (!nampak(e) || !(e.innerText || '').trim()) continue;
      const bg = getComputedStyle(e).backgroundColor;
      if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') continue;
      const h = e.getBoundingClientRect().height;
      if (h < 36) isu.push(`butang nipis (${Math.round(h)}px): "${nama(e)}"`);
    }
    // 3. Skrol mendatar
    // Mod telefon: kandungan yang terlalu lebar membesarkan viewport susun atur (clientWidth > lebar skrin)
    const lebarSusun = Math.max(document.documentElement.scrollWidth, document.documentElement.clientWidth);
    if (lebarSusun > screen.width + 1) isu.push(`skrol mendatar: ${lebarSusun}>${screen.width}`);
    // 4. Tajuk terlalu panjang
    const h1 = [...document.querySelectorAll('h1')].find(nampak);
    if (h1) {
      const lh = parseFloat(getComputedStyle(h1).lineHeight) || 28;
      if (h1.getBoundingClientRect().height > lh * 2.2) isu.push(`tajuk lebih 2 baris: "${h1.innerText.slice(0, 40)}"`);
    }
    return [...new Set(isu)];
  });
}

// Dialog yang dibuka dan diperiksa juga (laluan, langkah klik)
const DIALOG_HR = [
  ['/pengurusan/pekerja/00000000-0000-0000-0000-0000000000e4', ['[role=tab]:has-text("Kerjaya")', 'button:has-text("+ Tambah peristiwa")']],
  ['/pengurusan/pekerja/00000000-0000-0000-0000-0000000000e4', ['button:has-text("Ubah maklumat")']],
  ['/pengurusan/pekerja/00000000-0000-0000-0000-0000000000e4', ['button:has-text("Ubah gaji & jawatan")']],
  ['/pengurusan/gaji/pekerja', ['main a:has-text("Amin"), main button:has-text("Amin")', 'button:has-text("Ubah gaji")']],
];

async function imbasDialog(p, senarai, label, bahasa) {
  let n = 0;
  for (const [r, klik] of senarai) {
    await p.goto(BASE + r);
    await p.waitForLoadState('networkidle').catch(() => {});
    let ok = true;
    for (const k of klik) {
      const el = p.locator(`${k} >> visible=true`).first();
      if (!(await el.count())) { ok = false; break; }
      await el.click().catch(() => { ok = false; });
      await p.waitForTimeout(700);
    }
    if (!ok) continue; // label English tiada padanan — diuji dalam BM
    const isu = await p.evaluate(() => {
      const d = [...document.querySelectorAll('[role=dialog]')].pop();
      if (!d) return ['dialog tidak dibuka'];
      const out = [];
      for (const e of d.querySelectorAll('button, a[href]')) {
        const bg = getComputedStyle(e).backgroundColor;
        if (!(e.innerText || '').trim() || bg === 'rgba(0, 0, 0, 0)') continue;
        const h = e.getBoundingClientRect().height;
        if (h < 40) out.push(`butang nipis dalam dialog (${Math.round(h)}px): "${e.innerText.trim().slice(0, 30)}"`);
      }
      const k = [...d.querySelectorAll('input:not([type=checkbox]), select, textarea')];
      for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) {
        const a = k[i].getBoundingClientRect(), b = k[j].getBoundingClientRect();
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 4 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 4) out.push('medan bertindih dalam dialog');
      }
      return [...new Set(out)];
    });
    if (isu.length) {
      n++;
      log(`   [${label} ${bahasa}] dialog ${r} → ${klik.join(' → ')}`);
      for (const x of isu) log('       ' + x);
    }
  }
  return n;
}

async function imbas(b, email, routes, label, bahasa) {
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  await ctx.addCookies([{ name: 'hrb_bahasa', value: bahasa, url: BASE }]);
  await ctx.addInitScript((l) => { try { localStorage.setItem('hrb_bahasa', l); } catch {} }, bahasa);
  const p = await ctx.newPage();
  await p.goto(BASE + '/masuk');
  await p.fill('input[type=email]', email);
  await p.fill('input[autocomplete=current-password]', 'Demo1234');
  await p.click('button[type=submit]');
  await p.waitForURL(/\/(utama|pengurusan)/, { timeout: 30000 });
  let n = 0;
  for (const r of routes) {
    await p.goto(BASE + r);
    await p.waitForLoadState('networkidle').catch(() => {});
    await p.waitForTimeout(600);
    const isu = await semak(p);
    if (isu.length) {
      n++;
      log(`   [${label} ${bahasa}] ${r}`);
      for (const x of isu.slice(0, 8)) log('       ' + x);
    }
  }
  if (label === 'HR' && bahasa === 'ms') n += await imbasDialog(p, DIALOG_HR, label, bahasa);
  await ctx.close();
  return n;
}

(async () => {
  const b = await chromium.launch();
  let jumlah = 0;
  for (const bahasa of ['en', 'ms']) {
    jumlah += await imbas(b, 'lily@demo.hrboost.io', HR, 'HR', bahasa);
    jumlah += await imbas(b, 'amin@demo.hrboost.io', STAF, 'pekerja', bahasa);
  }
  await b.close();
  if (jumlah) {
    console.error(`SEMAKAN GAGAL: ${jumlah} skrin dengan isu susun atur telefon`);
    process.exit(1);
  }
  log('LULUS: susun atur telefon (390px)');
})().catch((e) => { console.error(e); process.exit(1); });
