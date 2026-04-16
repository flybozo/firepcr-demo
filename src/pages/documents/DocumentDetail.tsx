/**
 * DocumentDetail — renders a document's PDF in an iframe for the split-pane right panel.
 * Also shows metadata (title, category, description, uploaded by/when).
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { createClient } from '@/lib/supabase/client'
import { resolveStorageUrl } from '@/lib/storage'

type Doc = {
  id: string
  title: string
  description: string | null
  category: string
  file_url: string | null
  file_name: string | null
  uploaded_by: string
  uploaded_at: string
  version: string | null
}

const CAT_COLORS: Record<string, string> = {
  'Policy': 'bg-blue-900 text-blue-300',
  'Procedure': 'bg-green-900 text-green-300',
  'Form': 'bg-purple-900 text-purple-300',
  'Training': 'bg-orange-900 text-orange-300',
  'Reference': 'bg-gray-700 text-gray-300',
}

export default function DocumentDetail() {
  const supabase = createClient()
  const { id } = useParams<{ id: string }>()
  const [doc, setDoc] = useState<Doc | null>(null)
  const [loading, setLoading] = useState(true)

  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    supabase.from('documents').select('*').eq('id', id).single()
      .then(async ({ data }) => {
        setDoc(data as Doc)
        if (data?.file_url) {
          const url = await resolveStorageUrl('documents', data.file_url)
          setResolvedUrl(url)
        }
        setLoading(false)
      })
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-500 text-sm">Loading…</div>
  )
  if (!doc) return (
    <div className="flex items-center justify-center h-64 text-gray-500 text-sm">Document not found.</div>
  )

  const isPdf = doc.file_url?.toLowerCase().includes('.pdf') || doc.file_name?.toLowerCase().endsWith('.pdf')

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-800 shrink-0">
        <div className="flex items-start gap-3 pr-8">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-white leading-tight">{doc.title}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full ${CAT_COLORS[doc.category] || CAT_COLORS.Reference}`}>
                {doc.category}
              </span>
              {doc.version && <span className="text-xs text-gray-500">v{doc.version}</span>}
            </div>
            {doc.description && (
              <p className="text-xs text-gray-400 mt-1">{doc.description}</p>
            )}
            <p className="text-xs text-gray-600 mt-1">
              Uploaded {new Date(doc.uploaded_at).toLocaleDateString()} · {doc.uploaded_by}
            </p>
          </div>
          {resolvedUrl && (
            <a
              href={resolvedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              title="Open in new tab"
            >
              ↗ Full screen
            </a>
          )}
        </div>
      </div>

      {/* PDF viewer / fallback */}
      <div className="flex-1 min-h-0">
        {resolvedUrl ? (
          isPdf ? (
            <iframe
              src={resolvedUrl}
              className="w-full h-full border-0"
              title={doc.title}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
              <p className="text-sm">Preview not available for this file type.</p>
              <a
                href={resolvedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white transition-colors"
              >
                📥 Download / Open
              </a>
            </div>
          )
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No file attached to this document.
          </div>
        )}
      </div>
    </div>
  )
}
