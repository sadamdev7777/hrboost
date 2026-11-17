// =====================================================================
//  Web Push tanpa pakej luar (Web Crypto sahaja) — RFC 8291 (aes128gcm) + RFC 8292 (VAPID).
//  - janaVapid(): pasangan kunci ECDSA P-256 (kunci awam 65 bait mentah, kunci peribadi 32 bait) dalam base64url
//  - hantarPush(): sulitkan muatan untuk satu langganan pelayar dan POST ke pelayan push (FCM / Apple / Mozilla)
//  Modul tulen (Web Crypto + fetch) supaya boleh diuji dengan Deno atau Node.
// =====================================================================

const te = new TextEncoder();

export function b64url(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function dariB64url(s: string): Uint8Array {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(t + "===".slice((t.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function gabung(...b: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(b.reduce((n, x) => n + x.length, 0));
  let i = 0;
  for (const x of b) {
    out.set(x, i);
    i += x.length;
  }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, panjang: number): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource }, k, panjang * 8));
}

export type Vapid = { public: string; private: string; subject: string };

/** Jana pasangan kunci VAPID baharu (base64url). */
export async function janaVapid(): Promise<{ public: string; private: string }> {
  const kp = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  return { public: b64url(pub), private: jwk.d! };
}

async function jwtVapid(endpoint: string, v: Vapid): Promise<string> {
  const pub = dariB64url(v.public);
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", d: v.private, x: b64url(pub.slice(1, 33)), y: b64url(pub.slice(33, 65)), ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const kepala = b64url(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const tuntutan = b64url(te.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: v.subject })));
  const tandatangan = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(`${kepala}.${tuntutan}`)));
  return `${kepala}.${tuntutan}.${b64url(tandatangan)}`;
}

/** Sulitkan muatan (RFC 8291, aes128gcm, satu rekod). */
export async function sulitkan(muatan: Uint8Array, p256dh: string, auth: string): Promise<Uint8Array> {
  const uaPub = dariB64url(p256dh);
  const rahsiaAuth = dariB64url(auth);
  const as = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", as.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPub as BufferSource, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(rahsiaAuth, ecdh, gabung(te.encode("WebPush: info\0"), uaPub, asPub), 32);
  const garam = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(garam, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(garam, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const k = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, ["encrypt"]);
  const sifer = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, k, gabung(muatan, new Uint8Array([2])) as BufferSource));
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return gabung(garam, rs, new Uint8Array([asPub.length]), asPub, sifer);
}

export type Langganan = { endpoint: string; p256dh: string; auth: string };
export type HasilPush = { ok: boolean; gone: boolean; status: number; error?: string };

/** Hantar satu notifikasi tolak. gone = langganan tamat (404/410) dan patut dipadam. */
export async function hantarPush(s: Langganan, muatan: unknown, v: Vapid, ttl = 86400): Promise<HasilPush> {
  try {
    const badan = await sulitkan(te.encode(JSON.stringify(muatan)), s.p256dh, s.auth);
    const jwt = await jwtVapid(s.endpoint, v);
    const res = await fetch(s.endpoint, {
      method: "POST",
      headers: {
        Authorization: `vapid t=${jwt}, k=${v.public}`,
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(ttl),
        Urgency: "high",
      },
      body: badan as BodyInit,
      signal: AbortSignal.timeout(15_000),
    });
    const ok = res.status >= 200 && res.status < 300;
    const teks = ok ? "" : (await res.text().catch(() => "")).slice(0, 200);
    return { ok, gone: res.status === 404 || res.status === 410, status: res.status, error: ok ? undefined : `HTTP ${res.status} ${teks}` };
  } catch (e) {
    return { ok: false, gone: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}
