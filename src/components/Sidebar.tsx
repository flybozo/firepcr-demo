import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { APP_VERSION } from '@/components/VersionNotifier'
import { usePermission, useAnyPermission, usePermissionLoading } from '@/hooks/usePermission'
import { brand } from '@/lib/branding.config'
import { createClient } from '@/lib/supabase/client'
import { useUnsignedCounts } from '@/lib/useUnsignedPCRCount'
import { useChatUnread } from '@/hooks/useChatUnread'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SidebarIcon, RAINBOW_ICON_COLORS } from './SidebarIcons'
import { useTheme } from './ThemeProvider'
import { BadgePopover } from './BadgePopover'

type SubItem = { label: string; href: string }
type NavItem = { icon: string; label: string; href: string; sub: SubItem[]; adminOnly?: boolean; onlineOnly?: boolean; directLink?: boolean }

const NAV: NavItem[] = [
  {
    icon: 'incidents',
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
    icon: 'encounters',
    label: 'Encounters',
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
    icon: 'units',
    label: 'Units',
    href: '/units',
    directLink: true,
    sub: [
      { label: 'Add New Unit', href: '/units/new' },
    ],
    adminOnly: false,
  },
  {
    icon: 'inventory',
    label: 'Inventory',
    href: '/inventory',
    directLink: true,
    sub: [
      { label: 'Add Inventory', href: '/inventory/add' },
      { label: 'Formulary Templates', href: '/formulary' },
      { label: 'Reorder Report', href: '/inventory/reorder' },
      { label: 'Burn Rate', href: '/inventory/burnrate' },
      { label: 'Itemized Billing', href: '/billing' },
    ],
  },
  {
    icon: 'cs',
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
    icon: 'supply',
    label: 'Supply Runs',
    href: '/supply-runs',
    directLink: true,
    sub: [
      { label: 'New Supply Run', href: '/supply-runs/new' },
      { label: 'Search All', href: '/supply-runs/search' },
    ],
  },
  {
    icon: 'roster',
    label: 'Employee Roster',
    href: '/roster',
    directLink: true,
    sub: [
      { label: 'HR Credentials', href: '/roster/hr' },
      { label: 'Pay Rates', href: '/roster/pay-rates' },
    ],
    adminOnly: false,
  },
  {
    icon: 'chat',
    label: 'Team Chat',
    href: '/chat',
    directLink: true,
    sub: [],
    adminOnly: false,
  },
  {
    icon: 'payroll',
    label: 'Payroll',
    href: '/payroll',
    directLink: true,
    sub: [{ label: 'My Payroll', href: '/payroll/my' }],
  },
  {
    icon: 'map',
    label: 'Live Map',
    href: '/map',
    directLink: true,
    sub: [],
    adminOnly: true,
  },
  {
    icon: 'admin',
    label: 'Admin',
    href: '/admin',
    directLink: true,
    sub: [
      { label: 'Announcements & Push', href: '/admin/announcements' },
      { label: 'AI Requests', href: '/admin/chat-requests' },
      { label: 'Company Profile', href: '/admin/company' },
      { label: 'Analytics', href: '/analytics' },
      { label: 'Financial', href: '/admin/financial' },
      { label: 'External Dashboard', href: '/admin/fire-dashboard' },
      { label: 'Schedule', href: '/schedule' },
      { label: 'Coverage Calendar', href: '/schedule/calendar' },
      { label: 'Generate Schedule', href: '/schedule/generate' },
      { label: 'Contacts', href: '/contacts' },
      { label: 'Roles & Permissions', href: '/admin/roles' },
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
  item, isAdmin, isField, pathname, expanded, toggle, onNavigate, assignment, roleLoading, getHref, badges, isRainbow, sidebarText, chatUnread,
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
  isRainbow?: boolean
  sidebarText?: { inactive: string; muted: string }
  chatUnread?: number
}) {
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

  // Icon color: rainbow = per-icon color always, others = primary when active
  const iconColor = isRainbow
    ? (RAINBOW_ICON_COLORS[item.icon] || 'var(--color-primary, #dc2626)')
    : (isActive ? 'var(--color-primary, #dc2626)' : undefined)

  const PRESCRIBER_ROLES = ['MD', 'DO', 'PA', 'NP']
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
              className={`flex-1 flex items-center gap-3 pl-2.5 py-2.5 text-sm font-medium rounded-lg mx-1 transition-all duration-150 ${
                isActive
                  ? 'text-white'
                  : 'hover:bg-white/[0.04]'
              }`}
              style={{
                color: isActive ? '#fff' : (sidebarText?.inactive || 'var(--color-text-muted, #9ca3af)'),
                ...(isActive ? {
                  backgroundColor: 'color-mix(in srgb, var(--color-primary, #374151) 15%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-primary, #374151) 30%, transparent)',
                } : {}),
              }}
            >
              <span className={`w-6 h-6 shrink-0 flex items-center justify-center transition-colors ${isActive || isRainbow ? 'opacity-100' : 'opacity-50'}`} style={iconColor ? { color: iconColor } : {}}>
                <SidebarIcon name={item.icon} />
              </span>
              <span>{item.label}</span>
              {badges && badges[item.label] && badges[item.label].total > 0 && (
                <BadgePopover badge={badges[item.label]} />
              )}
              {item.icon === 'chat' && chatUnread && chatUnread > 0 ? (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold leading-none">
                  {chatUnread > 99 ? '99+' : chatUnread}
                </span>
              ) : null}
            </Link>
            {visibleSub.length > 0 && (
              <button
                onClick={() => toggle(item.label)}
                className="pr-4 py-3 text-gray-600 hover:text-gray-400 transition-colors"
                title="Toggle sub-menu"
              >
                <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            )}
          </>
        ) : isField && (item.href === '/incidents' || item.href === '/units') || visibleSub.length === 0 ? (
          <Link
            to={href}
            onClick={onNavigate}
            className={`flex-1 flex items-center gap-3 pl-2.5 pr-4 py-2.5 text-sm font-medium rounded-lg mx-1 transition-all duration-150 ${
              isActive
                ? 'text-white'
                : 'hover:bg-white/[0.04]'
            }`}
            style={{
              color: isActive ? '#fff' : (sidebarText?.inactive || 'var(--color-text-muted, #9ca3af)'),
              ...(isActive ? {
                backgroundColor: 'color-mix(in srgb, var(--color-primary, #374151) 15%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-primary, #374151) 30%, transparent)',
              } : {}),
            }}
          >
            <span className={`w-6 h-6 shrink-0 flex items-center justify-center transition-colors ${isActive || isRainbow ? 'opacity-100' : 'opacity-50'}`} style={iconColor ? { color: iconColor } : {}}>
              <SidebarIcon name={item.icon} />
            </span>
            <span>{item.label}</span>
            {item.icon === 'chat' && chatUnread && chatUnread > 0 ? (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold leading-none">
                {chatUnread > 99 ? '99+' : chatUnread}
              </span>
            ) : null}
          </Link>
        ) : (
          <button
            onClick={() => toggle(item.label)}
            className={`flex-1 flex items-center justify-between pl-2.5 pr-4 py-2.5 text-sm font-medium rounded-lg mx-1 transition-all duration-150 ${
              isActive
                ? 'text-white'
                : 'hover:bg-white/[0.04]'
            }`}
            style={{
              color: isActive ? '#fff' : (sidebarText?.inactive || 'var(--color-text-muted, #9ca3af)'),
              ...(isActive ? {
                backgroundColor: 'color-mix(in srgb, var(--color-primary, #374151) 15%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-primary, #374151) 30%, transparent)',
              } : {}),
            }}
          >
            <div className="flex items-center gap-3">
              <span className={`w-6 h-6 shrink-0 flex items-center justify-center transition-colors ${isActive || isRainbow ? 'opacity-100' : 'opacity-50'}`} style={iconColor ? { color: iconColor } : {}}>
                <SidebarIcon name={item.icon} />
              </span>
              <span>{item.label}</span>
              {badges && badges[item.label] && badges[item.label].total > 0 && (
                <BadgePopover badge={badges[item.label]} />
              )}
            </div>
            {visibleSub.length > 0 && (
              <svg className={`w-4 h-4 text-gray-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            )}
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="ml-[42px] mr-3 mb-1 pl-2 border-l border-white/[0.06] rounded-bl-lg">
          {!item.directLink && (
            <Link
              to={href}
              onClick={onNavigate}
              className={`block py-1.5 px-3 text-[13px] rounded-md transition-all duration-150 ${
                pathname === item.href ? '' : 'hover:bg-white/[0.04]'
              }`}
              style={pathname === item.href ? { color: 'var(--color-primary, #f87171)' } : { color: sidebarText?.muted || 'var(--color-text-muted, #6b7280)' }}
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
              className={`block py-1.5 px-3 text-[13px] rounded-md transition-all duration-150 ${
                pathname === sub.href ? '' : 'hover:bg-white/[0.04]'
              }`}
              style={pathname === sub.href ? { color: 'var(--color-primary, #f87171)' } : { color: sidebarText?.muted || 'var(--color-text-muted, #6b7280)' }}
            >
              {sub.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

type OrgBranding = { name: string; dba: string | null; logo_url: string | null }

// Detect if sidebar needs light text (dark sidebar bg on light-page themes like Patriot)
function getSidebarTextColors(): { inactive: string; muted: string } {
  if (typeof document === 'undefined') return { inactive: 'var(--color-text-muted, #9ca3af)', muted: 'var(--color-text-muted, #6b7280)' }
  const sidebarBg = getComputedStyle(document.documentElement).getPropertyValue('--color-sidebar-bg').trim()
  if (!sidebarBg || !sidebarBg.startsWith('#') || sidebarBg.length < 7) return { inactive: 'var(--color-text-muted, #9ca3af)', muted: 'var(--color-text-muted, #6b7280)' }
  const hex = sidebarBg.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  if (luminance < 0.45) return { inactive: '#b0b0c8', muted: '#8080a0' }
  return { inactive: 'var(--color-text-muted, #9ca3af)', muted: 'var(--color-text-muted, #6b7280)' }
}

// ── Main sidebar ─────────────────────────────────────────────────────────────
export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation()
  const pathname = location.pathname
  const roleLoading = usePermissionLoading()
  const canAdmin = useAnyPermission('admin.settings', 'admin.push', 'admin.analytics')
  const canBilling = usePermission('billing.view')
  const canPayroll = usePermission('payroll.view_all')
  const canRoster = usePermission('roster.manage')
  const assignment = useUserAssignment()
  const unsignedCounts = useUnsignedCounts()
  const { totalUnread: chatUnread } = useChatUnread()
  const { theme } = useTheme()
  const isRainbow = theme.preset === 'rainbow'
  const sidebarText = getSidebarTextColors()
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
  const isUnassigned = !canAdmin && !assignment.loading && !assignment.unit
  const FIELD_UNASSIGNED_ALLOWED = ['/profile', '/roster']

  const visibleNav = NAV.filter(item => {
    if (item.adminOnly && !canAdmin) return false
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
  }, [canAdmin]) // re-run when role resolves (field vs admin affects visible items)

  const [expanded, setExpanded] = useState<string | null>(
    visibleNav.find(n => pathname.startsWith(n.href))?.label || visibleNav[0]?.label
  )
  const toggle = (label: string) => setExpanded(prev => prev === label ? null : label)

  const getHref = (item: NavItem): string => {
    if (roleLoading || canAdmin) return item.href
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
      className="flex flex-col h-full"
      style={{ backgroundColor: 'var(--color-sidebar-bg, #111827)' }}
    >
      <Link to="/" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px) + 12px, 16px)' }} className="px-4 pb-4 mb-2 flex items-center gap-3 hover:bg-white/[0.04] transition-colors rounded-b-xl">
        {org?.logo_url ? (
          <img
            src={org.logo_url}
            alt={org.dba ?? org.name}
            className="w-10 h-10 rounded-full object-contain bg-white p-0.5 shrink-0"
          />
        ) : (
          <img
            src="https://kfkpvazkikpuwatthtow.supabase.co/storage/v1/object/public/headshots/ram-logo.png"
            alt={brand.companyName}
            className="w-10 h-10 rounded-full object-contain bg-white p-0.5 shrink-0"
          />
        )}
        <div className="min-w-0">
          <h1 className="text-sm font-bold text-white leading-tight">{org?.dba ?? org?.name ?? brand.companyName}</h1>
          <p className="text-xs text-gray-500">Field Ops</p>
        </div>
      </Link>

      {/* Breadcrumb removed — was taking up too much space on small screens */}

      <div className="flex-1 overflow-y-auto py-3 space-y-1">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            {orderedNav.map(item => (
              <SortableNavItem
                key={item.label}
                item={item}
                isAdmin={canAdmin}
                isField={!canAdmin}
                pathname={pathname}
                expanded={expanded}
                toggle={toggle}
                onNavigate={onNavigate}
                assignment={assignment}
                roleLoading={roleLoading}
                getHref={getHref}
                badges={{ 'Encounters': unsignedCounts }}
                chatUnread={chatUnread}
                isRainbow={isRainbow}
                sidebarText={sidebarText}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <div className="mt-2 px-3 py-2 space-y-0.5 border-t border-white/[0.06] mx-2 rounded-t-lg">
        {!roleLoading && assignment.employee && (
          <div className="flex items-center justify-between px-2 py-1">
            <div className="text-xs truncate" style={{ color: sidebarText.muted }}>
              {assignment.employee.name} · {assignment.unit?.name || 'No unit'}
            </div>
            <button className="relative p-0.5 rounded-md hover:bg-white/[0.06] transition-colors" style={{ color: sidebarText.inactive }} title="Notifications">
              <span className="w-4 h-4 flex items-center justify-center opacity-60"><SidebarIcon name="bell" /></span>
            </button>
          </div>
        )}
        <Link to="/documents"
          style={{ color: sidebarText.inactive }} className="flex items-center gap-2 py-1 px-2 rounded-lg text-xs hover:bg-white/[0.04] transition-all duration-150">
          <span className="w-5 h-5 shrink-0 flex items-center justify-center opacity-50" style={isRainbow ? { color: RAINBOW_ICON_COLORS.documents, opacity: 1 } : {}}><SidebarIcon name="documents" /></span> Policies & Procedures
        </Link>
        <Link to="/profile"
          style={{ color: sidebarText.inactive }} className="flex items-center gap-2 py-1 px-2 rounded-lg text-xs hover:bg-white/[0.04] transition-all duration-150">
          <span className="w-5 h-5 shrink-0 flex items-center justify-center opacity-50" style={isRainbow ? { color: RAINBOW_ICON_COLORS.profile, opacity: 1 } : {}}><SidebarIcon name="profile" /></span> My Profile
        </Link>
        {!canAdmin && (
          <Link to="/schedule/request"
            style={{ color: sidebarText.inactive }} className="flex items-center gap-2 py-1 px-2 rounded-lg text-xs hover:bg-white/[0.04] transition-all duration-150">
            <span className="w-5 h-5 shrink-0 flex items-center justify-center opacity-50" style={isRainbow ? { color: RAINBOW_ICON_COLORS.schedule, opacity: 1 } : {}}><SidebarIcon name="schedule" /></span> Schedule Request
          </Link>
        )}
        <button
          onClick={async () => {
            const { createClient } = await import('@/lib/supabase/client')
            const sb = createClient()
            await sb.auth.signOut()
            window.location.href = '/login'
          }}
          style={{ color: sidebarText.muted }} className="flex items-center gap-2 py-1 px-2 rounded-lg text-xs hover:bg-white/[0.04] transition-all duration-150 w-full"
        >
          <span className="w-5 h-5 shrink-0 flex items-center justify-center opacity-50" style={isRainbow ? { color: RAINBOW_ICON_COLORS.logout, opacity: 1 } : {}}><SidebarIcon name="logout" /></span> Sign Out
        </button>
        <p className="text-[10px] text-center pt-0.5" style={{ color: sidebarText.muted }}>{brand.appBrand} v{APP_VERSION}</p>
      </div>
    </nav>
  )
}
