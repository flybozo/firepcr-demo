export type Employee = { id: string; name: string; role: string }
export type Assignment = { id: string; role_on_unit: string; employee: Employee | null }
export type IncidentUnit = {
  id: string
  incident: { id: string; name: string; status: string } | null
  unit_assignments: Assignment[]
  released_at?: string | null
}
export type DeploymentRow = {
  id: string
  assigned_at: string
  released_at: string | null
  daily_contract_rate: number | null
  incident: { id: string; name: string; status: string } | null
}
export type Unit = {
  id: string
  name: string
  active: boolean
  unit_status: string | null
  vin: string | null
  license_plate: string | null
  plate_state: string | null
  make: string | null
  model: string | null
  year: number | null
  photo_url: string | null
  vehicle_subtype: string | null
  unit_type: { name: string; default_contract_rate: number | null } | null
  incident_units: IncidentUnit[]
}
export type ChildUnit = {
  id: string
  name: string
  vin: string | null
  license_plate: string | null
  plate_state: string | null
  vehicle_subtype: string | null
}
export type InventoryItem = {
  id: string
  item_name: string
  category: string
  quantity: number
  par_qty: number
}
export type VehicleForm = {
  make: string; model: string; year: string
  vin: string; license_plate: string; plate_state: string; photo_url: string
}
export type VehicleDoc = {
  id: string
  doc_type: string
  file_url: string
  file_name: string | null
  expiration_date: string | null
  notes: string | null
}
