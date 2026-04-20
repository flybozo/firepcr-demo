import type { ICS214Header } from './types'
import { EditField } from './EditField'
import { formatDateTime } from './utils'

interface Props {
  header: ICS214Header
  onSave: (key: string, val: string) => void
}

export function HeaderCard({ header, onSave }: Props) {
  return (
    <div className="theme-card rounded-xl border overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">ICS 214 Header</h2>
        <span className="text-xs text-gray-600 italic">Click to edit</span>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          <EditField label="214 ID" value={header.ics214_id} fieldKey="ics214_id" onSave={onSave} readOnly />
          <EditField label="Status" value={header.status} fieldKey="status" onSave={onSave} readOnly />
          <EditField label="Incident" value={header.incident_name} fieldKey="incident_name" onSave={onSave} />
          <EditField label="Unit" value={header.unit_name} fieldKey="unit_name" onSave={onSave} />
          <EditField label="Op Date" value={header.op_date} fieldKey="op_date" type="date" onSave={onSave} />
          <EditField label="Op Start" value={header.op_start} fieldKey="op_start" type="time" onSave={onSave} />
          <EditField label="Op End" value={header.op_end} fieldKey="op_end" type="time" onSave={onSave} />
          <EditField label="Leader Name" value={header.leader_name} fieldKey="leader_name" onSave={onSave} />
          <EditField label="Leader ICS Position" value={header.leader_position} fieldKey="leader_position" onSave={onSave} />
        </div>
        <div className="mt-3 pt-3 border-t border-gray-800">
          <label className="block text-xs text-gray-500 mb-1">Notes</label>
          <textarea
            defaultValue={header.notes ?? ''}
            onBlur={e => {
              if (e.target.value !== (header.notes ?? '')) onSave('notes', e.target.value)
            }}
            rows={2}
            className="w-full bg-gray-800 text-white text-sm rounded-md px-3 py-2 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
          />
        </div>
        {header.closed_at && (
          <p className="mt-2 text-xs text-gray-600">
            Closed {formatDateTime(header.closed_at)} by {header.closed_by}
          </p>
        )}
      </div>
    </div>
  )
}
