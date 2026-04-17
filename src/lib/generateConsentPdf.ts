import { jsPDF } from 'jspdf'

export type ConsentToTreatData = {
  patient_name: string
  patient_dob?: string
  unit: string
  incident?: string
  provider_name: string
  form_date: string
  form_time: string
  consent_id: string
  patient_signature_url?: string | null
  agency_name?: string
}

export function generateConsentToTreatPDF(data: ConsentToTreatData, logoDataUrl?: string | null): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  const W = 612, M = 48
  let y = 0

  // ── Header bar ────────────────────────────────────────────────────────────
  doc.setFillColor(220, 38, 38)
  doc.rect(0, 0, W, 56, 'F')

  // Circular logo — perfectly centered square image over white circle
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
  doc.text(`${data.agency_name || 'Mossbrae Medical Group P.C.'}  |  Medical Director: ${data.provider_name}`, W / 2, 38, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  y = 72

  // ── Title ─────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14)
  doc.text('CONSENT TO TREAT', W / 2, y, { align: 'center' }); y += 16
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(`Date: ${data.form_date}   Time: ${data.form_time}   Unit: ${data.unit}   Incident: ${data.incident || '—'}`, W / 2, y, { align: 'center' }); y += 12
  doc.text(`Consent ID: ${data.consent_id}`, W / 2, y, { align: 'center' }); y += 18

  // ── Patient info bar ──────────────────────────────────────────────────────
  doc.setFillColor(245, 245, 245)
  doc.rect(M, y - 6, W - M * 2, 26, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
  doc.text(`Patient: ${data.patient_name}`, M + 6, y + 7)
  doc.text(`DOB: ${data.patient_dob || '—'}`, M + 230, y + 7)
  doc.text(`Provider: ${data.provider_name}`, M + 360, y + 7)
  doc.setFont('helvetica', 'normal')
  y += 32

  // ── Consent text ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5)
  doc.text('CONSENT FOR EMERGENCY MEDICAL TREATMENT', M, y); y += 14
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)

  const paragraphs = [
    `I, ${data.patient_name}, hereby consent to emergency medical treatment and care provided by Remote Area Medicine (Mossbrae Medical Group P.C.) personnel, including physicians, physician assistants, nurse practitioners, registered nurses, EMTs, and paramedics.`,
    '',
    '1. NATURE OF TREATMENT: I consent to examination, assessment, and emergency medical treatment as deemed necessary by the treating provider(s), including vital sign monitoring, wound care, medication administration, IV access, airway management, and patient transport.',
    '',
    '2. RISKS: Emergency medical treatment involves inherent risks including pain, infection, allergic reaction, medication side effects, and the possibility that treatment may not achieve the desired outcome.',
    '',
    '3. ALTERNATIVES: I have the right to refuse any or all treatment at any time and have been informed of the risks of doing so.',
    '',
    '4. MEDICATIONS: I consent to medication administration as prescribed by the treating provider and have disclosed known allergies, current medications, and relevant medical history.',
    '',
    '5. PHOTOGRAPHS: I consent to clinical photographs for medical documentation, which become part of my medical record.',
    '',
    '6. PRIVACY: My medical information will be kept confidential per HIPAA and may be shared with other healthcare providers, emergency services, and as required by law.',
    '',
    '7. TRANSPORT: If transport is recommended, I consent to transport by the most appropriate means available.',
    '',
    '8. ARTIFICIAL INTELLIGENCE: This agency uses AI-assisted technology to support clinical documentation and administrative coordination. AI tools do not make clinical decisions — all decisions are made by licensed healthcare providers. My health information processed by AI is subject to the same privacy protections as all other records.',
    '',
    'I have read or had read to me the above consent, understand its contents, and voluntarily consent to the described treatment.',
  ]

  const lh = 12
  const maxW = W - M * 2

  for (const para of paragraphs) {
    if (para === '') { y += 5; continue }
    const lines = doc.splitTextToSize(para, maxW) as string[]
    for (const line of lines) {
      doc.text(line, M, y); y += lh
    }
  }

  y += 20

  // ── Signature section ─────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5)
  doc.text('PATIENT SIGNATURE', M, y); y += 14
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
  doc.text('Patient / Authorized Representative Signature:', M, y); y += 6

  if (data.patient_signature_url) {
    try { doc.addImage(data.patient_signature_url, 'PNG', M, y, 200, 52) } catch {}
  }
  y += 56
  doc.line(M, y, M + 260, y)
  doc.text(`Date: ${data.form_date}  ${data.form_time}`, M + 272, y)
  doc.setFontSize(7); doc.setTextColor(100, 100, 100)
  doc.text('Patient / Authorized Representative', M, y + 10)

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setFontSize(7); doc.setTextColor(160, 160, 160)
  doc.text('Remote Area Medicine — Consent to Treat Form', W / 2, 778, { align: 'center' })
  doc.text(`Generated: ${new Date().toLocaleDateString()}  |  ${data.consent_id}`, W / 2, 788, { align: 'center' })

  return doc
}
