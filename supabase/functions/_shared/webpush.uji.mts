// Ujian Web Push (Deno): penyulitan aes128gcm dinyahsulit oleh pustaka bebas http_ece; JWT VAPID disahkan oleh pelayan push tiruan.
// Jalankan: deno run -A --node-modules-dir=none supabase/functions/_shared/webpush.uji.mts
import ece from "npm:http_ece@1.2.0";
import { createECDH, randomBytes } from "node:crypto";
import { b64url, dariB64url, janaVapid, sulitkan } from "./webpush.ts";

// Peranti tiruan (pelayar): kunci ECDH P-256 + rahsia auth
const ua = createECDH("prime256v1"); ua.generateKeys();
const auth = randomBytes(16);
const muatan = { title: "HRBoost", body: "Permohonan menunggu kelulusan anda", url: "/kelulusan" };
const sifer = await sulitkan(new TextEncoder().encode(JSON.stringify(muatan)), b64url(new Uint8Array(ua.getPublicKey())), b64url(new Uint8Array(auth)));
const teks = ece.decrypt(Buffer.from(sifer), { version: "aes128gcm", privateKey: ua, authSecret: auth });
const balik = JSON.parse(teks.toString());
if (balik.body !== muatan.body) throw new Error("nyahsulit gagal");
console.log("✔ http_ece menyahsulit muatan:", balik.body);

const v = await janaVapid();
if (dariB64url(v.public).length !== 65 || dariB64url(v.private).length !== 32) throw new Error("saiz kunci");
console.log("✔ VAPID", v.public.length, v.private.length);

// Pelayan push tiruan: sahkan JWT VAPID (ES256) & nyahsulit badan
import { hantarPush } from "./webpush.ts";
let diterima = "";
const srv = Deno.serve({ port: 8793, onListen() {} }, async (req) => {
  const a = req.headers.get("authorization")!;
  const [, jwt, k] = a.match(/^vapid t=([^,]+), k=(.+)$/)!;
  const [h, c, s] = jwt.split(".");
  const pub = await crypto.subtle.importKey("raw", dariB64url(k), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const sah = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, dariB64url(s), new TextEncoder().encode(`${h}.${c}`));
  const tuntutan = JSON.parse(new TextDecoder().decode(dariB64url(c)));
  if (!sah || tuntutan.aud !== "http://127.0.0.1:8793" || req.headers.get("content-encoding") !== "aes128gcm") return new Response("x", { status: 401 });
  diterima = ece.decrypt(Buffer.from(new Uint8Array(await req.arrayBuffer())), { version: "aes128gcm", privateKey: ua, authSecret: auth }).toString();
  return new Response(null, { status: 201 });
});
const r = await hantarPush({ endpoint: "http://127.0.0.1:8793/sub/1", p256dh: b64url(new Uint8Array(ua.getPublicKey())), auth: b64url(new Uint8Array(auth)) }, muatan, { ...v, subject: "mailto:ujian@hrboost.io" });
if (!r.ok || JSON.parse(diterima).url !== "/kelulusan") throw new Error("hantar gagal " + JSON.stringify(r));
console.log("✔ JWT VAPID sah, muatan diterima:", diterima);
await srv.shutdown();
