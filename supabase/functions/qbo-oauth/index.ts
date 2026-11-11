// =====================================================================
//  qbo-oauth — sambung QuickBooks Online
//  POST (JWT Kewangan/Pentadbir) { company_id } → { url }  : pautan kebenaran Intuit
//  GET  ?code&state&realmId (pautan balik Intuit)          → simpan refresh token dalam Vault, kembali ke aplikasi
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2.105.0";
import { QboError, tukarKod, urlKebenaran } from "../_shared/quickbooks.ts";
import { cors, json } from "../_shared/ai.ts";

const URL_SB = Deno.env.get("SUPABASE_URL")!;
const APP = (Deno.env.get("APP_URL") ?? "https://hrboost.io").replace(/\/$/, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors() });
  const service = createClient(URL_SB, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  try {
    if (req.method === "POST") {
      const auth = req.headers.get("Authorization") ?? "";
      const pengguna = createClient(URL_SB, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
      const { company_id } = (await req.json().catch(() => ({}))) as { company_id?: string };
      // Semakan peranan dalam pangkalan data (Kewangan/Pentadbir) sebagai pengguna itu
      const { data: state, error } = await pengguna.rpc("qbo_connect_start", { p_company: company_id });
      if (error) return json({ ok: false, error: error.message }, 403);
      return json({ ok: true, url: urlKebenaran(state as string) });
    }

    const u = new URL(req.url);
    const code = u.searchParams.get("code");
    const state = u.searchParams.get("state");
    const realm = u.searchParams.get("realmId");
    if (u.searchParams.get("error") || !code || !state || !realm) return Response.redirect(`${APP}/pengurusan/tetapan/akaun?qbo=batal`, 302);
    const { data: companyId, error } = await service.rpc("qbo_connect_finish", { p_state: state });
    if (error) return Response.redirect(`${APP}/pengurusan/tetapan/akaun?qbo=tamat`, 302);
    const t = await tukarKod(code);
    const { error: e2 } = await service.rpc("integration_secret_set", {
      p_company: companyId,
      p_provider: "quickbooks",
      p_secret: JSON.stringify({ realm_id: realm, refresh_token: t.refresh_token }),
    });
    if (e2) throw new QboError("api", e2.message);
    const { data: c } = await service.from("companies").select("accounting_config").eq("id", companyId).single();
    await service
      .from("companies")
      .update({ accounting_system: "quickbooks", accounting_config: { ...(c?.accounting_config ?? {}), realm_id: realm, connected_at: new Date().toISOString() } })
      .eq("id", companyId);
    return Response.redirect(`${APP}/pengurusan/tetapan/akaun?qbo=ok`, 302);
  } catch (e) {
    console.error("qbo-oauth", e instanceof Error ? e.message : e);
    if (req.method === "POST") return json({ ok: false, error: e instanceof Error ? e.message : "Ralat" }, 500);
    return Response.redirect(`${APP}/pengurusan/tetapan/akaun?qbo=ralat`, 302);
  }
});
