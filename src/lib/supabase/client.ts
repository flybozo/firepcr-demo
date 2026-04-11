import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Custom fetch that catches network errors and returns empty results
// instead of throwing — prevents every page from crashing when offline
const offlineSafeFetch: typeof fetch = async (input, init) => {
  try {
    return await fetch(input, init)
  } catch (err) {
    // Network error (offline) — return a fake 503 response
    // This prevents Supabase client from throwing and crashing React components
    console.log('[Supabase] Network error, returning offline response')
    return new Response(JSON.stringify({ data: null, error: { message: 'offline', code: 'NETWORK_ERROR' } }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export function createClient() {
  return createSupabaseClient(
    import.meta.env.VITE_SUPABASE_URL!,
    import.meta.env.VITE_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: offlineSafeFetch,
      },
    }
  )
}
