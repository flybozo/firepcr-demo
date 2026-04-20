export function Empty({ text = 'No data yet' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center h-40 text-gray-600 text-sm">{text}</div>
  )
}
