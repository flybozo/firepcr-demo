import { Link } from 'react-router-dom'

interface AdminRequiredProps {
  /** Optional back link destination. Defaults to '/dashboard/my-unit' */
  backTo?: string
  /** Optional back link label. Defaults to '← Back to Dashboard' */
  backLabel?: string
  /** Optional description. Defaults to generic message. */
  description?: string
}

export default function AdminRequired({ backTo = '/dashboard/my-unit', backLabel = '← Back to Dashboard', description = 'This page is restricted to admin users.' }: AdminRequiredProps) {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-8">
      <div className="text-center">
        <p className="text-4xl mb-4">🔒</p>
        <h2 className="text-xl font-bold mb-2">Admin Access Required</h2>
        <p className="text-gray-400 text-sm">{description}</p>
        <Link to={backTo} className="mt-4 inline-block text-red-400 hover:text-red-300 text-sm">{backLabel}</Link>
      </div>
    </div>
  )
}
