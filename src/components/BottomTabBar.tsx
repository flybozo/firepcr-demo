import { Link, useLocation, useNavigate } from 'react-router-dom'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { useRole } from '@/lib/useRole'
import { useUnsignedCounts } from '@/lib/useUnsignedPCRCount'
import { useChatUnread } from '@/hooks/useChatUnread'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { SidebarIcon } from './SidebarIcons'

type SubItem = { label: string; href: string; icon?: string; adminOnly?: boolean; fieldOnly?: boolean }

type Tab = {
  icon: string      // SidebarIcon name for the tab bar
  label: string
  href: string
  adminOnly?: boolean
  subItems?: SubItem[]
}

const TABS: Tab[] = [
  {
    icon: 'incidents',
    label: 'Incidents',
    href: '/incidents',
    subItems: [
      { label: 'New Incident', href: '/incidents/new' },
      { label: 'All 214 Logs', href: '/ics214' },
      { label: 'New ICS 214', href: '/ics214/new' },
    ],
  },
  {
    icon: 'encounters',
    label: 'Encounters',
    href: '/encounters',
    subItems: [
      { label: 'New Encounter', href: '/encounters/new' },
      { label: 'Unsigned Items', href: '/unsigned-items' },
      { label: 'Patient Search', href: '/patient-search' },
      { label: 'MAR', href: '/mar' },
    ],
  },
  {
    icon: 'cs',
    label: 'CS',
    href: '/cs',
    subItems: [
      { label: 'CS Overview', href: '/cs' },
      { label: 'Receive CS', href: '/cs/receive' },
      { label: 'Transfer CS', href: '/cs/transfer' },
      { label: 'Daily Count', href: '/cs/count' },
      { label: 'Audit Log', href: '/cs/audit' },
    ],
  },
  {
    icon: 'inventory',
    label: 'Supply',
    href: '/inventory',
    subItems: [
      { label: 'Inventory', href: '/inventory' },
      { label: 'Add Inventory', href: '/inventory/add' },
      { label: 'Supply Runs', href: '/supply-runs' },
      { label: 'New Run', href: '/supply-runs/new' },
    ],
  },
  {
    icon: 'roster',
    label: 'Roster',
    href: '/roster',
    adminOnly: true,
    subItems: [
      { label: 'Employee Roster', href: '/roster' },
      { label: 'New Employee', href: '/roster/new' },
      { label: 'HR Credentials', href: '/roster/hr' },
    ],
  },
  {
    icon: 'more',
    label: 'More',
    href: '/more',
    subItems: [
      { label: 'Units', href: '/units', icon: 'units' },
      { label: 'Analytics', href: '/analytics', icon: 'analytics' },
      { label: 'External Dashboard', href: '/admin/fire-dashboard', icon: 'fire-dashboard' },
      { label: 'Payroll', href: '/payroll', icon: 'payroll' },
      { label: 'Documents', href: '/documents', icon: 'documents' },
      { label: 'Chat', href: '/chat', icon: 'chat' },
      { label: 'Profile', href: '/profile', icon: 'profile' },
      { label: 'Schedule Request', href: '/schedule/request', icon: 'schedule', fieldOnly: true },
      { label: 'Admin', href: '/admin', icon: 'admin', adminOnly: true },
    ],
  },
]

// Admin sub-items for the second-level sheet
const ADMIN_SUB_ITEMS: SubItem[] = [
  { label: 'Announcements & Push', href: '/admin/announcements', icon: 'announcements' },
  { label: 'Chat Requests', href: '/admin/chat-requests', icon: 'chat-requests' },
  { label: 'Company Profile', href: '/admin/company', icon: 'company' },
  { label: 'Analytics', href: '/analytics', icon: 'analytics' },
  { label: 'Financial', href: '/admin/financial', icon: 'financial' },
  { label: 'External Dashboard', href: '/admin/fire-dashboard', icon: 'fire-dashboard' },
  { label: 'Schedule', href: '/schedule', icon: 'schedule' },
  { label: 'Coverage Calendar', href: '/schedule/calendar', icon: 'calendar' },
  { label: 'Generate Schedule', href: '/schedule/generate', icon: 'generate' },
  { label: 'Contacts', href: '/contacts', icon: 'contacts' },
]

export default function BottomTabBar() {
  const location = useLocation()
  const pathname = location.pathname
  const { isField } = useRole()
  const unsignedCounts = useUnsignedCounts()
  const { totalUnread: chatUnread } = useChatUnread()
  const [sheetTab, setSheetTab] = useState<string | null>(null)
  const [showAdminSheet, setShowAdminSheet] = useState(false)
  const navigate = useNavigate()

  const assignment = useUserAssignment()
  const isUnassigned = isField && !assignment.loading && !assignment.unit
  const UNASSIGNED_ALLOWED_HREFS = ['/profile', '/roster', '/schedule/request']

  const visibleTabs = TABS.filter(tab => {
    if (tab.adminOnly && isField) return false
    // Hide most tabs for unassigned field users
    if (isUnassigned && !UNASSIGNED_ALLOWED_HREFS.some(p => tab.href.startsWith(p))) return false
    return true
  })

  const handleTabPress = (tab: Tab) => {
    if (tab.subItems && tab.subItems.length > 0) {
      setSheetTab(prev => (prev === tab.label ? null : tab.label))
    } else {
      setSheetTab(null)
    }
  }

  const activeSheet = visibleTabs.find(t => t.label === sheetTab)

  const closeAll = () => {
    setSheetTab(null)
    setShowAdminSheet(false)
  }

  return (
    <>
      {/* Bottom sheet overlay */}
      {(sheetTab || showAdminSheet) && (
        <div
          className="fixed inset-0 z-[55] bg-black/50 md:hidden"
          onClick={closeAll}
        />
      )}

      {/* Admin second-level sheet */}
      {showAdminSheet && (
        <div
          className="fixed bottom-[calc(56px+env(safe-area-inset-bottom,0px))] left-0 right-0 z-[65] md:hidden rounded-t-2xl border-t border-gray-700 shadow-2xl"
          style={{ backgroundColor: 'var(--color-sidebar-bg, #111827)' }}
        >
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-600" />
          </div>
          <div className="flex items-center gap-2 px-4 py-2">
            <button
              onClick={() => { setShowAdminSheet(false); setSheetTab('More') }}
              className="text-gray-500 hover:text-gray-300 transition-colors text-sm"
            >
              ← Back
            </button>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Admin</p>
          </div>
          <div className="pb-2 overflow-y-auto max-h-[60vh]">
            <Link
              to="/admin"
              onClick={closeAll}
              className="flex items-center gap-3 px-5 py-3.5 text-base text-gray-300 hover:bg-gray-800/60 transition-colors"
            >
              <span className="w-5 h-5 flex items-center justify-center opacity-60"><SidebarIcon name="admin" /></span>
              <span>Admin Home</span>
            </Link>
            {ADMIN_SUB_ITEMS.map(sub => (
              <Link
                key={sub.href}
                to={sub.href}
                onClick={closeAll}
                className="flex items-center gap-3 px-5 py-3.5 text-base text-gray-400 hover:bg-gray-800/60 transition-colors"
              >
                <span className="w-5 h-5 flex items-center justify-center opacity-60">{sub.icon ? <SidebarIcon name={sub.icon} /> : <span className="text-gray-600">›</span>}</span>
                <span>{sub.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Bottom sheet */}
      {activeSheet && activeSheet.subItems && (
        <div
          className="fixed bottom-[calc(56px+env(safe-area-inset-bottom,0px))] left-0 right-0 z-[60] md:hidden rounded-t-2xl border-t border-gray-700 shadow-2xl"
          style={{ backgroundColor: 'var(--color-sidebar-bg, #111827)' }}
        >
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-600" />
          </div>
          <p className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
            {activeSheet.label}
          </p>
          <div className="pb-2">
            {/* Main link for the section */}
            <Link
              to={activeSheet.href === '/more' ? '#' : activeSheet.href}
              onClick={() => setSheetTab(null)}
              className="flex items-center gap-3 px-5 py-3.5 text-base text-gray-300 hover:bg-gray-800/60 transition-colors"
            >
              <span className="w-5 h-5 flex items-center justify-center"><SidebarIcon name={activeSheet.icon} /></span>
              <span>View All {activeSheet.label}</span>
            </Link>
            {activeSheet.subItems
              .filter(sub => {
                if (sub.adminOnly && isField) return false   // hide admin items from field
                if (sub.fieldOnly && !isField) return false  // hide field-only items from admin
                return true
              })
              .map(sub => {
                // Admin item opens a nested sheet instead of navigating
                if (sub.href === '/admin' && !isField) {
                  return (
                    <button
                      key={sub.href}
                      onClick={() => { setSheetTab(null); setShowAdminSheet(true) }}
                      className="flex items-center gap-3 px-5 py-3.5 text-base text-gray-400 hover:bg-gray-800/60 transition-colors w-full text-left"
                    >
                      <span className="w-5 h-5 flex items-center justify-center opacity-60">{sub.icon ? <SidebarIcon name={sub.icon} /> : <span className="text-gray-600">›</span>}</span>
                      <span>{sub.label}</span>
                      <span className="ml-auto text-gray-600 text-xs">›</span>
                    </button>
                  )
                }
                // Units: field users go to their own unit
                const href = sub.href === '/units' && isField && assignment.unit?.id
                  ? `/units/${assignment.unit.id}`
                  : sub.href
                return (
                  <Link
                    key={sub.href}
                    to={href}
                    onClick={() => setSheetTab(null)}
                    className="flex items-center gap-3 px-5 py-3.5 text-base text-gray-400 hover:bg-gray-800/60 transition-colors"
                  >
                    <span className="w-5 h-5 flex items-center justify-center opacity-60">{sub.icon ? <SidebarIcon name={sub.icon} /> : <span className="text-gray-600">›</span>}</span>
                    <span>{sub.label}</span>
                    {sub.href === '/chat' && chatUnread > 0 && (
                      <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold leading-none">
                        {chatUnread > 99 ? '99+' : chatUnread}
                      </span>
                    )}
                  </Link>
                )
              })}
            {activeSheet.label === 'More' && (
              <button
                onClick={async () => {
                  setSheetTab(null)
                  const supabase = createClient()
                  await supabase.auth.signOut()
                  navigate('/login')
                }}
                className="flex items-center gap-3 px-5 py-3.5 text-base text-red-400 hover:bg-gray-800/60 transition-colors w-full border-t border-gray-800 mt-1"
              >
                <span className="w-5 h-5 flex items-center justify-center opacity-60"><SidebarIcon name="logout" /></span>
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[50] border-t md:hidden"
        style={{
          backgroundColor: 'var(--color-sidebar-bg, #111827)',
          borderColor: 'var(--color-border, #1f2937)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          height: 'calc(56px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="flex h-14 items-stretch">
          {visibleTabs.map(tab => {
            const isActive = tab.href !== '/more' && pathname.startsWith(tab.href)
            // Badge: unsigned encounters on Encounters tab, chat unread on More tab
            const encounterBadge = tab.href === '/encounters' && unsignedCounts.total > 0
              ? unsignedCounts.total
              : null
            const moreBadge = tab.label === 'More' && chatUnread > 0
              ? chatUnread
              : null
            const badge = encounterBadge || moreBadge

            return (
              <button
                key={tab.label}
                onClick={() => handleTabPress(tab)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-opacity relative"
                style={{ color: isActive ? 'var(--color-primary, #f87171)' : 'var(--color-text-muted, #6b7280)' }}
              >
                {/* For tabs without sub-items, wrap in Link */}
                {!tab.subItems || tab.subItems.length === 0 ? (
                  <Link
                    to={tab.href}
                    className="flex flex-col items-center justify-center gap-0.5 w-full h-full"
                    style={{ color: 'inherit' }}
                  >
                    <span className="w-6 h-6 flex items-center justify-center"><SidebarIcon name={tab.icon} /></span>
                    <span className="text-xs font-medium leading-none">{tab.label}</span>
                  </Link>
                ) : (
                  <>
                    <span className="w-6 h-6 flex items-center justify-center"><SidebarIcon name={tab.icon} /></span>
                    <span className="text-xs font-medium leading-none">{tab.label}</span>
                  </>
                )}
                {badge && (
                  <span className={`absolute top-1 right-1/4 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-white text-[9px] font-bold leading-none ${moreBadge ? 'bg-red-600' : 'bg-orange-500'}`}>
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
