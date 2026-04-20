/**
 * AgencyLogo — small shield/logo for the patient demographics bar.
 * Shows the agency logo if available, falls back to a styled text badge.
 */

type Props = {
  agency: string | null | undefined
  size?: number
  className?: string
}

// Map agency names to logo files in /agency-logos/
const AGENCY_LOGOS: Record<string, string> = {
  'OES / CAL OES':                  '/agency-logos/caloes.png',
  'CAL OES':                         '/agency-logos/caloes.png',
  'California Conservation Corps':   '/agency-logos/ccc.png',
  'CCC':                             '/agency-logos/ccc.png',
  'Cal Fire':          '/agency-logos/calfire.svg',
  'CAL FIRE':          '/agency-logos/calfire.svg',
  'USFS':              '/agency-logos/usfs.svg',
  'US Forest Service': '/agency-logos/usfs.svg',
  'BLM':               '/agency-logos/blm.png',
  'NPS':               '/agency-logos/nps.png',
  'BIA':               '/agency-logos/bia.png',
  'USFWS':             '/agency-logos/usfws.png',
  'DOD':               '/agency-logos/dod.png',
  'ODF':               '/agency-logos/odf.png',
  'CHP':               '/agency-logos/chp.svg',
}

// Brand colors for text fallback badges
const AGENCY_COLORS: Record<string, { bg: string; text: string }> = {
  'Cal Fire':               { bg: 'bg-red-700',    text: 'text-white' },
  'CAL FIRE':               { bg: 'bg-red-700',    text: 'text-white' },
  'USFS':                   { bg: 'bg-green-800',  text: 'text-white' },
  'US Forest Service':      { bg: 'bg-green-800',  text: 'text-white' },
  'BLM':                    { bg: 'bg-yellow-600', text: 'text-white' },
  'NPS':                    { bg: 'bg-green-700',  text: 'text-white' },
  'BIA':                    { bg: 'bg-green-900',  text: 'text-white' },
  'USFWS':                  { bg: 'bg-blue-800',   text: 'text-white' },
  'ODF':                    { bg: 'bg-yellow-800', text: 'text-white' },
  'CHP':                    { bg: 'bg-blue-900',   text: 'text-white' },
  'County Fire':            { bg: 'bg-orange-700', text: 'text-white' },
  'Municipal Fire':         { bg: 'bg-orange-600', text: 'text-white' },
  'State/Local Fire':       { bg: 'bg-orange-600', text: 'text-white' },
  'OES / CAL OES':          { bg: 'bg-blue-700',   text: 'text-white' },
  'DOD':                    { bg: 'bg-gray-700',   text: 'text-white' },
  'Private Contractor':     { bg: 'bg-gray-600',   text: 'text-white' },
  'Other':                  { bg: 'bg-gray-500',   text: 'text-white' },
}

// Agencies that get an emoji instead of a logo/badge
const AGENCY_EMOJI: Record<string, string> = {
  'County Fire':        '🧑‍🚒',
  'Municipal Fire':     '🧑‍🚒',
  'State/Local Fire':   '🧑‍🚒',
  'Law Enforcement':    '👮',
  'CHP':                '👮',
  'Private Contractor': '👤',
  'Other':              '👤',
}

export function AgencyLogo({ agency, size = 28, className = '' }: Props) {
  if (!agency) return null

  const emoji = AGENCY_EMOJI[agency]
  if (emoji) {
    return (
      <span title={agency} className={`shrink-0 leading-none ${className}`} style={{ fontSize: size * 0.85 }}>
        {emoji}
      </span>
    )
  }

  const logoSrc = AGENCY_LOGOS[agency]
  const colors = AGENCY_COLORS[agency] ?? { bg: 'bg-gray-600', text: 'text-white' }

  if (logoSrc) {
    return (
      <img
        src={logoSrc}
        alt={agency}
        title={agency}
        width={size}
        height={size}
        className={`rounded object-contain shrink-0 ${className}`}
        onError={(e) => {
          // Fall back to text badge if image fails to load
          const el = e.currentTarget
          el.style.display = 'none'
          const badge = document.createElement('span')
          badge.className = `inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold ${colors.bg} ${colors.text}`
          badge.textContent = agency
          el.parentNode?.insertBefore(badge, el)
        }}
      />
    )
  }

  // Text badge fallback for agencies without a logo file
  return (
    <span
      title={agency}
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold shrink-0 ${colors.bg} ${colors.text} ${className}`}
    >
      {agency}
    </span>
  )
}
