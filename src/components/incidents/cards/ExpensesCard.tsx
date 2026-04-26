import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import { useOfflineWrite } from '@/lib/useOfflineWrite'
import * as incidentService from '@/lib/services/incidents'
import { fmtCurrency } from '@/utils/incidentFormatters'
import type { ExpenseRow, IncidentUnit } from '@/types/incident'
import { ConfirmDialog } from '@/components/ui'

const EXPENSE_TYPES = ['Gas', 'Repairs', 'Supplies', 'Hotel', 'Food', 'Other']

export function ExpensesCard({
  activeIncidentId,
  expenses,
  incidentUnits,
  isAdmin,
  assignmentEmployee,
  reload,
  dragHandleProps,
  cycleSpan,
  span,
}: {
  activeIncidentId: string
  expenses: ExpenseRow[]
  incidentUnits: IncidentUnit[]
  isAdmin: boolean
  assignmentEmployee?: { id?: string | null; name?: string | null } | null
  reload: () => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
  cycleSpan?: () => void
  span?: number
}) {
  const supabase = createClient()
  const { write } = useOfflineWrite()
  const navigate = useNavigate()
  const expenseReceiptRef = useRef<HTMLInputElement>(null)

  const [confirmAction, setConfirmAction] = useState<{ action: () => void; title: string; message: string; confirmLabel?: string; icon?: string; confirmColor?: string } | null>(null)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [expenseForm, setExpenseForm] = useState({ type: 'Gas', amount: '', description: '', date: new Date().toISOString().split('T')[0], unitId: '', paymentMethod: 'company_card' as 'company_card' | 'out_of_pocket' })
  const [expenseReceipt, setExpenseReceipt] = useState<File | null>(null)
  const [expenseNoReceiptReason, setExpenseNoReceiptReason] = useState('')
  const [expenseSubmitting, setExpenseSubmitting] = useState(false)

  const totalExp = expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const unitOptions = incidentUnits.filter(iu => iu.unit).map(iu => ({ id: iu.unit!.id, name: (iu.unit as any)?.name || '?' }))

  const handleSubmitExpense = async () => {
    if (!expenseForm.amount) return
    if (!expenseReceipt && !expenseNoReceiptReason) {
      toast.warning('Please attach a receipt or select a reason for no receipt.')
      return
    }
    setExpenseSubmitting(true)
    let receiptPath: string | null = null
    if (expenseReceipt) {
      const ext = expenseReceipt.name.split('.').pop()?.toLowerCase() || 'jpg'
      const fname = `${Date.now()}_${expenseForm.type.toLowerCase()}.${ext}`
      const storagePath = `expenses/${activeIncidentId}/${fname}`
      const { error: upErr } = await supabase.storage.from('documents').upload(storagePath, expenseReceipt, { upsert: false })
      if (!upErr) receiptPath = storagePath
    }
    const expenseData = {
      incident_id: activeIncidentId,
      expense_type: expenseForm.type,
      amount: parseFloat(expenseForm.amount) || 0,
      description: expenseForm.description || null,
      expense_date: expenseForm.date,
      unit_id: expenseForm.unitId || null,
      employee_id: assignmentEmployee?.id || null,
      created_by: assignmentEmployee?.name || 'Unknown',
      receipt_url: receiptPath,
      no_receipt_reason: receiptPath ? null : expenseNoReceiptReason || null,
      payment_method: expenseForm.paymentMethod,
    }
    await write('incident_expenses', 'insert', expenseData)

    // Send reimbursement email to bookkeeper for out-of-pocket expenses
    if (expenseForm.paymentMethod === 'out_of_pocket') {
      try {
        const { authFetch } = await import('@/lib/authFetch')
        const unitName = unitOptions.find(u => u.id === expenseForm.unitId)?.name || null
        await authFetch('/api/push/expense-reimbursement', {
          method: 'POST',
          body: JSON.stringify({
            expenseId: 'pending',
            employeeName: assignmentEmployee?.name || 'Unknown',
            expenseType: expenseForm.type,
            amount: parseFloat(expenseForm.amount) || 0,
            description: expenseForm.description || null,
            date: expenseForm.date,
            unitName,
            incidentName: null,
            receiptUrl: receiptPath,
          }),
        })
      } catch { /* best-effort */ }
    }

    setShowAddExpense(false)
    setExpenseForm({ type: 'Gas', amount: '', description: '', date: new Date().toISOString().split('T')[0], unitId: '', paymentMethod: 'company_card' })
    setExpenseReceipt(null)
    setExpenseNoReceiptReason('')
    if (expenseReceiptRef.current) expenseReceiptRef.current.value = ''
    setExpenseSubmitting(false)
    reload()
  }

  return (
    <div className="theme-card rounded-xl border overflow-hidden flex flex-col flex-1">
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        confirmLabel={confirmAction?.confirmLabel}
        icon={confirmAction?.icon}
        confirmColor={confirmAction?.confirmColor}
        onConfirm={() => { confirmAction?.action(); setConfirmAction(null) }}
        onCancel={() => setConfirmAction(null)}
      />
      <div className="flex items-center gap-2 px-4 py-3 border-b theme-card-header">
        {dragHandleProps && (
          <div {...dragHandleProps} className="text-gray-600 hover:text-gray-300 cursor-grab active:cursor-grabbing transition-colors shrink-0 opacity-0 group-hover:opacity-100 select-none">⠿</div>
        )}
        {cycleSpan && (
          <button onClick={cycleSpan} title={`Column span: ${span || 3}/3 — click to cycle`}
            className="text-gray-600 hover:text-gray-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity select-none shrink-0">{`${span || 3}/3`}</button>
        )}
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex-1">🧾 Expenses</h3>
        <span className="text-xl font-bold text-red-400">{fmtCurrency(totalExp)}</span>
      </div>

      {expenses.length > 0 && (
        <div className="overflow-x-auto" style={{ maxHeight: '220px', overflowY: 'auto' }}>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b theme-border">
                <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase">Date</th>
                <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase">Type</th>
                <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase">Description</th>
                <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase">By</th>
                <th className="text-right px-3 py-2 text-gray-500 font-semibold uppercase">Amount</th>
                <th className="px-2 py-2 text-gray-500 font-semibold uppercase text-center">💳</th>
                <th className="px-2 py-2 text-gray-500 font-semibold uppercase text-center">🧃</th>
                {isAdmin && <th className="px-2 py-2"></th>}
              </tr>
            </thead>
            <tbody className="divide-y theme-border">
              {expenses.map(exp => (
                <tr key={exp.id} className="hover:bg-gray-800/30 transition-colors cursor-pointer"
                  onClick={() => exp.employee_id && navigate(`/roster/${exp.employee_id}`)}>
                  <td className="px-3 py-2 text-gray-400">{exp.expense_date}</td>
                  <td className="px-3 py-2 text-white">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      exp.expense_type === 'Gas' ? 'bg-yellow-900/60 text-yellow-300' :
                      exp.expense_type === 'Hotel' ? 'bg-purple-900/60 text-purple-300' :
                      exp.expense_type === 'Repairs' ? 'bg-red-900/60 text-red-300' :
                      exp.expense_type === 'Food' ? 'bg-orange-900/60 text-orange-300' :
                      exp.expense_type === 'Supplies' ? 'bg-blue-900/60 text-blue-300' :
                      'bg-gray-700 text-gray-300'
                    }`}>{exp.expense_type}</span>
                  </td>
                  <td className="px-3 py-2 text-gray-300 truncate max-w-[150px]">{exp.description || '—'}</td>
                  <td className="px-3 py-2 text-gray-400 truncate max-w-[100px]">{(exp.employees as any)?.name || exp.created_by || '—'}</td>
                  <td className="px-3 py-2 text-right font-medium text-red-400">{fmtCurrency(exp.amount)}</td>
                  <td className="px-2 py-2 text-center">
                    {exp.payment_method === 'out_of_pocket'
                      ? <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-900/60 text-yellow-300 font-medium" title="Out of pocket — reimbursable">OOP</span>
                      : <span className="text-xs text-gray-600" title="Company card">Co.</span>
                    }
                  </td>
                  <td className="px-2 py-2 text-center" onClick={e => e.stopPropagation()}>
                    {exp.receipt_url ? (
                      <button onClick={async () => {
                        const { data } = await supabase.storage.from('documents').createSignedUrl(exp.receipt_url!, 3600)
                        if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                      }} className="text-xs text-blue-400 hover:text-blue-300" title="View receipt">🧃</button>
                    ) : (
                      <span className="text-gray-600 text-xs italic" title={exp.no_receipt_reason || 'No receipt'}>
                        {exp.no_receipt_reason === "I'm a knucklehead" ? '🤦' : '—'}
                      </span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setConfirmAction({
                        action: async () => {
                          await incidentService.deleteIncidentExpense(exp.id)
                          reload()
                        },
                        title: 'Delete Expense',
                        message: 'Delete this expense?',
                        confirmLabel: 'Delete',
                        icon: '🗑️',
                        confirmColor: 'bg-red-600 hover:bg-red-700',
                      })} className="text-xs text-red-500 hover:text-red-400">✕</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {expenses.length === 0 && !showAddExpense && (
        <p className="px-4 py-6 text-sm text-gray-600 text-center">No expenses logged</p>
      )}

      {showAddExpense && (
        <div className="border-t p-4 space-y-3 theme-border">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Log Expense</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Type</label>
              <select value={expenseForm.type} onChange={e => setExpenseForm(f => ({ ...f, type: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500">
                {EXPENSE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Amount ($)</label>
              <input type="number" step="0.01" value={expenseForm.amount}
                onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00" required
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Date</label>
              <input type="date" value={expenseForm.date}
                onChange={e => setExpenseForm(f => ({ ...f, date: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Unit (optional)</label>
              <select value={expenseForm.unitId} onChange={e => setExpenseForm(f => ({ ...f, unitId: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500">
                <option value="">None</option>
                {unitOptions.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1.5">Payment Method</label>
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => setExpenseForm(f => ({ ...f, paymentMethod: 'company_card' }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    expenseForm.paymentMethod === 'company_card'
                      ? 'bg-blue-900/40 border-blue-600 text-blue-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                  }`}>
                  💳 Company Card
                </button>
                <button type="button"
                  onClick={() => setExpenseForm(f => ({ ...f, paymentMethod: 'out_of_pocket' }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    expenseForm.paymentMethod === 'out_of_pocket'
                      ? 'bg-yellow-900/40 border-yellow-600 text-yellow-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                  }`}>
                  💰 Out of Pocket
                </button>
              </div>
              {expenseForm.paymentMethod === 'out_of_pocket' && (
                <p className="text-xs text-yellow-500 mt-1">⚠️ This will be flagged for reimbursement and forwarded to the bookkeeper</p>
              )}
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Description</label>
              <input type="text" value={expenseForm.description}
                onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What was this expense for?"
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Receipt Photo (optional)</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => expenseReceiptRef.current?.click()}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors">
                  {expenseReceipt ? `📎 ${expenseReceipt.name}` : '📷 Attach Receipt'}
                </button>
                {expenseReceipt && (
                  <button type="button" onClick={() => { setExpenseReceipt(null); if (expenseReceiptRef.current) expenseReceiptRef.current.value = '' }}
                    className="text-xs text-gray-500 hover:text-red-400">✕ Remove</button>
                )}
                <input ref={expenseReceiptRef} type="file" accept="image/*,.pdf" className="hidden"
                  onChange={e => setExpenseReceipt(e.target.files?.[0] || null)} />
              </div>
              <p className="text-xs text-gray-600 mt-1">JPG, PNG, or PDF</p>
            </div>
            {!expenseReceipt && (
              <div className="col-span-2">
                <label className="text-xs text-gray-500 block mb-1">No receipt? Reason required</label>
                <select value={expenseNoReceiptReason} onChange={e => setExpenseNoReceiptReason(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500">
                  <option value="">Select reason...</option>
                  <option value="Lost">Lost</option>
                  <option value="Vendor did not provide">Vendor did not provide</option>
                  <option value="Destroyed">Destroyed</option>
                  <option value="I'm a knucklehead">I'm a knucklehead</option>
                </select>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500">Logged by: <span className="text-white">{assignmentEmployee?.name || 'Unknown'}</span></p>
          <div className="flex gap-2">
            <button onClick={handleSubmitExpense} disabled={expenseSubmitting || !expenseForm.amount}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 rounded-lg text-sm font-semibold transition-colors">
              {expenseSubmitting ? 'Saving...' : 'Log Expense'}
            </button>
            <button onClick={() => setShowAddExpense(false)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 px-4 py-2 theme-card-footer">
        <div className="flex-1" />
        {!showAddExpense && (
          <button onClick={() => setShowAddExpense(true)}
            className="text-xs px-2.5 py-1 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors">
            + Log Expense
          </button>
        )}
      </div>
    </div>
  )
}
