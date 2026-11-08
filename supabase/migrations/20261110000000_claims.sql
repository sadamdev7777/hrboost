-- =====================================================================
--  Fasa D: tuntutan (skrin BuatClaim, Tuntutan)
-- =====================================================================

-- Satu item tuntutan boleh mempunyai lebih daripada satu resit (CLAUDE.md §6).
-- receipt_path kekal sebagai resit pertama (digunakan oleh submit_claim untuk semakan resit wajib).
alter table claim_items add column if not exists receipt_paths text[] not null default '{}';

-- Pekerja boleh memadam draf tuntutan sendiri (item dipadam bersama melalui cascade).
create policy delete_draft_claim on claims for delete using (
  status = 'draft' and
  exists (select 1 from employments e where e.id = employment_id and e.person_id = current_person_id()));

-- Pelulus boleh membuka resit tuntutan yang perlu diluluskan; pelulus cuti boleh membuka sijil.
do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    raise notice 'Skema storage tiada: polisi resit dilangkau';
    return;
  end if;
  execute 'drop policy if exists peribadi_approver_select on storage.objects';
  execute $p$
    create policy peribadi_approver_select on storage.objects for select to authenticated
      using (bucket_id = 'peribadi' and (
        exists (select 1 from public.leave_requests lr
                 where lr.attachment_path = storage.objects.name
                   and public.is_approver_of(lr.approval_request_id))
        or exists (select 1 from public.claim_items ci join public.claims c on c.id = ci.claim_id
                    where storage.objects.name = any(ci.receipt_paths)
                      and (public.is_approver_of(c.approval_request_id)
                           or public.has_role(public.employment_company(c.employment_id), '{finance}')))))
  $p$;
end $$;

-- ---------------------------------------------------------------------
-- Pembetulan: v_my_approval_tasks menggunakan INNER JOIN ke persons. RLS persons tidak
-- membenarkan pelulus seperti Kewangan membaca rekod pemohon, jadi tugasan mereka hilang
-- daripada senarai. Tukar kepada LEFT JOIN dan sediakan nama panggilan pemohon melalui
-- fungsi yang hanya menjawab bagi permohonan yang boleh dilihat oleh pemanggil
-- (tanpa mendedahkan IC, bank atau maklumat peribadi lain).
-- ---------------------------------------------------------------------
create or replace function request_requester_name(p_request uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(p.preferred_name, p.full_name)
    from approval_requests r join persons p on p.id = r.requester_person_id
   where r.id = p_request and can_view_request(p_request)
$$;
revoke execute on function request_requester_name(uuid) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function request_requester_name(uuid) from anon;
    grant execute on function request_requester_name(uuid) to authenticated, service_role;
  end if;
end $$;

create or replace view v_my_approval_tasks with (security_invoker = true) as
select tk.id as task_id, tk.step_name, tk.created_at as assigned_at, tk.delegated_from,
       r.id as request_id, r.request_type, r.title, r.context, r.ai_summary,
       r.sla_due_at, r.sla_breached, r.submitted_at, r.company_id, c.code as company_code,
       p.full_name as requester_name, p.photo_path as requester_photo,
       d.name as department,
       request_requester_name(r.id) as requester_nickname
from approval_tasks tk
join approval_requests r on r.id = tk.request_id
join companies c on c.id = r.company_id
left join persons p on p.id = r.requester_person_id
left join employments e on e.id = r.requester_employment_id
left join departments d on d.id = e.department_id
where tk.status = 'pending' and r.status = 'pending'
  and tk.approver_person_id = current_person_id();
