-- =====================================================================
--  Audit: mesej ralat cuti tidak lagi berulang "Cuti Cuti Sakit ..." (nama jenis cuti
--  sudah bermula dengan "Cuti"). Fungsi lain tidak berubah.
-- =====================================================================
create or replace function submit_leave(p_employment uuid, p_leave_code text, p_start date, p_end date,
                                        p_half leave_half default 'full', p_reason text default null,
                                        p_attachment text default null,
                                        p_via action_channel default 'web', p_on_behalf uuid default null,
                                        p_cover_person uuid default null)
returns leave_requests language plpgsql security definer set search_path = public as $$
declare actor uuid; e employments; lt leave_types; lr leave_requests; b leave_balances; rid uuid;
begin
  actor := resolve_actor(p_on_behalf);
  select * into e from employments where id = p_employment;
  if e.person_id <> actor then raise exception 'Anda hanya boleh mohon cuti untuk diri sendiri'; end if;
  select * into lt from leave_types where company_id = e.company_id and code = p_leave_code and active;
  if lt.id is null then raise exception 'Jenis cuti % tidak wujud', p_leave_code; end if;
  if p_start < current_date and not lt.allow_backdate then
    raise exception '% tidak boleh dimohon untuk tarikh lepas', lt.name;
  end if;
  if lt.requires_attachment and p_attachment is null then
    raise exception '% memerlukan dokumen sokongan', lt.name;
  end if;
  if exists (select 1 from leave_requests x where x.employment_id = e.id
              and x.status in ('pending','approved')
              and daterange(x.start_date, x.end_date, '[]') && daterange(p_start, p_end, '[]')) then
    raise exception 'Tarikh bertindih dengan cuti lain';
  end if;

  if p_cover_person is not null and not exists (
       select 1 from employments x where x.person_id = p_cover_person and x.company_id = e.company_id
          and x.status in ('probation','active') and x.person_id <> e.person_id) then
    raise exception 'PIC ganti mesti rakan sekerja dalam syarikat yang sama';
  end if;

  insert into leave_requests(employment_id, leave_type_id, start_date, end_date, half_day,
                             reason, attachment_path, cover_person_id, status, created_via)
  values (e.id, lt.id, p_start, p_end, p_half, p_reason, p_attachment, p_cover_person, 'pending', p_via)
  returning * into lr;
  if lr.days = 0 then raise exception 'Tarikh dipilih bukan hari bekerja'; end if;

  if lt.deduct_balance then
    b := ensure_leave_balance(e.id, lt.id, extract(year from p_start)::int);
    if b.available < lr.days then
      raise exception 'Baki % tidak mencukupi (baki %, mohon %)', lt.name, b.available, lr.days;
    end if;
    update leave_balances set pending = pending + lr.days where id = b.id;
  end if;

  rid := approval_create('leave', lr.id, e.id,
           lt.name || ' ' || fmt_tarikh(p_start) ||
           case when p_end <> p_start then ' – ' || fmt_tarikh(p_end) else '' end ||
           ' (' || fmt_num(lr.days) || ' hari)',
           jsonb_build_object('leave_code', lt.code, 'days', lr.days, 'start_date', p_start,
                              'end_date', p_end, 'reason', p_reason),
           lt.sla_exempt, p_via);
  update leave_requests set approval_request_id = rid where id = lr.id returning * into lr;
  perform emit_event(e.company_id, 'leave.submitted', e.person_id, e.id,
                     jsonb_build_object('leave_request_id', lr.id, 'days', fmt_num(lr.days),
                                        'tarikh', fmt_tarikh(p_start) ||
                                          case when p_end <> p_start then ' – ' || fmt_tarikh(p_end) else '' end,
                                        'jenis', lt.name, 'status', 'menunggu kelulusan',
                                        'cover_person_id', p_cover_person,
                                        'pic', (select coalesce(preferred_name, full_name) from persons where id = p_cover_person),
                                        'jabatan', (select d.name from departments d where d.id = e.department_id)));
  -- permohonan mungkin sudah selesai (cth semua tier dilangkau)
  select * into lr from leave_requests where id = lr.id;
  return lr;
end $$;

-- =====================================================================
--  Papan Pemuka: senarai tugasan HR (bukan hanya kelulusan sendiri).
--  Setiap angka hanya dipulangkan kepada peranan yang berkaitan; null = tidak berkaitan.
-- =====================================================================
create or replace function hr_todo(p_company uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  hari date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  hr boolean := has_role(p_company, '{hr,admin}');
  urus boolean := has_role(p_company, '{hr,ceo,admin}');
  wang boolean := has_role(p_company, '{hr,finance,ceo,admin}');
begin
  if not wang then raise exception 'Tidak dibenarkan'; end if;
  return jsonb_build_object(
    'not_activated', case when urus then (
      select count(*) from employments e join persons p on p.id = e.person_id
       where e.company_id = p_company and e.status in ('probation','active') and p.auth_user_id is null) end,
    'probation_ending', case when urus then (
      select count(*) from employments e
       where e.company_id = p_company and e.status = 'probation'
         and e.probation_end_date is not null and e.probation_end_date <= hari + 30
         and not exists (select 1 from probation_reviews pr where pr.employment_id = e.id and pr.hr_decision is not null)) end,
    'claims_unpaid', (
      select jsonb_build_object('n', count(*), 'amount', coalesce(sum(c.total_amount), 0))
        from claims c join employments e on e.id = c.employment_id
       where e.company_id = p_company and c.status = 'approved' and c.paid_at is null),
    'questions_open', case when hr then (select count(*) from hr_questions q where q.company_id = p_company and q.status = 'open') end,
    'letters_pending', case when hr then (select count(*) from letter_requests l where l.company_id = p_company and l.status = 'pending') end,
    'flexible_pending', case when hr then (select count(*) from flexible_work_requests f where f.company_id = p_company and f.status = 'pending') end,
    'stuck', case when urus then (
      select count(*) from approval_requests r
       where r.company_id = p_company and r.status = 'pending'
         and (r.sla_breached or (r.sla_due_at is not null and r.sla_due_at < now()))) end,
    'pending_all', case when urus then (
      select count(*) from approval_requests r where r.company_id = p_company and r.status = 'pending') end
  );
end $$;

-- =====================================================================
--  Kelulusan: semua permohonan yang masih menunggu dalam syarikat (HR / CEO / Pentadbir),
--  dengan pelulus semasa dan tempoh menunggu. Untuk memantau permohonan tersangkut.
-- =====================================================================
create or replace function hr_pending_requests(p_company uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not has_role(p_company, '{hr,ceo,admin}') then raise exception 'Tidak dibenarkan'; end if;
  return coalesce((
    select jsonb_agg(x order by x.overdue desc, x.submitted_at) from (
      select r.id, r.request_type, r.title, r.submitted_at, r.sla_due_at,
             (r.sla_breached or (r.sla_due_at is not null and r.sla_due_at < now())) as overdue,
             coalesce(rp.preferred_name, rp.full_name) as requester,
             (select string_agg(distinct t.step_name, ', ') from approval_tasks t
               where t.request_id = r.id and t.status = 'pending') as step_name,
             (select string_agg(coalesce(ap.preferred_name, ap.full_name), ', ' order by ap.preferred_name) from approval_tasks t
                join persons ap on ap.id = t.approver_person_id
               where t.request_id = r.id and t.status = 'pending') as approvers,
             (select max(t.last_reminded_at) from approval_tasks t where t.request_id = r.id and t.status = 'pending') as last_reminded_at
        from approval_requests r
        join persons rp on rp.id = r.requester_person_id
       where r.company_id = p_company and r.status = 'pending'
       limit 300) x), '[]'::jsonb);
end $$;

-- Hantar peringatan WhatsApp kepada pelulus semasa (sekali setiap 2 jam bagi setiap permohonan).
create or replace function approval_remind(p_request uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  r approval_requests;
  t record;
  n int := 0;
  nama text;
begin
  select * into r from approval_requests where id = p_request;
  if r.id is null then raise exception 'Permohonan tidak dijumpai'; end if;
  if not has_role(r.company_id, '{hr,ceo,admin}') then raise exception 'Tidak dibenarkan'; end if;
  if r.status <> 'pending' then raise exception 'Permohonan ini tidak lagi menunggu kelulusan'; end if;
  if exists (select 1 from approval_tasks where request_id = r.id and status = 'pending'
              and last_reminded_at > now() - interval '2 hours') then
    raise exception 'Peringatan telah dihantar dalam 2 jam yang lalu';
  end if;
  select coalesce(preferred_name, full_name) into nama from persons where id = r.requester_person_id;
  for t in select * from approval_tasks where request_id = r.id and status = 'pending' loop
    perform notify_person(t.approver_person_id, r.company_id,
      'Peringatan: permohonan "' || r.title || '" daripada ' || nama || ' masih menunggu kelulusan anda. Sila balas LULUS atau TOLAK <sebab>.');
    update approval_tasks set last_reminded_at = now() where id = t.id;
    n := n + 1;
  end loop;
  return n;
end $$;

insert into message_i18n(kind, ms, en, sort, frasa) values
  ('message', $q$^Peringatan: permohonan "(.*)" daripada (.*) masih menunggu kelulusan anda\. Sila balas LULUS atau TOLAK <sebab>\.$$q$,
   $q$Reminder: the request "\1" from \2 is still waiting for your approval. Reply APPROVE or REJECT <reason>.$q$, 120, true)
on conflict (kind, ms) do update set en = excluded.en;

revoke all on function hr_todo(uuid) from public, anon;
revoke all on function hr_pending_requests(uuid) from public, anon;
revoke all on function approval_remind(uuid) from public, anon;
grant execute on function hr_todo(uuid) to authenticated;
grant execute on function hr_pending_requests(uuid) to authenticated;
grant execute on function approval_remind(uuid) to authenticated;

insert into message_i18n(kind, ms, en, sort, frasa) values
  ('phrase', $q$\((\d+(?:\.\d+)?) hari\)$q$, $q$(\1 days)$q$, 90, true)
on conflict (kind, ms) do update set en = excluded.en;
