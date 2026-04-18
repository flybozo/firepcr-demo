import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServiceClient } from '../_supabase.js'
import { requireEmployee } from '../_auth.js'

// Returns signed URLs (1-hour expiry) for all credential files belonging to an employee.
// Field users can only get their own credentials.
// Admins can request any employee's credentials by passing ?employee_id=...
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { employee, isAdmin } = await requireEmployee(req)
    const supabase = createServiceClient()

    // Determine which employee's credentials to fetch
    const requestedId = req.query.employee_id as string | undefined
    const targetEmployeeId = requestedId && isAdmin ? requestedId : employee.id

    // Get all credential rows for this employee
    const { data: creds, error: credsErr } = await supabase
      .from('employee_credentials')
      .select('id, cert_type, file_name, file_url, expiration_date, issued_date')
      .eq('employee_id', targetEmployeeId)
      .order('cert_type')

    if (credsErr) return res.status(500).json({ error: credsErr.message })

    // Build signed URL for each credential
    const SIGN_EXPIRY = 3600 // 1 hour

    const result = await Promise.all((creds || []).map(async (c: any) => {
      const fileUrl = c.file_url as string | null
      let signedUrl: string | null = null
      let urlError: string | null = null

      if (fileUrl) {
        // Extract the storage path from whatever format the URL is in
        let storagePath: string | null = null

        if (fileUrl.startsWith('http')) {
          if (fileUrl.includes('/storage/v1/object/')) {
            // Full Supabase URL — extract path after bucket name
            const match = fileUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/credentials\/(.+)/)
            if (match) storagePath = match[1]
          }
          // Google Drive / Sheets links — skip, no signed URL possible
          // (these are returned as-is in file_url for admin reference)
        } else if (fileUrl.startsWith('credentials/')) {
          // Prefixed relative path: credentials/<uuid>/<filename>
          storagePath = fileUrl.replace(/^credentials\//, '')
        } else if (fileUrl.includes('/')) {
          // Plain relative path: <employee_uuid>/<filename> — most common format
          storagePath = fileUrl
        }

        if (storagePath) {
          const { data: signed, error: signErr } = await supabase.storage
            .from('credentials')
            .createSignedUrl(storagePath, SIGN_EXPIRY)

          if (signErr) {
            urlError = signErr.message
          } else if (signed?.signedUrl) {
            signedUrl = signed.signedUrl
          }
        }
      }

      return {
        id: c.id,
        cert_type: c.cert_type,
        file_name: c.file_name,
        expiration_date: c.expiration_date,
        issued_date: c.issued_date,
        signed_url: signedUrl,
        url_error: urlError,
      }
    }))

    return res.json({ credentials: result, employee_id: targetEmployeeId })
  } catch (err: any) {
    console.error('[credentials/signed-urls] Error:', err)
    return res.status(err.status || 500).json({ error: err.message || 'Internal error' })
  }
}
