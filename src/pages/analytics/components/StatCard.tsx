import { C } from './analyticsTypes'

export function StatCard({ label, value, accent = C.red, sub }: { label: string; value: string | number; accent?: string; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-1"
      style={{ borderLeftColor: accent, borderLeftWidth: 3 }}>
      <span className="text-2xl font-bold text-white">{value}</span>
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      {sub && <span className="text-xs text-gray-600">{sub}</span>}
    </div>
  )
}
