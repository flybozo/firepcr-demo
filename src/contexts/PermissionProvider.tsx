import { useState, useEffect, type ReactNode } from 'react'
import { openDB } from 'idb'
import { PermissionContext } from '@/hooks/usePermission'
import { createClient } from '@/lib/supabase/client'

async function loadCachedPermissions(): Promise<string[] | null> {
  try {
    const db = await openDB('ram-permissions', 1, {
      upgrade(db) { db.createObjectStore('permissions') },
    })
    return (await db.get('permissions', 'mine')) ?? null
  } catch {
    return null
  }
}

async function saveCachedPermissions(perms: string[]): Promise<void> {
  try {
    const db = await openDB('ram-permissions', 1, {
      upgrade(db) { db.createObjectStore('permissions') },
    })
    await db.put('permissions', perms, 'mine')
  } catch {}
}

export function PermissionProvider({ children }: { children: ReactNode }) {
  const [permissions, setPermissions] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function loadPermissions() {
      const cached = await loadCachedPermissions()
      if (cached && !cancelled) {
        setPermissions(new Set(cached))
        setLoading(false)
      }

      // getSession() reads from localStorage — works offline
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user ?? null
      if (!user || cancelled) {
        if (!cached) {
          setPermissions(new Set())
          setLoading(false)
          // Seed so subsequent offline loads resolve immediately as field user
          saveCachedPermissions([])
        }
        return
      }

      // Only fetch live permissions when online
      if (!navigator.onLine) {
        if (!cached) {
          setPermissions(new Set())
          setLoading(false)
          // Seed so subsequent offline loads resolve immediately as field user
          saveCachedPermissions([])
        }
        return
      }

      try {
        const { data } = await supabase.rpc('get_my_permissions')
        if (!cancelled) {
          const perms = data as string[] | null
          const permSet = new Set<string>(perms || [])
          setPermissions(permSet)
          setLoading(false)
          await saveCachedPermissions(perms || [])
        }
      } catch {
        // Network failed — use cached permissions or empty set
        if (!cancelled && cached === null) {
          setPermissions(new Set())
          setLoading(false)
        }
      }
    }

    loadPermissions()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadPermissions()
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  return (
    <PermissionContext.Provider value={{ permissions, loading }}>
      {children}
    </PermissionContext.Provider>
  )
}
