-- =====================================================================
--  Log masuk dengan e-mel & kata laluan
--  • Kali pertama: OTP WhatsApp (sahkan nombor). Selepas itu pengguna WAJIB
--    menetapkan e-mel + kata laluan (skrin /akaun/kata-laluan) sebelum
--    menggunakan aplikasi. E-mel tidak perlu disahkan (telefon sudah disahkan).
--  • Lupa kata laluan: pautan e-mel (Edge Function password-reset, Resend)
--    + 4 digit akhir kad pengenalan, had 5 cubaan, sah 1 jam, guna sekali.
--    Token disimpan sebagai cincangan SHA-256 sahaja.
--  Lajur auth.users dibaca melalui SQL dinamik supaya stub ujian tempatan
--  (auth.users hanya ada id) masih boleh dimuatkan.
-- =====================================================================

create table password_resets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  attempts    int not null default 0,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index on password_resets(user_id, created_at);
alter table password_resets enable row level security;   -- tiada polisi: service role sahaja
revoke all on password_resets from anon, authenticated;

-- ---------------------------------------------------------------------
--  Status log masuk pengguna semasa: sudah ada kata laluan & e-mel?
-- ---------------------------------------------------------------------
create or replace function my_login_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if auth.uid() is null then return null; end if;
  begin
    execute 'select jsonb_build_object(''has_password'', coalesce(encrypted_password, '''') <> '''' and coalesce(email, '''') <> '''',
                                       ''email'', email)
               from auth.users where id = $1'
      into v using auth.uid();
  exception when undefined_column then
    v := jsonb_build_object('has_password', true, 'email', null);  -- stub ujian tempatan
  end;
  return coalesce(v, jsonb_build_object('has_password', false, 'email', null));
end $$;

-- Tetapkan / tukar e-mel log masuk TANPA e-mel pengesahan (nombor telefon sudah disahkan
-- melalui OTP). updateUser({email}) di klien sentiasa menghantar e-mel pengesahan, jadi
-- e-mel ditulis di sini; kata laluan pula ditukar melalui Supabase Auth (updateUser).
create or replace function set_my_login_email(p_email text)
returns text language plpgsql security definer set search_path = public as $$
declare em text := lower(trim(coalesce(p_email, ''))); uid uuid := auth.uid(); ada boolean;
begin
  if uid is null then raise exception 'Sila log masuk'; end if;
  if em !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(em) > 254 then
    raise exception 'Alamat e-mel tidak sah' using errcode = '22023';
  end if;
  if not exists (select 1 from persons where auth_user_id = uid and is_active) then
    raise exception 'Akaun tidak aktif';
  end if;
  begin
    execute 'select exists(select 1 from auth.users where lower(email) = $1 and id <> $2)' into ada using em, uid;
  exception when undefined_column then
    return em;  -- stub ujian tempatan
  end;
  if ada then raise exception 'E-mel ini telah digunakan oleh akaun lain' using errcode = '23505'; end if;
  execute 'update auth.users set email = $1, email_confirmed_at = coalesce(email_confirmed_at, now()),
                                 email_change = '''', email_change_token_new = '''', email_change_token_current = '''',
                                 raw_app_meta_data = jsonb_set(coalesce(raw_app_meta_data, ''{}''), ''{providers}'',
                                   (select coalesce(jsonb_agg(distinct x), ''[]'') from jsonb_array_elements_text(
                                      coalesce(raw_app_meta_data->''providers'', ''[]'') || ''["email"]'') x)),
                                 updated_at = now()
            where id = $2' using em, uid;
  execute 'insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
           values (gen_random_uuid(), $2, $2::text, ''email'',
                   jsonb_build_object(''sub'', $2::text, ''email'', $1, ''email_verified'', true), now(), now(), now())
           on conflict (provider_id, provider) do update
             set identity_data = excluded.identity_data, updated_at = now()' using em, uid;
  update persons set email = em where auth_user_id = uid;
  return em;
end $$;

-- ---------------------------------------------------------------------
--  Lupa kata laluan (service role sahaja — dipanggil oleh password-reset)
-- ---------------------------------------------------------------------
-- Cipta token. Tiada baris dipulangkan jika e-mel tiada / pengguna dinyahaktif /
-- melebihi 3 permintaan sejam (fungsi tetap membalas "jika e-mel wujud…").
create or replace function password_reset_create(p_email text)
returns table(token text, name text, email text)
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid; em text; nm text; n int; tok text;
begin
  if coalesce(trim(p_email), '') = '' then return; end if;
  execute 'select id, email from auth.users
             where lower(email) = lower(trim($1)) and coalesce(encrypted_password, '''') <> ''''
             limit 1'
    into uid, em using p_email;
  if uid is null then return; end if;
  select coalesce(p.preferred_name, p.full_name) into nm from persons p where p.auth_user_id = uid and p.is_active;
  if nm is null then return; end if;
  select count(*) into n from password_resets r where r.user_id = uid and r.created_at > now() - interval '1 hour';
  if n >= 3 then return; end if;
  tok := encode(gen_random_bytes(32), 'hex');
  insert into password_resets(user_id, token_hash, expires_at)
  values (uid, encode(digest(tok, 'sha256'), 'hex'), now() + interval '1 hour');
  return query select tok, nm, em;
end $$;

-- Semak token + 4 digit akhir IC. Tidak menanda token sebagai digunakan
-- (password_reset_finish berbuat demikian selepas kata laluan berjaya ditukar).
create or replace function password_reset_check(p_token text, p_ic_last4 text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r password_resets; ic text;
begin
  select * into r from password_resets where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') for update;
  if not found or r.used_at is not null or r.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'Pautan tidak sah atau telah tamat tempoh. Sila minta pautan baharu.');
  end if;
  if r.attempts >= 5 then
    return jsonb_build_object('ok', false, 'error', 'Terlalu banyak cubaan. Sila minta pautan baharu.');
  end if;
  select regexp_replace(coalesce(p.ic_no, ''), '\D', '', 'g') into ic from persons p where p.auth_user_id = r.user_id and p.is_active;
  if coalesce(ic, '') = '' then
    return jsonb_build_object('ok', false, 'code', 'tiada_ic',
      'error', 'Tiada nombor kad pengenalan dalam rekod anda. Sila log masuk dengan kod WhatsApp, kemudian tukar kata laluan di Profil.');
  end if;
  if right(ic, 4) <> coalesce(p_ic_last4, '') then
    update password_resets set attempts = attempts + 1 where id = r.id;
    return jsonb_build_object('ok', false, 'attempts_left', 4 - r.attempts,
      'error', '4 digit akhir kad pengenalan tidak sepadan');
  end if;
  return jsonb_build_object('ok', true, 'user_id', r.user_id);
end $$;

-- Tanda token digunakan, batalkan semua token lain & tamatkan semua sesi pengguna itu.
create or replace function password_reset_finish(p_token text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid;
begin
  update password_resets set used_at = now()
   where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') and used_at is null
  returning user_id into uid;
  if uid is null then return; end if;
  update password_resets set used_at = now() where user_id = uid and used_at is null;
  begin
    execute 'delete from auth.refresh_tokens where user_id = $1::text' using uid;
    execute 'delete from auth.sessions where user_id = $1' using uid;
  exception when undefined_table then null;   -- stub ujian tempatan
  end;
end $$;

revoke all on function my_login_status() from public, anon;
grant execute on function my_login_status() to authenticated;
revoke all on function set_my_login_email(text) from public, anon;
grant execute on function set_my_login_email(text) to authenticated;
revoke all on function password_reset_create(text) from public, anon, authenticated;
revoke all on function password_reset_check(text, text) from public, anon, authenticated;
revoke all on function password_reset_finish(text) from public, anon, authenticated;
grant execute on function password_reset_create(text) to service_role;
grant execute on function password_reset_check(text, text) to service_role;
grant execute on function password_reset_finish(text) to service_role;
