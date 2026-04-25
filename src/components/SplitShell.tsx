/**
 * SplitShell — master-detail split layout for desktop; transparent on mobile.
 *
 * Desktop (lg+, ≥1024px):
 *   No detail selected → list 40% left │ empty placeholder right
 *   Detail selected    → list 40% left │ detail 60% right (scrollable)
 *                        X button closes detail, navigates to basePath
 *                        Clicking another row swaps the right panel
 *
 * Mobile (< lg):
 *   No detail selected → list fills full screen
 *   Detail selected    → detail fills full screen (list unmounted)
 *   Back link inside detail pages works normally
 *
 * Route wiring in App.tsx — make detail a child of list:
 *
 *   <Route path="encounters"
 *     element={<SplitShell basePath="/encounters"><EncountersList /></SplitShell>}>
 *     <Route index element={null} />           ← keeps list rendered at /encounters
 *     <Route path=":id" element={<EncounterDetail />} />
 *   </Route>
 */

import { useParams, useNavigate, Outlet, useMatch } from 'react-router-dom'
import type { ReactNode } from 'react'

interface SplitShellProps {
  basePath: string
  children: ReactNode
  /** Override the param key to check — defaults to 'id'. Use 'item' for routes like /cs/item/:id */
  detailPattern?: string
  /** List panel width on desktop. Defaults to 'w-2/5' (40%). Use 'w-1/2' for 50/50 split. */
  listWidth?: string
}

export default function SplitShell({ basePath, children, detailPattern, listWidth = 'lg:w-2/5' }: SplitShellProps) {
  const params = useParams()
  const navigate = useNavigate()
  // Support both /base/:id and /base/segment/:id patterns
  const nestedMatch = useMatch(detailPattern || `${basePath}/:id`)
  const hasDetail = !!(params.id || (detailPattern && nestedMatch))

  return (
    <div className="flex w-full min-h-full">

      {/* ── List panel ──────────────────────────────────────────────────────
          Desktop: always 40% with border, full height
          Mobile:  full screen when no detail, hidden when detail is open   */}
      <div className={[
        'flex flex-col overflow-y-auto overscroll-none',
        hasDetail
          ? `hidden lg:flex ${listWidth} lg:flex-shrink-0 lg:border-r lg:border-gray-800`
          : `w-full ${listWidth} lg:flex-shrink-0 lg:border-r lg:border-gray-800`,
      ].join(' ')}>
        {children}
      </div>

      {/* ── Detail panel ────────────────────────────────────────────────────
          Desktop: right 60%, with X close button, "← Back" links hidden
          Mobile:  full screen (list hidden above)                          */}
      {hasDetail && (
        <div className={[
          'flex flex-col overflow-y-auto relative bg-gray-950',
          'w-full lg:flex-1 overscroll-none',
        ].join(' ')}>
          {/* Close button — desktop only */}
          <button
            onClick={() => navigate(basePath)}
            className="hidden lg:flex absolute top-3 right-3 z-20 items-center justify-center w-7 h-7 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            title="Close panel"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Hide "← Back" links inside detail pages on desktop split view */}
          <style>{`
            @media (min-width: 1024px) {
              .split-detail-pane a[href$="/encounters"],
              .split-detail-pane a[href$="/mar"],
              .split-detail-pane a[href$="/units"],
              .split-detail-pane a[href$="/incidents"],
              .split-detail-pane a[href$="/roster"],
              .split-detail-pane a[href$="/supply-runs"],
              .split-detail-pane a[href$="/inventory"],
              .split-detail-pane a[href$="/formulary"],
              .split-detail-pane a[href$="/catalog"] {
                display: none !important;
              }
            }
          `}</style>

          <div className="split-detail-pane h-full overflow-y-auto pb-[calc(56px+env(safe-area-inset-bottom,0px))] md:pb-0">
            <Outlet />
          </div>
        </div>
      )}

      {/* Empty right panel — desktop only, shown when no detail selected */}
      {!hasDetail && (
        <div className="hidden lg:flex lg:flex-1 lg:items-center lg:justify-center text-gray-700 text-sm select-none">
          ← Select an item
        </div>
      )}
    </div>
  )
}
