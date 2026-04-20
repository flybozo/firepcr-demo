export function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  )
}
