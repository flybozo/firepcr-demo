
type EncounterForExport = {
  seq_id: string
  date: string | null
  unit: string | null
  patient_agency: string | null
  age: string | null
  chief_complaint: string | null
  acuity: string
  disposition: string | null
  has_comp_claim: boolean
  has_ama: boolean
  created_at?: string | null
}

function escapeCell(val: string | null | undefined): string {
  if (val == null) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

export function exportPatientLogCsv(encounters: EncounterForExport[], incidentName: string): void {
  const today = new Date().toISOString().slice(0, 10)
  const safeName = incidentName.replace(/[/\\?%*:|"<>]/g, '-')
  const filename = `${safeName} - Patient Log - ${today}.csv`

  const headers = ['Seq ID', 'Date', 'Time', 'Unit', 'Agency', 'Age', 'Chief Complaint', 'Acuity', 'Disposition', 'Comp Claim', 'AMA']

  const rows = encounters.map(e => {
    const time = e.created_at
      ? new Date(e.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      : ''
    return [
      e.seq_id,
      e.date || '',
      time,
      e.unit || '',
      e.patient_agency || '',
      e.age || '',
      e.chief_complaint || '',
      e.acuity || '',
      e.disposition || '',
      e.has_comp_claim ? 'Yes' : 'No',
      e.has_ama ? 'Yes' : 'No',
    ].map(escapeCell)
  })

  const csv = [headers.map(escapeCell), ...rows].map(r => r.join(',')).join('\r\n')

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
