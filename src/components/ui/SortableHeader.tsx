interface SortableHeaderProps {
  label: string
  sortKey: string
  currentKey: string
  currentDir: 'asc' | 'desc'
  onToggle: (key: string) => void
  className?: string
}

export function SortableHeader({
  label, sortKey, currentKey, currentDir, onToggle, className = '',
}: SortableHeaderProps) {
  const isActive = currentKey === sortKey
  const icon = isActive ? (currentDir === 'asc' ? '↑' : '↓') : '↕'
  return (
    <button
      onClick={() => onToggle(sortKey)}
      className={`flex items-center gap-0.5 cursor-pointer select-none transition-colors ${
        isActive ? 'text-white' : 'text-gray-500 hover:text-white'
      } ${className}`}
    >
      {label}
      <span className={`text-[10px] ml-0.5 ${isActive ? 'text-white' : 'text-gray-600'}`}>{icon}</span>
    </button>
  )
}

interface SortBarOption {
  label: string
  key: string
}

interface SortBarProps {
  options: SortBarOption[]
  currentKey: string
  currentDir: 'asc' | 'desc'
  onToggle: (key: string) => void
  className?: string
}

export function SortBar({ options, currentKey, currentDir, onToggle, className = '' }: SortBarProps) {
  return (
    <div className={`flex items-center gap-1.5 flex-wrap text-xs ${className}`}>
      <span className="text-gray-600 shrink-0">Sort:</span>
      {options.map(opt => {
        const isActive = currentKey === opt.key
        const icon = isActive ? (currentDir === 'asc' ? ' ↑' : ' ↓') : ''
        return (
          <button
            key={opt.key}
            onClick={() => onToggle(opt.key)}
            className={`px-2 py-0.5 rounded transition-colors select-none ${
              isActive
                ? 'bg-gray-700 text-white'
                : 'bg-gray-800/50 text-gray-500 hover:text-white hover:bg-gray-700'
            }`}
          >
            {opt.label}{icon}
          </button>
        )
      })}
    </div>
  )
}
