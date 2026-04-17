import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServiceClient } from '../_supabase.js'
import { requireEmployee } from '../_auth.js'

// GET /api/pdf/sign?path=comp-claims/abc123.pdf&bucket=documents
// Authenticated endpoint — returns a short-lived signed URL for an internal storage object.
// Only accessible to active employees.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const path = req.query['path'] as string
  const bucket = (req.query['bucket'] as string) || 'documents'

  if (!path) return res.status(400).json({ error: 'Missing path' })
  if (!['documents', 'patient-photos'].includes(bucket)) return res.status(400).json({ error: 'Invalid bucket' })

  try {
    await requireEmployee(req)
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600)

  if (error || !data?.signedUrl) {
    return res.status(404).json({ error: 'Could not generate signed URL' })
  }

  return res.json({ url: data.signedUrl })
}
