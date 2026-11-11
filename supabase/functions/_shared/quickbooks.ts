// =====================================================================
//  QuickBooks Online (Intuit) — OAuth 2.0 & API perakaunan
//  Rahsia (Supabase secrets): QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REDIRECT_URI, QBO_ENV ("sandbox" | "production").
//  Refresh token setiap syarikat disimpan dalam Vault (integration_secret_set) dan diputar setiap kali digunakan.
// =====================================================================
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.105.0";

export class QboError extends Error {
  constructor(public kod: "konfigurasi" | "sambungan" | "api" | "data", message: string) {
    super(message);
  }
}

export const qboDikonfigurasi = () => !!(Deno.env.get("QBO_CLIENT_ID") && Deno.env.get("QBO_CLIENT_SECRET") && Deno.env.get("QBO_REDIRECT_URI"));
const apiBase = () =>
  Deno.env.get("QBO_ENV") === "production" ? "https://quickbooks.api.intuit.com" : "https://sandbox-quickbooks.api.intuit.com";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const MINOR = "75";

export function urlKebenaran(state: string): string {
  if (!qboDikonfigurasi()) throw new QboError("konfigurasi", "Sambungan QuickBooks belum dikonfigurasi oleh Pentadbir Platform.");
  const q = new URLSearchParams({
    client_id: Deno.env.get("QBO_CLIENT_ID")!,
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: Deno.env.get("QBO_REDIRECT_URI")!,
    response_type: "code",
    state,
  });
  return `https://appcenter.intuit.com/connect/oauth2?${q}`;
}

async function token(body: Record<string, string>) {
  const basic = btoa(`${Deno.env.get("QBO_CLIENT_ID")}:${Deno.env.get("QBO_CLIENT_SECRET")}`);
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new QboError("sambungan", `QuickBooks menolak token (${j.error ?? r.status}). Sila sambung semula.`);
  return j as { access_token: string; refresh_token: string; expires_in: number };
}

export const tukarKod = (code: string) => token({ grant_type: "authorization_code", code, redirect_uri: Deno.env.get("QBO_REDIRECT_URI")! });

type Kelayakan = { realm_id: string; refresh_token: string };

/** Token akses baharu bagi syarikat (refresh token diputar & disimpan semula). */
export async function sesiSyarikat(sb: SupabaseClient, companyId: string): Promise<Qbo> {
  const { data, error } = await sb.rpc("integration_secret_get", { p_company: companyId, p_provider: "quickbooks" });
  if (error) throw new QboError("api", error.message);
  if (!data) throw new QboError("sambungan", "QuickBooks belum disambungkan.");
  const k = JSON.parse(data as string) as Kelayakan;
  const t = await token({ grant_type: "refresh_token", refresh_token: k.refresh_token });
  if (t.refresh_token !== k.refresh_token) {
    const { error: e2 } = await sb.rpc("integration_secret_set", {
      p_company: companyId,
      p_provider: "quickbooks",
      p_secret: JSON.stringify({ realm_id: k.realm_id, refresh_token: t.refresh_token }),
    });
    if (e2) throw new QboError("api", e2.message);
  }
  return new Qbo(k.realm_id, t.access_token);
}

export class Qbo {
  private akaunCache = new Map<string, string>();
  constructor(public realm: string, private access: string) {}

  async panggil<T>(kaedah: "GET" | "POST", laluan: string, badan?: unknown): Promise<T> {
    const sep = laluan.includes("?") ? "&" : "?";
    const r = await fetch(`${apiBase()}/v3/company/${this.realm}/${laluan}${sep}minorversion=${MINOR}`, {
      method: kaedah,
      headers: { Authorization: `Bearer ${this.access}`, Accept: "application/json", ...(badan ? { "Content-Type": "application/json" } : {}) },
      body: badan ? JSON.stringify(badan) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const f = j?.Fault?.Error?.[0];
      throw new QboError("api", f ? `${f.Message}: ${f.Detail ?? ""}`.slice(0, 300) : `QuickBooks ralat ${r.status}`);
    }
    return j as T;
  }

  private async tanya<T>(sql: string): Promise<T[]> {
    const j = await this.panggil<{ QueryResponse: Record<string, T[]> }>("GET", `query?query=${encodeURIComponent(sql)}`);
    const v = Object.values(j.QueryResponse ?? {}).find(Array.isArray);
    return (v as T[]) ?? [];
  }

  /** Akaun mengikut Id, nombor akaun (AcctNum) atau nama penuh. */
  async akaun(rujukan: string): Promise<string> {
    const k = rujukan.trim();
    if (this.akaunCache.has(k)) return this.akaunCache.get(k)!;
    const esc = k.replace(/'/g, "\\'");
    let hasil = /^\d+$/.test(k) ? await this.tanya<{ Id: string }>(`select Id from Account where Id = '${esc}'`) : [];
    if (!hasil.length) hasil = await this.tanya<{ Id: string }>(`select Id from Account where AcctNum = '${esc}'`);
    if (!hasil.length) hasil = await this.tanya<{ Id: string }>(`select Id from Account where FullyQualifiedName = '${esc}'`);
    if (!hasil.length) hasil = await this.tanya<{ Id: string }>(`select Id from Account where Name = '${esc}'`);
    if (!hasil.length) throw new QboError("data", `Akaun "${k}" tidak dijumpai dalam QuickBooks. Kemas kini peta akaun di Tetapan.`);
    this.akaunCache.set(k, hasil[0].Id);
    return hasil[0].Id;
  }

  /** Pembekal (pekerja) — dicari ikut DisplayName, dicipta jika tiada. */
  async pembekal(nama: string): Promise<string> {
    const esc = nama.replace(/'/g, "\\'");
    const ada = await this.tanya<{ Id: string }>(`select Id from Vendor where DisplayName = '${esc}'`);
    if (ada.length) return ada[0].Id;
    const v = await this.panggil<{ Vendor: { Id: string } }>("POST", "vendor", { DisplayName: nama });
    return v.Vendor.Id;
  }
}
