import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUserAssignment } from '@/lib/useUserAssignment'

/**
 * Returns counts of items needing the current user's signature:
 * - unsigned charts (encounters they created or are provider_of_record for)
 * - unsigned progress notes (notes they authored)
 * - unsigned MAR entries (entries needing provider co-sign, for providers only)
 *
 * The total is used for the sidebar badge on "Patient Encounters".
 */
export type UnsignedCounts = {
  charts: number
  notes: number
  mar: number
  total: number
}

export function useUnsignedCounts(): UnsignedCounts {
  const [counts, setCounts] = useState<UnsignedCounts>({ charts: 0, notes: 0, mar: 0, total: 0 })
  const assignment = useUserAssignment()

  useEffect(() => {
    if (assignment.loading || !assignment.employee?.name) return

    const myName = assignment.employee.name
    const myRole = assignment.employee.role || ''
    const isProvider = ['MD', 'DO', 'NP', 'PA', 'PA-C'].some(r => myRole.toUpperCase().includes(r))
    const supabase = createClient()

    const load = async () => {
      // 1. Unsigned charts — created by me or I'm provider of record
      const [{ data: created }, { data: provider }] = await Promise.all([
        supabase
          .from('patient_encounters')
          .select('id', { count: 'exact', head: false })
          .eq('created_by', myName)
          .is('signed_at', null)
          .is('deleted_at', null),
        supabase
          .from('patient_encounters')
          .select('id', { count: 'exact', head: false })
          .eq('provider_of_record', myName)
          .is('signed_at', null)
          .is('deleted_at', null),
      ])

      const chartIds = new Set<string>()
      ;(created || []).forEach((r: { id: string }) => chartIds.add(r.id))
      ;(provider || []).forEach((r: { id: string }) => chartIds.add(r.id))
      const charts = chartIds.size

      // 2. Unsigned progress notes — authored by me
      const { count: noteCount } = await supabase
        .from('progress_notes')
        .select('id', { count: 'exact', head: true })
        .eq('author_name', myName)
        .is('signed_at', null)
        .is('deleted_at', null)
      const notes = noteCount || 0

      // 3. Unsigned MAR entries needing co-sign (providers only)
      let mar = 0
      if (isProvider) {
        const { count: marCount } = await supabase
          .from('dispense_admin_log')
          .select('id', { count: 'exact', head: true })
          .eq('requires_cosign', true)
          .is('provider_signature_url', null)
          .is('voided_at', null)
        mar = marCount || 0
      }

      setCounts({ charts, notes, mar, total: charts + notes + mar })
    }

    load()

    // Refresh every 5 minutes while sidebar is mounted
    const interval = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [assignment.loading, assignment.employee?.name, assignment.employee?.role])

  return counts
}

/**
 * Legacy compatibility wrapper — returns just the total count.
 */
export function useUnsignedPCRCount(): number {
  return useUnsignedCounts().total
}
