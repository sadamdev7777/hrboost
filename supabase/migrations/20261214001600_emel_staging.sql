-- =====================================================================
--  E-mel notifikasi: senarai dibenarkan (staging) & kunci jadual dalaman
--  - platform_settings 'email_allowlist' (jsonb array e-mel huruf kecil): jika ditetapkan dan tidak kosong,
--    hanya alamat dalam senarai menerima e-mel; orang lain = dalam aplikasi sahaja. Tiada kunci = semua dibenarkan.
--    Untuk staging yang mengandungi data pekerja sebenar.
--  - notify_cron_check(rahsia): pg_cron memanggil notify-sender dengan rahsia dalam Vault ('notify_cron_secret');
--    Edge Function menyemaknya melalui RPC ini (tiada kunci service role perlu disalin oleh manusia).
-- =====================================================================

create or replace function notify_email_allowed(p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when s.value is null or jsonb_typeof(s.value) <> 'array' or jsonb_array_length(s.value) = 0 then true
    else exists (select 1 from jsonb_array_elements_text(s.value) e where lower(e) = lower(trim(p_email)))
  end
  from (select (select value from platform_settings where key = 'email_allowlist') as value) s
$$;

-- notify_next2: tambah semakan senarai dibenarkan bagi e-mel
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
                  and notify_email_allowed(emel);

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

-- Semak rahsia jadual (dipanggil oleh notify-sender dengan kunci service role)
create or replace function notify_cron_check(p_secret text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare s text;
begin
  if not is_service_role() then raise exception 'Tidak dibenarkan'; end if;
  begin
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into s using 'notify_cron_secret';
  exception when others then
    return false;
  end;
  return s is not null and p_secret is not null and length(p_secret) >= 32 and s = p_secret;
end $$;

do $$
declare f text;
begin
  foreach f in array array['notify_cron_check(text)','notify_email_allowed(text)'] loop
    execute 'revoke all on function ' || f || ' from public';
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute 'revoke all on function ' || f || ' from anon, authenticated';
      execute 'grant execute on function ' || f || ' to service_role';
    end if;
  end loop;
end $$;
