// =====================================================================
//  Penyesuai AI (Claude, @anthropic-ai/sdk). Kunci ANTHROPIC_API_KEY dalam Supabase secrets sahaja.
//  - Model lalai claude-opus-5-5 (boleh ditukar dengan HRBOOST_AI_MODEL).
//  - Penolakan keselamatan (stop_reason "refusal") ditangani; sandaran pelayan
//    (fallbacks: "default") dihidupkan supaya permintaan yang ditolak dicuba semula
//    pada model lain secara automatik.
//  - Setiap panggilan didahului bump_usage(company, 'ai') — had bulanan syarikat.
// =====================================================================
import Anthropic from "npm:@anthropic-ai/sdk@1.1.0";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.105.0";

export const MODEL = Deno.env.get("HRBOOST_AI_MODEL") ?? "claude-opus-5-5";
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export function aiTersedia(): boolean {
  return !!Deno.env.get("ANTHROPIC_API_KEY");
}

let _client: Anthropic | null = null;
export function claude(): Anthropic {
  // ANTHROPIC_BASE_URL (jika ditetapkan) dibaca oleh SDK — digunakan oleh ujian tempatan sahaja
  if (!_client) _client = new Anthropic({ maxRetries: 2, timeout: 120_000 });
  return _client;
}

export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
}

export class AiError extends Error {
  constructor(public code: "tiada_kunci" | "had" | "ditolak" | "api" | "akses", message: string) {
    super(message);
  }
}

/** Kurangkan baki AI bulanan syarikat; ralat jika had dicapai. */
export async function semakHad(sb: SupabaseClient, companyId: string, n = 1) {
  const { data, error } = await sb.rpc("bump_usage", { p_company: companyId, p_kind: "ai", p_n: n });
  if (error) throw new AiError("api", error.message);
  if (data === false) throw new AiError("had", "Had penggunaan AI bulanan syarikat telah dicapai. Hubungi Pentadbir syarikat.");
}

type CreateParams = Omit<Anthropic.Beta.MessageCreateParamsNonStreaming, "model" | "betas">;

/** Satu panggilan Messages API dengan sandaran pelayan & semakan penolakan. */
export async function panggil(params: CreateParams): Promise<Anthropic.Beta.BetaMessage> {
  if (!aiTersedia()) throw new AiError("tiada_kunci", "Pembantu AI belum diaktifkan (kunci AI belum ditetapkan).");
  try {
    const res = await claude().beta.messages.create({
      ...params,
      model: MODEL,
      betas: [FALLBACK_BETA],
      // deno-lint-ignore no-explicit-any
      ...({ fallbacks: "default" } as any),
    });
    if (res.stop_reason === "refusal") {
      throw new AiError("ditolak", "Permintaan ini tidak dapat diproses oleh AI. Sila hubungi HR.");
    }
    return res;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.RateLimitError) throw new AiError("api", "AI sedang sibuk. Sila cuba sebentar lagi.");
    if (e instanceof Anthropic.APIError) throw new AiError("api", `Ralat AI (${e.status ?? "rangkaian"}).`);
    throw new AiError("api", "AI tidak dapat dihubungi.");
  }
}

export function teks(res: Anthropic.Beta.BetaMessage): string {
  return res.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/** Kandungan imej / PDF daripada bucket peribadi untuk dihantar kepada model. */
export async function failSebagaiKandungan(sb: SupabaseClient, path: string): Promise<Anthropic.Beta.BetaContentBlockParam> {
  const { data, error } = await sb.storage.from("peribadi").download(path);
  if (error || !data) throw new AiError("akses", "Fail tidak dapat dibaca.");
  if (data.size > 10 * 1024 * 1024) throw new AiError("akses", "Fail melebihi 10 MB.");
  const bytes = new Uint8Array(await data.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const b64 = btoa(bin);
  const jenis = data.type || (path.endsWith(".pdf") ? "application/pdf" : "image/jpeg");
  if (jenis === "application/pdf") return { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } };
  const media = (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(jenis) ? jenis : "image/jpeg") as "image/jpeg";
  return { type: "image", source: { type: "base64", media_type: media, data: b64 } };
}

/** Pengguna daripada JWT (Authorization) — mengembalikan person & pekerjaan aktif. */
export async function penggunaDaripadaJwt(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) throw new AiError("akses", "Tidak dibenarkan");
  const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: u } = await user.auth.getUser(auth.slice(7));
  if (!u.user) throw new AiError("akses", "Sesi tidak sah");
  const { data: p } = await user.from("persons").select("id, preferred_name, full_name").eq("auth_user_id", u.user.id).maybeSingle();
  if (!p) throw new AiError("akses", "Akaun belum diaktifkan");
  return { user, personId: p.id as string, nama: (p.preferred_name || p.full_name) as string };
}

export function cors(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", ...cors() } });
}

export function ralatKeJson(e: unknown) {
  if (e instanceof AiError) {
    const s = { tiada_kunci: 503, had: 429, ditolak: 422, api: 502, akses: 403 }[e.code];
    return json({ ok: false, code: e.code, error: e.message }, s);
  }
  return json({ ok: false, code: "api", error: "Ralat dalaman" }, 500);
}
