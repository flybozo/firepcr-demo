import { jsPDF } from 'jspdf'

export type Header214 = {
  ics214_id: string
  incident_name: string
  unit_name: string
  op_date: string
  op_start: string
  op_end: string
  leader_name: string
  leader_position: string
  leader_signature_url?: string | null
}

export type Activity214 = {
  log_datetime: string
  description: string
  logged_by: string
  activity_type: string
}

export type Personnel214 = {
  employee_name: string
  ics_position: string
  home_agency: string
}

export function generate214PDF(
  header: Header214,
  personnel: Personnel214[],
  activities: Activity214[]
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  const W = 612, margin = 36, colW = W - margin * 2
  let y = margin

  const BLACK = [0, 0, 0] as [number, number, number]
  const AMBER = [255, 248, 220] as [number, number, number]
  const LGRAY = [240, 240, 240] as [number, number, number]

  function cell(x: number, yPos: number, w: number, h: number, text: string, opts: { bold?: boolean; size?: number; bg?: [number, number, number]; align?: 'left' | 'center' } = {}) {
    if (opts.bg) { doc.setFillColor(...opts.bg); doc.rect(x, yPos, w, h, 'F') }
    doc.setDrawColor(...BLACK)
    doc.rect(x, yPos, w, h)
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal')
    doc.setFontSize(opts.size || 9)
    doc.setTextColor(...BLACK)
    const textX = opts.align === 'center' ? x + w / 2 : x + 3
    const textAlign = opts.align || 'left'
    doc.text(text, textX, yPos + h * 0.65, { align: textAlign, maxWidth: w - 6 })
  }

  // TITLE
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14)
  doc.text('ACTIVITY LOG (ICS 214)', W / 2, y + 14, { align: 'center' })
  y += 24

  // Section 1-2: Incident + Op Period
  const rowH = 36
  cell(margin, y, 220, rowH, `1. Incident Name:\n${header.incident_name}`, { bg: LGRAY })
  cell(margin + 220, y, 320, rowH, `2. Operational Period:\nDate: ${header.op_date}  Time: ${header.op_start}–${header.op_end}`, { bg: LGRAY })
  y += rowH

  // Section 3-5
  cell(margin, y, 185, 32, `3. Name:\n${header.leader_name}`, { bg: LGRAY })
  cell(margin + 185, y, 155, 32, `4. ICS Position:\n${header.leader_position}`, { bg: LGRAY })
  cell(margin + 340, y, 200, 32, `5. Home Agency:\n${import.meta.env.VITE_COMPANY_DBA || 'Remote Area Medicine'} (${header.unit_name})`, { bg: LGRAY })
  y += 32

  // Section 6: Personnel
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
  doc.text('6. Resources Assigned:', margin, y + 10)
  y += 14
  cell(margin, y, 185, 16, 'Name', { bg: LGRAY, bold: true, size: 8 })
  cell(margin + 185, y, 155, 16, 'ICS Position', { bg: LGRAY, bold: true, size: 8 })
  cell(margin + 340, y, 200, 16, 'Home Agency', { bg: LGRAY, bold: true, size: 8 })
  y += 16
  // Show all actual personnel, minimum 8 rows to fill space
  const rosterRows = Math.max(personnel.length, 8)
  for (let i = 0; i < rosterRows; i++) {
    const p = personnel[i]
    const h = 16
    // Role: use ics_position if set, otherwise use employee role
    const role = p?.ics_position || ''
    const agency = p?.home_agency || (p ? (import.meta.env.VITE_COMPANY_DBA || 'Remote Area Medicine') : '')
    cell(margin, y, 185, h, p?.employee_name || '')
    cell(margin + 185, y, 155, h, role)
    cell(margin + 340, y, 200, h, agency)
    y += h
  }

  y += 6

  // Section 7: Activity Log
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
  doc.text('7. Activity Log:', margin, y + 10)
  y += 14
  cell(margin, y, 110, 16, 'Date/Time', { bg: LGRAY, bold: true, size: 8 })
  cell(margin + 110, y, 430, 16, 'Notable Activities', { bg: LGRAY, bold: true, size: 8 })
  y += 16

  // Fill to bottom of page — calculate how many rows fit
  const FOOTER_H = 24 + 20  // section 8 + footer text
  const ROW_H = 18
  const pageBottom = 730
  const rowsFitOnPage = Math.floor((pageBottom - y - FOOTER_H) / ROW_H)
  const actRows = Math.max(activities.length, rowsFitOnPage, 12)

  for (let i = 0; i < actRows; i++) {
    const a = activities[i]
    const isPatient = a?.activity_type === 'patient_contact'
    const bg = isPatient ? AMBER : undefined
    const dt = a
      ? new Date(a.log_datetime).toLocaleString('en-US', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      : ''
    cell(margin, y, 110, ROW_H, dt, { bg })
    cell(margin + 110, y, 430, ROW_H, a?.description || '', { bg, bold: isPatient })
    y += ROW_H
    if (y + FOOTER_H + ROW_H > pageBottom && i < actRows - 1) {
      doc.addPage()
      y = margin
    }
  }

  y += 6

  // Section 8: Prepared by
  cell(margin, y, colW, 36, `8. Prepared by:  Name: ${header.leader_name}    Position/Title: ${header.leader_position}`, { bg: LGRAY, bold: true, size: 8 })
  // Signature line
  doc.setDrawColor(80, 80, 80)
  doc.line(margin + 350, y + 28, margin + 540, y + 28)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(100, 100, 100)
  doc.text('Signature', margin + 350, y + 34)
  doc.setTextColor(0, 0, 0)
  if (header.leader_signature_url?.startsWith('data:image')) {
    try { doc.addImage(header.leader_signature_url, 'PNG', margin + 350, y + 4, 100, 28) } catch {}
  }
  y += 36

  // Footer
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(150, 150, 150)
  doc.text(`ICS 214  •  ${header.ics214_id}  •  Generated ${new Date().toLocaleString()}`, W / 2, y + 12, { align: 'center' })

  return doc
}
