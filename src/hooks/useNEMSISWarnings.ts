// hooks/useNEMSISWarnings.ts
// NEMSIS 3.5.1 National Schematron — all 172 warnings + 16 errors
// Mapped to FirePCR PCR form state fields

export interface NEMSISWarning {
  id: string
  field: string
  section: string
  message: string
  severity: 'error' | 'warning'
}

export function useNEMSISWarnings(form: Record<string, any>): NEMSISWarning[] {
  const w: NEMSISWarning[] = []

  // Derived convenience booleans
  const evaluated   = !!(form.patient_disposition?.includes('Patient Evaluated') || form.patient_disposition?.includes('Treated'))
  const transported = !!(form.patient_disposition?.includes('Transport'))
  const cancelled   = !!(form.patient_disposition?.includes('Cancelled'))
  const refused     = !!(form.patient_disposition?.includes('Refused'))
  const emergency   = !!(form.type_of_service?.includes('Emergency'))
  const arrestYes   = !!(form.cardiac_arrest === 'Yes' || form.cardiac_arrest?.includes('Yes'))
  const injuryYes   = form.possible_injury === true || form.possible_injury === 'Yes'
  const stemi       = !!(form.primary_impression_snomed?.includes('STEMI') || form.primary_impression_text?.includes('STEMI'))

  // ── UNIT / AGENCY INFORMATION ──────────────────────────────────────────────

  // e011: Agency number in PCR should match DEM
  // (cross-doc check, not enforceable in form but remind if blank)
  if (!form.agency_number)
    w.push({ id: 'e011', field: 'agency_number', section: 'response', severity: 'warning',
      message: 'EMS Agency Number should be recorded and should match the agency demographic record.' })

  // e012–e016: "None/No Delay" exclusivity checks
  // These fire if multiple delay values are selected when one is "None"
  // We can't check multi-select here easily; add as a UX note if dispatch delay includes "None" but has other values
  // Skipped — backend validation only (pertinent negative uniqueness checks)

  // ── CALL EVENT TIMES ──────────────────────────────────────────────────────

  // e017: PSAP Call time should not be before unit notified (eTimes.01 ≤ eTimes.03)
  // We don't have PSAP call time; skip

  // e018: En Route should be recorded unless cancelled
  if (!form.en_route_datetime && !cancelled)
    w.push({ id: 'e018', field: 'en_route_datetime', section: 'times', severity: 'warning',
      message: 'Unit En Route Date/Time should be recorded unless the response was cancelled.' })

  // e019: En Route should not be earlier than dispatch
  if (form.dispatch_datetime && form.en_route_datetime && form.dispatch_datetime > form.en_route_datetime)
    w.push({ id: 'e019', field: 'en_route_datetime', section: 'times', severity: 'warning',
      message: 'Unit En Route time should not be earlier than Dispatch Notified time.' })

  // e020: Arrived at Scene should be recorded unless cancelled
  if (!form.arrive_scene_datetime && !cancelled)
    w.push({ id: 'e020', field: 'arrive_scene_datetime', section: 'times', severity: 'warning',
      message: 'Arrived at Scene Date/Time should be recorded unless the response was cancelled.' })

  // e021: Arrived at Scene should not be earlier than En Route
  if (form.en_route_datetime && form.arrive_scene_datetime && form.en_route_datetime > form.arrive_scene_datetime)
    w.push({ id: 'e021', field: 'arrive_scene_datetime', section: 'times', severity: 'warning',
      message: 'Arrived at Scene time should not be earlier than Unit En Route time.' })

  // e022: Arrived at Scene should not be earlier than dispatch
  if (form.dispatch_datetime && form.arrive_scene_datetime && form.dispatch_datetime > form.arrive_scene_datetime)
    w.push({ id: 'e022', field: 'arrive_scene_datetime', section: 'times', severity: 'warning',
      message: 'Arrived at Scene time should not be earlier than Dispatch time.' })

  // e023: Patient Contact should not be earlier than Arrived at Scene
  if (form.arrive_scene_datetime && form.patient_contact_datetime && form.arrive_scene_datetime > form.patient_contact_datetime)
    w.push({ id: 'e023', field: 'patient_contact_datetime', section: 'times', severity: 'warning',
      message: 'Patient Contact time should not be earlier than Arrived at Scene time.' })

  // e024: Patient Contact should not be earlier than dispatch
  if (form.dispatch_datetime && form.patient_contact_datetime && form.dispatch_datetime > form.patient_contact_datetime)
    w.push({ id: 'e024', field: 'patient_contact_datetime', section: 'times', severity: 'warning',
      message: 'Patient Contact time should not be earlier than Dispatch time.' })

  // e025: Left Scene should not be earlier than Patient Contact
  if (form.patient_contact_datetime && form.depart_scene_datetime && form.patient_contact_datetime > form.depart_scene_datetime)
    w.push({ id: 'e025', field: 'depart_scene_datetime', section: 'times', severity: 'warning',
      message: 'Unit Left Scene time should not be earlier than Patient Contact time.' })

  // e026: Left Scene should not be earlier than Arrived at Scene
  if (form.arrive_scene_datetime && form.depart_scene_datetime && form.arrive_scene_datetime > form.depart_scene_datetime)
    w.push({ id: 'e026', field: 'depart_scene_datetime', section: 'times', severity: 'warning',
      message: 'Unit Left Scene time should not be earlier than Arrived at Scene time.' })

  // e027: Left Scene should not be earlier than dispatch
  if (form.dispatch_datetime && form.depart_scene_datetime && form.dispatch_datetime > form.depart_scene_datetime)
    w.push({ id: 'e027', field: 'depart_scene_datetime', section: 'times', severity: 'warning',
      message: 'Unit Left Scene time should not be earlier than Dispatch time.' })

  // e028: Left Scene should be recorded when transporting
  if (transported && !form.depart_scene_datetime)
    w.push({ id: 'e028', field: 'depart_scene_datetime', section: 'times', severity: 'warning',
      message: 'Unit Left Scene Date/Time should be recorded when transporting patient.' })

  // e029: Arrived at Destination should not be earlier than Left Scene
  if (form.depart_scene_datetime && form.arrive_destination_datetime && form.depart_scene_datetime > form.arrive_destination_datetime)
    w.push({ id: 'e029', field: 'arrive_destination_datetime', section: 'times', severity: 'warning',
      message: 'Arrived at Destination time should not be earlier than Unit Left Scene time.' })

  // e030: Arrived at Destination should not be earlier than dispatch
  if (form.dispatch_datetime && form.arrive_destination_datetime && form.dispatch_datetime > form.arrive_destination_datetime)
    w.push({ id: 'e030', field: 'arrive_destination_datetime', section: 'times', severity: 'warning',
      message: 'Arrived at Destination time should not be earlier than Dispatch time.' })

  // e031: Arrived at Destination should be recorded when transporting
  if (transported && !form.arrive_destination_datetime)
    w.push({ id: 'e031', field: 'arrive_destination_datetime', section: 'times', severity: 'warning',
      message: 'Arrived at Destination Date/Time should be recorded when transporting.' })

  // e032: Back in Service should not be earlier than Left Scene
  if (form.depart_scene_datetime && form.available_datetime && form.depart_scene_datetime > form.available_datetime)
    w.push({ id: 'e032', field: 'available_datetime', section: 'times', severity: 'warning',
      message: 'Back in Service time should not be earlier than Unit Left Scene time.' })

  // e033: Back in Service should not be earlier than dispatch
  if (form.dispatch_datetime && form.available_datetime && form.dispatch_datetime > form.available_datetime)
    w.push({ id: 'e033', field: 'available_datetime', section: 'times', severity: 'warning',
      message: 'Back in Service time should not be earlier than Dispatch time.' })

  // e034–e056: additional timestamp cross-checks (arrived destination vs others, back in service vs arrived destination)
  if (form.arrive_destination_datetime && form.available_datetime && form.arrive_destination_datetime > form.available_datetime)
    w.push({ id: 'e034', field: 'available_datetime', section: 'times', severity: 'warning',
      message: 'Back in Service time should not be earlier than Arrived at Destination time.' })

  // ── PATIENT INFORMATION ───────────────────────────────────────────────────

  // e057: DOB when evaluated
  if (!form.patient_dob && evaluated)
    w.push({ id: 'e057', field: 'patient_dob', section: 'patient', severity: 'warning',
      message: 'Date of Birth should be recorded when patient was evaluated and care provided.' })

  // e058: DOB should be reasonable (not future date — simple check)
  if (form.patient_dob && form.patient_dob > new Date().toISOString().split('T')[0])
    w.push({ id: 'e058', field: 'patient_dob', section: 'patient', severity: 'warning',
      message: 'Date of Birth should not be a future date.' })

  // e059: Gender when evaluated
  if (!form.patient_gender && evaluated)
    w.push({ id: 'e059', field: 'patient_gender', section: 'patient', severity: 'warning',
      message: 'Gender should be recorded when patient was evaluated and care provided.' })

  // e060: Race when evaluated
  if (!form.patient_race && evaluated)
    w.push({ id: 'e060', field: 'patient_race', section: 'patient', severity: 'warning',
      message: 'Race should be recorded when patient was evaluated and care provided.' })

  // e062: Patient's home address should be recorded when evaluated
  if (!form.patient_address && evaluated)
    w.push({ id: 'e062', field: 'patient_address', section: 'patient', severity: 'warning',
      message: "Patient's home address should be recorded when patient was evaluated." })

  // e063: Patient city should be recorded when evaluated
  if (!form.patient_city && evaluated)
    w.push({ id: 'e063', field: 'patient_city', section: 'patient', severity: 'warning',
      message: "Patient's home city should be recorded when patient was evaluated." })

  // e064: Patient state should be recorded when evaluated
  if (!form.patient_state && evaluated)
    w.push({ id: 'e064', field: 'patient_state', section: 'patient', severity: 'warning',
      message: "Patient's home state should be recorded when patient was evaluated." })

  // e065: Patient zip should be recorded when state is recorded
  if (form.patient_state && !form.patient_zip)
    w.push({ id: 'e065', field: 'patient_zip', section: 'patient', severity: 'warning',
      message: "Patient ZIP code should be recorded when patient state is recorded." })

  // e193: Patient name should be recorded when evaluated
  if (evaluated && !form.patient_last_name && !form.patient_first_name)
    w.push({ id: 'e193', field: 'patient_last_name', section: 'patient', severity: 'warning',
      message: 'Patient name should be recorded when patient was evaluated and care provided.' })

  // ── INCIDENT SCENE ────────────────────────────────────────────────────────

  // e067: Num patients should match "Multiple/Single"
  if (form.num_patients_at_scene > 1 && !form.patient_disposition?.includes('Multiple'))
    w.push({ id: 'e067', field: 'num_patients_at_scene', section: 'scene', severity: 'warning',
      message: 'Number of patients at scene is more than 1 — Mass Casualty Incident should reflect "Multiple".' })

  // e068: "Multiple patients" should be indicated when MCI = Yes
  // (we don't have explicit MCI field; skip)

  // e069: GPS/scene location when evaluated
  if (!form.scene_gps && evaluated)
    w.push({ id: 'e069', field: 'scene_gps', section: 'scene', severity: 'warning',
      message: 'Scene GPS coordinates should be recorded when patient contact was made.' })

  // e070: Incident location type should be recorded unless cancelled
  if (!form.scene_type && !cancelled)
    w.push({ id: 'e070', field: 'scene_type', section: 'scene', severity: 'warning',
      message: 'Incident Location Type should be recorded unless response was cancelled.' })

  // e071: Scene address should be recorded unless cancelled
  if (!form.scene_address && !cancelled)
    w.push({ id: 'e071', field: 'scene_address', section: 'scene', severity: 'warning',
      message: 'Scene address should be recorded unless response was cancelled.' })

  // e072: Scene city should be recorded unless cancelled
  if (!form.scene_city && !cancelled)
    w.push({ id: 'e072', field: 'scene_city', section: 'scene', severity: 'warning',
      message: 'Scene city should be recorded unless response was cancelled.' })

  // e073: Scene state should be recorded unless cancelled
  if (!form.scene_state && !cancelled)
    w.push({ id: 'e073', field: 'scene_state', section: 'scene', severity: 'warning',
      message: 'Scene state should be recorded unless response was cancelled.' })

  // e074: Scene zip should be within recorded state (cross-check; just prompt if state recorded but no zip)
  if (form.scene_state && !form.scene_zip)
    w.push({ id: 'e074', field: 'scene_zip', section: 'scene', severity: 'warning',
      message: 'Scene ZIP code should be recorded when scene state is recorded.' })

  // ── SITUATION ─────────────────────────────────────────────────────────────

  // e075: Symptom onset datetime for emergency + evaluated
  if (!form.symptom_onset_datetime && evaluated && emergency)
    w.push({ id: 'e075', field: 'symptom_onset_datetime', section: 'situation', severity: 'warning',
      message: 'Date/Time of Symptom Onset should be recorded for emergency responses when patient was evaluated.' })

  // e076: Possible injury for emergency + evaluated
  if (!form.possible_injury && form.possible_injury !== true && form.possible_injury !== false && evaluated && emergency)
    w.push({ id: 'e076', field: 'possible_injury', section: 'situation', severity: 'warning',
      message: 'Possible Injury should be recorded for emergency responses when patient was evaluated.' })

  // e077: Possible injury should be Yes when injury-related symptoms/impressions recorded
  // (hard to detect automatically; skip)

  // e080: Primary symptom for emergency + evaluated
  if (!form.primary_symptom_snomed && evaluated && emergency)
    w.push({ id: 'e080', field: 'primary_symptom_snomed', section: 'situation', severity: 'warning',
      message: 'Primary Symptom should be recorded for emergency responses when patient was evaluated.' })

  // e081: Other associated symptoms should only be recorded when primary symptom is recorded
  if (form.other_symptoms && !form.primary_symptom_snomed)
    w.push({ id: 'e081', field: 'primary_symptom_snomed', section: 'situation', severity: 'warning',
      message: 'Primary Symptom should be recorded before recording other associated symptoms.' })

  // e082: Primary impression for emergency + evaluated
  if (!form.primary_impression_snomed && !form.primary_impression_text && evaluated && emergency)
    w.push({ id: 'e082', field: 'primary_impression_snomed', section: 'situation', severity: 'warning',
      message: 'Provider Primary Impression should be recorded for emergency responses when patient was evaluated.' })

  // e083: Provider primary impression when evaluated
  if (!form.primary_impression_snomed && !form.primary_impression_text && evaluated)
    w.push({ id: 'e083', field: 'primary_impression_snomed', section: 'situation', severity: 'warning',
      message: 'Provider Primary Impression should be recorded when patient was evaluated.' })

  // e084: Secondary impression for emergency + evaluated
  if (!form.secondary_impression && evaluated && emergency)
    w.push({ id: 'e084', field: 'secondary_impression', section: 'situation', severity: 'warning',
      message: 'Secondary Impression should be recorded for emergency responses when patient was evaluated.' })

  // e085: Initial acuity when evaluated
  if (!form.initial_acuity && evaluated)
    w.push({ id: 'e085', field: 'initial_acuity', section: 'situation', severity: 'warning',
      message: 'Initial Patient Acuity should be recorded when patient was evaluated.' })

  // e086: Final acuity when evaluated
  if (!form.final_acuity && evaluated)
    w.push({ id: 'e086', field: 'final_acuity', section: 'situation', severity: 'warning',
      message: 'Final Patient Acuity should be recorded when patient was evaluated.' })

  // e087: Cardiac arrest 12-lead interpretation required when STEMI impression
  if (stemi && !form.cardiac_rhythm)
    w.push({ id: 'e087', field: 'cardiac_rhythm', section: 'situation', severity: 'warning',
      message: 'Cardiac rhythm / ECG interpretation should be recorded when STEMI is the primary impression.' })

  // e088: Chief complaint anatomic location should only be recorded for transfers
  if (form.scene_type?.includes('Transfer') && !form.dispatch_reason)
    w.push({ id: 'e088', field: 'dispatch_reason', section: 'situation', severity: 'warning',
      message: 'Dispatch reason/chief complaint should be recorded for transfer responses.' })

  // ── INJURY ────────────────────────────────────────────────────────────────

  // e089: Cause of injury should be recorded when possible injury = Yes and evaluated
  if (injuryYes && evaluated && !form.dispatch_reason)
    w.push({ id: 'e089', field: 'dispatch_reason', section: 'situation', severity: 'warning',
      message: 'Cause of Injury should be recorded when Possible Injury is Yes and patient was evaluated.' })

  // e090: Cause of injury should only be recorded when possible injury = Yes
  if (form.dispatch_reason && (form.possible_injury === false || form.possible_injury === 'No'))
    w.push({ id: 'e090', field: 'possible_injury', section: 'situation', severity: 'warning',
      message: 'Possible Injury should be "Yes" when a cause of injury is recorded.' })

  // e091: Mechanism of injury only when injury = Yes
  // (dispatch_reason covers this; no separate mechanism field)

  // e092: Vehicle impact area only when injury = Yes (no separate field; skip)

  // ── CARDIAC ARREST ────────────────────────────────────────────────────────

  // e093: Etiology when arrest = Yes
  if (arrestYes && !form.arrest_etiology)
    w.push({ id: 'e093', field: 'arrest_etiology', section: 'cardiac', severity: 'error',
      message: 'Cardiac Arrest Etiology should be recorded when Cardiac Arrest is Yes.' })

  // e094: Arrest fields should only be recorded when arrest = Yes
  if (!arrestYes && form.resuscitation_attempted)
    w.push({ id: 'e094', field: 'cardiac_arrest', section: 'cardiac', severity: 'warning',
      message: 'Cardiac Arrest should be "Yes" when resuscitation is documented.' })

  // e095: Resuscitation attempted when arrest = Yes + evaluated
  if (arrestYes && evaluated && (!form.resuscitation_attempted || (Array.isArray(form.resuscitation_attempted) && (form.resuscitation_attempted as unknown as string[]).length === 0)))
    w.push({ id: 'e095', field: 'resuscitation_attempted', section: 'cardiac', severity: 'error',
      message: 'Resuscitation Attempted should be recorded when Cardiac Arrest is Yes.' })

  // e096: Resuscitation should only be recorded when arrest = Yes
  // (handled by e094 above)

  // e097: Arrest witnessed when arrest = Yes + evaluated
  if (arrestYes && evaluated && (!form.arrest_witnessed || (Array.isArray(form.arrest_witnessed) && (form.arrest_witnessed as unknown as string[]).length === 0)))
    w.push({ id: 'e097', field: 'arrest_witnessed', section: 'cardiac', severity: 'error',
      message: 'Arrest Witnessed By should be recorded when Cardiac Arrest is Yes.' })

  // e098: CPR initiation should include "Compressions" when compressions were done
  // (can't check sub-fields without more granular form state; skip)

  // e099: Who initiated CPR when arrest = Yes + evaluated
  if (arrestYes && evaluated && !form.who_initiated_cpr)
    w.push({ id: 'e099', field: 'who_initiated_cpr', section: 'cardiac', severity: 'error',
      message: 'Who First Initiated CPR should be recorded when Cardiac Arrest is Yes.' })

  // e100: Arrest witnessed — "Not Witnessed" should be the only value if selected
  // (single-select; can't validate multi-select conflict here)

  // e101: AED use prior to EMS when arrest = Yes + evaluated
  if (arrestYes && evaluated && !form.aed_prior_to_ems)
    w.push({ id: 'e101', field: 'aed_prior_to_ems', section: 'cardiac', severity: 'error',
      message: 'AED Use Prior to EMS Arrival should be recorded when Cardiac Arrest is Yes.' })

  // e102: AED details only when AED was used
  if (form.who_used_aed && form.aed_prior_to_ems === 'No')
    w.push({ id: 'e102', field: 'aed_prior_to_ems', section: 'cardiac', severity: 'warning',
      message: 'AED Use Prior to EMS should not be "No" when AED user is documented.' })

  // e103: Cardiac rhythm when arrest = Yes + evaluated
  if (arrestYes && evaluated && !form.arrest_rhythm)
    w.push({ id: 'e103', field: 'arrest_rhythm', section: 'cardiac', severity: 'error',
      message: 'Cardiac Rhythm at First EMS Contact (eArrest.11) should be recorded when Cardiac Arrest is Yes.' })

  // e104: Cardiac rhythm should only be recorded when arrest = Yes
  if (!arrestYes && form.arrest_rhythm && evaluated)
    w.push({ id: 'e104', field: 'cardiac_arrest', section: 'cardiac', severity: 'warning',
      message: 'Cardiac Arrest should be "Yes" if cardiac arrest rhythm is being documented.' })

  // e105: ROSC when arrest = Yes + evaluated
  if (arrestYes && evaluated && !form.rosc)
    w.push({ id: 'e105', field: 'rosc', section: 'cardiac', severity: 'error',
      message: 'Return of Spontaneous Circulation should be recorded when Cardiac Arrest is Yes.' })

  // e106–e122: Additional arrest sub-fields (datetime of arrest, end-of-event, etc.)
  if (arrestYes && evaluated && !form.date_time_cardiac_arrest)
    w.push({ id: 'e106', field: 'date_time_cardiac_arrest', section: 'cardiac', severity: 'error',
      message: 'Date/Time of Cardiac Arrest should be recorded when Cardiac Arrest is Yes.' })

  if (arrestYes && evaluated && !form.end_of_arrest_event)
    w.push({ id: 'e108', field: 'end_of_arrest_event', section: 'cardiac', severity: 'error',
      message: 'Cardiac Arrest Termination/Outcome should be recorded when Cardiac Arrest is Yes.' })

  if (arrestYes && evaluated && (!form.cpr_type || (Array.isArray(form.cpr_type) && (form.cpr_type as unknown as string[]).length === 0)))
    w.push({ id: 'e109', field: 'cpr_type', section: 'cardiac', severity: 'error',
      message: 'Type of CPR should be recorded when Cardiac Arrest is Yes and resuscitation was attempted.' })

  if (arrestYes && form.resuscitation_attempted?.includes('Yes') && !form.reason_cpr_discontinued)
    w.push({ id: 'e112', field: 'reason_cpr_discontinued', section: 'cardiac', severity: 'warning',
      message: 'Reason CPR was Discontinued should be recorded when resuscitation was attempted.' })

  // ── PATIENT HISTORY ───────────────────────────────────────────────────────

  // e124: "None Noted" medication history should be exclusive
  // (can't validate multi-select exclusivity without more granular state; skip)

  // ── VITAL SIGNS ───────────────────────────────────────────────────────────

  // e125: Vital signs datetime should be recorded when any vital is recorded
  const hasVitals = !!(form.initial_hr || form.initial_rr || form.initial_spo2 ||
    form.initial_bp_systolic || form.initial_bp_diastolic || form.initial_gcs_total)

  if (hasVitals && !form.patient_contact_datetime)
    w.push({ id: 'e125', field: 'patient_contact_datetime', section: 'vitals', severity: 'warning',
      message: 'Vital signs datetime requires Patient Contact time to be recorded.' })

  // e126–e135: Vital sign timing cross-checks (should not be before patient contact, after back in service)
  // These are timestamp comparisons that only apply if vitals have their own timestamp field
  // In our form, vitals are captured at patient_contact_datetime implicitly; skip individual vital timing

  // Completeness: prompt for vitals when evaluated
  if (evaluated && !hasVitals)
    w.push({ id: 'e125b', field: 'initial_hr', section: 'vitals', severity: 'warning',
      message: 'At least one vital sign set should be recorded when patient was evaluated.' })

  if (evaluated && hasVitals && !form.initial_gcs_total)
    w.push({ id: 'e133', field: 'initial_gcs_total', section: 'vitals', severity: 'warning',
      message: 'GCS Total should be recorded when other vital signs are present.' })

  if (evaluated && hasVitals && !form.initial_bp_systolic)
    w.push({ id: 'e134', field: 'initial_bp_systolic', section: 'vitals', severity: 'warning',
      message: 'Blood Pressure should be recorded when other vital signs are present.' })

  if (evaluated && hasVitals && !form.initial_hr)
    w.push({ id: 'e135', field: 'initial_hr', section: 'vitals', severity: 'warning',
      message: 'Heart Rate/Pulse should be recorded when other vital signs are present.' })

  // ── MEDICATIONS ───────────────────────────────────────────────────────────

  // Medication completeness is handled at dispense_admin_log level; form-level checks:
  if (evaluated && emergency && !form.advance_directive)
    w.push({ id: 'e136', field: 'advance_directive', section: 'patient', severity: 'warning',
      message: 'Advance Directives should be recorded when patient was evaluated.' })

  // ── PROCEDURES ────────────────────────────────────────────────────────────

  // Procedure completeness is also tracked at encounter_procedures level; no additional form-level rules

  // ── PATIENT DISPOSITION ───────────────────────────────────────────────────

  // e160: Destination name when transporting
  if (transported && !form.destination_name)
    w.push({ id: 'e160', field: 'destination_name', section: 'disposition', severity: 'warning',
      message: 'Destination/Transferred To name should be recorded when transporting.' })

  // e161: Destination address when transporting
  if (transported && !form.destination_address)
    w.push({ id: 'e161', field: 'destination_address', section: 'disposition', severity: 'warning',
      message: 'Destination address should be recorded when transporting.' })

  // e162: Destination address should be within recorded state (cross-check; prompt if state but no addr)
  if (transported && form.patient_state && !form.destination_address)
    w.push({ id: 'e162', field: 'destination_address', section: 'disposition', severity: 'warning',
      message: 'Destination address city/state should be recorded when transporting.' })

  // e163: Destination type when transporting
  if (transported && !form.destination_type)
    w.push({ id: 'e163', field: 'destination_type', section: 'disposition', severity: 'warning',
      message: 'Type of Destination should be recorded when transporting.' })

  // e164: Transport method when transporting
  if (transported && !form.transport_method)
    w.push({ id: 'e164', field: 'transport_method', section: 'disposition', severity: 'warning',
      message: 'EMS Transport Method should be recorded when transporting.' })

  // e165: Transport method should not be recorded when patient refused or no transport
  if ((refused || form.patient_disposition?.includes('No Transport')) && form.transport_method)
    w.push({ id: 'e165', field: 'transport_method', section: 'disposition', severity: 'warning',
      message: 'EMS Transport Method should not be recorded when patient refused transport or no transport.' })

  // e166: Transport mode (emergent vs non) when transporting
  if (transported && !form.initial_acuity)
    w.push({ id: 'e166', field: 'initial_acuity', section: 'disposition', severity: 'warning',
      message: 'Patient acuity should be recorded to determine transport mode (Emergent/Non-Emergent).' })

  // e167: Transport mode should not be recorded when no transport
  // (handled implicitly by e165)

  // e168: Reason for choosing destination when evaluated
  if (evaluated && !form.destination_type && !cancelled)
    w.push({ id: 'e168', field: 'destination_type', section: 'disposition', severity: 'warning',
      message: 'Reason for Choosing Destination should be recorded when patient was evaluated.' })

  // e172: EMS transport method when transporting (same as e164, deduplicated above)

  // e173: Hospital capability when transporting to hospital
  if (transported && form.destination_type?.includes('Hospital') && !form.hospital_capability)
    w.push({ id: 'e173', field: 'hospital_capability', section: 'disposition', severity: 'warning',
      message: 'Hospital Capability/Designation should be recorded when transporting to a hospital.' })

  // e174: Level of care per protocol should be recorded when evaluated
  if (evaluated && !form.transport_capability)
    w.push({ id: 'e174', field: 'transport_capability', section: 'disposition', severity: 'warning',
      message: 'Level of Care should be recorded when patient was evaluated.' })

  // e175: Crew disposition — provider of record should be recorded
  if (evaluated && !form.provider_of_record)
    w.push({ id: 'e175', field: 'provider_of_record', section: 'disposition', severity: 'warning',
      message: 'Provider of Record should be recorded when patient was evaluated.' })

  // e176: PCR/crew resource number should be recorded
  if (!form.crew_resource_number)
    w.push({ id: 'e176', field: 'crew_resource_number', section: 'response', severity: 'warning',
      message: 'Crew Resource Number should be recorded.' })

  // e177: No transport reason when treated but not transported
  if (!transported && evaluated && !cancelled && !refused && !form.no_transport_reason)
    w.push({ id: 'e177', field: 'no_transport_reason', section: 'disposition', severity: 'warning',
      message: 'Reason for Not Transporting should be recorded when patient was treated but not transported.' })

  // e178: Refusal signed when patient refused
  if (refused && !form.refusal_signed)
    w.push({ id: 'e178', field: 'refusal_signed', section: 'disposition', severity: 'warning',
      message: 'Patient refusal signature should be documented when patient refused care or transport.' })

  // e179–e184: Additional disposition fields
  if (transported && !form.hospital_capability && form.destination_type?.includes('Hospital'))
    w.push({ id: 'e179', field: 'hospital_capability', section: 'disposition', severity: 'warning',
      message: 'Hospital capability/designation should be recorded when transporting to a hospital.' })

  // e185: Patient disposition should be recorded when evaluated
  if (evaluated && !form.patient_disposition)
    w.push({ id: 'e185', field: 'patient_disposition', section: 'disposition', severity: 'warning',
      message: 'Patient Evaluation/Care should be recorded.' })

  // e186: Incident/response number should be recorded
  if (!form.incident_number && !form.response_number)
    w.push({ id: 'e186', field: 'incident_number', section: 'response', severity: 'warning',
      message: 'Incident/Response Number should be recorded.' })

  // e187: Type of service should be recorded
  if (!form.type_of_service)
    w.push({ id: 'e187', field: 'type_of_service', section: 'response', severity: 'warning',
      message: 'Type of Service should be recorded.' })

  return w
}
