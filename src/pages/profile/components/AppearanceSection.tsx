import { useState } from 'react'
import { useTheme, THEME_PRESETS, THEME_FONTS } from '@/components/ThemeProvider'

export function AppearanceSection() {
  const { theme, applyTheme, savePersonalTheme, isPersonalTheme } = useTheme()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSelectPreset = (presetKey: string) => {
    const preset = THEME_PRESETS[presetKey]
    if (!preset) return
    const newTheme: any = {
      ...theme,
      preset: presetKey,
      colors: { ...preset.colors },
    }
    applyTheme(newTheme)
  }

  const handleSave = async () => {
    setSaving(true)
    await savePersonalTheme(theme)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = async () => {
    setSaving(true)
    await savePersonalTheme(null)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="mt-8 pt-6 border-t border-gray-800">
      <h2 className="text-lg font-bold mb-1">🎨 Appearance</h2>
      <p className="text-xs text-gray-500 mb-4">Choose a color scheme. Your selection is saved to your profile and won't affect other users.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        {Object.entries(THEME_PRESETS).map(([key, preset]) => {
          const isActive = theme.preset === key
          return (
            <button
              key={key}
              onClick={() => handleSelectPreset(key)}
              className={`p-3 rounded-xl border-2 transition-all text-left ${
                isActive ? 'border-white/50 ring-1 ring-white/20' : 'border-gray-800 hover:border-gray-600'
              }`}
              style={{ backgroundColor: preset.colors.cardBg }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold" style={{ color: preset.colors.text }}>{preset.label}</span>
                {isActive && <span className="text-xs">✓</span>}
              </div>
              <div className="flex gap-1 mb-1.5">
                {[preset.colors.primary, preset.colors.secondary, preset.colors.accent, preset.colors.cardBg].map((c, i) => (
                  <div key={i} className="w-5 h-5 rounded-full border border-white/10" style={{ backgroundColor: c }} />
                ))}
              </div>
              {THEME_FONTS[key] && (
                <p className="text-xs mb-1" style={{ color: preset.colors.primary, fontFamily: THEME_FONTS[key].family, opacity: 0.9 }}>
                  Aa — {THEME_FONTS[key].name}
                </p>
              )}
              <p className="text-xs" style={{ color: preset.colors.textMuted }}>{preset.description}</p>
            </button>
          )
        })}
      </div>

      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white font-semibold rounded-xl text-sm transition-colors">
          {saving ? 'Saving...' : saved ? '✅ Saved!' : 'Save Appearance'}
        </button>
        {isPersonalTheme && (
          <button onClick={handleReset} disabled={saving}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-xl text-sm transition-colors">
            Reset to Default
          </button>
        )}
      </div>
    </div>
  )
}
