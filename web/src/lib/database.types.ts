
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "accounting_sync_queue": {
                  Row: {
                    "attempts": number,"company_id": string,"created_at": string,"entity_id": string,"entity_type": string,"error": string | null,"external_ref": string | null,"id": string,"status": Database["public"]['Enums']["sync_status"],"synced_at": string | null,"system": Database["public"]['Enums']["accounting_system"]
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"company_id": string,"created_at"?: string,"entity_id": string,"entity_type": string,"error"?: string | null,"external_ref"?: string | null,"id"?: string,"status"?: Database["public"]['Enums']["sync_status"],"synced_at"?: string | null,"system": Database["public"]['Enums']["accounting_system"]
                  }
                  Update: {
                    "attempts"?: number,"company_id"?: string,"created_at"?: string,"entity_id"?: string,"entity_type"?: string,"error"?: string | null,"external_ref"?: string | null,"id"?: string,"status"?: Database["public"]['Enums']["sync_status"],"synced_at"?: string | null,"system"?: Database["public"]['Enums']["accounting_system"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "accounting_sync_queue_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_action_log": {
                  Row: {
                    "action": string,"conversation_id": string | null,"created_at": string,"id": number,"on_behalf_of": string | null,"payload": Json | null,"target_id": string | null,"target_table": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"conversation_id"?: string | null,"created_at"?: string,"id"?: never,"on_behalf_of"?: string | null,"payload"?: Json | null,"target_id"?: string | null,"target_table"?: string | null
                  }
                  Update: {
                    "action"?: string,"conversation_id"?: string | null,"created_at"?: string,"id"?: never,"on_behalf_of"?: string | null,"payload"?: Json | null,"target_id"?: string | null,"target_table"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_action_log_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "ai_conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_action_log_on_behalf_of_fkey"
      columns: ["on_behalf_of"]
isOneToOne: false
      referencedRelation: "persons"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_conversations": {
                  Row: {
                    "active_company_id": string | null,"channel": Database["public"]['Enums']["action_channel"],"created_at": string,"external_chat_id": string | null,"id": string,"last_message_at": string | null,"person_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active_company_id"?: string | null,"channel"?: Database["public"]['Enums']["action_channel"],"created_at"?: string,"external_chat_id"?: string | null,"id"?: string,"last_message_at"?: string | null,"person_id"?: string | null
                  }
                  Update: {
                    "active_company_id"?: string | null,"channel"?: Database["public"]['Enums']["action_channel"],"created_at"?: string,"external_chat_id"?: string | null,"id"?: string,"last_message_at"?: string | null,"person_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_conversations_active_company_id_fkey"
      columns: ["active_company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_conversations_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "persons"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_knowledge_chunks": {
                  Row: {
                    "content": string,"doc_id": string,"embedding": string | null,"id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "content": string,"doc_id": string,"embedding"?: string | null,"id"?: never
                  }
                  Update: {
                    "content"?: string,"doc_id"?: string,"embedding"?: string | null,"id"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_knowledge_chunks_doc_id_fkey"
      columns: ["doc_id"]
isOneToOne: false
      referencedRelation: "ai_knowledge_docs"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_knowledge_docs": {
                  Row: {
                    "active": boolean,"company_id": string | null,"id": string,"source_path": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"company_id"?: string | null,"id"?: string,"source_path"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"company_id"?: string | null,"id"?: string,"source_path"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_knowledge_docs_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_messages": {
                  Row: {
                    "content": string | null,"conversation_id": string,"created_at": string,"id": number,"role": string,"tool_calls": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "content"?: string | null,"conversation_id": string,"created_at"?: string,"id"?: never,"role": string,"tool_calls"?: Json | null
                  }
                  Update: {
                    "content"?: string | null,"conversation_id"?: string,"created_at"?: string,"id"?: never,"role"?: string,"tool_calls"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "ai_conversations"
      referencedColumns: ["id"]
    }
                  ]
                },"approval_actions": {
                  Row: {
                    "action": string,"actor_person_id": string | null,"comment": string | null,"created_at": string,"id": number,"request_id": string,"step_order": number | null,"via": Database["public"]['Enums']["action_channel"]
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_person_id"?: string | null,"comment"?: string | null,"created_at"?: string,"id"?: never,"request_id": string,"step_order"?: number | null,"via"?: Database["public"]['Enums']["action_channel"]
                  }
                  Update: {
                    "action"?: string,"actor_person_id"?: string | null,"comment"?: string | null,"created_at"?: string,"id"?: never,"request_id"?: string,"step_order"?: number | null,"via"?: Database["public"]['Enums']["action_channel"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "approval_actions_actor_person_id_fkey"
      columns: ["actor_person_id"]
isOneToOne: false
      referencedRelation: "persons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_actions_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "approval_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_actions_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "v_my_approval_tasks"
      referencedColumns: ["request_id"]
    },{
      foreignKeyName: "approval_actions_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "v_my_requests"
      referencedColumns: ["request_id"]
    }
                  ]
                },"approval_delegations": {
                  Row: {
                    "company_id": string,"end_date": string,"from_person_id": string,"id": string,"request_types": (Database["public"]['Enums']["request_type"])[] | null,"start_date": string,"to_person_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"end_date": string,"from_person_id": string,"id"?: string,"request_types"?: (Database["public"]['Enums']["request_type"])[] | null,"start_date": string,"to_person_id": string
                  }
                  Update: {
                    "company_id"?: string,"end_date"?: string,"from_person_id"?: string,"id"?: string,"request_types"?: (Database["public"]['Enums']["request_type"])[] | null,"start_date"?: string,"to_person_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "approval_delegations_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_delegations_from_person_id_fkey"
      columns: ["from_person_id"]
isOneToOne: false
      referencedRelation: "persons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_delegations_to_person_id_fkey"
      columns: ["to_person_id"]
isOneToOne: false
      referencedRelation: "persons"
      referencedColumns: ["id"]
    }
                  ]
                },"approval_requests": {
                  Row: {
                    "ai_summary": string | null,"company_id": string,"completed_at": string | null,"context": NonNullable<Json>,"current_step_order": number,"id": string,"reference_id": string,"request_type": Database["public"]['Enums']["request_type"],"requester_employment_id": string | null,"requester_person_id": string,"sla_breached": boolean,"sla_due_at": string | null,"status": Database["public"]['Enums']["request_status"],"submitted_at": string,"title": string,"workflow_id": string | null,"approval_apply_outcome": undefined | null
                  }
                  ComputedFields: "approval_apply_outcome"
                  Insert: {
                    "ai_summary"?: string | null,"company_id": string,"completed_at"?: string | null,"context"?: NonNullable<Json>,"current_step_order"?: number,"id"?: string,"reference_id": string,"request_type": Database["public"]['Enums']["request_type"],"requester_employment_id"?: string | null,"requester_person_id": string,"sla_breached"?: boolean,"sla_due_at"?: string | null,"status"?: Database["public"]['Enums']["request_status"],"submitted_at"?: string,"title": string,"workflow_id"?: string | null
                  }
                  Update: {
                    "ai_summary"?: string | null,"company_id"?: string,"completed_at"?: string | null,"context"?: NonNullable<Json>,"current_step_order"?: number,"id"?: string,"reference_id"?: string,"request_type"?: Database["public"]['Enums']["request_type"],"requester_employment_id"?: string | null,"requester_person_id"?: string,"sla_breached"?: boolean,"sla_due_at"?: string | null,"status"?: Database["public"]['Enums']["request_status"],"submitted_at"?: string,"title"?: string,"workflow_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "approval_requests_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_requests_requester_employment_id_fkey"
      columns: ["requester_employment_id"]
isOneToOne: false
      referencedRelation: "employments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_requests_requester_person_id_fkey"
      columns: ["requester_person_id"]
isOneToOne: false
      referencedRelation: "persons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_requests_workflow_id_fkey"
      columns: ["workflow_id"]
isOneToOne: false
      referencedRelation: "approval_workflows"
      referencedColumns: ["id"]
    }
                  ]
                },"approval_tasks": {
                  Row: {
                    "acted_at": string | null,"acted_via": Database["public"]['Enums']["action_channel"] | null,"approver_person_id": string,"comment": string | null,"created_at": string,"delegated_from": string | null,"id": string,"last_reminded_at": string | null,"request_id": string,"status": Database["public"]['Enums']["task_status"],"step_name": string,"step_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "acted_at"?: string | null,"acted_via"?: Database["public"]['Enums']["action_channel"] | null,"approver_person_id": string,"comment"?: string | null,"created_at"?: string,"delegated_from"?: string | null,"id"?: string,"last_reminded_at"?: string | null,"request_id": string,"status"?: Database["public"]['Enums']["task_status"],"step_name": string,"step_order": number
                  }
                  Update: {
                    "acted_at"?: string | null,"acted_via"?: Database["public"]['Enums']["action_channel"] | null,"approver_person_id"?: string,"comment"?: string | null,"created_at"?: string,"delegated_from"?: string | null,"id"?: string,"last_reminded_at"?: string | null,"request_id"?: string,"status"?: Database["public"]['Enums']["task_status"],"step_name"?: string,"step_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "approval_tasks_approver_person_id_fkey"
      columns: ["approver_person_id"]
isOneToOne: false
      referencedRelation: "persons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_tasks_delegated_from_fkey"
      columns: ["delegated_from"]
isOneToOne: false
      referencedRelation: "persons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_tasks_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "approval_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_tasks_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "v_my_approval_tasks"
      referencedColumns: ["request_id"]
    },{
      foreignKeyName: "approval_tasks_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "v_my_requests"
      referencedColumns: ["request_id"]
    }
                  ]
                },"approval_workflow_steps": {
                  Row: {
                    "approver": Database["public"]['Enums']["approver_type"],"approver_person_id": string | null,"approver_role": Database["public"]['Enums']["app_role"] | null,"condition": NonNullable<Json>,"id": string,"mode": Database["public"]['Enums']["step_mode"],"name": string,"skip_if_requester": boolean,"step_order": number,"workflow_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approver": Database["public"]['Enums']["approver_type"],"approver_person_id"?: string | null,"approver_role"?: Database["public"]['Enums']["app_role"] | null,"condition"?: NonNullable<Json>,"id"?: string,"mode"?: Database["public"]['Enums']["step_mode"],"name": string,"skip_if_requester"?: boolean,"step_order": number,"workflow_id": string
                  }
                  Update: {
                    "approver"?: Database["public"]['Enums']["approver_type"],"approver_person_id"?: string | null,"approver_role"?: Database["public"]['Enums']["app_role"] | null,"condition"?: NonNullable<Json>,"id"?: string,"mode"?: Database["public"]['Enums']["step_mode"],"name"?: string,"skip_if_requester"?: boolean,"step_order"?: number,"workflow_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "approval_workflow_steps_approver_person_id_fkey"
      columns: ["approver_person_id"]
isOneToOne: false
      referencedRelation: "persons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_workflow_steps_workflow_id_fkey"
      columns: ["workflow_id"]
isOneToOne: false
      referencedRelation: "approval_workflows"
      referencedColumns: ["id"]
    }
                  ]
                },"approval_workflows": {
                  Row: {
                    "active": boolean,"company_id": string,"cutoff_time": string,"id": string,"name": string,"reminder_every_hours": number,"request_type": Database["public"]['Enums']["request_type"],"sla": Database["public"]['Enums']["sla_mode"],"sla_hours": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"company_id": string,"cutoff_time"?: string,"id"?: string,"name": string,"reminder_every_hours"?: number,"request_type": Database["public"]['Enums']["request_type"],"sla"?: Database["public"]['Enums']["sla_mode"],"sla_hours"?: number | null
                  }
                  Update: {
                    "active"?: boolean,"company_id"?: string,"cutoff_time"?: string,"id"?: string,"name"?: string,"reminder_every_hours"?: number,"request_type"?: Database["public"]['Enums']["request_type"],"sla"?: Database["public"]['Enums']["sla_mode"],"sla_hours"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "approval_workflows_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"attendance_corrections": {
                  Row: {
                    "approval_request_id": string | null,"created_at": string,"created_via": Database["public"]['Enums']["action_channel"],"employment_id": string,"id": string,"reason": string,"requested_clock_in": string | null,"requested_clock_out": string | null,"status": Database["public"]['Enums']["request_status"],"work_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approval_request_id"?: string | null,"created_at"?: string,"created_via"?: Database["public"]['Enums']["action_channel"],"employment_id": string,"id"?: string,"reason": string,"requested_clock_in"?: string | null,"requested_clock_out"?: string | null,"status"?: Database["public"]['Enums']["request_status"],"work_date": string
                  }
                  Update: {
                    "approval_request_id"?: string | null,"created_at"?: string,"created_via"?: Database["public"]['Enums']["action_channel"],"employment_id"?: string,"id"?: string,"reason"?: string,"requested_clock_in"?: string | null,"requested_clock_out"?: string | null,"status"?: Database["public"]['Enums']["request_status"],"work_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_corrections_approval_request_id_fkey"
      columns: ["approval_request_id"]
isOneToOne: false
      referencedRelation: "approval_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_corrections_approval_request_id_fkey"
      columns: ["approval_request_id"]
isOneToOne: false
      referencedRelation: "v_my_approval_tasks"
      referencedColumns: ["request_id"]
    },{
      foreignKeyName: "attendance_corrections_approval_request_id_fkey"
      columns: ["approval_request_id"]
isOneToOne: false
      referencedRelation: "v_my_requests"
      referencedColumns: ["request_id"]
    },{
      foreignKeyName: "attendance_corrections_employment_id_fkey"
      columns: ["employment_id"]
isOneToOne: false
      referencedRelation: "employments"
      referencedColumns: ["id"]
    }
                  ]
                },"attendance_punches": {
                  Row: {
                    "checktype": number | null,"company_id": string,"created_at": string,"device_name": string | null,"device_sn": string | null,"employment_id": string | null,"external_uuid": string,"id": number,"punched_at": string,"raw": Json | null,"workno": string
                  }
                  ComputedFields: never
                  Insert: {
                    "checktype"?: number | null,"company_id": string,"created_at"?: string,"device_name"?: string | null,"device_sn"?: string | null,"employment_id"?: string | null,"external_uuid": string,"id"?: never,"punched_at": string,"raw"?: Json | null,"workno": string
                  }
                  Update: {
                    "checktype"?: number | null,"company_id"?: string,"created_at"?: string,"device_name"?: string | null,"device_sn"?: string | null,"employment_id"?: string | null,"external_uuid"?: string,"id"?: never,"punched_at"?: string,"raw"?: Json | null,"workno"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_punches_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_punches_employment_id_fkey"
      columns: ["employment_id"]
isOneToOne: false
      referencedRelation: "employments"
      referencedColumns: ["id"]
    }
                  ]
                },"attendance_records": {
                  Row: {
                    "clock_in": string | null,"clock_out": string | null,"created_at": string,"employment_id": string,"external_id": string | null,"id": string,"late_minutes": number,"raw": Json | null,"source": string,"work_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "clock_in"?: string | null,"clock_out"?: string | null,"created_at"?: string,"employment_id": string,"external_id"?: string | null,"id"?: string,"late_minutes"?: number,"raw"?: Json | null,"source"?: string,"work_date": string
                  }
                  Update: {
                    "clock_in"?: string | null,"clock_out"?: string | null,"created_at"?: string,"employment_id"?: string,"external_id"?: string | null,"id"?: string,"late_minutes"?: number,"raw"?: Json | null,"source"?: string,"work_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_records_employment_id_fkey"
      columns: ["employment_id"]
isOneToOne: false
      referencedRelation: "employments"
      referencedColumns: ["id"]
    }
                  ]
                },"automation_rules": {
                  Row: {
                    "active": boolean,"channel": string,"company_id": string,"condition": NonNullable<Json>,"created_at": string,"event_type": string,"id": string,"message_template": string,"name": string,"target": Database["public"]['Enums']["notify_target"],"target_person_id": string | null,"use_ai_rewrite": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"channel"?: string,"company_id": string,"condition"?: NonNullable<Json>,"created_at"?: string,"event_type": string,"id"?: string,"message_template": string,"name": string,"target"?: Database["public"]['Enums']["notify_target"],"target_person_id"?: string | null,"use_ai_rewrite"?: boolean
                  }
                  Update: {
                    "active"?: boolean,"channel"?: string,"company_id"?: string,"condition"?: NonNullable<Json>,"created_at"?: string,"event_type"?: string,"id"?: string,"message_template"?: string,"name"?: string,"target"?: Database["public"]['Enums']["notify_target"],"target_person_id"?: string | null,"use_ai_rewrite"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "automation_rules_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "automation_rules_target_person_id_fkey"
      columns: ["target_person_id"]
isOneToOne: false
      referencedRelation: "persons"
      referencedColumns: ["id"]
    }
                  ]
                },"claim_items": {
                  Row: {
                    "ai_extracted": Json | null,"ai_flags": (string)[] | null,"amount": number,"claim_id": string,"claim_type_id": string,"description": string | null,"distance_km": number | null,"expense_date": string,"id": string,"receipt_path": string | null,"receipt_paths": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_extracted"?: Json | null,"ai_flags"?: (string)[] | null,"amount": number,"claim_id": string,"claim_type_id": string,"description"?: string | null,"distance_km"?: number | null,"expense_date": string,"id"?: string,"receipt_path"?: string | null,"receipt_paths"?: (string)[]
                  }
                  Update: {
                    "ai_extracted"?: Json | null,"ai_flags"?: (string)[] | null,"amount"?: number,"claim_id"?: string,"claim_type_id"?: string,"description"?: string | null,"distance_km"?: number | null,"expense_date"?: string,"id"?: string,"receipt_path"?: string | null,"receipt_paths"?: (string)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "claim_items_claim_id_fkey"
      columns: ["claim_id"]
isOneToOne: false
      referencedRelation: "claims"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "claim_items_claim_type_id_fkey"
      columns: ["claim_type_id"]
isOneToOne: false
      referencedRelation: "claim_types"
      referencedColumns: ["id"]
    }
                  ]
                },"claim_types": {
                  Row: {
                    "account_ref": string | null,"active": boolean,"company_id": string,"id": string,"limit_per_item": number | null,"limit_per_month": number | null,"mileage_rate": number | null,"name": string,"requires_receipt": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "account_ref"?: string | null,"active"?: boolean,"company_id": string,"id"?: string,"limit_per_item"?: number | null,"limit_per_month"?: number | null,"mileage_rate"?: number | null,"name": string,"requires_receipt"?: boolean
                  }
                  Update: {
                    "account_ref"?: string | null,"active"?: boolean,"company_id"?: string,"id"?: string,"limit_per_item"?: number | null,"limit_per_month"?: number | null,"mileage_rate"?: number | null,"name"?: string,"requires_receipt"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "claim_types_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"claims": {
                  Row: {
                    "approval_request_id": string | null,"created_at": string,"created_via": Database["public"]['Enums']["action_channel"],"employment_id": string,"id": string,"paid_at": string | null,"paid_via_payroll_run": string | null,"status": Database["public"]['Enums']["request_status"],"title": string,"total_amount": number
                  }
                  ComputedFields: never
                  Insert: {
                    "approval_request_id"?: string | null,"created_at"?: string,"created_via"?: Database["public"]['Enums']["action_channel"],"employment_id": string,"id"?: string,"paid_at"?: string | null,"paid_via_payroll_run"?: string | null,"status"?: Database["public"]['Enums']["request_status"],"title": string,"total_amount"?: number
                  }
                  Update: {
                    "approval_request_id"?: string | null,"created_at"?: string,"created_via"?: Database["public"]['Enums']["action_channel"],"employment_id"?: string,"id"?: string,"paid_at"?: string | null,"paid_via_payroll_run"?: string | null,"status"?: Database["public"]['Enums']["request_status"],"title"?: string,"total_amount"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "claims_approval_request_id_fkey"
      columns: ["approval_request_id"]
isOneToOne: false
      referencedRelation: "approval_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "claims_approval_request_id_fkey"
      columns: ["approval_request_id"]
isOneToOne: false
      referencedRelation: "v_my_approval_tasks"
      referencedColumns: ["request_id"]
    },{
      foreignKeyName: "claims_approval_request_id_fkey"
      columns: ["approval_request_id"]
isOneToOne: false
      referencedRelation: "v_my_requests"
      referencedColumns: ["request_id"]
    },{
      foreignKeyName: "claims_employment_id_fkey"
      columns: ["employment_id"]
isOneToOne: false
      referencedRelation: "employments"
      referencedColumns: ["id"]
    }
                  ]
                },"companies": {
                  Row: {
                    "accounting_config": NonNullable<Json>,"accounting_system": Database["public"]['Enums']["accounting_system"],"ai_monthly_limit": number | null,"code": string,"created_at": string,"created_by": string | null,"epf_employer_no": string | null,"hrdf_registered": boolean,"id": string,"late_grace_minutes": number,"lhdn_employer_no": string | null,"logo_path": string | null,"name": string,"onboarding_completed_at": string | null,"reg_no": string | null,"socso_employer_no": string | null,"state": string,"status": string,"suspended_at": string | null,"suspended_reason": string | null,"timezone": string,"wa_monthly_limit": number | null,"weekend_days": (number)[],"work_end": string,"work_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accounting_config"?: NonNullable<Json>,"accounting_system"?: Database["public"]['Enums']["accounting_system"],"ai_monthly_limit"?: number | null,"code": string,"created_at"?: string,"created_by"?: string | null,"epf_employer_no"?: string | null,"hrdf_registered"?: boolean,"id"?: string,"late_grace_minutes"?: number,"lhdn_employer_no"?: string | null,"logo_path"?: string | null,"name": string,"onboarding_completed_at"?: string | null,"reg_no"?: string | null,"socso_employer_no"?: string | null,"state"?: string,"status"?: string,"suspended_at"?: string | null,"suspended_reason"?: string | null,"timezone"?: string,"wa_monthly_limit"?: number | null,"weekend_days"?: (number)[],"work_end"?: string,"work_start"?: string
                  }
                  Update: {
                    "accounting_config"?: NonNullable<Json>,"accounting_system"?: Database["public"]['Enums']["accounting_system"],"ai_monthly_limit"?: number | null,"code"?: string,"created_at"?: string,"created_by"?: string | null,"epf_employer_no"?: string | null,"hrdf_registered"?: boolean,"id"?: string,"late_grace_minutes"?: number,"lhdn_employer_no"?: string | null,"logo_path"?: string | null,"name"?: string,"onboarding_completed_at"?: string | null,"reg_no"?: string | null,"socso_employer_no"?: string | null,"state"?: string,"status"?: string,"suspended_at"?: string | null,"suspended_reason"?: string | null,"timezone"?: string,"wa_monthly_limit"?: number | null,"weekend_days"?: (number)[],"work_end"?: string,"work_start"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "companies_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "persons"
      referencedColumns: ["id"]
    }
                  ]
                },"company_access_grants": {
                  Row: {
                    "company_id": string,"created_at": string,"days": number,"decided_at": string | null,"decided_by": string | null,"decision_note": string | null,"expires_at": string | null,"id": string,"person_id": string,"reason": string,"role": Database["public"]['Enums']["app_role"],"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"created_at"?: string,"days": number,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"expires_at"?: string | null,"id"?: string,"person_id": string,"reason": string,"role": Database["public"]['Enums']["app_role"],"status"?: string
                  }
                  Update: {
                    "company_id"?: string,"created_at"?: string,"days"?: number,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"expires_at"?: string | null,"id"?: string,"person_id"?: string,"reason"?: string,"role"?: Database["public"]['Enums']["app_role"],"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "company_access_grants_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "company_access_grants_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "persons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "company_access_grants_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "persons"
      referencedColumns: ["id"]
    }
                  ]
                },"company_holiday_choices": {
                  Row: {
                    "company_id": string,"holiday_id": string,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"holiday_id": string,"year": number
                  }
                  Update: {
                    "company_id"?: string,"holiday_id"?: string,"year"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "company_holiday_choices_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "company_holiday_choices_holiday_id_fkey"
      columns: ["holiday_id"]
isOneToOne: false
      referencedRelation: "public_holidays"
      referencedColumns: ["id"]
    }
                  ]
                },"company_onboarding_progress": {
                  Row: {
                    "company_id": string,"done_at": string,"step": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"done_at"?: string,"step": string
                  }
                  Update: {
                    "company_id"?: string,"done_at"?: string,"step"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "company_onboarding_progress_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"data_access_log": {
                  Row: {
                    "actor_person_id": string | null,"created_at": string,"id": number,"resource": string,"subject_person_id": string | null,"via": Database["public"]['Enums']["action_channel"]
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_person_id"?: string | null,"created_at"?: string,"id"?: never,"resource": string,"subject_person_id"?: string | null,"via"?: Database["public"]['Enums']["action_channel"]
                  }
                  Update: {
                    "actor_person_id"?: string | null,"created_at"?: string,"id"?: never,"resource"?: string,"subject_person_id"?: string | null,"via"?: Database["public"]['Enums']["action_channel"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "data_access_log_actor_person_id_fkey"
      columns: ["actor_person_id"]
isOneToOne: false
      referencedRelation: "persons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "data_access_log_subject_person_id_fkey"
      columns: ["subject_person_id"]
isOneToOne: false
      referencedRelation: "persons"
      referencedColumns: ["id"]
    }
                  ]
                },"departments": {
                  Row: {
                    "company_id": string,"head_person_id": string | null,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"head_person_id"?: string | null,"id"?: string,"name": string
                  }
                  Update: {
                    "company_id"?: string,"head_person_id"?: string | null,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "departments_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "departments_head_person_id_fkey"
      columns: ["head_person_id"]
isOneToOne: false
      referencedRelation: "persons"
      referencedColumns: ["id"]
    }
                  ]
                },"emergency_contacts": {
                  Row: {
                    "id": string,"name": string,"person_id": string,"phone": string,"relationship": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"name": string,"person_id": string,"phone": string,"relationship"?: string | null
                  }
                  Update: {
                    "id"?: string,"name"?: string,"person_id"?: string,"phone"?: string,"relationship"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "emergency_contacts_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "persons"
      referencedColumns: ["id"]
    }
                  ]
                },"employee_documents": {
                  Row: {
                    "created_at": string,"doc_type": string,"employment_id": string,"id": string,"storage_path": string,"title": string,"uploaded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"doc_type": string,"employment_id": string,"id"?: string,"storage_path": string,"title": string,"uploaded_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"doc_type"?: string,"employment_id"?: string,"id"?: string,"storage_path"?: string,"title"?: string,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "employee_documents_employment_id_fkey"
      columns: ["employment_id"]
isOneToOne: false
      referencedRelation: "employments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "employee_documents_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "persons"
      referencedColumns: ["id"]
    }
                  ]
                },"employee_invites": {
                  Row: {
                    "accepted_at": string | null,"attempts": number,"created_at": string,"employment_id": string,"expires_at": string,"id": string,"sent_at": string | null,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"attempts"?: number,"created_at"?: string,"employment_id": string,"expires_at"?: string,"id"?: string,"sent_at"?: string | null,"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"attempts"?: number,"created_at"?: string,"employment_id"?: string,"expires_at"?: string,"id"?: string,"sent_at"?: string | null,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "employee_invites_employment_id_fkey"
      columns: ["employment_id"]
isOneToOne: false
      referencedRelation: "employments"
      referencedColumns: ["id"]
    }
                  ]
                },"employment_compensation": {
                  Row: {
                    "amount": number,"component_id": string,"effective_from": string,"effective_to": string | null,"employment_id": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"component_id": string,"effective_from": string,"effective_to"?: string | null,"employment_id": string,"id"?: string
                  }
                  Update: {
                    "amount"?: number,"component_id"?: string,"effective_from"?: string,"effective_to"?: string | null,"employment_id"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "employment_compensation_component_id_fkey"
      columns: ["component_id"]
isOneToOne: false
      referencedRelation: "pay_components"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "employment_compensation_employment_id_fkey"
      columns: ["employment_id"]
isOneToOne: false
      referencedRelation: "employments"
      referencedColumns: ["id"]
    }
                  ]
                },"employments": {
                  Row: {
                    "attendance_workno": string | null,"company_id": string,"confirm_date": string | null,"contract_end_date": string | null,"created_at": string,"department_id": string | null,"employee_no": string,"employment_type": Database["public"]['Enums']["employment_type"],"end_date": string | null,"epf_no": string | null,"id": string,"join_date": string,"manager_person_id": string | null,"person_id": string,"position_id": string | null,"probation_end_date": string | null,"socso_no": string | null,"status": Database["public"]['Enums']["employment_status"],"tax_no": string | null,"work_start": string | null,"work_state": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attendance_workno"?: string | null,"company_id": string,"confirm_date"?: string | null,"contract_end_date"?: string | null,"created_at"?: string,"department_id"?: string | null,"employee_no": string,"employment_type"?: Database["public"]['Enums']["employment_type"],"end_date"?: string | null,"epf_no"?: string | null,"id"?: string,"join_date": string,"manager_person_id"?: string | null,"person_id": string,"position_id"?: string | null,"probation_end_date"?: string | null,"socso_no"?: string | null,"status"?: Database["public"]['Enums']["employment_status"],"tax_no"?: string | null,"work_start"?: string | null,"work_state"?: string | null
                  }
                  Update: {
                    "attendance_workno"?: string | null,"company_id"?: string,"confirm_date"?: string | null,"contract_end_date"?: string | null,"created_at"?: string,"department_id"?: string | null,"employee_no"?: string,"employment_type"?: Database["public"]['Enums']["employment_type"],"end_date"?: string | null,"epf_no"?: string | null,"id"?: string,"join_date"?: string,"manager_person_id"?: string | null,"person_id"?: string,"position_id"?: string | null,"probation_end_date"?: string | null,"socso_no"?: string | null,"status"?: Database["public"]['Enums']["employment_status"],"tax_no"?: string | null,"work_start"?: string | null,"work_state"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "employments_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "employments_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "employments_manager_person_id_fkey"
      columns: ["manager_person_id"]
isOneToOne: false
      referencedRelation: "persons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "employments_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "persons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "employments_position_id_fkey"
      columns: ["position_id"]
isOneToOne: false
      referencedRelation: "positions"
      referencedColumns: ["id"]
    }
                  ]
                },"hr_events": {
                  Row: {
                    "company_id": string | null,"created_at": string,"event_type": string,"id": number,"payload": NonNullable<Json>,"processed_at": string | null,"subject_employment_id": string | null,"subject_person_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id"?: string | null,"created_at"?: string,"event_type": string,"id"?: never,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"subject_employment_id"?: string | null,"subject_person_id"?: string | null
                  }
                  Update: {
                    "company_id"?: string | null,"created_at"?: string,"event_type"?: string,"id"?: never,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"subject_employment_id"?: string | null,"subject_person_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "hr_events_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hr_events_subject_employment_id_fkey"
      columns: ["subject_employment_id"]
isOneToOne: false
      referencedRelation: "employments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hr_events_subject_person_id_fkey"
      columns: ["subject_person_id"]
isOneToOne: false
      referencedRelation: "persons"
      referencedColumns: ["id"]
    }
                  ]
                },"integration_keys": {
                  Row: {
                    "active": boolean,"company_id": string,"created_at": string,"id": string,"key_hash": string,"name": string,"scopes": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"company_id": string,"created_at"?: string,"id"?: string,"key_hash": string,"name": string,"scopes"?: (string)[]
                  }
                  Update: {
                    "active"?: boolean,"company_id"?: string,"created_at"?: string,"id"?: string,"key_hash"?: string,"name"?: string,"scopes"?: (string)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "integration_keys_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"integration_sync_state": {
                  Row: {
                    "company_id": string,"last_cursor": string | null,"last_error": string | null,"last_synced_at": string | null,"provider": string,"token_expires_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"last_cursor"?: string | null,"last_error"?: string | null,"last_synced_at"?: string | null,"provider": string,"token_expires_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "company_id"?: string,"last_cursor"?: string | null,"last_error"?: string | null,"last_synced_at"?: string | null,"provider"?: string,"token_expires_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "integration_sync_state_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"leave_balances": {
                  Row: {
                    "adjustment": number,"available": number | null,"carried_forward": number,"employment_id": string,"entitled": number,"id": string,"leave_type_id": string,"pending": number,"used": number,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "adjustment"?: number,"available"?: never,"carried_forward"?: number,"employment_id": string,"entitled"?: number,"id"?: string,"leave_type_id": string,"pending"?: number,"used"?: number,"year": number
                  }
                  Update: {
                    "adjustment"?: number,"available"?: never,"carried_forward"?: number,"employment_id"?: string,"entitled"?: number,"id"?: string,"leave_type_id"?: string,"pending"?: number,"used"?: number,"year"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "leave_balances_employment_id_fkey"
      columns: ["employment_id"]
isOneToOne: false
      referencedRelation: "employments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leave_balances_leave_type_id_fkey"
      columns: ["leave_type_id"]
isOneToOne: false
      referencedRelation: "leave_types"
      referencedColumns: ["id"]
    }
                  ]
                },"leave_entitlement_rules": {
                  Row: {
                    "days_per_year": number,"id": string,"leave_type_id": string,"max_service_months": number | null,"min_service_months": number
                  }
                  ComputedFields: never
                  Insert: {
                    "days_per_year": number,"id"?: string,"leave_type_id": string,"max_service_months"?: number | null,"min_service_months"?: number
                  }
                  Update: {
                    "days_per_year"?: number,"id"?: string,"leave_type_id"?: string,"max_service_months"?: number | null,"min_service_months"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "leave_entitlement_rules_leave_type_id_fkey"
      columns: ["leave_type_id"]
isOneToOne: false
      referencedRelation: "leave_types"
      referencedColumns: ["id"]
    }
                  ]
                },"leave_requests": {
                  Row: {
                    "approval_request_id": string | null,"attachment_path": string | null,"cover_person_id": string | null,"created_at": string,"created_via": Database["public"]['Enums']["action_channel"],"days": number,"employment_id": string,"end_date": string,"half_day": Database["public"]['Enums']["leave_half"],"id": string,"leave_type_id": string,"reason": string | null,"start_date": string,"status": Database["public"]['Enums']["request_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "approval_request_id"?: string | null,"attachment_path"?: string | null,"cover_person_id"?: string | null,"created_at"?: string,"created_via"?: Database["public"]['Enums']["action_channel"],"days"?: number,"employment_id": string,"end_date": string,"half_day"?: Database["public"]['Enums']["leave_half"],"id"?: string,"leave_type_id": string,"reason"?: string | null,"start_date": string,"status"?: Database["public"]['Enums']["request_status"]
                  }
                  Update: {
                    "approval_request_id"?: string | null,"attachment_path"?: string | null,"cover_person_id"?: string | null,"created_at"?: string,"created_via"?: Database["public"]['Enums']["action_channel"],"days"?: number,"employment_id"?: string,"end_date"?: string,"half_day"?: Database["public"]['Enums']["leave_half"],"id"?: string,"leave_type_id"?: string,"reason"?: string | null,"start_date"?: string,"status"?: Database["public"]['Enums']["request_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "leave_requests_approval_request_id_fkey"
      columns: ["approval_request_id"]
isOneToOne: false
      referencedRelation: "approval_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leave_requests_approval_request_id_fkey"
      columns: ["approval_request_id"]
isOneToOne: false
      referencedRelation: "v_my_approval_tasks"
      referencedColumns: ["request_id"]
    },{
      foreignKeyName: "leave_requests_approval_request_id_fkey"
      columns: ["approval_request_id"]
isOneToOne: false
      referencedRelation: "v_my_requests"
      referencedColumns: ["request_id"]
    },{
      foreignKeyName: "leave_requests_cover_person_id_fkey"
      columns: ["cover_person_id"]
isOneToOne: false
      referencedRelation: "persons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leave_requests_employment_id_fkey"
      columns: ["employment_id"]
isOneToOne: false
      referencedRelation: "employments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leave_requests_leave_type_id_fkey"
      columns: ["leave_type_id"]
isOneToOne: false
      referencedRelation: "leave_types"
      referencedColumns: ["id"]
    }
                  ]
                },"leave_types": {
                  Row: {
                    "active": boolean,"allow_backdate": boolean,"code": string,"company_id": string,"deduct_balance": boolean,"eligible_gender": string | null,"id": string,"is_paid": boolean,"max_carry_forward": number,"name": string,"requires_attachment": boolean,"sla_exempt": boolean,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"allow_backdate"?: boolean,"code": string,"company_id": string,"deduct_balance"?: boolean,"eligible_gender"?: string | null,"id"?: string,"is_paid"?: boolean,"max_carry_forward"?: number,"name": string,"requires_attachment"?: boolean,"sla_exempt"?: boolean,"sort_order"?: number
                  }
                  Update: {
                    "active"?: boolean,"allow_backdate"?: boolean,"code"?: string,"company_id"?: string,"deduct_balance"?: boolean,"eligible_gender"?: string | null,"id"?: string,"is_paid"?: boolean,"max_carry_forward"?: number,"name"?: string,"requires_attachment"?: boolean,"sla_exempt"?: boolean,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "leave_types_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "attempts": number,"bypass_limit": boolean,"channel": string,"claimed_at": string | null,"company_id": string | null,"created_at": string,"error": string | null,"event_id": number | null,"id": string,"message": string,"person_id": string,"provider_ref": string | null,"rule_id": string | null,"sent_at": string | null,"status": Database["public"]['Enums']["notify_status"],"to_address": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"bypass_limit"?: boolean,"channel"?: string,"claimed_at"?: string | null,"company_id"?: string | null,"created_at"?: string,"error"?: string | null,"event_id"?: number | null,"id"?: string,"message": string,"person_id": string,"provider_ref"?: string | null,"rule_id"?: string | null,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["notify_status"],"to_address"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"bypass_limit"?: boolean,"channel"?: string,"claimed_at"?: string | null,"company_id"?: string | null,"created_at"?: string,"error"?: string | null,"event_id"?: number | null,"id"?: string,"message"?: string,"person_id"?: string,"provider_ref"?: string | null,"rule_id"?: string | null,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["notify_status"],"to_address"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "hr_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "persons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_rule_id_fkey"
      columns: ["rule_id"]
isOneToOne: false
      referencedRelation: "automation_rules"
      referencedColumns: ["id"]
    }
                  ]
                },"onboarding_progress": {
                  Row: {
                    "done_at": string,"employment_id": string,"step": string
                  }
                  ComputedFields: never
                  Insert: {
                    "done_at"?: string,"employment_id": string,"step": string
                  }
                  Update: {
                    "done_at"?: string,"employment_id"?: string,"step"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "onboarding_progress_employment_id_fkey"
      columns: ["employment_id"]
isOneToOne: false
      referencedRelation: "employments"
      referencedColumns: ["id"]
    }
                  ]
                },"pay_components": {
                  Row: {
                    "account_ref": string | null,"code": string,"company_id": string,"epf_applicable": boolean,"id": string,"kind": string,"name": string,"socso_applicable": boolean,"taxable": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "account_ref"?: string | null,"code": string,"company_id": string,"epf_applicable"?: boolean,"id"?: string,"kind": string,"name": string,"socso_applicable"?: boolean,"taxable"?: boolean
                  }
                  Update: {
                    "account_ref"?: string | null,"code"?: string,"company_id"?: string,"epf_applicable"?: boolean,"id"?: string,"kind"?: string,"name"?: string,"socso_applicable"?: boolean,"taxable"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "pay_components_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"payroll_runs": {
                  Row: {
                    "approval_request_id": string | null,"company_id": string,"created_at": string,"id": string,"pay_date": string | null,"period_month": number,"period_year": number,"prepared_by": string | null,"status": Database["public"]['Enums']["payroll_status"],"totals": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "approval_request_id"?: string | null,"company_id": string,"created_at"?: string,"id"?: string,"pay_date"?: string | null,"period_month": number,"period_year": number,"prepared_by"?: string | null,"status"?: Database["public"]['Enums']["payroll_status"],"totals"?: Json | null
                  }
                  Update: {
                    "approval_request_id"?: string | null,"company_id"?: string,"created_at"?: string,"id"?: string,"pay_date"?: string | null,"period_month"?: number,"period_year"?: number,"prepared_by"?: string | null,"status"?: Database["public"]['Enums']["payroll_status"],"totals"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payroll_runs_approval_request_id_fkey"
      columns: ["approval_request_id"]
isOneToOne: false
      referencedRelation: "approval_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payroll_runs_approval_request_id_fkey"
      columns: ["approval_request_id"]
isOneToOne: false
      referencedRelation: "v_my_approval_tasks"
      referencedColumns: ["request_id"]
    },{
      foreignKeyName: "payroll_runs_approval_request_id_fkey"
      columns: ["approval_request_id"]
isOneToOne: false
      referencedRelation: "v_my_requests"
      referencedColumns: ["request_id"]
    },{
      foreignKeyName: "payroll_runs_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payroll_runs_prepared_by_fkey"
      columns: ["prepared_by"]
isOneToOne: false
      referencedRelation: "persons"
      referencedColumns: ["id"]
    }
                  ]
                },"payslip_lines": {
                  Row: {
                    "amount": number,"component_code": string,"description": string,"id": string,"kind": string,"payslip_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"component_code": string,"description": string,"id"?: string,"kind": string,"payslip_id": string
                  }
                  Update: {
                    "amount"?: number,"component_code"?: string,"description"?: string,"id"?: string,"kind"?: string,"payslip_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payslip_lines_payslip_id_fkey"
      columns: ["payslip_id"]
isOneToOne: false
      referencedRelation: "payslips"
      referencedColumns: ["id"]
    }
                  ]
                },"payslips": {
                  Row: {
                    "eis_employee": number,"eis_employer": number,"employment_id": string,"epf_employee": number,"epf_employer": number,"gross": number,"hrdf": number,"id": string,"net": number,"payroll_run_id": string,"pcb": number,"pdf_path": string | null,"socso_employee": number,"socso_employer": number,"total_deduction": number,"unpaid_leave_days": number
                  }
                  ComputedFields: never
                  Insert: {
                    "eis_employee"?: number,"eis_employer"?: number,"employment_id": string,"epf_employee"?: number,"epf_employer"?: number,"gross"?: number,"hrdf"?: number,"id"?: string,"net"?: number,"payroll_run_id": string,"pcb"?: number,"pdf_path"?: string | null,"socso_employee"?: number,"socso_employer"?: number,"total_deduction"?: number,"unpaid_leave_days"?: number
                  }
                  Update: {
                    "eis_employee"?: number,"eis_employer"?: number,"employment_id"?: string,"epf_employee"?: number,"epf_employer"?: number,"gross"?: number,"hrdf"?: number,"id"?: string,"net"?: number,"payroll_run_id"?: string,"pcb"?: number,"pdf_path"?: string | null,"socso_employee"?: number,"socso_employer"?: number,"total_deduction"?: number,"unpaid_leave_days"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "payslips_employment_id_fkey"
      columns: ["employment_id"]
isOneToOne: false
      referencedRelation: "employments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payslips_payroll_run_id_fkey"
      columns: ["payroll_run_id"]
isOneToOne: false
      referencedRelation: "payroll_runs"
      referencedColumns: ["id"]
    }
                  ]
                },"persons": {
                  Row: {
                    "address": string | null,"auth_user_id": string | null,"bank_account_no": string | null,"bank_name": string | null,"children_count": number,"created_at": string,"date_of_birth": string | null,"email": string | null,"full_name": string,"gender": string | null,"hide_birthday": boolean,"ic_no": string | null,"id": string,"is_active": boolean,"language": string,"marital_status": string | null,"passport_no": string | null,"phone_whatsapp": string | null,"photo_path": string | null,"preferred_name": string | null,"spouse_working": boolean | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"auth_user_id"?: string | null,"bank_account_no"?: string | null,"bank_name"?: string | null,"children_count"?: number,"created_at"?: string,"date_of_birth"?: string | null,"email"?: string | null,"full_name": string,"gender"?: string | null,"hide_birthday"?: boolean,"ic_no"?: string | null,"id"?: string,"is_active"?: boolean,"language"?: string,"marital_status"?: string | null,"passport_no"?: string | null,"phone_whatsapp"?: string | null,"photo_path"?: string | null,"preferred_name"?: string | null,"spouse_working"?: boolean | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"auth_user_id"?: string | null,"bank_account_no"?: string | null,"bank_name"?: string | null,"children_count"?: number,"created_at"?: string,"date_of_birth"?: string | null,"email"?: string | null,"full_name"?: string,"gender"?: string | null,"hide_birthday"?: boolean,"ic_no"?: string | null,"id"?: string,"is_active"?: boolean,"language"?: string,"marital_status"?: string | null,"passport_no"?: string | null,"phone_whatsapp"?: string | null,"photo_path"?: string | null,"preferred_name"?: string | null,"spouse_working"?: boolean | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"platform_admins": {
                  Row: {
                    "created_at": string,"person_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"person_id": string
                  }
                  Update: {
                    "created_at"?: string,"person_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "platform_admins_person_id_fkey"
      columns: ["person_id"]
isOneToOne: true
      referencedRelation: "persons"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_audit_log": {
                  Row: {
                    "action": string,"actor_person_id": string | null,"company_id": string | null,"created_at": string,"details": NonNullable<Json>,"id": number,"target_id": string | null,"target_type": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_person_id"?: string | null,"company_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: never,"target_id"?: string | null,"target_type"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_person_id"?: string | null,"company_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: never,"target_id"?: string | null,"target_type"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "platform_audit_log_actor_person_id_fkey"
      columns: ["actor_person_id"]
isOneToOne: false
      referencedRelation: "persons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "platform_audit_log_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_settings": {
                  Row: {
                    "key": string,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"value": NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"positions": {
                  Row: {
                    "company_id": string,"id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"id"?: string,"title": string
                  }
                  Update: {
                    "company_id"?: string,"id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "positions_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"public_holidays": {
                  Row: {
                    "company_id": string | null,"holiday_date": string,"id": string,"is_adhoc": boolean,"is_mandatory": boolean,"name": string,"state": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id"?: string | null,"holiday_date": string,"id"?: string,"is_adhoc"?: boolean,"is_mandatory"?: boolean,"name": string,"state"?: string | null
                  }
                  Update: {
                    "company_id"?: string | null,"holiday_date"?: string,"id"?: string,"is_adhoc"?: boolean,"is_mandatory"?: boolean,"name"?: string,"state"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "public_holidays_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"statutory_rates": {
                  Row: {
                    "code": string,"effective_from": string,"effective_to": string | null,"id": string,"notes": string | null,"params": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"effective_from": string,"effective_to"?: string | null,"id"?: string,"notes"?: string | null,"params": NonNullable<Json>
                  }
                  Update: {
                    "code"?: string,"effective_from"?: string,"effective_to"?: string | null,"id"?: string,"notes"?: string | null,"params"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"usage_counters": {
                  Row: {
                    "ai_calls": number,"company_id": string,"month": string,"wa_limit_notified": boolean,"wa_sent": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_calls"?: number,"company_id": string,"month": string,"wa_limit_notified"?: boolean,"wa_sent"?: number
                  }
                  Update: {
                    "ai_calls"?: number,"company_id"?: string,"month"?: string,"wa_limit_notified"?: boolean,"wa_sent"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "usage_counters_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"user_roles": {
                  Row: {
                    "company_id": string,"id": string,"person_id": string,"role": Database["public"]['Enums']["app_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"id"?: string,"person_id": string,"role": Database["public"]['Enums']["app_role"]
                  }
                  Update: {
                    "company_id"?: string,"id"?: string,"person_id"?: string,"role"?: Database["public"]['Enums']["app_role"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_roles_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_roles_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "persons"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "v_my_approval_tasks": {
                  Row: {
                    "ai_summary": string | null,"assigned_at": string,"company_code": string,"company_id": string,"context": NonNullable<Json>,"delegated_from": string | null,"department": string | null,"request_id": string,"request_type": Database["public"]['Enums']["request_type"],"requester_name": string | null,"requester_nickname": string | null,"requester_photo": string | null,"sla_breached": boolean,"sla_due_at": string | null,"step_name": string,"submitted_at": string,"task_id": string,"title": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "approval_requests_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_tasks_delegated_from_fkey"
      columns: ["delegated_from"]
isOneToOne: false
      referencedRelation: "persons"
      referencedColumns: ["id"]
    }
                  ]
                },"v_my_requests": {
                  Row: {
                    "company_code": string,"completed_at": string | null,"request_id": string,"request_type": Database["public"]['Enums']["request_type"],"sla_due_at": string | null,"status": Database["public"]['Enums']["request_status"],"submitted_at": string,"title": string,"waiting_for": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "accept_invite":
{ Args: { "p_ic_last4": string,"p_token": string }; Returns: Json
                           },
"add_employee":
{ Args: { "p_basic"?: number,"p_company": string,"p_department": string,"p_full_name": string,"p_ic": string,"p_join": string,"p_phone": string,"p_position": string,"p_preferred": string,"p_probation_months"?: number,"p_type"?: Database["public"]['Enums']["employment_type"] }; Returns: string
                           },
"approval_act":
{ Args: { "p_action": string,"p_comment"?: string,"p_on_behalf"?: string,"p_task": string,"p_via"?: Database["public"]['Enums']["action_channel"] }; Returns: {
              "ai_summary": string | null,
"company_id": string,
"completed_at": string | null,
"context": NonNullable<Json>,
"current_step_order": number,
"id": string,
"reference_id": string,
"request_type": Database["public"]['Enums']["request_type"],
"requester_employment_id": string | null,
"requester_person_id": string,
"sla_breached": boolean,
"sla_due_at": string | null,
"status": Database["public"]['Enums']["request_status"],
"submitted_at": string,
"title": string,
"workflow_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "approval_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"approval_advance":
{ Args: { "p_request": string }; Returns: undefined
                           },
"approval_apply_outcome":
{ Args: { "p_req": Omit<Database["public"]['Tables']["approval_requests"]['Row'], Database["public"]['Tables']["approval_requests"]['ComputedFields']> }; Returns: undefined
                           },
"approval_cancel":
{ Args: { "p_on_behalf"?: string,"p_request": string,"p_via"?: Database["public"]['Enums']["action_channel"] }; Returns: undefined
                           },
"approval_create":
{ Args: { "p_context": Json,"p_employment": string,"p_reference": string,"p_sla_exempt": boolean,"p_title": string,"p_type": Database["public"]['Enums']["request_type"],"p_via": Database["public"]['Enums']["action_channel"] }; Returns: string
                           },
"approval_resolve_approvers":
{ Args: { "p_req": Omit<Database["public"]['Tables']["approval_requests"]['Row'], Database["public"]['Tables']["approval_requests"]['ComputedFields']>,"p_step": Omit<Database["public"]['Tables']["approval_workflow_steps"]['Row'], Database["public"]['Tables']["approval_workflow_steps"]['ComputedFields']> }; Returns: {
              "approver": string,"delegated_from": string
            }[]
                           },
"approval_sla_due":
{ Args: { "p_at": string,"p_company": string,"p_exempt": boolean,"p_wf": Omit<Database["public"]['Tables']["approval_workflows"]['Row'], Database["public"]['Tables']["approval_workflows"]['ComputedFields']> }; Returns: string
                           },
"approval_sla_tick":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"bump_usage":
{ Args: { "p_company": string,"p_kind": string,"p_n"?: number }; Returns: boolean
                           },
"can_view_employment":
{ Args: { "p_employment": string }; Returns: boolean
                           },
"can_view_request":
{ Args: { "p_request": string }; Returns: boolean
                           },
"complete_onboarding_step":
{ Args: { "p_employment": string,"p_step": string }; Returns: number
                           },
"create_invite":
{ Args: { "p_employment": string }; Returns: string
                           },
"current_person_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"decide_company_access":
{ Args: { "p_approve": boolean,"p_grant": string,"p_note"?: string }; Returns: {
              "company_id": string,
"created_at": string,
"days": number,
"decided_at": string | null,
"decided_by": string | null,
"decision_note": string | null,
"expires_at": string | null,
"id": string,
"person_id": string,
"reason": string,
"role": Database["public"]['Enums']["app_role"],
"status": string
            }
                          SetofOptions: {
        from: "*"
        to: "company_access_grants"
        isOneToOne: true
        isSetofReturn: false
      } },
"emit_event":
{ Args: { "p_company": string,"p_employment": string,"p_payload": Json,"p_person": string,"p_type": string }; Returns: number
                           },
"employment_company":
{ Args: { "p_employment": string }; Returns: string
                           },
"ensure_leave_balance":
{ Args: { "p_employment": string,"p_leave_type": string,"p_year": number }; Returns: {
              "adjustment": number,
"available": number | null,
"carried_forward": number,
"employment_id": string,
"entitled": number,
"id": string,
"leave_type_id": string,
"pending": number,
"used": number,
"year": number
            }
                          SetofOptions: {
        from: "*"
        to: "leave_balances"
        isOneToOne: true
        isSetofReturn: false
      } },
"eval_condition":
{ Args: { "cond": Json,"ctx": Json }; Returns: boolean
                           },
"fmt_num":
{ Args: { "n": number }; Returns: string
                           },
"fmt_tarikh":
{ Args: { "d": string }; Returns: string
                           },
"has_role":
{ Args: { "p_company": string,"p_roles": (Database["public"]['Enums']["app_role"])[] }; Returns: boolean
                           },
"ingest_attendance":
{ Args: { "p_company": string,"p_date": string,"p_employee_no": string,"p_external_id": string,"p_in": string,"p_out": string,"p_raw": Json,"p_source": string }; Returns: {
              "clock_in": string | null,
"clock_out": string | null,
"created_at": string,
"employment_id": string,
"external_id": string | null,
"id": string,
"late_minutes": number,
"raw": Json | null,
"source": string,
"work_date": string
            }
                          SetofOptions: {
        from: "*"
        to: "attendance_records"
        isOneToOne: true
        isSetofReturn: false
      } },
"ingest_punch":
{ Args: { "p_checktype"?: number,"p_company": string,"p_device_name"?: string,"p_device_sn"?: string,"p_raw"?: Json,"p_time": string,"p_uuid": string,"p_workno": string }; Returns: boolean
                           },
"invite_preview":
{ Args: { "p_token": string }; Returns: Json
                           },
"is_approver_of":
{ Args: { "p_request": string }; Returns: boolean
                           },
"is_company_active":
{ Args: { "p_company": string }; Returns: boolean
                           },
"is_company_member":
{ Args: { "p_company": string }; Returns: boolean
                           },
"is_service_role":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_superadmin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_working_day":
{ Args: { "p_company": string,"p_date": string,"p_state"?: string }; Returns: boolean
                           },
"leave_count_days":
{ Args: { "p_employment": string,"p_end": string,"p_half": Database["public"]['Enums']["leave_half"],"p_start": string }; Returns: number
                           },
"leave_entitlement":
{ Args: { "p_employment": string,"p_leave_type": string,"p_year": number }; Returns: number
                           },
"log_platform":
{ Args: { "p_action": string,"p_company": string,"p_details"?: Json,"p_target": string,"p_target_type": string }; Returns: undefined
                           },
"match_attendance_workno":
{ Args: { "p_employment": string,"p_workno": string }; Returns: number
                           },
"my_colleagues":
{ Args: { "p_company": string }; Returns: {
              "department": string,"department_id": string,"name": string,"person_id": string
            }[]
                           },
"next_working_day":
{ Args: { "p_company": string,"p_date": string }; Returns: string
                           },
"normalize_msisdn":
{ Args: { "p_phone": string }; Returns: string
                           },
"notify_mark":
{ Args: { "p_error"?: string,"p_id": string,"p_ok": boolean,"p_provider_ref"?: string }; Returns: undefined
                           },
"notify_next":
{ Args: { "p_limit"?: number }; Returns: {
              "company_id": string,"id": string,"message": string,"to_address": string
            }[]
                           },
"notify_person":
{ Args: { "p_company": string,"p_message": string,"p_person": string }; Returns: undefined
                           },
"platform_setting":
{ Args: { "p_key": string }; Returns: Json
                           },
"process_hr_events":
{ Args: { "p_limit"?: number }; Returns: number
                           },
"rebuild_attendance_day":
{ Args: { "p_date": string,"p_employment": string }; Returns: undefined
                           },
"register_company":
{ Args: { "p_company_name": string,"p_email"?: string,"p_full_name": string,"p_phone": string,"p_size": string }; Returns: string
                           },
"render_template":
{ Args: { "p_tpl": string,"p_vars": Json }; Returns: string
                           },
"request_company_access":
{ Args: { "p_company_code": string,"p_days": number,"p_reason": string,"p_role": Database["public"]['Enums']["app_role"] }; Returns: string
                           },
"request_requester_name":
{ Args: { "p_request": string }; Returns: string
                           },
"resolve_actor":
{ Args: { "p_on_behalf": string }; Returns: string
                           },
"revoke_company_access":
{ Args: { "p_grant": string }; Returns: undefined
                           },
"sa_company_overview":
{ Args: Record<PropertyKey, never>; Returns: {
              "admins": string,"ai_limit": number,"ai_used": number,"code": string,"company_id": string,"created_at": string,"name": string,"onboarding_steps": number,"staff_active": number,"status": string,"wa_limit": number,"wa_used": number
            }[]
                           },
"sa_set_company_limits":
{ Args: { "p_ai": number,"p_company": string,"p_wa": number }; Returns: undefined
                           },
"sa_set_company_status":
{ Args: { "p_company": string,"p_reason": string,"p_status": string }; Returns: undefined
                           },
"sa_set_person_active":
{ Args: { "p_active": boolean,"p_person": string,"p_reason"?: string }; Returns: undefined
                           },
"save_onboarding_step":
{ Args: { "p_data"?: Json,"p_employment": string,"p_step": string }; Returns: number
                           },
"seed_company_defaults":
{ Args: { "p_company": string }; Returns: undefined
                           },
"set_company_holidays":
{ Args: { "p_company": string,"p_holiday_ids": (string)[],"p_year": number }; Returns: number
                           },
"submit_attendance_correction":
{ Args: { "p_date": string,"p_employment": string,"p_in": string,"p_on_behalf"?: string,"p_out": string,"p_reason": string,"p_via"?: Database["public"]['Enums']["action_channel"] }; Returns: {
              "approval_request_id": string | null,
"created_at": string,
"created_via": Database["public"]['Enums']["action_channel"],
"employment_id": string,
"id": string,
"reason": string,
"requested_clock_in": string | null,
"requested_clock_out": string | null,
"status": Database["public"]['Enums']["request_status"],
"work_date": string
            }
                          SetofOptions: {
        from: "*"
        to: "attendance_corrections"
        isOneToOne: true
        isSetofReturn: false
      } },
"submit_claim":
{ Args: { "p_claim": string,"p_on_behalf"?: string,"p_via"?: Database["public"]['Enums']["action_channel"] }; Returns: {
              "approval_request_id": string | null,
"created_at": string,
"created_via": Database["public"]['Enums']["action_channel"],
"employment_id": string,
"id": string,
"paid_at": string | null,
"paid_via_payroll_run": string | null,
"status": Database["public"]['Enums']["request_status"],
"title": string,
"total_amount": number
            }
                          SetofOptions: {
        from: "*"
        to: "claims"
        isOneToOne: true
        isSetofReturn: false
      } },
"submit_leave":
{ Args: { "p_attachment"?: string,"p_cover_person"?: string,"p_employment": string,"p_end": string,"p_half"?: Database["public"]['Enums']["leave_half"],"p_leave_code": string,"p_on_behalf"?: string,"p_reason"?: string,"p_start": string,"p_via"?: Database["public"]['Enums']["action_channel"] }; Returns: {
              "approval_request_id": string | null,
"attachment_path": string | null,
"cover_person_id": string | null,
"created_at": string,
"created_via": Database["public"]['Enums']["action_channel"],
"days": number,
"employment_id": string,
"end_date": string,
"half_day": Database["public"]['Enums']["leave_half"],
"id": string,
"leave_type_id": string,
"reason": string | null,
"start_date": string,
"status": Database["public"]['Enums']["request_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "leave_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"submit_payroll_run":
{ Args: { "p_on_behalf"?: string,"p_run": string }; Returns: {
              "approval_request_id": string | null,
"company_id": string,
"created_at": string,
"id": string,
"pay_date": string | null,
"period_month": number,
"period_year": number,
"prepared_by": string | null,
"status": Database["public"]['Enums']["payroll_status"],
"totals": Json | null
            }
                          SetofOptions: {
        from: "*"
        to: "payroll_runs"
        isOneToOne: true
        isSetofReturn: false
      } },
"team_birthdays":
{ Args: { "p_company": string,"p_from": string,"p_to": string }; Returns: {
              "day": number,"department": string,"month": number,"name": string,"person_id": string
            }[]
                           },
"whatsapp_handle_reply":
{ Args: { "p_phone": string,"p_text": string }; Returns: Json
                           }
          }
          Enums: {
            "accounting_system": "quickbooks"|"niagawan"|"csv"|"none","action_channel": "web"|"whatsapp"|"ai_agent"|"system","app_role": "staff"|"dept_head"|"hr"|"finance"|"ceo"|"admin","approver_type": "dept_head"|"direct_manager"|"specific_person"|"role","employment_status": "probation"|"active"|"resigned"|"terminated"|"retired","employment_type": "permanent"|"contract"|"part_time"|"intern","leave_half": "full"|"am"|"pm","notify_status": "pending"|"sent"|"failed"|"skipped","notify_target": "subject"|"subject_manager"|"subject_dept_head"|"role_hr"|"role_ceo"|"specific_person"|"cover_person"|"dept_peers","payroll_status": "draft"|"calculated"|"pending"|"approved"|"paid"|"locked"|"returned"|"rejected"|"cancelled","request_status": "draft"|"pending"|"approved"|"rejected"|"returned"|"cancelled","request_type": "leave"|"claim"|"attendance_correction"|"payroll_run"|"overtime"|"salary_advance","sla_mode": "none"|"same_day"|"hours","step_mode": "any"|"all","sync_status": "pending"|"success"|"failed"|"skipped","task_status": "pending"|"approved"|"rejected"|"returned"|"superseded"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "accounting_system": ["quickbooks", "niagawan", "csv", "none"],"action_channel": ["web", "whatsapp", "ai_agent", "system"],"app_role": ["staff", "dept_head", "hr", "finance", "ceo", "admin"],"approver_type": ["dept_head", "direct_manager", "specific_person", "role"],"employment_status": ["probation", "active", "resigned", "terminated", "retired"],"employment_type": ["permanent", "contract", "part_time", "intern"],"leave_half": ["full", "am", "pm"],"notify_status": ["pending", "sent", "failed", "skipped"],"notify_target": ["subject", "subject_manager", "subject_dept_head", "role_hr", "role_ceo", "specific_person", "cover_person", "dept_peers"],"payroll_status": ["draft", "calculated", "pending", "approved", "paid", "locked", "returned", "rejected", "cancelled"],"request_status": ["draft", "pending", "approved", "rejected", "returned", "cancelled"],"request_type": ["leave", "claim", "attendance_correction", "payroll_run", "overtime", "salary_advance"],"sla_mode": ["none", "same_day", "hours"],"step_mode": ["any", "all"],"sync_status": ["pending", "success", "failed", "skipped"],"task_status": ["pending", "approved", "rejected", "returned", "superseded"]
          }
        }
} as const
