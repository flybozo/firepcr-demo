import { InlineField } from '@/components/encounters/InlineField'
import { SectionCard } from '@/components/encounters/SectionCard'
import {
  CARDIAC_ARREST_OPTIONS, ARREST_ETIOLOGY_OPTIONS, ROSC_OPTIONS_LIST,
} from '@/constants/nemsis'
import type { Encounter } from '@/types/encounters'
import type React from 'react'

export function CardiacArrestSection({ enc, isLocked, saveField, badge }: {
  enc: Encounter
  isLocked: boolean
  saveField: (k: string, v: string) => void
  badge?: React.ReactNode
}) {
  return (
    <SectionCard title="🫀 Cardiac Arrest" badge={badge}>
      <InlineField label="Cardiac Arrest" value={enc.cardiac_arrest} fieldKey="cardiac_arrest" isLocked={isLocked} onSave={saveField} type="select" options={CARDIAC_ARREST_OPTIONS} />
      <InlineField label="Etiology" value={enc.arrest_etiology} fieldKey="arrest_etiology" isLocked={isLocked} onSave={saveField} type="select" options={ARREST_ETIOLOGY_OPTIONS} />
      <InlineField label="Resuscitation Attempted" value={Array.isArray(enc.resuscitation_attempted) ? (enc.resuscitation_attempted as string[])[0] : enc.resuscitation_attempted} fieldKey="resuscitation_attempted" isLocked={isLocked} onSave={saveField} type="select" options={["Yes, Prior to Any EMS Arrival","Yes, by First EMS on Scene","No"]} />
      <InlineField label="Witnessed" value={Array.isArray(enc.arrest_witnessed) ? (enc.arrest_witnessed as string[])[0] : enc.arrest_witnessed} fieldKey="arrest_witnessed" isLocked={isLocked} onSave={saveField} type="select" options={["Unwitnessed","Witnessed by Bystander","Witnessed by EMS"]} />
      <InlineField label="Initial Rhythm" value={enc.arrest_rhythm} fieldKey="arrest_rhythm" isLocked={isLocked} onSave={saveField} type="select" options={["Asystole","Pulseless Electrical Activity","Ventricular Fibrillation","Ventricular Tachycardia","Unknown AED Non-Shockable Rhythm","Unknown AED Shockable Rhythm","Normal Sinus Rhythm","Other"]} />
      <InlineField label="ROSC" value={enc.rosc} fieldKey="rosc" isLocked={isLocked} onSave={saveField} type="select" options={ROSC_OPTIONS_LIST} />
      <InlineField label="Who Initiated CPR" value={enc.who_initiated_cpr} fieldKey="who_initiated_cpr" isLocked={isLocked} onSave={saveField} type="select" options={["EMS","Bystander","Both","None"]} />
      <InlineField label="CPR Type" value={Array.isArray(enc.cpr_type) ? enc.cpr_type[0] : enc.cpr_type} fieldKey="cpr_type" isLocked={isLocked} onSave={saveField} type="select" options={["Manual Compressions Only","Mechanical CPR Device","Manual and Mechanical CPR"]} />
      <InlineField label="AED Prior to EMS" value={enc.aed_prior_to_ems} fieldKey="aed_prior_to_ems" isLocked={isLocked} onSave={saveField} type="select" options={["Yes - Defibrillation Shock Delivered","Yes - No Shock Advised","No","Unknown"]} />
      <InlineField label="Date/Time of Cardiac Arrest" value={enc.date_time_cardiac_arrest} fieldKey="date_time_cardiac_arrest" isLocked={isLocked} onSave={saveField} type="datetime-local" />
      <InlineField label="End of Event" value={enc.end_of_arrest_event} fieldKey="end_of_arrest_event" isLocked={isLocked} onSave={saveField} type="select" options={["Expired in Field","Expired in ED","Ongoing Resuscitation in ED","ROSC in Field","ROSC in ED","Resuscitation Discontinued"]} />
    </SectionCard>
  )
}
