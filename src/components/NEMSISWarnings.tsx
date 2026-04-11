import type { NEMSISWarning } from '@/hooks/useNEMSISWarnings'

// Section-level warning block — render at top of each PCR section
export function NEMSISWarnings({ section, warnings }: { section: string; warnings: NEMSISWarning[] }) {
  const sectionWarnings = warnings.filter(w => w.section === section)
  if (sectionWarnings.length === 0) return null
  return (
    <div className="rounded-lg bg-amber-950/40 border border-amber-700/50 px-3 py-2 space-y-1 mb-3">
      {sectionWarnings.map(w => (
        <p key={w.id} className="text-xs text-amber-300 flex items-start gap-1.5">
          <span className="shrink-0 mt-0.5">{w.severity === 'error' ? '🚫' : '⚠️'}</span>
          <span>{w.message}</span>
        </p>
      ))}
    </div>
  )
}

// Overall quality summary — render before submit button
export function NEMSISQualitySummary({ warnings }: { warnings: NEMSISWarning[] }) {
  if (warnings.length === 0) return null
  return (
    <div className="rounded-xl bg-amber-950/30 border border-amber-700/40 p-4">
      <p className="text-sm font-semibold text-amber-300">
        ⚠️ {warnings.length} NEMSIS quality {warnings.length === 1 ? 'issue' : 'issues'} — review before submitting
      </p>
      <p className="text-xs text-amber-500 mt-1">
        These won&apos;t block submission but will appear as warnings in NEMSIS validation.
      </p>
    </div>
  )
}

// Inline field-level warning — optionally render beneath specific inputs
export function FieldWarning({ fieldId, warnings }: { fieldId: string; warnings: NEMSISWarning[] }) {
  const match = warnings.find(w => w.field === fieldId)
  if (!match) return null
  return (
    <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
      <span>{match.severity === 'error' ? '🚫' : '⚠️'}</span>
      <span>{match.message}</span>
    </p>
  )
}
