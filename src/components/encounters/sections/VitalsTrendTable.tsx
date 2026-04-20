import type { VitalsColumn } from '@/types/encounters'
import { dash } from '@/utils/encounterFormatters'

export function VitalsTrendTable({ columns }: { columns: VitalsColumn[] }) {
  if (columns.length === 0) return null

  const rows: { label: string; key: keyof VitalsColumn; format?: (v: VitalsColumn) => string }[] = [
    { label: 'HR', key: 'hr', format: c => c.hr ? `${c.hr}` : '—' },
    { label: 'RR', key: 'rr', format: c => c.rr ? `${c.rr}` : '—' },
    { label: 'SpO2', key: 'spo2', format: c => c.spo2 ? `${c.spo2}%` : '—' },
    {
      label: 'BP', key: 'bp_systolic',
      format: c => c.bp_systolic && c.bp_diastolic ? `${c.bp_systolic}/${c.bp_diastolic}` : c.bp_systolic ? `${c.bp_systolic}` : '—',
    },
    { label: 'GCS', key: 'gcs', format: c => c.gcs ? `${c.gcs}` : '—' },
    { label: 'Pain', key: 'pain_scale', format: c => c.pain_scale !== null ? `${c.pain_scale}/10` : '—' },
    { label: 'Temp', key: 'temp_f', format: c => c.temp_f ? `${c.temp_f}°F` : '—' },
    { label: 'BGL', key: 'blood_glucose', format: c => c.blood_glucose ? `${c.blood_glucose}` : '—' },
    { label: 'EtCO2', key: 'etco2', format: c => c.etco2 ? `${c.etco2}` : '—' },
    { label: 'Rhythm', key: 'cardiac_rhythm', format: c => c.cardiac_rhythm ? c.cardiac_rhythm.replace(' (Normal Sinus Rhythm)', '').replace(' (Pulseless Electrical Activity)', '') : '—' },
    { label: 'Skin', key: 'skin', format: c => c.skin ?? '—' },
    { label: 'Pupils', key: 'pupils', format: c => c.pupils ?? '—' },
  ]

  return (
    <div className="overflow-x-auto">
      <table className="text-sm min-w-full">
        <thead>
          <tr>
            <th className="text-left text-xs text-gray-500 uppercase tracking-wide py-1.5 pr-4 w-16">Vital</th>
            {columns.map((col, i) => (
              <th key={i} className={`text-center text-xs py-1.5 px-3 whitespace-nowrap ${i === 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const vals = columns.map(c => row.format ? row.format(c) : dash(c[row.key] as string | number | null))
            const hasAny = vals.some(v => v !== '—')
            if (!hasAny) return null
            return (
              <tr key={row.label} className="border-t border-gray-800">
                <td className="text-xs text-gray-500 uppercase tracking-wide py-1.5 pr-4">{row.label}</td>
                {vals.map((v, i) => (
                  <td key={i} className={`text-center py-1.5 px-3 whitespace-nowrap ${v === '—' ? 'text-gray-700' : 'text-white'}`}>
                    {v}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
