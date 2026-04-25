import { Link } from 'react-router-dom'
import type { ChildUnit } from './types'
import { useListStyle } from '@/hooks/useListStyle'
import { getListClasses } from '@/lib/listStyles'

export default function ClusterComponents({ childUnits }: { childUnits: ChildUnit[] }) {
  const listStyle = useListStyle()
  const lc = getListClasses(listStyle)
  if (childUnits.length === 0) return null

  return (
    <div className={lc.container}>
      <div className="px-4 py-3 bg-gray-800">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Cluster Components</h2>
      </div>
      <div className="divide-y divide-gray-800">
        {childUnits.map(child => (
          <div key={child.id} className="flex items-center justify-between px-4 py-2.5">
            <div>
              <p className="text-sm font-medium">{child.name}</p>
              <p className="text-xs text-gray-500">
                {child.vehicle_subtype && <span className="mr-2">{child.vehicle_subtype}</span>}
                {child.vin && <span className="font-mono mr-2">{child.vin}</span>}
                {child.license_plate && <span>{child.license_plate}{child.plate_state ? ` · ${child.plate_state}` : ''}</span>}
              </p>
            </div>
            <Link to={`/units/${child.id}`} className="text-xs text-gray-500 hover:text-gray-300">→</Link>
          </div>
        ))}
      </div>
    </div>
  )
}
