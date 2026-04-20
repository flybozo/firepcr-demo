import { Link } from 'react-router-dom'

interface Props {
  pdfUrl: string | null
  pdfGenerating: boolean
  encounterId: string
  onDownloadPDF: () => void
  onReset: () => void
}

export function AMASuccessScreen({ pdfUrl, pdfGenerating, encounterId, onDownloadPDF, onReset }: Props) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
      <div className="text-center space-y-4 max-w-sm w-full">
        <div className="text-6xl">✅</div>
        <h1 className="text-2xl font-bold text-white">Refusal Documented</h1>
        <p className="text-gray-400">AMA form saved successfully.</p>

        {pdfUrl ? (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
            className="block bg-green-900/30 border border-green-700 rounded-xl px-4 py-3 text-green-300 text-sm text-center hover:bg-green-900/50 transition-colors">
            ✅ AMA PDF saved — tap to open
          </a>
        ) : (
          <p className="text-xs text-gray-500">⏳ Saving PDF...</p>
        )}

        <button
          onClick={onDownloadPDF}
          disabled={pdfGenerating}
          className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          {pdfGenerating ? '⏳ Generating...' : '📄 Download PDF'}
        </button>

        <button
          onClick={onReset}
          className="w-full mt-2 px-6 py-3 bg-red-600 text-white rounded-xl font-semibold"
        >
          New AMA Form
        </button>
        {encounterId && (
          <Link to={`/encounters/${encounterId}`}
            className="text-gray-500 text-sm hover:text-gray-400">← Back to Encounter</Link>
        )}
        <div><a href="/" className="text-gray-500 text-sm underline">Back to Home</a></div>
      </div>
    </div>
  )
}
