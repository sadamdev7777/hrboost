// Akaun demo tempatan (supabase/seed): nombor telefon → e-mel log masuk. Kata laluan semua: Demo1234.
const EMEL = {
  '1': 'sadam@demo.hrboost.io',
  '2': 'lily@demo.hrboost.io',
  '3': 'zuerin@demo.hrboost.io',
  '4': 'amin@demo.hrboost.io',
  '5': 'farah@demo.hrboost.io',
  '6': 'zulfa@demo.hrboost.io',
  '7': 'owner@demo.hrboost.io',
};
/** "0100000004" / "60100000004" → amin@demo.hrboost.io */
function emelDemo(telefon) {
  const e = EMEL[String(telefon).replace(/\D/g, '').slice(-1)];
  if (!e) throw new Error('Tiada akaun demo untuk ' + telefon);
  return e;
}
module.exports = { emelDemo };

/**
 * Pautan terkini dalam e-mel kepada `kepada` (Mailpit tempatan, port 54324).
 * Menunggu sehingga e-mel tiba (cth. pautan pengesahan / set semula kata laluan).
 */
async function pautanEmel(kepada, { selepas = 0, tunggu = 20000 } = {}) {
  const MAIL = process.env.E2E_MAILPIT || 'http://127.0.0.1:54324';
  const tamat = Date.now() + tunggu;
  while (Date.now() < tamat) {
    const r = await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent('to:' + kepada)}`).then((x) => x.json()).catch(() => null);
    const m = (r?.messages ?? []).find((x) => new Date(x.Created).getTime() >= selepas);
    if (m) {
      const d = await fetch(`${MAIL}/api/v1/message/${m.ID}`).then((x) => x.json());
      const isi = `${d.HTML ?? ''}\n${d.Text ?? ''}`.replace(/&amp;/g, '&');
      const p = isi.match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify\?[^\s"'<>]+/);
      if (p) return p[0];
    }
    await new Promise((s) => setTimeout(s, 500));
  }
  throw new Error('Tiada e-mel untuk ' + kepada);
}
module.exports.pautanEmel = pautanEmel;
