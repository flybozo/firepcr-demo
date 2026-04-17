import { jsPDF } from 'jspdf'

export type AMAData = {
  patient_name: string
  patient_dob?: string
  unit: string
  incident?: string
  provider_name: string
  form_date: string
  form_time: string
  consent_id: string
  patient_signature_url?: string | null
  provider_signature_url?: string | null
}

export function generateAMAPDF(data: AMAData, logoDataUrl?: string | null): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  const W = 612, M = 48
  let y = 0

  // ── Header bar (same structure as Consent form) ───────────────────────────
  doc.setFillColor(220, 38, 38)
  doc.rect(0, 0, W, 56, 'F')

  // Circular logo — perfectly centered (cx, cy = center; r = radius)
  if (logoDataUrl) {
    try {
      const cx = 38, cy = 28, r = 20
      doc.setFillColor(255, 255, 255)
      doc.circle(cx, cy, r, 'F')
      doc.addImage(logoDataUrl, 'PNG', cx - r, cy - r, r * 2, r * 2)
    } catch {}
  }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(255, 255, 255)
  doc.text('REMOTE AREA MEDICINE', W / 2, 22, { align: 'center' })
  doc.setFontSize(8); doc.setFont('helvetica', 'normal')
  doc.text(`${import.meta.env.VITE_COMPANY_NAME || 'Mossbrae Medical Group P.C.'}  |  Medical Director: ${data.provider_name}`, W / 2, 38, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  y = 72

  // ── Form title ────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
  doc.text('REFUSAL OF EMERGENCY MEDICAL CARE', W / 2, y, { align: 'center' }); y += 14
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text('AGAINST MEDICAL ADVICE (AMA)', W / 2, y, { align: 'center' }); y += 14
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(`Date: ${data.form_date}     Incident: ${data.incident || '—'}     Unit: ${data.unit}`, W / 2, y, { align: 'center' }); y += 22

  // Patient Info
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text('PATIENT INFORMATION', M, y); y += 14
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(`Name: ${data.patient_name}`, M, y)
  doc.text(`Date of Birth: ${data.patient_dob || '—'}`, M + 280, y); y += 20

  // Capacity Assessment
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text('CAPACITY ASSESSMENT', M, y); y += 14
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  const checks = [
    'Is alert and oriented to person, place, time, and event',
    'Understands their medical condition as explained',
    'Understands the risks of refusing care, including serious injury or DEATH',
    'Does NOT appear impaired by alcohol, drugs, or medical/psychiatric condition',
    'Is 18+ years of age (or emancipated minor)',
  ]
  checks.forEach(c => { doc.text(`[x]  ${c}`, M + 8, y); y += 13 })
  y += 6

  // Refusal
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text('REFUSAL', M, y); y += 14
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text('[x]  All emergency medical treatment', M + 8, y); y += 13
  doc.text('[x]  Transport to a medical facility', M + 8, y); y += 20

  // Patient Statement
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text('PATIENT STATEMENT & RELEASE', M, y); y += 14
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  const stmt = `I, ${data.patient_name}, have been informed of my medical condition, the recommended treatment and/or transport, and the risks of refusal — including serious injury or death. I am voluntarily refusing the emergency medical care described above and release ${import.meta.env.VITE_COMPANY_DBA || 'Remote Area Medicine'} (${import.meta.env.VITE_COMPANY_NAME || 'Mossbrae Medical Group P.C.'}), its medical director, and all EMS providers from any liability arising from this refusal. I have been advised to call 911 or seek emergency care immediately if my condition worsens.`
  const lines = doc.splitTextToSize(stmt, W - M * 2)
  doc.text(lines, M, y); y += (lines as string[]).length * 12 + 12

  // Patient Signature
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text('PATIENT SIGNATURE', M, y); y += 14
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  if (data.patient_signature_url?.startsWith('data:image')) {
    // Embed actual drawn signature
    try { doc.addImage(data.patient_signature_url, 'PNG', M, y - 4, 120, 28) } catch {}
  } else if (data.patient_signature_url) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9)
    doc.text('[Electronic signature on file]', M, y + 8)
    doc.setFont('helvetica', 'normal')
  } else {
    doc.line(M, y + 14, M + 200, y + 14)
  }
  y += 30
  doc.text(`Printed Name: ${data.patient_name}`, M, y)
  doc.text(`Date/Time: ${data.form_date} ${data.form_time}`, M + 260, y); y += 30

  // Provider Signature
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text('EMS PROVIDER SIGNATURE', M, y); y += 14
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  if (data.provider_signature_url?.startsWith('data:image')) {
    // Embed actual drawn signature
    try { doc.addImage(data.provider_signature_url, 'PNG', M, y - 4, 120, 28) } catch {}
  } else if (data.provider_signature_url) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9)
    doc.text('[Electronic signature on file]', M, y + 8)
    doc.setFont('helvetica', 'normal')
  } else {
    doc.line(M, y + 14, M + 200, y + 14)
  }
  y += 30
  doc.text(`Name / Credential: ${data.provider_name}`, M, y)
  doc.text(`Date/Time: ${data.form_date} ${data.form_time}`, M + 260, y); y += 24

  // Footer
  doc.setFontSize(7); doc.setTextColor(150, 150, 150)
  doc.text(`AMA Form — Consent ID: ${data.consent_id} — Generated ${new Date().toLocaleString()}`, W / 2, y + 12, { align: 'center' })

  return doc
}
