import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createClient } from '@/lib/supabase/client'

export default function Dashboard() {
  const navigate = useNavigate()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        navigate('/login', { replace: true })
        return
      }
      try {
        const { data: employee } = await supabase
          .from('employees')
          .select('role')
          .eq('auth_user_id', user.id)
          .single()
        const isAdmin = employee && ['MD', 'DO', 'Admin'].includes((employee as any).role)
        navigate(isAdmin ? '/admin' : '/dashboard/my-unit', { replace: true })
      } catch {
        // Offline — default to field view
        navigate('/dashboard/my-unit', { replace: true })
      }
    }).catch(() => navigate('/dashboard/my-unit', { replace: true }))
  }, [navigate])

  return <div className="min-h-screen bg-gray-950" />
}
