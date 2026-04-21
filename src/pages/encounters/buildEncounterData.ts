type EncounterForm = {
  date: string
  time: string
  unit: string
  unit_id: string
  incident_id: string
  crew_resource_number: string
  patient_first_name: string
  patient_last_name: string
  patient_dob: string
  patient_age: string
  patient_age_units: string
  patient_gender: string
  chief_complaint: string
  chief_complaint_other: string
  initial_acuity: string
  initial_hr: string
  initial_rr: string
  initial_spo2: string
  initial_bp_systolic: string
  initial_bp_diastolic: string
  initial_temp_f: string
  initial_pain_scale: string
  initial_blood_glucose: string
  cardiac_rhythm: string
  pupils: string
  etco2: string
  scene_type: string
  subjective: string
  objective: string
  assessment_plan: string
  notes: string
  provider_of_record: string
  patient_disposition: string
}

export function buildEncounterData(form: EncounterForm, createdByName: string | null | undefined) {
  const encounterId = `ENC-${Date.now()}`
  const complaint = form.chief_complaint === 'Other' ? form.chief_complaint_other : form.chief_complaint

  return {
    id: `local-${encounterId}`,
    created_by: createdByName || null,
    encounter_id: encounterId,
    date: form.date,
    time: form.time,
    unit: form.unit,
    unit_id: form.unit_id || null,
    incident_id: form.incident_id || null,
    crew_resource_number: form.crew_resource_number,
    patient_first_name: form.patient_first_name,
    patient_last_name: form.patient_last_name,
    patient_dob: form.patient_dob || null,
    patient_age: form.patient_age ? Number(form.patient_age) : null,
    patient_age_units: form.patient_age_units,
    patient_gender: form.patient_gender,
    primary_symptom_text: complaint,
    initial_acuity: form.initial_acuity,
    initial_hr: form.initial_hr ? Number(form.initial_hr) : null,
    initial_rr: form.initial_rr ? Number(form.initial_rr) : null,
    initial_spo2: form.initial_spo2 ? Number(form.initial_spo2) : null,
    initial_bp_systolic: form.initial_bp_systolic ? Number(form.initial_bp_systolic) : null,
    initial_bp_diastolic: form.initial_bp_diastolic ? Number(form.initial_bp_diastolic) : null,
    initial_temp_f: form.initial_temp_f ? Number(form.initial_temp_f) : null,
    initial_pain_scale: form.initial_pain_scale ? Number(form.initial_pain_scale) : null,
    initial_blood_glucose: form.initial_blood_glucose ? Number(form.initial_blood_glucose) : null,
    cardiac_rhythm: form.cardiac_rhythm || null,
    pupils: form.pupils || null,
    etco2: form.etco2 ? Number(form.etco2) : null,
    scene_type: form.scene_type || null,
    notes: [
      form.subjective ? `SUBJECTIVE:\n${form.subjective}` : '',
      form.objective ? `OBJECTIVE:\n${form.objective}` : '',
      form.assessment_plan ? `ASSESSMENT/PLAN:\n${form.assessment_plan}` : '',
      form.notes || '',
    ].filter(Boolean).join('\n\n'),
    provider_of_record: form.provider_of_record,
    patient_disposition: form.patient_disposition,
    pcr_status: 'Draft',
  }
}
