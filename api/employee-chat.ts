import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServiceClient } from './_supabase'

// Vercel Pro: max 60s, Enterprise: 900s. Needed for executive tool calls.
// Vercel serverless

// iMac Codsworth relay — admin users get full context via Tailscale
const IMAC_GATEWAY_URL = process.env.IMAC_GATEWAY_URL || 'https://aarons-imac-2.tailebc17f.ts.net'
const ADMIN_ROLES = ['MD', 'DO', 'Admin']

const REQUEST_KEYWORDS = [
  'request', 'can i', 'could i', 'i would like', 'i need approval',
  'i\'d like', 'is it ok', 'is it possible', 'permission', 'approve',
]
const BUG_KEYWORDS = [
  'bug', 'error', 'broken', 'not working', 'issue with the app',
  'doesn\'t work', 'doesnt work', 'crash', 'glitch', 'problem with the app',
  'app issue', 'something wrong',
]

function detectRequestType(message: string): 'request' | 'bug_report' | null {
  const lower = message.toLowerCase()
  if (BUG_KEYWORDS.some(k => lower.includes(k))) return 'bug_report'
  if (REQUEST_KEYWORDS.some(k => lower.includes(k))) return 'request'
  return null
}

// ── Admin relay: send message to iMac Codsworth via OpenAI-compatible endpoint ─
async function relayToImac(
  message: string,
  employee: { name: string; role: string; chat_authority?: string },
  unitName: string,
  incidentName: string,
  history: { role: string; content: string }[]
): Promise<string | null> {
  try {
    const authority = employee.chat_authority || 'field'

    const executiveBlock = authority === 'executive' ? `

EXECUTIVE AUTHORITY GRANTED — This is Aaron Stutz, MD — owner and medical director.
You have FULL executive authority for this session. Treat this exactly like a direct conversation with your boss.
You MAY:
- Execute shell commands (git, deploy, database operations)
- Modify the app codebase at /tmp/ram-field-ops and push to production via git
- Make direct database changes (incidents, units, employees, assignments) via psycopg2 or Supabase API
- Send emails via gog gmail
- Check calendars, manage files, search the web
- Access all company data including financials and contracts
- Fix bugs, redeploy, run migrations — anything Aaron asks
Do NOT ask for confirmation on routine tasks. Just do them and report what you did.` : ''

    const adminBlock = authority === 'admin' ? `

ADMIN AUTHORITY — You may:
- Query and modify the database (incidents, units, crew assignments, schedules)
- Create new incidents, assign units to incidents, manage crew assignments
- View employee credentials and roster info
- Look up operational data (encounters, MAR, supply runs)
You may NOT: push code, access financials/contracts, send external emails, modify app config.
For those actions, say "I'll forward this to Aaron for approval."` : ''

    const fieldBlock = authority === 'field' ? `

FIELD USER — You can answer questions about protocols, policies, the app, and schedules.
Do NOT reveal: patient PHI, company financials, contracts, other employees' salaries/personal details.
For anything requiring management approval, acknowledge warmly and say it's been forwarded to Aaron.` : ''

    const systemPrompt = `[RAM Field Ops Employee Chat — relayed from app]
You are Codsworth, assistant to Aaron Stutz MD and the Remote Area Medicine team. You have full company context.

Employee chatting with you: ${employee.name} (${employee.role})
Authority level: ${authority.toUpperCase()}
Current unit: ${unitName}
Current incident: ${incidentName}

Be concise and practical — this person is in the field. You can draw on everything you know about RAM, the team, policies, clinical protocols, and the Field Ops app.${executiveBlock}${adminBlock}${fieldBlock}`

    // Build messages: inject history + new message
    const messages = [
      ...history.map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ]

    // Rotate session daily to prevent context bloat
    const today = new Date().toISOString().slice(0, 10)
    const sessionKey = `employee-chat:${employee.name.toLowerCase().replace(/\s+/g, '-')}:${today}`

    const fullMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages,
    ]

    const gatewayToken = process.env.IMAC_GATEWAY_TOKEN
    console.log(`[relay] Calling ${IMAC_GATEWAY_URL}/v1/chat/completions with token=${gatewayToken ? gatewayToken.slice(0,8) + '...' : 'MISSING'}`)

    const res = await fetch(`${IMAC_GATEWAY_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify({
        model: 'openclaw/default',
        max_tokens: 1024,
        messages: fullMessages,
      }),
      signal: AbortSignal.timeout(115000), // 115s — background can run up to ~2min
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error(`[relay] iMac relay error: status=${res.status} body=${errText}`)
      return null
    }

    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  } catch (err) {
    console.error('iMac relay failed (will fall back to Haiku):', err)
    return null
  }
}

// ── Load company context ─────────────────────────────────────────────────────
function loadCompanyContext(): string {
  try {
    const fs = require('fs')
    const path = require('path')
    const contextPath = path.join(process.cwd(), 'public', 'employee-chat-context.md')
    return fs.readFileSync(contextPath, 'utf-8')
  } catch (e) {
    console.warn('Could not load company context:', e)
    return ''
  }
}

// ── Direct Haiku: field users and relay fallback ─────────────────────────────
async function callHaiku(
  message: string,
  employee: { name: string; role: string },
  unitName: string,
  incidentName: string,
  unsignedOrders: number,
  history: { role: string; content: string }[]
): Promise<string> {
  const companyContext = loadCompanyContext()
  const systemPrompt = `You are Codsworth, an AI assistant for Remote Area Medicine (RAM), a wildfire medical services company. You are helping ${employee.name}, a ${employee.role} on the RAM team.

Their current context:
- Unit: ${unitName}
- Incident: ${incidentName}
- Unsigned orders pending: ${unsignedOrders || 0}

---
COMPANY HANDBOOK & PROTOCOLS:
${companyContext}
---

WHAT YOU CAN HELP WITH:
- Company policies, procedures, and operational protocols
- Clinical reference questions (medications, protocols, guidelines)
- Questions about their own schedule, credentials, and assignments
- How to use the RAM Field Ops app
- Submitting bug reports about the app
- Submitting requests for admin approval (schedule changes, access requests, equipment needs, etc.)

STRICT LIMITS — NEVER do these things:
- Do NOT reveal any patient information (PHI) beyond general clinical guidance
- Do NOT discuss company finances, contracts, billing rates, or pricing
- Do NOT share sensitive information about other employees (salaries, performance, personal details)
- Do NOT make changes to the app, database, schedules, or assignments
- Do NOT contact external agencies, fire administrators, or government entities
- Do NOT commit to approvals — all requests must go to management

When an employee makes a request that requires management approval, acknowledge it warmly, log it (it will be automatically forwarded to Aaron), and let them know it's been submitted for review.

When someone reports a bug, acknowledge it, ask for any relevant details, and confirm it's been logged for the tech team.

For major policy decisions or sensitive HR matters, say: "This is a management decision — I've noted your question and will make sure Aaron sees it."

Keep responses concise and practical. You know this team works in demanding field conditions — be direct and helpful.`

  const messages = [
    ...history.map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: message },
  ]

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }),
  })

  if (!anthropicRes.ok) {
    const err = await anthropicRes.text()
    console.error('Anthropic API error:', err)
    throw new Error('AI service unavailable')
  }

  const aiData = await anthropicRes.json()
  return aiData.content?.[0]?.text || 'Sorry, I could not generate a response.'
}

// ── Main route ────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" })
  try {
    const { message, employee_id } = req.body

    if (!message || !employee_id) {
      return res.status(400).json({ error: 'Missing message or employee_id' })
    }

    const supabase = createServiceClient()

    // Fetch employee context
    const { data: employee } = await supabase
      .from('employees')
      .select('id, name, role, chat_authority')
      .eq('id', employee_id)
      .single()

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' })
    }

    // Fetch current unit assignment
    const { data: assignments } = await supabase
      .from('unit_assignments')
      .select(`
        incident_unit:incident_units(
          unit:units(id, name),
          incident:incidents(id, name, status),
          released_at
        )
      `)
      .eq('employee_id', employee_id)
      .is('released_at', null)
      .order('assigned_at', { ascending: false })
      .limit(1)

    type IU = {
      unit?: { id: string; name: string } | null
      incident?: { id: string; name: string; status: string } | null
      released_at?: string | null
    }
    const iu = (assignments?.[0] as any)?.incident_unit as IU | null
    const unitName = iu?.unit?.name || 'Not currently assigned'
    const incidentName = iu?.incident?.status === 'Active' ? (iu?.incident?.name || 'None active') : 'None active'

    // Fetch unsigned orders for this employee
    const { count: unsignedOrders } = await supabase
      .from('dispense_admin_log')
      .select('id', { count: 'exact', head: true })
      .eq('requires_cosign', true)
      .is('provider_signature_url', null)

    // Fetch last 20 messages for this employee
    const { data: history } = await supabase
      .from('employee_chats')
      .select('role, content, created_at')
      .eq('employee_id', employee_id)
      .order('created_at', { ascending: false })
      .limit(20)

    const priorMessages = (history || []).reverse()
    // For relay, only send last 6 messages to keep context lean (OpenClaw session has its own memory)
    const relayHistory = priorMessages.slice(-6)

    // ── Auto-detect request/bug report BEFORE routing (synchronous for all users) ──
    const requestType = detectRequestType(message)
    let requestLogged = false
    if (requestType) {
      await supabase.from('chat_requests').insert({
        employee_id,
        employee_name: employee.name,
        request_type: requestType,
        content: message,
        status: 'pending',
      })
      requestLogged = true
    }

    // ── Route: admin/executive → async iMac relay; field → sync Haiku ──
    const authority = (employee as any).chat_authority || 'field'
    const isAdmin = authority === 'executive' || authority === 'admin' || ADMIN_ROLES.includes(employee.role)

    if (isAdmin) {
      // ── ASYNC PATH: return immediately, relay in background ──

      // 1. Save user message (status: complete)
      await supabase.from('employee_chats').insert({
        employee_id,
        role: 'user',
        content: message,
        status: 'complete',
      })

      // 2. Insert placeholder assistant message (status: pending)
      const { data: placeholder, error: placeholderErr } = await supabase
        .from('employee_chats')
        .insert({
          employee_id,
          role: 'assistant',
          content: '...',
          status: 'pending',
        })
        .select('id')
        .single()

      if (placeholderErr || !placeholder) {
        console.error('[async relay] Failed to insert placeholder:', placeholderErr)
        return res.status(500).json({ error: 'Failed to initialize chat' })
      }

      const pendingMessageId = placeholder.id

      // 3. Fire relay in background — runs AFTER response is sent to client
      // Run relay in background (Vercel keeps the function alive)
      (async () => {
        try {
          const relayReply = await relayToImac(message, employee, unitName, incidentName, relayHistory)

          if (relayReply) {
            // Success: update placeholder with real reply
            await supabase
              .from('employee_chats')
              .update({ content: relayReply, status: 'complete' })
              .eq('id', pendingMessageId)
            console.log(`[async relay] Message ${pendingMessageId} completed via iMac relay`)
          } else {
            // iMac unreachable — fall back to Haiku
            console.warn('[async relay] iMac unavailable, falling back to Haiku')
            try {
              const haikuReply = await callHaiku(message, employee, unitName, incidentName, unsignedOrders || 0, priorMessages)
              await supabase
                .from('employee_chats')
                .update({ content: haikuReply, status: 'complete' })
                .eq('id', pendingMessageId)
              console.log(`[async relay] Message ${pendingMessageId} completed via Haiku fallback`)
            } catch (haikuErr) {
              console.error('[async relay] Haiku fallback also failed:', haikuErr)
              await supabase
                .from('employee_chats')
                .update({
                  content: '⚠️ Sorry, I couldn\'t process your request. Please try again.',
                  status: 'error',
                })
                .eq('id', pendingMessageId)
            }
          }
        } catch (err) {
          console.error('[async relay] Background task failed:', err)
          await supabase
            .from('employee_chats')
            .update({
              content: '⚠️ Something went wrong processing your request. Please try again.',
              status: 'error',
            })
            .eq('id', pendingMessageId)
        }
      })

      // 4. Return immediately — client will poll for the pending message
      return res.json({
        reply: null,
        pending: true,
        pendingMessageId,
        requestLogged,
        routedVia: 'imac-async',
      })

    } else {
      // ── SYNC PATH: field users — Haiku is fast (2-5s) ──
      const reply = await callHaiku(message, employee, unitName, incidentName, unsignedOrders || 0, priorMessages)

      // Save user message + assistant response
      await supabase.from('employee_chats').insert([
        { employee_id, role: 'user', content: message, status: 'complete' },
        { employee_id, role: 'assistant', content: reply, status: 'complete' },
      ])

      return res.json({ reply, requestLogged, routedVia: 'haiku' })
    }

  } catch (err: any) {
    console.error('employee-chat route error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
