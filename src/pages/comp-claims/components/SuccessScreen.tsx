
import { Link } from 'react-router-dom'

interface SuccessScreenProps {
  savedPdfUrl: string | null
  pdfGenerating: boolean
  encounterUUID: string
  onDownloadOSHA: () => void
}

export function SuccessScreen({ savedPdfUrl, pdfGenerating, encounterUUID, onDownloadOSHA }: SuccessScreenProps) {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-sm w-full">
        <p className="text-4xl">✅</p>
        <p className="text-xl font-bold text-green-400">Claim Saved</p>
        <p className="text-gray-400 text-sm">Workers' comp claim has been recorded.</p>
        {savedPdfUrl && (
          <a href={savedPdfUrl} target="_blank" rel="noopener noreferrer"
            className="block w-full py-3 bg-blue-700 hover:bg-blue-600 text-white font-semibold rounded-xl transition-colors text-center">
            📄 View / Download OSHA 301 PDF
          </a>
        )}
        <button onClick={onDownloadOSHA} disabled={pdfGenerating}
          className="w-full py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white font-semibold rounded-xl transition-colors">
          {pdfGenerating ? '⏳ Generating...' : '⬇️ Re-download PDF'}
        </button>
        <Link to={encounterUUID ? `/encounters/${encounterUUID}` : '/encounters'}
          className="block w-full py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors text-sm">
          ← Back to Encounter
        </Link>
      </div>
    </div>
  )
}
