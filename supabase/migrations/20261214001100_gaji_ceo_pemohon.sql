-- =====================================================================
--  Gaji: CEO boleh meluluskan peringkat Kewangan walaupun CEO sendiri yang menghantar gaji
--  (lazim dalam PKS — pemilik menyediakan dan meluluskan gaji). Masih kelulusan manual & direkod.
--  HR boleh menanda semula "Langkau jika pelulus sendiri yang memohon" di Tetapan → Aliran Kelulusan.
-- =====================================================================

-- Aliran gaji sedia ada: peringkat Kewangan (atau CEO)
update approval_workflow_steps s set skip_if_requester = false
  from approval_workflows w
 where w.id = s.workflow_id and w.request_type = 'payroll_run'
   and s.approver = 'role' and s.approver_role = 'finance' and 'ceo' = any(coalesce(s.extra_roles, '{}'));

-- Lalai bagi syarikat baharu
create or replace function trg_workflow_step_defaults() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.extra_roles is null then
    if new.approver = 'role' and new.approver_role = 'finance'
       and (select request_type from approval_workflows where id = new.workflow_id) = 'payroll_run' then
      new.extra_roles := '{ceo}'::app_role[];
      new.skip_if_requester := false;
    else
      new.extra_roles := '{}'::app_role[];
    end if;
  end if;
  return new;
end $$;

-- Gaji yang sedang menunggu di peringkat Kewangan: tambah tugasan untuk CEO (termasuk CEO yang menghantar)
insert into approval_tasks(request_id, step_order, step_name, approver_person_id, status)
select t.request_id, t.step_order, t.step_name, ur.person_id, 'pending'
  from approval_tasks t
  join approval_requests r on r.id = t.request_id and r.status = 'pending' and r.request_type = 'payroll_run'
  join user_roles ur on ur.company_id = r.company_id and ur.role = 'ceo'
 where t.status = 'pending' and t.step_name in ('Kewangan', 'Finance')
   and not exists (select 1 from approval_tasks x where x.request_id = t.request_id and x.step_order = t.step_order and x.approver_person_id = ur.person_id)
 group by t.request_id, t.step_order, t.step_name, ur.person_id;
