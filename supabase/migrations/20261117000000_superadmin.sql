-- =====================================================================
--  Fasa G (2): Pentadbir Platform (/admin). Agregat sahaja — tiada IC, gaji, MC atau dokumen
--  (CLAUDE.md §1.3). Semua tindakan direkod dalam platform_audit_log (tiada kemas kini/padam).
-- =====================================================================

insert into platform_settings(key, value) values ('maintenance_notice', 'null'), ('invite_template', 'null')
on conflict (key) do nothing;

-- Nombor telefon disorok: +60 1•-•••• 0004
create or replace function mask_phone(p text) returns text language sql immutable as $$
  select case when p is null then null else '+60 ' || substr(regexp_replace(p, '^60', ''), 1, 1) || '•-•••• ' || right(p, 4) end
$$;

-- ---------------------------------------------------------------------
-- Ringkasan platform (SA_Dashboard)
-- ---------------------------------------------------------------------
create or replace function sa_dashboard() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m date := date_trunc('month', now())::date; warn numeric := coalesce((platform_setting('warn_pct') #>> '{}')::numeric, 80);
        out jsonb;
begin
  if not is_superadmin() then raise exception 'Hanya Pentadbir Platform'; end if;
  select jsonb_build_object(
    'companies_active', (select count(*) from companies where status = 'active'),
    'companies_new_week', (select count(*) from companies where created_at > now() - interval '7 days'),
    'staff_active', (select count(*) from employments e join companies c on c.id = e.company_id and c.status = 'active'
                      where e.status in ('probation','active')),
    'staff_login_30d', (select count(distinct p.id) from persons p join auth.users u on u.id = p.auth_user_id
                         where u.last_sign_in_at > now() - interval '30 days'),
    'onboarding_incomplete', (select count(*) from companies where onboarding_completed_at is null and status = 'active'),
    'wa_month', (select coalesce(sum(wa_sent), 0) from usage_counters where month = m),
    'ai_month', (select coalesce(sum(ai_calls), 0) from usage_counters where month = m),
    'grants_pending', (select count(*) from company_access_grants where status = 'pending'),
    'attention', coalesce((select jsonb_agg(x order by x->>'since') from (
        select jsonb_build_object('company_id', c.id, 'name', c.name,
                 'issue', 'WhatsApp ' || round(u.wa_sent * 100.0 / lim) || '% daripada had', 'since', m) x
          from companies c join usage_counters u on u.company_id = c.id and u.month = m
          cross join lateral (select coalesce(c.wa_monthly_limit, (platform_setting('default_wa_limit') #>> '{}')::int) lim) l
         where l.lim > 0 and u.wa_sent * 100.0 / l.lim >= warn
        union all
        select jsonb_build_object('company_id', c.id, 'name', c.name,
                 'issue', 'Persediaan terhenti di langkah ' || (select count(*) from company_onboarding_progress o where o.company_id = c.id) + 1,
                 'since', (select max(done_at) from company_onboarding_progress o where o.company_id = c.id))
          from companies c
         where c.onboarding_completed_at is null and c.status = 'active'
           and (select max(done_at) from company_onboarding_progress o where o.company_id = c.id) < now() - interval '3 days'
        union all
        select jsonb_build_object('company_id', s.company_id, 'name', c.name, 'issue', 'Penyegerakan CrossChex gagal', 'since', s.updated_at)
          from integration_sync_state s join companies c on c.id = s.company_id
         where s.provider = 'crosschex' and s.last_error is not null
      ) q), '[]'),
    'top_usage', coalesce((select jsonb_agg(t) from (
        select c.id company_id, c.name, c.status,
               (select count(*) from employments e where e.company_id = c.id and e.status in ('probation','active')) staff,
               coalesce(u.wa_sent, 0) wa, coalesce(c.wa_monthly_limit, (platform_setting('default_wa_limit') #>> '{}')::int) wa_limit,
               coalesce(u.ai_calls, 0) ai
          from companies c left join usage_counters u on u.company_id = c.id and u.month = m
         order by coalesce(u.wa_sent, 0) + coalesce(u.ai_calls, 0) desc, c.created_at desc limit 8) t), '[]')
  ) into out;
  return out;
end $$;

-- ---------------------------------------------------------------------
-- Butiran satu syarikat (SA_SyarikatButiran)
-- ---------------------------------------------------------------------
create or replace function sa_company_detail(p_company uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m date := date_trunc('month', now())::date; out jsonb;
begin
  if not is_superadmin() then raise exception 'Hanya Pentadbir Platform'; end if;
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'code', c.code, 'reg_no', c.reg_no, 'status', c.status, 'size_band', c.size_band,
    'suspended_reason', c.suspended_reason, 'suspended_at', c.suspended_at, 'created_at', c.created_at,
    'onboarding_steps', (select count(*) from company_onboarding_progress o where o.company_id = c.id),
    'onboarding_completed_at', c.onboarding_completed_at,
    'staff_active', (select count(*) from employments e join persons p on p.id = e.person_id
                      where e.company_id = c.id and e.status in ('probation','active') and p.auth_user_id is not null),
    'staff_total', (select count(*) from employments e where e.company_id = c.id and e.status in ('probation','active')),
    'departments', (select count(*) from departments where company_id = c.id),
    'last_login', (select max(u.last_sign_in_at) from employments e join persons p on p.id = e.person_id
                    join auth.users u on u.id = p.auth_user_id where e.company_id = c.id),
    'wa_used', coalesce(u.wa_sent, 0), 'ai_used', coalesce(u.ai_calls, 0),
    'wa_limit', c.wa_monthly_limit, 'ai_limit', c.ai_monthly_limit,
    'wa_default', platform_setting('default_wa_limit'), 'ai_default', platform_setting('default_ai_limit'),
    'admins', coalesce((select jsonb_agg(jsonb_build_object('name', coalesce(p.preferred_name, p.full_name), 'roles', r.roles))
                 from (select person_id, array_agg(role order by role) roles from user_roles
                        where company_id = c.id and role in ('admin','hr','finance','ceo') group by person_id) r
                 join persons p on p.id = r.person_id), '[]')
  ) into out
  from companies c left join usage_counters u on u.company_id = c.id and u.month = m
  where c.id = p_company;
  return out;
end $$;

create or replace function sa_message_admins(p_company uuid, p_message text) returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; a record;
begin
  if not is_superadmin() then raise exception 'Hanya Pentadbir Platform'; end if;
  if coalesce(trim(p_message), '') = '' then raise exception 'Sila tulis mesej'; end if;
  for a in select distinct person_id from user_roles where company_id = p_company and role = 'admin' loop
    perform notify_person(a.person_id, p_company, 'Mesej daripada Pentadbir Platform HRBoost: ' || trim(p_message));
    n := n + 1;
  end loop;
  perform log_platform('company.message', p_company, 'company', p_company, jsonb_build_object('recipients', n));
  return n;
end $$;

-- ---------------------------------------------------------------------
-- Permohonan & akses aktif (SA_Akses)
-- ---------------------------------------------------------------------
create or replace function sa_access_grants() returns table(
  id uuid, who text, who_from text, role app_role, target_id uuid, target text, target_admins text,
  days int, reason text, status text, decided_at timestamptz, expires_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_superadmin() then raise exception 'Hanya Pentadbir Platform'; end if;
  return query
  select g.id, coalesce(p.preferred_name, p.full_name),
         (select string_agg(distinct coalesce(
             (select string_agg(case ur.role when 'hr' then 'HR' when 'ceo' then 'CEO' when 'admin' then 'Pentadbir' when 'finance' then 'Kewangan' end, ', ')
                from user_roles ur where ur.person_id = g.person_id and ur.company_id = c2.id and ur.role <> 'staff'), 'Pekerja') || ', ' || c2.code, '; ')
            from employments e2 join companies c2 on c2.id = e2.company_id
           where e2.person_id = g.person_id and e2.status in ('probation','active')),
         g.role, c.id, c.name,
         (select string_agg(coalesce(ap.preferred_name, ap.full_name), ', ') from user_roles r join persons ap on ap.id = r.person_id
           where r.company_id = c.id and r.role = 'admin'),
         g.days, g.reason, g.status, g.decided_at, g.expires_at, g.created_at
    from company_access_grants g join persons p on p.id = g.person_id join companies c on c.id = g.company_id
   where g.status = 'pending' or (g.status = 'approved' and (g.expires_at is null or g.expires_at > now()))
   order by g.status desc, g.created_at desc;
end $$;

-- ---------------------------------------------------------------------
-- Pengguna (SA_Pengguna): cari mengikut nama atau no. WhatsApp, tiada profil peribadi
-- ---------------------------------------------------------------------
create or replace function sa_users(p_query text) returns table(
  person_id uuid, name text, whatsapp text, companies text, last_sign_in timestamptz, active boolean, is_platform_admin boolean)
language plpgsql stable security definer set search_path = public as $$
declare q text := trim(coalesce(p_query, '')); d text := regexp_replace(coalesce(p_query, ''), '\D', '', 'g');
begin
  if not is_superadmin() then raise exception 'Hanya Pentadbir Platform'; end if;
  return query
  select p.id, coalesce(p.preferred_name, p.full_name), mask_phone(p.phone_whatsapp),
         (select string_agg(c.code || ' · ' || coalesce((select string_agg(case r.role when 'hr' then 'HR' when 'ceo' then 'CEO'
                   when 'admin' then 'Pentadbir' when 'finance' then 'Kewangan' end, ', ' order by r.role)
                   from user_roles r where r.person_id = p.id and r.company_id = c.id and r.role <> 'staff'), 'Pekerja'), '; ')
            from employments e join companies c on c.id = e.company_id
           where e.person_id = p.id and e.status in ('probation','active')),
         u.last_sign_in_at, p.is_active, exists (select 1 from platform_admins a where a.person_id = p.id)
    from persons p left join auth.users u on u.id = p.auth_user_id
   where q = '' or p.full_name ilike '%' || q || '%' or p.preferred_name ilike '%' || q || '%'
      or (length(d) >= 4 and p.phone_whatsapp like '%' || d || '%')
   order by u.last_sign_in_at desc nulls last
   limit 50;
end $$;

-- Paksa log keluar: batalkan semua sesi pengguna itu
create or replace function sa_force_logout(p_person uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not is_superadmin() then raise exception 'Hanya Pentadbir Platform'; end if;
  select auth_user_id into uid from persons where id = p_person;
  if uid is null then raise exception 'Pengguna belum mengaktifkan akaun'; end if;
  begin
    execute 'delete from auth.refresh_tokens where user_id = $1::text' using uid;
    execute 'delete from auth.sessions where user_id = $1' using uid;
  exception when insufficient_privilege or undefined_table then
    raise exception 'Sesi tidak dapat dibatalkan dari pangkalan data. Nyahaktifkan pengguna sebagai gantinya.';
  end;
  perform log_platform('person.force_logout', null, 'person', p_person, '{}');
end $$;

create or replace function sa_add_platform_admin(p_phone text) returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid; d text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if not is_superadmin() then raise exception 'Hanya Pentadbir Platform'; end if;
  d := case when d ~ '^0' then '6' || d when d ~ '^1' then '60' || d else d end;
  select id into pid from persons where phone_whatsapp = d and is_active;
  if pid is null then raise exception 'Tiada pengguna aktif dengan nombor ini'; end if;
  insert into platform_admins(person_id) values (pid) on conflict do nothing;
  perform log_platform('platform_admin.add', null, 'person', pid, '{}');
  return pid;
end $$;

-- ---------------------------------------------------------------------
-- Log audit (SA_Log): tindakan platform + akses data sensitif. Hanya baca.
-- ---------------------------------------------------------------------
create or replace function sa_audit_log(p_kind text default 'all', p_limit int default 200)
returns table(at timestamptz, actor text, kind text, action text, target text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_superadmin() then raise exception 'Hanya Pentadbir Platform'; end if;
  return query
  select * from (
    select l.created_at,
           coalesce(coalesce(p.preferred_name, p.full_name) ||
             case when exists (select 1 from platform_admins a where a.person_id = l.actor_person_id) then ' (pentadbir platform)' else '' end, 'Sistem'),
           case when l.action like 'grant.%' then 'access' else 'platform' end,
           l.action,
           concat_ws(' · ', c.name,
             case when l.target_type = 'person' then (select coalesce(t.preferred_name, t.full_name) from persons t where t.id = l.target_id) end,
             case when l.target_type = 'grant' then (select coalesce(t.preferred_name, t.full_name) || ' → ' || g.role || ' · ' || g.days || ' hari'
                                                      from company_access_grants g join persons t on t.id = g.person_id where g.id = l.target_id) end,
             l.details->>'reason')
      from platform_audit_log l left join persons p on p.id = l.actor_person_id left join companies c on c.id = l.company_id
     where p_kind in ('all','platform','access')
    union all
    select d.created_at,
           coalesce(p.preferred_name, p.full_name) || coalesce(' (' || (select string_agg(c.code, ', ') from employments e join companies c on c.id = e.company_id
                                                                       where e.person_id = d.actor_person_id and e.status in ('probation','active')) || ')', ''),
           'sensitive', 'data.' || d.resource,
           coalesce(s.preferred_name, s.full_name)
      from data_access_log d left join persons p on p.id = d.actor_person_id left join persons s on s.id = d.subject_person_id
     where p_kind in ('all','sensitive')
  ) x(at, actor, kind, action, target)
  where p_kind = 'all' or x.kind = p_kind
  order by x.at desc
  limit least(greatest(p_limit, 1), 1000);
end $$;

-- ---------------------------------------------------------------------
-- Tetapan platform (SA_Tetapan)
-- ---------------------------------------------------------------------
create or replace function sa_set_setting(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_superadmin() then raise exception 'Hanya Pentadbir Platform'; end if;
  if p_key not in ('registration_open','default_wa_limit','default_ai_limit','warn_pct','retention_days','maintenance_notice','invite_template') then
    raise exception 'Tetapan tidak dikenali';
  end if;
  if p_key in ('default_wa_limit','default_ai_limit') and p_value <> 'null'::jsonb and (jsonb_typeof(p_value) <> 'number' or (p_value #>> '{}')::numeric < 0) then
    raise exception 'Had mesti nombor positif';
  end if;
  if p_key = 'warn_pct' and (jsonb_typeof(p_value) <> 'number' or (p_value #>> '{}')::numeric not between 50 and 100) then
    raise exception 'Peratus amaran antara 50 hingga 100';
  end if;
  insert into platform_settings(key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value;
  perform log_platform('settings.' || p_key, null, null, null, jsonb_build_object('value', p_value));
end $$;

create or replace function sa_platform_admins() returns table(person_id uuid, name text, whatsapp text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_superadmin() then raise exception 'Hanya Pentadbir Platform'; end if;
  return query select p.id, coalesce(p.preferred_name, p.full_name), mask_phone(p.phone_whatsapp)
                 from platform_admins a join persons p on p.id = a.person_id order by 2;
end $$;

-- Kebenaran fungsi
do $$
declare f text;
begin
  foreach f in array array[
    'sa_dashboard()', 'sa_company_detail(uuid)', 'sa_message_admins(uuid, text)', 'sa_access_grants()',
    'sa_users(text)', 'sa_force_logout(uuid)', 'sa_add_platform_admin(text)', 'sa_audit_log(text, int)',
    'sa_set_setting(text, jsonb)', 'sa_platform_admins()'] loop
    execute format('revoke execute on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function %s from anon', f);
      execute format('grant execute on function %s to authenticated, service_role', f);
    end if;
  end loop;
end $$;
