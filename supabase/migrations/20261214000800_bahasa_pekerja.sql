-- HR boleh menetapkan bahasa pekerja (WhatsApp, aplikasi, Pembantu AI). Lalai: English.
-- Pekerja masih boleh menukar sendiri di Saya → Bahasa (set_my_language).
create or replace function hr_set_person_language(p_employment uuid, p_lang text) returns void
language plpgsql security definer set search_path = public as $$
declare e employments;
begin
  select * into e from employments where id = p_employment;
  if e.id is null or not has_role(e.company_id, '{hr,admin}') then raise exception 'Hanya HR syarikat ini'; end if;
  if coalesce(p_lang, '') not in ('en', 'ms') then raise exception 'Bahasa tidak sah'; end if;
  update persons set language = p_lang where id = e.person_id;
end $$;

revoke all on function hr_set_person_language(uuid, text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function hr_set_person_language(uuid, text) from anon;
    grant execute on function hr_set_person_language(uuid, text) to authenticated;
  end if;
end $$;
