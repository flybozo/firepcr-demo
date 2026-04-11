import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// When offline, throw immediately — don't let Supabase swallow the error
const offlineAwareFetch: typeof fetch = async (input, init) => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new TypeError('Failed to fetch')
  }
  return fetch(input, init)
}

export function createClient() {
  return createSupabaseClient(
    import.meta.env.VITE_SUPABASE_URL!,
    import.meta.env.VITE_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: offlineAwareFetch,
      },
    }
  )
}
