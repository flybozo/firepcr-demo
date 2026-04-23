import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { createClient } from '@/lib/supabase/client'
import { UserProvider } from '@/contexts/UserContext'
import { PermissionProvider } from '@/contexts/PermissionProvider'

export default function AuthGuard({ children }: { children?: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const supabase = createClient()

    // Use getSession() first — reads from localStorage, works offline.
    // Then verify with getUser() in the background when online.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthenticated(!!session?.user)
      setMustChangePassword(!!session?.user?.user_metadata?.must_change_password)
      setLoading(false)
      // Background verify when online (don't block render)
      if (session?.user && navigator.onLine) {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (!user) {
            setAuthenticated(false)
          } else {
            setMustChangePassword(!!user.user_metadata?.must_change_password)
          }
        }).catch(() => { /* offline — session already set from local */ })
      }
    }).catch(() => {
      setLoading(false)
      setAuthenticated(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setAuthenticated(!!session?.user)
      setMustChangePassword(!!session?.user?.user_metadata?.must_change_password)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div className="min-h-screen bg-gray-950" />
  if (!authenticated) return <Navigate to="/login" replace />
  if (mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }
  return <UserProvider><PermissionProvider>{children || <Outlet />}</PermissionProvider></UserProvider>
}
