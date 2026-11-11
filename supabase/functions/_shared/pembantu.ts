// =====================================================================
//  Pembantu AI (PembantuAI, WhatsApp teks bebas). Ejen dengan alat yang SEMUANYA
//  diskopkan dalam kod kepada pekerja yang disahkan (JWT atau nombor WhatsApp) —
//  "Ejen hanya boleh melihat data anda sendiri". Tindakan ditulis dalam ai_action_log.
// =====================================================================
import type Anthropic from "npm:@anthropic-ai/sdk@1.1.0";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.105.0";
import { AiError, panggil, semakHad, teks } from "./ai.ts";

type Konteks = {
  sb: SupabaseClient; // service role — setiap pertanyaan ditapis dengan personId/employmentId di bawah
  personId: string;
  nama: string;
  employmentId: string;
  companyId: string;
  companyName: string;
  conversationId: string;
  channel: "web" | "whatsapp";
  /** Bahasa balasan: persons.language (atau bahasa antara muka semasa bagi aplikasi). */
  bahasa: "en" | "ms";
};

const hariIni = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });

const ALAT: Anthropic.Beta.BetaTool[] = [
  { name: "baki_cuti", description: "Baki cuti pekerja ini bagi tahun semasa (kelayakan, digunakan, menunggu, baki) mengikut jenis.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  {
    name: "permohonan_saya",
    description: "Senarai permohonan terkini pekerja ini (cuti, tuntutan, pembetulan masa) dengan status dan peringkat kelulusan semasa.",
    input_schema: { type: "object", properties: { jenis: { type: "string", enum: ["semua", "leave", "claim", "attendance_correction"] } }, required: ["jenis"], additionalProperties: false },
  },
  { name: "kehadiran_bulan_ini", description: "Ringkasan kehadiran pekerja ini bagi bulan semasa: hari hadir, kali lewat, rekod terkini.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  {
    name: "cari_polisi",
    description: "Cari petikan daripada buku panduan dan dokumen polisi syarikat. Gunakan untuk SEMUA soalan polisi. Jika tiada hasil, jangan meneka.",
    input_schema: { type: "object", properties: { soalan: { type: "string" } }, required: ["soalan"], additionalProperties: false },
  },
  { name: "tetapan_syarikat", description: "Tetapan sistem syarikat: jenis cuti & kelayakan, jenis tuntutan & had, waktu kerja, aliran kelulusan.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  {
    name: "catat_soalan_tidak_terjawab",
    description: "Rekod soalan polisi yang tidak dapat dijawab daripada dokumen supaya HR boleh menambah jawapan.",
    input_schema: { type: "object", properties: { soalan: { type: "string" } }, required: ["soalan"], additionalProperties: false },
  },
  {
    name: "mohon_cuti",
    description:
      "Hantar permohonan cuti bagi pihak pekerja ini. WAJIB tanya pengesahan pekerja dahulu (jenis, tarikh, sebab); panggil dengan sahkan=true hanya selepas pekerja bersetuju dengan jelas dalam mesej terkini.",
    input_schema: {
      type: "object",
      properties: {
        kod: { type: "string", description: "Kod jenis cuti: AL, MC, EL, UL, dll." },
        mula: { type: "string", description: "YYYY-MM-DD" },
        tamat: { type: "string", description: "YYYY-MM-DD" },
        separuh_hari: { type: "string", enum: ["full", "am", "pm"] },
        sebab: { type: "string" },
        sahkan: { type: "boolean" },
      },
      required: ["kod", "mula", "tamat", "separuh_hari", "sebab", "sahkan"],
      additionalProperties: false,
    },
  },
  {
    name: "minta_surat",
    description: "Hantar permintaan surat (contoh: pengesahan jawatan, pengesahan gaji) kepada HR syarikat. Tanya pengesahan dahulu; sahkan=true selepas pekerja bersetuju.",
    input_schema: {
      type: "object",
      properties: { jenis: { type: "string" }, tujuan: { type: "string" }, sahkan: { type: "boolean" } },
      required: ["jenis", "tujuan", "sahkan"],
      additionalProperties: false,
    },
  },
  // Alat data dikongsi dengan Sambungan AI (MCP) — agent_tool_call() menyemak peranan dalam pangkalan data
  { name: "kelulusan_menunggu", description: "Permohonan yang menunggu kelulusan pengguna ini (pemohon, butiran, peringkat).", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  {
    name: "siapa_bercuti",
    description: "Kalendar cuti pasukan bagi julat tarikh (jabatan sendiri; seluruh syarikat bagi HR), termasuk cuti umum dan cuti ganti.",
    input_schema: {
      type: "object",
      properties: { dari: { type: "string", description: "YYYY-MM-DD; kosong = hari ini" }, hingga: { type: "string", description: "YYYY-MM-DD; kosong = sama dengan dari" } },
      required: ["dari", "hingga"],
      additionalProperties: false,
    },
  },
  {
    name: "cari_pekerja",
    description: "HR/Kewangan/CEO/Pentadbir sahaja: cari pekerja ikut nama, no. pekerja, jabatan atau jawatan. Tiada IC, bank atau gaji.",
    input_schema: { type: "object", properties: { carian: { type: "string" } }, required: ["carian"], additionalProperties: false },
  },
  { name: "ringkasan_hr", description: "HR/Kewangan/CEO/Pentadbir sahaja: bilangan pekerja, siapa bercuti hari ini, kelulusan tertangguh ikut jenis, tuntutan diluluskan belum dibayar.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  {
    name: "ringkasan_gaji",
    description: "HR/Kewangan/CEO/Pentadbir sahaja: larian gaji bagi tahun/bulan dengan status dan jumlah syarikat (tiada gaji individu).",
    input_schema: { type: "object", properties: { tahun: { type: "integer", description: "0 = semua / terkini" }, bulan: { type: "integer", description: "1-12; 0 = semua" } }, required: ["tahun", "bulan"], additionalProperties: false },
  },
  {
    name: "slip_gaji_saya",
    description: "Slip gaji pengguna ini yang telah dilepaskan: kasar, potongan, bersih dan butiran. Jangan dedahkan kepada orang lain.",
    input_schema: { type: "object", properties: { tahun: { type: "integer", description: "0 = semua / terkini" }, bulan: { type: "integer", description: "1-12; 0 = semua" } }, required: ["tahun", "bulan"], additionalProperties: false },
  },
];

async function laksana(k: Konteks, nama: string, input: Record<string, unknown>): Promise<string> {
  const { sb } = k;
  const tahun = Number(hariIni().slice(0, 4));
  switch (nama) {
    case "baki_cuti": {
      // baki dicipta apabila diperlukan (kelayakan ikut tempoh perkhidmatan)
      const { data: jenis } = await sb.from("leave_types").select("id").eq("company_id", k.companyId).eq("active", true).eq("deduct_balance", true);
      for (const j of jenis ?? []) await sb.rpc("ensure_leave_balance", { p_employment: k.employmentId, p_leave_type: j.id, p_year: tahun });
      const { data } = await sb
        .from("leave_balances")
        .select("entitled, carried_forward, adjustment, used, pending, available, leave_types(code, name)")
        .eq("employment_id", k.employmentId)
        .eq("year", tahun);
      return JSON.stringify(data ?? []);
    }
    case "permohonan_saya": {
      let q = sb
        .from("approval_requests")
        .select("id, request_type, title, status, submitted_at, completed_at, approval_tasks(step_name, status)")
        .eq("requester_person_id", k.personId)
        .eq("company_id", k.companyId)
        .order("submitted_at", { ascending: false })
        .limit(8);
      if (input.jenis && input.jenis !== "semua") q = q.eq("request_type", input.jenis as "leave");
      const { data } = await q;
      return JSON.stringify(
        (data ?? []).map((r) => ({
          jenis: r.request_type,
          tajuk: r.title,
          status: r.status,
          dihantar: r.submitted_at,
          menunggu: (r.approval_tasks ?? []).filter((t: { status: string }) => t.status === "pending").map((t: { step_name: string }) => t.step_name),
        })),
      );
    }
    case "kehadiran_bulan_ini": {
      const d0 = hariIni().slice(0, 8) + "01";
      const { data } = await sb.from("attendance_records").select("work_date, clock_in, clock_out, late_minutes").eq("employment_id", k.employmentId).gte("work_date", d0).order("work_date");
      const r = data ?? [];
      return JSON.stringify({ hari_hadir: r.length, kali_lewat: r.filter((x) => x.late_minutes > 0).length, rekod: r.slice(-5) });
    }
    case "cari_polisi": {
      const { data, error } = await sb.rpc("kb_search", { p_company: k.companyId, p_query: String(input.soalan ?? ""), p_limit: 5 });
      if (error) return "Carian gagal.";
      return (data ?? []).length ? JSON.stringify(data) : "TIADA petikan ditemui dalam dokumen syarikat.";
    }
    case "tetapan_syarikat": {
      const [lt, ct, c, wf] = await Promise.all([
        sb.from("leave_types").select("code, name, is_paid, deduct_balance, requires_attachment, leave_entitlement_rules(min_service_months, max_service_months, days_per_year)").eq("company_id", k.companyId).eq("active", true),
        sb.from("claim_types").select("name, limit_per_item, mileage_rate, requires_receipt").eq("company_id", k.companyId).eq("active", true),
        sb.from("companies").select("work_start, work_end, late_grace_minutes, weekend_days, claim_submit_days").eq("id", k.companyId).single(),
        sb.from("approval_workflows").select("request_type, approval_workflow_steps(step_order, name, condition)").eq("company_id", k.companyId),
      ]);
      return JSON.stringify({ jenis_cuti: lt.data, jenis_tuntutan: ct.data, waktu_kerja: c.data, aliran_kelulusan: wf.data });
    }
    case "catat_soalan_tidak_terjawab": {
      await sb.from("ai_unanswered").insert({ company_id: k.companyId, person_id: k.personId, question: String(input.soalan ?? "").slice(0, 500) });
      return "Direkodkan untuk HR.";
    }
    case "mohon_cuti": {
      if (input.sahkan !== true) return "Belum disahkan. Tanya pekerja untuk mengesahkan butiran dahulu.";
      const { data, error } = await sb.rpc("submit_leave", {
        p_employment: k.employmentId,
        p_leave_code: String(input.kod).toUpperCase(),
        p_start: String(input.mula),
        p_end: String(input.tamat),
        p_half: (input.separuh_hari as "full") ?? "full",
        p_reason: String(input.sebab ?? ""),
        p_via: "ai_agent",
        p_on_behalf: k.personId,
      });
      if (error) return `GAGAL: ${error.message}`;
      const lr = data as { id: string; days: number };
      await sb.from("ai_action_log").insert({
        conversation_id: k.conversationId,
        on_behalf_of: k.personId,
        action: "submit_leave",
        target_table: "leave_requests",
        target_id: lr.id,
        payload: { kod: input.kod, mula: input.mula, tamat: input.tamat, hari: lr.days },
      });
      return `BERJAYA: permohonan cuti ${lr.days} hari dihantar untuk kelulusan.`;
    }
    case "minta_surat": {
      if (input.sahkan !== true) return "Belum disahkan. Tanya pekerja untuk mengesahkan dahulu.";
      const { data: hr } = await sb.from("user_roles").select("person_id, persons(phone_whatsapp)").eq("company_id", k.companyId).eq("role", "hr");
      for (const h of hr ?? []) {
        // deno-lint-ignore no-explicit-any
        const tel = (h as any).persons?.phone_whatsapp ?? null;
        await sb.from("notifications").insert({
          company_id: k.companyId,
          person_id: h.person_id,
          to_address: tel,
          message: `${k.nama} memohon surat ${String(input.jenis)} (tujuan: ${String(input.tujuan)}). Draf boleh disediakan melalui Pengurusan → Pekerja → Draf surat (AI).`,
        });
      }
      await sb.from("ai_action_log").insert({ conversation_id: k.conversationId, on_behalf_of: k.personId, action: "request_letter", payload: { jenis: input.jenis, tujuan: input.tujuan } });
      return `BERJAYA: permintaan dihantar kepada ${hr?.length ?? 0} pegawai HR.`;
    }
    case "kelulusan_menunggu":
    case "siapa_bercuti":
    case "cari_pekerja":
    case "ringkasan_hr":
    case "ringkasan_gaji":
    case "slip_gaji_saya": {
      const peta: Record<string, [string, Record<string, unknown>]> = {
        kelulusan_menunggu: ["list_pending_approvals", {}],
        siapa_bercuti: ["who_is_on_leave", { from: input.dari || undefined, to: input.hingga || input.dari || undefined }],
        cari_pekerja: ["search_employees", { query: input.carian }],
        ringkasan_hr: ["hr_summary", {}],
        ringkasan_gaji: ["payroll_summary", { year: input.tahun || undefined, month: input.bulan || undefined }],
        slip_gaji_saya: ["get_my_payslips", { year: input.tahun || undefined, month: input.bulan || undefined }],
      };
      const [alat, args] = peta[nama];
      const { data, error } = await sb.rpc("agent_tool_call", { p_person: k.personId, p_company: k.companyId, p_tool: alat, p_args: JSON.parse(JSON.stringify(args)) });
      if (error) throw new Error(error.message);
      return JSON.stringify(data).slice(0, 20000);
    }
  }
  return "Alat tidak dikenali.";
}

function sistem(k: Konteks): string {
  return [
    `Anda ialah Pembantu AI HRBoost bagi ${k.companyName}. Anda bercakap dengan ${k.nama} melalui ${k.channel === "whatsapp" ? "WhatsApp" : "aplikasi HRBoost"}.`,
    `Tarikh hari ini (waktu Malaysia): ${hariIni()}.`,
    k.bahasa === "ms"
      ? "Jawab dalam bahasa Melayu rasmi (tiada bahasa pasar, tiada istilah Indonesia), ringkas dan mesra. Gunakan istilah: tuntutan, pekerja, pelulus, pengganti tugas, Kewangan."
      : "Reply in clear, friendly English, concisely. If the employee writes in Bahasa Melayu, reply in formal Bahasa Melayu instead. Data from tools may be in Bahasa Melayu: translate it in your reply.",
    "Anda hanya boleh melihat data melalui alat yang disediakan: data pekerja ini sendiri, dan bagi HR/Kewangan/CEO/Pentadbir ringkasan syarikat (alat akan menolak jika pengguna tiada peranan itu). Jangan meneka data yang tiada dalam hasil alat. Gaji individu orang lain tidak boleh didedahkan.",
    "Untuk soalan polisi, gunakan cari_polisi dan tetapan_syarikat. Jangan meneka polisi: jika jawapan tiada dalam hasil alat, katakan anda tidak pasti, sarankan bertanya kepada HR, dan panggil catat_soalan_tidak_terjawab.",
    "Sebelum menghantar permohonan atau permintaan bagi pihak pekerja, nyatakan butirannya dan minta pengesahan. Hanya selepas pekerja bersetuju, panggil alat dengan sahkan=true.",
    k.channel === "whatsapp" ? "Mesej WhatsApp: elakkan jadual dan markdown; gunakan ayat pendek." : "Format ringkas; senarai pendek dibenarkan.",
  ].join("\n");
}

/** Jawab satu mesej pekerja (tool loop, maksimum 6 pusingan). */
export async function jawab(k: Konteks, mesej: string): Promise<string> {
  await semakHad(k.sb, k.companyId);
  const { data: lalu } = await k.sb
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", k.conversationId)
    .in("role", ["user", "assistant"])
    .order("id", { ascending: false })
    .limit(16);
  const sejarah: Anthropic.Beta.BetaMessageParam[] = (lalu ?? [])
    .reverse()
    .filter((m) => m.content)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content as string }));
  while (sejarah.length && sejarah[0].role !== "user") sejarah.shift();
  const messages: Anthropic.Beta.BetaMessageParam[] = [...sejarah, { role: "user", content: mesej }];

  let balasan = "";
  for (let i = 0; i < 6; i++) {
    const res = await panggil({
      max_tokens: 4000,
      system: sistem(k),
      output_config: { effort: "medium" },
      tools: ALAT.map((t) => ({ ...t, strict: true })),
      messages,
    });
    messages.push({ role: "assistant", content: res.content });
    const guna = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || guna.length === 0) {
      balasan = teks(res);
      break;
    }
    const hasil: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const t of guna) {
      try {
        hasil.push({ type: "tool_result", tool_use_id: t.id, content: await laksana(k, t.name, t.input as Record<string, unknown>) });
      } catch (e) {
        hasil.push({ type: "tool_result", tool_use_id: t.id, content: e instanceof Error ? e.message : "Ralat", is_error: true });
      }
    }
    messages.push({ role: "user", content: hasil });
  }
  if (!balasan)
    balasan = k.bahasa === "ms"
      ? "Maaf, saya tidak dapat menyelesaikan permintaan ini. Sila cuba lagi atau hubungi HR."
      : "Sorry, I could not complete this request. Please try again or contact HR.";
  await k.sb.from("ai_messages").insert([
    { conversation_id: k.conversationId, role: "user", content: mesej },
    { conversation_id: k.conversationId, role: "assistant", content: balasan },
  ]);
  await k.sb.from("ai_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", k.conversationId);
  return balasan;
}

/** Cari / cipta perbualan bagi pekerja + saluran. */
export async function sediaKonteks(
  sb: SupabaseClient,
  personId: string,
  companyId: string | null,
  channel: "web" | "whatsapp",
  conversationId?: string | null,
  bahasa?: string | null,
): Promise<Konteks> {
  let q = sb
    .from("employments")
    .select("id, company_id, companies(name, status), persons!employments_person_id_fkey(preferred_name, full_name, language)")
    .eq("person_id", personId)
    .in("status", ["probation", "active"]);
  if (companyId) q = q.eq("company_id", companyId);
  const { data: emp } = await q.order("join_date").limit(1).maybeSingle();
  // deno-lint-ignore no-explicit-any
  const e = emp as any;
  if (!e || e.companies?.status !== "active") throw new AiError("akses", "Tiada pekerjaan aktif");
  let cid = conversationId ?? null;
  if (cid) {
    const { data: c } = await sb.from("ai_conversations").select("id").eq("id", cid).eq("person_id", personId).maybeSingle();
    if (!c) cid = null;
  }
  if (!cid && channel === "whatsapp") {
    const { data: c } = await sb.from("ai_conversations").select("id").eq("person_id", personId).eq("channel", "whatsapp").order("created_at", { ascending: false }).limit(1).maybeSingle();
    cid = c?.id ?? null;
  }
  if (!cid) {
    const { data: c, error } = await sb.from("ai_conversations").insert({ person_id: personId, channel, active_company_id: e.company_id }).select("id").single();
    if (error) throw new AiError("api", error.message);
    cid = c.id;
  }
  return {
    sb,
    personId,
    nama: e.persons?.preferred_name || e.persons?.full_name || "",
    employmentId: e.id,
    companyId: e.company_id,
    companyName: e.companies?.name ?? "",
    conversationId: cid!,
    channel,
    bahasa: (bahasa ?? e.persons?.language) === "ms" ? "ms" : "en",
  };
}

/** Draf surat HR (ProfilPekerja → Draf surat (AI)). Pemanggil mesti HR/Pentadbir syarikat itu. */
export async function drafSurat(sb: SupabaseClient, hrPersonId: string, employmentId: string, jenis: string, nota: string): Promise<string> {
  const { data: e } = await sb
    .from("employments")
    .select("company_id, person_id, employee_no, join_date, confirm_date, status, employment_type, departments(name), positions(title), companies(name, reg_no), persons!employments_person_id_fkey(full_name, ic_no, language)")
    .eq("id", employmentId)
    .maybeSingle();
  // deno-lint-ignore no-explicit-any
  const x = e as any;
  if (!x) throw new AiError("akses", "Pekerja tidak dijumpai");
  const { data: peranan } = await sb.from("user_roles").select("role").eq("company_id", x.company_id).eq("person_id", hrPersonId).in("role", ["hr", "admin"]);
  if (!peranan?.length) throw new AiError("akses", "Hanya HR syarikat ini boleh menyediakan surat");
  await semakHad(sb, x.company_id);
  await sb.from("data_access_log").insert({ actor_person_id: hrPersonId, subject_person_id: x.person_id, resource: "document", via: "ai_agent" });
  const res = await panggil({
    max_tokens: 6000,
    output_config: { effort: "medium" },
    system:
      (x.persons?.language === "ms"
        ? "Tulis surat dalam bahasa Melayu rasmi. "
        : "Write the letter in formal English (the employee's chosen language). ") +
      "Anda menyediakan draf surat rasmi HR untuk syarikat di Malaysia. Gunakan nama penuh mengikut kad pengenalan. Jangan reka fakta yang tiada dalam data; gunakan [ ] untuk maklumat yang perlu diisi oleh HR. Surat amaran mesti adil, menyatakan fakta dan peluang untuk memberi penjelasan. Keluarkan teks surat sahaja, tanpa markdown.",
    messages: [
      {
        role: "user",
        content: `Jenis surat: ${jenis}\nNota HR: ${nota || "-"}\nData pekerja: ${JSON.stringify({
          syarikat: x.companies?.name,
          no_ssm: x.companies?.reg_no,
          nama_penuh: x.persons?.full_name,
          no_kad_pengenalan: x.persons?.ic_no,
          no_pekerja: x.employee_no,
          jawatan: x.positions?.title,
          jabatan: x.departments?.name,
          tarikh_mula: x.join_date,
          tarikh_disahkan: x.confirm_date,
          status: x.status,
          jenis_pekerjaan: x.employment_type,
          tarikh_surat: hariIni(),
        })}`,
      },
    ],
  });
  return teks(res);
}
