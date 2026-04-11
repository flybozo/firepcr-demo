
import { useState, useRef, useEffect } from 'react'

interface MultiSelectProps {
  options: string[]
  value: string[]
  onChange: (val: string[]) => void
  placeholder?: string
  className?: string
}

export function MultiSelect({ options, value, onChange, placeholder = 'Select all that apply...', className = '' }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (opt: string) => {
    if (value.includes(opt)) onChange(value.filter(v => v !== opt))
    else onChange([...value, opt])
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full text-left bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[38px]"
      >
        {value.length === 0 ? (
          <span className="text-gray-500">{placeholder}</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {value.map(v => (
              <span key={v} className="inline-flex items-center gap-1 bg-red-900/60 text-red-200 text-xs px-2 py-0.5 rounded-full">
                {v}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); toggle(v) }}
                  className="hover:text-red-100 leading-none"
                >×</button>
              </span>
            ))}
          </span>
        )}
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-64 overflow-y-auto">
          {options.map(opt => (
            <label
              key={opt}
              className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-700 cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                checked={value.includes(opt)}
                onChange={() => toggle(opt)}
                className="accent-red-500 w-4 h-4 shrink-0"
              />
              <span className={value.includes(opt) ? 'text-white' : 'text-gray-300'}>{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
