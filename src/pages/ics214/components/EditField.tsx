import { useEffect, useState, useRef } from 'react'

export function EditField({
  label,
  value,
  fieldKey,
  type = 'text',
  onSave,
  readOnly = false,
}: {
  label: string
  value: string | null | undefined
  fieldKey: string
  type?: string
  onSave: (key: string, val: string) => void
  readOnly?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setDraft(value ?? '') }, [value])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const commit = () => {
    setEditing(false)
    if (draft !== (value ?? '')) onSave(fieldKey, draft)
  }

  if (readOnly) {
    return (
      <div className="flex flex-col gap-0.5 px-1.5 py-1">
        <span className="text-xs text-gray-500">{label}</span>
        <span className="text-sm text-gray-300">{value || '—'}</span>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-gray-500">{label}</span>
        <input
          ref={inputRef}
          type={type}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) }
          }}
          className="bg-gray-800 text-white text-sm rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
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
