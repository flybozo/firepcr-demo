import type { VehicleDoc } from './types'
import { useListStyle } from '@/hooks/useListStyle'
import { getListClasses } from '@/lib/listStyles'

const DOC_TYPES = ['Registration', 'Title', 'Insurance', 'Inspection', 'Smog Certificate', 'Photo', 'VIN Sticker', 'Other']

type Props = {
  vehicleDocs: VehicleDoc[]
  vehicleDocUrls: Record<string, string>
  docType: string
  uploadingDoc: boolean
  onDocTypeChange: (type: string) => void
  onDocUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export default function VehicleDocuments({ vehicleDocs, vehicleDocUrls, docType, uploadingDoc, onDocTypeChange, onDocUpload }: Props) {
  const listStyle = useListStyle()
  const lc = getListClasses(listStyle)
  return (
    <div className={lc.container}>
      <div className="px-4 py-3 bg-gray-800 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Vehicle Documents</h2>
        <span className="text-xs text-gray-600">{vehicleDocs.length} files</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <select value={docType} onChange={e => onDocTypeChange(e.target.value)}
            className="bg-gray-800 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none">
            {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          <label className="flex-1 flex items-center justify-center px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-medium cursor-pointer transition-colors">
            {uploadingDoc ? 'Uploading...' : '📎 Upload Document / Photo'}
            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.heic"
              onChange={onDocUpload} disabled={uploadingDoc} />
          </label>
        </div>
        {vehicleDocs.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-2">No documents uploaded yet.</p>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {vehicleDocs.map(doc => (
              <div key={doc.id} className="flex items-center justify-between py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white">{doc.doc_type}</p>
                  <p className="text-xs text-gray-500 truncate">{doc.file_name || 'Document'}</p>
                </div>
                <a href={vehicleDocUrls[doc.id] || doc.file_url} target="_blank" rel="noopener noreferrer"
                  className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-blue-400 hover:text-blue-300 transition-colors shrink-0 ml-2">
                  Open
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
