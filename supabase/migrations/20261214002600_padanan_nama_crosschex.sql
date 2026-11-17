-- =====================================================================
--  Padanan automatik ID mesin CrossChex → pekerja ikut nama
--  CrossChex menyimpan nama pekerja (raw.employee.first_name / last_name). Cadangan dibuat hanya
--  apabila SEMUA perkataan nama di mesin (tanpa bin/binti) terdapat dalam nama penuh atau nama panggilan
--  TEPAT seorang pekerja aktif yang belum dipadankan, dan pekerja itu tidak dicadangkan untuk ID lain.
--  HR mengesahkan satu per satu atau semua sekali (match_attendance_workno membina semula rekod lama).
-- =====================================================================

create or replace function _nama_token(p text) returns text[]
language sql immutable as $$
  select coalesce(array(
    select t from unnest(regexp_split_to_array(regexp_replace(lower(coalesce(p, '')), '[^a-z]+', ' ', 'g'), ' ')) t
     where t <> '' and t not in ('bin', 'binti', 'bt', 'b', 'bte', 'bn', 'al', 'ap', 'a', 'l', 'p')), '{}')
$$;

create or replace function attendance_match_suggestions(p_company uuid)
returns table(workno text, machine_name text, punches int, last_punch timestamptz, employment_id uuid, employee_name text, employee_no text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Hanya HR/Admin'; end if;
  return query
  with cc as (
    select a.workno w, count(*)::int n, max(a.punched_at) akhir,
           max(nullif(btrim(regexp_replace(coalesce(a.raw->'employee'->>'first_name', '') || ' ' || coalesce(a.raw->'employee'->>'last_name', ''), '\s+', ' ', 'g')), '')) nama
      from attendance_punches a
     where a.company_id = p_company and a.employment_id is null
     group by a.workno),
  emp as (
    select e.id, coalesce(p.preferred_name, p.full_name) nm, e.employee_no eno,
           _nama_token(coalesce(p.full_name, '') || ' ' || coalesce(p.preferred_name, '')) tk
      from employments e join persons p on p.id = e.person_id
     where e.company_id = p_company and e.status in ('probation', 'active') and e.attendance_workno is null),
  calon as (
    select cc.w, emp.id, emp.nm, emp.eno
      from cc join emp on cardinality(_nama_token(cc.nama)) > 0 and _nama_token(cc.nama) <@ emp.tk),
  unik as (
    select c.w, min(c.id::text)::uuid id from calon c group by c.w having count(*) = 1),
  bersih as (   -- pekerja yang dicadangkan untuk lebih daripada satu ID tidak dicadangkan
    select u.w, u.id from unik u where (select count(*) from unik x where x.id = u.id) = 1)
  select cc.w, cc.nama, cc.n, cc.akhir, b.id, emp.nm, emp.eno
    from cc left join bersih b on b.w = cc.w left join emp on emp.id = b.id
   order by (b.id is null), cc.akhir desc;
end $$;

-- Sahkan semua cadangan sekali gus
create or replace function attendance_match_apply_suggestions(p_company uuid) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Hanya HR/Admin'; end if;
  for r in select s.workno, s.employment_id from attendance_match_suggestions(p_company) s where s.employment_id is not null loop
    perform match_attendance_workno(r.employment_id, r.workno);
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function _nama_token(text) from public;
do $$
declare f text;
begin
  foreach f in array array['attendance_match_suggestions(uuid)', 'attendance_match_apply_suggestions(uuid)'] loop
    execute 'revoke all on function ' || f || ' from public';
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute 'revoke all on function ' || f || ' from anon';
      execute 'grant execute on function ' || f || ' to authenticated';
    end if;
  end loop;
end $$;
