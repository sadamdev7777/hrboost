-- =====================================================================
--  Jemputan pekerja melalui e-mel dan / atau WhatsApp
--  - invite_contact: e-mel & no. telefon pekerja untuk dialog jemputan (HR / Pentadbir)
--  - invite_send(employment, url, saluran): 'email' (dihantar oleh sistem), 'whatsapp' (Murpati jika disambung),
--    'link' (pautan sahaja — HR menghantar sendiri melalui WhatsApp / salin)
--  - Mesej penting (bypass_limit: jemputan, ujian e-mel) tidak disekat oleh senarai e-mel dibenarkan staging
-- =====================================================================

create or replace function notify_next2(p_limit int default 50, p_wa boolean default false, p_email boolean default false)
returns table(id uuid, channel text, to_address text, message text, company_id uuid, language text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare n notifications; c companies; ps persons; ok boolean; m date := date_trunc('month', now())::date; a record;
        telefon text; emel text; boleh_wa boolean; boleh_emel boolean;
begin
  if not is_service_role() then raise exception 'Tidak dibenarkan'; end if;
  for n in
    select * from notifications x
     where x.status = 'pending'
       and (x.claimed_at is null or x.claimed_at < now() - interval '5 minutes')
       and (x.send_after is null or x.send_after <= now())
     order by x.created_at
     limit p_limit
     for update skip locked
  loop
    if n.created_at < now() - interval '3 days' then
      update notifications set status = 'skipped', error = 'Tamat tempoh — dipaparkan dalam aplikasi sahaja' where notifications.id = n.id;
      continue;
    end if;
    c := null;
    if n.company_id is not null then select * into c from companies where companies.id = n.company_id; end if;
    select * into ps from persons where persons.id = n.person_id;
    telefon := coalesce(n.to_address, ps.phone_whatsapp);
    if n.channel = 'email' then telefon := ps.phone_whatsapp; end if;
    emel := case when n.channel = 'email' and n.to_address ~ '@' then n.to_address else ps.email end;
    boleh_wa := p_wa and coalesce(c.notify_whatsapp, true) and telefon is not null and n.channel <> 'email';
    boleh_emel := p_email and coalesce(c.notify_email, true) and coalesce(emel, '') ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
                  and (n.bypass_limit or notify_email_allowed(emel));

    if boleh_wa then
      ok := n.company_id is null or n.bypass_limit or bump_usage(n.company_id, 'wa');
      if not ok then
        boleh_wa := false;
        if not coalesce((select wa_limit_notified from usage_counters u where u.company_id = n.company_id and u.month = m), false) then
          update usage_counters set wa_limit_notified = true where usage_counters.company_id = n.company_id and month = m;
          for a in select r.person_id from user_roles r where r.company_id = n.company_id and r.role = 'admin' loop
            insert into notifications(company_id, person_id, channel, to_address, message, bypass_limit)
            select n.company_id, x.id, 'whatsapp', x.phone_whatsapp,
                   'Makluman HRBoost: had mesej WhatsApp bulan ini untuk syarikat anda telah habis. '
                   || 'Notifikasi seterusnya tidak dihantar sehingga bulan hadapan. Hubungi HRBoost untuk menambah had.',
                   true
              from persons x where x.id = a.person_id and x.is_active;
          end loop;
        end if;
      end if;
    end if;

    if boleh_wa then
      update notifications set channel = 'whatsapp', to_address = telefon, claimed_at = now(), attempts = attempts + 1 where notifications.id = n.id;
      id := n.id; channel := 'whatsapp'; to_address := telefon;
    elsif boleh_emel then
      update notifications set channel = 'email', to_address = emel, claimed_at = now(), attempts = attempts + 1 where notifications.id = n.id;
      id := n.id; channel := 'email'; to_address := emel;
    else
      update notifications set status = 'skipped',
             error = case when ok is false then 'Had WhatsApp bulanan syarikat telah habis'
                          when p_email and emel is not null and not notify_email_allowed(emel) then 'Bukan dalam senarai e-mel dibenarkan (staging) — dalam aplikasi sahaja'
                          else 'Tiada saluran luar — dipaparkan dalam aplikasi sahaja' end
       where notifications.id = n.id;
      ok := null;
      continue;
    end if;
    ok := null;
    message := n.message; company_id := n.company_id; language := coalesce(ps.language, 'en');
    return next;
  end loop;
end $$;

create or replace function invite_contact(p_employment uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare e employments; p persons; c companies;
begin
  select * into e from employments where id = p_employment;
  if e.id is null or not has_role(e.company_id, '{hr,admin}') then raise exception 'Hanya HR/Admin'; end if;
  select * into p from persons where id = e.person_id;
  select * into c from companies where id = e.company_id;
  return jsonb_build_object('name', coalesce(p.preferred_name, p.full_name), 'email', p.email, 'phone', p.phone_whatsapp,
                            'language', p.language, 'company', c.name);
end $$;

create or replace function invite_send(p_employment uuid, p_base_url text, p_channel text default 'auto') returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare tok text; e employments; p persons; c companies; url text; mesej text;
begin
  if p_channel not in ('auto', 'email', 'whatsapp', 'link') then raise exception 'Saluran jemputan tidak sah'; end if;
  select * into e from employments where id = p_employment;
  if e.id is null or not has_role(e.company_id, '{hr,admin}') then raise exception 'Hanya HR/Admin'; end if;
  if e.status not in ('probation','active') then raise exception 'Pekerjaan ini telah tamat'; end if;
  select * into p from persons where id = e.person_id;
  if p.auth_user_id is not null and exists (select 1 from onboarding_progress where employment_id = e.id and step = 'activate') then
    raise exception 'Pekerja ini sudah aktif';
  end if;
  if p_channel = 'email' and coalesce(p.email, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Pekerja ini tiada alamat e-mel. Isi e-mel di profil pekerja dahulu.';
  end if;
  if p_channel = 'whatsapp' and p.phone_whatsapp is null then
    raise exception 'Pekerja ini tiada nombor WhatsApp. Isi nombor di profil pekerja dahulu.';
  end if;
  select * into c from companies where id = e.company_id;
  if p_base_url !~ '^https?://[^\s/]+' then raise exception 'Alamat aplikasi tidak sah'; end if;
  tok := create_invite(p_employment);
  url := rtrim(p_base_url, '/') || '/jemputan/' || tok;
  mesej := 'Assalamualaikum ' || coalesce(p.preferred_name, p.full_name) || ', anda dijemput menyertai ' || c.name ||
           ' di HRBoost. Buka pautan ini dan sahkan 4 digit akhir kad pengenalan anda: ' || url || ' (sah selama 7 hari)';
  if p_channel in ('auto', 'whatsapp') then
    insert into notifications(company_id, person_id, channel, to_address, message, bypass_limit)
    values (e.company_id, p.id, 'whatsapp', p.phone_whatsapp, mesej, true);
  elsif p_channel = 'email' then
    insert into notifications(company_id, person_id, channel, to_address, message, bypass_limit)
    values (e.company_id, p.id, 'email', p.email, mesej, true);
  end if;
  return jsonb_build_object('token', tok, 'url', url, 'email', p.email, 'phone', p.phone_whatsapp);
end $$;

do $$
declare f text;
begin
  foreach f in array array['invite_contact(uuid)', 'invite_send(uuid,text,text)'] loop
    execute 'revoke all on function ' || f || ' from public';
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute 'revoke all on function ' || f || ' from anon';
      execute 'grant execute on function ' || f || ' to authenticated';
    end if;
  end loop;
end $$;
