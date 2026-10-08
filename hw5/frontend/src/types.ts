export type Role = 'boss' | 'inventory' | 'accounting' | 'facilities' | 'customer_service'
export interface Ticket {
  id: number; type: string; requester: string; subject: string; sku: string | null
  size: string | null; qty: number | null; lease_id: number | null; invoice_id: number | null
  status: string; notes: string | null; created_at: string
}
export interface Session { authenticated: boolean; operator?: string; csrf_token?: string }
export interface Proposal {
  action_id: string
  action: { ticket_id: number; kind: string; ref_id: number; account: string; amount: number
    shop_date: string; balance_before: number; balance_after: number
    details: { payee: string; due_date?: string; sku?: string; size?: string; quantity?: number } }
  ready_for_approval: boolean; requires_human_approval: boolean
  blockers: string[]; assumptions: string[]; executed: boolean
}
export interface AgentReport {
  summary: string; facts: string[]; calculations: string[]; uncertainties: string[]
  recommendation: string; draft_message: string | null; needs_human_decision: boolean
}
export interface Contribution { agent: Role; report: AgentReport }
export interface TeamResult {
  run_id: string; ticket_id: number; status: string; read_only: boolean
  report: AgentReport | null; agents_worked: Role[]; contributions: Contribution[]
  payment_proposals: Proposal[]; usage: Record<string, number | null>; error: string | null
}
export interface Job {
  run_id: string; ticket_id: number; status: string; read_only: boolean; generation: number
  created_at_utc: string; finished_at_utc?: string; result: TeamResult | null; error?: string
}
export interface AuditEvent {
  sequence: number; timestamp_utc: string; run_id: string; ticket_id: number
  agent: string; event: string; data: Record<string, any>
}
export interface Cash { shop_date: string; account: { name: string; balance: number; date: string }; generation: number }
