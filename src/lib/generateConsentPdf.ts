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
  const W = 612, M = 44
  let y = 36

  // ── Header bar ────────────────────────────────────────────────────────────
  doc.setFillColor(220, 38, 38)
  doc.rect(0, 0, 612, 50, 'F')

  // Circular logo in upper-left (clip to circle)
  if (logoDataUrl) {
    try {
      // Draw white circle background first
      doc.setFillColor(255, 255, 255)
      doc.circle(M - 8, 25, 18, 'F')
      doc.addImage(logoDataUrl, 'PNG', M - 24, 7, 36, 36)
    } catch {}
  }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 255, 255)
  doc.text('REMOTE AREA MEDICINE', W / 2, 20, { align: 'center' })
  doc.setFontSize(8); doc.setFont('helvetica', 'normal')
  doc.text(`${data.agency_name || 'Mossbrae Medical Group P.C.'}  |  Medical Director: ${data.provider_name}`, W / 2, 34, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  y = 62

  // ── Title + meta ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
  doc.text('CONSENT TO TREAT', W / 2, y, { align: 'center' }); y += 12
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  doc.text(`Date: ${data.form_date}   Time: ${data.form_time}   Unit: ${data.unit}   Incident: ${data.incident || '—'}`, W / 2, y, { align: 'center' }); y += 10
  doc.text(`Consent ID: ${data.consent_id}`, W / 2, y, { align: 'center' }); y += 14

  // ── Patient info (compact row) ────────────────────────────────────────────
  doc.setFillColor(245, 245, 245)
  doc.rect(M, y - 6, W - M * 2, 22, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5)
  doc.text(`Patient: ${data.patient_name}`, M + 4, y + 5)
  doc.text(`DOB: ${data.patient_dob || '—'}`, M + 220, y + 5)
  doc.text(`Provider: ${data.provider_name}`, M + 340, y + 5)
  doc.setFont('helvetica', 'normal')
  y += 24

  // ── Consent text (compact) ────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5)
  doc.text('CONSENT FOR EMERGENCY MEDICAL TREATMENT', M, y); y += 10
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)

  const paragraphs = [
    `I, ${data.patient_name}, hereby consent to emergency medical treatment and care provided by Remote Area Medicine (Mossbrae Medical Group P.C.) personnel, including physicians, physician assistants, nurse practitioners, registered nurses, EMTs, and paramedics.`,
    '1. NATURE OF TREATMENT: I consent to examination, assessment, and emergency medical treatment as deemed necessary by the treating provider(s), including vital sign monitoring, wound care, medication administration, IV access, airway management, and transport.',
    '2. RISKS: I understand that emergency medical treatment involves inherent risks including pain, infection, allergic reaction, medication side effects, and the possibility that treatment may not achieve the desired outcome.',
    '3. ALTERNATIVES: I understand that I have the right to refuse any or all treatment at any time and have been informed of the risks of doing so.',
    '4. MEDICATIONS: I consent to medication administration as prescribed by the treating provider and have disclosed known allergies, current medications, and relevant medical history.',
    '5. PHOTOGRAPHS: I consent to clinical photographs for medical documentation purposes.',
    '6. PRIVACY: My medical information will be kept confidential per HIPAA and may be shared with other healthcare providers involved in my care, emergency services, and as required by law.',
    '7. TRANSPORT: If transport to a medical facility is recommended, I consent to transport by the most appropriate means available.',
    '8. ARTIFICIAL INTELLIGENCE: This agency uses AI-assisted technology to support clinical documentation and administrative coordination. AI tools do not make clinical decisions — all medical decisions are made by licensed healthcare providers. My health information is subject to the same privacy protections as all other medical records.',
    'I have read or had read to me the above consent, understand its contents, and voluntarily consent to the described treatment.',
  ]

  const lh = 10.5
  const maxW = W - M * 2

  for (let i = 0; i < paragraphs.length; i++) {
    const lines = doc.splitTextToSize(paragraphs[i], maxW) as string[]
    for (const line of lines) {
      doc.text(line, M, y); y += lh
    }
    y += i === 0 ? 4 : 2
  }

  y += 10

  // ── Signature section ─────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5)
  doc.text('PATIENT SIGNATURE', M, y); y += 10
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8)

  if (data.patient_signature_url) {
    try { doc.addImage(data.patient_signature_url, 'PNG', M, y, 180, 44) } catch {}
  }
  const sigLineY = y + 46
  doc.line(M, sigLineY, M + 240, sigLineY)
  doc.text(`Date: ${data.form_date}  ${data.form_time}`, M + 252, sigLineY)
  doc.setFontSize(7); doc.setTextColor(100, 100, 100)
  doc.text('Patient / Authorized Representative', M, sigLineY + 10)

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setFontSize(6.5); doc.setTextColor(150, 150, 150)
  doc.text('Remote Area Medicine — Consent to Treat', W / 2, 780, { align: 'center' })
  doc.text(`Generated: ${new Date().toLocaleDateString()}  |  ${data.consent_id}`, W / 2, 789, { align: 'center' })

  return doc
}
