
import { useEffect, useState } from 'react'
import { toast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import { usePermission } from '@/hooks/usePermission'
import { Link } from 'react-router-dom'
import { LoadingSkeleton, ConfirmDialog } from '@/components/ui'
import { useListStyle } from '@/hooks/useListStyle'
import { getListClasses } from '@/lib/listStyles'

type Employee = {
  id: string
  name: string
  role: string
  status: string
  daily_rate: number | null
  default_hours_per_day: number | null
}

const ROLE_DEFAULTS: Record<string, number> = {
  'MD': 1800,
  'DO': 1800,
  'NP': 1200,
  'PA': 1200,
  'RN': 900,
  'Paramedic': 900,
  'EMT': 600,
  'Admin': 600,
}

export default function PayRatesPage() {
  const listStyle = useListStyle()
  const lc = getListClasses(listStyle)
  const supabase = createClient()
  const isAdmin = usePermission('payroll.manage')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [success, setSuccess] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRate, setEditRate] = useState('')
  const [editHours, setEditHours] = useState('')
  const [bulkMode, setBulkMode] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{ action: () => void; title: string; message: string; confirmLabel?: string; icon?: string; confirmColor?: string } | null>(null)

  const loadEmployees = async () => {
    const { data } = await supabase
      .from('employees')
      .select('id, name, role, status, daily_rate, default_hours_per_day')
      .eq('status', 'Active')
      .order('name')
    setEmployees((data as Employee[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    loadEmployees()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveRate = async (empId: string, rate: number, hours: number) => {
    setSaving(empId)
    const { error } = await supabase
      .from('employees')
      .update({ daily_rate: rate, default_hours_per_day: hours })
      .eq('id', empId)
    if (error) {
      toast.error('Save failed: ' + error.message)
    } else {
      setEmployees(prev => prev.map(e => e.id === empId ? { ...e, daily_rate: rate, default_hours_per_day: hours } : e))
      setSuccess(`Updated ${employees.find(e => e.id === empId)?.name}`)
      setTimeout(() => setSuccess(''), 2000)
    }
    setSaving(null)
    setEditingId(null)
  }

  const applyDefaults = () => {
    setConfirmAction({
      action: async () => {
        setSaving('bulk')
        for (const emp of employees) {
          const defaultRate = ROLE_DEFAULTS[emp.role] ?? 600
          if (emp.daily_rate !== defaultRate) {
            await supabase
              .from('employees')
              .update({ daily_rate: defaultRate, default_hours_per_day: 16 })
              .eq('id', emp.id)
          }
        }
        await loadEmployees()
        setSaving(null)
        setSuccess('Default rates applied to all employees')
        setTimeout(() => setSuccess(''), 3000)
      },
      title: 'Apply Default Rates',
      message: 'Set default rates for all employees based on role?\n\nMD / DO: $1,800\nNP/PA: $1,200\nRN/Paramedic: $900\nEMT/Admin: $600\n\nThis will overwrite current rates.',
      icon: '⚠️',
    })
  }

  if (!isAdmin) {
    return <div className="p-8 text-red-400">Admin access required.</div>
  }

  if (loading) return <LoadingSkeleton fullPage />

  // Group by role
  const byRole = employees.reduce<Record<string, Employee[]>>((acc, emp) => {
    const r = emp.role || 'Other'
    if (!acc[r]) acc[r] = []
    acc[r].push(emp)
    return acc
  }, {})
  const roleOrder = ['MD', 'DO', 'NP', 'PA', 'RN', 'Paramedic', 'EMT', 'Admin', 'Other']
  const sortedRoles = roleOrder.filter(r => byRole[r]?.length).concat(
    Object.keys(byRole).filter(r => !roleOrder.includes(r))
  )

  return (
    <div className="p-6 md:p-8 max-w-3xl mt-8 md:mt-0 pb-20">
      <div className="flex items-center gap-3 mb-1">
        <Link to="/roster" className="text-gray-500 hover:text-white text-sm">← Roster</Link>
      </div>
      <h1 className="text-2xl font-bold mb-1">💰 Pay Rates</h1>
      <p className="text-gray-400 text-sm mb-6">
        Set default daily rate and hours per day for each employee. These are used for payroll calculations on incident deployments.
        Rates can be overridden per-deployment.
      </p>

      {success && (
        <div className="bg-green-900/40 border border-green-700 rounded-xl px-4 py-2 text-green-300 text-sm mb-4">✅ {success}</div>
      )}

      <div className="flex gap-2 mb-6">
        <button onClick={applyDefaults} disabled={saving === 'bulk'}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 rounded-lg text-sm font-medium transition-colors">
          {saving === 'bulk' ? 'Applying...' : '⚡ Apply Role Defaults'}
        </button>
        <div className="flex-1" />
        <div className="text-xs text-gray-500 self-center">
          Policy: {16}h/day · Full day for travel days
        </div>
      </div>

      {sortedRoles.map(role => (
        <div key={role} className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">{role}</h2>
            <span className="text-xs text-gray-600">{byRole[role].length} employees</span>
            <span className="text-xs text-gray-600 ml-auto">Default: {ROLE_DEFAULTS[role] ? `$${ROLE_DEFAULTS[role]}/day` : '—'}</span>
          </div>
          <div className={lc.container}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b theme-card-header">
                  <th className="text-left px-4 py-2 text-xs text-gray-500 font-semibold uppercase">Name</th>
                  <th className="text-right px-4 py-2 text-xs text-gray-500 font-semibold uppercase">Daily Rate</th>
                  <th className="text-right px-4 py-2 text-xs text-gray-500 font-semibold uppercase">Hourly</th>
                  <th className="text-right px-4 py-2 text-xs text-gray-500 font-semibold uppercase">Hrs/Day</th>
                  <th className="px-4 py-2 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {byRole[role].map(emp => {
                  const rate = emp.daily_rate ?? 0
                  const hours = emp.default_hours_per_day ?? 16
                  const hourly = hours > 0 ? rate / hours : 0
                  const isEditing = editingId === emp.id

                  if (isEditing) {
                    const editRateNum = parseFloat(editRate) || 0
                    const editHoursNum = parseFloat(editHours) || 16
                    const editHourly = editHoursNum > 0 ? editRateNum / editHoursNum : 0
                    return (
                      <tr key={emp.id} className="bg-gray-800/50">
                        <td className="px-4 py-2 text-white font-medium">{emp.name}</td>
                        <td className="px-4 py-2 text-right">
                          <input type="number" step="1" value={editRate}
                            onChange={e => setEditRate(e.target.value)}
                            className="w-24 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-right text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                            autoFocus />
                        </td>
                        <td className="px-4 py-2 text-right text-gray-400">
                          ${editHourly.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input type="number" step="1" value={editHours}
                            onChange={e => setEditHours(e.target.value)}
                            className="w-16 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-right text-sm focus:outline-none focus:ring-1 focus:ring-red-500" />
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex gap-1">
                            <button onClick={() => saveRate(emp.id, editRateNum, editHoursNum)}
                              disabled={saving === emp.id}
                              className="px-2 py-1 bg-green-700 hover:bg-green-600 rounded text-xs font-semibold">
                              {saving === emp.id ? '...' : '✓'}
                            </button>
                            <button onClick={() => setEditingId(null)}
                              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">✕</button>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={emp.id} className={lc.row}>
                      <td className="px-4 py-2 text-white">{emp.name}</td>
                      <td className="px-4 py-2 text-right font-medium text-green-400">
                        {rate > 0 ? `$${rate.toLocaleString()}` : <span className="text-gray-600">Not set</span>}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-400">
                        {hourly > 0 ? `$${hourly.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-400">{hours}</td>
                      <td className="px-4 py-2">
                        <button onClick={() => { setEditingId(emp.id); setEditRate(String(rate)); setEditHours(String(hours)) }}
                          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors">
                          Edit
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="mt-8 bg-gray-900/50 rounded-xl border border-gray-800 p-4">
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">📋 California Compliance Notes</h3>
        <ul className="text-xs text-gray-500 space-y-1">
          <li>• Policy: <strong>16 hours</strong> per operational day (full day pay for travel days)</li>
          <li>• Hourly rate = Daily rate ÷ hours/day (shown for records)</li>
          <li>• Rates here are defaults — can be overridden per incident deployment</li>
          <li>• All days on incident (including travel) are billed as full days</li>
        </ul>
      </div>
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        icon={confirmAction?.icon || '⚠️'}
        confirmColor={confirmAction?.confirmColor}
        onConfirm={() => { confirmAction?.action(); setConfirmAction(null) }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}
