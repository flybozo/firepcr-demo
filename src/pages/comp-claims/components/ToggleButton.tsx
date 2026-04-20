
export function ToggleButton({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2 mt-1">
      {(['Yes', 'No'] as const).map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt === 'Yes')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            (opt === 'Yes' ? value === true : value === false)
              ? 'bg-red-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >{opt}</button>
      ))}
    </div>
  )
}
