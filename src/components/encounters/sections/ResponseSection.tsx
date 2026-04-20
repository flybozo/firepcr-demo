import { InlineField } from '@/components/encounters/InlineField'
import { SectionCard } from '@/components/encounters/SectionCard'
import { TYPE_OF_SERVICE_OPTIONS } from '@/constants/nemsis'
import type { Encounter } from '@/types/encounters'
import type React from 'react'

export function ResponseSection({ enc, isLocked, saveField, badge }: {
  enc: Encounter
  isLocked: boolean
  saveField: (k: string, v: string) => void
  badge?: React.ReactNode
}) {
  return (
    <SectionCard title="Response & Times" badge={badge}>
      <InlineField label="Type of Service" value={enc.type_of_service} fieldKey="type_of_service" isLocked={isLocked} onSave={saveField} type="select" options={TYPE_OF_SERVICE_OPTIONS} />
      <InlineField label="Transport Capability" value={enc.transport_capability} fieldKey="transport_capability" isLocked={isLocked} onSave={saveField} type="select" options={["ALS","ALS 2","ALS Specialty Care Transport","BLS","Critical Care","Hazmat","Neonatal","Pediatric","Psychiatric","Rescue","Specialized","Other"]} />
      <InlineField label="Response #" value={enc.response_number} fieldKey="response_number" isLocked={isLocked} onSave={saveField} />
      <InlineField label="Incident #" value={enc.incident_number} fieldKey="incident_number" isLocked={isLocked} onSave={saveField} />
      <div className="col-span-full border-t border-gray-800 pt-3 mt-1">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Unit Times</p>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <InlineField label="Dispatch" value={enc.dispatch_datetime} fieldKey="dispatch_datetime" isLocked={isLocked} onSave={saveField} type="datetime-local" />
          <InlineField label="En Route" value={enc.en_route_datetime} fieldKey="en_route_datetime" isLocked={isLocked} onSave={saveField} type="datetime-local" />
          <InlineField label="Arrived Scene" value={enc.arrive_scene_datetime} fieldKey="arrive_scene_datetime" isLocked={isLocked} onSave={saveField} type="datetime-local" />
          <InlineField label="Patient Contact" value={enc.patient_contact_datetime} fieldKey="patient_contact_datetime" isLocked={isLocked} onSave={saveField} type="datetime-local" />
          <InlineField label="Left Scene" value={enc.depart_scene_datetime} fieldKey="depart_scene_datetime" isLocked={isLocked} onSave={saveField} type="datetime-local" />
          <InlineField label="Arrived Destination" value={enc.arrive_destination_datetime} fieldKey="arrive_destination_datetime" isLocked={isLocked} onSave={saveField} type="datetime-local" />
          <InlineField label="Back in Service" value={enc.available_datetime} fieldKey="available_datetime" isLocked={isLocked} onSave={saveField} type="datetime-local" />
        </dl>
      </div>
    </SectionCard>
  )
}
