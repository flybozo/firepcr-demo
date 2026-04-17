import type { VercelRequest, VercelResponse } from "@vercel/node"
import { createServiceClient } from '../_supabase.js'
import { HttpError, requireAuthUser } from '../_auth.js'

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

  // Access code based auth — no JWT required (external fire admin users)
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

  // Generate a signed URL for the PDF.
  // pdfUrl can be:
  //   - A storage path like "comp-claims/883d2338.pdf" or "ics214/ICS214-xxx.pdf"
  //   - A full Supabase storage URL
  try {
    let bucket: string
    let objectPath: string

    if (pdfUrl.startsWith('http')) {
      // Full URL — parse out bucket and path
      const url = new URL(pdfUrl)
      const pathParts = url.pathname.split('/')
      const storageIdx = pathParts.findIndex(p => p === 'public' || p === 'sign')
      if (storageIdx === -1) {
        return res.json({ url: pdfUrl })
      }
      bucket = pathParts[storageIdx + 1]
      objectPath = pathParts.slice(storageIdx + 2).join('/')
    } else {
      // Storage path — extract bucket from the first path segment
      // e.g. "comp-claims/883d2338.pdf" → bucket="comp-claims", path="883d2338.pdf"
      // e.g. "ics214/ICS214-xxx.pdf" → bucket="documents", path="ics214/ICS214-xxx.pdf"
      const firstSlash = pdfUrl.indexOf('/')
      if (firstSlash === -1) {
        return res.status(404).json({ error: 'Invalid PDF path' })
      }
      // All storage paths live in the 'documents' bucket — use full path as object path
      bucket = 'documents'
      objectPath = pdfUrl
    }

    const { data: signedData, error: signErr } = await supabase.storage
      .from(bucket)
      .createSignedUrl(objectPath, 3600) // 60 minutes

    if (signErr || !signedData?.signedUrl) {
      return res.status(500).json({ error: 'Failed to generate download URL' })
    }

    return res.json({ url: signedData.signedUrl })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to process PDF URL' })
  }
}
