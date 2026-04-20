import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'

export function StatCard({
  title,
  count,
  children,
  expandedChildren,
  viewAllHref,
  newHref,
  newLabel,
  dragHandleProps,
  cycleSpan,
  span,
}: {
  title: string
  count: number | string
  children?: React.ReactNode
  expandedChildren?: React.ReactNode
  viewAllHref?: string
  newHref?: string
  newLabel?: string
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
  cycleSpan?: () => void
  span?: number
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [overlayAnimate, setOverlayAnimate] = useState(false)
  const [originRect, setOriginRect] = useState<DOMRect | null>(null)

  const openExpanded = () => {
    if (cardRef.current) {
      setOriginRect(cardRef.current.getBoundingClientRect())
    }
    setExpanded(true)
    setOverlayVisible(true)
    requestAnimationFrame(() => requestAnimationFrame(() => setOverlayAnimate(true)))
  }

  const closeExpanded = () => {
    setOverlayAnimate(false)
    setTimeout(() => {
      setOverlayVisible(false)
      setExpanded(false)
      setOriginRect(null)
    }, 300)
  }

  const getOriginTransform = () => {
    if (!originRect) return 'scale(0.92) translateY(16px)'
    const vw = window.innerWidth
    const vh = window.innerHeight
    const targetW = Math.min(896, vw - 32)
    const targetH = Math.min(vh * 0.9, vh - 32)
    const targetX = (vw - targetW) / 2
    const targetY = (vh - targetH) / 2
    const dx = (originRect.left + originRect.width / 2) - (targetX + targetW / 2)
    const dy = (originRect.top + originRect.height / 2) - (targetY + targetH / 2)
    const scaleX = originRect.width / targetW
    const scaleY = originRect.height / targetH
    const s = Math.min(scaleX, scaleY, 0.95)
    return `translate(${dx}px, ${dy}px) scale(${s})`
  }

  // Suppress unused warning — expanded state drives overlay visibility
  void expanded

  const expandedOverlay = overlayVisible ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: overlayAnimate ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0)',
        transition: 'background-color 300ms ease-out',
      }}
      onClick={closeExpanded}
    >
      <div
        className="rounded-2xl border w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        style={{
          backgroundColor: 'var(--color-card-bg, #111827)',
          borderColor: 'var(--color-border, #1f2937)',
          transform: overlayAnimate ? 'translate(0,0) scale(1)' : getOriginTransform(),
          opacity: overlayAnimate ? 1 : 0,
          transition: 'transform 300ms cubic-bezier(0.2, 0.9, 0.3, 1), opacity 200ms ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-6 py-4 border-b" style={{ backgroundColor: 'var(--color-header-bg, #030712)', borderColor: 'var(--color-border, #1f2937)' }}>
          <h2 className="text-sm font-bold text-white flex-1">{title}</h2>
          <span className="text-xl font-bold text-white mr-2">{count}</span>
          <button onClick={closeExpanded} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {expandedChildren || children}
        </div>
        <div className="px-6 py-3 border-t theme-border flex items-center gap-2">
          {viewAllHref && (
            <Link to={viewAllHref} className="text-xs text-gray-400 hover:text-white transition-colors">View all →</Link>
          )}
          <div className="flex-1" />
          {newHref && (
            <Link to={newHref} className="text-xs px-2.5 py-1 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors">{newLabel || '+ New'}</Link>
          )}
          <button onClick={closeExpanded} className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg">Close</button>
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      {expandedOverlay}
      <div ref={cardRef} className="theme-card rounded-xl border overflow-hidden flex flex-col flex-1">
        <div className="flex items-center gap-2 px-4 py-3 border-b theme-card-header">
          {dragHandleProps && (
            <div
              {...dragHandleProps}
              className="text-gray-600 hover:text-gray-300 cursor-grab active:cursor-grabbing transition-colors shrink-0 opacity-0 group-hover:opacity-100 select-none"
              title="Drag to reorder"
            >
              ⠿
            </div>
          )}
          {cycleSpan && (
            <button onClick={cycleSpan} title={`Column span: ${span || 3}/3 — click to cycle`}
              className="text-gray-600 hover:text-gray-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity select-none shrink-0 hidden md:inline-block">
              {`${span || 3}/3`}
            </button>
          )}
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex-1">{title}</h3>
          <span className="text-2xl font-bold text-white">{count}</span>
          {(expandedChildren || children) && (
            <button
              onClick={openExpanded}
              className="ml-1 text-gray-500 hover:text-white transition-colors text-sm"
              title="Expand"
            >
              ⤢
            </button>
          )}
        </div>
        {children && (
          <div className="divide-y divide-gray-800/60 overflow-y-auto flex-1">
            {children}
          </div>
        )}
        <div className="flex items-center gap-2 px-4 py-2 theme-card-footer mt-auto">
          {viewAllHref && (
            <Link to={viewAllHref} className="text-xs text-gray-400 hover:text-white transition-colors">
              View all →
            </Link>
          )}
          <div className="flex-1" />
          {newHref && (
            <Link to={newHref} className="text-xs px-2.5 py-1 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors">
              {newLabel || '+ New'}
            </Link>
          )}
        </div>
      </div>
    </>
  )
}
