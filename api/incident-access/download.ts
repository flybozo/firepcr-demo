import type { VercelRequest, VercelResponse } from "@vercel/node"
import { createServiceClient } from '../_supabase'

// GET /api/incident-access/download?code=XXXX&type=comp_claim&id=YYYY
// Validates the access code, confirms the document belongs to the incident, returns signed URL.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const query = req.query
  const code = (query['code'] as string)
  const type = (query['type'] as string) // 'comp_claim' | 'ics214'
  const id = (query['id'] as string)

  if (!code || !type || !id) {
    return res.status(400).json({ error: 'Missing parameters' })
  }

  const supabase = createServiceClient()

  // Validate the access code
  const { data: codeRow, error: codeErr } = await supabase
    .from('incident_access_codes')
    .select('incident_id, active, expires_at')
    .eq('access_code', code.toUpperCase())
    .single()

  if (codeErr || !codeRow || !codeRow.active) {
    return res.status(403).json({ error: 'Invalid access code' })
  }

  if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
    return res.status(410).json({ error: 'Access code expired' })
  }

  const incidentId = codeRow.incident_id
  let pdfUrl: string | null = null

  if (type === 'comp_claim') {
    const { data: claim } = await supabase
      .from('comp_claims')
      .select('pdf_url, incident_id')
      .eq('id', id)
      .eq('incident_id', incidentId)
      .single()

    if (!claim) {
      return res.status(404).json({ error: 'Document not found or access denied' })
    }
    pdfUrl = claim.pdf_url
  } else if (type === 'ics214') {
    const { data: form } = await supabase
      .from('ics214_headers')
      .select('pdf_url, incident_id')
      .eq('id', id)
      .eq('incident_id', incidentId)
      .single()

    if (!form) {
      return res.status(404).json({ error: 'Document not found or access denied' })
    }
    pdfUrl = form.pdf_url
  } else {
    return res.status(400).json({ error: 'Invalid type' })
  }

  if (!pdfUrl) {
    return res.status(404).json({ error: 'No PDF available for this record' })
  }

  // Extract storage path from the URL and create a signed URL (60 minutes)
  // pdfUrl format: https://xxx.supabase.co/storage/v1/object/public/BUCKET/PATH
  // or: https://xxx.supabase.co/storage/v1/object/sign/BUCKET/PATH
  try {
    const url = new URL(pdfUrl)
    const pathParts = url.pathname.split('/')
    // Find bucket and object path
    // e.g. /storage/v1/object/public/comp-claims/file.pdf
    const storageIdx = pathParts.findIndex(p => p === 'public' || p === 'sign')
    if (storageIdx === -1) {
      // Just return the URL directly if it's not a Supabase storage URL
      return res.json({ url: pdfUrl })
    }

    const bucket = pathParts[storageIdx + 1]
    const objectPath = pathParts.slice(storageIdx + 2).join('/')

    const { data: signedData, error: signErr } = await supabase.storage
      .from(bucket)
      .createSignedUrl(objectPath, 3600) // 60 minutes

    if (signErr || !signedData?.signedUrl) {
      // Fall back to returning the original URL
      return res.json({ url: pdfUrl })
    }

    return res.json({ url: signedData.signedUrl })
  } catch {
    // Fall back to returning original URL on parse error
    return res.json({ url: pdfUrl })
  }
}
