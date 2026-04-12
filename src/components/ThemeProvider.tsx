

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ThemeColors = {
  primary: string
  primaryHover: string
  secondary: string
  accent: string
  headerBg: string
  cardBg: string
  pageBg: string
  sidebarBg: string
  text: string
  textMuted: string
  border: string
  success: string
  warning: string
  danger: string
}

export type Theme = {
  preset: string
  colors: ThemeColors
  backgroundImage: string | null
  backgroundOpacity: number
  cardTransparency: number
  borderRadius: string
  font?: string // CSS font-family value
}

// ── Presets ───────────────────────────────────────────────────────────────────

export const THEME_PRESETS: Record<string, { label: string; description: string; colors: ThemeColors }> = {
  ember: {
    label: '🔥 Cal Fire',
    description: 'Dark with red accents. Keep California safe.',
    colors: {
      primary: '#dc2626',
      primaryHover: '#b91c1c',
      secondary: '#1e40af',
      accent: '#d97706',
      headerBg: '#030712',
      cardBg: '#111827',
      pageBg: '#030712',
      sidebarBg: '#0a0a0a',
      text: '#f3f4f6',
      textMuted: '#9ca3af',
      border: '#1f2937',
      success: '#16a34a',
      warning: '#d97706',
      danger: '#dc2626',
    },
  },
  pacific: {
    label: 'Pacific',
    description: 'Dark navy with ocean blue accents. Maritime feel.',
    colors: {
      primary: '#2563eb',
      primaryHover: '#1d4ed8',
      secondary: '#0ea5e9',
      accent: '#38bdf8',
      headerBg: '#020617',
      cardBg: '#0f172a',
      pageBg: '#020617',
      sidebarBg: '#020617',
      text: '#f1f5f9',
      textMuted: '#94a3b8',
      border: '#1e3a5f',
      success: '#16a34a',
      warning: '#d97706',
      danger: '#dc2626',
    },
  },
  forest: {
    label: '🌲 Forest Service',
    description: 'Green & gold. Shield up.',
    colors: {
      primary: '#fbbf24',
      primaryHover: '#f59e0b',
      secondary: '#16a34a',
      accent: '#84cc16',
      headerBg: '#022c22',
      cardBg: '#052e16',
      pageBg: '#022c22',
      sidebarBg: '#011a14',
      text: '#f0fdf4',
      textMuted: '#86efac',
      border: '#14532d',
      success: '#16a34a',
      warning: '#fbbf24',
      danger: '#dc2626',
    },
  },
  sierra: {
    label: 'Sierra',
    description: 'Warm earth tones. Desert/mountain operations.',
    colors: {
      primary: '#d97706',
      primaryHover: '#b45309',
      secondary: '#b45309',
      accent: '#f59e0b',
      headerBg: '#1c1917',
      cardBg: '#292524',
      pageBg: '#1c1917',
      sidebarBg: '#0c0a09',
      text: '#fafaf9',
      textMuted: '#a8a29e',
      border: '#44403c',
      success: '#16a34a',
      warning: '#d97706',
      danger: '#dc2626',
    },
  },
  arctic: {
    label: 'Arctic',
    description: 'Cool grays with ice blue. Clean, clinical feel.',
    colors: {
      primary: '#06b6d4',
      primaryHover: '#0891b2',
      secondary: '#8b5cf6',
      accent: '#67e8f9',
      headerBg: '#0f172a',
      cardBg: '#1e293b',
      pageBg: '#0f172a',
      sidebarBg: '#0a1120',
      text: '#f8fafc',
      textMuted: '#94a3b8',
      border: '#334155',
      success: '#16a34a',
      warning: '#d97706',
      danger: '#dc2626',
    },
  },
  midnight: {
    label: 'Midnight',
    description: 'Deep purple/indigo. Modern, sleek.',
    colors: {
      primary: '#7c3aed',
      primaryHover: '#6d28d9',
      secondary: '#a855f7',
      accent: '#c084fc',
      headerBg: '#0c0a1d',
      cardBg: '#1a1535',
      pageBg: '#0c0a1d',
      sidebarBg: '#080618',
      text: '#faf5ff',
      textMuted: '#a78bfa',
      border: '#312e81',
      success: '#16a34a',
      warning: '#d97706',
      danger: '#dc2626',
    },
  },
  barbie: {
    label: '💖 Barbie',
    description: 'Life in plastic, it\'s fantastic',
    colors: {
      primary: '#ff69b4',
      primaryHover: '#ff1493',
      secondary: '#ff85c8',
      accent: '#ff00ff',
      headerBg: '#1a0011',
      cardBg: '#2d0020',
      pageBg: '#1a0011',
      sidebarBg: '#12000b',
      text: '#ffeef8',
      textMuted: '#ff85c8',
      border: '#4a0033',
      success: '#ff69b4',
      warning: '#ff85c8',
      danger: '#ff1493',
    },
  },
  rainbow: {
    label: '🌈 Rainbow',
    description: 'Taste the rainbow',
    colors: {
      primary: '#ff0000',
      primaryHover: '#cc0000',
      secondary: '#ff8800',
      accent: '#9b59b6',
      headerBg: '#fffaf5',
      cardBg: '#fff5ee',
      pageBg: '#fffaf5',
      sidebarBg: '#ffe0cc',
      text: '#2d1b0e',
      textMuted: '#8b5e3c',
      border: '#f0d0b8',
      success: '#27ae60',
      warning: '#f1c40f',
      danger: '#e74c3c',
    },
  },
  douchebag: {
    label: '🔥 Douchebag',
    description: 'Affliction tee energy',
    colors: {
      primary: '#ff6600',
      primaryHover: '#e55c00',
      secondary: '#ff8533',
      accent: '#ffad33',
      headerBg: '#0a0a0a',
      cardBg: '#141414',
      pageBg: '#0a0a0a',
      sidebarBg: '#050505',
      text: '#ff8533',
      textMuted: '#995200',
      border: '#2a1a00',
      success: '#ff6600',
      warning: '#ffad33',
      danger: '#ff3300',
    },
  },
  prepper: {
    label: '🪖 Prepper',
    description: 'Blend in. Stay ready.',
    colors: {
      primary: '#4b5320',
      primaryHover: '#3a4119',
      secondary: '#6b7a3d',
      accent: '#8b7355',
      headerBg: '#1a1c14',
      cardBg: '#2a2d22',
      pageBg: '#1a1c14',
      sidebarBg: '#13150f',
      text: '#d4d4aa',
      textMuted: '#8b8b6e',
      border: '#3d4030',
      success: '#4b5320',
      warning: '#8b7355',
      danger: '#8b0000',
    },
  },
  patriot: {
    label: '🇺🇸 Patriot',
    description: "'Murica!",
    colors: {
      primary: '#b22234',
      primaryHover: '#8b1a29',
      secondary: '#3c3b6e',
      accent: '#b22234',
      headerBg: '#ffffff',
      cardBg: '#f5f5f5',
      pageBg: '#ffffff',
      sidebarBg: '#3c3b6e',
      text: '#1a1a2e',
      textMuted: '#5c5c7a',
      border: '#d4d4d8',
      success: '#16a34a',
      warning: '#d97706',
      danger: '#b22234',
    },
  },
  sunworshipper: {
    label: '☀️ Sun Worshipper',
    description: 'Golden hour, all day',
    colors: {
      primary: '#d4a017',
      primaryHover: '#b8860b',
      secondary: '#e8912d',
      accent: '#f5c842',
      headerBg: '#fffdf5',
      cardBg: '#fef9e7',
      pageBg: '#fffdf5',
      sidebarBg: '#f5e6b8',
      text: '#3d2e0a',
      textMuted: '#8b7335',
      border: '#e8d5a3',
      success: '#5a8f29',
      warning: '#d4a017',
      danger: '#c0392b',
    },
  },
  grandma: {
    label: '🌸 Grandma',
    description: 'Smells like lavender and cookies',
    colors: {
      primary: '#c24b7a',
      primaryHover: '#a33d65',
      secondary: '#d4869c',
      accent: '#7aa37a',
      headerBg: '#fff5f8',
      cardBg: '#fceef2',
      pageBg: '#fff5f8',
      sidebarBg: '#f5d5e0',
      text: '#3d1a2a',
      textMuted: '#8b5a6e',
      border: '#e8b8ca',
      success: '#7aa37a',
      warning: '#d4a017',
      danger: '#c24b7a',
    },
  },
  surfer: {
    label: '🏖️ Surfer',
    description: 'Hang loose, brah',
    colors: {
      primary: '#8b6914',
      primaryHover: '#705410',
      secondary: '#6b9e9e',
      accent: '#c2a366',
      headerBg: '#faf5eb',
      cardBg: '#f0ead4',
      pageBg: '#faf5eb',
      sidebarBg: '#ddd4b8',
      text: '#3d3520',
      textMuted: '#8b7e5e',
      border: '#d4c9a8',
      success: '#6b9e9e',
      warning: '#c2a366',
      danger: '#b85c3a',
    },
  },
  elgaucho: {
    label: '🍊 El Gaucho',
    description: 'Zesty with a kick',
    colors: {
      primary: '#e8630a',
      primaryHover: '#c75308',
      secondary: '#84b818',
      accent: '#ff9e1a',
      headerBg: '#fffefa',
      cardBg: '#fff8f0',
      pageBg: '#fffefa',
      sidebarBg: '#f5e0c0',
      text: '#2d1a05',
      textMuted: '#8b6530',
      border: '#e8d0a8',
      success: '#84b818',
      warning: '#ff9e1a',
      danger: '#e8630a',
    },
  },
  overcast: {
    label: '☁️ Overcast',
    description: 'Cool, calm, collected',
    colors: {
      primary: '#4a6fa5',
      primaryHover: '#3b5a87',
      secondary: '#6b8cba',
      accent: '#8facc8',
      headerBg: '#f0f2f5',
      cardBg: '#e8eaed',
      pageBg: '#f0f2f5',
      sidebarBg: '#d8dce2',
      text: '#1a2433',
      textMuted: '#5a6a7a',
      border: '#c8cdd5',
      success: '#2e8b57',
      warning: '#b8860b',
      danger: '#c0392b',
    },
  },
  hippie: {
    label: '🌿 Hippie',
    description: 'Peace, love & good vibes',
    colors: {
      primary: '#5f8a5f',
      primaryHover: '#4a7a4a',
      secondary: '#8faa5f',
      accent: '#c2b280',
      headerBg: '#f9faf5',
      cardBg: '#f0f4e8',
      pageBg: '#f9faf5',
      sidebarBg: '#dde5cc',
      text: '#2a3320',
      textMuted: '#6b7a55',
      border: '#c8d4a8',
      success: '#5f8a5f',
      warning: '#c2b280',
      danger: '#a05a3c',
    },
  },
  doc: {
    label: '🏥 Doc',
    description: 'Scrub up, look sharp',
    colors: {
      primary: '#0d9488',
      primaryHover: '#0a7a70',
      secondary: '#475569',
      accent: '#06b6d4',
      headerBg: '#ffffff',
      cardBg: '#f8fafc',
      pageBg: '#ffffff',
      sidebarBg: '#0f172a',
      text: '#0f172a',
      textMuted: '#64748b',
      border: '#e2e8f0',
      success: '#0d9488',
      warning: '#d97706',
      danger: '#dc2626',
    },
  },
  cyborg: {
    label: '🤖 Cyborg',
    description: 'Machine learning intensifies',
    colors: {
      primary: '#00ff41',
      primaryHover: '#00cc33',
      secondary: '#0066ff',
      accent: '#00ffff',
      headerBg: '#0a0a0a',
      cardBg: '#0d1117',
      pageBg: '#0a0a0a',
      sidebarBg: '#050a05',
      text: '#00ff41',
      textMuted: '#00aa2a',
      border: '#00ff4133',
      success: '#00ff41',
      warning: '#ffff00',
      danger: '#ff0000',
    },
  },
  terminal: {
    label: '⌨️ Terminal',
    description: 'sudo make me a sandwich',
    colors: {
      primary: '#ff6600',
      primaryHover: '#cc5200',
      secondary: '#ffaa00',
      accent: '#ff8800',
      headerBg: '#0c0c0c',
      cardBg: '#141414',
      pageBg: '#0c0c0c',
      sidebarBg: '#080808',
      text: '#ff6600',
      textMuted: '#994400',
      border: '#ff660033',
      success: '#00ff00',
      warning: '#ffff00',
      danger: '#ff0000',
    },
  },
  neon: {
    label: '💠 Neon',
    description: 'Synthwave vibes only',
    colors: {
      primary: '#ff00ff',
      primaryHover: '#cc00cc',
      secondary: '#00ffff',
      accent: '#ff00aa',
      headerBg: '#0d0014',
      cardBg: '#1a0028',
      pageBg: '#0d0014',
      sidebarBg: '#08000f',
      text: '#ffffff',
      textMuted: '#cc88ff',
      border: '#ff00ff33',
      success: '#00ffaa',
      warning: '#ffff00',
      danger: '#ff0055',
    },
  },
}

export const DEFAULT_THEME: Theme = {
  preset: 'ember',
  colors: THEME_PRESETS.ember.colors,
  backgroundImage: null,
  backgroundOpacity: 0.05,
  cardTransparency: 1.0,
  borderRadius: '0.75rem',
}

// ── Context ───────────────────────────────────────────────────────────────────

type ThemeContextValue = {
  theme: Theme
  orgId: string | null
  applyTheme: (t: Theme) => void
  saveTheme: (t: Theme) => Promise<void>
  savePersonalTheme: (t: Theme | null) => Promise<void>
  isPersonalTheme: boolean
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  orgId: null,
  applyTheme: () => {},
  saveTheme: async () => {},
  savePersonalTheme: async () => {},
  isPersonalTheme: false,
})

export function useTheme() {
  return useContext(ThemeContext)
}

// ── CSS variable application ──────────────────────────────────────────────────

function applyThemeToDom(theme: Theme) {
  const root = document.documentElement
  const c = theme.colors

  root.style.setProperty('--color-primary', c.primary)
  root.style.setProperty('--color-primary-hover', c.primaryHover)
  root.style.setProperty('--color-secondary', c.secondary)
  root.style.setProperty('--color-accent', c.accent)
  root.style.setProperty('--color-header-bg', c.headerBg)
  root.style.setProperty('--color-card-bg', c.cardBg)
  root.style.setProperty('--color-page-bg', c.pageBg)
  root.style.setProperty('--color-sidebar-bg', c.sidebarBg)
  root.style.setProperty('--color-text', c.text)
  root.style.setProperty('--color-text-muted', c.textMuted)
  root.style.setProperty('--color-border', c.border)
  root.style.setProperty('--color-success', c.success)
  root.style.setProperty('--color-warning', c.warning)
  root.style.setProperty('--color-danger', c.danger)
  root.style.setProperty('--bg-image', theme.backgroundImage ? `url(${theme.backgroundImage})` : 'none')
  root.style.setProperty('--bg-opacity', String(theme.backgroundOpacity))
  root.style.setProperty('--card-transparency', String(theme.cardTransparency))
  root.style.setProperty('--border-radius', theme.borderRadius)

  // Theme overrides for hardcoded Tailwind classes (see globals.css)
  root.style.setProperty('--theme-primary', c.primary)
  root.style.setProperty('--theme-primary-hover', c.primaryHover)
  root.style.setProperty('--theme-card-bg', c.cardBg)
  root.style.setProperty('--theme-page-bg', c.pageBg)
  root.style.setProperty('--theme-sidebar-bg', c.sidebarBg)
  root.style.setProperty('--theme-border', c.border)
  root.style.setProperty('--theme-text', c.text)
  root.style.setProperty('--theme-text-muted', c.textMuted)

  // Update page background on body
  document.body.style.backgroundColor = c.pageBg
  document.body.style.color = c.text

  // Apply font
  const fontMap: Record<string, string> = {
    cyborg: "'Share Tech Mono', 'Courier New', monospace",
    terminal: "'VT323', 'Courier New', monospace",
    neon: "'Orbitron', 'Arial', sans-serif",
  }
  const font = fontMap[theme.preset] || theme.font || "'Inter', system-ui, sans-serif"
  document.body.style.fontFamily = font
  root.style.setProperty('--theme-font', font)

  // Load Google Fonts for special themes
  const googleFonts: Record<string, string> = {
    cyborg: 'Share+Tech+Mono',
    terminal: 'VT323',
    neon: 'Orbitron:wght@400;700',
  }
  const gFont = googleFonts[theme.preset]
  if (gFont) {
    const linkId = 'theme-google-font'
    let link = document.getElementById(linkId) as HTMLLinkElement
    if (!link) {
      link = document.createElement('link')
      link.id = linkId
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }
    link.href = `https://fonts.googleapis.com/css2?family=${gFont}&display=swap`
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [employeeId, setEmployeeId] = useState<string | null>(null)
  const [isPersonalTheme, setIsPersonalTheme] = useState(false)

  // Load theme: personal_theme > org theme > default
  useEffect(() => {
    const load = async () => {
      const supabase = createClient()

      // Get org theme
      const { data: orgData } = await supabase
        .from('organizations')
        .select('id, theme')
        .limit(1)
        .single()

      const orgTheme: Theme = orgData?.theme
        ? { ...DEFAULT_THEME, ...orgData.theme, colors: { ...DEFAULT_THEME.colors, ...(orgData.theme as Theme).colors } }
        : DEFAULT_THEME

      if (orgData) setOrgId(orgData.id)

      // Check for personal theme
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: emp } = await supabase
          .from('employees')
          .select('id, personal_theme')
          .eq('auth_user_id', user.id)
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

      // Fall back to org theme
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
      // Reset to org theme
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
      {/* Background image overlay */}
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
