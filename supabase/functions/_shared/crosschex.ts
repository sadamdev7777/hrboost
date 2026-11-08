// =====================================================================
//  Penyesuai CrossChex Cloud (Anviz) — API JSON "header/payload".
//  Token: authorize.token → disimpan (Vault) hingga `expires`; ralat TOKEN_EXPIRES → minta baharu.
//  Rekod: attendance.record / getrecord, 100 rekod setiap halaman.
// =====================================================================

export type Punch = {
  uuid: string;
  checktime: string; // ISO UTC
  checktype: number | null;
  workno: string;
  deviceSn: string | null;
  deviceName: string | null;
  raw: unknown;
};

export class CrossChexError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

function header(nameSpace: string, nameAction: string) {
  return {
    nameSpace,
    nameAction,
    version: "1.0",
    requestId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
}

async function post(apiUrl: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(apiUrl.replace(/\/+$/, "") + "/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text);
  } catch {
    throw new CrossChexError("HTTP", `Jawapan tidak sah daripada CrossChex (HTTP ${res.status})`);
  }
  const h = (json.header ?? {}) as Record<string, unknown>;
  const p = (json.payload ?? {}) as Record<string, unknown>;
  // Ralat CrossChex: header.nameSpace = "System", payload.type = kod ralat
  if (h.nameSpace === "System" || typeof p.type === "string") {
    const code = String(p.type ?? "ERROR");
    throw new CrossChexError(code, `CrossChex: ${code}${p.message ? ` (${p.message})` : ""}`);
  }
  if (!res.ok) throw new CrossChexError("HTTP", `CrossChex HTTP ${res.status}`);
  return p;
}

export async function mintaToken(apiUrl: string, apiKey: string, apiSecret: string) {
  const p = await post(apiUrl, { header: header("authorize.token", "token"), payload: { api_key: apiKey, api_secret: apiSecret } });
  if (typeof p.token !== "string") throw new CrossChexError("TOKEN", "CrossChex tidak memulangkan token");
  const expires = typeof p.expires === "string" ? new Date(p.expires) : new Date(Date.now() + 50 * 60_000);
  return { token: p.token, expires: isNaN(expires.getTime()) ? new Date(Date.now() + 50 * 60_000) : expires };
}

function utc(s: string): string {
  // CrossChex: "2026-11-06T02:02:11+00:00" atau "2026-11-06 02:02:11" (UTC)
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(" ", "T") + "Z");
  return d.toISOString();
}

/** Tarik semua rekod antara dua masa (UTC), halaman demi halaman. */
export async function tarikRekod(apiUrl: string, token: string, dari: Date, hingga: Date): Promise<Punch[]> {
  const out: Punch[] = [];
  for (let page = 1; page <= 200; page++) {
    const p = await post(apiUrl, {
      header: header("attendance.record", "getrecord"),
      authorize: { type: "token", token },
      payload: {
        begin_time: dari.toISOString(),
        end_time: hingga.toISOString(),
        order: "asc",
        page,
        per_page: 100,
      },
    });
    const list = (p.list ?? []) as Record<string, unknown>[];
    for (const r of list) {
      const emp = (r.employee ?? {}) as Record<string, unknown>;
      const dev = (r.device ?? {}) as Record<string, unknown>;
      if (!r.uuid || !r.checktime || !emp.workno) continue;
      out.push({
        uuid: String(r.uuid),
        checktime: utc(String(r.checktime)),
        checktype: r.checktype == null ? null : Number(r.checktype),
        workno: String(emp.workno),
        deviceSn: dev.serial_number ? String(dev.serial_number) : null,
        deviceName: dev.name ? String(dev.name) : null,
        raw: r,
      });
    }
    const pageCount = Number(p.pageCount ?? 1);
    if (list.length === 0 || page >= pageCount) break;
  }
  return out;
}
