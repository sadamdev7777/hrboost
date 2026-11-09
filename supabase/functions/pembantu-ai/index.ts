// =====================================================================
//  pembantu-ai — Pembantu AI dalam aplikasi (PembantuAI) & draf surat HR
//  POST { mesej, company_id, conversation_id?, bahasa? }            → { balasan, conversation_id }
//  POST { mode: "surat", employment_id, jenis, nota }        → { surat }   (HR/Pentadbir sahaja)
//  JWT pengguna wajib. Logik ejen dikongsi dengan whatsapp-inbound (_shared/pembantu.ts).
// =====================================================================
import { AiError, cors, json, penggunaDaripadaJwt, ralatKeJson, serviceClient } from "../_shared/ai.ts";
import { drafSurat, jawab, sediaKonteks } from "../_shared/pembantu.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors() });
  try {
    const { personId } = await penggunaDaripadaJwt(req);
    const b = (await req.json().catch(() => ({}))) as Record<string, string | undefined>;
    const sb = serviceClient();
    if (b.mode === "surat") {
      if (!b.employment_id || !b.jenis) throw new AiError("akses", "Butiran surat tidak lengkap");
      return json({ ok: true, surat: await drafSurat(sb, personId, b.employment_id, b.jenis, b.nota ?? "") });
    }
    const mesej = (b.mesej ?? "").trim();
    if (!mesej) throw new AiError("akses", "Sila taip soalan");
    if (mesej.length > 2000) throw new AiError("akses", "Mesej terlalu panjang");
    const k = await sediaKonteks(sb, personId, b.company_id ?? null, "web", b.conversation_id, b.bahasa);
    return json({ ok: true, balasan: await jawab(k, mesej), conversation_id: k.conversationId });
  } catch (e) {
    return ralatKeJson(e);
  }
});
