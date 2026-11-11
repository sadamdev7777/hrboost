-- =====================================================================
--  Pemantauan ralat aplikasi (tanpa perkhidmatan luar).
--  Pelayar menghantar ralat JavaScript yang tidak ditangkap melalui log_client_error().
--  Pentadbir Platform melihat ringkasan dikumpulkan ikut mesej (sa_client_errors) — tiada nama
--  atau data peribadi pengguna dipaparkan; hanya kod syarikat, laluan, pelayar dan bilangan.
--  Rekod lebih 90 hari dipadam setiap hari.
-- =====================================================================

create table if not exists client_errors (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  person_id   uuid references persons(id) on delete set null,
  company_id  uuid references companies(id) on delete set null,
  path        text,
  message     text not null,
  stack       text,
  user_agent  text,
  release     text,
  fingerprint text not null
);
create index if not exists client_errors_fp_idx on client_errors(fingerprint, created_at desc);
create index if not exists client_errors_at_idx on client_errors(created_at desc);
alter table client_errors enable row level security;  -- tiada polisi: akses melalui fungsi sahaja

create or replace function log_client_error(p_message text, p_stack text default null, p_path text default null,
                                            p_user_agent text default null, p_release text default null, p_company uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare pid uuid := current_person_id(); fp text; msg text;
begin
  msg := left(coalesce(nullif(trim(p_message), ''), 'Ralat tanpa mesej'), 500);
  -- Buang nombor & id supaya ralat sama dikumpulkan bersama (dan tiada nombor IC/akaun tersimpan dalam cap jari)
  fp := md5(regexp_replace(msg, '[0-9a-f]{8}-[0-9a-f-]{27}|\d+', '#', 'gi') || coalesce(split_part(p_stack, E'\n', 2), ''));
  -- Had: 30 rekod sejam bagi setiap pengguna (atau 300 sejam bagi pengguna tanpa log masuk), 5 bagi ralat yang sama
  if (select count(*) from client_errors where created_at > now() - interval '1 hour'
        and (person_id = pid or (pid is null and person_id is null))) >= (case when pid is null then 300 else 30 end) then return; end if;
  if (select count(*) from client_errors where fingerprint = fp and created_at > now() - interval '1 hour'
        and (person_id = pid or (pid is null and person_id is null))) >= 5 then return; end if;
  insert into client_errors(person_id, company_id, path, message, stack, user_agent, release, fingerprint)
  values (pid,
          case when p_company is not null and is_company_member(p_company) then p_company end,
          left(regexp_replace(coalesce(p_path, ''), '\?.*$', ''), 200),   -- tanpa query string (token jemputan dsb.)
          msg, left(p_stack, 4000), left(p_user_agent, 300), left(p_release, 40), fp);
end $$;

-- Ringkasan untuk Pentadbir Platform (agregat; tiada identiti pengguna)
create or replace function sa_client_errors(p_days int default 7)
returns table(fingerprint text, message text, path text, count bigint, users bigint, companies text, first_at timestamptz, last_at timestamptz,
              stack text, user_agent text, release text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_superadmin() then raise exception 'Tidak dibenarkan'; end if;
  return query
  select e.fingerprint, (array_agg(e.message order by e.created_at desc))[1],
         (array_agg(e.path order by e.created_at desc))[1],
         count(*), count(distinct e.person_id),
         string_agg(distinct c.code, ', '),
         min(e.created_at), max(e.created_at),
         (array_agg(e.stack order by e.created_at desc))[1],
         (array_agg(e.user_agent order by e.created_at desc))[1],
         (array_agg(e.release order by e.created_at desc))[1]
    from client_errors e left join companies c on c.id = e.company_id
   where e.created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 90)))
   group by e.fingerprint
   order by max(e.created_at) desc
   limit 200;
end $$;

create or replace function purge_client_errors() returns int
language sql security definer set search_path = public as $$
  with d as (delete from client_errors where created_at < now() - interval '90 days' returning 1) select count(*)::int from d
$$;

revoke all on function log_client_error(text, text, text, text, text, uuid) from public;
revoke all on function sa_client_errors(int) from public;
revoke all on function purge_client_errors() from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function log_client_error(text, text, text, text, text, uuid) to anon, authenticated;
    grant execute on function sa_client_errors(int) to authenticated;
  end if;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'hrboost-purge-client-errors';
    perform cron.schedule('hrboost-purge-client-errors', '17 19 * * *', 'select public.purge_client_errors()');  -- 3:17 pagi MYT
  end if;
end $$;
