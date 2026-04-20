import { useState } from 'react'
import { VitalsTrendTable } from './VitalsTrendTable'
import { AddVitalsForm } from './AddVitalsForm'
import type { Encounter, EncounterVitals, VitalsColumn } from '@/types/encounters'
import { formatTime } from '@/utils/encounterFormatters'

export function VitalsSection({
  enc,
  additionalVitals,
  crewOptions,
  currentUser,
  onVitalAdded,
}: {
  enc: Encounter
  additionalVitals: EncounterVitals[]
  crewOptions: { id: string; name: string }[]
  currentUser: any
  onVitalAdded: (v: EncounterVitals) => void
}) {
  const [showAddVitals, setShowAddVitals] = useState(false)

  const encounterDateLabel = enc.time ? `${enc.date} ${enc.time}` : enc.date

  const initialColumn: VitalsColumn = {
    label: encounterDateLabel,
    hr: enc.initial_hr ?? enc.heart_rate,
    rr: enc.initial_rr ?? enc.respiratory_rate,
    spo2: enc.initial_spo2 ?? enc.spo2,
    bp_systolic: enc.initial_bp_systolic ?? enc.blood_pressure_systolic,
    bp_diastolic: enc.initial_bp_diastolic ?? enc.blood_pressure_diastolic,
    gcs: enc.initial_gcs_total ?? enc.gcs,
    pain_scale: enc.initial_pain_scale ?? enc.pain_scale,
    temp_f: enc.initial_temp_f ?? enc.temperature,
    blood_glucose: enc.initial_blood_glucose ?? enc.blood_glucose,
    cardiac_rhythm: enc.cardiac_rhythm ?? null,
    skin: enc.initial_skin ?? enc.skin_condition,
    etco2: enc.etco2 ?? null,
    pupils: enc.pupils ?? null,
  }

  const serialColumns: VitalsColumn[] = additionalVitals.map(v => ({
    label: formatTime(v.recorded_at),
    hr: v.hr,
    rr: v.rr,
    spo2: v.spo2,
    bp_systolic: v.bp_systolic,
    bp_diastolic: v.bp_diastolic,
    gcs: v.gcs_total,
    pain_scale: v.pain_scale,
    temp_f: v.temp_f,
    blood_glucose: v.blood_glucose,
    cardiac_rhythm: v.cardiac_rhythm,
    skin: v.skin,
    etco2: v.etco2,
    pupils: v.pupils,
  }))

  const allVitalsColumns = [initialColumn, ...serialColumns]

  const hasAnyInitialVitals = [
    enc.initial_hr ?? enc.heart_rate,
    enc.initial_rr ?? enc.respiratory_rate,
    enc.initial_spo2 ?? enc.spo2,
    enc.initial_bp_systolic ?? enc.blood_pressure_systolic,
    enc.initial_gcs_total ?? enc.gcs,
    enc.initial_pain_scale ?? enc.pain_scale,
  ].some(v => v !== null && v !== undefined)

  return (
    <div className="theme-card rounded-xl p-4 border space-y-3 overflow-hidden h-full">
      <div className="flex items-center justify-between pr-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Vitals Trend</h2>
        <button onClick={() => setShowAddVitals(v => !v)}
          className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 rounded-lg text-white transition-colors">
          {showAddVitals ? 'Cancel' : '+ Vitals'}
        </button>
      </div>
      {(hasAnyInitialVitals || allVitalsColumns.length > 1) && (
        <div className="overflow-x-auto">
          <VitalsTrendTable columns={allVitalsColumns} />
        </div>
      )}
      {!hasAnyInitialVitals && allVitalsColumns.length <= 1 && !showAddVitals && (
        <p className="text-gray-600 text-sm">No vitals recorded yet. Tap "+ Vitals" to begin.</p>
      )}
      {showAddVitals && (
        <AddVitalsForm
          encounterId={enc.id}
          crewOptions={crewOptions}
          currentUser={currentUser}
          onSaved={v => { onVitalAdded(v); setShowAddVitals(false) }}
          onCancel={() => setShowAddVitals(false)}
        />
      )}
    </div>
  )
}
