import React, { useState, useEffect } from 'react'
import { SearchableSelect } from '@/components/SearchableSelect'
import { CLINICAL_OPTION_VALUES } from '@/constants/nemsis'

export function InlineField({ label, value, fieldKey, isLocked, onSave, type = 'text', options, fullWidth }: {
  label: string
  value: string | number | null | undefined | string[]
  fieldKey: string
  isLocked: boolean
  onSave: (key: string, val: string) => void
  type?: 'text' | 'select' | 'date' | 'datetime-local' | 'number' | 'textarea' | 'clinical-select' | 'multi-select'
  options?: string[]
  fullWidth?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value ?? ''))

  // Keep draft in sync if value changes externally
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!editing) setDraft(String(value ?? '')) }, [value, editing])

  if (isLocked || !editing) {
    return (
      <div
        onClick={() => !isLocked && setEditing(true)}
        className={`${fullWidth ? 'col-span-full' : ''} ${!isLocked ? 'cursor-pointer hover:bg-gray-800/50 rounded px-1 -mx-1 transition-colors group' : ''}`}
      >
        <dt className="text-xs text-gray-500 uppercase tracking-wide">{label}</dt>
        <dd className="text-sm text-white mt-0.5 flex items-center gap-1">
          {value !== null && value !== undefined && value !== ''
            ? String(value)
            : <span className="text-gray-600">—</span>}
          {!isLocked && <span className="text-gray-700 text-xs opacity-0 group-hover:opacity-100">✏️</span>}
        </dd>
      </div>
    )
  }

  const commit = () => { setEditing(false); if (draft !== String(value ?? '')) onSave(fieldKey, draft) }
  const inputCls = 'w-full bg-gray-700 border border-red-600/50 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500'

  return (
    <div className={fullWidth ? 'col-span-full' : ''}>
      <dt className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</dt>
      {type === 'select' && options ? (
        <select className={inputCls} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} autoFocus>
          <option value="">—</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : type === 'multi-select' ? (
        <div className="bg-gray-800 rounded-lg p-2 max-h-48 overflow-y-auto space-y-1 border border-gray-600">
          {(options || []).map((opt: string) => {
            const selected = draft ? draft.split(' | ').includes(opt) : false
            return (
              <label key={opt} className="flex items-center gap-2 cursor-pointer px-1 py-0.5 rounded hover:bg-gray-700">
                <input type="checkbox" checked={selected}
                  onChange={e => {
                    const parts = draft ? draft.split(' | ').filter(Boolean) : []
                    const next = e.target.checked ? [...parts, opt] : parts.filter(p => p !== opt)
                    setDraft(next.join(' | '))
                  }}
                  className="accent-red-500" />
                <span className="text-sm text-gray-200">{opt}</span>
              </label>
            )
          })}
          <div className="pt-1 border-t border-gray-700 flex justify-end">
            <button type="button" onClick={commit}
              className="text-xs px-3 py-1 bg-red-700 hover:bg-red-600 text-white rounded-lg">Save</button>
          </div>
        </div>
      ) : type === 'clinical-select' ? (
        <SearchableSelect
          options={CLINICAL_OPTION_VALUES.map((v: string) => ({ value: v, label: v, group: '' }))}
          value={draft}
          onChange={(v: string) => { setDraft(v); commit() }}
          placeholder="Search impression..."
        />
      ) : type === 'textarea' ? (
        <textarea className={inputCls + ' resize-none'} rows={4} value={draft}
          onChange={e => setDraft(e.target.value)} onBlur={commit} autoFocus />
      ) : (
        <input type={type} className={inputCls} value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
          autoFocus />
      )}
    </div>
  )
}
