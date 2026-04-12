import type { VercelRequest, VercelResponse } from "@vercel/node"
import { createServiceClient } from '../_supabase'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const { start_date, end_date, unit_ids } = req.body

    if (!start_date || !end_date || !unit_ids?.length) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const supabase = createServiceClient()

    // Fetch all needed data in parallel
    const [
      { data: employees },
      { data: wantToWork },
      { data: timeOff },
      { data: units },
    ] = await Promise.all([
      supabase
        .from('employees')
        .select('id, name, role, experience_level, rems_capable')
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

    const prompt = `You are a medical team scheduler for Remote Area Medicine (RAM), a company providing wildfire medical services.

Schedule period: ${start_date} to ${end_date}

Available employees (JSON):
${JSON.stringify(availableEmployees.map((e: any) => ({
  id: e.id,
  name: e.name,
  role: e.role,
  experience_level: e.experience_level || 1,
  rems_capable: (e as any).rems_capable || false,
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
- Only assign rems_capable=true employees to REMS units

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

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text()
      return res.status(500).json({ error: `Anthropic API error: ${err}` })
    }

    const aiData = await anthropicRes.json()
    const content = aiData.content?.[0]?.text || ''

    // Extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Could not parse schedule from AI response', raw: content })
    }

    const schedule = JSON.parse(jsonMatch[0])
    return res.json({ schedule })
  } catch (err: any) {
    console.error('Schedule generate error:', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}
