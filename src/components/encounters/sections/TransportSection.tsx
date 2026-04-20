import { InlineField } from '@/components/encounters/InlineField'
import { Field } from '@/components/encounters/Field'
import { SectionCard } from '@/components/encounters/SectionCard'
import {
  PATIENT_DISPOSITION_OPTIONS, TRANSPORT_DISPOSITION_OPTIONS, TRANSPORT_METHOD_OPTIONS,
  DESTINATION_TYPE_OPTIONS, NO_TRANSPORT_REASON_OPTIONS, HOSPITAL_CAPABILITY_OPTIONS,
} from '@/constants/nemsis'
import type { Encounter } from '@/types/encounters'
import type React from 'react'

export function TransportSection({ enc, isLocked, saveField, badge }: {
  enc: Encounter
  isLocked: boolean
  saveField: (k: string, v: string) => void
  badge?: React.ReactNode
}) {
  return (
    <SectionCard title="Transport & Disposition" badge={badge}>
      <InlineField label="Patient Disposition" value={enc.patient_disposition} fieldKey="patient_disposition" isLocked={isLocked} onSave={saveField} type="select" options={PATIENT_DISPOSITION_OPTIONS} />
      <InlineField label="Transport Disposition" value={enc.transport_disposition} fieldKey="transport_disposition" isLocked={isLocked} onSave={saveField} type="select" options={TRANSPORT_DISPOSITION_OPTIONS} />
      <InlineField label="Transport Method" value={enc.transport_method} fieldKey="transport_method" isLocked={isLocked} onSave={saveField} type="select" options={TRANSPORT_METHOD_OPTIONS} />
      <InlineField label="No Transport Reason" value={enc.no_transport_reason} fieldKey="no_transport_reason" isLocked={isLocked} onSave={saveField} type="select" options={NO_TRANSPORT_REASON_OPTIONS} />
      <InlineField label="Destination" value={enc.destination_name} fieldKey="destination_name" isLocked={isLocked} onSave={saveField} />
      <InlineField label="Destination Address" value={enc.destination_address} fieldKey="destination_address" isLocked={isLocked} onSave={saveField} />
      <InlineField label="Destination Type" value={enc.destination_type} fieldKey="destination_type" isLocked={isLocked} onSave={saveField} type="select" options={DESTINATION_TYPE_OPTIONS} />
      <InlineField label="Hospital Capability" value={enc.hospital_capability} fieldKey="hospital_capability" isLocked={isLocked} onSave={saveField} type="multi-select" options={HOSPITAL_CAPABILITY_OPTIONS} />
      <Field label="Refusal Signed" value={enc.refusal_signed} />
    </SectionCard>
  )
}
