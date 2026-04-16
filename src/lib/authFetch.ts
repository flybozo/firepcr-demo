
import { createClient } from '@/lib/supabase/client'

async function getAccessToken() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = await getAccessToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  const headers = new Headers(init.headers || {})
  headers.set('Authorization', `Bearer ${token}`)

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return fetch(input, { ...init, headers })
}
