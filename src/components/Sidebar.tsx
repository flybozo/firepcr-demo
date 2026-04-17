import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { APP_VERSION } from '@/components/VersionNotifier'
import { useRole } from '@/lib/useRole'
import { createClient } from '@/lib/supabase/client'
import { useUnsignedCounts } from '@/lib/useUnsignedPCRCount'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type SubItem = { label: string; href: string }
type NavItem = { icon: string; label: string; href: string; sub: SubItem[]; adminOnly?: boolean; onlineOnly?: boolean; directLink?: boolean }

const NAV: NavItem[] = [
  {
    icon: '🔥',
    label: 'Incidents',
    href: '/incidents',
    directLink: true,
    sub: [
      { label: 'New Incident', href: '/incidents/new' },
      { label: 'All 214 Logs', href: '/ics214' },
      { label: 'New ICS 214', href: '/ics214/new' },
    ],
    adminOnly: false,
  },
  {
    icon: '📋',
    label: 'Patient Encounters',
    href: '/encounters',
    directLink: true,
    sub: [
      { label: 'New Encounter', href: '/encounters/new' },
      { label: 'Unsigned Items', href: '/unsigned-items' },
      { label: 'Patient Search', href: '/patient-search' },
      { label: 'MAR', href: '/mar' },
      { label: 'New MAR Entry', href: '/mar/new' },
      { label: 'MAR Search', href: '/mar/search' },
    ],
  },
  {
    icon: '🚑',
    label: 'Units',
    href: '/units',
    directLink: true,
    sub: [
      { label: 'Add New Unit', href: '/units/new' },
    ],
    adminOnly: false,
  },

  {
    icon: '📦',
    label: 'Inventory',
    href: '/inventory',
    directLink: true,
    sub: [
      { label: 'Add Inventory', href: '/inventory/add' },
      { label: 'Formulary Templates', href: '/formulary' },
      { label: 'Reorder Report', href: '/inventory/reorder' },
      { label: 'Burn Rate', href: '/inventory/burnrate' },
      { label: 'Billing Report', href: '/billing' },
    ],
  },
  {
    icon: '🔐',
    label: 'CS System',
    href: '/cs',
    directLink: true,
    sub: [
      { label: 'CS Overview', href: '/cs' },
      { label: 'Receive CS', href: '/cs/receive' },
      { label: 'Transfer CS', href: '/cs/transfer' },
      { label: 'Daily Count', href: '/cs/count' },
      { label: 'Audit Log', href: '/cs/audit' },
      { label: 'Daily Checklist', href: '/cs/checklist' },
    ],
  },
  {
    icon: '🛒',
    label: 'Supply Runs',
    href: '/supply-runs',
    directLink: true,
    sub: [
      { label: 'New Supply Run', href: '/supply-runs/new' },
      { label: 'Search All', href: '/supply-runs/search' },
    ],
  },
  {
    icon: '👥',
    label: 'Employee Roster',
    href: '/roster',
    directLink: true,
    sub: [
      { label: 'New Employee', href: '/roster/new' },
      { label: 'HR Credentials', href: '/roster/hr' },
    ],
    adminOnly: false,
  },


  {
    icon: '💰',
    label: 'Payroll',
    href: '/payroll',
    directLink: true,
    sub: [{ label: 'My Payroll', href: '/payroll/my' }],
  },

  {
    icon: '⚙️',
    label: 'Admin',
    href: '/admin',
    directLink: true,
    sub: [
      { label: 'Announcements & Push', href: '/admin/announcements' },
      { label: 'Chat Requests', href: '/admin/chat-requests' },
      { label: 'Company Profile', href: '/admin/company' },
      { label: 'Analytics', href: '/analytics' },
      { label: 'External Dashboard', href: '/admin/fire-dashboard' },
      { label: 'Schedule', href: '/schedule' },
      { label: 'Coverage Calendar', href: '/schedule/calendar' },
      { label: '⚡ Generate Schedule', href: '/schedule/generate' },
      { label: 'Contacts', href: '/contacts' },
    ],
    adminOnly: true,
  },
]

const STORAGE_KEY = 'ram-sidebar-order'

function loadOrder(labels: string[]): string[] {
  if (typeof window === 'undefined') return labels
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as string[]
    // Merge: saved order first, append any new labels not yet in saved
    const merged = saved.filter(l => labels.includes(l))
    labels.forEach(l => { if (!merged.includes(l)) merged.push(l) })
    return merged
  } catch {
    return labels
  }
}

// ── Sortable nav item ────────────────────────────────────────────────────────
function SortableNavItem({
  item, isAdmin, isField, pathname, expanded, toggle, onNavigate, assignment, roleLoading, getHref, badges,
}: {
  item: NavItem & { _disabled?: boolean }
  isAdmin: boolean
  isField: boolean
  pathname: string
  expanded: string | null
  toggle: (label: string) => void
  onNavigate?: () => void
  assignment: ReturnType<typeof useUserAssignment>
  roleLoading: boolean
  getHref: (item: NavItem) => string
  badges?: Record<string, { charts: number; notes: number; mar: number; total: number }>
}) {
  const [showBadgeDetail, setShowBadgeDetail] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.label })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const isActive = pathname.startsWith(item.href)
  const isExpanded = expanded === item.label
  const href = getHref(item)

  const PRESCRIBER_ROLES = ['MD', 'MD/DO', 'PA', 'NP', 'DO']
  const visibleSub = item.sub.filter(s => {
    if (isField) {
      const adminSubs = [
        '/incidents/new', '/units/new', '/roster/new', '/roster/hr',
        '/admin', '/formulary', '/cs/audit', '/cs/receive',
        '/inventory/burnrate', '/billing', '/schedule/generate',
      ]
      if (adminSubs.some(a => s.href.startsWith(a))) return false
    }
    return true
  })

  return (
    <div ref={setNodeRef} style={style} className={item._disabled ? 'opacity-40 pointer-events-none' : ''}>
      <div className="flex items-center group">
        {/* Drag handle — subtle grip, only visible on hover */}
        <div
          {...attributes}
          {...listeners}
          className="pl-1.5 pr-0.5 py-3 cursor-grab active:cursor-grabbing text-gray-700 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity touch-none select-none"
          title="Drag to reorder"
        >
          ⠿
        </div>

        {item.directLink ? (
          // Direct-link item: label navigates, chevron toggles sub-items
          <>
            <Link
              to={href}
              onClick={onNavigate}
              style={isActive ? { color: '#fff', backgroundColor: 'var(--color-primary, #374151)' } : { color: 'var(--color-text-muted, #9ca3af)' }}
              className="flex-1 flex items-center gap-3 pl-0 py-3 text-sm font-medium transition-colors hover:opacity-80"
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
              {badges && badges[item.label] && badges[item.label].total > 0 && (
                <span className="relative">
                  <span
                    className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold leading-none cursor-default"
                    onMouseEnter={() => setShowBadgeDetail(true)}
                    onMouseLeave={() => setShowBadgeDetail(false)}
                    onClick={(e) => { e.stopPropagation(); setShowBadgeDetail(s => !s) }}
                  >
                    {badges[item.label].total > 99 ? '99+' : badges[item.label].total}
                  </span>
                  {showBadgeDetail && (
                    <span className="absolute left-0 top-full mt-1 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-2.5 whitespace-nowrap text-xs">
                      <p className="text-gray-400 font-semibold uppercase tracking-wide text-[10px] mb-1.5">Needs Signature</p>
                      {badges[item.label].charts > 0 && (
                        <p className="text-orange-300">📋 {badges[item.label].charts} chart{badges[item.label].charts !== 1 ? 's' : ''}</p>
                      )}
                      {badges[item.label].notes > 0 && (
                        <p className="text-amber-300">📝 {badges[item.label].notes} note{badges[item.label].notes !== 1 ? 's' : ''}</p>
                      )}
                      {badges[item.label].mar > 0 && (
                        <p className="text-red-300">💊 {badges[item.label].mar} MAR entr{badges[item.label].mar !== 1 ? 'ies' : 'y'}</p>
                      )}
                    </span>
                  )}
                </span>
              )}
            </Link>
            {visibleSub.length > 0 && (
              <button
                onClick={() => toggle(item.label)}
                className="pr-4 py-3 text-gray-600 hover:text-gray-400 transition-colors"
                title="Toggle sub-menu"
              >
                <span className={`text-xs transition-transform block ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
              </button>
            )}
          </>
        ) : isField && (item.href === '/incidents' || item.href === '/units') || visibleSub.length === 0 ? (
          <Link
            to={href}
            onClick={onNavigate}
            style={isActive ? { color: '#fff', backgroundColor: 'var(--color-primary, #374151)' } : { color: 'var(--color-text-muted, #9ca3af)' }}
            className={`flex-1 flex items-center gap-3 pr-4 py-3 text-sm font-medium transition-colors hover:opacity-80`}
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ) : (
          <button
            onClick={() => toggle(item.label)}
            style={isActive ? { color: '#fff', backgroundColor: 'var(--color-primary, #374151)' } : { color: 'var(--color-text-muted, #9ca3af)' }}
            className={`flex-1 flex items-center justify-between pr-4 py-3 text-sm font-medium transition-colors hover:opacity-80`}
          >
            <div className="flex items-center gap-3">
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
              {badges && badges[item.label] && badges[item.label].total > 0 && (
                <span className="relative">
                  <span
                    className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold leading-none cursor-default"
                    onMouseEnter={() => setShowBadgeDetail(true)}
                    onMouseLeave={() => setShowBadgeDetail(false)}
                    onClick={(e) => { e.stopPropagation(); setShowBadgeDetail(s => !s) }}
                  >
                    {badges[item.label].total > 99 ? '99+' : badges[item.label].total}
                  </span>
                  {showBadgeDetail && (
                    <span className="absolute left-0 top-full mt-1 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-2.5 whitespace-nowrap text-xs">
                      <p className="text-gray-400 font-semibold uppercase tracking-wide text-[10px] mb-1.5">Needs Signature</p>
                      {badges[item.label].charts > 0 && (
                        <p className="text-orange-300">📋 {badges[item.label].charts} chart{badges[item.label].charts !== 1 ? 's' : ''}</p>
                      )}
                      {badges[item.label].notes > 0 && (
                        <p className="text-amber-300">📝 {badges[item.label].notes} note{badges[item.label].notes !== 1 ? 's' : ''}</p>
                      )}
                      {badges[item.label].mar > 0 && (
                        <p className="text-red-300">💊 {badges[item.label].mar} MAR entr{badges[item.label].mar !== 1 ? 'ies' : 'y'}</p>
                      )}
                    </span>
                  )}
                </span>
              )}
            </div>
            {visibleSub.length > 0 && (
              <span className={`text-xs text-gray-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
            )}
          </button>
        )}
      </div>

      {isExpanded && (
        <div style={{ backgroundColor: 'color-mix(in srgb, var(--color-sidebar-bg, #0a0a0a) 85%, var(--color-primary, #dc2626) 5%)' }}>
          {!item.directLink && (
            <Link
              to={href}
              onClick={onNavigate}
              style={pathname === item.href ? { color: 'var(--color-primary, #f87171)' } : { color: 'var(--color-text-muted, #9ca3af)' }}
              className="flex items-center gap-2 px-10 py-2 text-xs transition-colors hover:opacity-80"
            >
              {isField && (item.href === '/incidents' || item.href === '/units') ? 'My ' : 'View All'}
              {isField && item.href === '/incidents' ? 'Incident' : isField && item.href === '/units' ? 'Unit' : ''}
            </Link>
          )}
          {visibleSub.map(sub => (
            <Link
              key={sub.href}
              to={sub.href}
              onClick={onNavigate}
              style={pathname === sub.href ? { color: 'var(--color-primary, #f87171)' } : { color: 'var(--color-text-muted, #9ca3af)' }}
              className="flex items-center gap-2 px-10 py-2 text-xs transition-colors hover:opacity-80"
            >
              + {sub.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

type OrgBranding = { name: string; dba: string | null; logo_url: string | null }

// ── Main sidebar ─────────────────────────────────────────────────────────────
export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation()
  const pathname = location.pathname
  const { isAdmin, isField, loading: roleLoading } = useRole()
  const assignment = useUserAssignment()
  const unsignedCounts = useUnsignedCounts()
  const [org, setOrg] = useState<OrgBranding | null>(null)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('organizations')
      .select('name, dba, logo_url')
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setOrg(data as unknown as OrgBranding)
      })
  }, [])

  // Field users with no unit assignment can only access profile, roster, schedule request
  const isUnassigned = isField && !assignment.loading && !assignment.unit
  const FIELD_UNASSIGNED_ALLOWED = ['/profile', '/roster']

  const visibleNav = NAV.filter(item => {
    if (item.adminOnly && isField) return false
    // Hide most nav items for unassigned field users
    if (isUnassigned && !FIELD_UNASSIGNED_ALLOWED.some(p => item.href.startsWith(p))) return false
    return true
  }).map(item => ({
    ...item,
    _disabled: item.onlineOnly && !isOnline,
  }))
  const defaultLabels = visibleNav.map(n => n.label)

  const [order, setOrder] = useState<string[]>(defaultLabels)

  // Load saved order from localStorage after mount
  useEffect(() => {
    setOrder(loadOrder(defaultLabels))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isField]) // re-run when role resolves (field vs admin affects visible items)

  const [expanded, setExpanded] = useState<string | null>(
    visibleNav.find(n => pathname.startsWith(n.href))?.label || visibleNav[0]?.label
  )
  const toggle = (label: string) => setExpanded(prev => prev === label ? null : label)

  const getHref = (item: NavItem): string => {
    if (roleLoading || isAdmin) return item.href
    switch (item.href) {
      case '/incidents':
        return assignment.incidentUnit?.incident_id
          ? `/incidents/${assignment.incidentUnit.incident_id}`
          : '/incidents'
      case '/units':
        // Field users go straight to their unit detail, never the list
        return assignment.unit?.id ? `/units/${assignment.unit.id}` : '/profile'
      default:
        return item.href
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = order.indexOf(active.id as string)
    const newIndex = order.indexOf(over.id as string)
    const newOrder = arrayMove(order, oldIndex, newIndex)
    setOrder(newOrder)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrder)) } catch {}
  }

  // Build ordered item list
  const orderedNav = order
    .map(label => visibleNav.find(n => n.label === label))
    .filter(Boolean) as NavItem[]

  return (
    <nav
      className="flex flex-col h-full border-r"
      style={{ backgroundColor: 'var(--color-sidebar-bg, #111827)', borderColor: 'var(--color-border, #1f2937)' }}
    >
      <Link to="/" style={{ borderColor: 'var(--color-border, #1f2937)', paddingTop: 'max(env(safe-area-inset-top, 0px) + 12px, 16px)' }} className="px-4 pb-4 border-b flex items-center gap-3 hover:bg-gray-800/50 transition-colors">
        {org?.logo_url ? (
          <img
            src={org.logo_url}
            alt={org.dba ?? org.name}
            className="w-10 h-10 rounded-full object-contain bg-white p-0.5 shrink-0"
          />
        ) : (
          <img
            src="https://kfkpvazkikpuwatthtow.supabase.co/storage/v1/object/public/headshots/ram-logo.png"
            alt={import.meta.env.VITE_COMPANY_DBA || 'Remote Area Medicine'}
            className="w-10 h-10 rounded-full object-contain bg-white p-0.5 shrink-0"
          />
        )}
        <div className="min-w-0">
          <h1 className="text-sm font-bold text-white leading-tight">{org?.dba ?? org?.name ?? (import.meta.env.VITE_COMPANY_DBA || 'Remote Area Medicine')}</h1>
          <p className="text-xs text-gray-500">Field Ops</p>
        </div>
      </Link>

      <div className="flex-1 overflow-y-auto py-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            {orderedNav.map(item => (
              <SortableNavItem
                key={item.label}
                item={item}
                isAdmin={isAdmin}
                isField={isField}
                pathname={pathname}
                expanded={expanded}
                toggle={toggle}
                onNavigate={onNavigate}
                assignment={assignment}
                roleLoading={roleLoading}
                getHref={getHref}
                badges={{ 'Patient Encounters': unsignedCounts }}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <div className="border-t p-4 space-y-2" style={{ borderColor: 'var(--color-border, #1f2937)' }}>
        {!roleLoading && assignment.employee && (
          <div className="text-xs text-gray-600 truncate mb-2">
            {assignment.employee.name} · {assignment.unit?.name || 'No unit'}
          </div>
        )}
        <Link to="/documents"
          style={{ color: "var(--color-text-muted, #9ca3af)" }} className="flex items-center gap-3 text-sm hover:opacity-80 transition-colors">
          <span>📋</span> Policies & Procedures
        </Link>
        <Link to="/profile"
          style={{ color: "var(--color-text-muted, #9ca3af)" }} className="flex items-center gap-3 text-sm hover:opacity-80 transition-colors">
          <span>👤</span> My Profile
        </Link>
        {isField && (
          <Link to="/schedule/request"
            style={{ color: "var(--color-text-muted, #9ca3af)" }} className="flex items-center gap-3 text-sm hover:opacity-80 transition-colors">
            <span>📅</span> Schedule Request
          </Link>
        )}
        <button
          onClick={async () => {
            const { createClient } = await import('@/lib/supabase/client')
            const sb = createClient()
            await sb.auth.signOut()
            window.location.href = '/login'
          }}
          style={{ color: "var(--color-text-muted, #6b7280)" }} className="flex items-center gap-3 text-sm hover:opacity-70 transition-colors w-full"
        >
          <span>🚪</span> Sign Out
        </button>
      </div>
      <div className="px-4 pb-3 pt-1">
        <p className="text-[10px] text-center" style={{ color: 'var(--color-text-muted, #6b7280)' }}>FirePCR v{APP_VERSION}</p>
      </div>
    </nav>
  )
}
