// Pelayan MCP HRBoost (Model Context Protocol, Streamable HTTP, tanpa sesi).
// Claude / pembantu AI lain bertindak sebagai pengguna pemilik token. Semua semakan peranan dibuat di pangkalan data
// melalui RPC mcp_call (lihat supabase/migrations/20261213000000_mcp.sql). Token: pengepala Authorization: Bearer
// atau segmen URL /api/mcp/<token> (untuk penyambung tersuai Claude.ai). Token tidak pernah direkodkan di sini.
import { NextRequest, NextResponse } from "next/server";


const VERSI = ["2025-06-18", "2025-03-26", "2024-11-05"];

type Alat = { name: string; title: string; description: string; inputSchema: Record<string, unknown>; annotations?: Record<string, unknown> };
const obj = (properties: Record<string, unknown> = {}, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });
const tarikh = { type: "string", description: "Date in YYYY-MM-DD format" };

const ALAT: Alat[] = [
  { name: "get_my_profile", title: "My profile", description: "Who I am in HRBoost: name, company, position, department, roles (hr/finance/ceo/admin) and today's date in Malaysia. Call this first.", inputSchema: obj(), annotations: { readOnlyHint: true } },
  { name: "get_leave_balance", title: "My leave balance", description: "My leave balances (annual, sick, etc.): entitled, used, pending and available days for a year.", inputSchema: obj({ year: { type: "integer" } }), annotations: { readOnlyHint: true } },
  { name: "list_leave_types", title: "Leave types", description: "Leave types available in my company with their codes (use the code for apply_leave).", inputSchema: obj(), annotations: { readOnlyHint: true } },
  { name: "apply_leave", title: "Apply for leave", description: "Submit a leave application for myself. It goes through the company's normal approval flow (no auto-approval). Working days and public holidays are calculated automatically. Sick leave (MC) needs a certificate and must be submitted in the app. Confirm dates and type with the user before calling.", inputSchema: obj({ leave_type: { type: "string", description: "Leave type code (e.g. AL) or name" }, start_date: tarikh, end_date: tarikh, half_day: { type: "string", enum: ["full", "am", "pm"] }, reason: { type: "string" } }, ["leave_type", "start_date"]) },
  { name: "list_my_requests", title: "My requests", description: "My recent requests (leave, claims, overtime, etc.) with status and who they are waiting for.", inputSchema: obj({ limit: { type: "integer", minimum: 1, maximum: 50 } }), annotations: { readOnlyHint: true } },
  { name: "list_pending_approvals", title: "Pending approvals", description: "Requests waiting for MY approval, with requester, details and task_id.", inputSchema: obj(), annotations: { readOnlyHint: true } },
  { name: "decide_approval", title: "Approve / reject", description: "Approve, reject or return a request assigned to me. A comment is required for reject/return. Always confirm with the user before deciding.", inputSchema: obj({ task_id: { type: "string" }, decision: { type: "string", enum: ["approve", "reject", "return"] }, comment: { type: "string" } }, ["task_id", "decision"]), annotations: { destructiveHint: true } },
  { name: "who_is_on_leave", title: "Who is on leave", description: "Team leave calendar for a date range (my department; whole company for HR), with public holidays.", inputSchema: obj({ from: tarikh, to: tarikh }), annotations: { readOnlyHint: true } },
  { name: "search_employees", title: "Search employees (HR)", description: "HR/Finance/CEO/Admin only: search employees by name, employee no., department or position. No IC, bank or salary data.", inputSchema: obj({ query: { type: "string" } }), annotations: { readOnlyHint: true } },
  { name: "hr_summary", title: "HR summary (HR)", description: "HR/Finance/CEO/Admin only: headcount, who is on leave today, pending approvals by type, unpaid approved claims.", inputSchema: obj(), annotations: { readOnlyHint: true } },
  { name: "payroll_summary", title: "Payroll summary (HR)", description: "HR/Finance/CEO/Admin only: payroll runs for a year/month with status and company totals (no individual salaries).", inputSchema: obj({ year: { type: "integer" }, month: { type: "integer", minimum: 1, maximum: 12 } }), annotations: { readOnlyHint: true } },
  { name: "get_my_payslips", title: "My payslips", description: "My released payslips: gross, deductions, net and line items.", inputSchema: obj({ year: { type: "integer" }, month: { type: "integer", minimum: 1, maximum: 12 } }), annotations: { readOnlyHint: true } },
];

const ARAHAN =
  "HRBoost is a Malaysian HR system. You act as the signed-in employee and can only do what they can do in the app. " +
  "Call get_my_profile first. Use the user's language (Bahasa Melayu or English). Dates are in Malaysia time. " +
  "Never approve, reject or apply for leave without the user's explicit confirmation.";

function tokenDaripada(req: NextRequest, segmen?: string[]): string | null {
  const h = req.headers.get("authorization");
  if (h?.toLowerCase().startsWith("bearer ")) return h.slice(7).trim();
  return segmen?.[0] ?? null;
}

async function panggil(token: string, alat: string, args: unknown): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return { ok: false, error: "Server not configured" };
  const r = await fetch(`${url}/rest/v1/rpc/mcp_call`, {
    method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token, p_tool: alat, p_args: args ?? {} }),
    cache: "no-store",
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) return { ok: false, error: (j && (j.message as string)) || `HTTP ${r.status}` };
  return j as { ok: boolean; data?: unknown; error?: string };
}

type Mesej = { jsonrpc: "2.0"; id?: string | number | null; method?: string; params?: Record<string, unknown> };

async function urus(m: Mesej, token: string): Promise<Record<string, unknown> | null> {
  const balas = (result: unknown) => ({ jsonrpc: "2.0", id: m.id, result });
  const ralat = (code: number, message: string) => ({ jsonrpc: "2.0", id: m.id ?? null, error: { code, message } });
  if (m.id === undefined || m.id === null) return null; // pemberitahuan (cth. notifications/initialized)
  switch (m.method) {
    case "initialize": {
      const diminta = String(m.params?.protocolVersion ?? "");
      return balas({
        protocolVersion: VERSI.includes(diminta) ? diminta : VERSI[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "hrboost", title: "HRBoost.io", version: "1.0.0" },
        instructions: ARAHAN,
      });
    }
    case "ping":
      return balas({});
    case "tools/list":
      return balas({ tools: ALAT });
    case "tools/call": {
      const nama = String(m.params?.name ?? "");
      if (!ALAT.some((a) => a.name === nama)) return ralat(-32602, `Unknown tool: ${nama}`);
      const r = await panggil(token, nama, m.params?.arguments ?? {});
      if (!r.ok) return balas({ content: [{ type: "text", text: r.error ?? "Error" }], isError: true });
      return balas({ content: [{ type: "text", text: JSON.stringify(r.data ?? null, null, 2) }] });
    }
    default:
      return ralat(-32601, `Method not found: ${m.method}`);
  }
}

async function POST(req: NextRequest, ctx: { params: Promise<{ token?: string[] }> }) {
  const { token: segmen } = await ctx.params;
  const token = tokenDaripada(req, segmen);
  if (!token || !/^hrb_[A-Za-z0-9_-]{20,}$/.test(token)) {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Missing or invalid HRBoost token. Create one in HRBoost → Saya → Sambungan AI." } }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }
  // Semak token sekali pada initialize supaya pengguna mendapat ralat yang jelas lebih awal
  const senarai = (Array.isArray(body) ? body : [body]) as Mesej[];
  if (senarai.some((m) => m.method === "initialize")) {
    const r = await panggil(token, "get_my_profile", {});
    if (!r.ok) return NextResponse.json({ jsonrpc: "2.0", id: senarai[0]?.id ?? null, error: { code: -32001, message: r.error ?? "Unauthorized" } }, { status: 401 });
  }
  const jawapan = (await Promise.all(senarai.map((m) => urus(m, token)))).filter(Boolean);
  if (!jawapan.length) return new NextResponse(null, { status: 202 });
  return NextResponse.json(Array.isArray(body) ? jawapan : jawapan[0], { headers: { "Cache-Control": "no-store" } });
}

function GET() {
  // Tiada strim SSE (pelayan tanpa sesi)
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}

export { POST, GET, GET as DELETE };
