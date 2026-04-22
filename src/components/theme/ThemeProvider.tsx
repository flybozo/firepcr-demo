import { useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Theme } from './types'
import { DEFAULT_THEME } from './presets'
import { applyThemeToDom } from './domUtils'
import { ThemeContext } from './context'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [employeeId, setEmployeeId] = useState<string | null>(null)
  const [isPersonalTheme, setIsPersonalTheme] = useState(false)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()

      const { data: orgData } = await supabase
        .from('organizations')
        .select('id, theme')
        .limit(1)
        .single()

      const orgTheme: Theme = orgData?.theme
        ? { ...DEFAULT_THEME, ...orgData.theme, colors: { ...DEFAULT_THEME.colors, ...(orgData.theme as Theme).colors } }
        : DEFAULT_THEME

      if (orgData) setOrgId(orgData.id)

      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: emp } = await supabase
          .from('employees')
          .select('id, personal_theme')
          .eq('auth_user_id', session.user.id)
          .single()

        if (emp) {
          setEmployeeId(emp.id)
          if (emp.personal_theme) {
            const personalTheme: Theme = { ...DEFAULT_THEME, ...emp.personal_theme, colors: { ...DEFAULT_THEME.colors, ...(emp.personal_theme as Theme).colors } }
            setTheme(personalTheme)
            setIsPersonalTheme(true)
            applyThemeToDom(personalTheme)
            return
          }
        }
      }

      setTheme(orgTheme)
      applyThemeToDom(orgTheme)
    }
    load()
  }, [])

  const applyTheme = useCallback((t: Theme) => {
    setTheme(t)
    applyThemeToDom(t)
  }, [])

  const saveTheme = useCallback(async (t: Theme) => {
    if (!orgId) return
    const supabase = createClient()
    await supabase
      .from('organizations')
      .update({ theme: t })
      .eq('id', orgId)
    setTheme(t)
    applyThemeToDom(t)
  }, [orgId])

  const savePersonalTheme = useCallback(async (t: Theme | null) => {
    if (!employeeId) return
    const supabase = createClient()
    await supabase
      .from('employees')
      .update({ personal_theme: t })
      .eq('id', employeeId)
    if (t) {
      setTheme(t)
      setIsPersonalTheme(true)
      applyThemeToDom(t)
    } else {
      setIsPersonalTheme(false)
      const { data: orgData } = await supabase.from('organizations').select('theme').limit(1).single()
      const orgTheme = orgData?.theme
        ? { ...DEFAULT_THEME, ...orgData.theme, colors: { ...DEFAULT_THEME.colors, ...(orgData.theme as Theme).colors } }
        : DEFAULT_THEME
      setTheme(orgTheme)
      applyThemeToDom(orgTheme)
    }
  }, [employeeId])

  return (
    <ThemeContext.Provider value={{ theme, orgId, applyTheme, saveTheme, savePersonalTheme, isPersonalTheme }}>
      <style>{`
        body::before {
          content: '';
          position: fixed;
          inset: 0;
          z-index: -1;
          background-image: var(--bg-image, none);
          background-size: cover;
          background-position: center;
          opacity: var(--bg-opacity, 0.05);
          pointer-events: none;
        }
      `}</style>
      {children}
    </ThemeContext.Provider>
  )
}
