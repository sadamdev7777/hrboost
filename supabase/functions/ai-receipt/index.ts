// =====================================================================
//  ai-receipt — baca resit (gambar / PDF) → isi borang tuntutan (CLAUDE.md §4, BuatClaim)
//  POST { path } dengan JWT pekerja. Fail mesti dalam folder pekerja itu sendiri.
//  bump_usage(company,'ai') dahulu. Hasil ialah cadangan — pekerja menyemak sebelum menghantar.
// =====================================================================
import { AiError, cors, failSebagaiKandungan, json, panggil, penggunaDaripadaJwt, ralatKeJson, semakHad, serviceClient, teks } from "../_shared/ai.ts";

const SKEMA = {
  type: "object",
  properties: {
    merchant: { type: ["string", "null"], description: "Nama peniaga / penyedia perkhidmatan" },
    date: { type: ["string", "null"], description: "Tarikh resit, format YYYY-MM-DD" },
    amount: { type: ["number", "null"], description: "Jumlah akhir yang dibayar dalam RM" },
    currency: { type: "string", description: "Kod mata wang, contoh MYR" },
    claim_type: { type: ["string", "null"], description: "Satu nama daripada senarai jenis tuntutan yang diberi, atau null" },
    purpose: { type: "string", description: "Keterangan ringkas dalam bahasa Melayu rasmi, maksimum 60 aksara" },
    readable: { type: "boolean", description: "false jika gambar bukan resit atau tidak boleh dibaca" },
  },
  required: ["merchant", "date", "amount", "currency", "claim_type", "purpose", "readable"],
  additionalProperties: false,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors() });
  try {
    const { user, personId } = await penggunaDaripadaJwt(req);
    const body = (await req.json().catch(() => ({}))) as { path?: string; company_id?: string };
    if (!body.path || body.path.split("/")[0] !== personId) throw new AiError("akses", "Resit mesti dalam folder anda sendiri");
    const { data: emp } = await user.from("employments").select("company_id").eq("person_id", personId).eq("company_id", body.company_id ?? "").in("status", ["probation", "active"]).maybeSingle();
    if (!emp) throw new AiError("akses", "Bukan pekerja syarikat ini");
    const { data: jenis } = await user.from("claim_types").select("name").eq("company_id", emp.company_id).eq("active", true);
    const sb = serviceClient();
    await semakHad(sb, emp.company_id);
    const fail = await failSebagaiKandungan(sb, body.path);
    const res = await panggil({
      max_tokens: 2000,
      output_config: { effort: "low", format: { type: "json_schema", schema: SKEMA } },
      messages: [
        {
          role: "user",
          content: [
            fail,
            {
              type: "text",
              text:
                "Baca resit ini untuk borang tuntutan pekerja di Malaysia. Jenis tuntutan syarikat: " +
                (jenis ?? []).map((j) => j.name).join(", ") +
                ". Pilih jenis yang paling sesuai atau null. Jumlah ialah jumlah akhir selepas cukai. Jika maklumat tidak jelas, beri null — jangan meneka.",
            },
          ],
        },
      ],
    });
    const hasil = JSON.parse(teks(res));
    return json({ ok: true, ...hasil });
  } catch (e) {
    return ralatKeJson(e);
  }
});
