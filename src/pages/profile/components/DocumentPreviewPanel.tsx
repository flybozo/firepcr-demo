interface Props {
  previewUrl: string
  previewName: string
  onClose: () => void
}

export function DocumentPreviewPanel({ previewUrl, previewName, onClose }: Props) {
  return (
    <div className="hidden md:flex flex-col flex-1 min-w-0 mt-8 sticky top-8 h-[calc(100vh-6rem)]">
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-800 rounded-t-xl">
        <span className="text-xs font-bold uppercase tracking-wide text-gray-400 flex-1 truncate">{previewName}</span>
        <a href={previewUrl} target="_blank" rel="noopener noreferrer"
          className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition-colors">↗ New Tab</a>
        <button onClick={onClose}
          className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition-colors">✕ Close</button>
      </div>
      {/\.(jpg|jpeg|png|webp|heic)$/i.test(previewName) ? (
        <div className="flex-1 bg-gray-950 border border-t-0 border-gray-800 rounded-b-xl overflow-auto flex items-center justify-center p-4">
          <img src={previewUrl} alt={previewName} className="max-w-full max-h-full object-contain rounded" style={{ imageOrientation: 'from-image' }} />
        </div>
      ) : (
        <iframe
          src={previewUrl}
          title={previewName}
          className="flex-1 bg-white border border-t-0 border-gray-800 rounded-b-xl"
        />
      )}
    </div>
  )
}
