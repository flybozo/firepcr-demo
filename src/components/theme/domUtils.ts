import type { Theme } from './types'

function getContrastText(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

export function applyThemeToDom(theme: Theme) {
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

  root.style.setProperty('--theme-primary', c.primary)
  root.style.setProperty('--theme-primary-hover', c.primaryHover)
  root.style.setProperty('--theme-card-bg', c.cardBg)
  root.style.setProperty('--theme-page-bg', c.pageBg)
  root.style.setProperty('--theme-sidebar-bg', c.sidebarBg)
  root.style.setProperty('--theme-border', c.border)
  root.style.setProperty('--theme-text', c.text)
  root.style.setProperty('--theme-text-muted', c.textMuted)

  const primaryText = getContrastText(c.primary)
  root.style.setProperty('--color-primary-text', primaryText)
  root.style.setProperty('--theme-primary-text', primaryText)

  document.body.style.backgroundColor = c.pageBg
  document.body.style.color = c.text

  const fontMap: Record<string, string> = {
    cyborg:    "'Share Tech Mono', 'Courier New', monospace",
    terminal:  "'VT323', 'Courier New', monospace",
    neon:      "'Orbitron', 'Arial', sans-serif",
    ember:     "'Inter', system-ui, sans-serif",
    pacific:   "'Rajdhani', 'Arial', sans-serif",
    forest:    "'Cabin', 'Arial', sans-serif",
    sierra:    "'Josefin Sans', 'Arial', sans-serif",
    arctic:    "'Exo 2', 'Arial', sans-serif",
    midnight:  "'Quicksand', 'Arial', sans-serif",
    barbie:    "'Pacifico', cursive",
    rainbow:   "'Nunito', 'Arial', sans-serif",
    douchebag: "'Anton', 'Impact', sans-serif",
    prepper:   "'Courier Prime', 'Courier New', monospace",
    patriot:   "'Instrument Serif', 'Garamond', serif",
    cowboy:    "'Rye', cursive",
    grandma:   "'Lato', 'Arial', sans-serif",
    surfer:    "'Comfortaa', cursive",
    elgaucho:  "'Righteous', cursive",
    overcast:  "'Source Sans 3', 'Arial', sans-serif",
    hippie:    "'Boogaloo', cursive",
    doc:       "'IBM Plex Sans', 'Arial', sans-serif",
    pirate:    "'Pirata One', cursive",
    area51:    "'Aldrich', sans-serif",
    goth:      "'Cinzel', serif",
  }
  const font = fontMap[theme.preset] || theme.font || "'Inter', system-ui, -apple-system, sans-serif"
  root.style.setProperty('--theme-font', font)

  const styleId = 'theme-font-override'
  let styleEl = document.getElementById(styleId) as HTMLStyleElement
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = styleId
    document.head.appendChild(styleEl)
  }
  const fontScaleMap: Record<string, number> = {
    terminal: 1.15,
    hippie:   1.05,
    barbie:   1.05,
    cowboy:   1.05,
    pirate:   1.08,
    area51:   1.0,
    goth:     1.0,
  }
  const fontScale = fontScaleMap[theme.preset] || 1
  const scaleCSS = fontScale !== 1
    ? `html { font-size: ${fontScale * 100}% !important; }`
    : ''
  styleEl.textContent = `*, *::before, *::after { font-family: ${font} !important; } ${scaleCSS}`

  const googleFonts: Record<string, string> = {
    cyborg:   'Share+Tech+Mono',
    terminal: 'VT323:wght@400',
    neon:     'Orbitron:wght@400;700',
    pacific:  'Rajdhani:wght@400;600;700',
    forest:   'Cabin:wght@400;600;700',
    sierra:   'Josefin+Sans:wght@300;400;600;700',
    arctic:   'Exo+2:wght@300;400;600;700',
    midnight: 'Quicksand:wght@400;500;600;700',
    barbie:   'Pacifico',
    rainbow:  'Nunito:wght@400;600;700',
    douchebag:'Anton',
    prepper:  'Courier+Prime:wght@400;700',
    patriot:  'Instrument+Serif:ital@0;1',
    cowboy:   'Rye',
    grandma:  'Lato:wght@300;400;700',
    surfer:   'Comfortaa:wght@400;600;700',
    elgaucho: 'Righteous',
    overcast: 'Source+Sans+3:wght@300;400;600',
    hippie:   'Boogaloo',
    doc:      'IBM+Plex+Sans:wght@300;400;600',
    pirate:   'Pirata+One',
    area51:   'Aldrich',
    goth:     'Cinzel:wght@400;600;700',
  }
  const gFont = googleFonts[theme.preset]
  const linkId = 'theme-google-font'
  let link = document.getElementById(linkId) as HTMLLinkElement
  if (gFont) {
    if (!link) {
      link = document.createElement('link')
      link.id = linkId
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(gFont.replace(/:/g, ':'))}&display=swap`
  } else if (link) {
    link.remove()
  }
}
