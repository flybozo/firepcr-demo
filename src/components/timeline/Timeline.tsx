
import { useEffect, useRef, useMemo } from 'react'
import type { TimelineEvent } from '@/types/timeline'
import { TimelineEventRow } from './TimelineEvent'

function formatDateDivider(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  if (isSameDay(d, today)) return 'Today'
  if (isSameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function eventDateKey(ts: string): string {
  return new Date(ts).toLocaleDateString('en-CA') // YYYY-MM-DD
}

type Props = {
  events: TimelineEvent[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  onLoadMore: () => void
}

export function Timeline({ events, loading, loadingMore, hasMore, onLoadMore }: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore) {
          onLoadMore()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, onLoadMore])

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-800/50 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-36 text-gray-600 text-sm">
        No activity yet for this incident
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Vertical connecting line */}
      <div className="absolute left-[2.25rem] top-0 bottom-0 w-px bg-gray-800 pointer-events-none" />

      <div>
        {events.map((event, i) => {
          const dateKey = eventDateKey(event.event_timestamp)
          const prevDateKey = i > 0 ? eventDateKey(events[i - 1].event_timestamp) : null
          const showDivider = dateKey !== prevDateKey

          return (
            <div key={event.id}>
              {showDivider && (
                <div className="relative flex items-center gap-3 px-4 py-2.5 mt-1">
                  <div className="flex-1 h-px bg-gray-700/60" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 shrink-0">
                    {formatDateDivider(dateKey)}
                  </span>
                  <div className="flex-1 h-px bg-gray-700/60" />
                </div>
              )}
              <TimelineEventRow event={event} />
            </div>
          )
        })}
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-4" />

      {loadingMore && (
        <div className="flex justify-center py-3">
          <div className="w-5 h-5 rounded-full border-2 border-red-600 border-t-transparent animate-spin" />
        </div>
      )}
      {!hasMore && events.length > 0 && (
        <p className="text-center text-xs text-gray-700 py-3">— End of timeline —</p>
      )}
    </div>
  )
}
