-- Pembetulan: "Tarik balik & buka semula" bagi gaji yang sedang menunggu kelulusan gagal kerana
-- approval_tasks.status tidak mempunyai nilai 'cancelled' (enum task_status). Tugasan kini ditanda 'superseded'.
create or replace function payroll_reopen(p_run uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare r payroll_runs;
begin
  select * into r from payroll_runs where id = p_run for update;
  if r.id is null or not has_role(r.company_id, '{hr,finance,admin}') then raise exception 'Hanya HR/Kewangan'; end if;
  if r.status not in ('approved','paid','pending','rejected','cancelled') then raise exception 'Gaji ini belum dihantar atau diluluskan'; end if;
  if r.status = 'locked' then raise exception 'Gaji ini telah dikunci'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Sila nyatakan sebab buka semula'; end if;
  if exists (select 1 from payroll_runs x where x.company_id = r.company_id and x.status in ('approved','paid','locked','pending')
              and make_date(x.period_year, x.period_month, 1) > make_date(r.period_year, r.period_month, 1)) then
    raise exception 'Gaji bulan kemudian telah diproses. Buka semula bulan terkini dahulu.';
  end if;
  if r.status = 'pending' and r.approval_request_id is not null then
    -- Tugasan pelulus yang belum diputuskan tidak lagi relevan (enum task_status: 'superseded', sama seperti approval_cancel)
    update approval_tasks set status = 'superseded' where request_id = r.approval_request_id and status = 'pending';
    update approval_requests set status = 'cancelled', completed_at = now() where id = r.approval_request_id and status = 'pending';
  end if;
  update claims set paid_at = null where paid_via_payroll_run = r.id;
  update payroll_runs set status = 'calculated', approval_request_id = null, payslip_release_at = null, pay_date = null where id = r.id;
  insert into payroll_run_events(run_id, action, note, actor) values (r.id, 'reopened', trim(p_reason), current_person_id());
  perform emit_event(r.company_id, 'payroll.reopened', current_person_id(), null, jsonb_build_object('run_id', r.id, 'reason', trim(p_reason)));
end $$;
