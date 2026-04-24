

import React, { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Link, useNavigate, useMatch } from 'react-router-dom'

const DocThumbnail = React.lazy(() => import('@/components/DocThumbnail'))
import { useUserAssignment } from '@/lib/useUserAssignment'
import { usePermission } from '@/hooks/usePermission'
import { PageHeader, LoadingSkeleton, EmptyState, ConfirmDialog, SortBar } from '@/components/ui'
import { useSortable } from '@/hooks/useSortable'

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
  active: boolean
  audience: string
}

const CAT_COLORS: Record<string, string> = {
  'Policy': 'bg-blue-900 text-blue-300',
  'Procedure': 'bg-green-900 text-green-300',
  'Form': 'bg-purple-900 text-purple-300',
  'Training': 'bg-orange-900 text-orange-300',
  'Reference': 'bg-gray-700 text-gray-300',
}

export default function DocumentsPage() {
  const supabase = createClient()
  const assignment = useUserAssignment()
  const isAdmin = usePermission('admin.documents')
  const navigate = useNavigate()
  const detailMatch = useMatch('/documents/:id')
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [isOfflineData, setIsOfflineData] = useState(false)
  const [catFilter, setCatFilter] = useState('All')
  const [search, setSearch] = useState('')

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ action: () => void; title: string; message: string; confirmLabel?: string; icon?: string; confirmColor?: string } | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('active', true)
          .order('category')
          .order('title')
        if (error) throw error
        setDocs(data || [])
      } catch {
        setIsOfflineData(true)
      }
      setLoading(false)
    }
    load()
  }, [])

  type DocSortKey = 'title' | 'category' | 'uploaded_at'
  const { sortKey: docSortKey, sortDir: docSortDir, toggleSort: docToggleSort, sortFn: docSortFn } = useSortable<DocSortKey>('title', 'asc')

  const categories = ['All', ...Array.from(new Set(docs.map(d => d.category))).sort()]
  const filtered = docSortFn(docs.filter(d => {
    if (catFilter !== 'All' && d.category !== catFilter) return false
    if (search && !d.title.toLowerCase().includes(search.toLowerCase()) &&
        !d.description?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), (d, key) => {
    if (key === 'title') return d.title
    if (key === 'category') return d.category
    if (key === 'uploaded_at') return d.uploaded_at
    return ''
  })

  const handleDelete = (doc: Doc) => {
    setConfirmAction({
      action: async () => {
        setDeletingId(doc.id)
        await supabase.from('documents').update({ active: false }).eq('id', doc.id)
        setDocs(prev => prev.filter(d => d.id !== doc.id))
        setDeletingId(null)
      },
      title: 'Delete Document',
      message: `Delete "${doc.title}"? This cannot be undone.`,
      icon: '🗑️',
      confirmColor: 'bg-red-600 hover:bg-red-700',
    })
  }

  return (
    <div className="p-4 md:p-6 mt-8 md:mt-0">
      {isOfflineData && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-lg px-3 py-2 text-amber-300 text-xs mb-4 flex items-center gap-2">
          📶 Documents require a connection to load. Reconnect to view.
        </div>
      )}
      <PageHeader
        title="Policies & Procedures"
        subtitle={`${filtered.length} documents`}
        actions={isAdmin ? (
          <Link to="/documents/new"
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-semibold transition-colors">
            + Upload Document
          </Link>
        ) : undefined}
        className="mb-6"
      />

      {/* Filters */}
      <div className="space-y-3 mb-5">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search documents..."
          className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-600" />
        <div className="flex gap-2 flex-wrap">
          {categories.map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${catFilter === c ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {c}
            </button>
          ))}
        </div>
        <SortBar
          options={[{ label: 'Name', key: 'title' }, { label: 'Category', key: 'category' }, { label: 'Date', key: 'uploaded_at' }]}
          currentKey={docSortKey}
          currentDir={docSortDir}
          onToggle={docToggleSort}
        />
      </div>

      {loading ? (
        <LoadingSkeleton rows={4} header />
      ) : filtered.length === 0 ? (
        <EmptyState icon="📄" message="No documents found." />
      ) : (
        <div className="space-y-2">
          {filtered.map(doc => (
            <div key={doc.id}
              onClick={() => doc.file_url && navigate(`/documents/${doc.id}`)}
              className={`bg-gray-900 rounded-xl border p-4 flex items-start gap-4 transition-colors ${
                detailMatch?.params?.id === doc.id
                  ? 'border-red-600 bg-gray-800'
                  : doc.file_url ? 'border-gray-800 hover:border-gray-600 cursor-pointer' : 'border-gray-800'
              }`}>
              {/* Thumbnail */}
              {doc.file_url && (
                <div className="shrink-0">
                  <DocThumbnail url={doc.file_url} fileName={doc.file_name} width={80} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-white">{doc.title}</h2>
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
              <div className="flex gap-2 shrink-0 flex-col items-end" onClick={e => e.stopPropagation()}>
                {!doc.file_url && (
                  <span className="px-3 py-1.5 bg-gray-800 rounded-lg text-xs text-gray-500">No file</span>
                )}
                {doc.file_name === 'RAM-Employee-Handbook-2026-CA.pdf' && (
                  <Link to="/documents/handbook"
                    className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-lg text-xs font-semibold transition-colors whitespace-nowrap">
                    ✍️ Sign
                  </Link>
                )}
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(doc)}
                    disabled={deletingId === doc.id}
                    className="px-3 py-1.5 bg-red-950 hover:bg-red-900 text-red-400 hover:text-red-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {deletingId === doc.id ? '...' : '🗑️'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    {/* Admin: handbook signing tracker */}
      {isAdmin && (
        <HandbookSigningTracker />
      )}
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        icon={confirmAction?.icon || '⚠️'}
        confirmColor={confirmAction?.confirmColor}
        onConfirm={() => { confirmAction?.action(); setConfirmAction(null) }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}

function HandbookSigningTracker() {
  const supabase = createClient()
  const [acks, setAcks] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    Promise.all([
      supabase.from('handbook_acknowledgments').select('*, employee:employees(name, role)').eq('handbook_version', '2026').order('signed_at', { ascending: false }),
      supabase.from('employees').select('id, name, role').eq('status', 'Active').order('name'),
    ]).then(([{ data: a }, { data: e }]) => {
      setAcks(a || [])
      setEmployees(e || [])
    })
  }, [open])

  const signedIds = new Set(acks.map((a: any) => a.employee_id))
  const unsigned = employees.filter(e => !signedIds.has(e.id))

  return (
    <div className="mt-8">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-400 hover:text-white transition-colors">
        ✍️ Handbook Signing Status {open ? '▾' : '▸'}
      </button>
      {open && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="theme-card rounded-xl border p-4">
            <h3 className="text-xs font-bold text-green-400 uppercase tracking-wide mb-3">✅ Signed ({acks.length})</h3>
            {acks.length === 0 ? <p className="text-xs text-gray-600">None yet</p> : (
              <div className="space-y-1.5">
                {acks.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between">
                    <span className="text-sm text-white">{a.employee?.name}</span>
                    <span className="text-xs text-gray-500">{new Date(a.signed_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="theme-card rounded-xl border p-4">
            <h3 className="text-xs font-bold text-red-400 uppercase tracking-wide mb-3">⏳ Not Yet Signed ({unsigned.length})</h3>
            {unsigned.length === 0 ? <p className="text-xs text-green-500">All employees have signed! ✓</p> : (
              <div className="space-y-1.5">
                {unsigned.map((e: any) => (
                  <div key={e.id} className="flex items-center justify-between">
                    <span className="text-sm text-white">{e.name}</span>
                    <span className="text-xs text-gray-500">{e.role}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}