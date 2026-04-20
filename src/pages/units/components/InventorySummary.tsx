import { Link } from 'react-router-dom'
import type { InventoryItem } from './types'

type Props = { inventory: InventoryItem[]; unitName: string }

export default function InventorySummary({ inventory, unitName }: Props) {
  if (inventory.length === 0) return null

  return (
    <div className="theme-card rounded-xl border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">CS / Rx Inventory</h2>
        <Link to={`/inventory?unit=${unitName}`} className="text-xs text-blue-400 hover:text-blue-300">View all →</Link>
      </div>
      <div className="divide-y divide-gray-800">
        {inventory.map(item => {
          const low = item.quantity <= item.par_qty
          return (
            <div key={item.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className={`flex-1 truncate ${low ? 'text-red-300' : 'text-white'}`}>{item.item_name}</span>
              <span className={`w-8 text-right font-mono font-semibold ${low ? 'text-red-400' : 'text-gray-300'}`}>
                {item.quantity}
              </span>
              {low && <span className="ml-2 text-xs text-red-500">⚠</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
