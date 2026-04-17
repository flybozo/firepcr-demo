
import type { VercelRequest } from '@vercel/node'
import { createServiceClient } from './_supabase.js'

export class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function getBearerToken(req: VercelRequest): string {
  const header = req.headers.authorization
  const value = Array.isArray(header) ? header[0] : header

  if (!value?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Unauthorized')
  }

  const token = value.slice('Bearer '.length).trim()
  if (!token) throw new HttpError(401, 'Unauthorized')
  return token
}

export async function requireAuthUser(req: VercelRequest) {
  const token = getBearerToken(req)
  const supabase = createServiceClient()
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    throw new HttpError(401, 'Unauthorized')
  }

  return { user, supabase }
}

export async function requireEmployee(req: VercelRequest, options?: { admin?: boolean }) {
  const { user, supabase } = await requireAuthUser(req)
  const { data: employee, error } = await supabase
    .from('employees')
    .select('id, name, role, app_role, chat_authority, status, auth_user_id')
    .eq('auth_user_id', user.id)
    .single()

  if (error || !employee) {
    throw new HttpError(403, 'Employee record not found')
  }

  if (options?.admin && employee.app_role !== 'admin') {
    throw new HttpError(403, 'Admin access required')
  }

  const isAdmin = employee.app_role === 'admin'
  return { user, employee, isAdmin, supabase }
}
