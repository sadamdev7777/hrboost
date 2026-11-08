// =====================================================================
//  payroll-calc — pembungkus HTTP untuk enjin gaji (CLAUDE.md §4)
//  Pengiraan sebenar dalam RPC payroll_calculate (SQL, kadar daripada statutory_rates)
//  supaya app, agent dan fungsi ini memberi hasil yang sama.
//  Panggilan: POST { run_id } dengan JWT HR/Kewangan (kebenaran disemak oleh RPC).
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2.105.0";

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return Response.json({ error: "Tidak dibenarkan" }, { status: 401, headers: cors });
  let runId: string | undefined;
  try {
    runId = (await req.json()).run_id;
  } catch {
    runId = undefined;
  }
  if (!runId) return Response.json({ error: "run_id diperlukan" }, { status: 400, headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data, error } = await sb.rpc("payroll_calculate", { p_run: runId });
  if (error) return Response.json({ error: error.message }, { status: 400, headers: cors });
  return Response.json({ ok: true, totals: data }, { headers: cors });
});
