import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServiceClient } from '../_supabase.js'
import { requireEmployee } from '../_auth.js'
import { sendEmail, buildEmailHtml } from '../_email.js'

// POST /api/push/expense-reimbursement
// Called when an out-of-pocket expense is submitted. Forwards to bookkeeper.

const BOOKKEEPER_EMAIL = 'braggbusiness@gmail.com'
const BOOKKEEPER_NAME = 'Amanda Bragg'

type ReimbursementRequest = {
  expenseId: string
  employeeName: string
  expenseType: string
  amount: number
  description: string | null
  date: string
  unitName: string | null
  incidentName: string | null
  receiptUrl: string | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    await requireEmployee(req)

    const {
      expenseId, employeeName, expenseType, amount,
      description, date, unitName, incidentName, receiptUrl,
    } = req.body as ReimbursementRequest

    if (!expenseId || !amount) return res.status(400).json({ error: 'Missing fields' })

    const supabase = createServiceClient()

    // Generate signed receipt URL if available
    let receiptLink = ''
    if (receiptUrl) {
      const { data } = await supabase.storage.from('documents').createSignedUrl(receiptUrl, 7 * 24 * 3600) // 7 day link
      if (data?.signedUrl) receiptLink = data.signedUrl
    }

    const amountFormatted = `$${amount.toFixed(2)}`

    const sent = await sendEmail({
      to: BOOKKEEPER_EMAIL,
      subject: `💰 Reimbursement Request — ${employeeName} — ${amountFormatted} (${expenseType})`,
      html: buildEmailHtml({
        title: `Employee Reimbursement Request`,
        body: `
          <p>An employee has submitted an out-of-pocket expense requiring reimbursement:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:6px 12px;color:#6b7280;width:140px">Employee</td><td style="padding:6px 12px;color:#fff;font-weight:600">${employeeName}</td></tr>
            <tr><td style="padding:6px 12px;color:#6b7280">Expense Type</td><td style="padding:6px 12px;color:#fff">${expenseType}</td></tr>
            <tr><td style="padding:6px 12px;color:#6b7280">Amount</td><td style="padding:6px 12px;color:#f87171;font-weight:700;font-size:18px">${amountFormatted}</td></tr>
            <tr><td style="padding:6px 12px;color:#6b7280">Date</td><td style="padding:6px 12px;color:#fff">${date}</td></tr>
            ${description ? `<tr><td style="padding:6px 12px;color:#6b7280">Description</td><td style="padding:6px 12px;color:#fff">${description}</td></tr>` : ''}
            ${unitName ? `<tr><td style="padding:6px 12px;color:#6b7280">Unit</td><td style="padding:6px 12px;color:#fff">${unitName}</td></tr>` : ''}
            ${incidentName ? `<tr><td style="padding:6px 12px;color:#6b7280">Incident</td><td style="padding:6px 12px;color:#fff">${incidentName}</td></tr>` : ''}
            <tr><td style="padding:6px 12px;color:#6b7280">Receipt</td><td style="padding:6px 12px">${receiptLink ? `<a href="${receiptLink}" style="color:#60a5fa">View Receipt</a>` : '<span style="color:#6b7280">No receipt attached</span>'}</td></tr>
          </table>
        `,
        ctaText: 'Open FirePCR',
        ctaUrl: 'https://ram-field-ops.vercel.app/admin/financial',
      }),
    })

    return res.json({ sent: !!sent, to: BOOKKEEPER_EMAIL })
  } catch (err: any) {
    console.error('Expense reimbursement email error:', err)
    return res.status(err.status || 500).json({ error: err.message || 'Internal error' })
  }
}
