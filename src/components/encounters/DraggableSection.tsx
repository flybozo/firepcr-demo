import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const ENC_COL_SPAN_CLASSES: Record<number, string> = {
  1: 'col-span-1',
  2: 'col-span-1 md:col-span-2',
}

export function DraggableSection({ id, children, colSpan = 2, onCycleSpan }: {
  id: string; children: React.ReactNode; colSpan?: 1 | 2; onCycleSpan?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const cardRef = React.useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = React.useState(false)
  const [overlayVisible, setOverlayVisible] = React.useState(false)
  const [overlayAnimate, setOverlayAnimate] = React.useState(false)
  const [originRect, setOriginRect] = React.useState<DOMRect | null>(null)

  const openExpanded = () => {
    if (cardRef.current) setOriginRect(cardRef.current.getBoundingClientRect())
    setExpanded(true)
    setOverlayVisible(true)
    requestAnimationFrame(() => requestAnimationFrame(() => setOverlayAnimate(true)))
  }

  const closeExpanded = () => {
    setOverlayAnimate(false)
    setTimeout(() => { setOverlayVisible(false); setExpanded(false); setOriginRect(null) }, 300)
  }

  const getOriginTransform = () => {
    if (!originRect) return 'scale(0.92) translateY(16px)'
    const vw = window.innerWidth, vh = window.innerHeight
    const targetW = Math.min(896, vw - 32)
    const targetH = Math.min(vh * 0.9, vh - 32)
    const targetX = (vw - targetW) / 2, targetY = (vh - targetH) / 2
    const dx = (originRect.left + originRect.width / 2) - (targetX + targetW / 2)
    const dy = (originRect.top + originRect.height / 2) - (targetY + targetH / 2)
    const s = Math.min(originRect.width / targetW, originRect.height / targetH, 0.95)
    return `translate(${dx}px, ${dy}px) scale(${s})`
  }

  // suppress unused warning — expanded is consumed by overlay visibility
  void expanded

  return (
    <div ref={setNodeRef} style={style} className={`min-w-0 h-full ${ENC_COL_SPAN_CLASSES[colSpan] || 'col-span-1 md:col-span-2'}`}>
      {overlayVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: overlayAnimate ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0)', transition: 'background-color 300ms ease-out' }}
          onClick={closeExpanded}
        >
          <div
            className="theme-card rounded-2xl border w-full max-w-4xl min-h-[60vh] max-h-[90vh] flex flex-col overflow-hidden"
            style={{
              transform: overlayAnimate ? 'translate(0,0) scale(1)' : getOriginTransform(),
              opacity: overlayAnimate ? 1 : 0,
              transition: 'transform 300ms cubic-bezier(0.2, 0.9, 0.3, 1), opacity 200ms ease-out',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b theme-card-header">
              <h2 className="text-sm font-bold text-white flex-1 uppercase tracking-wider">{id.replace(/-/g, ' ')}</h2>
              <button onClick={closeExpanded} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-1">
              {children}
            </div>
          </div>
        </div>
      )}
      <div ref={cardRef} className="group relative min-w-0 h-full">
        <div className="absolute -left-4 top-3 flex flex-col items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <div
            {...attributes}
            {...listeners}
            className="text-gray-700 hover:text-gray-400 cursor-grab active:cursor-grabbing select-none text-sm"
            title="Drag to reorder"
          >⠿</div>
          {onCycleSpan && (
            <button
              onClick={onCycleSpan}
              className="text-gray-700 hover:text-gray-400 text-[10px] select-none"
              title={`Width: ${colSpan}/2 — click to toggle`}
            >
              {colSpan === 1 ? '◧' : '◣'}
            </button>
          )}
        </div>
        <button
          onClick={openExpanded}
          className="absolute top-2 right-2 text-gray-600 hover:text-white transition-colors text-lg w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-800 opacity-0 group-hover:opacity-100 z-10"
          title="Expand"
        >
          ⤢
        </button>
        {children}
      </div>
    </div>
  )
}
