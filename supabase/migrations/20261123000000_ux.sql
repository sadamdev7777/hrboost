-- =====================================================================
--  Penambahbaikan UX
--  company_attendance_connected: adakah syarikat sudah menyambung sistem
--  kehadiran (integrasi aktif atau ada rekod 30 hari lepas)? Jika belum,
--  skrin pekerja tidak memaparkan "Tidak hadir" yang mengelirukan.
-- =====================================================================
create or replace function company_attendance_connected(p_company uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_company_member(p_company) and (
    exists (select 1 from attendance_integrations i where i.company_id = p_company)
    or exists (select 1 from attendance_records a join employments e on e.id = a.employment_id
                where e.company_id = p_company and a.work_date >= (now() at time zone 'Asia/Kuala_Lumpur')::date - 30));
$$;
revoke all on function company_attendance_connected(uuid) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function company_attendance_connected(uuid) from anon;
    grant execute on function company_attendance_connected(uuid) to authenticated, service_role;
  end if;
end $$;
