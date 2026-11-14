-- =====================================================================
--  Inventori: item yang perlu dipulangkan oleh pekerja yang berhenti / akan berhenti.
--  inventory_list kini memulangkan status pemegang (holder_active) & hari bekerja terakhir (holder_end_date).
-- =====================================================================

drop function if exists inventory_list(uuid, text);
create function inventory_list(p_company uuid, p_scope text default 'mine')
returns table(id uuid, name text, category text, brand_model text, serial_no text, issued_on date, returned_on date,
              price numeric, condition text, location text, note text, photo_paths text[], receipt_paths text[],
              status text, reject_reason text, employment_id uuid, holder text, department text,
              created_by_name text, created_at timestamptz, verified_at timestamptz, editable boolean,
              holder_active boolean, holder_end_date date)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := current_person_id(); hr boolean := has_role(p_company, '{hr,admin}');
begin
  if p_scope = 'all' and not has_role(p_company, '{hr,admin,ceo,finance}') then raise exception 'Tidak dibenarkan'; end if;
  if p_scope <> 'all' and not is_company_member(p_company) then raise exception 'Tidak dibenarkan'; end if;
  return query
    select a.id, a.name, a.category, a.brand_model, a.serial_no, a.issued_on, a.returned_on, a.price, a.condition, a.location, a.note,
           a.photo_paths, a.receipt_paths, a.status, a.reject_reason, a.employment_id,
           coalesce(p.preferred_name, p.full_name), d.name,
           (select coalesce(c.preferred_name, c.full_name) from persons c where c.id = a.created_by),
           a.created_at, a.verified_at,
           hr or (a.created_by = me and a.status in ('pending','rejected')),
           case when e.id is null then null else e.status in ('probation','active') end,
           e.end_date
      from company_assets a
      left join employments e on e.id = a.employment_id
      left join persons p on p.id = e.person_id
      left join departments d on d.id = e.department_id
     where a.company_id = p_company
       and (p_scope = 'all' or e.person_id = me or a.created_by = me)
     order by case a.status when 'pending' then 0 when 'rejected' then 1 else 2 end, a.returned_on nulls first, a.created_at desc;
end $$;

do $$ begin
  revoke all on function inventory_list(uuid, text) from public;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function inventory_list(uuid, text) from anon;
    grant execute on function inventory_list(uuid, text) to authenticated;
  end if;
end $$;
