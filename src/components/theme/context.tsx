/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from 'react'
import type { ThemeContextValue } from './types'
import { DEFAULT_THEME } from './presets'

export const ThemeContext = createContext<ThemeContextValue>({
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
