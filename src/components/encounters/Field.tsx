export function Field({ label, value }: { label: string; value: string | number | boolean | null | undefined }) {
  const display = value === null || value === undefined || value === ''
    ? <span className="text-gray-600">—</span>
    : value === true ? <span className="text-green-400">Yes</span>
    : value === false ? <span className="text-gray-500">No</span>
    : <span className="text-white">{String(value)}</span>
  return (
    <div>
      <dt className="text-xs text-gray-500 uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-sm">{display}</dd>
    </div>
  )
}
