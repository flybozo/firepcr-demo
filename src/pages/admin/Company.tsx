

import { FieldGuard } from '@/components/FieldGuard'
import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTheme, THEME_PRESETS, DEFAULT_THEME } from '@/components/ThemeProvider'
import type { Theme, ThemeColors } from '@/components/ThemeProvider'

type Organization = {
  id: string
  name: string
  dba: string | null
  logo_url: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
  email: string | null
  website: string | null
  ein: string | null
  cage_code: string | null
  duns_number: string | null
  sam_uei: string | null
  npi: string | null
  medical_director: string | null
  medical_director_license: string | null
  lemsa: string | null
  lemsa_agency_number: string | null
  state_agency_id: string | null
  ambulance_license_number: string | null
  insurance_provider: string | null
  insurance_policy_number: string | null
  workers_comp_carrier: string | null
  workers_comp_policy: string | null
}

// ─── Inline edit field ────────────────────────────────────────────────────────
function EditField({
  label,
  value,
  fieldKey,
  type = 'text',
  placeholder,
  onSave,
}: {
  label: string
  value: string | null | undefined
  fieldKey: string
  type?: string
  placeholder?: string
  onSave: (key: string, val: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setDraft(value ?? '') }, [value])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const commit = useCallback(() => {
    setEditing(false)
    if (draft !== (value ?? '')) onSave(fieldKey, draft)
  }, [draft, value, fieldKey, onSave])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-gray-500">{label}</span>
        <input
          ref={inputRef}
          type={type}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKey}
          placeholder={placeholder}
          className="bg-gray-800 text-white text-sm rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-red-500 min-w-0"
        />
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex flex-col gap-0.5 text-left group w-full hover:bg-gray-800/50 rounded-md px-1.5 py-1 transition-colors"
    >
      <span className="text-xs text-gray-500 group-hover:text-gray-400">{label}</span>
      <span className={`text-sm ${value ? 'text-white' : 'text-gray-600 italic'}`}>
        {value || placeholder || 'Click to edit'}
      </span>
    </button>
  )
}

// ─── Section card ──────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-4">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {children}
      </div>
    </div>
  )
}

// ─── Color swatch preview ──────────────────────────────────────────────────────
function ColorDots({ colors }: { colors: string[] }) {
  return (
    <div className="flex gap-1 mt-1">
      {colors.map((c, i) => (
        <div
          key={i}
          className="w-4 h-4 rounded-full border border-white/10"
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  )
}

// ─── Appearance section ────────────────────────────────────────────────────────
function AppearanceSection() {
  const { theme, applyTheme, saveTheme } = useTheme()
  const supabase = createClient()

  // Local draft state — edits apply live but aren't saved until the user clicks Save
  const [draft, setDraft] = useState<Theme>(theme)
  const [showCustomizer, setShowCustomizer] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [bgUploading, setBgUploading] = useState(false)
  const bgFileRef = useRef<HTMLInputElement>(null)

  // Sync draft when theme loads from DB (first mount)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setDraft(theme) }, [theme.preset])

  const applyDraft = useCallback((next: Theme) => {
    setDraft(next)
    applyTheme(next)
  }, [applyTheme])

  const selectPreset = (key: string) => {
    const preset = THEME_PRESETS[key]
    if (!preset) return
    const next: Theme = {
      ...draft,
      preset: key,
      colors: { ...preset.colors },
    }
    applyDraft(next)
  }

  const updateColor = (key: keyof ThemeColors, val: string) => {
    const next: Theme = {
      ...draft,
      preset: 'custom',
      colors: { ...draft.colors, [key]: val },
    }
    applyDraft(next)
  }

  const handleSave = async () => {
    setSaving(true)
    await saveTheme(draft)
    setSaveMsg('Saved')
    setTimeout(() => setSaveMsg(null), 2500)
    setSaving(false)
  }

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBgUploading(true)
    const { data: orgData } = await supabase.from('organizations').select('id').limit(1).single()
    if (!orgData) { setBgUploading(false); return }
    const ext = file.name.split('.').pop()
    const path = `${orgData.id}/bg.${ext}`
    const { error } = await supabase.storage.from('org-assets').upload(path, file, { upsert: true, contentType: file.type })
    if (!error) {
      const { data: urlData } = supabase.storage.from('org-assets').getPublicUrl(path)
      const next: Theme = { ...draft, backgroundImage: urlData.publicUrl + `?t=${Date.now()}` }
      applyDraft(next)
    }
    setBgUploading(false)
  }

  const removeBg = () => {
    applyDraft({ ...draft, backgroundImage: null })
  }

  const COLOR_LABELS: { key: keyof ThemeColors; label: string }[] = [
    { key: 'primary', label: 'Primary' },
    { key: 'primaryHover', label: 'Primary Hover' },
    { key: 'secondary', label: 'Secondary' },
    { key: 'accent', label: 'Accent' },
    { key: 'headerBg', label: 'Header BG' },
    { key: 'cardBg', label: 'Card BG' },
    { key: 'pageBg', label: 'Page BG' },
    { key: 'sidebarBg', label: 'Sidebar BG' },
    { key: 'text', label: 'Text' },
    { key: 'textMuted', label: 'Muted Text' },
    { key: 'border', label: 'Border' },
    { key: 'success', label: 'Success' },
    { key: 'warning', label: 'Warning' },
    { key: 'danger', label: 'Danger' },
  ]

  const BORDER_OPTIONS = [
    { label: 'Sharp', value: '0.25rem' },
    { label: 'Rounded', value: '0.75rem' },
    { label: 'Pill', value: '1.5rem' },
  ]

  return (
    <div
      className="border rounded-xl p-5 space-y-6"
      style={{ backgroundColor: 'var(--color-card-bg, #111827)', borderColor: 'var(--color-border, #1f2937)' }}
    >
      <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">🎨 Appearance</h2>

      {/* Preset Grid */}
      <div>
        <p className="text-sm text-gray-400 mb-3">Theme Preset</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(THEME_PRESETS).map(([key, preset]) => {
            const isActive = draft.preset === key
            return (
              <button
                key={key}
                onClick={() => selectPreset(key)}
                className="relative rounded-lg border p-3 text-left transition-all hover:scale-[1.02]"
                style={{
                  borderColor: isActive ? 'var(--color-primary, #dc2626)' : '#374151',
                  backgroundColor: preset.colors.cardBg,
                }}
              >
                {isActive && (
                  <span
                    className="absolute top-2 right-2 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
                    style={{ backgroundColor: preset.colors.primary, color: '#fff' }}
                  >✓</span>
                )}
                <p className="text-sm font-semibold" style={{ color: preset.colors.text }}>{preset.label}</p>
                <p className="text-xs mt-0.5 line-clamp-1" style={{ color: preset.colors.textMuted }}>{preset.description}</p>
                <ColorDots colors={[preset.colors.primary, preset.colors.secondary, preset.colors.cardBg, preset.colors.sidebarBg]} />
              </button>
            )
          })}
        </div>
        {draft.preset === 'custom' && (
          <p className="text-xs text-gray-500 mt-2">✏️ Custom — colors modified from preset</p>
        )}
      </div>

      {/* Color Customizer (collapsible) */}
      <div>
        <button
          onClick={() => setShowCustomizer(v => !v)}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <span>{showCustomizer ? '▾' : '▸'}</span>
          Customize Colors
        </button>
        {showCustomizer && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
            {COLOR_LABELS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="color"
                  value={draft.colors[key]}
                  onChange={e => updateColor(key, e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                />
                <span className="text-xs text-gray-400 group-hover:text-white transition-colors">{label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Background Image */}
      <div className="space-y-2">
        <p className="text-sm text-gray-400">Background Image</p>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => bgFileRef.current?.click()}
            className="px-3 py-1.5 rounded-lg text-sm text-white transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'var(--color-primary, #dc2626)' }}
          >
            {bgUploading ? 'Uploading…' : draft.backgroundImage ? 'Change Image' : 'Upload Image'}
          </button>
          {draft.backgroundImage && (
            <button
              onClick={removeBg}
              className="px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white border border-gray-700 transition-colors"
            >
              Remove
            </button>
          )}
          {draft.backgroundImage && (
            <span className="text-xs text-gray-500 truncate max-w-xs">Image set ✓</span>
          )}
          <input
            ref={bgFileRef}
            type="file"
            accept="image/*"
            onChange={handleBgUpload}
            className="hidden"
          />
        </div>
        {draft.backgroundImage && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Opacity: {Math.round(draft.backgroundOpacity * 100)}%
            </label>
            <input
              type="range"
              min={0}
              max={0.3}
              step={0.01}
              value={draft.backgroundOpacity}
              onChange={e => applyDraft({ ...draft, backgroundOpacity: parseFloat(e.target.value) })}
              className="w-full max-w-xs accent-red-500"
            />
          </div>
        )}
      </div>

      {/* Card Transparency */}
      <div>
        <label className="text-sm text-gray-400 mb-1 block">
          Card Transparency: {Math.round((1 - draft.cardTransparency) * 100)}% transparent
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={draft.cardTransparency}
          onChange={e => applyDraft({ ...draft, cardTransparency: parseFloat(e.target.value) })}
          className="w-full max-w-xs accent-red-500"
        />
      </div>

      {/* Border Radius */}
      <div>
        <p className="text-sm text-gray-400 mb-2">Border Radius</p>
        <div className="flex gap-2">
          {BORDER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => applyDraft({ ...draft, borderRadius: opt.value })}
              className="px-3 py-1.5 text-sm border transition-colors"
              style={{
                borderRadius: opt.value,
                borderColor: draft.borderRadius === opt.value ? 'var(--color-primary, #dc2626)' : '#374151',
                color: draft.borderRadius === opt.value ? 'white' : '#9ca3af',
                backgroundColor: draft.borderRadius === opt.value ? 'var(--color-primary, #dc2626)' : 'transparent',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3 pt-2 border-t" style={{ borderColor: 'var(--color-border, #1f2937)' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-primary, #dc2626)' }}
        >
          {saving ? 'Saving…' : 'Save Appearance'}
        </button>
        <button
          onClick={() => {
            const reset = { ...DEFAULT_THEME }
            setDraft(reset)
            applyTheme(reset)
          }}
          className="px-4 py-2 rounded-lg text-gray-400 text-sm border border-gray-700 hover:text-white transition-colors"
        >
          Reset to Default
        </button>
        {saveMsg && (
          <span className="text-xs text-green-400">{saveMsg}</span>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
function CompanyProfilePageInner() {
  const supabase = createClient()
  const [org, setOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase.from('organizations').select('*').limit(1).single()
        if (data) setOrg(data as unknown as Organization)
      } catch {
        // Offline — org data not cached, page shows empty
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleSave = useCallback(async (key: string, val: string) => {
    if (!org) return
    setSaving(true)
    const { error } = await supabase
      .from('organizations')
      .update({ [key]: val || null, updated_at: new Date().toISOString() })
      .eq('id', org.id)

    if (!error) {
      setOrg(prev => prev ? { ...prev, [key]: val || null } : prev)
      setSaveMsg('Saved')
      setTimeout(() => setSaveMsg(null), 2000)
    } else {
      setSaveMsg('Error saving')
      setTimeout(() => setSaveMsg(null), 3000)
    }
    setSaving(false)
  }, [org, supabase])

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !org) return

    setLogoUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${org.id}/logo.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('org-assets')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('org-assets').getPublicUrl(path)
      const logoUrl = urlData.publicUrl + `?t=${Date.now()}`
      await handleSave('logo_url', logoUrl)
    } else {
      setSaveMsg('Logo upload failed')
      setTimeout(() => setSaveMsg(null), 3000)
    }
    setLogoUploading(false)
  }

  if (loading) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded w-48" />
          <div className="h-40 bg-gray-900 rounded-xl" />
          <div className="h-40 bg-gray-900 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!org) {
    return (
      <div className="p-8">
        <p className="text-gray-500">No organization record found.</p>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mt-8 md:mt-0">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative group">
          <div
            className="w-20 h-20 rounded-full bg-gray-800 border-2 border-gray-700 overflow-hidden flex items-center justify-center cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            {org.logo_url ? (
              <img src={org.logo_url} alt="Org logo" className="w-full h-full object-contain p-1" />
            ) : (
              <span className="text-3xl">🏢</span>
            )}
            <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {logoUploading ? (
                <span className="text-white text-xs">Uploading…</span>
              ) : (
                <span className="text-white text-xs font-medium">Change</span>
              )}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            className="hidden"
          />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{org.name}</h1>
          {org.dba && <p className="text-gray-400 text-sm">DBA: {org.dba}</p>}
          <p className="text-xs text-gray-600 mt-1">Click the logo to upload a new one</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {saving && <span className="text-xs text-gray-500">Saving…</span>}
          {saveMsg && !saving && (
            <span className={`text-xs ${saveMsg === 'Saved' ? 'text-green-400' : 'text-red-400'}`}>
              {saveMsg}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Appearance */}
        <AppearanceSection />

        {/* General Information */}
        <Section title="General Information">
          <EditField label="Legal Name" value={org.name} fieldKey="name" onSave={handleSave} />
          <EditField label="DBA" value={org.dba} fieldKey="dba" placeholder="Doing business as…" onSave={handleSave} />
          <EditField label="Address Line 1" value={org.address_line1} fieldKey="address_line1" onSave={handleSave} />
          <EditField label="Address Line 2" value={org.address_line2} fieldKey="address_line2" onSave={handleSave} />
          <EditField label="City" value={org.city} fieldKey="city" onSave={handleSave} />
          <EditField label="State" value={org.state} fieldKey="state" onSave={handleSave} />
          <EditField label="ZIP" value={org.zip} fieldKey="zip" onSave={handleSave} />
          <EditField label="Phone" value={org.phone} fieldKey="phone" type="tel" onSave={handleSave} />
          <EditField label="Email" value={org.email} fieldKey="email" type="email" onSave={handleSave} />
          <EditField label="Website" value={org.website} fieldKey="website" type="url" onSave={handleSave} />
        </Section>

        {/* Government IDs */}
        <Section title="Government IDs">
          <EditField label="EIN (Tax ID)" value={org.ein} fieldKey="ein" placeholder="XX-XXXXXXX" onSave={handleSave} />
          <EditField label="CAGE Code" value={org.cage_code} fieldKey="cage_code" onSave={handleSave} />
          <EditField label="DUNS Number" value={org.duns_number} fieldKey="duns_number" onSave={handleSave} />
          <EditField label="SAM UEI" value={org.sam_uei} fieldKey="sam_uei" onSave={handleSave} />
          <EditField label="NPI" value={org.npi} fieldKey="npi" onSave={handleSave} />
        </Section>

        {/* Medical Licensing */}
        <Section title="Medical Licensing">
          <EditField label="Medical Director" value={org.medical_director} fieldKey="medical_director" onSave={handleSave} />
          <EditField label="MD License #" value={org.medical_director_license} fieldKey="medical_director_license" onSave={handleSave} />
          <EditField label="LEMSA" value={org.lemsa} fieldKey="lemsa" onSave={handleSave} />
          <EditField label="LEMSA Agency Number" value={org.lemsa_agency_number} fieldKey="lemsa_agency_number" onSave={handleSave} />
          <EditField label="State Agency ID" value={org.state_agency_id} fieldKey="state_agency_id" onSave={handleSave} />
          <EditField label="Ambulance License #" value={org.ambulance_license_number} fieldKey="ambulance_license_number" onSave={handleSave} />
        </Section>

        {/* Insurance */}
        <Section title="Insurance">
          <EditField label="Insurance Provider" value={org.insurance_provider} fieldKey="insurance_provider" onSave={handleSave} />
          <EditField label="Policy Number" value={org.insurance_policy_number} fieldKey="insurance_policy_number" onSave={handleSave} />
          <EditField label="Workers Comp Carrier" value={org.workers_comp_carrier} fieldKey="workers_comp_carrier" onSave={handleSave} />
          <EditField label="Workers Comp Policy #" value={org.workers_comp_policy} fieldKey="workers_comp_policy" onSave={handleSave} />
        </Section>
      </div>
    </div>
  )
}

export default function CompanyProfilePage() {
  return (
    <FieldGuard redirectFn={() => '/'}>
      <CompanyProfilePageInner />
    </FieldGuard>
  )
}
