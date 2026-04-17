import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useRole } from '@/lib/useRole'
import { useUnsignedCounts } from '@/lib/useUnsignedPCRCount'

type Tab = {
  icon: string
  label: string
  href: string
  adminOnly?: boolean
  subItems?: { label: string; href: string }[]
}

const TABS: Tab[] = [
  {
    icon: '🔥',
    label: 'Incidents',
    href: '/incidents',
    subItems: [
      { label: 'New Incident', href: '/incidents/new' },
      { label: 'All 214 Logs', href: '/ics214' },
      { label: 'New ICS 214', href: '/ics214/new' },
    ],
  },
  {
    icon: '📋',
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
    icon: '🔐',
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
    icon: '📦',
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
    icon: '👥',
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
    icon: '•••',
    label: 'More',
    href: '/more',
    subItems: [
      { label: '🚑 Units', href: '/units' },
      { label: '📊 Analytics', href: '/analytics' },
      { label: '📅 Schedule', href: '/schedule' },
      { label: '💰 Payroll', href: '/payroll' },
      { label: '📇 Contacts', href: '/contacts' },
      { label: '📋 Documents', href: '/documents' },
      { label: '👤 Profile', href: '/profile' },
      { label: '⚙️ Admin', href: '/admin' },
    ],
  },
]

export default function BottomTabBar() {
  const location = useLocation()
  const pathname = location.pathname
  const { isField } = useRole()
  const unsignedCounts = useUnsignedCounts()
  const [sheetTab, setSheetTab] = useState<string | null>(null)

  const visibleTabs = TABS.filter(tab => {
    if (tab.adminOnly && isField) return false
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

  return (
    <>
      {/* Bottom sheet overlay */}
      {sheetTab && (
        <div
          className="fixed inset-0 z-[55] bg-black/50 md:hidden"
          onClick={() => setSheetTab(null)}
        />
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
              className="flex items-center gap-3 px-5 py-3 text-sm text-gray-300 hover:bg-gray-800/60 transition-colors"
            >
              <span>{activeSheet.icon}</span>
              <span>View All {activeSheet.label}</span>
            </Link>
            {activeSheet.subItems.map(sub => (
              <Link
                key={sub.href}
                to={sub.href}
                onClick={() => setSheetTab(null)}
                className="flex items-center gap-3 px-5 py-3 text-sm text-gray-400 hover:bg-gray-800/60 transition-colors"
              >
                <span className="text-gray-600">›</span>
                <span>{sub.label}</span>
              </Link>
            ))}
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
            const badge = tab.href === '/encounters' && unsignedCounts.total > 0
              ? unsignedCounts.total
              : null

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
                    <span className="text-xl leading-none">{tab.icon === '•••' ? '⋯' : tab.icon}</span>
                    <span className="text-[10px] font-medium leading-none">{tab.label}</span>
                  </Link>
                ) : (
                  <>
                    <span className="text-xl leading-none">{tab.icon === '•••' ? '⋯' : tab.icon}</span>
                    <span className="text-[10px] font-medium leading-none">{tab.label}</span>
                  </>
                )}
                {badge && (
                  <span className="absolute top-1 right-1/4 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-orange-500 text-white text-[9px] font-bold leading-none">
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
