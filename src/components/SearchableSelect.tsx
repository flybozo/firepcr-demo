

import { useState, useRef, useEffect } from 'react'

export type SelectOption = {
  value: string
  label: string
  icd10?: string
  group?: string
}

type Props = {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder: string
}

const inputCls = 'w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500'

export function SearchableSelect({ options, value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedOption = options.find(o => o.value === value)
  const displayText = open ? search : (selectedOption ? selectedOption.label : '')

  const filtered = search.length > 0
    ? options.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        (o.icd10 && o.icd10.toLowerCase().includes(search.toLowerCase()))
      )
    : options

  // Build grouped structure preserving order
  const groups: { group: string; options: SelectOption[] }[] = []
  for (const opt of filtered) {
    const grp = opt.group || 'Other'
    const existing = groups.find(g => g.group === grp)
    if (existing) {
      existing.options.push(opt)
    } else {
      groups.push({ group: grp, options: [opt] })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
      setSearch('')
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const firstMatch = filtered[0]
      if (firstMatch) {
        onChange(firstMatch.value)
        setOpen(false)
        setSearch('')
      }
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        className={inputCls}
        value={displayText}
        placeholder={placeholder}
        onFocus={() => {
          if (inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect()
            setDropdownStyle({
              position: 'fixed',
              top: rect.bottom + 4,
              left: rect.left,
              width: rect.width,
              zIndex: 9999,
            })
          }
          setOpen(true)
        }}
        onChange={e => {
          setSearch(e.target.value)
          setOpen(true)
        }}
        onKeyDown={handleKeyDown}
      />
      {open && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-64 overflow-y-auto" style={dropdownStyle}>
          {groups.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
          )}
          {groups.map(g => (
            <div key={g.group}>
              <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-500 bg-gray-900 sticky top-0">
                {g.group}
              </div>
              {g.options.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-gray-700 flex justify-between items-center gap-2"
                  onMouseDown={() => {
                    onChange(opt.value)
                    setOpen(false)
                    setSearch('')
                  }}
                >
                  <span className="text-sm text-white">{opt.label}</span>
                  {opt.icd10 && <span className="text-xs text-gray-500 shrink-0">{opt.icd10}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
