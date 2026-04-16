/**
 * SplitPane — master-detail layout for desktop.
 *
 * On lg+ screens: left panel (40%) shows the list, right panel (60%) shows
 * the selected detail. Clicking a row sets selectedId; clicking another row
 * swaps the detail. An X button closes the detail panel, returning to full-
 * width list view.
 *
 * On mobile (< lg): the split is not rendered — list pages fall back to
 * full-screen navigation via React Router as before.
 *
 * Usage:
 *   <SplitPane
 *     selectedId={selectedId}
 *     onClose={() => setSelectedId(null)}
 *     detail={<EncounterDetail id={selectedId} embedded />}
 *   >
 *     {/* list content here *\/}
 *   </SplitPane>
 */

import type { ReactNode } from 'react'

interface SplitPaneProps {
  /** The currently selected item id, or null for no selection */
  selectedId: string | null
  /** Called when the user clicks X to close the detail panel */
  onClose: () => void
  /** The detail component to render in the right panel */
  detail: ReactNode
  /** The list content for the left panel */
  children: ReactNode
  /** Left panel width class — default 'lg:w-2/5' */
  leftWidth?: string
}

export default function SplitPane({ selectedId, onClose, detail, children, leftWidth = 'lg:w-2/5' }: SplitPaneProps) {
  return (
    // On mobile: just render children (list) fullscreen — detail navigation
    // is handled by the list page's onClick → navigate() path.
    // On lg+: flex row with left list + right detail panel.
    <div className="flex h-full w-full">
      {/* Left: list panel */}
      <div className={`
        flex flex-col min-h-0 overflow-y-auto w-full
        ${selectedId ? `lg:${leftWidth.replace('lg:', '')} lg:border-r lg:border-gray-800` : 'lg:w-full'}
        transition-all duration-200
      `}>
        {children}
      </div>

      {/* Right: detail panel — hidden on mobile, shown on lg+ when selectedId is set */}
      {selectedId && (
        <div className="hidden lg:flex lg:flex-col lg:flex-1 lg:min-h-0 lg:overflow-y-auto relative bg-gray-950">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            title="Close detail"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          {detail}
        </div>
      )}
    </div>
  )
}
