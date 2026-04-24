import { useState, useCallback } from 'react'

type SortDir = 'asc' | 'desc'

export function useSortable<K extends string>(defaultKey: K, defaultDir: SortDir = 'asc') {
  const [sortKey, setSortKey] = useState<K>(defaultKey)
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir)

  const toggleSort = useCallback((key: K) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }, [sortKey])

  const sortFn = useCallback(<T>(
    items: T[],
    accessor: (item: T, key: K) => string | number | null | undefined
  ): T[] => {
    return [...items].sort((a, b) => {
      const av = accessor(a, sortKey) ?? ''
      const bv = accessor(b, sortKey) ?? ''
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av
      }
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [sortKey, sortDir])

  return { sortKey, sortDir, toggleSort, sortFn }
}
