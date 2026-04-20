import { InlineField } from '@/components/encounters/InlineField'
import { Field } from '@/components/encounters/Field'
import { SectionCard } from '@/components/encounters/SectionCard'
import { AGENCY_OPTIONS } from '@/constants/nemsis'
import type { Encounter } from '@/types/encounters'
import type React from 'react'

export function ProviderSection({ enc, isLocked, saveField, providerOptions, badge }: {
  enc: Encounter
  isLocked: boolean
  saveField: (k: string, v: string) => void
  providerOptions: string[]
  badge?: React.ReactNode
}) {
  return (
    <SectionCard title="Provider" badge={badge}>
      <InlineField label="Provider of Record" value={enc.provider_of_record} fieldKey="provider_of_record" isLocked={isLocked} onSave={saveField} type="select" options={providerOptions} />
      <InlineField label="PCR #" value={enc.pcr_number} fieldKey="pcr_number" isLocked={isLocked} onSave={saveField} />
      <InlineField label="Agency" value={enc.agency_number} fieldKey="agency_number" isLocked={isLocked} onSave={saveField} type="select" options={AGENCY_OPTIONS} />
      <Field label="Unit" value={enc.unit} />
      <Field label="PCR Status" value={enc.pcr_status} />
    </SectionCard>
  )
}
