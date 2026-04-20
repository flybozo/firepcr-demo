import { useState } from 'react'
import type { Personnel } from './types'
import { brand } from '@/lib/branding.config'

interface Props {
  personnel: Personnel[]
  onAdd: (data: { name: string; position: string; agency: string }) => void
}

export function PersonnelSection({ personnel, onAdd }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [position, setPosition] = useState('')
  const [agency, setAgency] = useState(brand.companyName)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onAdd({ name: name.trim(), position: position.trim(), agency: agency.trim() })
    setName('')
    setPosition('')
    setAgency(brand.companyName)
    setShowForm(false)
  }

  return (
    <div className="theme-card rounded-xl border overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
          Personnel ({personnel.length})
        </h2>
        <button
          onClick={() => setShowForm(v => !v)}
          className="text-xs px-2.5 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        >
          {showForm ? '✕' : '+ Add Person'}
        </button>
      </div>
      <p className="px-4 pt-2 text-xs text-gray-600 italic">
        Snapshot taken at creation. To update, add manually.
      </p>

      {showForm && (
        <form onSubmit={handleSubmit} className="px-4 py-3 border-b theme-card-header space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Name"
              required
              className="bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <input
              type="text"
              value={position}
              onChange={e => setPosition(e.target.value)}
              placeholder="ICS Position"
              className="bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <input
              type="text"
              value={agency}
              onChange={e => setAgency(e.target.value)}
              placeholder="Home Agency"
              className="bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors">
            Add Person
          </button>
        </form>
      )}

      {personnel.length === 0 ? (
        <p className="px-4 py-4 text-sm text-gray-600 text-center">No personnel on record.</p>
      ) : (
        <div className="divide-y divide-gray-800/60">
          <div className="flex px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-600 theme-card-footer">
            <span className="flex-1">Name</span>
            <span className="w-36 hidden sm:block">ICS Position</span>
            <span className="w-40 hidden sm:block">Home Agency</span>
          </div>
          {personnel.map(p => (
            <div key={p.id} className="flex items-center px-4 py-2 text-sm">
              <span className="flex-1 text-white">{p.employee_name}</span>
              <span className="w-36 text-gray-400 text-xs hidden sm:block">{p.ics_position || '—'}</span>
              <span className="w-40 text-gray-500 text-xs hidden sm:block">{p.home_agency || '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
