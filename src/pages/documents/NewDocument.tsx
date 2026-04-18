

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { useRole } from '@/lib/useRole'

const CATEGORIES = ['Policy', 'Procedure', 'Form', 'Training', 'Reference']
const EXPIRES_OPTIONS = [
  { label: '1 day', days: 1 }, { label: '3 days', days: 3 },
  { label: '1 week', days: 7 }, { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 }, { label: 'Never', days: 0 },
]

export default function NewDocumentPage() {
  const supabase = createClient()
  const navigate = useNavigate()
  const { isAdmin, loading: roleLoading } = useRole()
  const fileRef = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [error, setError] = useState('')

  // Redirect field users — admin only
  useEffect(() => {
    if (!roleLoading && !isAdmin) navigate('/documents', { replace: true })
  }, [roleLoading, isAdmin])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Policy',
    version: '',
    audience: 'all',
  })

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      if (!form.title) set('title', file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title) { setError('Title is required'); return }
    setSubmitting(true); setError('')

    let fileUrl: string | null = null
    let fileName: string | null = null
    let fileSize: number | null = null

    if (selectedFile) {
      setUploadProgress('Uploading file...')
      const path = `${Date.now()}-${selectedFile.name}`
      const { data, error: upErr } = await supabase.storage
        .from('documents')
        .upload(path, selectedFile)
      if (upErr) { setError('Upload failed: ' + upErr.message); setSubmitting(false); return }
      // Store the storage path — resolved via signed URL on read
      fileUrl = data.path
      fileName = selectedFile.name
      fileSize = selectedFile.size
    }

    setUploadProgress('Saving...')
    const { data: { user } } = await supabase.auth.getUser()
    const { error: dbErr } = await supabase.from('documents').insert({
      ...form,
      file_url: fileUrl,
      file_name: fileName,
      file_size: fileSize,
      uploaded_by: user?.email || 'Unknown',
    })

    if (dbErr) { setError(dbErr.message); setSubmitting(false); return }
    navigate('/documents')
  }

  const inputCls = 'w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500'
  const labelCls = 'block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1'

  return (
    <div className="p-6 md:p-8 max-w-lg mt-8 md:mt-0 pb-16">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/documents" className="text-gray-500 hover:text-white text-sm">← Documents</Link>
        <h1 className="text-2xl font-bold">Upload Document</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="theme-card rounded-xl p-4 border space-y-4">

          {/* File upload */}
          <div>
            <label className={labelCls}>File (optional)</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-700 hover:border-red-500 rounded-xl p-6 text-center cursor-pointer transition-colors">
              {selectedFile ? (
                <div>
                  <p className="text-sm text-white font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div>
                  <p className="text-2xl mb-2">📄</p>
                  <p className="text-sm text-gray-400">Click to select PDF, Word, or image file</p>
                  <p className="text-xs text-gray-600 mt-1">Max 50MB</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png"
              onChange={handleFileSelect} />
          </div>

          <div>
            <label className={labelCls}>Title *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={2} className={inputCls + ' resize-none'} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} className={inputCls}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Version</label>
              <input value={form.version} onChange={e => set('version', e.target.value)}
                className={inputCls} placeholder="e.g. 1.0" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Audience</label>
            <select value={form.audience} onChange={e => set('audience', e.target.value)} className={inputCls}>
              <option value="all">All Employees</option>
              <option value="providers">Providers Only</option>
              <option value="ems">EMS Staff Only</option>
              <option value="admin">Admin Only</option>
            </select>
          </div>
        </div>

        {error && <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">{error}</div>}
        {uploadProgress && <p className="text-xs text-gray-500 text-center">{uploadProgress}</p>}

        <button type="submit" disabled={submitting}
          className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white font-bold rounded-xl transition-colors">
          {submitting ? 'Uploading...' : 'Upload Document'}
        </button>
      </form>
    </div>
  )
}
