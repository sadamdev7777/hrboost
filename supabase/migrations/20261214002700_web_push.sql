-- =====================================================================
--  Notifikasi telefon (Web Push) untuk aplikasi HRBoost yang dipasang (PWA)
--  - push_subscriptions: satu baris bagi setiap peranti / pelayar yang menghidupkan notifikasi
--  - push_next(): notify-sender mengambil notifikasi untuk dihantar sebagai push (saluran TAMBAHAN;
--    WhatsApp / e-mel / loceng dalam aplikasi tidak berubah). Hanya notifikasi selepas peranti dilanggan
--    dan < 3 hari, setiap notifikasi sekali sahaja.
--  - Kunci VAPID dijana sekali oleh notify-sender di pelayan: kunci awam dalam platform_settings.push,
--    kunci peribadi dalam Vault (platform_secrets 'vapid_private_key'). Tidak pernah keluar dari pelayan.
--  - Baiki: platform_secrets kini menerima kunci CHIP (dahulu hanya resend_api_key).
-- =====================================================================

alter table platform_secrets drop constraint if exists platform_secrets_name_check;
alter table platform_secrets add constraint platform_secrets_name_check
  check (name in ('resend_api_key', 'chip_secret_key', 'chip_brand_id', 'vapid_private_key'));

create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references persons(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_ok_at  timestamptz,
  failures    int not null default 0
);
create index if not exists push_subscriptions_person_idx on push_subscriptions(person_id);
alter table push_subscriptions enable row level security;
-- Tiada polisi: akses melalui RPC sahaja

alter table notifications add column if not exists push_sent_at timestamptz;

-- ---------------------------------------------------------------- Pengguna
create or replace function push_public_key() returns text
language sql stable security definer set search_path = public as $$
  select value->>'vapid_public' from platform_settings where key = 'push'
$$;

create or replace function push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_ua text default null) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := current_person_id();
begin
  if me is null then raise exception 'Sila log masuk dahulu'; end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'Langganan notifikasi tidak sah';
  end if;
  -- Peranti yang sama kini milik pengguna ini (cth. log masuk akaun lain pada telefon yang sama)
  insert into push_subscriptions(person_id, endpoint, p256dh, auth, user_agent)
  values (me, p_endpoint, p_p256dh, p_auth, left(p_ua, 300))
  on conflict (endpoint) do update set person_id = excluded.person_id, p256dh = excluded.p256dh, auth = excluded.auth,
                                       user_agent = excluded.user_agent, failures = 0,
                                       created_at = case when push_subscriptions.person_id = excluded.person_id
                                                         then push_subscriptions.created_at else now() end;
end $$;

create or replace function push_unsubscribe(p_endpoint text) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from push_subscriptions where endpoint = p_endpoint and person_id = current_person_id();
end $$;

-- Status peranti ini (endpoint) & bilangan peranti pengguna
create or replace function push_status(p_endpoint text default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'available', push_public_key() is not null,
    'this_device', p_endpoint is not null and exists (select 1 from push_subscriptions s where s.endpoint = p_endpoint and s.person_id = current_person_id()),
    'devices', (select count(*) from push_subscriptions s where s.person_id = current_person_id()))
$$;

-- ---------------------------------------------------------------- notify-sender (service role)
create or replace function push_vapid() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_service_role() then raise exception 'Tidak dibenarkan'; end if;
  return jsonb_build_object('public', push_public_key(), 'private', platform_secret_get('vapid_private_key'),
                            'subject', coalesce((select value->>'subject' from platform_settings where key = 'push'), 'mailto:admin@hrboost.io'));
end $$;

-- Simpan kunci VAPID yang dijana (sekali sahaja; tidak menulis ganti kunci sedia ada)
create or replace function push_vapid_init(p_public text, p_private text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not is_service_role() then raise exception 'Tidak dibenarkan'; end if;
  perform pg_advisory_xact_lock(hashtext('push_vapid_init'));
  if push_public_key() is not null then return false; end if;
  if p_public !~ '^[A-Za-z0-9_-]{80,100}$' or p_private !~ '^[A-Za-z0-9_-]{40,50}$' then raise exception 'Kunci VAPID tidak sah'; end if;
  if exists (select 1 from pg_namespace where nspname = 'vault') then
    execute 'select vault.create_secret($1, $2)' into v using p_private, 'hrboost:platform:vapid_private_key';
    insert into platform_secrets(name, vault_id, secret, hint) values ('vapid_private_key', v, null, right(p_private, 4))
    on conflict (name) do update set vault_id = excluded.vault_id, secret = null, hint = excluded.hint, updated_at = now();
  else
    insert into platform_secrets(name, secret, hint) values ('vapid_private_key', p_private, right(p_private, 4))
    on conflict (name) do update set secret = excluded.secret, hint = excluded.hint, updated_at = now();
  end if;
  insert into platform_settings(key, value) values ('push', jsonb_build_object('vapid_public', p_public))
  on conflict (key) do update set value = platform_settings.value || jsonb_build_object('vapid_public', p_public);
  return true;
end $$;

-- Notifikasi seterusnya untuk push: satu baris bagi setiap (notifikasi, peranti)
create or replace function push_next(p_limit int default 50)
returns table(notification_id uuid, endpoint text, p256dh text, auth text, message text, language text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare ids uuid[];
begin
  if not is_service_role() then raise exception 'Tidak dibenarkan'; end if;
  select array_agg(x.id) into ids from (
    select n.id from notifications n
     where n.push_sent_at is null
       and n.created_at > now() - interval '3 days'
       and (n.send_after is null or n.send_after <= now())
       and exists (select 1 from push_subscriptions s where s.person_id = n.person_id and s.created_at <= n.created_at)
     order by n.created_at
     limit p_limit
     for update skip locked) x;
  if ids is null then return; end if;
  update notifications set push_sent_at = now() where id = any(ids);
  return query
    select n.id, s.endpoint, s.p256dh, s.auth, n.message, coalesce(p.language, 'en')
      from notifications n
      join push_subscriptions s on s.person_id = n.person_id and s.created_at <= n.created_at
      join persons p on p.id = n.person_id
     where n.id = any(ids)
     order by n.created_at;
end $$;

-- Keputusan hantar: 404/410 (langganan tamat) → padam; gagal 5 kali berturut → padam
create or replace function push_mark(p_endpoint text, p_ok boolean, p_gone boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_service_role() then raise exception 'Tidak dibenarkan'; end if;
  if p_gone then
    delete from push_subscriptions where endpoint = p_endpoint;
  elsif p_ok then
    update push_subscriptions set last_ok_at = now(), failures = 0 where endpoint = p_endpoint;
  else
    update push_subscriptions set failures = failures + 1 where endpoint = p_endpoint;
    delete from push_subscriptions where endpoint = p_endpoint and failures >= 5;
  end if;
end $$;

-- ---------------------------------------------------------------- Pentadbir Platform (agregat sahaja)
create or replace function sa_push_overview() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when is_superadmin() then jsonb_build_object(
    'vapid', push_public_key() is not null,
    'devices', (select count(*) from push_subscriptions),
    'people', (select count(distinct person_id) from push_subscriptions),
    'sent_24h', (select count(*) from notifications where push_sent_at > now() - interval '1 day')) end
$$;

-- sa_platform_secrets: kunci VAPID tidak disenaraikan (dijana & diurus oleh sistem)

-- ---------------------------------------------------------------- Kebenaran
do $$
declare f text;
begin
  foreach f in array array['push_vapid()', 'push_vapid_init(text,text)', 'push_next(integer)', 'push_mark(text,boolean,boolean)'] loop
    execute 'revoke all on function ' || f || ' from public';
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute 'revoke all on function ' || f || ' from anon, authenticated';
      execute 'grant execute on function ' || f || ' to service_role';
    end if;
  end loop;
  foreach f in array array['push_subscribe(text,text,text,text)', 'push_unsubscribe(text)', 'push_status(text)', 'sa_push_overview()'] loop
    execute 'revoke all on function ' || f || ' from public';
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute 'revoke all on function ' || f || ' from anon';
      execute 'grant execute on function ' || f || ' to authenticated';
    end if;
  end loop;
  execute 'revoke all on function push_public_key() from public';
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function push_public_key() to anon, authenticated';
  end if;
end $$;
