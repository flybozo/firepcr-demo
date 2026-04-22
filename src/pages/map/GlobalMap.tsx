import { lazy, Suspense } from 'react'
import OfflineGate from '@/components/OfflineGate'

const UnitMap = lazy(() => import('@/components/maps/UnitMap'))

export default function GlobalMapPage() {
  return (
    <OfflineGate page message="Live Map requires a connection to display unit locations.">
    <div className="flex flex-col bg-gray-950 text-white" style={{ height: '100%', minHeight: 0 }}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 shrink-0">
        <h1 className="text-lg font-bold text-white">Live Map</h1>
        <span className="text-xs text-gray-500 ml-auto">All active incidents · updates every 60s</span>
      </div>
      <div className="flex-1 min-h-0">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-64">
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <UnitMap height="100%" />
        </Suspense>
      </div>
    </div>
    </OfflineGate>
  )
}
