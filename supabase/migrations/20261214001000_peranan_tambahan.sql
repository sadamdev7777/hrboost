-- =====================================================================
--  Peringkat kelulusan boleh diluluskan oleh lebih daripada satu peranan (mod 'any': seorang sudah memadai).
--  Lalai gaji: peringkat Kewangan boleh juga diluluskan oleh CEO.
--  extra_roles NULL = belum ditetapkan (lalai dikenakan oleh pencetus); '{}' = tiada (pilihan HR dihormati).
-- =====================================================================
alter table approval_workflow_steps add column if not exists extra_roles app_role[];

create or replace function approval_resolve_approvers(p_req approval_requests, p_step approval_workflow_steps)
returns table(approver uuid, delegated_from uuid)
language plpgsql stable security definer set search_path = public as $$
declare raw uuid[];
begin
  if p_step.approver = 'dept_head' then
    select array_agg(d.head_person_id) into raw
      from employments e join departments d on d.id = e.department_id
     where e.id = p_req.requester_employment_id and d.head_person_id is not null;
  elsif p_step.approver = 'direct_manager' then
    select array_agg(e.manager_person_id) into raw
      from employments e where e.id = p_req.requester_employment_id and e.manager_person_id is not null;
  elsif p_step.approver = 'specific_person' then
    raw := array[p_step.approver_person_id];
  else
    select array_agg(distinct r.person_id) into raw from user_roles r
     where (r.role = p_step.approver_role or r.role = any(coalesce(p_step.extra_roles, '{}'))) and r.company_id = p_req.company_id;
  end if;

  return query
  with base as (select unnest(coalesce(raw, '{}'::uuid[])) as p),
  deleg as (
    select b.p as original,
           coalesce((select dl.to_person_id from approval_delegations dl
                      where dl.company_id = p_req.company_id and dl.from_person_id = b.p
                        and current_date between dl.start_date and dl.end_date
                        and (dl.request_types is null or p_req.request_type = any(dl.request_types))
                      order by dl.start_date desc limit 1), b.p) as final
    from base b
  )
  select distinct final, case when final <> original then original end
  from deleg
  where not (p_step.skip_if_requester and final = p_req.requester_person_id);
end $$;

create or replace function save_workflow(p_company uuid, p_type request_type, p_steps jsonb,
                                         p_cutoff time default null, p_reminder_hours int default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare wf uuid; s jsonb; i int := 0;
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Hanya HR/Pentadbir'; end if;
  if jsonb_typeof(p_steps) <> 'array' or jsonb_array_length(p_steps) = 0 then
    raise exception 'Sekurang-kurangnya satu peringkat diperlukan (tiada kelulusan automatik)';
  end if;
  if jsonb_array_length(p_steps) > 6 then raise exception 'Maksimum 6 peringkat'; end if;
  if p_reminder_hours is not null and p_reminder_hours not between 1 and 24 then raise exception 'Peringatan tidak sah'; end if;

  select id into wf from approval_workflows where company_id = p_company and request_type = p_type;
  if wf is null then
    insert into approval_workflows(company_id, request_type, name)
    values (p_company, p_type, 'Kelulusan ' || p_type) returning id into wf;
  end if;
  update approval_workflows set cutoff_time = coalesce(p_cutoff, cutoff_time),
         reminder_every_hours = coalesce(p_reminder_hours, reminder_every_hours)
   where id = wf;

  delete from approval_workflow_steps where workflow_id = wf;
  for s in select * from jsonb_array_elements(p_steps) loop
    i := i + 1;
    if coalesce(trim(s->>'name'), '') = '' then raise exception 'Peringkat % tiada nama', i; end if;
    if (s->>'approver') = 'specific_person' and not exists (
        select 1 from employments e where e.person_id = (s->>'approver_person_id')::uuid
           and e.company_id = p_company and e.status in ('probation','active')) then
      raise exception 'Pelulus peringkat % mesti pekerja syarikat ini', i;
    end if;
    insert into approval_workflow_steps(workflow_id, step_order, name, approver, approver_role, approver_person_id,
                                        condition, skip_if_requester, extra_roles)
    values (wf, i, trim(s->>'name'), (s->>'approver')::approver_type,
            nullif(s->>'approver_role', '')::app_role, nullif(s->>'approver_person_id', '')::uuid,
            coalesce(s->'condition', '{}'), coalesce((s->>'skip_if_requester')::boolean, true),
            -- Peranan tambahan yang juga boleh meluluskan peringkat ini (hanya untuk pelulus jenis peranan)
            case when (s->>'approver') = 'role' then
              coalesce((select array_agg(distinct x::app_role) from jsonb_array_elements_text(coalesce(s->'extra_roles', '[]')) x
                         where x in ('hr','finance','ceo','admin') and x <> coalesce(s->>'approver_role', '')), '{}')
            else '{}' end);
  end loop;
  perform emit_event(p_company, 'settings.workflow_changed', current_person_id(), null,
                     jsonb_build_object('request_type', p_type, 'steps', i));
  return wf;
end $$;

-- Lalai bagi aliran gaji yang dicipta oleh persediaan syarikat (seed): Kewangan atau CEO
create or replace function trg_workflow_step_defaults() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.extra_roles is null then
    new.extra_roles := case
      when new.approver = 'role' and new.approver_role = 'finance'
           and (select request_type from approval_workflows where id = new.workflow_id) = 'payroll_run'
      then '{ceo}'::app_role[] else '{}'::app_role[] end;
  end if;
  return new;
end $$;
drop trigger if exists workflow_step_defaults on approval_workflow_steps;
create trigger workflow_step_defaults before insert on approval_workflow_steps
  for each row execute function trg_workflow_step_defaults();

-- Aliran gaji sedia ada: peringkat Kewangan boleh juga diluluskan oleh CEO
update approval_workflow_steps s set extra_roles = '{ceo}'
  from approval_workflows w
 where w.id = s.workflow_id and w.request_type = 'payroll_run' and s.approver = 'role' and s.approver_role = 'finance'
   and s.extra_roles is null;
update approval_workflow_steps set extra_roles = '{}' where extra_roles is null;

-- Permohonan gaji yang sedang menunggu di peringkat Kewangan: tambah tugasan untuk CEO (selain pemohon)
insert into approval_tasks(request_id, step_order, step_name, approver_person_id, status)
select t.request_id, t.step_order, t.step_name, ur.person_id, 'pending'
  from approval_tasks t
  join approval_requests r on r.id = t.request_id and r.status = 'pending' and r.request_type = 'payroll_run'
  join user_roles ur on ur.company_id = r.company_id and ur.role = 'ceo'
 where t.status = 'pending' and t.step_name in ('Kewangan', 'Finance')
   and ur.person_id <> r.requester_person_id
   and not exists (select 1 from approval_tasks x where x.request_id = t.request_id and x.step_order = t.step_order and x.approver_person_id = ur.person_id)
 group by t.request_id, t.step_order, t.step_name, ur.person_id;
