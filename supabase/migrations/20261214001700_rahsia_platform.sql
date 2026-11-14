-- =====================================================================
--  Rahsia platform dalam Vault, diisi oleh Pentadbir Platform melalui /admin/tetapan
--  (cth. kunci API Resend untuk e-mel notifikasi). Nilai tidak pernah dipulangkan ke pelayar:
--  hanya status "ditetapkan / belum" + 4 aksara akhir. Edge Function membaca melalui
--  platform_secret_get() (service role sahaja). Pembolehubah persekitaran Edge Function
--  (cth. RESEND_API_KEY) masih diutamakan jika ditetapkan.
-- =====================================================================

create table if not exists platform_secrets (
  name       text primary key check (name in ('resend_api_key')),
  vault_id   uuid,
  secret     text,                 -- hanya jika Vault tiada (ujian tempatan)
  hint       text,                 -- 4 aksara akhir untuk paparan
  updated_by uuid references persons(id),
  updated_at timestamptz not null default now()
);
alter table platform_secrets enable row level security;   -- tiada polisi: akses melalui RPC sahaja

create or replace function sa_platform_secret_set(p_name text, p_value text) returns void
language plpgsql security definer set search_path = public as $$
declare v uuid; nilai text := trim(coalesce(p_value, ''));
begin
  if not is_superadmin() then raise exception 'Hanya superadmin'; end if;
  if p_name not in ('resend_api_key') then raise exception 'Rahsia tidak dikenali'; end if;
  if p_name = 'resend_api_key' and nilai !~ '^re_[A-Za-z0-9_]{16,}$' then
    raise exception 'Kunci Resend tidak sah (mesti bermula dengan re_)';
  end if;
  select vault_id into v from platform_secrets where name = p_name;
  if exists (select 1 from pg_namespace where nspname = 'vault') then
    if v is null then
      execute 'select vault.create_secret($1, $2)' into v using nilai, 'hrboost:platform:' || p_name;
    else
      execute 'select vault.update_secret($1, $2)' using v, nilai;
    end if;
    insert into platform_secrets(name, vault_id, secret, hint, updated_by, updated_at)
    values (p_name, v, null, right(nilai, 4), current_person_id(), now())
    on conflict (name) do update set vault_id = excluded.vault_id, secret = null, hint = excluded.hint,
                                     updated_by = excluded.updated_by, updated_at = now();
  else
    insert into platform_secrets(name, secret, hint, updated_by, updated_at)
    values (p_name, nilai, right(nilai, 4), current_person_id(), now())
    on conflict (name) do update set secret = excluded.secret, hint = excluded.hint, updated_by = excluded.updated_by, updated_at = now();
  end if;
  perform log_platform('platform.secret_set', null, 'platform_secret', null, jsonb_build_object('name', p_name));
end $$;

create or replace function sa_platform_secret_clear(p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not is_superadmin() then raise exception 'Hanya superadmin'; end if;
  delete from platform_secrets where name = p_name returning vault_id into v;
  if v is not null then execute 'delete from vault.secrets where id = $1' using v; end if;
  perform log_platform('platform.secret_clear', null, 'platform_secret', null, jsonb_build_object('name', p_name));
end $$;

-- Status sahaja (tiada nilai)
create or replace function sa_platform_secrets() returns table(name text, is_set boolean, hint text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select n, s.name is not null, s.hint, s.updated_at
    from unnest(array['resend_api_key']) n left join platform_secrets s on s.name = n
   where is_superadmin()
$$;

-- Edge Function (service role) sahaja
create or replace function platform_secret_get(p_name text) returns text
language plpgsql stable security definer set search_path = public as $$
declare r platform_secrets; s text;
begin
  if not is_service_role() then raise exception 'Tidak dibenarkan'; end if;
  select * into r from platform_secrets where name = p_name;
  if r.vault_id is not null then
    execute 'select decrypted_secret from vault.decrypted_secrets where id = $1' into s using r.vault_id;
    return s;
  end if;
  return r.secret;
end $$;

do $$
declare f text;
begin
  foreach f in array array['sa_platform_secret_set(text,text)','sa_platform_secret_clear(text)','sa_platform_secrets()'] loop
    execute 'revoke all on function ' || f || ' from public';
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute 'revoke all on function ' || f || ' from anon';
      execute 'grant execute on function ' || f || ' to authenticated';
    end if;
  end loop;
  execute 'revoke all on function platform_secret_get(text) from public';
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function platform_secret_get(text) from anon, authenticated';
    execute 'grant execute on function platform_secret_get(text) to service_role';
  end if;
end $$;

-- Senarai e-mel dibenarkan (staging): kosong = semua dibenarkan
create or replace function sa_set_email_allowlist(p_emails text[]) returns void
language plpgsql security definer set search_path = public as $$
declare bersih jsonb;
begin
  if not is_superadmin() then raise exception 'Hanya superadmin'; end if;
  select coalesce(jsonb_agg(distinct lower(trim(e))), '[]'::jsonb) into bersih
    from unnest(coalesce(p_emails, '{}')) e where trim(e) ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';
  if jsonb_array_length(bersih) = 0 then
    delete from platform_settings where key = 'email_allowlist';
  else
    insert into platform_settings(key, value) values ('email_allowlist', bersih)
    on conflict (key) do update set value = excluded.value;
  end if;
  perform log_platform('platform.email_allowlist', null, 'platform_setting', null, jsonb_build_object('count', jsonb_array_length(bersih)));
end $$;

-- E-mel ujian kepada Pentadbir Platform sendiri (dihantar oleh notify-sender dalam ±1 minit)
create or replace function sa_test_email() returns text
language plpgsql security definer set search_path = public as $$
declare p persons;
begin
  if not is_superadmin() then raise exception 'Hanya superadmin'; end if;
  select * into p from persons where id = current_person_id();
  if coalesce(p.email, '') = '' then raise exception 'Akaun anda tiada alamat e-mel'; end if;
  insert into notifications(company_id, person_id, channel, to_address, message, bypass_limit)
  values (null, p.id, 'email', p.email,
          'Ujian e-mel HRBoost: jika anda menerima mesej ini, notifikasi e-mel berfungsi dengan baik.', true);
  return p.email;
end $$;

insert into message_i18n(kind, ms, en, sort) values
  ('message', $q$^Ujian e-mel HRBoost: jika anda menerima mesej ini, notifikasi e-mel berfungsi dengan baik\.$$q$,
              $q$HRBoost email test: if you received this message, email notifications are working.$q$, 660)
on conflict (kind, ms) do nothing;

do $$
declare f text;
begin
  foreach f in array array['sa_set_email_allowlist(text[])','sa_test_email()'] loop
    execute 'revoke all on function ' || f || ' from public';
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute 'revoke all on function ' || f || ' from anon';
      execute 'grant execute on function ' || f || ' to authenticated';
    end if;
  end loop;
end $$;
