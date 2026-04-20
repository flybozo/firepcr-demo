export type ICS214Header = {
  id: string
  ics214_id: string
  incident_id: string
  incident_name: string
  unit_id: string
  unit_name: string
  op_date: string
  op_start: string
  op_end: string
  leader_name: string
  leader_position: string
  status: 'Open' | 'Closed'
  pdf_url: string | null
  pdf_file_name: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  closed_at: string | null
  closed_by: string | null
}

export type Activity = {
  id: string
  ics214_id: string
  log_datetime: string
  description: string
  logged_by: string
  activity_type: 'activity' | 'patient_contact' | 'system'
}

export type Personnel = {
  id: string
  ics214_id: string
  employee_name: string
  ics_position: string
  home_agency: string
}

export type PatientEncounter = {
  id: string
  patient_last_name: string | null
  patient_first_name: string | null
  chief_complaint: string | null
  disposition: string | null
  encounter_id: string | null
}
