import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

// When offline, return a proper error response that Supabase SDK will propagate
// as { data: null, error: { message: 'offline' } }
const offlineAwareFetch: typeof fetch = async (input, init) => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    // Return a 400 with PostgrestError-shaped body so Supabase propagates the error
    return new Response(JSON.stringify({
      message: 'OFFLINE',
      details: 'Device is offline',
      hint: '',
      code: 'PGRST000'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return fetch(input, init)
}

// Singleton — one client for the entire app lifetime.
// Calling createClient() 79 times was creating 79 separate auth instances,
// GoTrue listeners, and connection pools → memory leak → browser crash.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: SupabaseClient<any> | null = null

export function createClient() {
  if (!_client) {
    _client = createSupabaseClient(
      import.meta.env.VITE_SUPABASE_URL!,
      import.meta.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          fetch: offlineAwareFetch,
        },
      }
    )
  }
  return _client
}
