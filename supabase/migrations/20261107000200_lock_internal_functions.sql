-- Pembetulan keselamatan v0.2.
--
-- 1) Fungsi dalaman hanya untuk dipanggil oleh fungsi lain (security definer) atau
--    Edge Function (service role). Skema v0.2 cuba menyekatnya dengan
--    `revoke ... from public`, tetapi Supabase memberi EXECUTE secara TERUS kepada
--    peranan anon dan authenticated (default privileges), jadi sekatan itu tidak
--    berkesan. Tarik balik juga daripada anon dan authenticated.
--    service_role kekal boleh memanggil (events-worker, sla-tick).
revoke execute on function
  public.approval_advance(uuid),
  public.approval_apply_outcome(public.approval_requests),
  public.approval_create(public.request_type, uuid, uuid, text, jsonb, boolean, public.action_channel),
  public.emit_event(uuid, text, uuid, uuid, jsonb),
  public.process_hr_events(int),
  public.approval_sla_tick(),
  public.log_platform(text, uuid, text, uuid, jsonb),
  public.notify_person(uuid, uuid, text),
  public.rebuild_attendance_day(uuid, date),
  -- pembantu dalaman lain (dipanggil hanya oleh RPC security definer)
  public.seed_company_defaults(uuid),
  public.ensure_leave_balance(uuid, uuid, int),
  public.approval_resolve_approvers(public.approval_requests, public.approval_workflow_steps),
  public.approval_sla_due(uuid, public.approval_workflows, timestamptz, boolean)
  from public, anon, authenticated;

-- 2) Tetapkan search_path bagi fungsi yang belum ada (amaran Supabase
--    "function_search_path_mutable").
alter function public.is_service_role() set search_path = public;
alter function public.fmt_tarikh(date) set search_path = public;
alter function public.fmt_num(numeric) set search_path = public;
alter function public.eval_condition(jsonb, jsonb) set search_path = public;
alter function public.trg_leave_days() set search_path = public;
alter function public.render_template(text, jsonb) set search_path = public;
