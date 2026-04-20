import React from 'react'

export function NEMSISTooltip({ issues, children }: { issues: { severity: string; message: string }[]; children: React.ReactNode }) {
  const [show, setShow] = React.useState(false)
  const [tooltipPos, setTooltipPos] = React.useState({ top: 0, left: 0 })
  if (issues.length === 0) return <>{children}</>
  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const top = Math.max(8, rect.top - 8)
    const left = Math.min(rect.left, window.innerWidth - 296)
    setTooltipPos({ top, left })
    setShow(true)
  }
  return (
    <span className="relative inline-flex items-center"
      onMouseEnter={handleMouseEnter} onMouseLeave={() => setShow(false)}
      onClick={e => { e.stopPropagation(); setShow(s => !s) }}>
      {children}
      {show && typeof window !== 'undefined' && (() => (
        <span className="fixed z-[9999] w-72 bg-gray-950 border border-gray-600 rounded-xl shadow-2xl p-3 text-left"
          style={{ top: `${tooltipPos.top}px`, left: `${tooltipPos.left}px`, transform: 'translateY(-100%)', pointerEvents: 'none' }}>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">NEMSIS Issues</p>
          <ul className="space-y-1.5">
            {issues.map((w, i) => (
              <li key={i} className="flex gap-2 text-xs">
                <span className="shrink-0">{w.severity === 'error' ? '🚫' : '⚠️'}</span>
                <span className={w.severity === 'error' ? 'text-red-300' : 'text-amber-300'}>{w.message}</span>
              </li>
            ))}
          </ul>
        </span>
      ))()}
    </span>
  )
}
