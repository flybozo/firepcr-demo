

import { FieldGuard } from '@/components/FieldGuard'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { authFetch } from '@/lib/authFetch'

type ChatRequest = {
  id: string
  employee_id: string
  employee_name: string | null
  request_type: 'request' | 'bug_report'
  content: string
  status: 'pending' | 'approved' | 'denied'
  admin_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

type FilterTab = 'pending' | 'approved' | 'denied' | 'all' | 'bug_report'

function ChatRequestsPageInner() {
  const supabase = createClient()
  const assignment = useUserAssignment()

  const [requests, setRequests] = useState<ChatRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('pending')
  const [reviewModal, setReviewModal] = useState<{ request: ChatRequest; action: 'approved' | 'denied' } | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadRequests = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('chat_requests')
        .select('*')
        .order('created_at', { ascending: false })
      setRequests((data || []) as ChatRequest[])
    } catch {
      // Offline — show empty list
    }
    setLoading(false)
  }

  useEffect(() => {
    loadRequests()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = requests.filter(r => {
    if (activeTab === 'all') return true
    if (activeTab === 'bug_report') return r.request_type === 'bug_report'
    if (activeTab === 'pending') return r.status === 'pending' && r.request_type === 'request'
    if (activeTab === 'approved') return r.status === 'approved'
    if (activeTab === 'denied') return r.status === 'denied'
    return true
  })

  const counts = {
    pending: requests.filter(r => r.status === 'pending' && r.request_type === 'request').length,
    approved: requests.filter(r => r.status === 'approved').length,
    denied: requests.filter(r => r.status === 'denied').length,
    all: requests.length,
    bug_report: requests.filter(r => r.request_type === 'bug_report').length,
  }

  const handleReview = async () => {
    if (!reviewModal || !assignment.employee) return
    setSubmitting(true)

    await supabase
      .from('chat_requests')
      .update({
        status: reviewModal.action,
        admin_notes: adminNotes || null,
        reviewed_by: assignment.employee.name,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', reviewModal.request.id)

    // If approving a bug report, notify AI Assistant via API
    if (reviewModal.action === 'approved' && reviewModal.request.request_type === 'bug_report') {
      try {
        await authFetch('/api/notify-bug', {
          method: 'POST',
          body: JSON.stringify({
            employee_name: reviewModal.request.employee_name,
            content: reviewModal.request.content,
            admin_notes: adminNotes || null,
            request_id: reviewModal.request.id,
          }),
        })
      } catch (e) { /* non-blocking */ }
    }

    setReviewModal(null)
    setAdminNotes('')
    setSubmitting(false)
    await loadRequests()
  }

  const tabs: { id: FilterTab; label: string }[] = [
    { id: 'pending', label: `Pending (${counts.pending})` },
    { id: 'bug_report', label: `Bugs (${counts.bug_report})` },
    { id: 'approved', label: `Approved (${counts.approved})` },
    { id: 'denied', label: `Denied (${counts.denied})` },
    { id: 'all', label: `All (${counts.all})` },
  ]

  return (
    <div className="p-6 md:p-8 max-w-4xl mt-8 md:mt-0">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Chat Requests & Bug Reports</h1>
        <p className="text-gray-400 text-sm mt-1">
          Requests and bug reports submitted by employees via the AI Assistant chat
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-gray-700 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="theme-card rounded-xl border h-24 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <div className="text-4xl mb-3">📭</div>
          <p>No items in this category</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => (
            <div key={req.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="font-semibold text-sm text-white">
                      {req.employee_name || 'Unknown Employee'}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      req.request_type === 'bug_report'
                        ? 'bg-orange-900/50 text-orange-300 border border-orange-700/50'
                        : 'bg-blue-900/50 text-blue-300 border border-blue-700/50'
                    }`}>
                      {req.request_type === 'bug_report' ? '🐛 Bug Report' : '📋 Request'}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      req.status === 'pending'
                        ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50'
                        : req.status === 'approved'
                        ? 'bg-green-900/50 text-green-300 border border-green-700/50'
                        : 'bg-red-900/50 text-red-300 border border-red-700/50'
                    }`}>
                      {req.status === 'pending' ? '⏳ Pending' : req.status === 'approved' ? '✅ Approved' : '❌ Denied'}
                    </span>
                    <span className="text-xs text-gray-600">
                      {new Date(req.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">{req.content}</p>
                  {req.admin_notes && (
                    <div className="mt-2 text-xs text-gray-500 bg-gray-800/50 rounded-lg px-3 py-2">
                      <span className="font-medium text-gray-400">Admin notes:</span> {req.admin_notes}
                    </div>
                  )}
                  {req.reviewed_by && (
                    <p className="text-xs text-gray-600 mt-1">
                      Reviewed by {req.reviewed_by} · {req.reviewed_at ? new Date(req.reviewed_at).toLocaleDateString() : ''}
                    </p>
                  )}
                </div>

                {req.status === 'pending' && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => { setReviewModal({ request: req, action: 'approved' }); setAdminNotes('') }}
                      className="px-3 py-1.5 bg-green-800 hover:bg-green-700 text-green-200 rounded-lg text-xs font-medium transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => { setReviewModal({ request: req, action: 'denied' }); setAdminNotes('') }}
                      className="px-3 py-1.5 bg-red-900 hover:bg-red-800 text-red-300 rounded-lg text-xs font-medium transition-colors"
                    >
                      Deny
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold mb-1">
              {reviewModal.action === 'approved' ? '✅ Approve Request' : '❌ Deny Request'}
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              From: {reviewModal.request.employee_name}
            </p>
            <div className="bg-gray-800 rounded-xl p-3 mb-4 text-sm text-gray-300">
              {reviewModal.request.content}
            </div>
            <label className="text-xs text-gray-400 font-medium block mb-1">
              Admin notes (optional)
            </label>
            <textarea
              value={adminNotes}
              onChange={e => setAdminNotes(e.target.value)}
              rows={3}
              placeholder="Add context or instructions for the employee…"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-gray-500 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setReviewModal(null)}
                disabled={submitting}
                className="flex-1 py-2 border border-gray-700 rounded-xl text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReview}
                disabled={submitting}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
                  reviewModal.action === 'approved'
                    ? 'bg-green-700 hover:bg-green-600 text-white'
                    : 'bg-red-800 hover:bg-red-700 text-white'
                }`}
              >
                {submitting ? 'Saving…' : reviewModal.action === 'approved' ? 'Confirm Approve' : 'Confirm Deny'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ChatRequestsPage() {
  return (
    <FieldGuard redirectFn={() => '/'}>
      <ChatRequestsPageInner />
    </FieldGuard>
  )
}
