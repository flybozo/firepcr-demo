import { useTheme } from '@/components/ThemeProvider'
import type { ListStyle } from '@/components/ThemeProvider'

/** Returns the user's preferred list style ('card' or 'list'). Defaults to 'card'. */
export function useListStyle(): ListStyle {
  const { theme } = useTheme()
  return theme.listStyle || 'card'
}
