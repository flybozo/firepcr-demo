import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { createClient } from '@/lib/supabase/client'
import { UserProvider } from '@/contexts/UserContext'
import { PermissionProvider } from '@/contexts/PermissionProvider'

export default function AuthGuard({ children }: { children?: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setAuthenticated(!!user)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setAuthenticated(!!session?.user)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div className="min-h-screen bg-gray-950" />
  if (!authenticated) return <Navigate to="/login" replace />
  return <UserProvider><PermissionProvider>{children || <Outlet />}</PermissionProvider></UserProvider>
}
