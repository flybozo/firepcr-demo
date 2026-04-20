import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateEmployee } from '@/lib/services/employees'

interface Props {
  employee: any
  onEmployeeUpdate: (updates: any) => void
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

export function HeadshotSection({ employee, onEmployeeUpdate, onSuccess, onError }: Props) {
  const supabase = createClient()
  const headshotRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !employee?.id) return
    setUploading(true); onError('')
    const ext = file.name.split('.').pop()
    const path = `${employee.id}/headshot.${ext}`
    const { data, error: upErr } = await supabase.storage.from('headshots').upload(path, file, { upsert: true })
    if (upErr) { onError('Upload failed: ' + upErr.message); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('headshots').getPublicUrl(data.path)
    await updateEmployee(employee.id, { headshot_url: urlData.publicUrl })
    onEmployeeUpdate({ headshot_url: urlData.publicUrl })
    onSuccess('Headshot updated')
    setUploading(false)
  }

  return (
    <div className="theme-card rounded-xl p-4 border mb-4 space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Headshot</h2>
      <div className="flex items-center gap-4">
        {employee.headshot_url ? (
          <img src={employee.headshot_url} alt="Headshot" className="w-20 h-20 rounded-full object-cover border-2 border-gray-600" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center text-3xl">👤</div>
        )}
        <div>
          <button onClick={() => headshotRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors">
            {uploading ? 'Uploading...' : 'Upload Photo'}
          </button>
          <p className="text-xs text-gray-500 mt-1">JPG or PNG, max 10MB</p>
          <input ref={headshotRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        </div>
      </div>
    </div>
  )
}
