-- =====================================================================
--  HRBoost.io — Skema Supabase v0.2 (asal: Sistem HR MTB v0.1)
--
--  Perubahan v0.2:
--   • Superadmin platform (platform_admins). Superadmin TIDAK nampak data
--     peribadi; hanya agregat melalui fungsi sa_*.
--   • HR/CEO/Admin hanya untuk syarikat sendiri. Akses ke syarikat lain
--     melalui company_access_grants yang diluluskan superadmin & bertempoh.
--   • Status syarikat (aktif/dinyahaktif) & status pengguna (is_active).
--   • Nama panggilan, sembunyi hari jadi, maklumat PCB (pasangan, anak).
--   • PIC ganti semasa cuti + automasi WhatsApp kepada PIC / rakan sejabatan.
--   • Cuti umum pilihan syarikat (5 wajib + pilihan, minimum 11 hari).
--   • CrossChex: punch mentah, padanan workno, keadaan sync.
--   • Jemputan staff, kemajuan onboarding staff & syarikat, daftar syarikat.
--   • Had & kiraan penggunaan WhatsApp/AI, tetapan platform, log audit platform.
--
--  (Nota asal v0.1 di bawah)
--  SISTEM HR MTB (berbilang syarikat) — Skema Supabase v0.1
--  Fasa 1: Pekerja, Cuti, Tuntutan, Kehadiran (data luar), Pusat
--  Kelulusan berperingkat, Gaji (struktur), Integrasi Akaun, AI Agent.
--
--  Prinsip reka bentuk:
--   1. Satu ORANG (persons) boleh ada beberapa PEKERJAAN (employments),
--      satu bagi setiap syarikat. Gaji, caruman & cuti ikut pekerjaan.
--   2. Semua kelulusan melalui satu enjin (approval_*).
--   3. "Agent-ready": setiap kejadian penting ditulis ke hr_events.
--      Peraturan automasi (automation_rules) tukar kejadian kepada
--      notifikasi WhatsApp (dihantar oleh Edge Function + Murpati).
--      Semua tindakan penting ada fungsi RPC yang agent boleh panggil.
--   4. Kadar berkanun disimpan sebagai data, bukan kod.
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists vector;   -- untuk carian handbook (AI)

-- ---------------------------------------------------------------------
-- ENUM
-- ---------------------------------------------------------------------
create type app_role          as enum ('staff','dept_head','hr','finance','ceo','admin');
create type employment_type   as enum ('permanent','contract','part_time','intern');
create type employment_status as enum ('probation','active','resigned','terminated','retired');
create type request_type      as enum ('leave','claim','attendance_correction','payroll_run','overtime','salary_advance');
create type request_status    as enum ('draft','pending','approved','rejected','returned','cancelled');
create type task_status       as enum ('pending','approved','rejected','returned','superseded');
create type approver_type     as enum ('dept_head','direct_manager','specific_person','role');
create type step_mode         as enum ('any','all');
create type sla_mode          as enum ('none','same_day','hours');
create type action_channel    as enum ('web','whatsapp','ai_agent','system');
create type accounting_system as enum ('quickbooks','niagawan','csv','none');
create type sync_status       as enum ('pending','success','failed','skipped');
create type leave_half        as enum ('full','am','pm');
create type payroll_status    as enum ('draft','calculated','pending','approved','paid','locked','returned','rejected','cancelled');
create type notify_target     as enum ('subject','subject_manager','subject_dept_head','role_hr','role_ceo','specific_person','cover_person','dept_peers');
create type notify_status     as enum ('pending','sent','failed','skipped');

-- ---------------------------------------------------------------------
-- SYARIKAT & ORANG
-- ---------------------------------------------------------------------
create table companies (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,              -- 'MTB', 'DOIT', 'AVENUE'
  name               text not null,
  reg_no             text,
  state              text not null default 'WP Kuala Lumpur',  -- cuti umum negeri
  timezone           text not null default 'Asia/Kuala_Lumpur',
  weekend_days       int[] not null default '{0,6}',    -- 0=Ahad, 6=Sabtu
  work_start         time not null default '09:00',
  work_end           time not null default '18:00',
  late_grace_minutes int  not null default 10,
  epf_employer_no    text,
  socso_employer_no  text,
  lhdn_employer_no   text,                              -- No. E
  hrdf_registered    boolean not null default false,
  accounting_system  accounting_system not null default 'none',
  accounting_config  jsonb not null default '{}',       -- realm id, akaun GL dsb (tanpa rahsia)
  logo_path          text,
  status             text not null default 'active' check (status in ('active','suspended')),
  suspended_at       timestamptz,
  suspended_reason   text,
  wa_monthly_limit   int,                               -- NULL = guna default platform
  ai_monthly_limit   int,
  onboarding_completed_at timestamptz,
  created_by         uuid,                              -- persons.id (FK ditambah selepas jadual persons)
  created_at         timestamptz not null default now()
);

create table persons (
  id                uuid primary key default gen_random_uuid(),
  auth_user_id      uuid unique references auth.users(id) on delete set null,
  full_name         text not null,
  preferred_name    text,                               -- nama panggilan untuk WhatsApp
  ic_no             text unique,
  passport_no       text,
  date_of_birth     date,
  gender            text check (gender in ('L','P')),
  marital_status    text,
  phone_whatsapp    text unique,                        -- format 60123456789; kunci untuk agent
  email             text,
  address           text,
  bank_name         text,
  bank_account_no   text,
  photo_path        text,
  language          text not null default 'ms' check (language in ('ms','en')),
  is_active         boolean not null default true,       -- superadmin boleh nyahaktif
  hide_birthday     boolean not null default false,
  spouse_working    boolean,                              -- untuk PCB
  children_count    int not null default 0 check (children_count >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table emergency_contacts (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references persons(id) on delete cascade,
  name        text not null,
  relationship text,
  phone       text not null
);

create table departments (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  name            text not null,
  head_person_id  uuid references persons(id),
  unique (company_id, name)
);

create table positions (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  title       text not null,
  unique (company_id, title)
);

create table employments (
  id                 uuid primary key default gen_random_uuid(),
  person_id          uuid not null references persons(id) on delete restrict,
  company_id         uuid not null references companies(id) on delete restrict,
  employee_no        text not null,
  department_id      uuid references departments(id),
  position_id        uuid references positions(id),
  manager_person_id  uuid references persons(id),
  employment_type    employment_type not null default 'permanent',
  status             employment_status not null default 'probation',
  join_date          date not null,
  confirm_date       date,
  probation_end_date date,
  contract_end_date  date,
  end_date           date,
  work_state         text,                              -- jika lain dari negeri syarikat
  attendance_workno  text,                              -- no. pekerja dalam CrossChex
  work_start         time,                              -- override waktu masuk syarikat
  epf_no             text,
  socso_no           text,
  tax_no             text,
  created_at         timestamptz not null default now(),
  unique (company_id, employee_no),
  unique (company_id, attendance_workno)
);
-- satu pekerjaan aktif bagi setiap orang di setiap syarikat
create unique index employments_one_active
  on employments(person_id, company_id) where status in ('probation','active');

create table employee_documents (
  id             uuid primary key default gen_random_uuid(),
  employment_id  uuid not null references employments(id) on delete cascade,
  doc_type       text not null,      -- 'offer_letter','ic','certificate','warning_letter'...
  title          text not null,
  storage_path   text not null,      -- Supabase Storage (bucket peribadi)
  uploaded_by    uuid references persons(id),
  created_at     timestamptz not null default now()
);

-- company_id NULL + role 'admin' = admin semua syarikat
create table user_roles (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references persons(id) on delete cascade,
  company_id  uuid not null references companies(id) on delete cascade,
  role        app_role not null,
  unique (person_id, company_id, role)
);

create table public_holidays (
  id          uuid primary key default gen_random_uuid(),
  holiday_date date not null,
  name        text not null,
  is_mandatory boolean not null default false,  -- 5 wajib Akta Kerja s.60D (tak boleh dibuang)
  is_adhoc    boolean not null default false,   -- diumumkan bawah Akta Hari Kelepasan s.8 (sentiasa terpakai)
  state       text,                  -- NULL = seluruh negara
  company_id  uuid references companies(id) on delete cascade,  -- NULL = semua syarikat
  unique nulls not distinct (holiday_date, state, company_id)
);

-- ---------------------------------------------------------------------
-- CUTI
-- ---------------------------------------------------------------------
create table leave_types (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references companies(id) on delete cascade,
  code                 text not null,           -- 'AL','MC','HL','ML','PL','EL','UL'
  name                 text not null,
  is_paid              boolean not null default true,
  deduct_balance       boolean not null default true,
  requires_attachment  boolean not null default false,
  sla_exempt           boolean not null default false,  -- MC / kecemasan: dimohon selepas kejadian
  allow_backdate       boolean not null default false,
  max_carry_forward    numeric(5,1) not null default 0,
  eligible_gender      text check (eligible_gender in ('L','P')),
  active               boolean not null default true,
  sort_order           int not null default 0,
  unique (company_id, code)
);

-- kelayakan ikut tempoh berkhidmat (bulan)
create table leave_entitlement_rules (
  id                  uuid primary key default gen_random_uuid(),
  leave_type_id       uuid not null references leave_types(id) on delete cascade,
  min_service_months  int not null default 0,
  max_service_months  int,                 -- NULL = tiada had atas
  days_per_year       numeric(5,1) not null
);

create table leave_balances (
  id               uuid primary key default gen_random_uuid(),
  employment_id    uuid not null references employments(id) on delete cascade,
  leave_type_id    uuid not null references leave_types(id) on delete cascade,
  year             int not null,
  entitled         numeric(5,1) not null default 0,
  carried_forward  numeric(5,1) not null default 0,
  adjustment       numeric(5,1) not null default 0,
  used             numeric(5,1) not null default 0,
  pending          numeric(5,1) not null default 0,
  available        numeric(5,1) generated always as (entitled + carried_forward + adjustment - used - pending) stored,
  unique (employment_id, leave_type_id, year)
);

create table leave_requests (
  id                   uuid primary key default gen_random_uuid(),
  employment_id        uuid not null references employments(id) on delete cascade,
  leave_type_id        uuid not null references leave_types(id),
  start_date           date not null,
  end_date             date not null,
  half_day             leave_half not null default 'full',   -- hanya jika 1 hari
  days                 numeric(5,1) not null default 0,       -- dikira automatik
  reason               text,
  attachment_path      text,
  cover_person_id      uuid references persons(id),     -- PIC ganti semasa cuti
  status               request_status not null default 'draft',
  approval_request_id  uuid,
  created_via          action_channel not null default 'web',
  created_at           timestamptz not null default now(),
  check (end_date >= start_date),
  check (half_day = 'full' or start_date = end_date)
);

-- ---------------------------------------------------------------------
-- TUNTUTAN
-- ---------------------------------------------------------------------
create table claim_types (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references companies(id) on delete cascade,
  name               text not null,           -- 'Mileage','Parking','Makan','Grab/Teksi','Per diem'
  limit_per_item     numeric(12,2),
  limit_per_month    numeric(12,2),
  requires_receipt   boolean not null default true,
  mileage_rate       numeric(6,2),            -- RM/km jika jenis mileage
  account_ref        text,                    -- akaun perbelanjaan dalam QuickBooks/Niagawan
  active             boolean not null default true,
  unique (company_id, name)
);

create table claims (
  id                   uuid primary key default gen_random_uuid(),
  employment_id        uuid not null references employments(id) on delete cascade,
  title                text not null,
  total_amount         numeric(12,2) not null default 0,   -- dikira dari item
  status               request_status not null default 'draft',
  approval_request_id  uuid,
  paid_at              timestamptz,
  paid_via_payroll_run uuid,
  created_via          action_channel not null default 'web',
  created_at           timestamptz not null default now()
);

create table claim_items (
  id              uuid primary key default gen_random_uuid(),
  claim_id        uuid not null references claims(id) on delete cascade,
  claim_type_id   uuid not null references claim_types(id),
  expense_date    date not null,
  description     text,
  amount          numeric(12,2) not null check (amount >= 0),
  distance_km     numeric(8,1),
  receipt_path    text,
  ai_extracted    jsonb,           -- hasil bacaan resit oleh AI (kedai, jumlah, tarikh, keyakinan)
  ai_flags        text[]           -- 'over_limit','duplicate_receipt','weekend' ...
);

-- ---------------------------------------------------------------------
-- KEHADIRAN (data datang dari sistem luar)
-- ---------------------------------------------------------------------
create table attendance_records (
  id             uuid primary key default gen_random_uuid(),
  employment_id  uuid not null references employments(id) on delete cascade,
  work_date      date not null,
  clock_in       timestamptz,
  clock_out      timestamptz,
  late_minutes   int not null default 0,       -- dikira automatik
  source         text not null default 'external',
  external_id    text,
  raw            jsonb,
  created_at     timestamptz not null default now(),
  unique (employment_id, work_date),
  unique (source, external_id)
);

create table attendance_corrections (
  id                   uuid primary key default gen_random_uuid(),
  employment_id        uuid not null references employments(id) on delete cascade,
  work_date            date not null,
  requested_clock_in   timestamptz,
  requested_clock_out  timestamptz,
  reason               text not null,
  status               request_status not null default 'draft',
  approval_request_id  uuid,
  created_via          action_channel not null default 'web',
  created_at           timestamptz not null default now()
);

create table integration_keys (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  name        text not null,           -- 'Sistem kehadiran X'
  key_hash    text not null,           -- simpan hash sahaja
  scopes      text[] not null default '{attendance:write}',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- ENJIN KELULUSAN
-- ---------------------------------------------------------------------
create table approval_workflows (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  request_type  request_type not null,
  name          text not null,
  sla           sla_mode not null default 'same_day',
  sla_hours     int,                          -- jika sla = 'hours'
  cutoff_time   time not null default '17:00',-- selepas masa ini dikira hari bekerja berikutnya
  reminder_every_hours int not null default 2,
  active        boolean not null default true,
  unique (company_id, request_type)
);

create table approval_workflow_steps (
  id                  uuid primary key default gen_random_uuid(),
  workflow_id         uuid not null references approval_workflows(id) on delete cascade,
  step_order          int not null,
  name                text not null,                 -- 'Ketua Jabatan','HR','CEO'
  approver            approver_type not null,
  approver_person_id  uuid references persons(id),   -- jika specific_person
  approver_role       app_role,                      -- jika role
  mode                step_mode not null default 'any',
  condition           jsonb not null default '{}',   -- cth {"field":"days","op":">","value":3}
  skip_if_requester   boolean not null default true,
  unique (workflow_id, step_order),
  check (approver <> 'specific_person' or approver_person_id is not null),
  check (approver <> 'role' or approver_role is not null)
);

create table approval_requests (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references companies(id) on delete cascade,
  workflow_id             uuid references approval_workflows(id),
  request_type            request_type not null,
  reference_id            uuid not null,             -- id dalam jadual modul
  requester_employment_id uuid references employments(id),
  requester_person_id     uuid not null references persons(id),
  title                   text not null,             -- "Cuti Tahunan 12–14 Dis (3 hari)"
  context                 jsonb not null default '{}',-- data ringkas untuk syarat & paparan
  ai_summary              text,                      -- ringkasan oleh agent untuk approver
  current_step_order      int not null default 0,
  status                  request_status not null default 'pending',
  sla_due_at              timestamptz,
  sla_breached            boolean not null default false,
  submitted_at            timestamptz not null default now(),
  completed_at            timestamptz
);
create index on approval_requests(company_id, status);
create index on approval_requests(requester_person_id, status);
create index on approval_requests(reference_id);

create table approval_tasks (
  id                   uuid primary key default gen_random_uuid(),
  request_id           uuid not null references approval_requests(id) on delete cascade,
  step_order           int not null,
  step_name            text not null,
  approver_person_id   uuid not null references persons(id),
  delegated_from       uuid references persons(id),
  status               task_status not null default 'pending',
  comment              text,
  acted_at             timestamptz,
  acted_via            action_channel,
  last_reminded_at     timestamptz,
  created_at           timestamptz not null default now()
);
create index on approval_tasks(approver_person_id, status);

-- log audit: hanya tambah, tak boleh ubah/padam
create table approval_actions (
  id          bigint generated always as identity primary key,
  request_id  uuid not null references approval_requests(id) on delete cascade,
  step_order  int,
  actor_person_id uuid references persons(id),
  action      text not null,     -- submitted, approved, rejected, returned, skipped, cancelled, completed, sla_breached
  comment     text,
  via         action_channel not null default 'web',
  created_at  timestamptz not null default now()
);

create table approval_delegations (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  from_person_id  uuid not null references persons(id),
  to_person_id    uuid not null references persons(id),
  start_date      date not null,
  end_date        date not null,
  request_types   request_type[],          -- NULL = semua jenis
  check (from_person_id <> to_person_id),
  check (end_date >= start_date)
);

alter table leave_requests         add foreign key (approval_request_id) references approval_requests(id);
alter table claims                 add foreign key (approval_request_id) references approval_requests(id);
alter table attendance_corrections add foreign key (approval_request_id) references approval_requests(id);

-- ---------------------------------------------------------------------
-- GAJI
-- ---------------------------------------------------------------------
-- Kadar berkanun sebagai data. HR/admin kemas kini bila kerajaan tukar.
create table statutory_rates (
  id              uuid primary key default gen_random_uuid(),
  code            text not null,     -- 'EPF','SOCSO','EIS','HRDF','PCB'
  effective_from  date not null,
  effective_to    date,
  params          jsonb not null,    -- jadual/kadar; dibaca oleh Edge Function payroll
  notes           text,
  unique (code, effective_from)
);

create table pay_components (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies(id) on delete cascade,
  code              text not null,          -- 'BASIC','TRANSPORT','PHONE','COMMISSION','OT','UNPAID'
  name              text not null,
  kind              text not null check (kind in ('earning','deduction')),
  taxable           boolean not null default true,
  epf_applicable    boolean not null default true,
  socso_applicable  boolean not null default true,
  account_ref       text,
  unique (company_id, code)
);

create table employment_compensation (
  id              uuid primary key default gen_random_uuid(),
  employment_id   uuid not null references employments(id) on delete cascade,
  component_id    uuid not null references pay_components(id),
  amount          numeric(12,2) not null,
  effective_from  date not null,
  effective_to    date
);

create table payroll_runs (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references companies(id) on delete cascade,
  period_year          int not null,
  period_month         int not null check (period_month between 1 and 12),
  pay_date             date,
  status               payroll_status not null default 'draft',
  approval_request_id  uuid references approval_requests(id),
  totals               jsonb,               -- jumlah kasar, bersih, caruman
  prepared_by          uuid references persons(id),
  created_at           timestamptz not null default now(),
  unique (company_id, period_year, period_month)
);

create table payslips (
  id              uuid primary key default gen_random_uuid(),
  payroll_run_id  uuid not null references payroll_runs(id) on delete cascade,
  employment_id   uuid not null references employments(id),
  gross           numeric(12,2) not null default 0,
  total_deduction numeric(12,2) not null default 0,
  net             numeric(12,2) not null default 0,
  epf_employee    numeric(12,2) not null default 0,
  epf_employer    numeric(12,2) not null default 0,
  socso_employee  numeric(12,2) not null default 0,
  socso_employer  numeric(12,2) not null default 0,
  eis_employee    numeric(12,2) not null default 0,
  eis_employer    numeric(12,2) not null default 0,
  pcb             numeric(12,2) not null default 0,
  hrdf            numeric(12,2) not null default 0,
  unpaid_leave_days numeric(5,1) not null default 0,
  pdf_path        text,
  unique (payroll_run_id, employment_id)
);

create table payslip_lines (
  id           uuid primary key default gen_random_uuid(),
  payslip_id   uuid not null references payslips(id) on delete cascade,
  component_code text not null,
  description  text not null,
  kind         text not null check (kind in ('earning','deduction','employer')),
  amount       numeric(12,2) not null
);

-- ---------------------------------------------------------------------
-- INTEGRASI PERAKAUNAN (QuickBooks / Niagawan / CSV)
-- ---------------------------------------------------------------------
create table accounting_sync_queue (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  system        accounting_system not null,
  entity_type   text not null check (entity_type in ('claim','payroll_run')),
  entity_id     uuid not null,
  status        sync_status not null default 'pending',
  external_ref  text,             -- id bill/journal dalam QuickBooks
  attempts      int not null default 0,
  error         text,
  created_at    timestamptz not null default now(),
  synced_at     timestamptz,
  unique (entity_type, entity_id)
);

-- ---------------------------------------------------------------------
-- KEJADIAN, AUTOMASI & NOTIFIKASI  (asas untuk AI agent)
-- ---------------------------------------------------------------------
-- Setiap perkara penting jadi satu event. Agent & automasi baca dari sini.
create table hr_events (
  id                 bigint generated always as identity primary key,
  company_id         uuid references companies(id) on delete cascade,
  event_type         text not null,   -- lihat senarai di bawah
  subject_person_id  uuid references persons(id),
  subject_employment_id uuid references employments(id),
  payload            jsonb not null default '{}',
  processed_at       timestamptz,
  created_at         timestamptz not null default now()
);
create index on hr_events(processed_at) where processed_at is null;
-- event_type yang digunakan:
--   attendance.late, attendance.absent, attendance.no_clock_out
--   approval.task_assigned, approval.reminder, approval.sla_breached
--   approval.approved, approval.rejected, approval.returned
--   leave.submitted, claim.submitted, payslip.ready
--   employment.probation_ending, employment.contract_ending, leave.balance_expiring

-- Peraturan: "bila event X (dan syarat Y), hantar WhatsApp kepada Z"
create table automation_rules (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  name           text not null,
  event_type     text not null,
  condition      jsonb not null default '{}',     -- format sama dengan syarat approval
  target         notify_target not null default 'subject',
  target_person_id uuid references persons(id),
  channel        text not null default 'whatsapp' check (channel in ('whatsapp','email','in_app')),
  message_template text not null,                -- guna {{nama}}, {{masa}} dsb
  use_ai_rewrite boolean not null default false,  -- benarkan agent ubah ayat ikut konteks
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table notifications (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid references companies(id) on delete cascade,
  person_id      uuid not null references persons(id) on delete cascade,
  channel        text not null default 'whatsapp',
  to_address     text,                 -- no. WhatsApp / email
  message        text not null,
  event_id       bigint references hr_events(id),
  rule_id        uuid references automation_rules(id),
  status         notify_status not null default 'pending',
  provider_ref   text,                 -- id mesej Murpati
  error          text,
  created_at     timestamptz not null default now(),
  sent_at        timestamptz
);
create index on notifications(status) where status = 'pending';

-- ---------------------------------------------------------------------
-- AI AGENT
-- ---------------------------------------------------------------------
create table ai_knowledge_docs (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references companies(id) on delete cascade,  -- NULL = semua syarikat
  title       text not null,          -- 'Handbook MTB', 'Polisi Claim'
  source_path text,
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);

create table ai_knowledge_chunks (
  id         bigint generated always as identity primary key,
  doc_id     uuid not null references ai_knowledge_docs(id) on delete cascade,
  content    text not null,
  embedding  vector(1536)
);

create table ai_conversations (
  id               uuid primary key default gen_random_uuid(),
  person_id        uuid references persons(id) on delete cascade,
  channel          action_channel not null default 'whatsapp',
  external_chat_id text,             -- id chat Murpati
  active_company_id uuid references companies(id),  -- syarikat yang sedang dibincang
  created_at       timestamptz not null default now(),
  last_message_at  timestamptz
);

create table ai_messages (
  id               bigint generated always as identity primary key,
  conversation_id  uuid not null references ai_conversations(id) on delete cascade,
  role             text not null check (role in ('user','assistant','tool')),
  content          text,
  tool_calls       jsonb,
  created_at       timestamptz not null default now()
);

-- setiap tindakan yang agent buat bagi pihak seseorang
create table ai_action_log (
  id               bigint generated always as identity primary key,
  conversation_id  uuid references ai_conversations(id) on delete set null,
  on_behalf_of     uuid references persons(id),
  action           text not null,          -- 'submit_leave','approve_task','create_claim'
  target_table     text,
  target_id        uuid,
  payload          jsonb,
  created_at       timestamptz not null default now()
);

-- log akses data sensitif (PDPA)
create table data_access_log (
  id                bigint generated always as identity primary key,
  actor_person_id   uuid references persons(id),
  subject_person_id uuid references persons(id),
  resource          text not null,          -- 'profile','bank','payslip','document'
  via               action_channel not null default 'web',
  created_at        timestamptz not null default now()
);

-- =====================================================================
--  PLATFORM (v0.2): superadmin, akses silang syarikat, penggunaan,
--  jemputan & onboarding, cuti umum pilihan, CrossChex
-- =====================================================================
alter table companies add foreign key (created_by) references persons(id);

-- Pemilik platform HRBoost. Bukan peranan syarikat.
create table platform_admins (
  person_id   uuid primary key references persons(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table platform_settings (
  key    text primary key,      -- 'registration_open','default_wa_limit','default_ai_limit','retention_days','warn_pct'
  value  jsonb not null
);

-- Akses ke syarikat yang BUKAN tempat seseorang bekerja. Wajib lulus superadmin.
create table company_access_grants (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references persons(id) on delete cascade,
  company_id    uuid not null references companies(id) on delete cascade,
  role          app_role not null check (role in ('staff','hr','finance','ceo','admin')),
  reason        text not null,
  days          int not null check (days between 1 and 365),
  status        text not null default 'pending' check (status in ('pending','approved','rejected','revoked')),
  decided_by    uuid references persons(id),
  decided_at    timestamptz,
  decision_note text,
  expires_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index on company_access_grants(person_id, company_id, status);

-- Pilihan cuti umum syarikat setiap tahun (selain yang wajib / ad hoc)
create table company_holiday_choices (
  company_id  uuid not null references companies(id) on delete cascade,
  holiday_id  uuid not null references public_holidays(id) on delete cascade,
  year        int not null,
  primary key (company_id, holiday_id)
);

-- CrossChex: setiap punch mentah. employment_id NULL = workno belum dipadankan.
create table attendance_punches (
  id             bigint generated always as identity primary key,
  company_id     uuid not null references companies(id) on delete cascade,
  employment_id  uuid references employments(id) on delete set null,
  workno         text not null,
  external_uuid  text not null,
  punched_at     timestamptz not null,
  checktype      int,
  device_sn      text,
  device_name    text,
  raw            jsonb,
  created_at     timestamptz not null default now(),
  unique (company_id, external_uuid)
);
create index on attendance_punches(company_id, workno) where employment_id is null;

create table integration_sync_state (
  company_id       uuid not null references companies(id) on delete cascade,
  provider         text not null,           -- 'crosschex','quickbooks'
  last_synced_at   timestamptz,
  last_cursor      text,
  token_expires_at timestamptz,             -- token sebenar dalam Supabase Vault / secrets
  last_error       text,
  updated_at       timestamptz not null default now(),
  primary key (company_id, provider)
);

-- Jemputan staff melalui WhatsApp (pautan peribadi, tamat 7 hari)
create table employee_invites (
  id             uuid primary key default gen_random_uuid(),
  employment_id  uuid not null references employments(id) on delete cascade,
  token_hash     text not null unique,      -- sha256 token; token mentah hanya dalam pautan WhatsApp
  expires_at     timestamptz not null default now() + interval '7 days',
  sent_at        timestamptz,
  accepted_at    timestamptz,
  attempts       int not null default 0,
  created_at     timestamptz not null default now()
);

create table onboarding_progress (
  employment_id  uuid not null references employments(id) on delete cascade,
  step           text not null check (step in ('activate','name','selfie','bank','ic','personal','handbook','install')),
  done_at        timestamptz not null default now(),
  primary key (employment_id, step)
);

create table company_onboarding_progress (
  company_id  uuid not null references companies(id) on delete cascade,
  step        text not null check (step in ('admin','company','import','departments','roles','invite')),
  done_at     timestamptz not null default now(),
  primary key (company_id, step)
);

create table usage_counters (
  company_id  uuid not null references companies(id) on delete cascade,
  month       date not null,               -- hari pertama bulan
  wa_sent     int not null default 0,
  ai_calls    int not null default 0,
  primary key (company_id, month)
);

-- Log audit platform: tidak boleh ubah/padam (tiada polisi update/delete)
create table platform_audit_log (
  id               bigint generated always as identity primary key,
  actor_person_id  uuid references persons(id),
  action           text not null,   -- company.suspend, company.restore, person.deactivate, grant.request, grant.approve, grant.reject, grant.revoke, limits.update
  company_id       uuid references companies(id) on delete set null,
  target_type      text,
  target_id        uuid,
  details          jsonb not null default '{}',
  created_at       timestamptz not null default now()
);

-- =====================================================================
--  FUNGSI ASAS
-- =====================================================================

create or replace function current_person_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from persons where auth_user_id = auth.uid() and is_active
$$;

create or replace function is_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where person_id = current_person_id())
$$;

create or replace function is_company_active(p_company uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select status = 'active' from companies where id = p_company), false)
$$;

create or replace function is_service_role() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role'
$$;

-- Peranan HANYA dalam syarikat itu sendiri, atau melalui akses yang diluluskan superadmin.
-- Syarikat yang dinyahaktif: tiada peranan berkuat kuasa.
create or replace function has_role(p_company uuid, p_roles app_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select is_company_active(p_company) and (
    exists (select 1 from user_roles
             where person_id = current_person_id() and company_id = p_company and role = any(p_roles))
    or exists (select 1 from company_access_grants g
                where g.person_id = current_person_id() and g.company_id = p_company
                  and g.status = 'approved' and g.role = any(p_roles)
                  and now() < coalesce(g.expires_at, 'infinity'::timestamptz))
  )
$$;

create or replace function is_company_member(p_company uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_company_active(p_company) and (
    exists (select 1 from employments e where e.company_id = p_company
              and e.person_id = current_person_id() and e.status in ('probation','active'))
    or has_role(p_company, '{staff,dept_head,hr,finance,ceo,admin}')
  )
$$;

-- boleh lihat rekod pekerjaan ini? (diri sendiri, ketua jabatan, pengurus terus, HR/CEO/admin)
create or replace function can_view_employment(p_employment uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from employments e
    left join departments d on d.id = e.department_id
    where e.id = p_employment
      and ( e.person_id = current_person_id()
         or e.manager_person_id = current_person_id()
         or d.head_person_id = current_person_id()
         or has_role(e.company_id, '{hr,ceo,admin}') )
  )
$$;

create or replace function employment_company(p_employment uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select company_id from employments where id = p_employment
$$;

-- hari bekerja? (ikut hujung minggu syarikat & cuti umum negeri)
-- Hari bekerja? Cuti umum yang dikira:
--   • wajib (is_mandatory) dan ad hoc (is_adhoc) — sentiasa
--   • yang lain: jika syarikat ada pilihan untuk tahun itu, hanya yang dipilih;
--     jika belum memilih, semua cuti umum negeri itu (default selamat).
create or replace function is_working_day(p_company uuid, p_date date, p_state text default null)
returns boolean language sql stable security definer set search_path = public as $$
  select not (extract(dow from p_date)::int = any(c.weekend_days))
     and not exists (
       select 1 from public_holidays h
       where h.holiday_date = p_date
         and (h.company_id is null or h.company_id = c.id)
         and (h.state is null or h.state = coalesce(p_state, c.state))
         and ( h.is_mandatory or h.is_adhoc
               or not exists (select 1 from company_holiday_choices x
                               where x.company_id = c.id and x.year = extract(year from p_date)::int)
               or exists (select 1 from company_holiday_choices x
                           where x.company_id = c.id and x.holiday_id = h.id) ))
  from companies c where c.id = p_company
$$;

create or replace function next_working_day(p_company uuid, p_date date) returns date
language plpgsql stable security definer set search_path = public as $$
declare d date := p_date + 1;
begin
  while not is_working_day(p_company, d) loop d := d + 1; end loop;
  return d;
end $$;

-- format tarikh & nombor dalam Bahasa Melayu (untuk tajuk & mesej WhatsApp)
create or replace function fmt_tarikh(d date) returns text language sql immutable as $$
  select extract(day from d)::int || ' ' ||
         (array['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogo','Sep','Okt','Nov','Dis'])[extract(month from d)::int]
$$;
create or replace function fmt_num(n numeric) returns text language sql immutable as $$
  select case when n = trunc(n) then trunc(n)::text else n::text end
$$;

-- penilai syarat ringkas: {"field","op","value"} | {"all":[...]} | {"any":[...]}
create or replace function eval_condition(cond jsonb, ctx jsonb) returns boolean
language plpgsql immutable as $$
declare c jsonb; lhs jsonb; rhs jsonb; op text;
begin
  if cond is null or cond = '{}'::jsonb then return true; end if;
  if cond ? 'all' then
    for c in select value from jsonb_array_elements(cond->'all') loop
      if not eval_condition(c, ctx) then return false; end if;
    end loop;
    return true;
  end if;
  if cond ? 'any' then
    for c in select value from jsonb_array_elements(cond->'any') loop
      if eval_condition(c, ctx) then return true; end if;
    end loop;
    return false;
  end if;
  lhs := ctx -> (cond->>'field'); rhs := cond->'value'; op := cond->>'op';
  if lhs is null or lhs = 'null'::jsonb then return false; end if;
  if op = 'in' then return rhs @> jsonb_build_array(lhs); end if;
  if jsonb_typeof(lhs) = 'number' and jsonb_typeof(rhs) = 'number' then
    return case op
      when '>'  then lhs::numeric >  rhs::numeric
      when '>=' then lhs::numeric >= rhs::numeric
      when '<'  then lhs::numeric <  rhs::numeric
      when '<=' then lhs::numeric <= rhs::numeric
      when '='  then lhs::numeric =  rhs::numeric
      when '!=' then lhs::numeric <> rhs::numeric
      else false end;
  end if;
  return case op when '=' then lhs = rhs when '!=' then lhs <> rhs else false end;
end $$;

-- tulis event (dipanggil oleh fungsi lain)
create or replace function emit_event(p_company uuid, p_type text, p_person uuid,
                                      p_employment uuid, p_payload jsonb)
returns bigint language sql security definer set search_path = public as $$
  insert into hr_events(company_id, event_type, subject_person_id, subject_employment_id, payload)
  values (p_company, p_type, p_person, p_employment, coalesce(p_payload,'{}'))
  returning id
$$;

-- =====================================================================
--  CUTI: kiraan hari & baki
-- =====================================================================
create or replace function leave_count_days(p_employment uuid, p_start date, p_end date, p_half leave_half)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare v_company uuid; v_state text; d date; n numeric := 0;
begin
  select e.company_id, e.work_state into v_company, v_state from employments e where e.id = p_employment;
  d := p_start;
  while d <= p_end loop
    if is_working_day(v_company, d, v_state) then n := n + 1; end if;
    d := d + 1;
  end loop;
  if p_half <> 'full' and n > 0 then n := 0.5; end if;
  return n;
end $$;

create or replace function trg_leave_days() returns trigger
language plpgsql as $$
begin
  new.days := leave_count_days(new.employment_id, new.start_date, new.end_date, new.half_day);
  return new;
end $$;
create trigger leave_requests_days before insert or update of start_date, end_date, half_day
  on leave_requests for each row execute function trg_leave_days();

-- kelayakan ikut tempoh berkhidmat
create or replace function leave_entitlement(p_employment uuid, p_leave_type uuid, p_year int)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((
    select r.days_per_year from leave_entitlement_rules r, employments e
    where r.leave_type_id = p_leave_type and e.id = p_employment
      and (extract(year from age(make_date(p_year,1,1), e.join_date))*12
           + extract(month from age(make_date(p_year,1,1), e.join_date))) >= r.min_service_months
      and (r.max_service_months is null or
           (extract(year from age(make_date(p_year,1,1), e.join_date))*12
           + extract(month from age(make_date(p_year,1,1), e.join_date))) < r.max_service_months)
    order by r.min_service_months desc limit 1), 0)
$$;

-- pastikan rekod baki wujud
create or replace function ensure_leave_balance(p_employment uuid, p_leave_type uuid, p_year int)
returns leave_balances language plpgsql security definer set search_path = public as $$
declare b leave_balances;
begin
  insert into leave_balances(employment_id, leave_type_id, year, entitled)
  values (p_employment, p_leave_type, p_year, leave_entitlement(p_employment, p_leave_type, p_year))
  on conflict (employment_id, leave_type_id, year) do nothing;
  select * into b from leave_balances
   where employment_id = p_employment and leave_type_id = p_leave_type and year = p_year;
  return b;
end $$;

-- =====================================================================
--  ENJIN KELULUSAN
-- =====================================================================

-- tarikh akhir SLA
create or replace function approval_sla_due(p_company uuid, p_wf approval_workflows, p_at timestamptz, p_exempt boolean)
returns timestamptz language plpgsql stable security definer set search_path = public as $$
declare c companies; local_ts timestamp; d date;
begin
  if p_exempt or p_wf.sla = 'none' then return null; end if;
  if p_wf.sla = 'hours' then return p_at + make_interval(hours => coalesce(p_wf.sla_hours, 24)); end if;
  select * into c from companies where id = p_company;
  local_ts := p_at at time zone c.timezone;
  d := local_ts::date;
  if local_ts::time > p_wf.cutoff_time or not is_working_day(p_company, d) then
    d := next_working_day(p_company, d);
  end if;
  return (d + c.work_end) at time zone c.timezone;
end $$;

-- cari approver bagi satu tier (selepas wakil & buang pemohon sendiri)
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
     where r.role = p_step.approver_role and r.company_id = p_req.company_id;
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

-- kemas kini status rekod modul selepas keputusan
create or replace function approval_apply_outcome(p_req approval_requests)
returns void language plpgsql security definer set search_path = public as $$
declare lr leave_requests; yr int; st request_status := p_req.status;
begin
  if p_req.request_type = 'leave' then
    update leave_requests set status = st where id = p_req.reference_id returning * into lr;
    yr := extract(year from lr.start_date);
    if exists (select 1 from leave_types t where t.id = lr.leave_type_id and t.deduct_balance) then
      update leave_balances set
        pending = greatest(pending - lr.days, 0),
        used    = used + case when st = 'approved' then lr.days else 0 end
      where employment_id = lr.employment_id and leave_type_id = lr.leave_type_id and year = yr;
    end if;
    if st = 'approved' then
      perform emit_event(p_req.company_id, 'leave.approved', p_req.requester_person_id,
        p_req.requester_employment_id,
        jsonb_build_object('leave_request_id', lr.id, 'days', fmt_num(lr.days),
          'tarikh', fmt_tarikh(lr.start_date) ||
            case when lr.end_date <> lr.start_date then ' – ' || fmt_tarikh(lr.end_date) else '' end,
          'status', 'diluluskan', 'cover_person_id', lr.cover_person_id,
          'pic', (select coalesce(preferred_name, full_name) from persons where id = lr.cover_person_id)));
    end if;
  elsif p_req.request_type = 'claim' then
    update claims set status = st where id = p_req.reference_id;
    if st = 'approved' then
      insert into accounting_sync_queue(company_id, system, entity_type, entity_id, status)
      select c.id, c.accounting_system, 'claim', p_req.reference_id,
             case when c.accounting_system = 'none' then 'skipped'::sync_status else 'pending' end
      from companies c where c.id = p_req.company_id
      on conflict (entity_type, entity_id) do nothing;
    end if;
  elsif p_req.request_type = 'attendance_correction' then
    update attendance_corrections set status = st where id = p_req.reference_id;
    if st = 'approved' then
      insert into attendance_records(employment_id, work_date, clock_in, clock_out, source)
      select employment_id, work_date, requested_clock_in, requested_clock_out, 'correction'
        from attendance_corrections where id = p_req.reference_id
      on conflict (employment_id, work_date) do update
        set clock_in  = coalesce(excluded.clock_in,  attendance_records.clock_in),
            clock_out = coalesce(excluded.clock_out, attendance_records.clock_out),
            late_minutes = 0;
    end if;
  elsif p_req.request_type = 'payroll_run' then
    update payroll_runs set status = st::text::payroll_status where id = p_req.reference_id;
    if st = 'approved' then
      insert into accounting_sync_queue(company_id, system, entity_type, entity_id, status)
      select c.id, c.accounting_system, 'payroll_run', p_req.reference_id,
             case when c.accounting_system = 'none' then 'skipped'::sync_status else 'pending' end
      from companies c where c.id = p_req.company_id
      on conflict (entity_type, entity_id) do nothing;
    end if;
  end if;

  if st in ('approved','rejected','returned') then
    perform emit_event(p_req.company_id, 'approval.' || st::text, p_req.requester_person_id,
                       p_req.requester_employment_id,
                       jsonb_build_object('request_id', p_req.id, 'title', p_req.title,
                                          'request_type', p_req.request_type));
  end if;
end $$;

-- gerak ke tier seterusnya yang sah; jika tiada lagi = LULUS
create or replace function approval_advance(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r approval_requests; s approval_workflow_steps; n int;
begin
  select * into r from approval_requests where id = p_request for update;
  for s in select * from approval_workflow_steps
           where workflow_id = r.workflow_id and step_order > r.current_step_order
           order by step_order loop
    if not eval_condition(s.condition, r.context) then
      insert into approval_actions(request_id, step_order, action, comment, via)
      values (r.id, s.step_order, 'skipped', s.name || ': syarat tidak dipenuhi', 'system');
      continue;
    end if;

    insert into approval_tasks(request_id, step_order, step_name, approver_person_id, delegated_from)
    select r.id, s.step_order, s.name, a.approver, a.delegated_from
      from approval_resolve_approvers(r, s) a;
    get diagnostics n = row_count;

    if n = 0 then
      insert into approval_actions(request_id, step_order, action, comment, via)
      values (r.id, s.step_order, 'skipped', s.name || ': tiada approver lain', 'system');
      continue;
    end if;

    update approval_requests set current_step_order = s.step_order where id = r.id;
    perform emit_event(r.company_id, 'approval.task_assigned', t.approver_person_id, null,
                       jsonb_build_object('request_id', r.id, 'task_id', t.id, 'title', r.title,
                                          'step', s.name, 'sla_due_at', r.sla_due_at))
      from approval_tasks t where t.request_id = r.id and t.step_order = s.step_order;
    return;
  end loop;

  update approval_requests set status = 'approved', completed_at = now() where id = r.id
  returning * into r;
  insert into approval_actions(request_id, action, via) values (r.id, 'completed', 'system');
  perform approval_apply_outcome(r);
end $$;

-- cipta permohonan kelulusan (generik)
create or replace function approval_create(p_type request_type, p_reference uuid, p_employment uuid,
                                           p_title text, p_context jsonb, p_sla_exempt boolean,
                                           p_via action_channel)
returns uuid language plpgsql security definer set search_path = public as $$
declare e employments; wf approval_workflows; rid uuid;
begin
  select * into e from employments where id = p_employment;
  select * into wf from approval_workflows
   where company_id = e.company_id and request_type = p_type and active;
  if wf.id is null then
    raise exception 'Tiada aliran kelulusan untuk % di syarikat ini', p_type;
  end if;

  insert into approval_requests(company_id, workflow_id, request_type, reference_id,
         requester_employment_id, requester_person_id, title, context, sla_due_at)
  values (e.company_id, wf.id, p_type, p_reference, e.id, e.person_id, p_title, p_context,
          approval_sla_due(e.company_id, wf, now(), p_sla_exempt))
  returning id into rid;

  insert into approval_actions(request_id, actor_person_id, action, via)
  values (rid, e.person_id, 'submitted', p_via);

  perform approval_advance(rid);
  return rid;
end $$;

-- siapa yang sedang bertindak: pengguna log masuk, atau (service role) orang yang agent wakili
create or replace function resolve_actor(p_on_behalf uuid) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare a uuid := current_person_id();
begin
  if a is null and is_service_role() then a := p_on_behalf; end if;
  if a is null then raise exception 'Tidak dibenarkan'; end if;
  return a;
end $$;

-- ======================  RPC UNTUK UI & AGENT  ======================

-- LULUS / TOLAK / HANTAR BALIK
create or replace function approval_act(p_task uuid, p_action text, p_comment text default null,
                                        p_via action_channel default 'web', p_on_behalf uuid default null)
returns approval_requests language plpgsql security definer set search_path = public as $$
declare t approval_tasks; r approval_requests; s approval_workflow_steps; actor uuid; left_ int;
begin
  actor := resolve_actor(p_on_behalf);
  select * into t from approval_tasks where id = p_task for update;
  if t.id is null or t.approver_person_id <> actor then raise exception 'Tugasan ini bukan untuk anda'; end if;
  if t.status <> 'pending' then raise exception 'Tugasan ini sudah diproses'; end if;
  select * into r from approval_requests where id = t.request_id for update;
  if r.status <> 'pending' then raise exception 'Permohonan tidak lagi aktif'; end if;
  if p_action in ('reject','return') and coalesce(trim(p_comment),'') = '' then
    raise exception 'Sila nyatakan sebab';
  end if;

  update approval_tasks set status = case p_action when 'approve' then 'approved'::task_status
                                                   when 'reject'  then 'rejected'
                                                   when 'return'  then 'returned' end,
         comment = p_comment, acted_at = now(), acted_via = p_via
   where id = t.id;
  insert into approval_actions(request_id, step_order, actor_person_id, action, comment, via)
  values (r.id, t.step_order, actor,
          case p_action when 'approve' then 'approved' when 'reject' then 'rejected' else 'returned' end,
          p_comment, p_via);

  if p_action = 'approve' then
    select st.* into s from approval_workflow_steps st
     where st.workflow_id = r.workflow_id and st.step_order = t.step_order;
    select count(*) into left_ from approval_tasks
     where request_id = r.id and step_order = t.step_order and status = 'pending';
    if s.mode = 'any' or left_ = 0 then
      update approval_tasks set status = 'superseded'
       where request_id = r.id and step_order = t.step_order and status = 'pending';
      perform approval_advance(r.id);
    end if;
  else
    update approval_tasks set status = 'superseded' where request_id = r.id and status = 'pending';
    update approval_requests set status = case p_action when 'reject' then 'rejected'::request_status
                                                        else 'returned' end,
           completed_at = now()
     where id = r.id returning * into r;
    perform approval_apply_outcome(r);
  end if;

  select * into r from approval_requests where id = r.id;
  return r;
end $$;

-- BATAL oleh pemohon (selagi belum selesai)
create or replace function approval_cancel(p_request uuid, p_via action_channel default 'web',
                                           p_on_behalf uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare r approval_requests; actor uuid;
begin
  actor := resolve_actor(p_on_behalf);
  select * into r from approval_requests where id = p_request for update;
  if r.requester_person_id <> actor then raise exception 'Hanya pemohon boleh batal'; end if;
  if r.status <> 'pending' then raise exception 'Permohonan tidak boleh dibatalkan'; end if;
  update approval_tasks set status = 'superseded' where request_id = r.id and status = 'pending';
  update approval_requests set status = 'cancelled', completed_at = now() where id = r.id returning * into r;
  insert into approval_actions(request_id, actor_person_id, action, via) values (r.id, actor, 'cancelled', p_via);
  perform approval_apply_outcome(r);
end $$;

-- MOHON CUTI (satu panggilan: cipta + hantar). Agent WhatsApp guna fungsi yang sama.
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
    raise exception 'Cuti % tidak boleh dimohon untuk tarikh lepas', lt.name;
  end if;
  if lt.requires_attachment and p_attachment is null then
    raise exception 'Cuti % memerlukan dokumen sokongan', lt.name;
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

-- HANTAR TUNTUTAN (claim + item sudah dicipta sebagai 'draft')
create or replace function submit_claim(p_claim uuid, p_via action_channel default 'web',
                                        p_on_behalf uuid default null)
returns claims language plpgsql security definer set search_path = public as $$
declare actor uuid; c claims; e employments; total numeric; rid uuid;
begin
  actor := resolve_actor(p_on_behalf);
  select * into c from claims where id = p_claim for update;
  select * into e from employments where id = c.employment_id;
  if e.person_id <> actor then raise exception 'Bukan tuntutan anda'; end if;
  if c.status not in ('draft','returned') then raise exception 'Tuntutan sudah dihantar'; end if;
  select coalesce(sum(amount),0) into total from claim_items where claim_id = c.id;
  if total = 0 then raise exception 'Tuntutan tiada item'; end if;
  if exists (select 1 from claim_items i join claim_types t on t.id = i.claim_type_id
              where i.claim_id = c.id and t.requires_receipt and i.receipt_path is null) then
    raise exception 'Ada item yang memerlukan resit';
  end if;

  update claims set total_amount = total, status = 'pending' where id = c.id;
  rid := approval_create('claim', c.id, e.id,
           'Tuntutan: ' || c.title || ' (RM ' || to_char(total,'FM999,990.00') || ')',
           jsonb_build_object('amount', total, 'items',
              (select count(*) from claim_items where claim_id = c.id)),
           false, p_via);
  update claims set approval_request_id = rid where id = c.id returning * into c;
  perform emit_event(e.company_id, 'claim.submitted', e.person_id, e.id,
                     jsonb_build_object('claim_id', c.id, 'amount', total));
  select * into c from claims where id = c.id;
  return c;
end $$;

-- MOHON PEMBETULAN KEHADIRAN
create or replace function submit_attendance_correction(p_employment uuid, p_date date,
       p_in timestamptz, p_out timestamptz, p_reason text,
       p_via action_channel default 'web', p_on_behalf uuid default null)
returns attendance_corrections language plpgsql security definer set search_path = public as $$
declare actor uuid; e employments; ac attendance_corrections; rid uuid;
begin
  actor := resolve_actor(p_on_behalf);
  select * into e from employments where id = p_employment;
  if e.person_id <> actor then raise exception 'Bukan rekod anda'; end if;
  insert into attendance_corrections(employment_id, work_date, requested_clock_in, requested_clock_out,
                                     reason, status, created_via)
  values (e.id, p_date, p_in, p_out, p_reason, 'pending', p_via) returning * into ac;
  rid := approval_create('attendance_correction', ac.id, e.id,
           'Pembetulan kehadiran ' || fmt_tarikh(p_date),
           jsonb_build_object('work_date', p_date), false, p_via);
  update attendance_corrections set approval_request_id = rid where id = ac.id returning * into ac;
  return ac;
end $$;

-- HANTAR GAJI UNTUK KELULUSAN (HR selepas kiraan)
create or replace function submit_payroll_run(p_run uuid, p_on_behalf uuid default null)
returns payroll_runs language plpgsql security definer set search_path = public as $$
declare actor uuid; pr payroll_runs; e employments; rid uuid; wf approval_workflows;
begin
  actor := resolve_actor(p_on_behalf);
  select * into pr from payroll_runs where id = p_run for update;
  if not (has_role(pr.company_id, '{hr,admin}') or is_service_role()) then
    raise exception 'Hanya HR boleh hantar gaji';
  end if;
  if pr.status not in ('calculated','returned') then raise exception 'Gaji belum dikira'; end if;
  select * into e from employments where person_id = actor and company_id = pr.company_id
   and status in ('probation','active') limit 1;
  select * into wf from approval_workflows where company_id = pr.company_id
   and request_type = 'payroll_run' and active;
  insert into approval_requests(company_id, workflow_id, request_type, reference_id,
         requester_employment_id, requester_person_id, title, context, sla_due_at)
  values (pr.company_id, wf.id, 'payroll_run', pr.id, e.id, actor,
          'Gaji ' || to_char(make_date(pr.period_year, pr.period_month, 1), 'Mon YYYY'),
          coalesce(pr.totals, '{}'), null)
  returning id into rid;
  insert into approval_actions(request_id, actor_person_id, action, via) values (rid, actor, 'submitted', 'web');
  update payroll_runs set status = 'pending', approval_request_id = rid where id = pr.id;
  perform approval_advance(rid);
  select * into pr from payroll_runs where id = p_run;
  return pr;
end $$;

-- =====================================================================
--  KEHADIRAN: kira lewat bila data masuk → event attendance.late
-- =====================================================================
create or replace function trg_attendance_late() returns trigger
language plpgsql security definer set search_path = public as $$
declare e employments; c companies; start_ts timestamptz;
begin
  if new.clock_in is null or new.source = 'correction' then return new; end if;
  select * into e from employments where id = new.employment_id;
  select * into c from companies where id = e.company_id;
  start_ts := (new.work_date + coalesce(e.work_start, c.work_start)) at time zone c.timezone;
  new.late_minutes := greatest(0, floor(extract(epoch from (new.clock_in - start_ts)) / 60))::int;
  if new.late_minutes > c.late_grace_minutes
     and (tg_op = 'INSERT' or old.clock_in is distinct from new.clock_in) then
    perform emit_event(c.id, 'attendance.late', e.person_id, e.id,
      jsonb_build_object('work_date', new.work_date,
                         'clock_in', to_char(new.clock_in at time zone c.timezone, 'HH24:MI'),
                         'late_minutes', new.late_minutes,
                         'late_count_month', (select count(*) + 1 from attendance_records a
                            where a.employment_id = e.id and a.late_minutes > c.late_grace_minutes
                              and a.work_date <> new.work_date
                              and date_trunc('month', a.work_date) = date_trunc('month', new.work_date))));
  end if;
  return new;
end $$;
create trigger attendance_late before insert or update of clock_in on attendance_records
  for each row execute function trg_attendance_late();

-- Endpoint untuk sistem kehadiran luar (dipanggil oleh Edge Function selepas semak API key)
create or replace function ingest_attendance(p_company uuid, p_employee_no text, p_date date,
       p_in timestamptz, p_out timestamptz, p_source text, p_external_id text, p_raw jsonb)
returns attendance_records language plpgsql security definer set search_path = public as $$
declare e employments; a attendance_records;
begin
  if not is_service_role() then raise exception 'Tidak dibenarkan'; end if;
  select * into e from employments where company_id = p_company and employee_no = p_employee_no;
  if e.id is null then raise exception 'Pekerja % tidak dijumpai', p_employee_no; end if;
  insert into attendance_records(employment_id, work_date, clock_in, clock_out, source, external_id, raw)
  values (e.id, p_date, p_in, p_out, p_source, p_external_id, p_raw)
  on conflict (employment_id, work_date) do update
    set clock_in = coalesce(attendance_records.clock_in, excluded.clock_in),
        clock_out = coalesce(excluded.clock_out, attendance_records.clock_out),
        raw = excluded.raw
  returning * into a;
  return a;
end $$;

-- =====================================================================
--  AUTOMASI: proses event → notifikasi (jalan setiap minit via pg_cron)
-- =====================================================================
create or replace function render_template(p_tpl text, p_vars jsonb) returns text
language plpgsql immutable as $$
declare k text; v text; out_ text := p_tpl;
begin
  for k, v in select key, value #>> '{}' from jsonb_each(p_vars) loop
    out_ := replace(out_, '{{' || k || '}}', coalesce(v, ''));
  end loop;
  return out_;
end $$;

create or replace function process_hr_events(p_limit int default 200)
returns int language plpgsql security definer set search_path = public as $$
declare ev hr_events; ru automation_rules; tgt uuid; vars jsonb; n int := 0;
begin
  for ev in select * from hr_events where processed_at is null order by id limit p_limit
            for update skip locked loop
    for ru in select * from automation_rules
              where active and event_type = ev.event_type
                and (company_id = ev.company_id) loop
      if not eval_condition(ru.condition, ev.payload) then continue; end if;
      tgt := case ru.target
        when 'subject' then ev.subject_person_id
        when 'specific_person' then ru.target_person_id
        when 'subject_manager' then (select manager_person_id from employments where id = ev.subject_employment_id)
        when 'subject_dept_head' then (select d.head_person_id from employments e join departments d
                                         on d.id = e.department_id where e.id = ev.subject_employment_id)
        when 'cover_person' then nullif(ev.payload->>'cover_person_id','')::uuid
        else null end;
      vars := ev.payload || jsonb_build_object('nama',
                (select coalesce(preferred_name, full_name) from persons where id = ev.subject_person_id));
      if ru.target = 'dept_peers' then
        insert into notifications(company_id, person_id, channel, to_address, message, event_id, rule_id)
        select ev.company_id, x.person_id, ru.channel, ps.phone_whatsapp,
               render_template(ru.message_template, vars), ev.id, ru.id
          from employments s join employments x on x.department_id = s.department_id
               and x.status in ('probation','active') and x.person_id <> s.person_id
          join persons ps on ps.id = x.person_id and ps.is_active
         where s.id = ev.subject_employment_id;
      elsif ru.target in ('role_hr','role_ceo') then
        insert into notifications(company_id, person_id, channel, to_address, message, event_id, rule_id)
        select ev.company_id, r.person_id, ru.channel, ps.phone_whatsapp,
               render_template(ru.message_template, vars), ev.id, ru.id
          from user_roles r join persons ps on ps.id = r.person_id
         where r.company_id = ev.company_id
           and r.role = case ru.target when 'role_hr' then 'hr'::app_role else 'ceo' end;
      elsif tgt is not null then
        insert into notifications(company_id, person_id, channel, to_address, message, event_id, rule_id)
        select ev.company_id, tgt, ru.channel, ps.phone_whatsapp,
               render_template(ru.message_template, vars), ev.id, ru.id
          from persons ps where ps.id = tgt;
      end if;
    end loop;
    update hr_events set processed_at = now() where id = ev.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Peringatan & SLA (jalan setiap 15 minit via pg_cron)
create or replace function approval_sla_tick() returns int
language plpgsql security definer set search_path = public as $$
declare t record; n int := 0;
begin
  -- peringatan berkala kepada approver
  for t in select tk.*, r.title, r.company_id, r.sla_due_at, w.reminder_every_hours
             from approval_tasks tk
             join approval_requests r on r.id = tk.request_id
             join approval_workflows w on w.id = r.workflow_id
            where tk.status = 'pending' and r.status = 'pending' and r.sla_due_at is not null
              and coalesce(tk.last_reminded_at, tk.created_at)
                  < now() - make_interval(hours => w.reminder_every_hours) loop
    perform emit_event(t.company_id, 'approval.reminder', t.approver_person_id, null,
      jsonb_build_object('request_id', t.request_id, 'task_id', t.id, 'title', t.title,
                         'sla_due_at', t.sla_due_at));
    update approval_tasks set last_reminded_at = now() where id = t.id;
    n := n + 1;
  end loop;
  -- tanda lewat SLA (tiada lulus automatik)
  for t in select * from approval_requests
            where status = 'pending' and not sla_breached and sla_due_at < now() loop
    update approval_requests set sla_breached = true where id = t.id;
    insert into approval_actions(request_id, action, via) values (t.id, 'sla_breached', 'system');
    perform emit_event(t.company_id, 'approval.sla_breached', t.requester_person_id, t.requester_employment_id,
      jsonb_build_object('request_id', t.id, 'title', t.title));
  end loop;
  return n;
end $$;

-- =====================================================================
--  PAPARAN (VIEW) UNTUK PUSAT KELULUSAN — ikut RLS pengguna
-- =====================================================================
create view v_my_approval_tasks with (security_invoker = true) as
select tk.id as task_id, tk.step_name, tk.created_at as assigned_at, tk.delegated_from,
       r.id as request_id, r.request_type, r.title, r.context, r.ai_summary,
       r.sla_due_at, r.sla_breached, r.submitted_at, r.company_id, c.code as company_code,
       p.full_name as requester_name, p.photo_path as requester_photo,
       d.name as department
from approval_tasks tk
join approval_requests r on r.id = tk.request_id
join companies c on c.id = r.company_id
join persons p on p.id = r.requester_person_id
left join employments e on e.id = r.requester_employment_id
left join departments d on d.id = e.department_id
where tk.status = 'pending' and r.status = 'pending'
  and tk.approver_person_id = current_person_id();

create view v_my_requests with (security_invoker = true) as
select r.id as request_id, r.request_type, r.title, r.status, r.submitted_at, r.completed_at,
       r.sla_due_at, c.code as company_code,
       (select string_agg(distinct tk.step_name, ', ') from approval_tasks tk
         where tk.request_id = r.id and tk.status = 'pending') as waiting_for
from approval_requests r join companies c on c.id = r.company_id
where r.requester_person_id = current_person_id();

-- =====================================================================
--  RLS
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'companies','persons','emergency_contacts','departments','positions','employments',
    'employee_documents','user_roles','public_holidays','leave_types','leave_entitlement_rules',
    'leave_balances','leave_requests','claim_types','claims','claim_items','attendance_records',
    'attendance_corrections','integration_keys','approval_workflows','approval_workflow_steps',
    'approval_requests','approval_tasks','approval_actions','approval_delegations',
    'statutory_rates','pay_components','employment_compensation','payroll_runs','payslips',
    'payslip_lines','accounting_sync_queue','hr_events','automation_rules','notifications',
    'ai_knowledge_docs','ai_knowledge_chunks','ai_conversations','ai_messages','ai_action_log',
    'data_access_log']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- elak rekursi RLS: semakan approver/permohonan melalui fungsi security definer
create or replace function is_approver_of(p_request uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from approval_tasks t where t.request_id = p_request
                 and t.approver_person_id = current_person_id())
$$;

create or replace function can_view_request(p_request uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from approval_requests r where r.id = p_request
                 and (r.requester_person_id = current_person_id()
                      or has_role(r.company_id, '{hr,ceo,admin}')))
      or is_approver_of(p_request)
$$;

-- Syarikat & tetapan: ahli boleh baca; HR/admin boleh ubah
create policy read_member on companies for select using (is_company_member(id));
create policy write_admin on companies for all using (has_role(id, '{admin}')) with check (has_role(id, '{admin}'));

create policy read_member on departments for select using (is_company_member(company_id));
create policy write_hr    on departments for all using (has_role(company_id, '{hr,admin}')) with check (has_role(company_id, '{hr,admin}'));
create policy read_member on positions for select using (is_company_member(company_id));
create policy write_hr    on positions for all using (has_role(company_id, '{hr,admin}')) with check (has_role(company_id, '{hr,admin}'));
create policy read_member on leave_types for select using (is_company_member(company_id));
create policy write_hr    on leave_types for all using (has_role(company_id, '{hr,admin}')) with check (has_role(company_id, '{hr,admin}'));
create policy read_member on leave_entitlement_rules for select using (
  exists (select 1 from leave_types t where t.id = leave_type_id and is_company_member(t.company_id)));
create policy write_hr    on leave_entitlement_rules for all using (
  exists (select 1 from leave_types t where t.id = leave_type_id and has_role(t.company_id, '{hr,admin}')));
create policy read_member on claim_types for select using (is_company_member(company_id));
create policy write_hr    on claim_types for all using (has_role(company_id, '{hr,finance,admin}')) with check (has_role(company_id, '{hr,finance,admin}'));
create policy read_all    on public_holidays for select using (auth.uid() is not null);
create policy write_hr    on public_holidays for all using (has_role(company_id, '{hr,admin}')) with check (has_role(company_id, '{hr,admin}'));
create policy read_hr     on approval_workflows for select using (is_company_member(company_id));
create policy write_hr    on approval_workflows for all using (has_role(company_id, '{hr,admin}')) with check (has_role(company_id, '{hr,admin}'));
create policy read_hr     on approval_workflow_steps for select using (
  exists (select 1 from approval_workflows w where w.id = workflow_id and is_company_member(w.company_id)));
create policy write_hr    on approval_workflow_steps for all using (
  exists (select 1 from approval_workflows w where w.id = workflow_id and has_role(w.company_id, '{hr,admin}')));
create policy rw_hr       on approval_delegations for all using (
  has_role(company_id, '{hr,admin}') or from_person_id = current_person_id())
  with check (has_role(company_id, '{hr,admin}') or from_person_id = current_person_id());
create policy read_all    on statutory_rates for select using (auth.uid() is not null);
create policy write_admin on statutory_rates for all using (is_superadmin()) with check (is_superadmin());
create policy rw_hr       on pay_components for all using (has_role(company_id, '{hr,finance,admin}')) with check (has_role(company_id, '{hr,finance,admin}'));
create policy rw_hr       on automation_rules for all using (has_role(company_id, '{hr,admin}')) with check (has_role(company_id, '{hr,admin}'));
create policy rw_admin    on integration_keys for all using (has_role(company_id, '{admin}')) with check (has_role(company_id, '{admin}'));
create policy read_roles  on user_roles for select using (person_id = current_person_id() or has_role(company_id, '{hr,admin}'));
create policy write_roles on user_roles for all using (has_role(company_id, '{admin}')) with check (has_role(company_id, '{admin}'));

-- Orang & pekerjaan
create policy read_person on persons for select using (
  id = current_person_id()
  or exists (select 1 from employments e where e.person_id = persons.id and can_view_employment(e.id)));
create policy update_self on persons for update using (id = current_person_id()) with check (id = current_person_id());
-- HR hanya boleh ubah orang yang bekerja di syarikat HR itu. Orang baru dicipta melalui RPC add_employee.
create policy update_hr   on persons for update using (
  exists (select 1 from employments e where e.person_id = persons.id and has_role(e.company_id, '{hr,admin}')));
create policy rw_contacts on emergency_contacts for all using (
  person_id = current_person_id()
  or exists (select 1 from employments e where e.person_id = emergency_contacts.person_id
             and has_role(e.company_id, '{hr,admin}')));
create policy read_emp    on employments for select using (can_view_employment(id));
create policy write_hr    on employments for all using (has_role(company_id, '{hr,admin}')) with check (has_role(company_id, '{hr,admin}'));
create policy read_docs   on employee_documents for select using (can_view_employment(employment_id));
create policy write_docs  on employee_documents for all using (has_role(employment_company(employment_id), '{hr,admin}'));

-- Cuti / tuntutan / kehadiran: baca ikut can_view_employment; cipta melalui RPC
create policy read_bal    on leave_balances for select using (can_view_employment(employment_id));
create policy write_bal   on leave_balances for all using (has_role(employment_company(employment_id), '{hr,admin}'));
create policy read_leave  on leave_requests for select using (
  can_view_employment(employment_id)
  or is_approver_of(approval_request_id));
create policy read_claim  on claims for select using (
  can_view_employment(employment_id) or has_role(employment_company(employment_id), '{finance}')
  or is_approver_of(approval_request_id));
create policy draft_claim on claims for insert with check (
  exists (select 1 from employments e where e.id = employment_id and e.person_id = current_person_id())
  and status = 'draft');
create policy edit_draft_claim on claims for update using (
  status in ('draft','returned') and
  exists (select 1 from employments e where e.id = employment_id and e.person_id = current_person_id()));
create policy read_items  on claim_items for select using (
  exists (select 1 from claims c where c.id = claim_id));   -- ikut polisi claims
create policy edit_items  on claim_items for all using (
  exists (select 1 from claims c join employments e on e.id = c.employment_id
          where c.id = claim_id and c.status in ('draft','returned') and e.person_id = current_person_id()));
create policy read_att    on attendance_records for select using (can_view_employment(employment_id));
create policy read_attc   on attendance_corrections for select using (
  can_view_employment(employment_id)
  or is_approver_of(approval_request_id));

-- Kelulusan: pemohon, approver, HR/CEO syarikat
create policy read_req    on approval_requests for select using (can_view_request(id));
create policy read_task   on approval_tasks for select using (can_view_request(request_id));
create policy read_act    on approval_actions for select using (can_view_request(request_id));

-- Gaji
create policy rw_payroll  on payroll_runs for all using (has_role(company_id, '{hr,finance,ceo,admin}'))
  with check (has_role(company_id, '{hr,admin}'));
create policy read_comp   on employment_compensation for select using (
  has_role(employment_company(employment_id), '{hr,finance,ceo,admin}')
  or exists (select 1 from employments e where e.id = employment_id and e.person_id = current_person_id()));
create policy write_comp  on employment_compensation for all using (has_role(employment_company(employment_id), '{hr,admin}'));
create policy read_slip   on payslips for select using (
  exists (select 1 from payroll_runs pr where pr.id = payroll_run_id and has_role(pr.company_id, '{hr,finance,ceo,admin}'))
  or (exists (select 1 from employments e where e.id = employment_id and e.person_id = current_person_id())
      and exists (select 1 from payroll_runs pr where pr.id = payroll_run_id and pr.status in ('approved','paid','locked'))));
create policy read_lines  on payslip_lines for select using (exists (select 1 from payslips s where s.id = payslip_id));
create policy rw_sync     on accounting_sync_queue for select using (has_role(company_id, '{finance,admin}'));

-- Notifikasi & AI: pemilik sahaja; hr_events & log hanya service role (tiada polisi = tertutup)
create policy own_notif   on notifications for select using (person_id = current_person_id());
create policy read_kb     on ai_knowledge_docs for select using (company_id is null or is_company_member(company_id));
create policy write_kb    on ai_knowledge_docs for all using (has_role(company_id, '{hr,admin}'));
create policy read_chunks on ai_knowledge_chunks for select using (exists (select 1 from ai_knowledge_docs d where d.id = doc_id));
create policy own_conv    on ai_conversations for select using (person_id = current_person_id());
create policy own_msgs    on ai_messages for select using (
  exists (select 1 from ai_conversations c where c.id = conversation_id and c.person_id = current_person_id()));
create policy read_ailog  on ai_action_log for select using (on_behalf_of = current_person_id());
create policy read_access on data_access_log for select using (
  exists (select 1 from user_roles r where r.person_id = current_person_id() and r.role = 'admin'));

-- Fungsi dalaman tidak boleh dipanggil terus oleh klien
revoke execute on function approval_advance(uuid), approval_apply_outcome(approval_requests),
  approval_create(request_type, uuid, uuid, text, jsonb, boolean, action_channel),
  emit_event(uuid, text, uuid, uuid, jsonb), process_hr_events(int), approval_sla_tick()
  from public;

-- =====================================================================
--  TETAPAN DEFAULT UNTUK SYARIKAT BARU
--  (kelayakan ikut minimum Akta Kerja 1955 — HR sila sahkan polisi syarikat)
-- =====================================================================
create or replace function seed_company_defaults(p_company uuid)
returns void language plpgsql security definer set search_path = public as $$
declare lt uuid; wf uuid;
begin
  -- jenis cuti
  insert into leave_types(company_id, code, name, sort_order) values (p_company,'AL','Cuti Tahunan',1) returning id into lt;
  insert into leave_entitlement_rules(leave_type_id, min_service_months, max_service_months, days_per_year)
  values (lt,0,24,8),(lt,24,60,12),(lt,60,null,16);
  update leave_types set max_carry_forward = 5 where id = lt;

  insert into leave_types(company_id, code, name, requires_attachment, sla_exempt, allow_backdate, sort_order)
  values (p_company,'MC','Cuti Sakit',true,true,true,2) returning id into lt;
  insert into leave_entitlement_rules(leave_type_id, min_service_months, max_service_months, days_per_year)
  values (lt,0,24,14),(lt,24,60,18),(lt,60,null,22);

  insert into leave_types(company_id, code, name, requires_attachment, sla_exempt, allow_backdate, sort_order)
  values (p_company,'HL','Cuti Hospitalisasi',true,true,true,3) returning id into lt;
  insert into leave_entitlement_rules(leave_type_id, days_per_year) values (lt,60);

  insert into leave_types(company_id, code, name, eligible_gender, sort_order)
  values (p_company,'ML','Cuti Bersalin','P',4) returning id into lt;
  insert into leave_entitlement_rules(leave_type_id, days_per_year) values (lt,98);

  insert into leave_types(company_id, code, name, eligible_gender, sort_order)
  values (p_company,'PL','Cuti Paterniti','L',5) returning id into lt;
  insert into leave_entitlement_rules(leave_type_id, days_per_year) values (lt,7);

  insert into leave_types(company_id, code, name, deduct_balance, sla_exempt, allow_backdate, sort_order)
  values (p_company,'EL','Cuti Kecemasan',false,true,true,6);
  insert into leave_types(company_id, code, name, is_paid, deduct_balance, sort_order)
  values (p_company,'UL','Cuti Tanpa Gaji',false,false,7);

  -- aliran kelulusan
  insert into approval_workflows(company_id, request_type, name, sla)
  values (p_company,'leave','Kelulusan Cuti','same_day') returning id into wf;
  insert into approval_workflow_steps(workflow_id, step_order, name, approver, approver_role) values
    (wf,1,'Ketua Jabatan','dept_head',null),
    (wf,2,'HR','role','hr'),
    (wf,3,'CEO','role','ceo');

  insert into approval_workflows(company_id, request_type, name, sla)
  values (p_company,'claim','Kelulusan Tuntutan','same_day') returning id into wf;
  insert into approval_workflow_steps(workflow_id, step_order, name, approver, approver_role, condition) values
    (wf,1,'Ketua Jabatan','dept_head',null,'{}'),
    (wf,2,'Finance','role','finance','{}'),
    (wf,3,'CEO','role','ceo','{"field":"amount","op":">","value":1000}');

  insert into approval_workflows(company_id, request_type, name, sla)
  values (p_company,'attendance_correction','Pembetulan Kehadiran','same_day') returning id into wf;
  insert into approval_workflow_steps(workflow_id, step_order, name, approver) values
    (wf,1,'Ketua Jabatan','dept_head');

  insert into approval_workflows(company_id, request_type, name, sla)
  values (p_company,'payroll_run','Kelulusan Gaji','none') returning id into wf;
  insert into approval_workflow_steps(workflow_id, step_order, name, approver, approver_role) values
    (wf,1,'Finance','role','finance'),
    (wf,2,'CEO','role','ceo');

  -- jenis tuntutan
  insert into claim_types(company_id, name, limit_per_item, requires_receipt, mileage_rate) values
    (p_company,'Mileage',null,false,0.60),
    (p_company,'Parking & Tol',null,true,null),
    (p_company,'Grab / Teksi',null,true,null),
    (p_company,'Makan (outstation)',50,true,null),
    (p_company,'Lain-lain',null,true,null);

  -- komponen gaji asas
  insert into pay_components(company_id, code, name, kind, taxable, epf_applicable, socso_applicable) values
    (p_company,'BASIC','Gaji Pokok','earning',true,true,true),
    (p_company,'ALLOWANCE','Elaun Tetap','earning',true,true,true),
    (p_company,'COMMISSION','Komisen','earning',true,true,true),
    (p_company,'OT','Kerja Lebih Masa','earning',true,false,true),
    (p_company,'CLAIM','Bayaran Balik Tuntutan','earning',false,false,false),
    (p_company,'UNPAID','Potongan Cuti Tanpa Gaji','deduction',true,true,true);

  -- automasi WhatsApp
  insert into automation_rules(company_id, name, event_type, target, message_template) values
    (p_company,'Staff mohon cuti — maklum PIC ganti','leave.submitted','cover_person',
     'Assalamualaikum {{pic}}, {{nama}} ({{jabatan}}) memohon {{jenis}} {{tarikh}} ({{days}} hari) dan menamakan anda sebagai PIC ganti. Sila semak handover dengan {{nama}}. Status: {{status}}.'),
    (p_company,'Staff mohon cuti — maklum HR','leave.submitted','role_hr',
     '{{nama}} ({{jabatan}}) memohon {{jenis}} {{tarikh}} ({{days}} hari). PIC ganti: {{pic}}.'),
    (p_company,'Cuti diluluskan — maklum PIC ganti','leave.approved','cover_person',
     'Makluman: cuti {{nama}} {{tarikh}} telah DILULUSKAN. Anda PIC ganti sepanjang tempoh ini.'),
    (p_company,'Staff lewat masuk','attendance.late','subject',
     'Assalamualaikum {{nama}}, sistem rekod anda clock-in pukul {{clock_in}} hari ini ({{late_minutes}} minit lewat). Ini kali ke-{{late_count_month}} bulan ini. Jika ada sebab, balas mesej ini.'),
    (p_company,'Lewat 3 kali sebulan — maklum ketua','attendance.late','subject_dept_head',
     '{{nama}} lewat masuk kali ke-{{late_count_month}} bulan ini (hari ini {{clock_in}}).'),
    (p_company,'Tugasan kelulusan baru','approval.task_assigned','subject',
     'Ada permohonan menunggu kelulusan anda: {{title}}. Balas LULUS atau TOLAK <sebab>.'),
    (p_company,'Peringatan kelulusan','approval.reminder','subject',
     'Peringatan: {{title}} masih menunggu kelulusan anda.'),
    (p_company,'Permohonan diluluskan','approval.approved','subject',
     'Tahniah {{nama}}, permohonan anda "{{title}}" telah DILULUSKAN.'),
    (p_company,'Permohonan ditolak','approval.rejected','subject',
     'Maaf {{nama}}, permohonan anda "{{title}}" telah ditolak. Semak sebab dalam sistem.'),
    (p_company,'Permohonan dihantar balik','approval.returned','subject',
     '{{nama}}, permohonan "{{title}}" dihantar balik untuk pembetulan.'),
    (p_company,'Lewat SLA — maklum CEO','approval.sla_breached','role_ceo',
     'Permohonan "{{title}}" tidak selesai dalam tempoh hari yang sama.');
  update automation_rules set condition = '{"field":"late_count_month","op":">=","value":3}'
   where company_id = p_company and name like 'Lewat 3 kali%';
end $$;


-- =====================================================================
--  v0.2: FUNGSI PLATFORM, AKSES, PENDAFTARAN, ONBOARDING, CROSSCHEX
-- =====================================================================

create or replace function log_platform(p_action text, p_company uuid, p_target_type text,
                                        p_target uuid, p_details jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into platform_audit_log(actor_person_id, action, company_id, target_type, target_id, details)
  values (current_person_id(), p_action, p_company, p_target_type, p_target, coalesce(p_details,'{}'))
$$;

create or replace function platform_setting(p_key text) returns jsonb
language sql stable security definer set search_path = public as $$
  select value from platform_settings where key = p_key
$$;

-- notifikasi terus (bukan melalui automation_rules) — untuk mesej platform
create or replace function notify_person(p_person uuid, p_company uuid, p_message text)
returns void language sql security definer set search_path = public as $$
  insert into notifications(company_id, person_id, channel, to_address, message)
  select p_company, ps.id, 'whatsapp', ps.phone_whatsapp, p_message
    from persons ps where ps.id = p_person and ps.is_active
$$;

-- Peranan syarikat hanya untuk orang yang BEKERJA di syarikat itu.
-- Akses orang luar = company_access_grants (lulus superadmin), bukan user_roles.
create or replace function trg_user_roles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from employments e where e.person_id = new.person_id
                   and e.company_id = new.company_id and e.status in ('probation','active')) then
    raise exception 'Peranan hanya boleh diberi kepada pekerja syarikat ini. Orang luar perlu permohonan akses.';
  end if;
  return new;
end $$;
create trigger user_roles_guard before insert or update on user_roles
  for each row execute function trg_user_roles_guard();

-- ---------------- AKSES SILANG SYARIKAT ----------------
create or replace function request_company_access(p_company_code text, p_role app_role,
                                                  p_days int, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := current_person_id(); c companies; gid uuid; a record;
begin
  if me is null then raise exception 'Tidak dibenarkan'; end if;
  if coalesce(trim(p_reason),'') = '' then raise exception 'Sila nyatakan sebab'; end if;
  select * into c from companies where code = upper(trim(p_company_code));
  if c.id is null or c.status <> 'active' then raise exception 'Kod syarikat tidak sah'; end if;
  if exists (select 1 from employments e where e.person_id = me and e.company_id = c.id
               and e.status in ('probation','active')) then
    raise exception 'Anda sudah bekerja di syarikat ini — minta Admin syarikat beri peranan';
  end if;
  if exists (select 1 from company_access_grants g where g.person_id = me and g.company_id = c.id
               and g.status = 'pending') then
    raise exception 'Permohonan anda masih menunggu kelulusan';
  end if;
  insert into company_access_grants(person_id, company_id, role, reason, days)
  values (me, c.id, p_role, p_reason, p_days) returning id into gid;
  perform log_platform('grant.request', c.id, 'grant', gid,
          jsonb_build_object('role', p_role, 'days', p_days));
  for a in select person_id from platform_admins loop
    perform notify_person(a.person_id, null,
      'Permohonan akses baru: ' || (select coalesce(preferred_name, full_name) from persons where id = me)
      || ' minta akses ' || p_role || ' ke ' || c.name || ' (' || p_days || ' hari).');
  end loop;
  for a in select person_id from user_roles where company_id = c.id and role = 'admin' loop
    perform notify_person(a.person_id, c.id,
      'Makluman: ' || (select coalesce(preferred_name, full_name) from persons where id = me)
      || ' memohon akses ' || p_role || ' ke syarikat anda. Superadmin HRBoost akan membuat keputusan.');
  end loop;
  return gid;
end $$;

create or replace function decide_company_access(p_grant uuid, p_approve boolean, p_note text default null)
returns company_access_grants language plpgsql security definer set search_path = public as $$
declare g company_access_grants;
begin
  if not is_superadmin() then raise exception 'Hanya superadmin'; end if;
  select * into g from company_access_grants where id = p_grant for update;
  if g.status <> 'pending' then raise exception 'Permohonan sudah diputuskan'; end if;
  update company_access_grants set
    status = case when p_approve then 'approved' else 'rejected' end,
    decided_by = current_person_id(), decided_at = now(), decision_note = p_note,
    expires_at = case when p_approve then now() + make_interval(days => g.days) end
  where id = g.id returning * into g;
  perform log_platform(case when p_approve then 'grant.approve' else 'grant.reject' end,
                       g.company_id, 'grant', g.id, jsonb_build_object('note', p_note));
  perform notify_person(g.person_id, null,
    'Permohonan akses anda ' || case when p_approve then 'DILULUSKAN sehingga ' ||
      to_char(g.expires_at at time zone 'Asia/Kuala_Lumpur','DD/MM/YYYY') else 'ditolak' end || '.');
  return g;
end $$;

create or replace function revoke_company_access(p_grant uuid)
returns void language plpgsql security definer set search_path = public as $$
declare g company_access_grants;
begin
  select * into g from company_access_grants where id = p_grant for update;
  if not (is_superadmin() or exists (select 1 from user_roles where person_id = current_person_id()
                                       and company_id = g.company_id and role = 'admin')) then
    raise exception 'Tidak dibenarkan';
  end if;
  update company_access_grants set status = 'revoked', decided_at = now(), decided_by = current_person_id()
   where id = g.id;
  perform log_platform('grant.revoke', g.company_id, 'grant', g.id, '{}');
end $$;

-- ---------------- SUPERADMIN ----------------
create or replace function sa_set_company_status(p_company uuid, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare a record;
begin
  if not is_superadmin() then raise exception 'Hanya superadmin'; end if;
  if p_status not in ('active','suspended') then raise exception 'Status tidak sah'; end if;
  update companies set status = p_status,
         suspended_at = case when p_status = 'suspended' then now() end,
         suspended_reason = case when p_status = 'suspended' then p_reason end
   where id = p_company;
  perform log_platform(case when p_status = 'suspended' then 'company.suspend' else 'company.restore' end,
                       p_company, 'company', p_company, jsonb_build_object('reason', p_reason));
  for a in select person_id from user_roles where company_id = p_company and role = 'admin' loop
    perform notify_person(a.person_id, p_company,
      case when p_status = 'suspended'
           then 'Akaun syarikat anda di HRBoost telah dinyahaktifkan. Sebab: ' || coalesce(p_reason,'-')
           else 'Akaun syarikat anda di HRBoost telah diaktifkan semula.' end);
  end loop;
end $$;

create or replace function sa_set_person_active(p_person uuid, p_active boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_superadmin() then raise exception 'Hanya superadmin'; end if;
  if p_person = current_person_id() then raise exception 'Tidak boleh nyahaktif diri sendiri'; end if;
  update persons set is_active = p_active where id = p_person;
  perform log_platform(case when p_active then 'person.activate' else 'person.deactivate' end,
                       null, 'person', p_person, jsonb_build_object('reason', p_reason));
end $$;

create or replace function sa_set_company_limits(p_company uuid, p_wa int, p_ai int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_superadmin() then raise exception 'Hanya superadmin'; end if;
  update companies set wa_monthly_limit = p_wa, ai_monthly_limit = p_ai where id = p_company;
  perform log_platform('limits.update', p_company, 'company', p_company,
                       jsonb_build_object('wa', p_wa, 'ai', p_ai));
end $$;

-- Agregat sahaja: tiada IC, gaji, MC atau dokumen.
create or replace function sa_company_overview()
returns table(company_id uuid, name text, code text, status text, admins text, staff_active bigint,
              onboarding_steps bigint, wa_used int, wa_limit int, ai_used int, ai_limit int,
              created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_superadmin() then raise exception 'Hanya superadmin'; end if;
  return query
  select c.id, c.name, c.code, c.status,
         (select string_agg(coalesce(p.preferred_name, p.full_name), ', ') from user_roles r
            join persons p on p.id = r.person_id where r.company_id = c.id and r.role = 'admin'),
         (select count(*) from employments e where e.company_id = c.id and e.status in ('probation','active')),
         (select count(*) from company_onboarding_progress o where o.company_id = c.id),
         coalesce(u.wa_sent, 0), coalesce(c.wa_monthly_limit, (platform_setting('default_wa_limit') #>> '{}')::int),
         coalesce(u.ai_calls, 0), coalesce(c.ai_monthly_limit, (platform_setting('default_ai_limit') #>> '{}')::int),
         c.created_at
  from companies c
  left join usage_counters u on u.company_id = c.id and u.month = date_trunc('month', now())::date
  order by c.created_at desc;
end $$;

-- ---------------- HAD PENGGUNAAN ----------------
-- Dipanggil oleh Edge Function sebelum hantar WhatsApp / panggil AI. false = melebihi had.
create or replace function bump_usage(p_company uuid, p_kind text, p_n int default 1)
returns boolean language plpgsql security definer set search_path = public as $$
declare m date := date_trunc('month', now())::date; lim int; used int;
begin
  if not is_service_role() then raise exception 'Tidak dibenarkan'; end if;
  insert into usage_counters(company_id, month) values (p_company, m) on conflict do nothing;
  if p_kind = 'wa' then
    select coalesce(c.wa_monthly_limit, (platform_setting('default_wa_limit') #>> '{}')::int) into lim from companies c where c.id = p_company;
    select wa_sent into used from usage_counters where company_id = p_company and month = m for update;
    if lim is not null and used + p_n > lim then return false; end if;
    update usage_counters set wa_sent = wa_sent + p_n where company_id = p_company and month = m;
  else
    select coalesce(c.ai_monthly_limit, (platform_setting('default_ai_limit') #>> '{}')::int) into lim from companies c where c.id = p_company;
    select ai_calls into used from usage_counters where company_id = p_company and month = m for update;
    if lim is not null and used + p_n > lim then return false; end if;
    update usage_counters set ai_calls = ai_calls + p_n where company_id = p_company and month = m;
  end if;
  return true;
end $$;

-- ---------------- CUTI UMUM PILIHAN ----------------
create or replace function set_company_holidays(p_company uuid, p_year int, p_holiday_ids uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare c companies; total int;
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Hanya HR/Admin'; end if;
  select * into c from companies where id = p_company;
  select count(*) into total from public_holidays h
   where extract(year from h.holiday_date) = p_year
     and (h.company_id is null or h.company_id = c.id)
     and (h.state is null or h.state = c.state)
     and (h.is_mandatory or h.id = any(p_holiday_ids));
  if total < 11 then
    raise exception 'Minimum 11 hari cuti umum (Akta Kerja s.60D). Dipilih: % hari', total;
  end if;
  delete from company_holiday_choices where company_id = p_company and year = p_year;
  insert into company_holiday_choices(company_id, holiday_id, year)
  select p_company, h.id, p_year from public_holidays h
   where h.id = any(p_holiday_ids) and not h.is_mandatory;
  perform emit_event(p_company, 'holidays.published', null, null,
                     jsonb_build_object('year', p_year, 'total', total));
  return total;
end $$;

-- ---------------- HARI JADI ----------------
-- Hanya hari & bulan. Ambil dari tarikh lahir, atau 6 digit pertama IC (YYMMDD).
create or replace function team_birthdays(p_company uuid, p_from date, p_to date)
returns table(person_id uuid, name text, department text, day int, month int)
language sql stable security definer set search_path = public as $$
  with b as (
    select p.id, coalesce(p.preferred_name, p.full_name) as name, d.name as department,
           coalesce(extract(day from p.date_of_birth)::int,
                    nullif(substring(regexp_replace(p.ic_no,'\D','','g') from 5 for 2),'')::int) as dd,
           coalesce(extract(month from p.date_of_birth)::int,
                    nullif(substring(regexp_replace(p.ic_no,'\D','','g') from 3 for 2),'')::int) as mm
    from employments e join persons p on p.id = e.person_id and p.is_active and not p.hide_birthday
    left join departments d on d.id = e.department_id
    where e.company_id = p_company and e.status in ('probation','active')
      and is_company_member(p_company)
  )
  select id, name, department, dd, mm from b
  where dd between 1 and 31 and mm between 1 and 12
    and (make_date(extract(year from p_from)::int, mm, least(dd, 28)) between p_from and p_to
         or make_date(extract(year from p_to)::int, mm, least(dd, 28)) between p_from and p_to)
  order by mm, dd
$$;

-- ---------------- PEKERJA, JEMPUTAN & ONBOARDING ----------------
create or replace function create_invite(p_employment uuid) returns text
language plpgsql security definer set search_path = public as $$
declare tok text := encode(gen_random_bytes(18), 'base64'); e employments;
begin
  select * into e from employments where id = p_employment;
  if not (has_role(e.company_id, '{hr,admin}') or is_service_role()) then raise exception 'Tidak dibenarkan'; end if;
  tok := translate(tok, '+/=', '-_');
  update employee_invites set expires_at = now() where employment_id = p_employment and accepted_at is null;
  insert into employee_invites(employment_id, token_hash) values (p_employment, encode(digest(tok, 'sha256'), 'hex'));
  perform emit_event(e.company_id, 'invite.created', e.person_id, e.id, '{}');
  return tok;  -- dihantar oleh Edge Function dalam pautan WhatsApp; tidak disimpan mentah
end $$;

create or replace function add_employee(p_company uuid, p_full_name text, p_preferred text, p_phone text,
       p_ic text, p_department uuid, p_position text, p_join date,
       p_type employment_type default 'permanent', p_probation_months int default 3,
       p_basic numeric default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid; eid uuid; pos uuid; n int; comp uuid;
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Hanya HR/Admin'; end if;
  -- orang yang sama boleh bekerja di beberapa syarikat: guna semula ikut no. telefon / IC
  select id into pid from persons where phone_whatsapp = p_phone or (p_ic is not null and ic_no = p_ic) limit 1;
  if pid is null then
    insert into persons(full_name, preferred_name, phone_whatsapp, ic_no)
    values (p_full_name, nullif(p_preferred,''), p_phone, p_ic) returning id into pid;
  end if;
  if p_position is not null then
    insert into positions(company_id, title) values (p_company, p_position)
    on conflict (company_id, title) do update set title = excluded.title returning id into pos;
  end if;
  select count(*) + 1 into n from employments where company_id = p_company;
  insert into employments(person_id, company_id, employee_no, department_id, position_id, manager_person_id,
                          employment_type, status, join_date, probation_end_date)
  values (pid, p_company, (select code from companies where id = p_company) || lpad(n::text, 3, '0'),
          p_department, pos, (select head_person_id from departments where id = p_department),
          p_type, case when p_probation_months > 0 then 'probation' else 'active' end::employment_status,
          p_join, case when p_probation_months > 0 then p_join + make_interval(months => p_probation_months) end)
  returning id into eid;
  if p_basic is not null then
    select id into comp from pay_components where company_id = p_company and code = 'BASIC';
    insert into employment_compensation(employment_id, component_id, amount, effective_from)
    values (eid, comp, p_basic, p_join);
  end if;
  return eid;
end $$;

-- Staff buka pautan jemputan (sesi Supabase dicipta oleh Edge Function bagi nombor itu),
-- kemudian sahkan 4 digit akhir IC. 5 cubaan maksimum.
create or replace function accept_invite(p_token text, p_ic_last4 text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare inv employee_invites; e employments; p persons;
begin
  if auth.uid() is null then raise exception 'Sila buka pautan jemputan sekali lagi'; end if;
  select * into inv from employee_invites where token_hash = encode(digest(p_token, 'sha256'), 'hex') for update;
  if inv.id is null or inv.accepted_at is not null or inv.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'Pautan tidak sah atau telah tamat. Minta HR hantar semula.');
  end if;
  if inv.attempts >= 5 then
    return jsonb_build_object('ok', false, 'error', 'Terlalu banyak cubaan. Minta HR hantar semula.');
  end if;
  select * into e from employments where id = inv.employment_id;
  select * into p from persons where id = e.person_id;
  if right(regexp_replace(coalesce(p.ic_no,''), '\D', '', 'g'), 4) <> p_ic_last4 then
    -- tiada RAISE supaya kiraan cubaan disimpan
    update employee_invites set attempts = attempts + 1 where id = inv.id;
    return jsonb_build_object('ok', false, 'error', '4 digit IC tidak sepadan',
                              'attempts_left', 4 - inv.attempts);
  end if;
  if p.auth_user_id is not null and p.auth_user_id <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'Akaun ini sudah diaktifkan oleh pengguna lain. Hubungi HR.');
  end if;
  update persons set auth_user_id = auth.uid() where id = p.id;
  update employee_invites set accepted_at = now() where id = inv.id;
  insert into onboarding_progress(employment_id, step) values (e.id, 'activate') on conflict do nothing;
  perform emit_event(e.company_id, 'invite.accepted', p.id, e.id, '{}');
  return jsonb_build_object('ok', true, 'employment_id', e.id);
end $$;

create or replace function complete_onboarding_step(p_employment uuid, p_step text)
returns int language plpgsql security definer set search_path = public as $$
declare e employments; n int;
begin
  select * into e from employments where id = p_employment;
  if e.person_id <> current_person_id() then raise exception 'Bukan rekod anda'; end if;
  insert into onboarding_progress(employment_id, step) values (e.id, p_step) on conflict do nothing;
  select count(*) into n from onboarding_progress where employment_id = e.id;
  if n = 8 then
    perform emit_event(e.company_id, 'onboarding.completed', e.person_id, e.id, '{}');
  end if;
  return n;
end $$;

-- Daftar syarikat dari homepage (selepas OTP WhatsApp). Pendaftar jadi Admin + HR + CEO.
create or replace function register_company(p_company_name text, p_size text, p_full_name text,
                                            p_phone text, p_email text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid; cid uuid; v_code text; i int := 0;
begin
  if auth.uid() is null then raise exception 'Sila sahkan nombor WhatsApp dahulu'; end if;
  if coalesce((platform_setting('registration_open') #>> '{}')::boolean, true) is false then
    raise exception 'Pendaftaran syarikat baru ditutup sementara';
  end if;
  select id into pid from persons where auth_user_id = auth.uid();
  if pid is null then
    select id into pid from persons where phone_whatsapp = p_phone and auth_user_id is null;
    if pid is null then
      insert into persons(auth_user_id, full_name, phone_whatsapp, email)
      values (auth.uid(), p_full_name, p_phone, p_email) returning id into pid;
    else
      update persons set auth_user_id = auth.uid() where id = pid;
    end if;
  end if;
  v_code := upper(left(regexp_replace(p_company_name, '[^A-Za-z]', '', 'g'), 4));
  if v_code = '' then v_code := 'CO'; end if;
  while exists (select 1 from companies c where c.code = v_code || case when i = 0 then '' else i::text end) loop
    i := i + 1;
  end loop;
  v_code := v_code || case when i = 0 then '' else i::text end;
  insert into companies(code, name, created_by, wa_monthly_limit, ai_monthly_limit)
  values (v_code, p_company_name, pid, null, null) returning id into cid;
  insert into employments(person_id, company_id, employee_no, status, join_date)
  values (pid, cid, v_code || '001', 'active', current_date);
  insert into user_roles(person_id, company_id, role) values (pid, cid, 'admin'), (pid, cid, 'hr'), (pid, cid, 'ceo');
  perform seed_company_defaults(cid);
  insert into company_onboarding_progress(company_id, step) values (cid, 'admin');
  perform log_platform('company.register', cid, 'company', cid, jsonb_build_object('size', p_size));
  return cid;
end $$;

-- ---------------- CROSSCHEX ----------------
-- Bina semula rekod harian (masuk = punch pertama, keluar = punch terakhir) untuk satu hari.
create or replace function rebuild_attendance_day(p_employment uuid, p_date date)
returns void language plpgsql security definer set search_path = public as $$
declare tz text; first_ts timestamptz; last_ts timestamptz; n int;
begin
  select c.timezone into tz from employments e join companies c on c.id = e.company_id where e.id = p_employment;
  select min(punched_at), max(punched_at), count(*) into first_ts, last_ts, n
    from attendance_punches
   where employment_id = p_employment and (punched_at at time zone tz)::date = p_date;
  if n = 0 then return; end if;
  insert into attendance_records(employment_id, work_date, clock_in, clock_out, source, external_id)
  values (p_employment, p_date, first_ts, case when n > 1 then last_ts end, 'crosschex',
          'cc:' || p_employment || ':' || p_date)
  on conflict (employment_id, work_date) do update
    set clock_in = excluded.clock_in, clock_out = excluded.clock_out
    where attendance_records.source <> 'correction';
end $$;

create or replace function ingest_punch(p_company uuid, p_workno text, p_uuid text, p_time timestamptz,
       p_checktype int default null, p_device_sn text default null, p_device_name text default null,
       p_raw jsonb default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare eid uuid; tz text; inserted int;
begin
  if not is_service_role() then raise exception 'Tidak dibenarkan'; end if;
  select id into eid from employments where company_id = p_company and attendance_workno = p_workno;
  insert into attendance_punches(company_id, employment_id, workno, external_uuid, punched_at, checktype,
                                 device_sn, device_name, raw)
  values (p_company, eid, p_workno, p_uuid, p_time, p_checktype, p_device_sn, p_device_name, p_raw)
  on conflict (company_id, external_uuid) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 1 and eid is not null then
    select timezone into tz from companies where id = p_company;
    perform rebuild_attendance_day(eid, (p_time at time zone tz)::date);
  end if;
  return eid is not null;   -- false = workno belum dipadankan
end $$;

-- HR padankan workno CrossChex kepada pekerja, kemudian bina semula rekod lama.
create or replace function match_attendance_workno(p_employment uuid, p_workno text)
returns int language plpgsql security definer set search_path = public as $$
declare e employments; d date; n int := 0; tz text;
begin
  select * into e from employments where id = p_employment;
  if not has_role(e.company_id, '{hr,admin}') then raise exception 'Hanya HR/Admin'; end if;
  update employments set attendance_workno = p_workno where id = p_employment;
  update attendance_punches set employment_id = p_employment
   where company_id = e.company_id and workno = p_workno and employment_id is null;
  select timezone into tz from companies where id = e.company_id;
  for d in select distinct (punched_at at time zone tz)::date from attendance_punches
            where employment_id = p_employment loop
    perform rebuild_attendance_day(p_employment, d); n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------- RLS jadual baru ----------------
do $$
declare t text;
begin
  foreach t in array array['platform_admins','platform_settings','company_access_grants',
    'company_holiday_choices','attendance_punches','integration_sync_state','employee_invites',
    'onboarding_progress','company_onboarding_progress','usage_counters','platform_audit_log']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

create policy read_self   on platform_admins for select using (person_id = current_person_id() or is_superadmin());
create policy read_all    on platform_settings for select using (auth.uid() is not null);
create policy write_sa    on platform_settings for all using (is_superadmin()) with check (is_superadmin());
create policy read_grant  on company_access_grants for select using (
  person_id = current_person_id() or is_superadmin()
  or exists (select 1 from user_roles r where r.person_id = current_person_id()
               and r.company_id = company_access_grants.company_id and r.role = 'admin'));
create policy read_member on company_holiday_choices for select using (is_company_member(company_id));
create policy read_punch  on attendance_punches for select using (
  has_role(company_id, '{hr,admin}') or (employment_id is not null and can_view_employment(employment_id)));
create policy read_sync   on integration_sync_state for select using (has_role(company_id, '{hr,admin}'));
create policy read_inv    on employee_invites for select using (has_role(employment_company(employment_id), '{hr,admin}'));
create policy read_onb    on onboarding_progress for select using (can_view_employment(employment_id));
create policy read_conb   on company_onboarding_progress for select using (is_company_member(company_id));
create policy read_usage  on usage_counters for select using (has_role(company_id, '{admin}') or is_superadmin());
create policy read_plog   on platform_audit_log for select using (
  is_superadmin() or (company_id is not null and has_role(company_id, '{admin}')));

revoke execute on function log_platform(text, uuid, text, uuid, jsonb), notify_person(uuid, uuid, text),
  rebuild_attendance_day(uuid, date) from public;

insert into platform_settings(key, value) values
  ('registration_open', 'true'), ('default_wa_limit', 'null'), ('default_ai_limit', 'null'),
  ('warn_pct', '80'), ('retention_days', '90')
on conflict (key) do nothing;
