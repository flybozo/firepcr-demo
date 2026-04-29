import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createClient } from '@/lib/supabase/client'
import { fmtDateCompact } from '@/utils/dateFormatters'

type LinkedRun = {
  id: string
  run_date: string
  time: string | null
  resource_number: string | null
  dispensed_by: string | null
  item_count: number
}

export function SupplyRunsSection({
  enc,
}: {
  enc: { id: string; crew_resource_number?: string | null; incident_id?: string | null; unit?: string | null }
}) {
  const supabase = createClient()
  const [runs, setRuns] = useState<LinkedRun[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('supply_runs')
        .select('id, run_date, time, resource_number, dispensed_by, supply_run_items(id)')
        .eq('encounter_id', enc.id)
        .order('run_date', { ascending: false })

      setRuns(
        (data || []).map((r: any) => ({
          ...r,
          item_count: r.supply_run_items?.length ?? 0,
        }))
      )
      setLoading(false)
    }
    load()
  }, [enc.id])

  // Build query params for new supply run
  const newRunParams = new URLSearchParams()
  newRunParams.set('encounterId', enc.id)
  if (enc.crew_resource_number) newRunParams.set('resourceNumber', enc.crew_resource_number)
  if (enc.incident_id) newRunParams.set('incidentId', enc.incident_id)

  return (
    <div className="theme-card rounded-xl border overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800">
        <h3 className="text-sm font-bold text-white">📦 Supply Runs</h3>
      </div>

      {loading ? (
        <div className="px-4 py-4 text-center text-gray-500 text-sm">Loading...</div>
      ) : runs.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-gray-500 text-sm">No supply runs linked to this encounter</p>
          <p className="text-gray-600 text-xs mt-1">Track OTC consumables, supplies, and equipment used for this patient</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600">
            <span className="w-24 shrink-0">Date</span>
            <span className="w-16 shrink-0">Resource</span>
            <span className="flex-1 min-w-0">Dispensed By</span>
            <span className="w-14 shrink-0 text-right">Items</span>
          </div>
          {runs.map(run => (
            <Link
              key={run.id}
              to={`/supply-runs/${run.id}`}
              className="flex items-center px-4 py-2.5 hover:bg-gray-800/50 transition-colors text-sm"
            >
              <span className="w-24 shrink-0 text-gray-400 text-xs">
                {fmtDateCompact(run.run_date)}{run.time ? ` ${run.time}` : ''}
              </span>
              <span className="w-16 shrink-0 text-xs text-gray-500 truncate">
                {run.resource_number || '—'}
              </span>
              <span className="flex-1 min-w-0 text-xs text-gray-300 truncate">
                {run.dispensed_by || '—'}
              </span>
              <span className="w-14 shrink-0 text-right text-xs text-gray-400">
                {run.item_count} item{run.item_count !== 1 ? 's' : ''}
              </span>
            </Link>
          ))}
        </div>
      )}
      <div className="px-4 py-2.5 border-t border-gray-800">
        <Link
          to={`/supply-runs/new?${newRunParams.toString()}`}
          className="text-[11px] leading-tight px-2 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded font-medium transition-colors"
        >
          + Supply Run
        </Link>
      </div>
    </div>
  )
}
