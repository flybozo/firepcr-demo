import { useState } from 'react'
import { toast } from '@/lib/toast'
import { useOfflineWrite } from '@/lib/useOfflineWrite'
import { getIsOnline } from '@/lib/syncManager'
import { queueOfflineWrite } from '@/lib/offlineStore'
import * as encounterService from '@/lib/services/encounters'
import PinSignature from '@/components/PinSignature'
import type { SignatureRecord } from '@/components/PinSignature'
import type { Encounter } from '@/types/encounters'
import { ConfirmDialog } from '@/components/ui'

export function ProgressNotesSection({
  enc,
  currentUser,
  isAdmin,
  isSigned,
  progressNotes,
  setProgressNotes,
}: {
  enc: Encounter
  currentUser: any
  isAdmin: boolean
  isSigned: boolean
  progressNotes: any[]
  setProgressNotes: (updater: (prev: any[]) => any[]) => void
}) {
  const { write } = useOfflineWrite()
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [showNotePinModal, setShowNotePinModal] = useState(false)
  const [noteToSign, setNoteToSign] = useState<string | null>(null)
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(new Set())
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null)

  const loadNotes = async () => {
    const encId = enc?.encounter_id
    if (!encId) return
    const { data } = await encounterService.queryProgressNotes(encId)
    setProgressNotes(() => data || [])
  }

  const saveProgressNote = async (signedRecord?: SignatureRecord) => {
    if (!noteDraft.trim() || !enc) return
    setNoteSaving(true)
    const myName = currentUser.employee?.name || 'Unknown'
    const myRole = currentUser.employee?.role || ''
    const now = new Date().toISOString()
    const notePayload = {
      encounter_id: enc.encounter_id,
      encounter_uuid: enc.id,
      note_text: noteDraft.trim(),
      author_name: myName,
      author_role: myRole,
      note_datetime: now,
      signed_at: signedRecord ? signedRecord.signedAt : null,
      signed_by: signedRecord ? signedRecord.employeeName : null,
    }
    if (getIsOnline()) {
      await encounterService.createProgressNote(notePayload)
    } else {
      await queueOfflineWrite('progress_notes', 'insert', notePayload)
    }
    setNoteDraft('')
    setShowNoteForm(false)
    setNoteSaving(false)
    loadNotes()
  }

  const deleteNote = async (noteId: string) => {
    const now = new Date().toISOString()
    const deletedBy = currentUser.employee?.name || 'Unknown'
    if (getIsOnline()) {
      const { error } = await encounterService.updateProgressNote(noteId, { deleted_at: now, deleted_by: deletedBy })
      if (error) { toast.error('Delete failed: ' + error.message); return }
    } else {
      await queueOfflineWrite('progress_notes', 'update', { id: noteId, deleted_at: now, deleted_by: deletedBy })
    }
    setProgressNotes(prev => prev.filter(n => n.id !== noteId))
  }

  return (
    <>
      <div className="theme-card rounded-xl border overflow-hidden h-full">
        <div className="flex items-center justify-between px-4 pr-10 py-3 border-b theme-card-header">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">
            📝 Progress Notes {progressNotes.length > 0 && <span className="text-gray-500 font-normal normal-case ml-1">({progressNotes.length})</span>}
          </h3>
          {!showNoteForm && (
            <button onClick={() => setShowNoteForm(true)}
              className="text-xs px-2.5 py-1 bg-red-600 hover:bg-red-700 rounded-lg text-white font-semibold transition-colors">
              + {isSigned ? 'Addendum' : 'Note'}
            </button>
          )}
        </div>
        {showNoteForm && (
          <div className="p-4 border-b theme-card-header space-y-3">
            <textarea
              value={noteDraft}
              onChange={e => setNoteDraft(e.target.value)}
              placeholder="Enter progress note..."
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
              autoFocus
            />
            {isSigned && (
              <p className="text-xs text-amber-400">📎 This will be added as a signed addendum to the locked chart.</p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowNotePinModal(true)} disabled={!noteDraft.trim() || noteSaving}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg">
                {noteSaving ? 'Saving...' : '🔐 Save & Sign'}
              </button>
              <button onClick={() => saveProgressNote()} disabled={!noteDraft.trim() || noteSaving}
                className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 text-sm rounded-lg">
                Save Unsigned
              </button>
              <button onClick={() => { setShowNoteForm(false); setNoteDraft('') }}
                className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded-lg">Cancel</button>
            </div>
          </div>
        )}
        {progressNotes.length === 0 && !showNoteForm ? (
          <p className="px-4 py-6 text-sm text-gray-600 text-center">No progress notes yet.</p>
        ) : (
          <div className="divide-y divide-gray-800/60">
            {progressNotes.map((note: any) => {
              const isExpanded = expandedNoteIds.has(note.id)
              const toggleNote = (e: React.MouseEvent) => {
                e.stopPropagation()
                setExpandedNoteIds(prev => {
                  const next = new Set(prev)
                  if (next.has(note.id)) next.delete(note.id)
                  else next.add(note.id)
                  return next
                })
              }
              return (
                <div key={note.id} className="px-4 py-3 cursor-pointer hover:bg-gray-800/40 transition-colors" onClick={toggleNote}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-400 font-medium">{note.author_name}</span>
                    {note.author_role && <span className="text-xs text-gray-600">({note.author_role})</span>}
                    <span className="text-xs text-gray-600">·</span>
                    <span className="text-xs text-gray-500">{new Date(note.note_datetime).toLocaleString()}</span>
                    {note.signed_at ? (
                      <span className="text-xs px-1.5 py-0.5 bg-green-900 text-green-400 rounded">✓ Signed</span>
                    ) : (
                      <span className="text-xs px-1.5 py-0.5 bg-orange-900 text-orange-400 rounded">Unsigned</span>
                    )}
                    <span className="text-gray-600 text-xs ml-auto">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                  {isExpanded && (
                    <div className="mt-2 space-y-2">
                      <p className="text-sm text-white whitespace-pre-wrap">{note.note_text}</p>
                      <div className="flex gap-3">
                        {!note.signed_at && note.author_name === currentUser.employee?.name && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setNoteToSign(note.id) }}
                            className="text-xs text-green-400 hover:text-green-300 transition-colors">
                            🔐 Sign this note
                          </button>
                        )}
                        {!note.signed_at && (isAdmin || note.author_name === currentUser.employee?.name) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setNoteToDelete(note.id) }}
                            className="text-xs text-gray-500 hover:text-red-400 transition-colors">
                            🗑️ Delete
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* PIN modal — Sign new progress note on save */}
      {showNotePinModal && currentUser.employee && (
        <PinSignature
          label="Sign Progress Note"
          mode="self"
          employeeId={currentUser.employee.id}
          employeeName={currentUser.employee.name}
          documentContext={`note:${enc?.encounter_id || enc.id}`}
          onSign={(record) => { setShowNotePinModal(false); saveProgressNote(record) }}
          onCancel={() => setShowNotePinModal(false)}
        />
      )}

      {/* PIN modal — Sign existing unsigned note */}
      {noteToSign && currentUser.employee && (
        <PinSignature
          label="Sign Progress Note"
          mode="self"
          employeeId={currentUser.employee.id}
          employeeName={currentUser.employee.name}
          documentContext={`note:${noteToSign}`}
          onSign={async (record) => {
            await write('progress_notes', 'update', { id: noteToSign, signed_at: record.signedAt, signed_by: record.employeeName })
            setNoteToSign(null)
            loadNotes()
            try { const { refreshUnsignedCounts } = await import('@/lib/useUnsignedPCRCount'); refreshUnsignedCounts() } catch {}
          }}
          onCancel={() => setNoteToSign(null)}
        />
      )}

      {/* Confirm delete dialog for unsigned notes */}
      <ConfirmDialog
        open={!!noteToDelete}
        title="Delete unsigned note?"
        message="This note has not been signed and will be permanently removed."
        confirmLabel="Delete"
        onConfirm={() => { if (noteToDelete) deleteNote(noteToDelete); setNoteToDelete(null) }}
        onCancel={() => setNoteToDelete(null)}
      />
    </>
  )
}
