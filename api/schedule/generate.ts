
import type { VercelRequest, VercelResponse } from "@vercel/node"
import { HttpError, requireEmployee } from '../_auth.js'
import { brand } from '../_brand.js'
import { callLLM } from '../../src/lib/llm/index.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const { start_date, end_date, unit_ids } = req.body

    if (!start_date || !end_date || !unit_ids?.length) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const { supabase } = await requireEmployee(req, { admin: true })

    const [
      { data: employees },
      { data: wantToWork },
      { data: timeOff },
      { data: units },
    ] = await Promise.all([
      supabase
        .from('employees')
        .select('id, name, role, experience_level, rescue_capable')
        .eq('status', 'Active')
        .order('name'),
      supabase
        .from('schedule_requests')
        .select('employee_id, start_date, end_date')
        .eq('request_type', 'want_to_work')
        .eq('status', 'approved')
        .lte('start_date', end_date)
        .gte('end_date', start_date),
      supabase
        .from('schedule_requests')
        .select('employee_id, start_date, end_date')
        .eq('request_type', 'time_off')
        .eq('status', 'approved')
        .lte('start_date', end_date)
        .gte('end_date', start_date),
      supabase
        .from('units')
        .select('id, name, unit_type:unit_types(name)')
        .in('id', unit_ids)
        .eq('unit_status', 'in_service'),
    ])

    const timeOffEmployeeIds = new Set((timeOff || []).map((r: any) => r.employee_id))
    const wantToWorkIds = new Set((wantToWork || []).map((r: any) => r.employee_id))

    const availableEmployees = (employees || []).filter((e: any) => !timeOffEmployeeIds.has(e.id))

    const prompt = `${brand.schedulerContext}

Schedule period: ${start_date} to ${end_date}

Available employees (JSON):
${JSON.stringify(availableEmployees.map((e: any) => ({
  id: e.id,
  name: e.name,
  role: e.role,
  experience_level: e.experience_level || 1,
  rescue_capable: (e as any).rescue_capable || false,
  wants_to_work: wantToWorkIds.has(e.id),
})), null, 2)}

Units to staff (JSON):
${JSON.stringify((units || []).map((u: any) => ({
  id: u.id,
  name: u.name,
  unit_type: (u.unit_type as any)?.name || 'Unknown',
})), null, 2)}

Staffing rules (STRICTLY follow these):
- Use 2-week blocks (${start_date} to ${end_date})
- Med Unit: 1 Provider (MD/DO/NP/PA) + 1-2 others (Paramedic, RN, or EMT)
- Ambulance: 1-2 Paramedics + 1 EMT
- REMS: 4 REMS-capable employees with ≥1 Paramedic + ≥1 EMT
- Pair high experience (level 3) with low experience (level 1) when possible
- PREFER employees who want_to_work = true
- Do NOT assign employees with wants_to_work = false unless necessary
- Each employee should only appear in one unit at a time
- Only assign rescue_capable=true employees to REMS units

Return ONLY a valid JSON array (no explanation, no markdown) in this exact format:
[
  {
    "unit_id": "string",
    "unit_name": "string",
    "employee_id": "string",
    "employee_name": "string",
    "role": "string",
    "experience_level": 1,
    "start_date": "${start_date}",
    "end_date": "${end_date}"
  }
]`

    const llmResult = await callLLM({
      task:          'schedule-generation',
      phiClass:      'none',
      messages:      [{ role: 'user', content: prompt }],
      maxTokens:     4096,
      routeEndpoint: '/api/schedule/generate',
      supabase,
    })

    const content = llmResult.content

    // ── Parse and validate AI response ──
    const trimmed = content.trim()
    let rawJson: string
    if (trimmed.startsWith('[')) {
      rawJson = trimmed
    } else {
      const jsonMatch = trimmed.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        return res.status(500).json({ error: 'AI response did not contain a JSON array', raw: content.slice(0, 500) })
      }
      rawJson = jsonMatch[0]
    }

    let parsed: unknown[]
    try {
      parsed = JSON.parse(rawJson)
    } catch {
      return res.status(500).json({ error: 'AI response contained malformed JSON', raw: content.slice(0, 500) })
    }
    if (!Array.isArray(parsed)) {
      return res.status(422).json({ error: 'AI response was not a JSON array' })
    }

    // Validate each entry: reject unknown employees/units, strip extra keys, clamp numerics
    const validEmployeeIds = new Set((employees || []).map((e: any) => e.id))
    const validUnitIds = new Set(unit_ids as string[])
    const DATE_RE2 = /^\d{4}-\d{2}-\d{2}$/
    const schedule = parsed
      .filter((entry): entry is Record<string, unknown> =>
        !!entry && typeof entry === 'object' && !Array.isArray(entry))
      .map((entry) => {
        const e = entry as Record<string, unknown>
        if (!e.unit_id || !e.employee_id || !e.role) return null
        if (!validUnitIds.has(e.unit_id as string)) return null
        if (!validEmployeeIds.has(e.employee_id as string)) return null
        return {
          unit_id:          String(e.unit_id),
          unit_name:        typeof e.unit_name === 'string' ? e.unit_name.slice(0, 100) : '',
          employee_id:      String(e.employee_id),
          employee_name:    typeof e.employee_name === 'string' ? e.employee_name.slice(0, 100) : '',
          role:             typeof e.role === 'string' ? e.role.slice(0, 50) : '',
          experience_level: typeof e.experience_level === 'number'
            ? Math.min(Math.max(Math.round(e.experience_level), 1), 5) : 1,
          start_date: typeof e.start_date === 'string' && DATE_RE2.test(e.start_date) ? e.start_date : start_date,
          end_date:   typeof e.end_date   === 'string' && DATE_RE2.test(e.end_date)   ? e.end_date   : end_date,
        }
      })
      .filter(Boolean)

    if (schedule.length === 0) {
      return res.status(422).json({ error: 'AI returned an empty or entirely invalid schedule', raw: content.slice(0, 500) })
    }

    return res.json({ schedule })
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message })
    }
    console.error('Schedule generate error:', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}
