
import type { TimelineEvent } from '@/types/timeline'

const ACUITY_DOT: Record<string, string> = {
  Immediate: 'bg-red-500',
  Red: 'bg-red-500',
  Delayed: 'bg-yellow-500',
  Yellow: 'bg-yellow-500',
  Minor: 'bg-green-500',
  Green: 'bg-green-500',
  Expectant: 'bg-gray-600',
  Black: 'bg-gray-900',
}

// Stable pastel color for a unit pill based on name hash
function unitColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  const colors = [
    'bg-blue-900/60 text-blue-300 border-blue-700/40',
    'bg-teal-900/60 text-teal-300 border-teal-700/40',
    'bg-violet-900/60 text-violet-300 border-violet-700/40',
    'bg-orange-900/60 text-orange-300 border-orange-700/40',
    'bg-green-900/60 text-green-300 border-green-700/40',
    'bg-pink-900/60 text-pink-300 border-pink-700/40',
  ]
  return colors[Math.abs(h) % colors.length]
}

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 3600)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function shortTime(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

type Props = { event: TimelineEvent }

export function TimelineEventRow({ event }: Props) {
  const ts = event.event_timestamp
  const acuityDot = event.acuity && event.event_type === 'encounter_new' ? ACUITY_DOT[event.acuity] : null

  return (
    <div className="flex gap-3 px-4 py-3 hover:bg-gray-800/40 transition-colors rounded-lg group">
      {/* Icon */}
      <div className="shrink-0 w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-sm mt-0.5">
        {event.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          {/* Summary */}
          <span className="text-sm text-white leading-snug">{event.summary}</span>
          {/* Acuity dot for encounters */}
          {acuityDot && (
            <span className={`w-2 h-2 rounded-full shrink-0 ${acuityDot}`} title={event.acuity ?? undefined} />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {/* Unit pill */}
          {event.unit_name && (
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${unitColor(event.unit_name)}`}>
              {event.unit_name}
            </span>
          )}
          {/* Actor */}
          {event.actor && (
            <span className="text-xs text-gray-500 truncate max-w-[160px]">{event.actor}</span>
          )}
          {/* Timestamp */}
          <span className="text-xs text-gray-600 ml-auto shrink-0" title={new Date(ts).toLocaleString()}>
            {relativeTime(ts)} · {shortTime(ts)}
          </span>
        </div>
      </div>
    </div>
  )
}
