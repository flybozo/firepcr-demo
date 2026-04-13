

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'react-router-dom'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { Link } from 'react-router-dom'
import SignatureCanvas from 'react-signature-canvas'

type ShiftRow = {
  date: string
  start: string
  stop: string
  total: string
  qty: string
  type: string
  remarks: string
}

type PersonnelRow = {
  date: string
  operator_name: string
  start1: string
  stop1: string
  start2: string
  stop2: string
  total: string
  remarks: string
}

const emptyShiftRow = (): ShiftRow => ({ date: '', start: '', stop: '', total: '', qty: '', type: '', remarks: '' })
const emptyPersonnelRow = (): PersonnelRow => ({ date: '', operator_name: '', start1: '', stop1: '', start2: '', stop2: '', total: '', remarks: '' })

const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500'
const labelCls = 'block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1'

function calcTotal(start: string, stop: string): string {
  if (!start || !stop) return ''
  const s = parseFloat(start), e = parseFloat(stop)
  if (isNaN(s) || isNaN(e) || e < s) return ''
  return (e - s).toFixed(1)
}

function calcPersonnelTotal(s1: string, e1: string, s2: string, e2: string): string {
  let total = 0
  if (s1 && e1) {
    const a = parseInt(s1), b = parseInt(e1)
    if (!isNaN(a) && !isNaN(b) && b > a) total += (b - a) / 100
  }
  if (s2 && e2) {
    const a = parseInt(s2), b = parseInt(e2)
    if (!isNaN(a) && !isNaN(b) && b > a) total += (b - a) / 100
  }
  return total > 0 ? total.toFixed(1) : ''
}

export default function ShiftTicketPage() {
  const supabase = createClient()
  const params = useParams()
  const incidentId = params.id as string
  const assignment = useUserAssignment()

  const contractorSigRef = useRef<SignatureCanvas>(null)
  const supervisorSigRef = useRef<SignatureCanvas>(null)

  const [incident, setIncident] = useState<any>(null)
  const [units, setUnits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [success, setSuccess] = useState('')

  // Header fields
  const [selectedUnit, setSelectedUnit] = useState('')
  const [ticketType, setTicketType] = useState<'mobilization' | 'demobilization' | ''>('')
  const [measureType, setMeasureType] = useState<'miles' | 'hours'>('hours')
  const [transportRetained, setTransportRetained] = useState<'yes' | 'no' | ''>('')
  const [remarks, setRemarks] = useState('')
  const [contractorRep, setContractorRep] = useState('')
  const [supervisorName, setSupervisorName] = useState('')

  // Rows
  const [shiftRows, setShiftRows] = useState<ShiftRow[]>([emptyShiftRow(), emptyShiftRow(), emptyShiftRow(), emptyShiftRow(), emptyShiftRow()])
  const [personnelRows, setPersonnelRows] = useState<PersonnelRow[]>([emptyPersonnelRow(), emptyPersonnelRow(), emptyPersonnelRow()])

  useEffect(() => {
    const load = async () => {
      const [{ data: inc }, { data: ius }] = await Promise.all([
        supabase.from('incidents').select('*').eq('id', incidentId).single(),
        supabase.from('incident_units').select('id, unit:units(id, name, make_model, vin, license_plate, unit_type)').eq('incident_id', incidentId).is('released_at', null),
      ])
      setIncident(inc)
      setUnits(ius || [])
      // Pre-fill contractor rep
      if (assignment.employee?.name) setContractorRep(assignment.employee.name)
      setLoading(false)
    }
    load()
  }, [incidentId, assignment.loading])

  const updateShiftRow = (i: number, field: keyof ShiftRow, val: string) => {
    setShiftRows(prev => {
      const rows = [...prev]
      rows[i] = { ...rows[i], [field]: val }
      if (field === 'start' || field === 'stop') {
        rows[i].total = calcTotal(rows[i].start, rows[i].stop)
      }
      return rows
    })
  }

  const updatePersonnelRow = (i: number, field: keyof PersonnelRow, val: string) => {
    setPersonnelRows(prev => {
      const rows = [...prev]
      rows[i] = { ...rows[i], [field]: val }
      rows[i].total = calcPersonnelTotal(rows[i].start1, rows[i].stop1, rows[i].start2, rows[i].stop2)
      return rows
    })
  }

  const selectedUnitData = units.find(u => u.id === selectedUnit)?.unit

  const handleGenerate = async () => {
    setGenerating(true)
    setSuccess('')
    try {
      // Gather signature data URLs
      const contractorSigData = contractorSigRef.current?.isEmpty() ? null : contractorSigRef.current?.getTrimmedCanvas().toDataURL('image/png')
      const supervisorSigData = supervisorSigRef.current?.isEmpty() ? null : supervisorSigRef.current?.getTrimmedCanvas().toDataURL('image/png')

      // Build payload for server-side PDF generation
      const payload = {
        incident,
        unit: selectedUnitData,
        ticketType,
        measureType,
        transportRetained,
        shiftRows: shiftRows.filter(r => r.date),
        personnelRows: personnelRows.filter(r => r.date || r.operator_name),
        remarks,
        contractorRep,
        supervisorName,
        contractorSig: contractorSigData,
        supervisorSig: supervisorSigData,
        generatedAt: new Date().toISOString(),
      }

      // Call API route to generate PDF
      const res = await fetch('/api/shift-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('PDF generation failed')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `OF297-${incident?.name?.replace(/\s+/g, '-') || 'Shift'}-${new Date().toISOString().slice(0, 10)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      setSuccess('✅ Shift ticket downloaded!')
    } catch (e: any) {
      setSuccess('❌ ' + (e.message || 'Error generating PDF'))
    }
    setGenerating(false)
  }

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-950 text-white mt-8 md:mt-0 pb-20">
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to={`/incidents/${incidentId}`} className="text-gray-500 hover:text-white text-sm">← Incident</Link>
          <span className="text-gray-700">/</span>
          <span className="text-gray-300 text-sm font-medium">OF-297 Shift Ticket</span>
        </div>
        <div>
          <h1 className="text-xl font-bold">Emergency Equipment Shift Ticket</h1>
          <p className="text-xs text-gray-500 mt-1">Optional Form 297 (Rev. 5/2024) — USDA/USDI</p>
        </div>

        {/* Fields 1-6: Top identification */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Identification</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>1. Agreement Number</label>
              <input className={inputCls} value={incident?.agreement_number || ''} readOnly />
            </div>
            <div>
              <label className={labelCls}>2. Contractor / Agency Name</label>
              <input className={inputCls} value="Sierra Valley EMS" readOnly />
            </div>
            <div>
              <label className={labelCls}>3. Resource Order Number</label>
              <input className={inputCls} value={incident?.resource_order_number || ''} readOnly />
            </div>
            <div>
              <label className={labelCls}>4. Incident Name</label>
              <input className={inputCls} value={incident?.name || ''} readOnly />
            </div>
            <div>
              <label className={labelCls}>5. Incident Number</label>
              <input className={inputCls} value={incident?.incident_number || ''} readOnly />
            </div>
            <div>
              <label className={labelCls}>6. Financial Code</label>
              <input className={inputCls} value={incident?.financial_code || ''} readOnly />
            </div>
          </div>
        </div>

        {/* Fields 7-10: Equipment */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Equipment</h2>
          <div>
            <label className={labelCls}>Select Unit</label>
            <select className={inputCls} value={selectedUnit} onChange={e => setSelectedUnit(e.target.value)}>
              <option value="">-- Select a unit --</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.unit?.name}</option>
              ))}
            </select>
          </div>
          {selectedUnitData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className={labelCls}>7. Make / Model</label>
                <input className={inputCls} value={selectedUnitData.make_model || ''} readOnly />
              </div>
              <div>
                <label className={labelCls}>8. Equipment Type</label>
                <input className={inputCls} value={selectedUnitData.unit_type || ''} readOnly />
              </div>
              <div>
                <label className={labelCls}>9. Serial / VIN</label>
                <input className={inputCls} value={selectedUnitData.vin || ''} readOnly />
              </div>
              <div>
                <label className={labelCls}>10. License / ID</label>
                <input className={inputCls} value={selectedUnitData.license_plate || ''} readOnly />
              </div>
            </div>
          )}
        </div>

        {/* Fields 12-14: Checkboxes */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Options</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <label className={labelCls}>12. Transport Retained?</label>
              <div className="flex gap-4">
                {(['yes', 'no'] as const).map(v => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="radio" name="transport" checked={transportRetained === v} onChange={() => setTransportRetained(v)} className="accent-red-500" />
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>13. First / Last Ticket?</label>
              <div className="flex gap-4">
                {(['mobilization', 'demobilization'] as const).map(v => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer text-sm capitalize">
                    <input type="checkbox" checked={ticketType === v} onChange={() => setTicketType(prev => prev === v ? '' : v)} className="accent-red-500" />
                    {v}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>14. Miles or Hours (fields 16-18)</label>
              <div className="flex gap-4">
                {(['miles', 'hours'] as const).map(v => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer text-sm capitalize">
                    <input type="radio" name="measure" checked={measureType === v} onChange={() => setMeasureType(v)} className="accent-red-500" />
                    {v}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Fields 15-21: Equipment shift rows */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Equipment Log (Fields 15–21)</h2>
            <button onClick={() => setShiftRows(prev => [...prev, emptyShiftRow()])}
              className="text-xs text-gray-400 hover:text-white transition-colors">+ Add Row</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-700">
                  <th className="text-left py-1.5 pr-2 w-24">15. Date</th>
                  <th className="text-left py-1.5 pr-2 w-20">16. Start</th>
                  <th className="text-left py-1.5 pr-2 w-20">17. Stop</th>
                  <th className="text-left py-1.5 pr-2 w-16">18. Total</th>
                  <th className="text-left py-1.5 pr-2 w-16">19. Qty</th>
                  <th className="text-left py-1.5 pr-2 w-20">20. Type</th>
                  <th className="text-left py-1.5">21. Remarks</th>
                </tr>
              </thead>
              <tbody>
                {shiftRows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    <td className="py-1 pr-2"><input type="date" className={inputCls} value={row.date} onChange={e => updateShiftRow(i, 'date', e.target.value)} /></td>
                    <td className="py-1 pr-2"><input className={inputCls} placeholder="0600" value={row.start} onChange={e => updateShiftRow(i, 'start', e.target.value)} /></td>
                    <td className="py-1 pr-2"><input className={inputCls} placeholder="1800" value={row.stop} onChange={e => updateShiftRow(i, 'stop', e.target.value)} /></td>
                    <td className="py-1 pr-2"><input className={`${inputCls} bg-gray-700`} value={row.total} readOnly /></td>
                    <td className="py-1 pr-2"><input className={inputCls} value={row.qty} onChange={e => updateShiftRow(i, 'qty', e.target.value)} /></td>
                    <td className="py-1 pr-2"><input className={inputCls} placeholder="Day" value={row.type} onChange={e => updateShiftRow(i, 'type', e.target.value)} /></td>
                    <td className="py-1"><input className={inputCls} value={row.remarks} onChange={e => updateShiftRow(i, 'remarks', e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fields 22-29: Personnel rows */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Personnel Log (Fields 22–29)</h2>
            <button onClick={() => setPersonnelRows(prev => [...prev, emptyPersonnelRow()])}
              className="text-xs text-gray-400 hover:text-white transition-colors">+ Add Row</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-700">
                  <th className="text-left py-1.5 pr-2 w-24">22. Date</th>
                  <th className="text-left py-1.5 pr-2">23. Operator Name</th>
                  <th className="text-left py-1.5 pr-2 w-16">24. Start</th>
                  <th className="text-left py-1.5 pr-2 w-16">25. Stop</th>
                  <th className="text-left py-1.5 pr-2 w-16">26. Start</th>
                  <th className="text-left py-1.5 pr-2 w-16">27. Stop</th>
                  <th className="text-left py-1.5 pr-2 w-16">28. Total</th>
                  <th className="text-left py-1.5">29. Remarks</th>
                </tr>
              </thead>
              <tbody>
                {personnelRows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    <td className="py-1 pr-2"><input type="date" className={inputCls} value={row.date} onChange={e => updatePersonnelRow(i, 'date', e.target.value)} /></td>
                    <td className="py-1 pr-2"><input className={inputCls} value={row.operator_name} onChange={e => updatePersonnelRow(i, 'operator_name', e.target.value)} /></td>
                    <td className="py-1 pr-2"><input className={inputCls} placeholder="0600" value={row.start1} onChange={e => updatePersonnelRow(i, 'start1', e.target.value)} /></td>
                    <td className="py-1 pr-2"><input className={inputCls} placeholder="1200" value={row.stop1} onChange={e => updatePersonnelRow(i, 'stop1', e.target.value)} /></td>
                    <td className="py-1 pr-2"><input className={inputCls} placeholder="1300" value={row.start2} onChange={e => updatePersonnelRow(i, 'start2', e.target.value)} /></td>
                    <td className="py-1 pr-2"><input className={inputCls} placeholder="1800" value={row.stop2} onChange={e => updatePersonnelRow(i, 'stop2', e.target.value)} /></td>
                    <td className="py-1 pr-2"><input className={`${inputCls} bg-gray-700`} value={row.total} readOnly /></td>
                    <td className="py-1"><input className={inputCls} value={row.remarks} onChange={e => updatePersonnelRow(i, 'remarks', e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Field 30: Remarks */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-2">
          <label className={labelCls}>30. Remarks — equipment breakdown, operating issues, other notes</label>
          <textarea value={remarks} onChange={e => setRemarks(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500 h-20 resize-none" />
        </div>

        {/* Fields 31-34: Signatures */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Signatures (Fields 31–34)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className={labelCls}>31. Contractor / Agency Rep (Printed Name)</label>
              <input className={inputCls} value={contractorRep} onChange={e => setContractorRep(e.target.value)} />
              <label className={labelCls}>32. Contractor / Agency Rep Signature</label>
              <div className="rounded-lg overflow-hidden border border-gray-600 bg-white">
                <SignatureCanvas ref={contractorSigRef}
                  canvasProps={{ width: 340, height: 100, className: 'w-full touch-none', style: { background: 'white' } }}
                  penColor="#1a1a2e" minWidth={1.5} maxWidth={3} />
              </div>
              <button onClick={() => contractorSigRef.current?.clear()} className="text-xs text-gray-500 hover:text-gray-300">Clear</button>
            </div>
            <div className="space-y-2">
              <label className={labelCls}>33. Incident Supervisor (Name & Resource Order)</label>
              <input className={inputCls} value={supervisorName} onChange={e => setSupervisorName(e.target.value)}
                placeholder="Name — Resource Order #" />
              <label className={labelCls}>34. Incident Supervisor Signature</label>
              <div className="rounded-lg overflow-hidden border border-gray-600 bg-white">
                <SignatureCanvas ref={supervisorSigRef}
                  canvasProps={{ width: 340, height: 100, className: 'w-full touch-none', style: { background: 'white' } }}
                  penColor="#1a1a2e" minWidth={1.5} maxWidth={3} />
              </div>
              <button onClick={() => supervisorSigRef.current?.clear()} className="text-xs text-gray-500 hover:text-gray-300">Clear</button>
            </div>
          </div>
        </div>

        {success && (
          <p className={`text-sm px-4 py-3 rounded-xl border ${success.startsWith('✅') ? 'bg-green-900/40 border-green-700 text-green-300' : 'bg-red-900/40 border-red-700 text-red-300'}`}>
            {success}
          </p>
        )}

        <button onClick={handleGenerate} disabled={generating || !selectedUnit}
          className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-xl transition-colors">
          {generating ? 'Generating PDF...' : '📄 Generate OF-297 PDF'}
        </button>

        {/* Finance contact info */}
        {incident?.finance_contact_name && (
          <div className="bg-gray-800/50 rounded-xl border border-gray-700 px-4 py-3 text-xs text-gray-400 space-y-1">
            <p className="font-semibold text-gray-300">Finance Contact (send completed ticket to):</p>
            <p>{incident.finance_contact_name}</p>
            {incident.finance_contact_email && <p>📧 {incident.finance_contact_email}</p>}
            {incident.finance_contact_phone && <p>📞 {incident.finance_contact_phone}</p>}
          </div>
        )}

      </div>
    </div>
  )
}
