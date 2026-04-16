import { jsPDF } from 'jspdf'

export type CompClaimsData = {
  // Employee info
  patient_name: string
  employee_agency?: string
  employee_crew?: string
  // Physician / facility
  provider_name?: string
  hospital_name?: string
  facility_city?: string
  facility_state?: string
  transported_to_hospital?: string  // 'Yes' | 'No'
  hospitalized_overnight?: string
  // Incident info
  case_no?: string
  date_of_injury?: string
  time_employee_began_work?: string
  time_of_event?: string
  activity_prior?: string
  what_happened?: string  // mechanism + body part
  body_part?: string
  mechanism?: string
  what_harmed?: string
  lost_time?: string
  // RAM supplement
  incident?: string
  unit?: string
  clinical_impression?: string
  treatment_summary?: string
  notes?: string
  supervisor_name?: string
  supervisor_phone?: string
  coordinator_name?: string
  coordinator_phone?: string
  coordinator_email?: string
  // Employer
  employer_name?: string
  employer_address?: string
  generated_date?: string
  claim_id?: string
}

export function generateCompClaimsPDF(d: CompClaimsData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  const W = 612, ML = 36, MR = 36, colW = W - ML - MR
  let y = 36

  const f = (v?: string | null) => v || ''
  const BLACK: [number, number, number] = [0, 0, 0]
  const NAV: [number, number, number] = [30, 58, 95]   // OSHA dark blue
  const LGRAY: [number, number, number] = [240, 240, 240]
  const SUPHEAD: [number, number, number] = [55, 65, 81] // supplement header

  function sectionHeader(title: string, bg: [number, number, number] = NAV) {
    doc.setFillColor(...bg)
    doc.rect(ML, y, colW, 16, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255)
    doc.text(title, ML + 4, y + 11)
    doc.setTextColor(...BLACK)
    y += 16
  }

  function labelField(label: string, value: string, x: number, w: number, fieldH = 20) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(60, 60, 60)
    doc.text(label, x + 2, y + 9)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...BLACK)
    doc.rect(x, y + 11, w, fieldH)
    if (value) {
      const lines = doc.splitTextToSize(value, w - 4) as string[]
      doc.text(lines.slice(0, Math.floor(fieldH / 11)), x + 2, y + 20)
    }
    return fieldH + 11
  }

  function rowFields(fields: { label: string; value: string; w: number; h?: number }[]) {
    const maxH = Math.max(...fields.map(f => (f.h || 20)))
    const gapCount = fields.length - 1
    const totalRequested = fields.reduce((s, f) => s + f.w, 0)
    // Normalize widths so they always fill colW exactly (no ragged right edge)
    const scale = (colW - gapCount * 4) / totalRequested
    const normalizedWidths = fields.map(f => f.w * scale)
    let x = ML
    fields.forEach((field, i) => {
      // Last field gets any rounding remainder so right edge is flush
      const w = i === fields.length - 1 ? (ML + colW - x) : normalizedWidths[i]
      labelField(field.label, field.value, x, w, field.h || 20)
      x += w + 4
    })
    y += maxH + 13
  }

  function checkField(label: string, value: string, options: string[], x: number, w: number) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(60, 60, 60)
    doc.text(label, x + 2, y + 9)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...BLACK)
    let cx = x + 2
    for (const opt of options) {
      const checked = value?.toLowerCase() === opt.toLowerCase()
      // Draw a small square box, filled if checked
      if (checked) {
        doc.setFillColor(30, 58, 95)
        doc.rect(cx, y + 14, 8, 8, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(7)
        doc.text('X', cx + 1.5, y + 20.5)
        doc.setTextColor(...BLACK)
        doc.setFontSize(9)
      } else {
        doc.setDrawColor(120, 120, 120)
        doc.rect(cx, y + 14, 8, 8)
        doc.setDrawColor(0, 0, 0)
      }
      doc.text(opt, cx + 11, y + 22)
      cx += 11 + doc.getTextWidth(opt) + 10
    }
  }

  // ── Page header ──
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100, 100, 100)
  doc.text('U.S. Department of Labor  |  Occupational Safety and Health Administration', W / 2, y + 10, { align: 'center' }); y += 14
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...BLACK)
  doc.text('Injury and Illness Incident Report', W / 2, y + 14, { align: 'center' }); y += 18
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text('OSHA Form 301  |  OMB No. 1218-0176', W / 2, y + 10, { align: 'center' }); y += 12
  doc.setFontSize(8); doc.setTextColor(30, 58, 95)
  doc.text('RAM Clinical Supplement attached — clinical details on reverse', W / 2, y + 10, { align: 'center' })
  doc.setTextColor(...BLACK); y += 18

  // ── Section 1: Employee ──
  sectionHeader('1. Information About the Employee')
  rowFields([
    { label: '1. Full name', value: f(d.patient_name), w: colW * 0.55 },
    { label: 'Agency', value: f(d.employee_agency) || 'Remote Area Medicine', w: colW * 0.42 },
  ])
  rowFields([
    { label: '3. Date of birth', value: '', w: colW * 0.25 },
    { label: '4. Date hired', value: '', w: colW * 0.25 },
    { label: '5. Job title / Assignment', value: f(d.employee_crew), w: colW * 0.45 },
  ])

  // ── Section 2: Physician ──
  sectionHeader('2. Information About the Physician or Health Care Professional')
  rowFields([
    { label: '6. Physician / provider name', value: f(d.provider_name), w: colW * 0.55 },
    { label: '7. Facility name (if ER treated)', value: f(d.hospital_name), w: colW * 0.42 },
  ])
  rowFields([
    { label: 'Facility city', value: f(d.facility_city), w: colW * 0.4 },
    { label: 'State', value: f(d.facility_state), w: colW * 0.2 },
  ])

  checkField('8. Treated in emergency room?', f(d.transported_to_hospital), ['Yes', 'No'], ML, colW * 0.45)
  checkField('9. Hospitalized overnight?', f(d.hospitalized_overnight), ['Yes', 'No'], ML + colW * 0.5, colW * 0.45)
  y += 34

  // ── Section 3: Case ──
  sectionHeader('3. Information About the Case')
  rowFields([
    { label: '10. Case / Claim #', value: f(d.claim_id), w: colW * 0.22 },
    { label: '11. Date of injury', value: f(d.date_of_injury), w: colW * 0.22 },
    { label: '12. Time began work', value: f(d.time_employee_began_work), w: colW * 0.22 },
    { label: '13. Time of event', value: f(d.time_of_event), w: colW * 0.27 },
  ])
  rowFields([
    { label: '14. What was employee doing just before incident?', value: f(d.activity_prior), w: colW * 0.48, h: 40 },
    { label: '15. What happened? How did injury occur?', value: f(d.what_happened) || `${f(d.mechanism)} — ${f(d.body_part)}`, w: colW * 0.48, h: 40 },
  ])
  rowFields([
    { label: '16. Injury / illness description (body part + how affected)', value: f(d.body_part) ? `${f(d.body_part)} — ${f(d.mechanism)}` : '', w: colW * 0.48, h: 40 },
    { label: '17. What object / substance directly harmed employee?', value: f(d.what_harmed), w: colW * 0.48, h: 40 },
  ])

  // ── Section 4: Outcome ──
  sectionHeader('4. Outcome')
  checkField('Lost time from work expected?', f(d.lost_time), ['Yes', 'No'], ML, colW * 0.45)
  y += 34

  // ── Section 5: Employer ──
  sectionHeader('5. Employer / Preparer Information')
  rowFields([
    { label: 'Employer name', value: f(d.employer_name), w: colW * 0.55 },
    { label: 'Address', value: f(d.employer_address), w: colW * 0.42 },
  ])
  rowFields([
    { label: 'Completed by (signature)', value: '', w: colW * 0.4, h: 24 },
    { label: 'Title', value: '', w: colW * 0.25 },
    { label: 'Date', value: f(d.generated_date) || new Date().toLocaleDateString(), w: colW * 0.28 },
  ])

  // ── RAM Clinical Supplement (page 2 style — dashed separator) ──
  if (y > 620) { doc.addPage(); y = 36 }
  else { y += 10 }

  doc.setDrawColor(30, 58, 95)
  doc.setLineDashPattern([6, 3], 0)
  doc.line(ML, y, W - MR, y)
  doc.setLineDashPattern([], 0)
  doc.setDrawColor(...BLACK)
  y += 8

  sectionHeader('RAM Clinical Supplement — NOT Part of OSHA 301 (Attach to Form)', SUPHEAD)
  rowFields([
    { label: 'Incident / Fire', value: f(d.incident), w: colW * 0.4 },
    { label: 'Medical Unit', value: f(d.unit), w: colW * 0.25 },
    { label: 'Crew / Assignment', value: f(d.employee_crew), w: colW * 0.3 },
  ])
  rowFields([
    { label: 'Clinical Impression', value: f(d.clinical_impression), w: colW * 0.55, h: 30 },
    { label: 'Disposition', value: '', w: colW * 0.4 },
  ])
  rowFields([
    { label: 'Treatment Summary', value: f(d.treatment_summary), w: colW * 0.48, h: 50 },
    { label: 'Additional Notes', value: f(d.notes), w: colW * 0.48, h: 50 },
  ])
  rowFields([
    { label: 'Supervisor', value: f(d.supervisor_name), w: colW * 0.3 },
    { label: 'Supervisor Phone', value: f(d.supervisor_phone), w: colW * 0.25 },
    { label: 'Claims Coordinator', value: f(d.coordinator_name), w: colW * 0.3 },
  ])
  rowFields([
    { label: 'Coordinator Phone', value: f(d.coordinator_phone), w: colW * 0.3 },
    { label: 'Coordinator Email', value: f(d.coordinator_email), w: colW * 0.65 },
  ])

  // ── Footer ──
  const footerY = Math.max(y + 10, 760)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(150, 150, 150)
  doc.text(
    `OSHA Form 301  |  Claim ID: ${f(d.claim_id)}  |  Generated ${new Date().toLocaleString()}  |  Retain for 5 years per 29 CFR 1904.29`,
    W / 2, footerY, { align: 'center' }
  )

  return doc
}
