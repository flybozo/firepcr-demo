import { useEffect, useRef, useState } from 'react'

export function EditField({
  label,
  value,
  fieldKey,
  type = 'text',
  onSave,
  options,
  readOnly = false,
}: {
  label: string
  value: string | null | undefined
  fieldKey: string
  type?: string
  onSave: (key: string, val: string) => void
  options?: { label: string; value: string }[]
  readOnly?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const inputRef = useRef<HTMLInputElement & HTMLSelectElement>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setDraft(value ?? '') }, [value])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const commit = () => {
    setEditing(false)
    if (draft !== (value ?? '')) onSave(fieldKey, draft)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) }
  }

  if (editing) {
    if (options) {
      return (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-gray-500">{label}</span>
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKey}
            className="bg-gray-800 text-white text-sm rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      )
    }
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-gray-500">{label}</span>
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type={type}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKey}
          className="bg-gray-800 text-white text-sm rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-red-500 min-w-0"
        />
      </div>
    )
  }

  if (readOnly) {
    return (
      <div className="flex flex-col gap-0.5 px-1.5 py-1">
        <span className="text-xs text-gray-500">{label}</span>
        <span className={`text-sm ${value ? 'text-white' : 'text-gray-600 italic'}`}>{value || '—'}</span>
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex flex-col gap-0.5 text-left group w-full hover:bg-gray-800/50 rounded-md px-1.5 py-1 transition-colors"
    >
      <span className="text-xs text-gray-500 group-hover:text-gray-400">{label}</span>
      <span className={`text-sm ${value ? 'text-white' : 'text-gray-600 italic'}`}>
        {value || 'Click to edit'}
      </span>
    </button>
  )
}
