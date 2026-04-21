import { useState } from 'react'

type BadgeCount = { charts: number; notes: number; mar: number; total: number }

interface Props {
  badge: BadgeCount
}

export function BadgePopover({ badge }: Props) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative">
      <span
        className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold leading-none cursor-default"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={(e) => { e.stopPropagation(); setShow(s => !s) }}
      >
        {badge.total > 99 ? '99+' : badge.total}
      </span>
      {show && (
        <span className="absolute left-0 top-full mt-1 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-2.5 whitespace-nowrap text-xs">
          <p className="text-gray-400 font-semibold uppercase tracking-wide text-[10px] mb-1.5">Needs Signature</p>
          {badge.charts > 0 && (
            <p className="text-orange-300">📋 {badge.charts} chart{badge.charts !== 1 ? 's' : ''}</p>
          )}
          {badge.notes > 0 && (
            <p className="text-amber-300">📝 {badge.notes} note{badge.notes !== 1 ? 's' : ''}</p>
          )}
          {badge.mar > 0 && (
            <p className="text-red-300">💊 {badge.mar} MAR entr{badge.mar !== 1 ? 'ies' : 'y'}</p>
          )}
        </span>
      )}
    </span>
  )
}
