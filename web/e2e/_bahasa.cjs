// Ujian e2e sedia ada ditulis dalam Bahasa Melayu: paksa antara muka BM dalam setiap konteks pelayar.
// (Lalai aplikasi ialah English; ujian English berasingan tidak memuatkan fail ini.)
const { chromium } = require('playwright');
if (!chromium.__bahasaMs) {
  const asal = chromium.launch.bind(chromium);
  chromium.launch = async (...a) => {
    const b = await asal(...a);
    const nc = b.newContext.bind(b);
    b.newContext = async (...o) => {
      const c = await nc(...o);
      await c.addCookies([{ name: 'hrb_bahasa', value: 'ms', url: process.env.E2E_BASE || 'http://localhost:3000' }]);
      await c.addInitScript(() => {
        try {
          localStorage.setItem('hrb_bahasa', 'ms');
        } catch {}
      });
      return c;
    };
    return b;
  };
  chromium.__bahasaMs = true;
}
