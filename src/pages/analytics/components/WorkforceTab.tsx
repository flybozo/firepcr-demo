import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ResponsiveContainer,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
  Legend,
} from 'recharts'
import { C, PIE_COLORS } from './analyticsTypes'
import { axisStyle, gridStyle, tooltipStyle } from './chartStyles'
import { StatCard } from './StatCard'
import { Empty } from './Empty'
import { Skeleton } from './Skeleton'
import { SectionHeader } from './SectionHeader'

const CERT_FIELDS: { key: string; label: string }[] = [
  { key: 'bls', label: 'BLS' },
  { key: 'acls', label: 'ACLS' },
  { key: 'pals', label: 'PALS' },
  { key: 'itls', label: 'ITLS' },
  { key: 'paramedic_license', label: 'Paramedic License' },
  { key: 'ambulance_driver_cert', label: 'Ambulance Driver' },
  { key: 's130', label: 'S-130' },
  { key: 's190', label: 'S-190' },
  { key: 'l180', label: 'L-180' },
  { key: 'ics100', label: 'ICS-100' },
  { key: 'ics200', label: 'ICS-200' },
  { key: 'ics700', label: 'ICS-700' },
  { key: 'ics800', label: 'ICS-800' },
]

type Employee = Record<string, string | number | null | boolean>

export function WorkforceTab() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<Employee[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const certKeys = CERT_FIELDS.map(f => f.key).join(', ')
        const { data } = await supabase
          .from('employees')
          .select(`id, role, experience_level, status, ${certKeys}`)
          .eq('status', 'Active') as unknown as { data: Employee[] | null }
        setEmployees(data || [])
      } catch {
        // Offline — workforce analytics require connectivity
      }
      setLoading(false)
    }
    load()
  }, [])

  const roleCounts: Record<string, number> = {}
  employees.forEach(e => {
    const r = (e.role as string) || 'Other'
    roleCounts[r] = (roleCounts[r] || 0) + 1
  })

  const roleData = Object.entries(roleCounts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))

  const countByRole = (roles: string[]) => employees.filter(e => roles.includes(e.role as string)).length

  const isExpiringSoon = (val: string | null | undefined): boolean => {
    if (!val || typeof val !== 'string') return false
    const match = val.match(/(\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/)
    if (!match) return false
    const date = new Date(match[0])
    if (isNaN(date.getTime())) return false
    const daysUntil = (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return daysUntil > 0 && daysUntil <= 90
  }

  const certData = CERT_FIELDS.map(({ key, label }) => {
    let complete = 0, expiring = 0, missing = 0
    employees.forEach(e => {
      const val = e[key]
      if (!val || val === '' || val === null) {
        missing++
      } else if (isExpiringSoon(val as string)) {
        expiring++
      } else {
        complete++
      }
    })
    return { name: label, complete, expiring, missing }
  })

  const totalCertSlots = certData.reduce((s, d) => s + d.complete + d.expiring + d.missing, 0)
  const totalComplete = certData.reduce((s, d) => s + d.complete, 0)
  const overallCompliance = totalCertSlots > 0 ? ((totalComplete / totalCertSlots) * 100).toFixed(1) : '—'

  const expCounts = { 'Junior ⭐': 0, 'Mid ⭐⭐': 0, 'Senior ⭐⭐⭐': 0 }
  employees.forEach(e => {
    const lvl = e.experience_level as number
    if (lvl === 1) expCounts['Junior ⭐']++
    else if (lvl === 2) expCounts['Mid ⭐⭐']++
    else if (lvl === 3) expCounts['Senior ⭐⭐⭐']++
  })
  const expData = Object.entries(expCounts).map(([name, count]) => ({ name, count }))

  return (
    <div className="space-y-8">
      {/* ── A: Staffing Summary ── */}
      <section>
        <SectionHeader title="👥 Staffing Summary" sub="Active employees" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          <StatCard label="Total Staff" value={loading ? '—' : employees.length} accent={C.red} />
          <StatCard label="MDs / DOs" value={loading ? '—' : countByRole(['MD', 'DO'])} accent={C.blue} />
          <StatCard label="Paramedics" value={loading ? '—' : countByRole(['Paramedic', 'FP-C'])} accent={C.green} />
          <StatCard label="EMTs" value={loading ? '—' : countByRole(['EMT', 'EMT-B', 'AEMT'])} accent={C.amber} />
          <StatCard label="RNs" value={loading ? '—' : countByRole(['RN', 'CEN', 'CCRN'])} accent={C.violet} />
          <StatCard label="Other" value={loading ? '—' : employees.filter(e => !['MD', 'DO', 'Paramedic', 'FP-C', 'EMT', 'EMT-B', 'AEMT', 'RN', 'CEN', 'CCRN'].includes(e.role as string)).length} accent={C.gray} />
        </div>
        {loading ? <Skeleton h="h-52" /> : roleData.length === 0 ? <Empty /> : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col md:flex-row items-center gap-6">
            <div className="w-full md:w-64 shrink-0">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={roleData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                    dataKey="value" nameKey="name" labelLine={false}>
                    {roleData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 flex-1">
              {roleData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-sm text-gray-300 flex-1">{d.name}</span>
                  <span className="text-sm font-bold text-white">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── B: Credential Compliance ── */}
      <section>
        <SectionHeader title="✅ Credential Compliance" sub="Active employees · Based on cert field presence" />
        {loading ? <Skeleton h="h-64" /> : (
          <>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4 flex items-center gap-6"
              style={{ borderLeftColor: parseFloat(overallCompliance) >= 80 ? C.green : parseFloat(overallCompliance) >= 60 ? C.amber : C.red, borderLeftWidth: 3 }}>
              <div>
                <div className="text-4xl font-bold text-white">{overallCompliance}%</div>
                <div className="text-xs text-gray-400 uppercase tracking-wide mt-0.5">Overall Compliance</div>
              </div>
              <div className="flex gap-6 text-sm ml-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-gray-400">Complete</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-gray-400">Expiring Soon (≤90d)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-600" />
                  <span className="text-gray-400">Missing</span>
                </div>
              </div>
            </div>

            {employees.length === 0 ? <Empty /> : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-x-auto">
                <ResponsiveContainer width="100%" height={Math.max(260, certData.length * 28)}>
                  <BarChart data={certData} layout="vertical" margin={{ top: 5, right: 30, left: 115, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} horizontal={false} />
                    <XAxis type="number" tick={axisStyle} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 11 }} width={110} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend iconType="square" wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                    <Bar dataKey="complete" stackId="a" fill={C.green} name="Complete" />
                    <Bar dataKey="expiring" stackId="a" fill={C.amber} name="Expiring Soon" />
                    <Bar dataKey="missing" stackId="a" fill={C.red} name="Missing" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── C: Experience Distribution ── */}
      <section>
        <SectionHeader title="⭐ Experience Distribution" />
        {loading ? <Skeleton h="h-44" /> : employees.length === 0 ? <Empty /> : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-x-auto">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={expData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} />
                <XAxis dataKey="name" tick={axisStyle} />
                <YAxis tick={axisStyle} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill={C.amber} radius={[4, 4, 0, 0]} name="Employees" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  )
}
