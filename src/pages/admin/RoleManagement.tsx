import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePermission } from '@/hooks/usePermission'
import { toast } from '@/lib/toast'
import { LoadingSkeleton } from '@/components/ui'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

// ── Permission domains & labels ──────────────────────────────────────────
const PERMISSION_DOMAINS: { domain: string; label: string; permissions: { key: string; label: string }[] }[] = [
  {
    domain: 'encounters', label: 'Clinical — Encounters',
    permissions: [
      { key: 'encounters.view', label: 'View encounters' },
      { key: 'encounters.create', label: 'Create encounters' },
      { key: 'encounters.edit', label: 'Edit encounters' },
      { key: 'encounters.sign', label: 'Sign/cosign charts' },
      { key: 'encounters.delete', label: 'Delete encounters' },
    ],
  },
  {
    domain: 'mar', label: 'Clinical — MAR',
    permissions: [
      { key: 'mar.view', label: 'View medication records' },
      { key: 'mar.create', label: 'Administer medications' },
      { key: 'mar.authorize', label: 'Authorize Rx/CS on med units' },
    ],
  },
  {
    domain: 'cs', label: 'Controlled Substances',
    permissions: [
      { key: 'cs.view', label: 'View CS inventory' },
      { key: 'cs.count', label: 'Perform daily counts' },
      { key: 'cs.transfer', label: 'Transfer between units' },
      { key: 'cs.receive', label: 'Receive into warehouse' },
      { key: 'cs.audit', label: 'View audit trail' },
    ],
  },
  {
    domain: 'incidents', label: 'Incidents',
    permissions: [
      { key: 'incidents.view', label: 'View incidents' },
      { key: 'incidents.create', label: 'Create incidents' },
      { key: 'incidents.manage', label: 'Manage deployments & closeout' },
    ],
  },
  {
    domain: 'units', label: 'Units & Fleet',
    permissions: [
      { key: 'units.view', label: 'View units' },
      { key: 'units.manage', label: 'Create/edit units' },
      { key: 'units.crew', label: 'Manage crew assignments' },
    ],
  },
  {
    domain: 'inventory', label: 'Inventory',
    permissions: [
      { key: 'inventory.view', label: 'View inventory' },
      { key: 'inventory.add', label: 'Restock inventory' },
    ],
  },
  {
    domain: 'supply_runs', label: 'Supply Runs',
    permissions: [
      { key: 'supply_runs.view', label: 'View supply runs' },
      { key: 'supply_runs.create', label: 'Create supply runs' },
    ],
  },
  {
    domain: 'ics214', label: 'ICS 214 Logs',
    permissions: [
      { key: 'ics214.view', label: 'View activity logs' },
      { key: 'ics214.create', label: 'Create/edit logs' },
    ],
  },
  {
    domain: 'roster', label: 'HR & People',
    permissions: [
      { key: 'roster.view', label: 'View employee list' },
      { key: 'roster.manage', label: 'Edit employee records' },
      { key: 'roster.credentials', label: 'Manage credentials' },
      { key: 'roster.pii', label: 'Access PII (DOB, address)' },
    ],
  },
  {
    domain: 'schedule', label: 'Scheduling',
    permissions: [
      { key: 'schedule.view_own', label: 'View own schedule' },
      { key: 'schedule.view_all', label: 'View all schedules' },
      { key: 'schedule.manage', label: 'Generate/publish schedules' },
    ],
  },
  {
    domain: 'payroll', label: 'Payroll',
    permissions: [
      { key: 'payroll.view_own', label: 'View own pay' },
      { key: 'payroll.view_all', label: 'View all payroll' },
      { key: 'payroll.manage', label: 'Edit pay rates/approve' },
    ],
  },
  {
    domain: 'billing', label: 'Billing',
    permissions: [{ key: 'billing.view', label: 'View billing data' }],
  },
  {
    domain: 'expenses', label: 'Expenses',
    permissions: [
      { key: 'expenses.view', label: 'View expenses' },
      { key: 'expenses.manage', label: 'Create/approve expenses' },
    ],
  },
  {
    domain: 'admin', label: 'Administration',
    permissions: [
      { key: 'admin.settings', label: 'App settings' },
      { key: 'admin.push', label: 'Send push notifications' },
      { key: 'admin.analytics', label: 'View analytics' },
      { key: 'admin.documents', label: 'Manage documents' },
    ],
  },
  {
    domain: 'chat', label: 'Chat',
    permissions: [{ key: 'chat.admin', label: 'Admin chat (view all DMs)' }],
  },
]

// ── Types ────────────────────────────────────────────────────────────────
type Role = {
  id: string
  name: string
  display_name: string
  description: string | null
  permissions: string[]
  is_system: boolean
  created_at: string
  employee_count: number
}

type Employee = {
  id: string
  name: string
  role: string | null
  app_role: string
  wf_email: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────
function hasPermission(perms: string[], key: string): boolean {
  if (perms.includes('*')) return true
  if (perms.includes(key)) return true
  const domain = key.split('.')[0]
  if (perms.includes(domain + '.*')) return true
  return false
}

function hasDomainWildcard(perms: string[], domain: string): boolean {
  return perms.includes('*') || perms.includes(domain + '.*')
}

// ── Main Component ───────────────────────────────────────────────────────
function RoleManagementInner() {
  const supabase = createClient()
  const canManage = usePermission('admin.settings')

  const [roles, setRoles] = useState<Role[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRole, setExpandedRole] = useState<string | null>(null)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null)
  const [saving, setSaving] = useState(false)

  // Create form state
  const [createForm, setCreateForm] = useState({ name: '', display_name: '', description: '', permissions: [] as string[] })

  // Employee assignment state
  const [assignModal, setAssignModal] = useState<{ role: Role; assignedEmployees: string[] } | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState('')

  // ── Load data ───────────────────────────────────────────────────────
  const loadData = async () => {
    const [{ data: rolesData }, { data: employeeRoles }, { data: emps }] = await Promise.all([
      supabase.from('roles').select('*').order('is_system', { ascending: false }).order('display_name'),
      supabase.from('employee_roles').select('role_id, employee_id'),
      supabase.from('employees').select('id, name, role, app_role, wf_email').eq('status', 'Active').order('name'),
    ])

    // Count employees per role
    const countMap: Record<string, number> = {}
    const roleEmployeeMap: Record<string, string[]> = {}
    for (const er of (employeeRoles || [])) {
      countMap[er.role_id] = (countMap[er.role_id] || 0) + 1
      if (!roleEmployeeMap[er.role_id]) roleEmployeeMap[er.role_id] = []
      roleEmployeeMap[er.role_id].push(er.employee_id)
    }

    setRoles((rolesData || []).map((r: any) => ({ ...r, employee_count: countMap[r.id] || 0 })))
    setEmployees(emps || [])
    setLoading(false)

    // Store for assignment modal
    ;(window as any).__roleEmployeeMap = roleEmployeeMap
  }

  useEffect(() => { loadData() }, [])

  // ── CRUD handlers ──────────────────────────────────────────────────
  const handleCreateRole = async () => {
    if (!createForm.display_name.trim()) { toast.warning('Role name is required'); return }
    setSaving(true)
    const slug = createForm.display_name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    const { error } = await supabase.from('roles').insert({
      name: slug,
      display_name: createForm.display_name.trim(),
      description: createForm.description.trim() || null,
      permissions: createForm.permissions,
      is_system: false,
    })
    setSaving(false)
    if (error) { toast.error('Failed to create role: ' + error.message); return }
    toast.success('Role created')
    setShowCreate(false)
    setCreateForm({ name: '', display_name: '', description: '', permissions: [] })
    loadData()
  }

  const handleSavePermissions = async (role: Role, newPerms: string[]) => {
    setSaving(true)
    const { error } = await supabase.from('roles').update({ permissions: newPerms, updated_at: new Date().toISOString() }).eq('id', role.id)
    setSaving(false)
    if (error) { toast.error('Failed to save: ' + error.message); return }
    toast.success('Permissions updated')
    loadData()
  }

  const handleDeleteRole = async () => {
    if (!deleteTarget) return
    setSaving(true)
    const { error } = await supabase.from('roles').delete().eq('id', deleteTarget.id).eq('is_system', false)
    setSaving(false)
    if (error) { toast.error('Failed to delete: ' + error.message); return }
    toast.success('Role deleted')
    setDeleteTarget(null)
    setExpandedRole(null)
    loadData()
  }

  const handleAssignEmployee = async () => {
    if (!assignModal || !selectedEmployee) return
    setSaving(true)
    const { error } = await supabase.from('employee_roles').insert({ employee_id: selectedEmployee, role_id: assignModal.role.id })
    setSaving(false)
    if (error) {
      if (error.code === '23505') toast.warning('Employee already has this role')
      else toast.error('Failed to assign: ' + error.message)
      return
    }
    toast.success('Role assigned')
    setSelectedEmployee('')
    loadData()
    // Refresh the modal data
    const { data: updated } = await supabase.from('employee_roles').select('employee_id').eq('role_id', assignModal.role.id)
    setAssignModal({ ...assignModal, assignedEmployees: (updated || []).map((e: any) => e.employee_id) })
  }

  const handleRemoveEmployee = async (employeeId: string) => {
    if (!assignModal) return
    const { error } = await supabase.from('employee_roles').delete().match({ employee_id: employeeId, role_id: assignModal.role.id })
    if (error) { toast.error('Failed to remove: ' + error.message); return }
    toast.success('Role removed')
    loadData()
    setAssignModal({ ...assignModal, assignedEmployees: assignModal.assignedEmployees.filter(id => id !== employeeId) })
  }

  const openAssignModal = async (role: Role) => {
    const { data } = await supabase.from('employee_roles').select('employee_id').eq('role_id', role.id)
    setAssignModal({ role, assignedEmployees: (data || []).map((e: any) => e.employee_id) })
    setSelectedEmployee('')
  }

  if (!canManage) {
    return <div className="p-6 text-center" style={{ color: 'var(--color-text-muted)' }}>You don't have permission to manage roles.</div>
  }

  if (loading) return <LoadingSkeleton />

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Roles & Permissions</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Manage access control for your team</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          + Custom Role
        </button>
      </div>

      {/* Role Cards */}
      {roles.map(role => (
        <div
          key={role.id}
          className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}
        >
          {/* Role Header */}
          <button
            onClick={() => setExpandedRole(expandedRole === role.id ? null : role.id)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:opacity-90 transition-opacity"
          >
            <div className="flex items-center gap-3">
              {role.is_system && <span title="Built-in role" className="text-sm">🔒</span>}
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>{role.display_name}</h3>
                {role.description && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{role.description}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--color-primary)', color: 'white', opacity: 0.9 }}>
                {role.employee_count} {role.employee_count === 1 ? 'member' : 'members'}
              </span>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{role.permissions.includes('*') ? 'All permissions' : `${role.permissions.length} permissions`}</span>
              <svg className={`w-4 h-4 transition-transform ${expandedRole === role.id ? 'rotate-180' : ''}`} style={{ color: 'var(--color-text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </button>

          {/* Expanded: Permissions + Actions */}
          {expandedRole === role.id && (
            <div className="border-t px-5 py-4 space-y-4" style={{ borderColor: 'var(--color-border)' }}>
              {role.permissions.includes('*') ? (
                <div className="flex items-center gap-2 py-2">
                  <span className="text-lg">⚡</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Super Admin — full access to everything</span>
                </div>
              ) : (
                <PermissionGrid
                  permissions={role.permissions}
                  editable={!role.is_system}
                  onSave={(newPerms) => handleSavePermissions(role, newPerms)}
                  saving={saving}
                />
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <button onClick={() => openAssignModal(role)} className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                  👥 Manage Members
                </button>
                {!role.is_system && (
                  <button onClick={() => setDeleteTarget(role)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 border border-red-800 hover:bg-red-900/30">
                    🗑 Delete Role
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Create Role Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border p-6 mx-4" style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text)' }}>Create Custom Role</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-muted)' }}>Role Name</label>
                <input value={createForm.display_name} onChange={e => setCreateForm(p => ({ ...p, display_name: e.target.value }))} className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2" style={{ backgroundColor: 'var(--color-bg-input, #1f2937)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }} placeholder="e.g. Logistics Coordinator" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-muted)' }}>Description</label>
                <input value={createForm.description} onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))} className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2" style={{ backgroundColor: 'var(--color-bg-input, #1f2937)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }} placeholder="What this role is for" />
              </div>
              <PermissionGrid
                permissions={createForm.permissions}
                editable
                onChange={(perms) => setCreateForm(p => ({ ...p, permissions: perms }))}
              />
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--color-text-muted)' }}>Cancel</button>
                <button onClick={handleCreateRole} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: 'var(--color-primary)' }}>
                  {saving ? 'Creating...' : 'Create Role'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Employees Modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setAssignModal(null)}>
          <div className="w-full max-w-md max-h-[70vh] overflow-y-auto rounded-2xl border p-6 mx-4" style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--color-text)' }}>{assignModal.role.display_name}</h2>
            <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>Assign or remove employees from this role</p>

            {/* Current members */}
            <div className="space-y-2 mb-4">
              {assignModal.assignedEmployees.length === 0 && (
                <p className="text-sm italic" style={{ color: 'var(--color-text-muted)' }}>No employees assigned</p>
              )}
              {assignModal.assignedEmployees.map(eid => {
                const emp = employees.find(e => e.id === eid)
                if (!emp) return null
                return (
                  <div key={eid} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg-input, #1f2937)' }}>
                    <span className="text-sm" style={{ color: 'var(--color-text)' }}>{emp.name}</span>
                    <button onClick={() => handleRemoveEmployee(eid)} className="text-xs text-red-400 hover:text-red-300">✕ Remove</button>
                  </div>
                )
              })}
            </div>

            {/* Add employee */}
            <div className="flex gap-2">
              <select
                value={selectedEmployee}
                onChange={e => setSelectedEmployee(e.target.value)}
                className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{ backgroundColor: 'var(--color-bg-input, #1f2937)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
              >
                <option value="">Select employee...</option>
                {employees.filter(e => !assignModal.assignedEmployees.includes(e.id)).map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.role || 'No role'})</option>
                ))}
              </select>
              <button
                onClick={handleAssignEmployee}
                disabled={!selectedEmployee || saving}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                Add
              </button>
            </div>

            <div className="flex justify-end mt-4">
              <button onClick={() => setAssignModal(null)} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--color-text-muted)' }}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Role"
        message={`Delete "${deleteTarget?.display_name}"? ${(deleteTarget?.employee_count || 0) > 0 ? `${deleteTarget?.employee_count} employees will lose this role.` : ''}`}
        confirmLabel="Delete"
        onConfirm={handleDeleteRole}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

// ── Permission Grid ──────────────────────────────────────────────────────
function PermissionGrid({
  permissions,
  editable = false,
  onSave,
  onChange,
  saving = false,
}: {
  permissions: string[]
  editable?: boolean
  onSave?: (perms: string[]) => void
  onChange?: (perms: string[]) => void
  saving?: boolean
}) {
  const [localPerms, setLocalPerms] = useState<string[]>(permissions)
  const [dirty, setDirty] = useState(false)

  useEffect(() => { setLocalPerms(permissions); setDirty(false) }, [permissions])

  const toggle = (key: string) => {
    if (!editable) return
    const next = localPerms.includes(key) ? localPerms.filter(p => p !== key) : [...localPerms, key]
    setLocalPerms(next)
    setDirty(true)
    onChange?.(next)
  }

  const toggleDomain = (domain: string, allKeys: string[]) => {
    if (!editable) return
    const wildcard = domain + '.*'
    let next: string[]
    if (localPerms.includes(wildcard)) {
      // Remove wildcard and all individual perms for this domain
      next = localPerms.filter(p => p !== wildcard && !allKeys.includes(p))
    } else {
      // Add wildcard, remove individual perms (wildcard covers them)
      next = [...localPerms.filter(p => !allKeys.includes(p)), wildcard]
    }
    setLocalPerms(next)
    setDirty(true)
    onChange?.(next)
  }

  return (
    <div className="space-y-3">
      {PERMISSION_DOMAINS.map(({ domain, label, permissions: domainPerms }) => {
        const allKeys = domainPerms.map(p => p.key)
        const domainWild = hasDomainWildcard(localPerms, domain)
        const checkedCount = domainWild ? allKeys.length : allKeys.filter(k => hasPermission(localPerms, k)).length

        return (
          <div key={domain} className="rounded-lg border p-3" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-2 mb-2">
              {editable && (
                <input
                  type="checkbox"
                  checked={domainWild}
                  onChange={() => toggleDomain(domain, allKeys)}
                  className="rounded accent-red-500"
                />
              )}
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                {label}
              </span>
              <span className="text-xs ml-auto" style={{ color: 'var(--color-text-muted)' }}>
                {checkedCount}/{allKeys.length}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {domainPerms.map(({ key, label: permLabel }) => {
                const checked = hasPermission(localPerms, key)
                return (
                  <label key={key} className={`flex items-center gap-1.5 text-xs py-1 px-1.5 rounded ${editable ? 'cursor-pointer hover:opacity-80' : ''}`}>
                    {editable ? (
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={domainWild}
                        onChange={() => toggle(key)}
                        className="rounded accent-red-500"
                      />
                    ) : (
                      <span className={checked ? 'text-green-400' : 'text-gray-600'}>{checked ? '✓' : '·'}</span>
                    )}
                    <span style={{ color: checked ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{permLabel}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}

      {editable && onSave && dirty && (
        <div className="flex justify-end">
          <button
            onClick={() => onSave(localPerms)}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {saving ? 'Saving...' : 'Save Permissions'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Export with Suspense ──────────────────────────────────────────────────
export default function RoleManagement() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <RoleManagementInner />
    </Suspense>
  )
}
