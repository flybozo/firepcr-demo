import { createClient } from '@supabase/supabase-js'

export function createServiceClient() {
  const url = process.env.SUPABASE_URL
    || process.env.VITE_SUPABASE_URL
    || process.env.NEXT_PUBLIC_SUPABASE_URL

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('SUPABASE_URL not set — add it to Vercel environment variables')
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set — add it to Vercel environment variables')

  return createClient(url, key)
}
