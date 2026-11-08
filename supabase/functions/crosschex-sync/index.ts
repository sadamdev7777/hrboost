// =====================================================================
//  crosschex-sync — tarik imbasan CrossChex Cloud ke HRBoost (CLAUDE.md §4)
//  Jadual: setiap 5 minit (pg_cron + pg_net, lihat README). Setiap syarikat ditarik
//  mengikut kekerapan pilihannya (5/15/30 minit, attendance_integrations.next_run_at).
//
//  Panggilan:
//   - pg_cron: Authorization: Bearer <service role>, badan kosong → semua syarikat yang tiba masanya
//   - Skrin IntegrasiKehadiran: Authorization: Bearer <JWT pengguna>,
//       { company_id, mode: "test" | "pull" } → HR/Pentadbir syarikat itu sahaja
//
//  Julat tarikan: last_synced_at − 10 minit hingga kini (rekod lewat dari peranti
//  luar talian), atau 2 hari terakhir pada tarikan pertama. ingest_punch tidak
//  menggandakan rekod (unik ikut uuid).
// =====================================================================
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.105.0";
import { CrossChexError, mintaToken, tarikRekod } from "../_shared/crosschex.ts";

type Target = {
  company_id: string;
  api_url: string;
  api_key: string;
  api_secret: string;
  token: string | null;
  token_expires_at: string | null;
  last_synced_at: string | null;
};

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
// UJIAN TEMPATAN SAHAJA: halakan semua panggilan ke pelayan CrossChex palsu. Jangan tetapkan di Supabase sebenar.
const OVERRIDE = Deno.env.get("CROSSCHEX_URL_OVERRIDE");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors() });
  const auth = req.headers.get("Authorization") ?? "";
  const sb: SupabaseClient = createClient(URL, SERVICE, { auth: { persistSession: false } });
  let body: { company_id?: string; mode?: "test" | "pull" } = {};
  try {
    body = req.headers.get("content-type")?.includes("json") ? await req.json() : {};
  } catch {
    body = {};
  }

  // Pengguna (bukan service role): mesti HR/Pentadbir syarikat itu
  if (auth !== `Bearer ${SERVICE}`) {
    if (!body.company_id || !auth.startsWith("Bearer ")) return json({ error: "Tidak dibenarkan" }, 401);
    const user = createClient(URL, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: boleh } = await user.rpc("can_manage_attendance", { p_company: body.company_id });
    if (boleh !== true) return json({ error: "Tidak dibenarkan" }, 403);
  }

  const { data: targets, error } = await sb.rpc("crosschex_targets", {
    p_company: body.company_id ?? null,
    p_force: !!body.company_id,
  });
  if (error) return json({ error: error.message }, 500);

  const hasil = [];
  for (const t of (targets ?? []) as Target[]) {
    if (OVERRIDE) t.api_url = OVERRIDE;
    hasil.push(await segerak(sb, t, body.mode === "test"));
  }
  if (body.company_id && hasil.length === 0) return json({ ok: false, message: "Integrasi belum disediakan atau tidak aktif" }, 400);
  return json(body.company_id ? hasil[0] : { syarikat: hasil.length, hasil });
});

async function segerak(sb: SupabaseClient, t: Target, ujiSahaja: boolean) {
  let token = t.token;
  let tokenBaru: { token: string; expires: Date } | null = null;
  const tamat = t.token_expires_at ? new Date(t.token_expires_at) : null;
  const mula = Date.now();
  try {
    if (!token || !tamat || tamat.getTime() - 60_000 < Date.now()) {
      tokenBaru = await mintaToken(t.api_url, t.api_key, t.api_secret);
      token = tokenBaru.token;
    }
    const hingga = new Date();
    const dari = t.last_synced_at ? new Date(new Date(t.last_synced_at).getTime() - 10 * 60_000) : new Date(Date.now() - 2 * 86400_000);
    if (ujiSahaja) {
      // Sahkan token dengan satu halaman kecil (5 minit terakhir)
      await tarikRekod(t.api_url, token!, new Date(Date.now() - 5 * 60_000), hingga).catch(async (e) => {
        if (e instanceof CrossChexError && e.code === "TOKEN_EXPIRES" && !tokenBaru) {
          tokenBaru = await mintaToken(t.api_url, t.api_key, t.api_secret);
          token = tokenBaru.token;
          return [];
        }
        throw e;
      });
      await tanda(sb, t.company_id, true, "Ujian sambungan berjaya", 0, null, tokenBaru);
      return { ok: true, message: "Sambungan berjaya", records: 0 };
    }

    let rekod;
    try {
      rekod = await tarikRekod(t.api_url, token!, dari, hingga);
    } catch (e) {
      if (e instanceof CrossChexError && e.code === "TOKEN_EXPIRES") {
        tokenBaru = await mintaToken(t.api_url, t.api_key, t.api_secret);
        token = tokenBaru.token;
        await sb.rpc("crosschex_mark", {
          p_company: t.company_id, p_ok: true, p_message: "Token luput → diperbaharui", p_records: 0,
          p_synced_to: null, p_token: tokenBaru.token, p_token_expires: tokenBaru.expires.toISOString(),
        });
        tokenBaru = null;
        rekod = await tarikRekod(t.api_url, token, dari, hingga);
      } else throw e;
    }

    let baharu = 0;
    let tidakPadan = 0;
    for (const r of rekod) {
      const { data, error } = await sb.rpc("ingest_punch", {
        p_company: t.company_id, p_workno: r.workno, p_uuid: r.uuid, p_time: r.checktime,
        p_checktype: r.checktype, p_device_sn: r.deviceSn, p_device_name: r.deviceName, p_raw: r.raw as never,
      });
      if (error) throw new Error(error.message);
      if (data === false) tidakPadan++;
      baharu++;
    }
    const mesej = rekod.length === 0
      ? "Tiada rekod imbasan baharu"
      : `${baharu} rekod imbasan${tidakPadan ? ` (${tidakPadan} belum dipadankan)` : ""}`;
    await tanda(sb, t.company_id, true, mesej, baharu, hingga, tokenBaru);
    return { ok: true, message: mesej, records: baharu, ms: Date.now() - mula };
  } catch (e) {
    const mesej = e instanceof Error ? e.message : String(e);
    await tanda(sb, t.company_id, false, mesej, 0, null, tokenBaru);
    return { ok: false, message: mesej, records: 0 };
  }
}

async function tanda(
  sb: SupabaseClient,
  company: string,
  ok: boolean,
  mesej: string,
  n: number,
  hingga: Date | null,
  token: { token: string; expires: Date } | null,
) {
  await sb.rpc("crosschex_mark", {
    p_company: company, p_ok: ok, p_message: mesej, p_records: n,
    p_synced_to: hingga ? hingga.toISOString() : null,
    p_token: token?.token ?? null, p_token_expires: token ? token.expires.toISOString() : null,
  });
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", ...cors() } });
}
