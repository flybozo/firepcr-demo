

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUserAssignment } from '@/lib/useUserAssignment'
import SignatureCanvas from 'react-signature-canvas'
import { Link } from 'react-router-dom'

const HANDBOOK_VERSION = '2026'
const HANDBOOK_URL = 'https://kfkpvazkikpuwatthtow.supabase.co/storage/v1/object/public/documents/RAM-Employee-Handbook-2026-CA.pdf'

export default function HandbookAcknowledgmentPage() {
  const supabase = createClient()
  const assignment = useUserAssignment()
  const sigRef = useRef<SignatureCanvas>(null)

  const [existing, setExisting] = useState<{ signed_at: string; drive_file_url: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (assignment.loading || !assignment.employee?.id) return
    const check = async () => {
      const { data } = await supabase
        .from('handbook_acknowledgments')
        .select('signed_at, drive_file_url')
        .eq('employee_id', assignment.employee!.id)
        .eq('handbook_version', HANDBOOK_VERSION)
        .order('signed_at', { ascending: false })
        .limit(1)
        .single()
      if (data) setExisting(data)
      setLoading(false)
    }
    check()
  }, [assignment.loading, assignment.employee])

  const clearSig = () => sigRef.current?.clear()

  const handleSign = async () => {
    if (!confirmed) { setError('Please confirm you have read the handbook before signing.'); return }
    if (!sigRef.current || sigRef.current.isEmpty()) { setError('Please draw your signature before submitting.'); return }
    if (!assignment.employee?.id) { setError('No employee record found.'); return }

    setSaving(true)
    setError('')

    try {
      // Upload signature image to Supabase storage
      const dataUrl = sigRef.current.getTrimmedCanvas().toDataURL('image/png')
      const base64 = dataUrl.split(',')[1]
      const blob = await (await fetch(dataUrl)).blob()
      const sigPath = `${assignment.employee.id}/handbook-sig-${HANDBOOK_VERSION}-${Date.now()}.png`

      const { error: uploadErr } = await supabase.storage
        .from('signatures')
        .upload(sigPath, blob, { contentType: 'image/png', upsert: true })

      if (uploadErr) throw new Error(uploadErr.message)

      const { data: { publicUrl } } = supabase.storage.from('signatures').getPublicUrl(sigPath)

      // Save acknowledgment record
      const { error: dbErr } = await supabase.from('handbook_acknowledgments').insert({
        employee_id: assignment.employee.id,
        handbook_version: HANDBOOK_VERSION,
        signature_url: publicUrl,
        signed_at: new Date().toISOString(),
      })
      if (dbErr) throw new Error(dbErr.message)

      // Trigger Drive upload via API route (server-side gog upload)
      // For now, record without Drive link — admin can batch-upload periodically
      setDone(true)
      setExisting({ signed_at: new Date().toISOString(), drive_file_url: null })
    } catch (e: any) {
      setError(e.message || 'Error saving signature')
    } finally {
      setSaving(false)
    }
  }

  if (loading || assignment.loading) {
    return <div className="p-8 text-gray-500">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white mt-8 md:mt-0 pb-20">
      <div className="max-w-2xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div>
          <Link to="/documents" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">← Policies & Procedures</Link>
          <h1 className="text-xl font-bold mt-2">Employee Handbook Acknowledgment</h1>
          <p className="text-xs text-gray-500 mt-1">2026 Edition — FirePCR Field Operations</p>
        </div>

        {/* Already signed banner */}
        {existing && !done && (
          <div className="bg-green-900/40 border border-green-700 rounded-xl px-4 py-4 space-y-2">
            <p className="text-green-300 font-semibold text-sm">✅ You have already signed this handbook</p>
            <p className="text-xs text-green-400">
              Signed on {new Date(existing.signed_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            {existing.drive_file_url && (
              <a href={existing.drive_file_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 underline">
                View signed copy in Drive →
              </a>
            )}
            <p className="text-xs text-gray-500 mt-2">You may sign again below if you received an updated version.</p>
          </div>
        )}

        {/* Done banner */}
        {done && (
          <div className="bg-green-900/40 border border-green-700 rounded-xl px-4 py-4 space-y-1">
            <p className="text-green-300 font-semibold">✅ Acknowledgment recorded</p>
            <p className="text-xs text-green-400">Your signature has been saved. Thank you.</p>
          </div>
        )}

        {/* Handbook preview + link */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">Step 1 — Read the Handbook</h2>
          <p className="text-sm text-gray-300">
            Before signing, please read the full Employee Handbook. Click below to open it:
          </p>
          <a href={HANDBOOK_URL} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-medium transition-colors">
            📄 Open Employee Handbook 2026 (PDF)
          </a>
        </div>

        {/* Acknowledgment text */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">Step 2 — Review & Confirm</h2>
          <div className="bg-gray-800/60 rounded-lg p-4 text-xs text-gray-300 leading-relaxed space-y-2">
            <p>
              I, <strong>{assignment.employee?.name}</strong>, acknowledge that I have received, read, and
              understand the Sierra Valley EMS Employee Handbook (2026 Edition). I agree to comply with
              the policies, rules, and standards described in this Handbook as a condition of my employment
              with Sierra Valley EMS.
            </p>
            <p>
              I understand that this Handbook does not constitute a contract of employment and that my
              employment is at-will, meaning either I or Sierra Valley EMS may terminate the employment
              relationship at any time, with or without cause or notice, subject to applicable California law.
            </p>
            <p>
              I understand that Sierra Valley EMS reserves the right to modify, supplement, or rescind
              any provision of this Handbook at any time without prior notice.
            </p>
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-red-500 shrink-0"
            />
            <span className="text-sm text-gray-300">
              I confirm that I have read and understand the Employee Handbook and agree to the terms above.
            </span>
          </label>
        </div>

        {/* Signature pad */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">Step 3 — Sign</h2>
            <button onClick={clearSig} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Clear
            </button>
          </div>
          <p className="text-xs text-gray-500">Draw your signature in the box below using your mouse or finger.</p>
          <div className="rounded-xl overflow-hidden border border-gray-600 bg-white">
            <SignatureCanvas
              ref={sigRef}
              canvasProps={{
                width: 560,
                height: 180,
                className: 'w-full touch-none',
                style: { background: 'white' }
              }}
              penColor="#1a1a2e"
              minWidth={1.5}
              maxWidth={3}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Signing as:</span>
            <span className="text-white font-medium">{assignment.employee?.name}</span>
            <span>·</span>
            <span>{assignment.employee?.role}</span>
            <span>·</span>
            <span>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-xl px-4 py-3">{error}</p>
        )}

        {/* Submit */}
        {!done && (
          <button
            onClick={handleSign}
            disabled={saving}
            className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-xl transition-colors text-sm"
          >
            {saving ? 'Saving signature...' : '✍️ Submit Signed Acknowledgment'}
          </button>
        )}

      </div>
    </div>
  )
}
