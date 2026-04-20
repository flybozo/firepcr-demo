import { InlineField } from '@/components/encounters/InlineField'
import type { Encounter } from '@/types/encounters'

export function NarrativeSection({ enc, isLocked, saveField }: {
  enc: Encounter; isLocked: boolean; saveField: (k: string, v: string) => void
}) {
  return (
    <div className="theme-card rounded-xl border overflow-hidden h-full">
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">📋 Clinical Narrative</h2>
      </div>
      <div className="p-4">
        <dl className="grid grid-cols-1 gap-3">
          <InlineField label="Notes" value={enc.notes} fieldKey="notes" isLocked={isLocked} onSave={saveField} type="textarea" fullWidth />
        </dl>
      </div>
    </div>
  )
}
