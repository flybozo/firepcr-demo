

import { useEffect, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { resolveStorageUrl } from '@/lib/storage'

// Use local worker copy shipped with pdfjs-dist
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

type Props = {
  url: string
  bucket?: string
  fileName?: string | null
  width?: number
}

export default function DocThumbnail({ url, bucket = 'documents', fileName, width = 160 }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)

  useEffect(() => {
    resolveStorageUrl(bucket, url).then(u => setResolvedUrl(u))
  }, [url, bucket])

  // Only render PDF thumbnails for PDFs
  const isPdf = !fileName || /\.pdf$/i.test(fileName)
  const isImage = fileName && /\.(jpg|jpeg|png|webp|gif)$/i.test(fileName)

  if (!resolvedUrl && !error) {
    return (
      <div className="shrink-0 rounded-lg border border-gray-700 bg-gray-800 flex items-center justify-center text-gray-600 text-xs"
        style={{ width, height: Math.round(width * 1.3) }}>
        Loading...
      </div>
    )
  }

  if (isImage) {
    return (
      <div className="shrink-0 rounded-lg overflow-hidden border border-gray-700 bg-gray-800"
        style={{ width, height: Math.round(width * 1.3) }}>
        <img src={resolvedUrl || url} alt={fileName || 'Preview'} className="w-full h-full object-cover" />
      </div>
    )
  }

  if (!isPdf || error) {
    return (
      <div className="shrink-0 rounded-lg border border-gray-700 bg-gray-800 flex items-center justify-center text-3xl"
        style={{ width, height: Math.round(width * 1.3) }}>
        📄
      </div>
    )
  }

  return (
    <div
      className="shrink-0 rounded-lg overflow-hidden border border-gray-700 bg-gray-800 relative"
      style={{ width, height: Math.round(width * 1.3) }}
    >
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-xs">
          Loading...
        </div>
      )}
      <Document
        file={resolvedUrl || url}
        onLoadSuccess={() => setLoaded(true)}
        onLoadError={() => setError(true)}
        loading=""
        className="w-full h-full"
      >
        <Page
          pageNumber={1}
          width={width}
          renderAnnotationLayer={false}
          renderTextLayer={false}
          className="rounded-lg"
        />
      </Document>
    </div>
  )
}
