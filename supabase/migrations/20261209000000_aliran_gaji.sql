-- Aliran kelulusan gaji: HR menghantar → CEO meluluskan → Kewangan (memproses bayaran).
-- Jika CEO sendiri yang menghantar gaji, peringkat CEO dilangkau (skip_if_requester) dan terus kepada Kewangan.

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
    (wf,2,'Kewangan','role','finance','{}'),
    (wf,3,'CEO','role','ceo','{"field":"amount","op":">","value":1000}');

  insert into approval_workflows(company_id, request_type, name, sla)
  values (p_company,'attendance_correction','Pembetulan Kehadiran','same_day') returning id into wf;
  insert into approval_workflow_steps(workflow_id, step_order, name, approver) values
    (wf,1,'Ketua Jabatan','dept_head');

  insert into approval_workflows(company_id, request_type, name, sla)
  values (p_company,'payroll_run','Kelulusan Gaji','none') returning id into wf;
  insert into approval_workflow_steps(workflow_id, step_order, name, approver, approver_role) values
    (wf,1,'CEO','role','ceo'),
    (wf,2,'Kewangan','role','finance');

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
    (p_company,'Pekerja memohon cuti — maklumkan pengganti tugas','leave.submitted','cover_person',
     'Assalamualaikum {{pic}}, {{nama}} ({{jabatan}}) memohon {{jenis}} {{tarikh}} ({{days}} hari) dan menamakan anda sebagai pengganti tugas. Sila uruskan serahan tugas dengan {{nama}}. Status: {{status}}.'),
    (p_company,'Pekerja memohon cuti — maklumkan HR','leave.submitted','role_hr',
     '{{nama}} ({{jabatan}}) memohon {{jenis}} {{tarikh}} ({{days}} hari). Pengganti tugas: {{pic}}.'),
    (p_company,'Cuti diluluskan — maklumkan pengganti tugas','leave.approved','cover_person',
     'Makluman: cuti {{nama}} {{tarikh}} telah diluluskan. Anda ialah pengganti tugas sepanjang tempoh ini.'),
    (p_company,'Pekerja lewat masuk','attendance.late','subject',
     'Assalamualaikum {{nama}}, sistem merekodkan anda mendaftar masuk pada pukul {{clock_in}} hari ini (lewat {{late_minutes}} minit). Ini kali ke-{{late_count_month}} bagi bulan ini. Sekiranya ada sebab, sila balas mesej ini.'),
    (p_company,'Lewat 3 kali sebulan — maklumkan ketua','attendance.late','subject_dept_head',
     '{{nama}} lewat masuk kali ke-{{late_count_month}} bulan ini (hari ini {{clock_in}}).'),
    (p_company,'Tugasan kelulusan baharu','approval.task_assigned','subject',
     'Terdapat permohonan yang menunggu kelulusan anda: {{title}}. Sila balas LULUS atau TOLAK <sebab>.'),
    (p_company,'Peringatan kelulusan','approval.reminder','subject',
     'Peringatan: {{title}} masih menunggu kelulusan anda.'),
    (p_company,'Permohonan diluluskan','approval.approved','subject',
     '{{nama}}, permohonan anda "{{title}}" telah diluluskan.'),
    (p_company,'Permohonan ditolak','approval.rejected','subject',
     '{{nama}}, permohonan anda "{{title}}" telah ditolak. Sila semak sebabnya dalam aplikasi.'),
    (p_company,'Permohonan dihantar balik','approval.returned','subject',
     '{{nama}}, permohonan "{{title}}" telah dikembalikan untuk pembetulan.'),
    (p_company,'Melepasi tempoh sasaran — maklumkan CEO','approval.sla_breached','role_ceo',
     'Permohonan "{{title}}" tidak selesai dalam tempoh hari yang sama.');
  update automation_rules set condition = '{"field":"late_count_month","op":">=","value":3}'
   where company_id = p_company and name like 'Lewat 3 kali%';
end $$;

-- Syarikat sedia ada yang masih menggunakan susunan lalai lama (Kewangan → CEO): tukar kepada CEO → Kewangan.
do $$
declare w record;
begin
  for w in
    select wf.id from approval_workflows wf
     where wf.request_type = 'payroll_run'
       and (select string_agg(coalesce(s.approver_role::text, s.approver::text), ',' order by s.step_order) from approval_workflow_steps s where s.workflow_id = wf.id) = 'finance,ceo'
  loop
    update approval_workflow_steps set step_order = step_order + 100 where workflow_id = w.id;
    update approval_workflow_steps set step_order = case approver_role::text when 'ceo' then 1 else 2 end,
                                       name = case approver_role::text when 'ceo' then 'CEO' else 'Kewangan' end
     where workflow_id = w.id;
  end loop;
end $$;
