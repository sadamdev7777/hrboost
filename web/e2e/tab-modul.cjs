// Ujian konsistensi tab modul HR (TEMPATAN SAHAJA):
//  setiap tab dalam satu modul (Pekerja, Cuti, Penggajian, Kehadiran, Peti HR) mesti berkongsi
//  lebar skrin, tajuk pengepala dan tiada butang kembali — supaya menukar tab tidak "melompat" ke susun atur lain.
// Diuji pada desktop (1440px) dan telefon (390px).
// Prasyarat: `npx supabase db reset`, aplikasi di localhost:3000. Jalankan: node web/e2e/tab-modul.cjs
const { chromium } = require('playwright');
require('./_bahasa.cjs');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const log = (...a) => console.log(...a);
const MODUL = [
  ['Pekerja', '/pengurusan/pekerja'],
  ['Cuti', '/pengurusan/cuti'],
  ['Penggajian', '/pengurusan/gaji'],
  ['Kehadiran', '/pengurusan/kehadiran'],
  ['Peti HR', '/pengurusan/soalan'],
];

async function ukur(p, label) {
  return p.evaluate((label) => {
    const nav = [...document.querySelectorAll(`nav[aria-label="${label}"]`)].find((n) => n.getBoundingClientRect().width > 0);
    if (!nav) return null;
    const r = nav.getBoundingClientRect();
    const skrin = nav.parentElement.getBoundingClientRect();
    const h1 = [...document.querySelectorAll('header h1')].find((h) => h.getBoundingClientRect().width > 0);
    const kembali = [...document.querySelectorAll('header [aria-label="Kembali"]')].some((e) => e.getBoundingClientRect().width > 0);
    return {
      tab: [...nav.querySelectorAll('a')].map((a) => a.getAttribute('href')),
      kiri: Math.round(r.left),
      lebar: Math.round(r.width),
      skrin: Math.round(skrin.width),
      tajuk: h1 ? h1.innerText.trim() : '',
      kembali,
    };
  }, label);
}

(async () => {
  const b = await chromium.launch();
  let gagal = 0;
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    const p = await ctx.newPage();
    await p.goto(BASE + '/masuk');
    await p.fill('input[type=email]', 'lily@demo.hrboost.io');
    await p.fill('input[autocomplete=current-password]', 'Demo1234');
    await p.click('button[type=submit]');
    await p.waitForURL(/\/(pengurusan|utama)/, { timeout: 30000 });
    await p.evaluate(() => localStorage.setItem('hrb_mod', 'hr'));
    log(`== ${w}px`);
    for (const [label, mula] of MODUL) {
      await p.goto(BASE + mula);
      await p.waitForSelector(`nav[aria-label="${label}"] >> visible=true`, { timeout: 20000 });
      const asas = await ukur(p, label);
      for (const href of asas.tab) {
        await p.goto(BASE + href);
        await p.waitForSelector(`nav[aria-label="${label}"] >> visible=true`, { timeout: 20000 }).catch(() => {});
        await p.waitForLoadState('networkidle').catch(() => {});
        await p.waitForTimeout(300);
        const m = await ukur(p, label);
        const isu = [];
        if (!m) isu.push('bar tab tiada');
        else {
          if (Math.abs(m.kiri - asas.kiri) > 2 || Math.abs(m.lebar - asas.lebar) > 2 || Math.abs(m.skrin - asas.skrin) > 2)
            isu.push(`lebar berbeza (${m.kiri}+${m.lebar}/${m.skrin} lwn ${asas.kiri}+${asas.lebar}/${asas.skrin})`);
          if (m.tajuk.replace(/\s+\S+$/, '') !== asas.tajuk.replace(/\s+\S+$/, '') && m.tajuk !== asas.tajuk) isu.push(`tajuk "${m.tajuk}" lwn "${asas.tajuk}"`);
          if (m.kembali !== asas.kembali) isu.push(`butang kembali ${m.kembali ? 'ada' : 'tiada'}`);
        }
        if (isu.length) {
          gagal++;
          log(`   ✘ ${label} → ${href}: ${isu.join('; ')}`);
        } else log(`   ✔ ${label} → ${href}`);
      }
    }
    await ctx.close();
  }
  await b.close();
  if (gagal) {
    console.error(`SEMAKAN GAGAL: ${gagal} tab tidak konsisten`);
    process.exit(1);
  }
  log('LULUS: tab modul konsisten');
})().catch((e) => { console.error(e); process.exit(1); });
