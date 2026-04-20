
import { sectionCls } from '../types'

type Props = {
  entryType: 'Administered' | 'Dispensed'
  onChange: (type: 'Administered' | 'Dispensed') => void
}

export function EntryTypeToggle({ entryType, onChange }: Props) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 mb-4">
      <p className={sectionCls}>Entry Type</p>
      <div className="flex gap-2 mt-2">
        {(['Administered', 'Dispensed'] as const).map(type => (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-colors ${
              entryType === type
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {type}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-2">
        {entryType === 'Administered'
          ? 'Provider personally gave the medication to the patient.'
          : 'Provider gave a course of medication for the patient to take themselves.'}
      </p>
      {entryType === 'Dispensed' && (
        <div className="mt-3 bg-yellow-950 border border-yellow-700 rounded-lg p-3">
          <p className="text-yellow-400 text-xs font-bold">⚕️ Dispensed medications require physician order and signature.</p>
        </div>
      )}
    </div>
  )
}
