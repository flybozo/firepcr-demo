import type { VercelRequest, VercelResponse } from "@vercel/node"
import { jsPDF } from 'jspdf'
import { HttpError, requireAuthUser } from './_auth.js'
import { brand } from '../src/lib/branding.config.js'
import { validateBody, sanitize } from './_validate.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    await requireAuthUser(req)
    const body = req.body

    // ── Input validation ──
    validateBody(body, [
      { field: 'incident',           type: 'object' as any },
      { field: 'unit',               type: 'object' as any },
      { field: 'ticketType',         type: 'string', maxLength: 20 },
      { field: 'measureType',        type: 'string', maxLength: 20 },
      { field: 'transportRetained',  type: 'string', maxLength: 10 },
      { field: 'shiftRows',          type: 'array' },
      { field: 'personnelRows',      type: 'array' },
      { field: 'remarks',            type: 'string', maxLength: 2000 },
      { field: 'contractorRep',      type: 'string', maxLength: 200 },
      { field: 'supervisorName',     type: 'string', maxLength: 200 },
      { field: 'contractorSig',      type: 'string', maxLength: 200000 }, // base64 PNG
      { field: 'supervisorSig',      type: 'string', maxLength: 200000 }, // base64 PNG
    ])

    // ── Sanitize helpers ──
    /** Strip control characters (incl. \r, \n, \t) from text destined for the PDF */
    const cleanText = (val: unknown, max = 500): string =>
      sanitize(val, max).replace(/[\x00-\x1F\x7F]/g, ' ').trim()

    /** Sanitize a PDF Content-Disposition filename component */
    const cleanFilename = (val: unknown, max = 100): string =>
      String(val ?? '').replace(/["\/\\;\r\n\x00-\x1F]/g, '').slice(0, max)

    /** Sanitize one shift/personnel row — all values are short display strings */
    const cleanRow = (row: unknown): Record<string, string> => {
      if (!row || typeof row !== 'object') return {}
      const out: Record<string, string> = {}
      for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
        out[k] = cleanText(v, 200)
      }
      return out
    }

    // ── Destructure + sanitize ──
    const rawIncident = (body.incident && typeof body.incident === 'object') ? body.incident as Record<string, unknown> : {}
    const rawUnit     = (body.unit     && typeof body.unit     === 'object') ? body.unit     as Record<string, unknown> : {}

    const incident = {
      agreement_number:      cleanText(rawIncident.agreement_number),
      resource_order_number: cleanText(rawIncident.resource_order_number),
      name:                  cleanText(rawIncident.name),
      incident_number:       cleanText(rawIncident.incident_number),
      financial_code:        cleanText(rawIncident.financial_code),
    }
    const unit = {
      make_model:    cleanText(rawUnit.make_model),
      unit_type:     cleanText(rawUnit.unit_type),
      vin:           cleanText(rawUnit.vin, 50),
      license_plate: cleanText(rawUnit.license_plate, 50),
    }

    const ticketType        = cleanText(body.ticketType, 20)
    const measureType       = cleanText(body.measureType, 20)
    const transportRetained = cleanText(body.transportRetained, 10)
    const remarks           = cleanText(body.remarks, 2000)
    const contractorRep     = cleanText(body.contractorRep, 200)
    const supervisorName    = cleanText(body.supervisorName, 200)
    // Signatures are base64-encoded PNG data URLs — validate prefix, don't run through cleanText
    const sigRe = /^(data:image\/png;base64,)?[A-Za-z0-9+/]+=*$/
    const contractorSig = typeof body.contractorSig === 'string' && sigRe.test(body.contractorSig) ? body.contractorSig : null
    const supervisorSig = typeof body.supervisorSig === 'string' && sigRe.test(body.supervisorSig) ? body.supervisorSig : null

    const rawShiftRows     = Array.isArray(body.shiftRows)     ? (body.shiftRows     as unknown[]).slice(0, 50)  : []
    const rawPersonnelRows = Array.isArray(body.personnelRows) ? (body.personnelRows as unknown[]).slice(0, 50)  : []
    const shiftRows     = rawShiftRows.map(cleanRow)
    const personnelRows = rawPersonnelRows.map(cleanRow)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const W = 215.9
  const margin = 12
  let y = margin

  // ── helpers ──
  const cell = (x: number, cy: number, w: number, h: number, text: string, opts: { bold?: boolean; size?: number; align?: 'left'|'center'|'right'; fill?: string; textColor?: string } = {}) => {
    if (opts.fill) { doc.setFillColor(opts.fill); doc.rect(x, cy, w, h, 'F') }
    doc.setFontSize(opts.size || 8)
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal')
    doc.setTextColor(opts.textColor || '#1a1a1a')
    doc.text(text || '', x + (opts.align === 'center' ? w/2 : opts.align === 'right' ? w-1 : 1.5), cy + h - 1.5,
      { align: opts.align || 'left', maxWidth: w - 2 })
  }
  const box = (x: number, cy: number, w: number, h: number) => doc.rect(x, cy, w, h)
  const hline = (cy: number) => { doc.setLineWidth(0.2); doc.line(margin, cy, W - margin, cy) }
  const sectionHeader = (title: string, cy: number) => {
    doc.setFillColor('#cc1f1f'); doc.rect(margin, cy, W - margin*2, 5, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor('#ffffff')
    doc.text(title, W/2, cy + 3.5, { align: 'center' })
    return cy + 5
  }

  doc.setLineWidth(0.3)

  // ── Title ──
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor('#cc1f1f')
  doc.text('EMERGENCY EQUIPMENT SHIFT TICKET', W/2, y + 6, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor('#666')
  doc.text('Optional Form 297 (Rev. 5/2024) — USDA/USDI', W/2, y + 10, { align: 'center' })
  y += 14

  // ── Row 1: Fields 1-3 ──
  const colW = (W - margin*2) / 3
  const rowH = 9
  const labels = [
    ['1. Agreement Number', incident?.agreement_number],
    ['2. Contractor / Agency Name', brand.companyName],
    ['3. Resource Order Number', incident?.resource_order_number],
  ]
  labels.forEach(([label, val], i) => {
    const x = margin + i * colW
    box(x, y, colW, rowH)
    cell(x, y, colW, 4, label as string, { size: 6, textColor: '#888' })
    cell(x, y + 3.5, colW, 5.5, val || '', { bold: true, size: 8.5 })
  })
  y += rowH

  // ── Row 2: Fields 4-6 ──
  const row2 = [
    ['4. Incident Name', incident?.name],
    ['5. Incident Number', incident?.incident_number],
    ['6. Financial Code', incident?.financial_code],
  ]
  row2.forEach(([label, val], i) => {
    const x = margin + i * colW
    box(x, y, colW, rowH)
    cell(x, y, colW, 4, label as string, { size: 6, textColor: '#888' })
    cell(x, y + 3.5, colW, 5.5, val || '', { bold: true, size: 8.5 })
  })
  y += rowH

  // ── Row 3: Fields 7-10 ──
  const row3W = (W - margin*2) / 4
  const row3 = [
    ['7. Equipment Make/Model', unit?.make_model],
    ['8. Equipment Type', unit?.unit_type],
    ['9. Serial / VIN', unit?.vin],
    ['10. License / ID', unit?.license_plate],
  ]
  row3.forEach(([label, val], i) => {
    const x = margin + i * row3W
    box(x, y, row3W, rowH)
    cell(x, y, row3W, 4, label as string, { size: 6, textColor: '#888' })
    cell(x, y + 3.5, row3W, 5.5, val || '', { bold: true, size: 8 })
  })
  y += rowH + 2

  // ── Checkboxes row ──
  const chk = (cx: number, cy: number, checked: boolean) => {
    box(cx, cy, 3.5, 3.5)
    if (checked) { doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.text('X', cx + 0.8, cy + 3) }
  }
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor('#333')
  let cx = margin
  // Transport retained
  doc.text('12. Transport Retained?', cx, y + 3); cx += 34
  chk(cx, y, transportRetained === 'yes'); doc.text('Yes', cx+4.5, y+3); cx += 14
  chk(cx, y, transportRetained === 'no'); doc.text('No', cx+4.5, y+3); cx += 20
  // First/last
  doc.text('13. First/Last Ticket:', cx, y+3); cx += 28
  chk(cx, y, ticketType === 'mobilization'); doc.text('Mobilization', cx+4.5, y+3); cx += 24
  chk(cx, y, ticketType === 'demobilization'); doc.text('Demobilization', cx+4.5, y+3); cx += 28
  // Miles/hours
  doc.text('14.', cx, y+3); cx += 6
  chk(cx, y, measureType === 'miles'); doc.text('Miles', cx+4.5, y+3); cx += 14
  chk(cx, y, measureType === 'hours'); doc.text('Hours', cx+4.5, y+3)
  y += 8

  // ── Equipment table (fields 15-21) ──
  y = sectionHeader('EQUIPMENT (Fields 15–21)', y)
  const eqCols = [22, 18, 18, 15, 12, 18, 0] // last gets remaining
  const eqLabels = ['15. Date', '16. Start', '17. Stop', '18. Total', '19. Qty', '20. Type', '21. Remarks']
  const totalEqW = W - margin*2
  eqCols[6] = totalEqW - eqCols.slice(0,6).reduce((a,b)=>a+b,0)
  const eqRowH = 6.5

  // Header
  let hx = margin
  eqCols.forEach((w, i) => {
    box(hx, y, w, eqRowH)
    cell(hx, y, w, eqRowH, eqLabels[i], { size: 6, textColor: '#555', align: 'center', fill: '#f5f5f5' })
    hx += w
  })
  y += eqRowH

  // Data rows
  const shiftData = shiftRows?.length ? shiftRows : Array(7).fill({})
  shiftData.forEach((row: any) => {
    hx = margin
    const vals = [row.date || '', row.start || '', row.stop || '', row.total || '', row.qty || '', row.type || '', row.remarks || '']
    eqCols.forEach((w, i) => {
      box(hx, y, w, eqRowH)
      cell(hx, y, w, eqRowH, vals[i], { size: 7.5, align: 'center' })
      hx += w
    })
    y += eqRowH
  })
  y += 2

  // ── Personnel table (fields 22-29) ──
  y = sectionHeader('PERSONNEL (Fields 22–29)', y)
  const pCols = [22, 35, 14, 14, 14, 14, 14, 0]
  const pLabels = ['22. Date', '23. Operator Name', '24. Start', '25. Stop', '26. Start', '27. Stop', '28. Total', '29. Remarks']
  pCols[7] = totalEqW - pCols.slice(0,7).reduce((a,b)=>a+b,0)
  const pRowH = 6.5

  hx = margin
  pCols.forEach((w, i) => {
    box(hx, y, w, pRowH)
    cell(hx, y, w, pRowH, pLabels[i], { size: 6, textColor: '#555', align: 'center', fill: '#f5f5f5' })
    hx += w
  })
  y += pRowH

  const personnelData = personnelRows?.length ? personnelRows : Array(5).fill({})
  personnelData.forEach((row: any) => {
    hx = margin
    const vals = [row.date||'', row.operator_name||'', row.start1||'', row.stop1||'', row.start2||'', row.stop2||'', row.total||'', row.remarks||'']
    pCols.forEach((w, i) => {
      box(hx, y, w, pRowH)
      cell(hx, y, w, pRowH, vals[i], { size: 7.5, align: 'center' })
      hx += w
    })
    y += pRowH
  })
  y += 2

  // ── Remarks (field 30) ──
  y = sectionHeader('30. REMARKS', y)
  const remarkH = 18
  box(margin, y, W - margin*2, remarkH)
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor('#1a1a1a')
  doc.text(remarks || '', margin + 1.5, y + 4, { maxWidth: W - margin*2 - 3 })
  y += remarkH + 2

  // ── Signature block (fields 31-34) ──
  y = sectionHeader('SIGNATURES (Fields 31–34)', y)
  const sigW = (W - margin*2) / 2
  const sigH = 22

  // Contractor side
  box(margin, y, sigW, sigH)
  cell(margin, y, sigW, 4.5, '31. Contractor / Agency Representative (Printed Name)', { size: 6, textColor: '#888' })
  cell(margin, y + 4, sigW, 6, contractorRep || '', { bold: true, size: 9 })
  hline(y + 10.5)
  cell(margin, y + 11, sigW, 4, '32. Signature', { size: 6, textColor: '#888' })
  if (contractorSig) {
    try { doc.addImage(contractorSig, 'PNG', margin + 1, y + 14.5, sigW - 4, 6) } catch {}
  }

  // Supervisor side
  box(margin + sigW, y, sigW, sigH)
  cell(margin + sigW, y, sigW, 4.5, '33. Incident Supervisor (Name & Resource Order)', { size: 6, textColor: '#888' })
  cell(margin + sigW, y + 4, sigW, 6, supervisorName || '', { bold: true, size: 9 })
  doc.line(margin + sigW, y + 10.5, W - margin, y + 10.5)
  cell(margin + sigW, y + 11, sigW, 4, '34. Signature', { size: 6, textColor: '#888' })
  if (supervisorSig) {
    try { doc.addImage(supervisorSig, 'PNG', margin + sigW + 1, y + 14.5, sigW - 4, 6) } catch {}
  }
  y += sigH + 4

  // Footer
  doc.setFont('helvetica','italic'); doc.setFontSize(6.5); doc.setTextColor('#aaa')
  doc.text(`Generated by ${brand.appName} · ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, margin, y)
  doc.text('OPTIONAL FORM 297 (REV. 5/2024) — USDA/USDI', W - margin, y, { align: 'right' })

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
  res.setHeader('Content-Type', 'application/pdf')
  const safeFilename = cleanFilename(incident.name.replace(/\s+/g, '-') || 'Shift')
  res.setHeader('Content-Disposition', `attachment; filename="OF297-${safeFilename}.pdf"`)
  return res.send(pdfBuffer)
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message })
    }
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}
