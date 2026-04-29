/**
 * generateOpsReportPdf
 * Generates a 24-hour medical operations summary PDF for external fire agency use.
 * Sections: header, patient stats, chief complaint breakdown, consumables used.
 */
import jsPDF from 'jspdf'
import type { DashboardData } from '@/pages/fire-admin/FireAdminDashboard'
import { brand } from '@/lib/branding.config'

export function generateOpsReportPdf(data: DashboardData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const now = new Date()
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

  const pageW = 215.9
  const margin = 18
  const col = pageW - margin * 2
  let y = margin

  // ── Helpers ────────────────────────────────────────────────────────────────
  const rule = (color = '#e5e7eb') => {
    doc.setDrawColor(color)
    doc.setLineWidth(0.3)
    doc.line(margin, y, pageW - margin, y)
    y += 4
  }

  const sectionHeader = (title: string) => {
    y += 2
    doc.setFillColor('#1f2937')
    doc.roundedRect(margin, y, col, 7, 1.5, 1.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor('#f9fafb')
    doc.text(title.toUpperCase(), margin + 3, y + 4.8)
    y += 11
    doc.setTextColor('#111827')
  }

  const row = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(9)
    doc.setTextColor('#374151')
    doc.text(label, margin + 2, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor('#111827')
    doc.text(value, margin + col - 2, y, { align: 'right' })
    y += 5.5
  }

  const barRow = (label: string, count: number, total: number) => {
    const pct = total > 0 ? count / total : 0
    const barW = (col - 50) * pct
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor('#374151')
    // label
    const truncated = label.length > 32 ? label.slice(0, 30) + '…' : label
    doc.text(truncated, margin + 2, y)
    // bar
    doc.setFillColor('#dbeafe')
    doc.roundedRect(margin + 50, y - 3.5, col - 52, 4.5, 1, 1, 'F')
    if (barW > 0) {
      doc.setFillColor('#2563eb')
      doc.roundedRect(margin + 50, y - 3.5, barW, 4.5, 1, 1, 'F')
    }
    // count
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor('#111827')
    doc.text(`${count}`, pageW - margin - 2, y, { align: 'right' })
    y += 6.5
  }

  // ── Filter to 24h window ────────────────────────────────────────────────────
  const sinceMs = since.getTime()
  const enc24 = data.encounters.filter(e => e.created_at && new Date(e.created_at).getTime() >= sinceMs)
  const supply24 = (data.supply_items || []).filter(i => i.created_at && new Date(i.created_at).getTime() >= sinceMs)

  // ── Page header ─────────────────────────────────────────────────────────────
  doc.setFillColor('#111827')
  doc.rect(0, 0, pageW, 28, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor('#ffffff')
  doc.text('24-Hour Medical Operations Report', margin, 12)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor('#9ca3af')
  doc.text(`${data.incident.name}`, margin, 18)
  doc.text(`Generated: ${fmt(now)}  ·  Period: ${fmt(since)} — ${fmt(now)}`, margin, 23)

  y = 36

  // ── Patient Summary ─────────────────────────────────────────────────────────
  sectionHeader('Patient Summary')

  // Acuity breakdown
  const acuityMap: Record<string, number> = {}
  enc24.forEach(e => { if (e.acuity) acuityMap[e.acuity] = (acuityMap[e.acuity] || 0) + 1 })

  // Disposition breakdown
  const dispMap: Record<string, number> = {}
  enc24.forEach(e => { if (e.disposition) dispMap[e.disposition] = (dispMap[e.disposition] || 0) + 1 })

  // Agency breakdown
  const agencyMap: Record<string, number> = {}
  enc24.forEach(e => { const a = e.patient_agency || 'Unknown'; agencyMap[a] = (agencyMap[a] || 0) + 1 })

  row('Total Patients', `${enc24.length}`, true)
  rule()
  row('Minor (Green)', `${acuityMap['Minor'] || acuityMap['Green'] || 0}`)
  row('Moderate (Yellow)', `${acuityMap['Moderate'] || acuityMap['Yellow'] || 0}`)
  row('Serious (Red)', `${acuityMap['Serious'] || acuityMap['Red'] || 0}`)
  row('Critical', `${acuityMap['Critical'] || 0}`)
  rule()
  row('Treated & Released', `${dispMap['Treated/Released'] || dispMap['Treatment and Released'] || 0}`)
  row('Transported', `${Object.entries(dispMap).filter(([k]) => k.toLowerCase().includes('transport')).reduce((s, [, v]) => s + v, 0)}`)
  row('Refusal / AMA', `${Object.entries(dispMap).filter(([k]) => k.toLowerCase().includes('refus') || k.toLowerCase().includes('ama')).reduce((s, [, v]) => s + v, 0)}`)
  y += 2

  // ── Chief Complaints ────────────────────────────────────────────────────────
  sectionHeader('Chief Complaints')

  const ccMap: Record<string, number> = {}
  enc24.forEach(e => {
    const cc = e.chief_complaint || 'Not documented'
    ccMap[cc] = (ccMap[cc] || 0) + 1
  })
  const ccSorted = Object.entries(ccMap).sort((a, b) => b[1] - a[1]).slice(0, 12)

  if (ccSorted.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8.5)
    doc.setTextColor('#9ca3af')
    doc.text('No encounters in the last 24 hours.', margin + 2, y)
    y += 7
  } else {
    ccSorted.forEach(([cc, count]) => barRow(cc, count, enc24.length))
  }
  y += 2

  // ── Patients by Agency ──────────────────────────────────────────────────────
  if (Object.keys(agencyMap).length > 1) {
    sectionHeader('Patients by Agency')
    Object.entries(agencyMap).sort((a, b) => b[1] - a[1]).forEach(([agency, count]) => {
      row(agency, `${count}`)
    })
    y += 2
  }

  // ── Consumables Used ────────────────────────────────────────────────────────
  sectionHeader('Consumables Used (Supply Runs)')

  if (supply24.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8.5)
    doc.setTextColor('#9ca3af')
    doc.text('No supply runs recorded in the last 24 hours.', margin + 2, y)
    y += 7
  } else {
    // Aggregate by item name
    const consumMap: Record<string, { qty: number; unit: string; category: string }> = {}
    supply24.forEach(i => {
      if (!consumMap[i.item_name]) consumMap[i.item_name] = { qty: 0, unit: i.unit_of_measure, category: i.category }
      consumMap[i.item_name].qty += i.quantity
    })

    // Group by category
    const byCategory: Record<string, Array<{ name: string; qty: number; unit: string }>> = {}
    Object.entries(consumMap).forEach(([name, { qty, unit, category }]) => {
      const cat = category || 'Other'
      if (!byCategory[cat]) byCategory[cat] = []
      byCategory[cat].push({ name, qty, unit })
    })

    Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b)).forEach(([cat, items]) => {
      // Category sub-header
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor('#6b7280')
      doc.text(cat.toUpperCase(), margin + 2, y)
      y += 5
      items.sort((a, b) => b.qty - a.qty).forEach(item => {
        row(item.name, `${item.qty} ${item.unit}`)
      })
      y += 1
    })
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  const pageH = 279.4
  doc.setFillColor('#f3f4f6')
  doc.rect(0, pageH - 14, pageW, 14, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor('#9ca3af')
  doc.text(
    `${brand.companyName}  ·  Confidential Medical Operations Report  ·  ${fmt(now)}`,
    pageW / 2, pageH - 5.5, { align: 'center' }
  )

  // ── Save ─────────────────────────────────────────────────────────────────────
  const safeName = data.incident.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()
  doc.save(`RAM-24hr-report-${safeName}-${now.toISOString().slice(0, 10)}.pdf`)
}
