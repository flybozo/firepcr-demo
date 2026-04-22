import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServiceClient } from '../_supabase.js'

// POST /api/incident-access/log
// Body: { code, event_type, tab?, document_type?, document_id? }
// Fired by the external dashboard for tab views and PDF downloads.
// No auth required beyond a valid access code.

function setCors(req: VercelRequest, res: VercelResponse) {
  const allowedOrigins = new Set([
    process.env.APP_BASE_URL,
    process.env.VITE_APP_BASE_URL,
    'https://demo.firepcr.com',
    'https://firepcr-demo.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
  ].filter(Boolean) as string[])
  const origin = req.headers.origin
  if (origin && allowedOrigins.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { code, event_type, tab, document_type, document_id } = req.body as {
    code?: string
    event_type?: string
    tab?: string
    document_type?: string
    document_id?: string
  }

  if (!code || !event_type) return res.status(400).json({ error: 'Missing code or event_type' })

  const supabase = createServiceClient()

  // Validate the access code (must be active)
  const { data: codeRow } = await supabase
    .from('incident_access_codes')
    .select('id, incident_id, label, active, expires_at')
    .eq('access_code', code.toUpperCase())
    .single()

  if (!codeRow || !codeRow.active) return res.status(200).json({ ok: false }) // silent fail — no need to expose error
  if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) return res.status(200).json({ ok: false })

  await supabase.from('incident_access_log').insert({
    access_code_id: codeRow.id,
    incident_id: codeRow.incident_id,
    access_code: code.toUpperCase(),
    label: codeRow.label,
    accessed_at: new Date().toISOString(),
    user_agent: req.headers['user-agent'] || null,
    event_type,
    tab: tab || null,
    document_type: document_type || null,
    document_id: document_id || null,
  })

  return res.status(200).json({ ok: true })
}
