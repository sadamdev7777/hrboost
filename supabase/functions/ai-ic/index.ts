// =====================================================================
//  ai-ic — baca kad pengenalan (MyKad) bahagian hadapan → isi orientasi (OnboardingDokumen)
//  POST { path, company_id } dengan JWT pekerja. Fail mesti dalam folder pekerja itu sendiri.
//  Hasil dipadankan dengan rekod HR — tidak menulis apa-apa ke pangkalan data.
// =====================================================================
import { AiError, cors, failSebagaiKandungan, json, panggil, penggunaDaripadaJwt, ralatKeJson, semakHad, serviceClient, teks } from "../_shared/ai.ts";

const SKEMA = {
  type: "object",
  properties: {
    full_name: { type: ["string", "null"] },
    ic_no: { type: ["string", "null"], description: "Format 000000-00-0000" },
    address: { type: ["string", "null"] },
    gender: { type: ["string", "null"], description: "\"L\" lelaki atau \"P\" perempuan (digit akhir IC ganjil = L)" },
    readable: { type: "boolean" },
  },
  required: ["full_name", "ic_no", "address", "gender", "readable"],
  additionalProperties: false,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors() });
  try {
    const { user, personId } = await penggunaDaripadaJwt(req);
    const body = (await req.json().catch(() => ({}))) as { path?: string; company_id?: string };
    if (!body.path || body.path.split("/")[0] !== personId) throw new AiError("akses", "Fail mesti dalam folder anda sendiri");
    const { data: emp } = await user.from("employments").select("company_id").eq("person_id", personId).eq("company_id", body.company_id ?? "").maybeSingle();
    if (!emp) throw new AiError("akses", "Bukan pekerja syarikat ini");
    const { data: p } = await user.from("persons").select("full_name, ic_no").eq("id", personId).single();
    const sb = serviceClient();
    await semakHad(sb, emp.company_id);
    const fail = await failSebagaiKandungan(sb, body.path);
    const res = await panggil({
      max_tokens: 1500,
      output_config: { effort: "low", format: { type: "json_schema", schema: SKEMA } },
      messages: [{ role: "user", content: [fail, { type: "text", text: "Baca maklumat daripada kad pengenalan Malaysia (MyKad) ini. Jika bukan MyKad atau tidak jelas, readable=false dan medan lain null." }] }],
    });
    const h = JSON.parse(teks(res)) as { full_name: string | null; ic_no: string | null; address: string | null; gender: string | null; readable: boolean };
    const d = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
    return json({
      ok: true,
      ...h,
      // padanan dengan rekod yang didaftarkan oleh HR
      ic_matches: !!h.ic_no && !!p?.ic_no && d(h.ic_no) === d(p.ic_no),
      name_matches: !!h.full_name && !!p?.full_name && h.full_name.replace(/\s+/g, " ").trim().toUpperCase() === p.full_name.replace(/\s+/g, " ").trim().toUpperCase(),
    });
  } catch (e) {
    return ralatKeJson(e);
  }
});
