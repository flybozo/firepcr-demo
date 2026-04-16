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
  const W = 612, M = 54
  let y = M

  // Header bar
  doc.setFillColor(220, 38, 38)
  doc.rect(0, y - 10, 612, 38, 'F')
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, 'PNG', M, y - 6, 52, 28) } catch {}
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 255, 255)
  doc.text('FIREPCR FIELD OPERATIONS', W / 2, y + 6, { align: 'center' })
  doc.setFontSize(8); doc.setFont('helvetica', 'normal')
  doc.text(`${data.agency_name || 'FirePCR Field Operations'}  |  Medical Director: ${data.provider_name || 'Provider of Record'}`, W / 2, y + 20, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  y += 44

  // Title
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14)
  doc.text('CONSENT TO TREAT', W / 2, y, { align: 'center' }); y += 14
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(`Date: ${data.form_date}   Time: ${data.form_time}   Unit: ${data.unit}   Incident: ${data.incident || '—'}`, W / 2, y, { align: 'center' }); y += 6
  doc.text(`Consent ID: ${data.consent_id}`, W / 2, y, { align: 'center' }); y += 24

  // Patient info
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text('PATIENT INFORMATION', M, y); y += 14
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(`Name: ${data.patient_name}`, M, y)
  doc.text(`Date of Birth: ${data.patient_dob || '—'}`, M + 280, y); y += 12
  doc.text(`Provider of Record: ${data.provider_name}`, M, y); y += 24

  // Consent text
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text('CONSENT FOR EMERGENCY MEDICAL TREATMENT', M, y); y += 16
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)

  const paragraphs = [
    `I, ${data.patient_name}, hereby consent to emergency medical treatment and care provided by FirePCR field operations personnel, including physicians, physician assistants, nurse practitioners, registered nurses, EMTs, and paramedics.`,
    '',
    'I understand and acknowledge the following:',
    '',
    '1. NATURE OF TREATMENT: I consent to examination, assessment, and emergency medical treatment as deemed necessary by the treating provider(s). This may include, but is not limited to: physical examination, vital sign monitoring, wound care, splinting/immobilization, medication administration, IV access, airway management, and patient transport.',
    '',
    '2. RISKS: I understand that emergency medical treatment involves inherent risks, including but not limited to: pain, infection, allergic reaction, scarring, nerve or vessel damage, medication side effects, and the possibility that treatment may not achieve the desired outcome.',
    '',
    '3. ALTERNATIVES: I understand that I have the right to refuse any or all treatment at any time. I have been informed of the risks of refusing treatment. Alternative treatments, if any, have been discussed with me.',
    '',
    '4. MEDICATIONS: I consent to the administration of medications as prescribed by the treating provider. I have disclosed all known allergies, current medications, and relevant medical history to the best of my ability.',
    '',
    '5. PHOTOGRAPHS: I consent to clinical photographs being taken for the purpose of medical documentation. These photographs become part of my medical record.',
    '',
    '6. PRIVACY: I understand that my medical information will be kept confidential in accordance with applicable privacy laws (HIPAA). My information may be shared with other healthcare providers involved in my care, with emergency services, and as required by law.',
    '',
    '7. TRANSPORT: If transport to a medical facility is recommended, I consent to transport by the most appropriate means available, as determined by the treating provider.',
    '',
    '8. ARTIFICIAL INTELLIGENCE: This agency utilizes AI-assisted technology to support clinical documentation, medical record management, and administrative coordination of my care. AI tools do not make clinical decisions — all medical decisions are made by licensed healthcare providers. My health information processed by AI systems is subject to the same privacy protections as all other medical records.',
    '',
    'I have read or had read to me the above consent. I understand its contents and voluntarily consent to the described treatment. I have had the opportunity to ask questions and my questions have been answered to my satisfaction.',
  ]

  const lineHeight = 12
  const maxWidth = W - (M * 2)

  for (const para of paragraphs) {
    if (para === '') { y += 6; continue }
    const lines = doc.splitTextToSize(para, maxWidth) as string[]
    for (const line of lines) {
      if (y > 700) { doc.addPage(); y = M }
      doc.text(line, M, y)
      y += lineHeight
    }
    y += 2
  }

  y += 16

  // Signature section
  if (y > 600) { doc.addPage(); y = M }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text('SIGNATURES', M, y); y += 18

  // Patient signature
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text('Patient / Authorized Representative Signature:', M, y); y += 4
  if (data.patient_signature_url) {
    try {
      doc.addImage(data.patient_signature_url, 'PNG', M, y, 200, 50)
    } catch {}
  }
  y += 56
  doc.line(M, y, M + 250, y)
  doc.text(`Date: ${data.form_date}  ${data.form_time}`, M + 270, y)
  y += 24

  // Footer
  doc.setFontSize(7); doc.setTextColor(128, 128, 128)
  doc.text('FirePCR Field Operations  •  Consent to Treat Form', W / 2, 770, { align: 'center' })
  doc.text(`Generated: ${new Date().toISOString()} | ${data.consent_id}`, W / 2, 780, { align: 'center' })

  return doc
}
