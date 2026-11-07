-- Fasa B: senarai rakan sekerja untuk pilihan "Pengganti tugas" (Mohon Cuti).
--
-- RLS `persons` hanya membenarkan pekerja membaca rekod sendiri, jadi pekerja
-- biasa tidak boleh menyenaraikan rakan sekerja. Fungsi ini memulangkan data
-- minimum sahaja: id orang, nama panggilan dan jabatan. Tiada IC, telefon,
-- gaji atau tarikh lahir.
create or replace function my_colleagues(p_company uuid)
returns table(person_id uuid, name text, department_id uuid, department text)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(p.preferred_name, p.full_name), e.department_id, d.name
    from employments e
    join persons p on p.id = e.person_id and p.is_active
    left join departments d on d.id = e.department_id
   where e.company_id = p_company
     and e.status in ('probation','active')
     and p.id <> current_person_id()
     and is_company_member(p_company)
   order by (e.department_id is not distinct from (
              select x.department_id from employments x
               where x.company_id = p_company and x.person_id = current_person_id()
                 and x.status in ('probation','active') limit 1)) desc,
            2
$$;

revoke execute on function my_colleagues(uuid) from public, anon;
grant execute on function my_colleagues(uuid) to authenticated, service_role;
