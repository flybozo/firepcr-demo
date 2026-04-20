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
  font?: string
}

export type ThemeContextValue = {
  theme: Theme
  orgId: string | null
  applyTheme: (t: Theme) => void
  saveTheme: (t: Theme) => Promise<void>
  savePersonalTheme: (t: Theme | null) => Promise<void>
  isPersonalTheme: boolean
}
