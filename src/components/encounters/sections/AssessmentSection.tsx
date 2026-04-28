import { InlineField } from '@/components/encounters/InlineField'
import { Field } from '@/components/encounters/Field'
import { SectionCard } from '@/components/encounters/SectionCard'
import {
  CHIEF_COMPLAINT_OPTIONS, ACUITY_OPTIONS, ADVANCE_DIRECTIVE_OPTIONS,
  DISPATCH_REASON_OPTIONS, OCCUPATIONAL_INDUSTRY_OPTIONS, PATIENT_OCCUPATION_OPTIONS,
} from '@/constants/nemsis'
import type { Encounter } from '@/types/encounters'
import type React from 'react'

export function AssessmentSection({ enc, isLocked, saveField, badge }: {
  enc: Encounter
  isLocked: boolean
  saveField: (k: string, v: string) => void
  badge?: React.ReactNode
}) {
  const handlePossibleInjury = (k: string, v: string) => {
    saveField(k, v === 'Yes' ? 'true' : v === 'No' ? 'false' : '')
    if (v === 'Yes') {
      if (!enc.patient_occupational_industry) saveField('patient_occupational_industry', 'Agriculture, Forestry, Fishing and Hunting')
      if (!enc.patient_occupation) saveField('patient_occupation', 'Farming, Fishing and Forestry Occupations')
    }
  }

  return (
    <SectionCard title="Assessment & Situation" badge={badge}>
      <InlineField label="Chief Complaint" value={enc.primary_symptom_text} fieldKey="primary_symptom_text" isLocked={isLocked} onSave={saveField} type="select" options={CHIEF_COMPLAINT_OPTIONS} />
      <Field label="Symptom Onset" value={enc.symptom_onset_datetime ? new Date(enc.symptom_onset_datetime).toLocaleString([], { hour12: false }) : null} />
      <InlineField label="Possible Injury" value={enc.possible_injury === true ? 'Yes' : enc.possible_injury === false ? 'No' : ''} fieldKey="possible_injury" isLocked={isLocked} onSave={handlePossibleInjury} type="select" options={['Yes','No','Unknown']} />
      {enc.possible_injury === true && (
        <>
          <InlineField label="Occupational Industry (eSituation.15)" value={enc.patient_occupational_industry} fieldKey="patient_occupational_industry" isLocked={isLocked} onSave={saveField} type="select" options={OCCUPATIONAL_INDUSTRY_OPTIONS} />
          <InlineField label="Patient Occupation (eSituation.16)" value={enc.patient_occupation} fieldKey="patient_occupation" isLocked={isLocked} onSave={saveField} type="select" options={PATIENT_OCCUPATION_OPTIONS} />
          <InlineField label="Time Employee Began Work" value={enc.time_employee_began_work || (enc.date ? enc.date + "T06:00" : (() => { const d = new Date(); d.setHours(6,0,0,0); return d.toISOString().slice(0,16) })())} fieldKey="time_employee_began_work" isLocked={isLocked} onSave={saveField} type="datetime-local" />
        </>
      )}
      <InlineField label="Dispatch Reason" value={enc.dispatch_reason} fieldKey="dispatch_reason" isLocked={isLocked} onSave={saveField} type="select" options={DISPATCH_REASON_OPTIONS} />
      <div className="col-span-full border-t border-gray-800 pt-3 mt-1">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Impressions & Acuity</p>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <InlineField label="Primary Impression" value={enc.primary_impression_text || enc.primary_impression} fieldKey="primary_impression_text" isLocked={isLocked} onSave={saveField} type="clinical-select" />
          <InlineField label="Secondary Impression" value={enc.secondary_impression} fieldKey="secondary_impression" isLocked={isLocked} onSave={saveField} type="clinical-select" />
          <InlineField label="Initial Acuity" value={enc.initial_acuity} fieldKey="initial_acuity" isLocked={isLocked} onSave={saveField} type="select" options={ACUITY_OPTIONS} />
          <InlineField label="Final Acuity" value={enc.final_acuity} fieldKey="final_acuity" isLocked={isLocked} onSave={saveField} type="select" options={ACUITY_OPTIONS} />
          <InlineField label="Advance Directive" value={enc.advance_directive} fieldKey="advance_directive" isLocked={isLocked} onSave={saveField} type="select" options={ADVANCE_DIRECTIVE_OPTIONS} />
        </dl>
      </div>
    </SectionCard>
  )
}
