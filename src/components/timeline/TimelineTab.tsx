
import { useState, useEffect, useCallback, useRef } from 'react'
import type { TimelineEvent } from '@/types/timeline'
import { Timeline } from './Timeline'
import { TimelineFilters } from './TimelineFilters'

const LIMIT = 50

type FetchParams = {
  limit: number
  before?: string
  types?: string[] | null
}

type Props = {
  fetchFn: (params: FetchParams) => Promise<{ events?: TimelineEvent[]; error?: string }>
  isExternal?: boolean
}

export function TimelineTab({ fetchFn, isExternal }: Props) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [selectedUnit, setSelectedUnit] = useState('All')

  const fetchFnRef = useRef(fetchFn)
  fetchFnRef.current = fetchFn

  const doFetch = useCallback(async (before?: string): Promise<TimelineEvent[]> => {
    try {
      const params: FetchParams = { limit: LIMIT }
      if (before) params.before = before
      if (selectedTypes.length > 0) params.types = selectedTypes
      const result = await fetchFnRef.current(params)
      return result.events || []
    } catch {
      return []
    }
  }, [selectedTypes])

  const loadInitial = useCallback(async () => {
    setLoading(true)
    const fresh = await doFetch()
    setEvents(fresh)
    setHasMore(fresh.length >= LIMIT)
    setSelectedUnit('All')
    setLoading(false)
  }, [doFetch])

  // Load on mount + re-load when filters change
  useEffect(() => {
    loadInitial()
  }, [loadInitial])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(loadInitial, 60_000)
    return () => clearInterval(interval)
  }, [loadInitial])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || events.length === 0) return
    setLoadingMore(true)
    const cursor = events[events.length - 1]?.event_timestamp
    const more = await doFetch(cursor)
    setEvents(prev => {
      // Deduplicate by id
      const seen = new Set(prev.map(e => e.id))
      return [...prev, ...more.filter(e => !seen.has(e.id))]
    })
    setHasMore(more.length >= LIMIT)
    setLoadingMore(false)
  }, [loadingMore, hasMore, events, doFetch])

  const handleTypesChange = (types: string[]) => {
    setSelectedTypes(types)
    setSelectedUnit('All')
  }

  // Unique unit names from loaded events (for client-side unit filter)
  const units = Array.from(
    new Set(events.map(e => e.unit_name).filter((u): u is string => !!u))
  ).sort()

  const visibleEvents = selectedUnit === 'All'
    ? events
    : events.filter(e => e.unit_name === selectedUnit)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-gray-500">
          Activity feed · auto-refreshes every 60s
          {events.length > 0 && ` · ${events.length} events loaded`}
        </p>
        <button
          onClick={loadInitial}
          disabled={loading}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40"
        >
          ↻ Refresh
        </button>
      </div>

      <TimelineFilters
        activeTypes={selectedTypes}
        units={units}
        activeUnit={selectedUnit}
        onTypesChange={handleTypesChange}
        onUnitChange={setSelectedUnit}
        isExternal={isExternal}
      />

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <Timeline
          events={visibleEvents}
          loading={loading}
          loadingMore={loadingMore}
          hasMore={hasMore && selectedUnit === 'All'}
          onLoadMore={loadMore}
        />
      </div>
    </div>
  )
}
