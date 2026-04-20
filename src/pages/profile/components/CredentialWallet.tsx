import { EmptyState } from '@/components/ui'

interface Props {
  creds: any[]
  credSignedUrls: Record<string, string>
  previewUrl: string | null
  setPreviewUrl: (url: string | null) => void
  previewName: string
  setPreviewName: (name: string) => void
}

export function CredentialWallet({ creds, credSignedUrls, setPreviewUrl, setPreviewName }: Props) {
  return (
    <div className="theme-card rounded-xl border mb-4 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">My Credential Wallet</h2>
        <span className="text-xs text-gray-600">{creds.length} file{creds.length !== 1 ? 's' : ''}</span>
      </div>
      {creds.length === 0 ? (
        <EmptyState icon="📄" message="No credentials uploaded yet." className="py-6" />
      ) : (
        <div className="divide-y divide-gray-800/60">
          {creds.map(c => {
            const url = credSignedUrls[c.id]
            const isImage = c.file_name && /\.(jpg|jpeg|png|heic|webp)$/i.test(c.file_name)
            const expStr = c.expiration_date ? ` · exp ${String(c.expiration_date).slice(0,7)}` : ''
            const isExpired = c.expiration_date && new Date(c.expiration_date) < new Date()
            return (
              <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                {url && isImage ? (
                  <div className="w-10 h-10 rounded overflow-hidden shrink-0 bg-gray-800">
                    <img src={url} alt={c.cert_type} className="w-full h-full object-cover" style={{ imageOrientation: 'from-image' }} />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded bg-gray-800 flex items-center justify-center shrink-0">
                    <span className="text-lg">{isImage ? '🖼️' : '📄'}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isExpired ? 'text-red-400' : 'text-white'}`}>
                    {c.cert_type}
                    {isExpired && <span className="ml-1.5 text-xs bg-red-900/60 text-red-300 px-1.5 py-0.5 rounded">EXPIRED</span>}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{c.file_name}{expStr}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {url ? (
                    <>
                      <button
                        onClick={() => {
                          if (window.innerWidth >= 768) {
                            setPreviewUrl(url)
                            setPreviewName(c.file_name || c.cert_type || 'Document')
                          } else {
                            window.open(url, '_blank')
                          }
                        }}
                        className="text-xs px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                        title="View">View</button>
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(url)
                            const blob = await res.blob()
                            const fileName = c.file_name || 'credential.pdf'
                            const a = document.createElement('a')
                            a.href = URL.createObjectURL(blob)
                            a.download = fileName
                            document.body.appendChild(a)
                            a.click()
                            document.body.removeChild(a)
                            URL.revokeObjectURL(a.href)
                          } catch {
                            window.open(url, '_blank')
                          }
                        }}
                        className="text-xs px-2.5 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                        title="Download">⬇ Save</button>
                    </>
                  ) : (
                    <span className="text-xs text-gray-500 italic">{c.file_name ? 'File missing — re-upload' : 'No file uploaded'}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
