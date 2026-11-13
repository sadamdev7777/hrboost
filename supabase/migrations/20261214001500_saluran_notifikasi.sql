-- =====================================================================
--  Saluran notifikasi: WhatsApp (Murpati) kini PILIHAN.
--  - Setiap notifikasi sentiasa tersimpan dan dipaparkan pada loceng dalam aplikasi.
--  - notify-sender menghantar melalui WhatsApp jika Murpati dikonfigurasi DAN syarikat membenarkan,
--    jika tidak melalui e-mel (Resend) jika dikonfigurasi DAN syarikat membenarkan; jika tiada saluran,
--    notifikasi ditanda 'skipped' (dalam aplikasi sahaja) supaya tiada longgokan lama dihantar kemudian.
--  - Keadaan saluran platform dilaporkan oleh notify-sender (notify_set_channels) setiap kali ia berjalan.
-- =====================================================================

alter table companies add column if not exists notify_whatsapp boolean not null default true;
alter table companies add column if not exists notify_email boolean not null default true;

-- notify-sender (service role): saluran yang dikonfigurasi pada platform
create or replace function notify_set_channels(p_wa boolean, p_email boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_service_role() then raise exception 'Tidak dibenarkan'; end if;
  insert into platform_settings(key, value)
  values ('notify_channels', jsonb_build_object('whatsapp', coalesce(p_wa, false), 'email', coalesce(p_email, false), 'checked_at', now()))
  on conflict (key) do update set value = excluded.value;
end $$;

-- Ahli syarikat: saluran yang aktif (untuk teks & butang dalam aplikasi)
create or replace function notify_channels(p_company uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when is_company_member(p_company) or has_role(p_company, '{hr,finance,ceo,admin}') then
    jsonb_build_object(
      'whatsapp_ready', coalesce((s.value->>'whatsapp')::boolean, false),
      'email_ready', coalesce((s.value->>'email')::boolean, false),
      'company_whatsapp', c.notify_whatsapp,
      'company_email', c.notify_email,
      'whatsapp', coalesce((s.value->>'whatsapp')::boolean, false) and c.notify_whatsapp,
      'email', coalesce((s.value->>'email')::boolean, false) and c.notify_email)
  end
  from companies c left join platform_settings s on s.key = 'notify_channels'
  where c.id = p_company
$$;

-- HR / Pentadbir: hidup / matikan saluran untuk syarikat
create or replace function set_notify_channels(p_company uuid, p_wa boolean, p_email boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Hanya HR/Pentadbir'; end if;
  update companies set notify_whatsapp = coalesce(p_wa, notify_whatsapp), notify_email = coalesce(p_email, notify_email) where id = p_company;
end $$;

-- Giliran penghantaran: pilih saluran bagi setiap notifikasi (WhatsApp → e-mel → dalam aplikasi sahaja)
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
    -- Notifikasi lama (cth. tertunggak sebelum saluran disambung) tidak dihantar
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
    boleh_emel := p_email and coalesce(c.notify_email, true) and coalesce(emel, '') ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';

    if boleh_wa then
      ok := n.company_id is null or n.bypass_limit or bump_usage(n.company_id, 'wa');
      if not ok then
        boleh_wa := false;
        -- Maklum Pentadbir sekali sebulan (seperti sebelum ini)
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
             error = case when ok is false then 'Had WhatsApp bulanan syarikat telah habis' else 'Tiada saluran luar — dipaparkan dalam aplikasi sahaja' end
       where notifications.id = n.id;
      ok := null;
      continue;
    end if;
    ok := null;
    message := n.message; company_id := n.company_id; language := coalesce(ps.language, 'en');
    return next;
  end loop;
end $$;

-- Pemohon / HR: pelulus semasa bagi permohonan yang masih menunggu (untuk butang WhatsApp "Ingatkan pelulus")
create or replace function approval_current_approvers(p_request uuid)
returns table(person_id uuid, name text, phone text, language text)
language plpgsql stable security definer set search_path = public as $$
declare r approval_requests; pemohon uuid;
begin
  select * into r from approval_requests where id = p_request;
  if r.id is null then raise exception 'Permohonan tidak dijumpai'; end if;
  select e.person_id into pemohon from employments e where e.id = r.requester_employment_id;
  if pemohon is distinct from current_person_id() and not has_role(r.company_id, '{hr,ceo,admin}') then
    raise exception 'Tidak dibenarkan';
  end if;
  if r.status <> 'pending' then return; end if;
  return query
    select distinct p.id, coalesce(p.preferred_name, p.full_name), p.phone_whatsapp, coalesce(p.language, 'en')
      from approval_tasks t join persons p on p.id = t.approver_person_id
     where t.request_id = r.id and t.status = 'pending' and p.is_active;
end $$;

do $$
declare f text;
begin
  foreach f in array array['notify_channels(uuid)','set_notify_channels(uuid,boolean,boolean)','approval_current_approvers(uuid)'] loop
    execute 'revoke all on function ' || f || ' from public';
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute 'revoke all on function ' || f || ' from anon';
      execute 'grant execute on function ' || f || ' to authenticated';
    end if;
  end loop;
  foreach f in array array['notify_set_channels(boolean,boolean)','notify_next2(int,boolean,boolean)'] loop
    execute 'revoke all on function ' || f || ' from public';
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute 'revoke all on function ' || f || ' from anon, authenticated';
      execute 'grant execute on function ' || f || ' to service_role';
    end if;
  end loop;
end $$;

-- Jemputan pukal: jika WhatsApp tidak aktif untuk syarikat, pulangkan pautan bagi SEMUA pekerja
-- (HR menghantar sendiri dengan butang WhatsApp / salin pautan). Tambah no. telefon untuk butang wa.me.
drop function if exists invite_pending(uuid, text, timestamptz);
create function invite_pending(p_company uuid, p_base_url text, p_send_after timestamptz default null)
returns table(employment_id uuid, name text, has_whatsapp boolean, token text, phone text, language text)
language plpgsql security definer set search_path = public as $$
declare e record; tok text; wa boolean;
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Hanya HR/Pentadbir'; end if;
  wa := coalesce((notify_channels(p_company)->>'whatsapp')::boolean, false);
  for e in select em.id, coalesce(p.preferred_name, p.full_name) nm, p.phone_whatsapp, p.id pid, coalesce(p.language, 'en') lang
             from employments em join persons p on p.id = em.person_id
            where em.company_id = p_company and em.status in ('probation','active') and p.auth_user_id is null
            order by em.employee_no loop
    tok := invite_employee(e.id, p_base_url);
    if p_send_after is not null then
      update notifications set send_after = p_send_after
       where person_id = e.pid and status = 'pending' and message like '%/jemputan/%' and created_at > now() - interval '1 minute';
    end if;
    employment_id := e.id; name := e.nm; phone := e.phone_whatsapp; language := e.lang;
    has_whatsapp := wa and e.phone_whatsapp is not null;          -- dihantar automatik oleh sistem
    token := case when not has_whatsapp then tok end;              -- pautan untuk HR hantar sendiri
    return next;
  end loop;
  insert into company_onboarding_progress(company_id, step) values (p_company, 'invite') on conflict do nothing;
  if (select count(*) from company_onboarding_progress where company_id = p_company) >= 6 then
    update companies set onboarding_completed_at = coalesce(onboarding_completed_at, now()) where id = p_company;
  end if;
end $$;
do $$ begin
  revoke all on function invite_pending(uuid, text, timestamptz) from public;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function invite_pending(uuid, text, timestamptz) from anon;
    grant execute on function invite_pending(uuid, text, timestamptz) to authenticated, service_role;
  end if;
end $$;
