

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePermission } from '@/hooks/usePermission'
import { PageHeader, EmptyState } from '@/components/ui'
import OfflineGate from '@/components/OfflineGate'

type Contact = {
  id: string
  org_id: string | null
  name: string
  role: string | null
  title: string | null
  agency: string | null
  agency_type: string | null
  email: string | null
  phone: string | null
  satellite_phone: string | null
  radio_frequency: string | null
  notes: string | null
  last_incident: string | null
  tags: string[] | null
  created_at: string
}

const AGENCY_TYPES = ['Federal', 'State', 'Local', 'Contract', 'Other']

const TAG_COLORS = [
  'bg-red-900/60 text-red-300',
  'bg-blue-900/60 text-blue-300',
  'bg-green-900/60 text-green-300',
  'bg-yellow-900/60 text-yellow-300',
  'bg-purple-900/60 text-purple-300',
  'bg-orange-900/60 text-orange-300',
]

function tagColor(tag: string) {
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
}

// ─── Contact modal ────────────────────────────────────────────────────────────
function ContactModal({
  contact,
  orgId,
  onClose,
  onSaved,
}: {
  contact: Contact | null
  orgId: string | null
  onClose: () => void
  onSaved: (c: Contact) => void
}) {
  const supabase = createClient()
  const [form, setForm] = useState<Partial<Contact>>(
    contact ?? { org_id: orgId, tags: [] }
  )
  const [saving, setSaving] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const set = (key: keyof Contact, val: string | string[] | null) =>
    setForm(prev => ({ ...prev, [key]: val }))

  const addTag = () => {
    const t = tagInput.trim()
    if (!t) return
    const existing = form.tags ?? []
    if (!existing.includes(t)) set('tags', [...existing, t])
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    set('tags', (form.tags ?? []).filter(t => t !== tag))
  }

  const save = async () => {
    if (!form.name?.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError(null)

    const payload = {
      org_id: form.org_id ?? orgId,
      name: form.name.trim(),
      role: form.role || null,
      title: form.title || null,
      agency: form.agency || null,
      agency_type: form.agency_type || null,
      email: form.email || null,
      phone: form.phone || null,
      satellite_phone: form.satellite_phone || null,
      radio_frequency: form.radio_frequency || null,
      notes: form.notes || null,
      last_incident: form.last_incident || null,
      tags: form.tags?.length ? form.tags : null,
      updated_at: new Date().toISOString(),
    }

    let result: Contact | null = null
    if (contact?.id) {
      const { data, error: err } = await supabase
        .from('contacts')
        .update(payload)
        .eq('id', contact.id)
        .select()
        .single()
      if (err) { setError(err.message); setSaving(false); return }
      result = data as unknown as Contact
    } else {
      const { data, error: err } = await supabase
        .from('contacts')
        .insert(payload)
        .select()
        .single()
      if (err) { setError(err.message); setSaving(false); return }
      result = data as unknown as Contact
    }

    setSaving(false)
    if (result) onSaved(result)
  }

  const fieldCls = "bg-gray-800 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500 w-full placeholder-gray-600"
  const labelCls = "text-xs text-gray-500 mb-1 block"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-gray-900 z-10">
          <h2 className="text-lg font-bold">{contact ? 'Edit Contact' : 'Add Contact'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {error && <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg p-3">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Name *</label>
              <input className={fieldCls} value={form.name ?? ''} onChange={e => set('name', e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <label className={labelCls}>Role / Position</label>
              <input className={fieldCls} value={form.role ?? ''} onChange={e => set('role', e.target.value)} placeholder="e.g. Med Unit Leader" />
            </div>
            <div>
              <label className={labelCls}>Title</label>
              <input className={fieldCls} value={form.title ?? ''} onChange={e => set('title', e.target.value)} placeholder="e.g. Battalion Chief" />
            </div>
            <div>
              <label className={labelCls}>Agency</label>
              <input className={fieldCls} value={form.agency ?? ''} onChange={e => set('agency', e.target.value)} placeholder="e.g. USFS" />
            </div>
            <div>
              <label className={labelCls}>Agency Type</label>
              <select
                className={fieldCls}
                value={form.agency_type ?? ''}
                onChange={e => set('agency_type', e.target.value || null)}
              >
                <option value="">— Select —</option>
                {AGENCY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input className={fieldCls} type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)} placeholder="email@example.com" />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input className={fieldCls} type="tel" value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} placeholder="(555) 555-5555" />
            </div>
            <div>
              <label className={labelCls}>Satellite Phone</label>
              <input className={fieldCls} type="tel" value={form.satellite_phone ?? ''} onChange={e => set('satellite_phone', e.target.value)} placeholder="Iridium / InReach" />
            </div>
            <div>
              <label className={labelCls}>Radio Frequency</label>
              <input className={fieldCls} value={form.radio_frequency ?? ''} onChange={e => set('radio_frequency', e.target.value)} placeholder="e.g. 168.075 MHz" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Last Incident</label>
              <input className={fieldCls} value={form.last_incident ?? ''} onChange={e => set('last_incident', e.target.value)} placeholder="e.g. Dixie Fire 2021" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Notes</label>
              <textarea
                className="bg-gray-800 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500 w-full placeholder-gray-600 resize-none"
                rows={3}
                value={form.notes ?? ''}
                onChange={e => set('notes', e.target.value)}
                placeholder="Any additional notes…"
              />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Tags</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(form.tags ?? []).map(tag => (
                  <span key={tag} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tagColor(tag)}`}>
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="hover:opacity-70">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className={fieldCls}
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                  placeholder="Add a tag and press Enter"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-sm shrink-0"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-gray-800 flex gap-3 justify-end sticky bottom-0 bg-gray-900">
          <button onClick={onClose} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:bg-gray-700 rounded-lg text-sm font-semibold"
          >
            {saving ? 'Saving…' : contact ? 'Save Changes' : 'Add Contact'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Contact card ─────────────────────────────────────────────────────────────
function ContactCard({
  contact,
  isAdmin,
  onEdit,
  onDelete,
}: {
  contact: Contact
  isAdmin: boolean
  onEdit: (c: Contact) => void
  onDelete: (id: string) => void
}) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white truncate">{contact.name}</p>
          {contact.role && <p className="text-sm text-gray-400 truncate">{contact.role}</p>}
          {contact.title && contact.title !== contact.role && (
            <p className="text-xs text-gray-500 truncate">{contact.title}</p>
          )}
          {contact.agency && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {contact.agency}
              {contact.agency_type && (
                <span className="ml-1.5 text-gray-600">({contact.agency_type})</span>
              )}
            </p>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => onEdit(contact)}
            className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors text-xs"
            title="Edit"
          >
            ✏️
          </button>
          {isAdmin && !confirming && (
            <button
              onClick={() => setConfirming(true)}
              className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors text-xs"
              title="Delete"
            >
              🗑️
            </button>
          )}
          {isAdmin && confirming && (
            <div className="flex gap-1">
              <button onClick={() => onDelete(contact.id)} className="px-2 py-1 bg-red-800 hover:bg-red-700 rounded text-xs">Delete</button>
              <button onClick={() => setConfirming(false)} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">No</button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-1">
        {contact.phone && (
          <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
            <span>📞</span> {contact.phone}
          </a>
        )}
        {contact.satellite_phone && (
          <a href={`tel:${contact.satellite_phone}`} className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300">
            <span>🛰️</span> {contact.satellite_phone}
          </a>
        )}
        {contact.email && (
          <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 truncate">
            <span>✉️</span> <span className="truncate">{contact.email}</span>
          </a>
        )}
        {contact.radio_frequency && (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <span>📻</span> {contact.radio_frequency}
          </p>
        )}
        {contact.last_incident && (
          <p className="text-xs text-gray-600 mt-1">🔥 {contact.last_incident}</p>
        )}
      </div>

      {contact.notes && (
        <p className="mt-2 text-xs text-gray-600 line-clamp-2">{contact.notes}</p>
      )}

      {contact.tags && contact.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {contact.tags.map(tag => (
            <span key={tag} className={`px-2 py-0.5 rounded-full text-xs font-medium ${tagColor(tag)}`}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ContactsPage() {
  const supabase = createClient()
  const canRosterView = usePermission('roster.view')

  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [agencyFilter, setAgencyFilter] = useState<string>('All')
  const [modalContact, setModalContact] = useState<Contact | null | false>(false) // false = closed, null = new

  useEffect(() => {
    const load = async () => {
      try {
        const [{ data: orgData, error: orgErr }, { data: contactData, error: cErr }] = await Promise.all([
          supabase.from('organizations').select('id').limit(1).single(),
          supabase.from('contacts').select('*').order('name'),
        ])
        if (orgErr) throw orgErr
        if (cErr) throw cErr
        if (orgData) setOrgId((orgData as any).id)
        if (contactData) setContacts(contactData as unknown as Contact[])
      } catch {
        // Offline — contacts don't have a dedicated IndexedDB store yet
        setContacts([])
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleSaved = useCallback((saved: Contact) => {
    setContacts(prev => {
      const exists = prev.find(c => c.id === saved.id)
      if (exists) return prev.map(c => c.id === saved.id ? saved : c)
      return [...prev, saved].sort((a, b) => a.name.localeCompare(b.name))
    })
    setModalContact(false)
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    await supabase.from('contacts').delete().eq('id', id)
    setContacts(prev => prev.filter(c => c.id !== id))
  }, [supabase])

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase()
    const matchesSearch = !q || [c.name, c.role, c.agency, c.email, c.phone]
      .some(f => f?.toLowerCase().includes(q))
    const matchesFilter = agencyFilter === 'All' || c.agency_type === agencyFilter
    return matchesSearch && matchesFilter
  })

  return (
    <OfflineGate page message="Contacts require a connection to load.">
    <div className="p-6 md:p-8 max-w-5xl mt-8 md:mt-0">
      {/* Header */}
      <PageHeader
        title="📇 Rolodex"
        subtitle="Fire personnel contacts and agency contacts"
        actions={
          <button
            onClick={() => setModalContact(null)}
            className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-sm font-semibold"
          >
            + Add Contact
          </button>
        }
        className="mb-6"
      />

      {/* Search + Filters */}
      <div className="mb-5 space-y-3">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name, role, agency, email, phone…"
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-500 placeholder-gray-600"
        />
        <div className="flex flex-wrap gap-2">
          {['All', ...AGENCY_TYPES].map(filter => (
            <button
              key={filter}
              onClick={() => setAgencyFilter(filter)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                agencyFilter === filter
                  ? 'bg-red-700 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Contact grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse h-40" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="📇"
          message={search || agencyFilter !== 'All' ? 'No contacts match your search.' : 'No contacts yet. Add your first one!'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <ContactCard
              key={c.id}
              contact={c}
              isAdmin={canRosterView}
              onEdit={contact => setModalContact(contact)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Count */}
      {!loading && filtered.length > 0 && (
        <p className="text-xs text-gray-600 mt-4">
          Showing {filtered.length} of {contacts.length} contacts
        </p>
      )}

      {/* Modal */}
      {modalContact !== false && (
        <ContactModal
          contact={modalContact}
          orgId={orgId}
          onClose={() => setModalContact(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
    </OfflineGate>
  )
}
