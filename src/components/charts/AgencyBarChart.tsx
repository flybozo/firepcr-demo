import { AgencyLogo, AGENCY_COLORS } from '@/components/AgencyLogo'

type AgencyBarChartEntry = { agency: string; count: number }

type AgencyBarChartProps = {
  data: AgencyBarChartEntry[]
  maxHeight?: number   // max bar height in px, default 180
  barColor?: string    // fallback bar color
}

export function AgencyBarChart({ data, maxHeight = 180, barColor = '#dc2626' }: AgencyBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-36 text-gray-600 text-sm">No data</div>
    )
  }

  const sorted = [...data].sort((a, b) => b.count - a.count)
  const maxCount = sorted[0]?.count ?? 1

  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-3 px-2 pb-2" style={{ minWidth: sorted.length * 76 }}>
        {sorted.map(({ agency, count }) => {
          const agencyColors = AGENCY_COLORS[agency]
          // Extract a hex-ish color from tailwind bg class for the bar
          const barFill = agencyColors ? resolveBarColor(agencyColors.bg) : barColor
          const barH = maxCount > 0 ? Math.max(4, Math.round((count / maxCount) * maxHeight)) : 4

          return (
            <div
              key={agency}
              className="flex flex-col items-center gap-1 shrink-0"
              style={{ width: 64 }}
            >
              {/* Agency logo / badge above the bar */}
              <AgencyLogo agency={agency} size={24} />

              {/* Count label */}
              <span className="text-xs font-bold text-white leading-none">{count}</span>

              {/* The bar */}
              <div
                className="w-full rounded-t-md transition-all"
                style={{ height: barH, backgroundColor: barFill }}
              />

              {/* Agency name label */}
              <span
                className="text-xs text-gray-400 text-center leading-tight w-full truncate"
                title={agency}
                style={{ maxWidth: 64 }}
              >
                {agency}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Map a Tailwind bg-* class to an approximate hex color for the bar fill. */
function resolveBarColor(twClass: string): string {
  const map: Record<string, string> = {
    'bg-red-700': '#b91c1c',
    'bg-green-800': '#166534',
    'bg-green-700': '#15803d',
    'bg-green-900': '#14532d',
    'bg-yellow-600': '#ca8a04',
    'bg-yellow-800': '#92400e',
    'bg-blue-800': '#1e40af',
    'bg-blue-700': '#1d4ed8',
    'bg-blue-900': '#1e3a5f',
    'bg-orange-700': '#c2410c',
    'bg-orange-600': '#ea580c',
    'bg-gray-700': '#374151',
    'bg-gray-600': '#4b5563',
    'bg-gray-500': '#6b7280',
  }
  return map[twClass] ?? '#dc2626'
}
