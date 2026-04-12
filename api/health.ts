import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(req: VercelRequest, res: VercelResponse) {
  return res.json({
    ok: true,
    has_supabase_url: !!process.env.SUPABASE_URL,
    has_vite_url: !!process.env.VITE_SUPABASE_URL,
    has_next_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    has_anon_key: !!process.env.VITE_SUPABASE_ANON_KEY,
  })
}
