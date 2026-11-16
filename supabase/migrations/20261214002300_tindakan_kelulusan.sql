-- =====================================================================
--  Kelulusan: semua keputusan yang menunggu pengguna, termasuk yang di luar enjin approval_*
--  (permintaan surat, inventori, akaun bank, kerja fleksibel, percubaan, prestasi, soalan HR,
--  laporan slip gaji, senarai semak orientasi). Ditapis ikut peranan pengguna dalam syarikat itu.
--  Teks paparan dibina di aplikasi (BM / English); RPC memulangkan data mentah.
-- =====================================================================
create or replace function my_action_queue(p_company uuid)
returns table(kind text, id uuid, employment_id uuid, name text, detail text, extra jsonb, created_at timestamptz, due_date date)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := current_person_id();
  hr boolean := has_role(p_company, '{hr,admin}');
  hr_ceo boolean := has_role(p_company, '{hr,admin,ceo}');
  gaji boolean := has_role(p_company, '{hr,finance,admin}');
begin
  if me is null or not is_company_member(p_company) then raise exception 'Tidak dibenarkan'; end if;
  return query
  -- Permintaan surat daripada pekerja
  select 'letter'::text, l.id, l.employment_id, coalesce(p.preferred_name, p.full_name), l.kind,
         jsonb_build_object('purpose', l.purpose, 'addressed_to', l.addressed_to), l.created_at, null::date
    from letter_requests l join employments e on e.id = l.employment_id join persons p on p.id = e.person_id
   where hr and l.company_id = p_company and l.status = 'pending' and l.source <> 'hr'
  union all
  -- Inventori direkod pekerja, menunggu semakan
  select 'asset', a.id, a.employment_id, coalesce(p.preferred_name, p.full_name, pc.preferred_name, pc.full_name), a.name,
         jsonb_build_object('category', a.category, 'serial_no', a.serial_no, 'price', a.price), a.created_at, null
    from company_assets a
    left join employments e on e.id = a.employment_id left join persons p on p.id = e.person_id
    left join persons pc on pc.id = a.created_by
   where hr and a.company_id = p_company and a.status = 'pending'
  union all
  -- Pertukaran akaun bank
  select 'bank', b.id, e.id, coalesce(p.preferred_name, p.full_name), b.bank_name,
         jsonb_build_object('account_tail', right(b.bank_account_no, 4)), b.requested_at, null
    from bank_change_requests b join persons p on p.id = b.person_id
    join employments e on e.person_id = b.person_id and e.company_id = p_company and e.status in ('probation','active')
   where hr and b.status = 'pending'
  union all
  -- Kerja fleksibel (Akta Kerja: jawapan bertulis sebelum due_date)
  select 'flexible', f.id, f.employment_id, coalesce(p.preferred_name, p.full_name), array_to_string(f.change_types, ', '),
         jsonb_build_object('details', f.details), f.created_at, f.due_date
    from flexible_work_requests f join employments e on e.id = f.employment_id join persons p on p.id = e.person_id
   where hr and f.company_id = p_company and f.status = 'pending'
  union all
  -- Penilaian percubaan perlu diisi oleh ketua / pengurus
  select 'probation_review', d.employment_id, d.employment_id, d.name, null,
         jsonb_build_object('days_left', d.days_left), null::timestamptz, d.probation_end
    from my_probation_reviews_due(p_company) d
  union all
  -- Keputusan percubaan oleh HR
  select 'probation_decision', r.id, r.employment_id, coalesce(p.preferred_name, p.full_name), r.recommendation,
         jsonb_build_object('extend_months', r.extend_months), r.submitted_at, e.probation_end_date
    from probation_reviews r join employments e on e.id = r.employment_id join persons p on p.id = e.person_id
   where hr and r.company_id = p_company and r.hr_decision is null and r.submitted_at is not null
  union all
  -- Penilaian prestasi: semakan pelulus
  select 'appraisal_review', a.id, a.employment_id, coalesce(p.preferred_name, p.full_name), c.name,
         '{}'::jsonb, a.self_submitted_at, c.manager_due
    from appraisals a join appraisal_cycles c on c.id = a.cycle_id join employments e on e.id = a.employment_id join persons p on p.id = e.person_id
   where c.company_id = p_company and c.status = 'open' and a.status = 'manager' and a.reviewer_person_id = me
  union all
  -- Penilaian prestasi: muktamad oleh HR / Pentadbir / CEO (bukan penilaian sendiri)
  select 'appraisal_final', a.id, a.employment_id, coalesce(p.preferred_name, p.full_name), c.name,
         '{}'::jsonb, coalesce(a.manager_submitted_at, a.self_submitted_at), null
    from appraisals a join appraisal_cycles c on c.id = a.cycle_id join employments e on e.id = a.employment_id join persons p on p.id = e.person_id
   where hr_ceo and c.company_id = p_company and a.status = 'hr' and e.person_id <> me
  union all
  -- Soalan HR belum dijawab
  select 'question', q.id, q.employment_id, coalesce(p.preferred_name, p.full_name), q.question,
         '{}'::jsonb, q.created_at, null
    from hr_questions q join employments e on e.id = q.employment_id join persons p on p.id = e.person_id
   where hr and q.company_id = p_company and q.status = 'open'
  union all
  -- Laporan kesilapan slip gaji
  select 'payslip_issue', i.id, i.employment_id, coalesce(p.preferred_name, p.full_name), i.message,
         jsonb_build_object('year', r.period_year, 'month', r.period_month), i.created_at, null
    from payslip_issues i join payroll_runs r on r.id = i.payroll_run_id
    join employments e on e.id = i.employment_id join persons p on p.id = e.person_id
   where gaji and r.company_id = p_company and i.resolved_at is null
  union all
  -- Senarai semak orientasi (HR: perkara HR; ketua: pasukan sendiri)
  select 'checklist', t.id, t.employment_id, t.employee_name, t.title,
         jsonb_build_object('owner', t.owner), null::timestamptz, t.due_date
    from my_onboarding_tasks(p_company) t;
end $$;

revoke all on function my_action_queue(uuid) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function my_action_queue(uuid) from anon;
    grant execute on function my_action_queue(uuid) to authenticated;
  end if;
end $$;
