import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuthUser, HttpError } from '../../_auth'
import { createServiceClient } from '../../_supabase'
import { buildPcrXml } from '../../../src/lib/nemsis/buildPcrXml'
import { rateLimit } from '../../_rateLimit'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const user = await requireAuthUser(req)

    // Rate limit: 10 exports per 2 minutes per user
    const rl = rateLimit(`nemsis:${(user as any)?.id || 'anon'}`, 10, 120_000)
    if (!rl.ok) return res.status(429).json({ error: 'Too many export requests' })

    const { id } = req.query
    if (!id || Array.isArray(id)) return res.status(400).json({ error: 'Invalid encounter id' })

    const supabase = createServiceClient()

    // Fetch encounter
    const { data: enc, error: encErr } = await supabase
      .from('patient_encounters')
      .select('*')
      .eq('id', id)
      .single()
    if (encErr || !enc) return res.status(404).json({ error: 'Encounter not found' })

    // Fetch vitals (additional_vitals rows)
    const { data: vitals } = await supabase
      .from('additional_vitals')
      .select('*')
      .eq('encounter_id', id)
      .order('recorded_at', { ascending: true })

    // Fetch medications (dispense_admin_log)
    const { data: medications } = await supabase
      .from('dispense_admin_log')
      .select('*')
      .eq('encounter_id', enc.encounter_id)
      .order('date', { ascending: true })

    // Fetch procedures
    const { data: procedures } = await supabase
      .from('encounter_procedures')
      .select('*')
      .eq('encounter_id', id)
      .order('performed_at', { ascending: true })

    const xml = buildPcrXml(
      enc as Record<string, unknown>,
      (vitals ?? []) as Record<string, unknown>[],
      (medications ?? []) as Record<string, unknown>[],
      (procedures ?? []) as Record<string, unknown>[]
    )

    res.setHeader('Content-Type', 'application/xml')
    res.setHeader('Content-Disposition', `attachment; filename="${enc.encounter_id || id}-NEMSIS.xml"`)
    return res.status(200).send(xml)
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
    console.error('[nemsis-export]', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
