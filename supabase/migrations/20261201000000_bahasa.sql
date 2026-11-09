-- =====================================================================
--  Bahasa antara muka: English (lalai) atau Bahasa Melayu, dipilih oleh setiap orang.
--  persons.language digunakan untuk aplikasi (diselaraskan selepas log masuk),
--  dan kelak untuk mesej WhatsApp, surat & slip gaji.
-- =====================================================================
alter table persons alter column language set default 'en';
update persons set language = 'en' where language is distinct from 'en';

create or replace function set_my_language(p_lang text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_lang not in ('en','ms') then raise exception 'Bahasa tidak sah'; end if;
  if current_person_id() is null then raise exception 'Tidak dibenarkan'; end if;
  update persons set language = p_lang where id = current_person_id();
end $$;
revoke all on function set_my_language(text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function set_my_language(text) from anon;
    grant execute on function set_my_language(text) to authenticated, service_role;
  end if;
end $$;
