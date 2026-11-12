-- =====================================================================
--  Lindung 24 Jam (SKBBK): pilih pekerja yang menyertai secara pukal (Tetapan Gaji → Pilih pekerja).
--  Peraturan sama seperti employment_stat_effective: tetapan pekerja (yes/no) mengatasi lalai;
--  'auto' = pekerja asing sentiasa, pekerja tempatan ikut companies.skbbk_default.
-- =====================================================================

create or replace function hr_skbbk_list(p_company uuid)
returns table(employment_id uuid, employee_no text, name text, department text, foreign_worker boolean, setting text, joined boolean)
language sql stable security definer set search_path = public as $$
  select e.id, e.employee_no, coalesce(p.preferred_name, p.full_name), d.name,
         coalesce(p.nationality, 'MY') not in ('MY', '') as asing,
         coalesce(s.skbbk, 'auto'),
         case coalesce(s.skbbk, 'auto') when 'yes' then true when 'no' then false
              else coalesce(p.nationality, 'MY') not in ('MY', '') or c.skbbk_default end
    from employments e join persons p on p.id = e.person_id join companies c on c.id = e.company_id
    left join departments d on d.id = e.department_id
    left join employment_statutory s on s.employment_id = e.id
   where e.company_id = p_company and e.status in ('probation','active')
     and has_role(p_company, '{hr,finance,admin}')
   order by coalesce(p.preferred_name, p.full_name)
$$;

-- p_joined: pekerja tempatan yang menyertai. Pekerja asing sentiasa menyertai (wajib) dan tidak boleh dikecualikan.
create or replace function hr_set_skbbk(p_company uuid, p_joined uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare c companies; r record; mahu boolean; nilai text; n int := 0;
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Hanya HR/Pentadbir'; end if;
  select * into c from companies where id = p_company;
  for r in
    select e.id, coalesce(p.nationality, 'MY') not in ('MY', '') as asing, coalesce(p.children_count, 0) as anak,
           coalesce(s.skbbk, 'auto') as semasa
      from employments e join persons p on p.id = e.person_id
      left join employment_statutory s on s.employment_id = e.id
     where e.company_id = p_company and e.status in ('probation','active')
  loop
    if r.asing then
      nilai := case when r.semasa = 'no' then 'auto' else r.semasa end;
    else
      mahu := r.id = any(coalesce(p_joined, '{}'));
      -- Kekalkan 'auto' jika pilihan sama dengan lalai syarikat (supaya menukar lalai kemudian masih berkesan)
      nilai := case when mahu = c.skbbk_default then 'auto' when mahu then 'yes' else 'no' end;
    end if;
    continue when nilai = r.semasa;
    -- Rekod baharu: salin bilangan anak supaya pelepasan PCB tidak berubah
    insert into employment_statutory(employment_id, skbbk, child_u18) values (r.id, nilai, r.anak)
    on conflict (employment_id) do update set skbbk = excluded.skbbk, updated_at = now();
    n := n + 1;
  end loop;
  perform emit_event(p_company, 'payroll.skbbk_changed', current_person_id(), null, jsonb_build_object('changed', n));
  return n;
end $$;

revoke all on function hr_skbbk_list(uuid) from public;
revoke all on function hr_set_skbbk(uuid, uuid[]) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function hr_skbbk_list(uuid) to authenticated;
    grant execute on function hr_set_skbbk(uuid, uuid[]) to authenticated;
  end if;
end $$;
