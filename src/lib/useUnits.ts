/**
 * useUnits — single source of truth for unit lists across the app.
 *
 * All dropdowns and selectors must use this hook (or fetchUnits) instead of
 * querying `units` directly. This guarantees consistent filtering:
 *   - active = true  (excludes decommissioned/test units)
 *   - is_storage = false  (excludes Warehouse unless explicitly requested)
 *
 * Usage:
 *   const { units, loading } = useUnits()           // operational units only
 *   const { units } = useUnits({ includeStorage: true })  // include Warehouse
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type UnitOption = {
  id: string
  name: string
  unit_type?: { name: string } | null
}

type UseUnitsOptions = {
  includeStorage?: boolean  // include is_storage=true units (e.g. Warehouse). Default: false
  withType?: boolean        // include unit_type join. Default: false
}

export function useUnits(options: UseUnitsOptions = {}) {
  const { includeStorage = false, withType = false } = options
  const supabase = createClient()
  const [units, setUnits] = useState<UnitOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      let q = supabase
        .from('units')
        .select('id, name, unit_type:unit_types(name)')
        .eq('active', true)
        .order('name')

      if (!includeStorage) {
        q = q.eq('is_storage', false)
      }

      const { data, error: err } = await q
      if (!cancelled) {
        if (err) setError(err.message)
        else setUnits((data ?? []) as unknown as UnitOption[])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [includeStorage, withType])

  return { units, loading, error }
}

/**
 * fetchUnits — promise-based version for use outside React components
 * (e.g. inside loadList() calls, async handlers).
 */
export async function fetchUnits(
  supabase: ReturnType<typeof createClient>,
  options: UseUnitsOptions = {}
): Promise<UnitOption[]> {
  const { includeStorage = false } = options

  let q = supabase
    .from('units')
    .select('id, name, unit_type:unit_types(name)')
    .eq('active', true)
    .order('name')

  if (!includeStorage) {
    q = q.eq('is_storage', false)
  }

  const { data } = await q
  return (data ?? []) as unknown as UnitOption[]
}
