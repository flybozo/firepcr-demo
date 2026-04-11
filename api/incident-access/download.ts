import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/incident-access/download?code=XXXX&type=comp_claim&id=YYYY
// Validates the access code, confirms the document belongs to the incident, returns signed URL.

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type') // 'comp_claim' | 'ics214'
  const id = searchParams.get('id')

  if (!code || !type || !id) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Validate the access code
  const { data: codeRow, error: codeErr } = await supabase
    .from('incident_access_codes')
    .select('incident_id, active, expires_at')
    .eq('access_code', code.toUpperCase())
    .single()

  if (codeErr || !codeRow || !codeRow.active) {
    return NextResponse.json({ error: 'Invalid access code' }, { status: 403 })
  }

  if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Access code expired' }, { status: 410 })
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
      return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 })
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
      return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 })
    }
    pdfUrl = form.pdf_url
  } else {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }

  if (!pdfUrl) {
    return NextResponse.json({ error: 'No PDF available for this record' }, { status: 404 })
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
      return NextResponse.json({ url: pdfUrl })
    }

    const bucket = pathParts[storageIdx + 1]
    const objectPath = pathParts.slice(storageIdx + 2).join('/')

    const { data: signedData, error: signErr } = await supabase.storage
      .from(bucket)
      .createSignedUrl(objectPath, 3600) // 60 minutes

    if (signErr || !signedData?.signedUrl) {
      // Fall back to returning the original URL
      return NextResponse.json({ url: pdfUrl })
    }

    return NextResponse.json({ url: signedData.signedUrl })
  } catch {
    // Fall back to returning original URL on parse error
    return NextResponse.json({ url: pdfUrl })
  }
}
