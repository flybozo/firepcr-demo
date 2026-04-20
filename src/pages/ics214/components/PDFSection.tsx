import type { ICS214Header } from './types'

interface Props {
  header: ICS214Header
  signedPdfUrl: string | null
  generatingPDF: boolean
  onRegenerate: () => void
}

export function PDFSection({ header, signedPdfUrl, generatingPDF, onRegenerate }: Props) {
  return (
    <div className="theme-card rounded-xl border p-4 flex items-center gap-3 flex-wrap">
      <div className="flex-1">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">PDF Document</p>
        {signedPdfUrl ? (
          <a href={signedPdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">
            {header.pdf_file_name || 'View PDF'}
          </a>
        ) : header.pdf_url ? (
          <p className="text-xs text-yellow-500">Loading link...</p>
        ) : (
          <p className="text-xs text-gray-600">No PDF yet — click Generate</p>
        )}
      </div>
      {signedPdfUrl && (
        <a
          href={signedPdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-2 bg-blue-700 hover:bg-blue-600 rounded-lg text-xs font-semibold transition-colors"
        >
          📄 Download PDF
        </a>
      )}
      <button
        onClick={onRegenerate}
        disabled={generatingPDF}
        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 rounded-lg text-xs font-semibold transition-colors"
      >
        {generatingPDF ? 'Generating...' : '🔄 Regenerate PDF'}
      </button>
    </div>
  )
}
