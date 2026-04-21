
export type Employee = {
  id: string
  name: string
  full_name?: string
  role: string
}

export type FormularyItem = {
  id: string
  item_name: string
  category: string
  unit_type?: string | null
}

export type InventoryItem = {
  id: string
  item_name: string
  category: string
  quantity: number
  incident_unit_id: string
  cs_lot_number?: string | null
  cs_expiration_date?: string | null
}

export type FormState = {
  date: string
  time: string
  med_unit: string
  item_name: string
  category: string
  lot_number: string
  exp_date: string
  qty_used: string
  qty_wasted: string
  dosage_units: string
  patient_name: string
  dob: string
  indication: string
  sig_directions: string
  dispensed_by: string
  prescribing_provider: string
  encounter_id: string
  medication_route: string
  response_to_medication: string
  medication_authorization: string
  waste_witness: string
}

export const inputCls = 'w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500'
export const labelCls = 'block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1'
export const sectionCls = 'text-xs font-bold uppercase tracking-wide text-gray-400 mt-4 mb-2'

export const ROUTES = [
  'Intravenous (IV)', 'Intramuscular (IM)', 'Oral', 'Intranasal',
  'Subcutaneous', 'Intraosseous (IO)', 'Inhalation', 'Nebulizer',
  'Sublingual', 'Topical', 'Endotracheal Tube (ET)', 'CPAP', 'BVM',
  'Auto Injector', 'Other/miscellaneous',
]

export const RESPONSES = ['Improved', 'Unchanged', 'Worse', 'Unknown']

export const ROUTE_SUGGESTIONS: Record<string, string> = {
  'Morphine Sulfate': 'Intravenous (IV)',
  'Fentanyl': 'Intravenous (IV)',
  'Midazolam (Versed)': 'Intramuscular (IM)',
  'Ketamine': 'Intramuscular (IM)',
  'Naloxone': 'Intranasal',
  'Albuterol Solution': 'Nebulizer',
  'Albuterol Inhaler': 'Inhalation',
  'Normal Saline 1L': 'Intravenous (IV)',
  'Lactated Ringers': 'Intravenous (IV)',
  'Ondansetron (Zofran) 4mg Injection': 'Intravenous (IV)',
  'Ondansetron (Zofran) 4mg Tablet': 'Oral',
  'Dexamethasone 10mg Injection': 'Intravenous (IV)',
  'Dexamethasone 4mg Tablet': 'Oral',
  'Diphenhydramine 50mg Injection': 'Intravenous (IV)',
  'Diphenhydramine (Benadryl)': 'Oral',
  'Ketorolac (Toradol) 30mg Injection': 'Intramuscular (IM)',
  'Amoxicillin': 'Oral',
  'Doxycycline 100mg': 'Oral',
  'Cephalexin': 'Oral',
  'Epinephrine 1:1000': 'Intramuscular (IM)',
  'Epinephrine 1:10000': 'Intravenous (IV)',
  'Adenosine': 'Intravenous (IV)',
  'Amiodarone': 'Intravenous (IV)',
  'Atropine Sulfate': 'Intravenous (IV)',
  'Lidocaine': 'Intravenous (IV)',
  'Magnesium Sulfate': 'Intravenous (IV)',
}

export const DOSAGE_UNIT_SUGGESTIONS: Record<string, string> = {
  'Morphine Sulfate': 'mg',
  'Fentanyl': 'mcg',
  'Midazolam (Versed)': 'mg',
  'Ketamine': 'mg',
  'Naloxone': 'mg',
}

export const UNIT_OPTIONS = [
  'Medic 1', 'Medic 2', 'Medic 3', 'Medic 4',
  'Aid 1', 'Aid 2', 'Command 1',
  'Rescue 1', 'Rescue 2',
]
