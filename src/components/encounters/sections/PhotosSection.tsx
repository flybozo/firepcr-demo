import { Link } from 'react-router-dom'
import type { Encounter, PatientPhoto } from '@/types/encounters'

export function PhotosSection({
  enc,
  photos,
  photoSignedUrls,
}: {
  enc: Encounter
  photos: PatientPhoto[]
  photoSignedUrls: Record<string, string>
}) {
  return (
    <div className="theme-card rounded-xl border overflow-hidden h-full">
      <div className="flex items-center justify-between px-4 pr-10 py-3 theme-card-header border-b">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Photos {photos.length > 0 && <span className="text-gray-600 font-normal normal-case ml-1">({photos.length})</span>}
        </h2>
        <Link to={`/encounters/photos/new?encounterId=${enc.encounter_id}`}
          className="text-xs px-2.5 py-1 bg-red-600 hover:bg-red-700 rounded-lg text-white font-semibold transition-colors flex items-center gap-1">
          <span>+</span> Photo
        </Link>
      </div>
      {photos.length === 0 ? (
        <p className="px-4 py-3 text-sm text-gray-600">No photos yet.</p>
      ) : (
        <div className="p-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map(ph => (
            <a key={ph.id} href={photoSignedUrls[ph.id] || '#'} target="_blank" rel="noopener noreferrer"
              className="aspect-square rounded-lg overflow-hidden bg-gray-800 hover:opacity-80 transition-opacity relative group">
              {photoSignedUrls[ph.id] ? (
                <img src={photoSignedUrls[ph.id]} alt={ph.caption || 'Photo'} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-2xl animate-pulse">🖼️</span>
                </div>
              )}
              {ph.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-xs text-white truncate opacity-0 group-hover:opacity-100 transition-opacity">
                  {ph.caption}
                </div>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
