export type Incident = {
  id: string
  name: string
  location: string | null
  latitude: number | null
  longitude: number | null
  incident_number: string | null
  agreement_number: string | null
  financial_code: string | null
  resource_order_number: string | null
  finance_contact_name: string | null
  finance_contact_email: string | null
  finance_contact_phone: string | null
  start_date: string | null
  status: string
  med_unit_leader_name?: string | null
  med_unit_leader_email?: string | null
  med_unit_leader_phone?: string | null
  logs_contact_name?: string | null
  logs_contact_email?: string | null
  logs_contact_phone?: string | null
  comp_claims_name?: string | null
  comp_claims_email?: string | null
  comp_claims_phone?: string | null
  contract_url?: string | null
  contract_file_name?: string | null
  [key: string]: unknown
}

export type IncidentUnit = {
  id: string
  unit: { id: string; name: string; type?: string; [key: string]: unknown } | null
  _crew_count: number
  assigned_at?: string | null
  released_at?: string | null
  daily_contract_rate?: number | null
}

export type Unit = {
  id: string
  name: string
  type?: string | null
  [key: string]: unknown
}

export type EncounterRow = {
  id: string
  date: string | null
  patient_last_name: string | null
  patient_first_name: string | null
  unit: string | null
  acuity?: string | null
  initial_acuity?: string | null
  [key: string]: unknown
}

export type MARRow = {
  id: string
  date: string | null
  item_name: string | null
  med_unit: string | null
  [key: string]: unknown
}

export type SupplyRunRow = {
  id: string
  run_date: string
  incident_unit: { unit: { name: string } | null } | null
  item_count?: number
  [key: string]: unknown
}

export type Employee = {
  id: string
  name: string
  role: string
  daily_rate: number | null
}

export type DeploymentRecord = {
  id: string
  employee_id: string
  travel_date: string
  check_in_date: string | null
  check_out_date: string | null
  daily_rate: number
  status: string
  notes: string | null
  employees: { name: string; role: string } | null
}

export type CrewDeployment = {
  assignment_id: string
  employee_id: string
  employee_name: string
  employee_role: string
  employee_headshot_url: string | null
  unit_name: string
  daily_rate: number
  hours_per_day: number
  released_at: string | null
  assigned_at: string | null
  deployment_id: string | null
  travel_date: string | null
  check_in_at: string | null
  check_out_at: string | null
  deploy_status: string
  notes: string | null
}

export type CompClaimRow = {
  id: string
  patient_name: string | null
  unit: string | null
  date_of_injury: string | null
  status: string | null
  injury_type: string | null
  pdf_url: string | null
}

export type ReorderRow = {
  id: string
  item_name: string
  quantity: number
  par_qty: number
  unit_name: string
}

export type ICS214Row = {
  ics214_id: string
  unit_name: string
  op_date: string
  status: string
}

export type ExpenseRow = {
  id: string
  expense_type: string
  amount: number
  description: string | null
  expense_date: string
  unit_id: string | null
  employee_id: string | null
  created_by: string | null
  receipt_url: string | null
  no_receipt_reason?: string | null
  employees?: { name: string } | null
}
