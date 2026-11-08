-- =====================================================================
--  Fasa C: automasi & WhatsApp (CLAUDE.md §4)
--    events-worker  → pg_cron setiap minit: process_hr_events()
--    sla-tick       → pg_cron setiap 15 minit: approval_sla_tick()
--    notify-sender  → Edge Function: notify_next() → hantar (Murpati) → notify_mark()
--    whatsapp-inbound → Edge Function: whatsapp_handle_reply() → balasan
--  Logik disimpan dalam pangkalan data supaya boleh diuji tanpa Murpati.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Giliran notifikasi
-- ---------------------------------------------------------------------
alter table notifications add column if not exists claimed_at timestamptz;
alter table notifications add column if not exists attempts int not null default 0;
alter table notifications add column if not exists bypass_limit boolean not null default false;
alter table usage_counters add column if not exists wa_limit_notified boolean not null default false;

-- Normalkan nombor telefon Malaysia kepada 60XXXXXXXXX (tanpa +).
create or replace function normalize_msisdn(p_phone text) returns text
language sql immutable set search_path = public as $$
  select case
    when d like '60%' then d
    when d like '0%' then '6' || d
    when d like '1%' then '60' || d
    else d end
  from (select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d) x
$$;

-- Ambil notifikasi WhatsApp untuk dihantar. Semak had penggunaan syarikat dahulu;
-- jika had habis: tanda 'skipped' dan maklum Pentadbir syarikat sekali sahaja sebulan.
create or replace function notify_next(p_limit int default 50)
returns table(id uuid, to_address text, message text, company_id uuid)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare n notifications; ok boolean; m date := date_trunc('month', now())::date; a record;
begin
  if not is_service_role() then raise exception 'Tidak dibenarkan'; end if;
  for n in
    select * from notifications x
     where x.status = 'pending' and x.channel = 'whatsapp'
       and (x.claimed_at is null or x.claimed_at < now() - interval '5 minutes')
     order by x.created_at
     limit p_limit
     for update skip locked
  loop
    if n.to_address is null then
      update notifications set status = 'failed', error = 'Tiada nombor WhatsApp' where notifications.id = n.id;
      continue;
    end if;
    ok := n.company_id is null or n.bypass_limit or bump_usage(n.company_id, 'wa');
    if not ok then
      update notifications set status = 'skipped', error = 'Had WhatsApp bulanan syarikat telah habis'
       where notifications.id = n.id;
      if not coalesce((select wa_limit_notified from usage_counters u
                        where u.company_id = n.company_id and u.month = m), false) then
        update usage_counters set wa_limit_notified = true where usage_counters.company_id = n.company_id and month = m;
        for a in select r.person_id from user_roles r where r.company_id = n.company_id and r.role = 'admin' loop
          insert into notifications(company_id, person_id, channel, to_address, message, bypass_limit)
          select n.company_id, ps.id, 'whatsapp', ps.phone_whatsapp,
                 'Makluman HRBoost: had mesej WhatsApp bulan ini untuk syarikat anda telah habis. '
                 || 'Notifikasi seterusnya tidak dihantar sehingga bulan hadapan. Hubungi HRBoost untuk menambah had.',
                 true
            from persons ps where ps.id = a.person_id and ps.is_active;
        end loop;
      end if;
      continue;
    end if;
    update notifications set claimed_at = now(), attempts = attempts + 1 where notifications.id = n.id;
    id := n.id; to_address := n.to_address; message := n.message; company_id := n.company_id;
    return next;
  end loop;
end $$;

-- Rekod keputusan penghantaran. Gagal 3 kali → 'failed'; jika tidak, cuba semula kemudian.
create or replace function notify_mark(p_id uuid, p_ok boolean, p_provider_ref text default null, p_error text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_service_role() then raise exception 'Tidak dibenarkan'; end if;
  if p_ok then
    update notifications set status = 'sent', sent_at = now(), provider_ref = p_provider_ref, error = null
     where id = p_id;
  else
    update notifications set error = left(p_error, 500),
           status = case when attempts >= 3 then 'failed'::notify_status else 'pending' end,
           claimed_at = case when attempts >= 3 then claimed_at else null end
     where id = p_id;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Balasan WhatsApp daripada pelulus: "LULUS", "LULUS 2", "TOLAK sebab", "TOLAK 2 sebab"
--    Teks lain → {action: "ai"} (dihantar kepada agent AI dalam fasa kemudian).
-- ---------------------------------------------------------------------
create or replace function whatsapp_handle_reply(p_phone text, p_text text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ph text := normalize_msisdn(p_phone);
  p persons;
  t text := regexp_replace(trim(coalesce(p_text, '')), '\s+', ' ', 'g');
  u text;
  verb text; num int; reason text;
  tasks uuid[]; titles text[]; tid uuid; ttl text;
  m text[];
  r approval_requests;
  senarai text := '';
begin
  if not is_service_role() then raise exception 'Tidak dibenarkan'; end if;
  select * into p from persons where phone_whatsapp = ph and is_active;
  if p.id is null then
    return jsonb_build_object('action', 'unknown_sender',
      'reply', 'Nombor ini tidak berdaftar dengan HRBoost. Sila hubungi HR syarikat anda.');
  end if;

  u := upper(t);
  m := regexp_match(u, '^(LULUS|LULUSKAN|SETUJU)(?: +(\d{1,2}))?[.!]?$');
  if m is not null then
    verb := 'approve'; num := m[2]::int;
  else
    m := regexp_match(t, '^(?:[Tt][Oo][Ll][Aa][Kk])(?: +(\d{1,2}))?(?: +(.+))?$');
    if m is not null then
      verb := 'reject'; num := m[1]::int; reason := nullif(trim(m[2]), '');
    end if;
  end if;

  if verb is null then
    return jsonb_build_object('action', 'ai', 'person_id', p.id);
  end if;

  select array_agg(tk.id order by tk.created_at), array_agg(rq.title order by tk.created_at)
    into tasks, titles
    from approval_tasks tk join approval_requests rq on rq.id = tk.request_id
   where tk.approver_person_id = p.id and tk.status = 'pending' and rq.status = 'pending';

  if tasks is null then
    return jsonb_build_object('action', 'none', 'reply', 'Tiada permohonan yang menunggu kelulusan anda.');
  end if;

  if num is null and array_length(tasks, 1) > 1 then
    for i in 1 .. array_length(tasks, 1) loop
      senarai := senarai || E'\n' || i || '. ' || titles[i];
    end loop;
    return jsonb_build_object('action', 'choose', 'reply',
      'Ada ' || array_length(tasks, 1) || ' permohonan menunggu kelulusan anda:' || senarai
      || E'\n\nBalas LULUS 1 atau TOLAK 1 <sebab> (tukar nombor mengikut senarai).');
  end if;

  num := coalesce(num, 1);
  if num < 1 or num > array_length(tasks, 1) then
    return jsonb_build_object('action', 'invalid', 'reply',
      'Nombor ' || num || ' tiada dalam senarai. Ada ' || array_length(tasks, 1) || ' permohonan menunggu.');
  end if;
  tid := tasks[num]; ttl := titles[num];

  if verb = 'reject' and reason is null then
    return jsonb_build_object('action', 'need_reason', 'reply',
      'Sila nyatakan sebab penolakan. Contoh: TOLAK ' || case when array_length(tasks, 1) > 1 then num || ' ' else '' end
      || 'Pasukan tidak mencukupi pada tarikh itu');
  end if;

  begin
    r := approval_act(tid, verb, reason, 'whatsapp', p.id);
  exception when others then
    return jsonb_build_object('action', 'error', 'reply', 'Tindakan tidak berjaya: ' || sqlerrm);
  end;

  return jsonb_build_object(
    'action', verb, 'task_id', tid, 'request_status', r.status,
    'reply', case when verb = 'approve'
                  then 'Diluluskan: ' || ttl || case when r.status = 'pending' then '. Permohonan diteruskan ke peringkat seterusnya.' else '.' end
                  else 'Ditolak: ' || ttl || '. Sebab: ' || reason || '. Pemohon akan dimaklumkan.' end);
end $$;

revoke execute on function notify_next(int), notify_mark(uuid, boolean, text, text),
  whatsapp_handle_reply(text, text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function notify_next(int), notify_mark(uuid, boolean, text, text),
      whatsapp_handle_reply(text, text) from anon, authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function notify_next(int), notify_mark(uuid, boolean, text, text),
      whatsapp_handle_reply(text, text) to service_role;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. Jadual pg_cron (dilangkau jika pg_cron tiada, cth. ujian Postgres biasa)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron tiada: jadual dilangkau';
    return;
  end if;
  create extension if not exists pg_cron;
  perform cron.schedule('hrboost-events-worker', '* * * * *', 'select public.process_hr_events()');
  perform cron.schedule('hrboost-sla-tick', '*/15 * * * *', 'select public.approval_sla_tick()');
end $$;

-- ---------------------------------------------------------------------
-- 4. Templat mesej: nilai kosong dipaparkan sebagai "tiada" (sebelum ini
--    menghasilkan "PIC ganti: ." apabila tiada pengganti tugas).
-- ---------------------------------------------------------------------
create or replace function render_template(p_tpl text, p_vars jsonb) returns text
language plpgsql immutable set search_path = public as $$
declare k text; v text; out_ text := p_tpl;
begin
  for k, v in select key, value #>> '{}' from jsonb_each(p_vars) loop
    out_ := replace(out_, '{{' || k || '}}', coalesce(nullif(v, ''), 'tiada'));
  end loop;
  return out_;
end $$;
