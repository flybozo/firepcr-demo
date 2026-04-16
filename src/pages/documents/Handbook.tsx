

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUserAssignment } from '@/lib/useUserAssignment'
import PinSignature, { type SignatureRecord } from '@/components/PinSignature'
import { Link } from 'react-router-dom'

const HANDBOOK_VERSION = '2026'
const HANDBOOK_URL = 'https://jlqpycxguovxnqtkjhzs.supabase.co/storage/v1/object/public/documents/RAM-Employee-Handbook-2026-CA.pdf'

export default function HandbookAcknowledgmentPage() {
  const supabase = createClient()
  const assignment = useUserAssignment()
  const [showPinSig, setShowPinSig] = useState(false)

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

  const handleSign = async (rec: SignatureRecord) => {
    if (!assignment.employee?.id) { setError('No employee record found.'); return }
    setSaving(true)
    setError('')
    try {
      const { error: dbErr } = await supabase.from('handbook_acknowledgments').insert({
        employee_id: assignment.employee.id,
        handbook_version: HANDBOOK_VERSION,
        signature_url: rec.signatureHash,
        signed_at: rec.signedAt,
      })
      if (dbErr) throw new Error(dbErr.message)
      setDone(true)
      setExisting({ signed_at: rec.signedAt, drive_file_url: null })
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
          <p className="text-xs text-gray-500 mt-1">2026 Edition — Ridgeline EMS P.C. dba Ridgeline EMS</p>
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
              understand the Ridgeline EMS Employee Handbook (2026 Edition). I agree to comply with
              the policies, rules, and standards described in this Handbook as a condition of my employment
              with Ridgeline EMS P.C. dba Ridgeline EMS.
            </p>
            <p>
              I understand that this Handbook does not constitute a contract of employment and that my
              employment is at-will, meaning either I or Ridgeline EMS may terminate the employment
              relationship at any time, with or without cause or notice, subject to applicable California law.
            </p>
            <p>
              I understand that Ridgeline EMS reserves the right to modify, supplement, or rescind
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

        {/* Step 3 — PIN Sign */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">Step 3 — Sign</h2>
          <p className="text-xs text-gray-500">Confirm your identity with your signing PIN to complete the acknowledgment.</p>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Signing as:</span>
            <span className="text-white font-medium">{assignment.employee?.name}</span>
            <span>·</span>
            <span>{assignment.employee?.role}</span>
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-xl px-4 py-3">{error}</p>
        )}

        {/* Submit */}
        {!done && (
          <button
            onClick={() => { if (!confirmed) { setError('Please confirm you have read the handbook before signing.'); return } setShowPinSig(true) }}
            disabled={saving}
            className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-xl transition-colors text-sm"
          >
            {saving ? 'Saving...' : 'Sign Acknowledgment'}
          </button>
        )}

      </div>

      {showPinSig && (
        <PinSignature
          label="Handbook Acknowledgment"
          mode="self"
          employeeId={assignment.employee?.id}
          employeeName={assignment.employee?.name}
          documentContext={`handbook-${HANDBOOK_VERSION}`}
          onSign={(rec) => { setShowPinSig(false); handleSign(rec) }}
          onCancel={() => setShowPinSig(false)}
        />
      )}
    </div>
  )
}
