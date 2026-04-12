import { createClient } from '@supabase/supabase-js'

export function createServiceClient() {
  const url = process.env.SUPABASE_URL 
    || process.env.VITE_SUPABASE_URL 
    || process.env.NEXT_PUBLIC_SUPABASE_URL
    || 'https://kfkpvazkikpuwatthtow.supabase.co' // fallback

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')
  
  return createClient(url, key)
}
