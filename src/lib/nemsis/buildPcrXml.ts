/**
 * NEMSIS 3.5.1 PCR XML Builder — TypeScript port of nemsis_export.py
 * Uses string template building (no DOM library) for Vercel compatibility.
 */

import { randomUUID } from 'crypto';
import { brand } from '../branding.config.js';
import {
  TYPE_OF_SERVICE_MAP,
  TRANSPORT_CAP_MAP,
  RESPONSE_MODE_MAP,
  DISPATCH_DELAY_MAP,
  RESPONSE_DELAY_MAP,
  SCENE_DELAY_MAP,
  TRANSPORT_DELAY_MAP,
  TURNAROUND_DELAY_MAP,
  DISPATCH_REASON_MAP,
  GENDER_MAP,
  GENDER_MAP_DEPRECATED,
  RACE_MAP,
  ACUITY_MAP,
  LEVEL_OF_CARE_MAP,
  POSSIBLE_INJURY_MAP,
  ADVANCE_DIRECTIVE_MAP,
  DISPOSITION_MAP,
  INCIDENT_DISPOSITION_MAP,
  UNIT_DISPOSITION_MAP,
  PATIENT_EVALUATION_CARE_MAP,
  TRANSPORT_DISPOSITION_MAP,
  EMS_UNIT_ROLE_MAP,
  NO_TRANSPORT_REASON_MAP,
  DESTINATION_TYPE_MAP,
  HOSPITAL_CAPABILITY_MAP,
  ARREST_ETIOLOGY_MAP,
  RESUS_ATTEMPTED_MAP,
  ARREST_WITNESSED_MAP,
  WHO_CPR_MAP,
  CPR_TYPE_MAP,
  AED_PRIOR_MAP,
  ROSC_MAP,
  END_ARREST_MAP,
  EMS_TRANSPORT_METHOD_MAP,
  ROUTE_MAP,
  DOSE_UNIT_MAP,
  MED_RESPONSE_MAP,
  CARDIAC_ARREST_MAP,
  MED_AUTH_MAP,
  STATE_ANSI,
  CA_COUNTY_FIPS,
} from './codeMaps.js';
import { INDUSTRY_MAP, OCCUPATION_MAP } from './occupationData.js';
import { xmlEsc, nilEl, nilElPlain, optEl, optElPlain, valEl } from './xmlHelpers.js';
import { fmtDatetime, fmtDate } from './nemsisDateUtils.js';
import { mapVal, gcsNum } from './nemsisUtils.js';
import { buildVitalsBlock } from './vitalsBuilder.js';

// ─── Agency Constants ────────────────────────────────────────────────────────

const AGENCY_NUMBER = brand.nemsisAgencyId;
const AGENCY_STATE_ID = brand.nemsisStateAgencyId;
const STATE_CODE = brand.nemsisStateCode;
const AGENCY_NAME = brand.companyName;
const SOFTWARE_NAME = brand.nemsisSoftware.replace(/ v[\d.]+$/, '');
const SOFTWARE_VERSION = brand.nemsisSoftware.match(/v([\d.]+)$/)?.[1] ?? '1.0';
const SOFTWARE_CREATOR = brand.nemsisSoftwareCreator;
// NEMSIS_VERSION constant kept for reference
// const NEMSIS_VERSION = '3.5.1.240301CP1';

// Re-export for backward compatibility
export { mapVal, gcsNum } from './nemsisUtils.js';
export { nilEl, optEl, valEl } from './xmlHelpers.js';
export { fmtDatetime, fmtDate } from './nemsisDateUtils.js';

export function resolveCountyFips(countyRaw: unknown, stateRaw: unknown): string | null {
  if (!countyRaw) return null;
  const c = String(countyRaw).trim();
  if (/^\d{5}$/.test(c)) return c;
  const state = String(stateRaw || 'CA').trim().toUpperCase();
  const key = c.toLowerCase().replace(' county', '').replace(' parish', '').trim();
  if (state === 'CA') {
    return CA_COUNTY_FIPS[key] ?? null;
  }
  return null;
}

export function resolveStateCode(stateRaw: unknown): string | null {
  if (!stateRaw) return null;
  const s = String(stateRaw).trim();
  if (/^\d{2}$/.test(s)) return s;
  return STATE_ANSI[s.toUpperCase()] ?? null;
}

const ICD10_RE = /^[A-Za-z][0-9][0-9A-Za-z](\.[0-9A-Za-z]{1,4})?[A-Za-z]?$/;

export function validateIcd10(code: unknown): string | null {
  if (!code) return null;
  const c = String(code).trim();
  return ICD10_RE.test(c) ? c : null;
}

function mapDelay(val: unknown, kind: string): string {
  const maps: Record<string, [Record<string, string>, string]> = {
    dispatch:   [DISPATCH_DELAY_MAP,   '2208013'],
    response:   [RESPONSE_DELAY_MAP,   '2209011'],
    scene:      [SCENE_DELAY_MAP,      '2210017'],
    transport:  [TRANSPORT_DELAY_MAP,  '2211011'],
    turnaround: [TURNAROUND_DELAY_MAP, '2212015'],
  };
  const [map, def] = maps[kind] ?? [DISPATCH_DELAY_MAP, '2208013'];
  if (!val) return def;
  return map[String(val).trim()] ?? def;
}

function ensureArray(val: unknown): string[] {
  if (val == null) return [];
  if (Array.isArray(val)) return val.map(String).filter(Boolean);
  const s = String(val).trim();
  return s ? [s] : [];
}

// ─── Lifted helpers (module-level) ───────────────────────────────────────────

function buildDelays(enc: Record<string, unknown>, elemName: string, kind: string, fieldName: string): string {
  const vals = ensureArray(enc[fieldName]);
  if (vals.length === 0) return `<${elemName}>${mapDelay(null, kind)}</${elemName}>`;
  return vals.map(v => `<${elemName}>${mapDelay(v, kind)}</${elemName}>`).join('\n      ');
}

function buildMultiVal(enc: Record<string, unknown>, elemName: string, valMap: Record<string, string>, fieldName: string): string {
  const vals = ensureArray(enc[fieldName]);
  const codes = vals.map(v => mapVal(valMap, v, '')).filter(c => c);
  if (codes.length === 0) return nilEl(elemName);
  return codes.map(c => `<${elemName}>${c}</${elemName}>`).join('\n      ');
}

export function buildMedicationsBlock(medications: Record<string, unknown>[]): string {
  if (medications.length === 0) {
    return `<eMedications.MedicationGroup>
      ${nilEl('eMedications.01')}
      ${nilEl('eMedications.02')}
      ${nilEl('eMedications.03')}
      ${nilEl('eMedications.04')}
      <eMedications.DosageGroup>
        ${nilEl('eMedications.05')}
        ${nilEl('eMedications.06')}
      </eMedications.DosageGroup>
      ${nilEl('eMedications.07')}
      ${nilEl('eMedications.08')}
      ${nilEl('eMedications.09')}
      ${nilEl('eMedications.10')}
    </eMedications.MedicationGroup>`;
  }
  return medications.map(med => {
    const medDt = fmtDatetime(med.created_at ?? med.date);
    const routeRaw = String(med.route ?? med.medication_route ?? '');
    const routeCode = mapVal(ROUTE_MAP, routeRaw, '9927037');
    const dose = med.qty_used ?? med.dose ?? med.quantity;
    const doseUnitRaw = String(med.dose_units ?? med.dosage_units ?? '');
    const doseUnitCode = mapVal(DOSE_UNIT_MAP, doseUnitRaw, '');
    const medResp = mapVal(MED_RESPONSE_MAP, med.response_to_medication ?? med.response ?? med.patient_response, '');
    const medAuth = mapVal(MED_AUTH_MAP, med.medication_authorization ?? med.authorization, '');
    const authEl = medAuth ? `<eMedications.11>${medAuth}</eMedications.11>` : '';

    return `<eMedications.MedicationGroup>
      ${optEl('eMedications.01', medDt)}
      ${nilEl('eMedications.02')}
      ${nilEl('eMedications.03')}
      <eMedications.04>${routeCode}</eMedications.04>
      <eMedications.DosageGroup>
        ${optEl('eMedications.05', dose)}
        ${optEl('eMedications.06', doseUnitCode)}
      </eMedications.DosageGroup>
      ${optEl('eMedications.07', medResp)}
      ${nilEl('eMedications.08')}
      ${nilEl('eMedications.09')}
      ${nilEl('eMedications.10')}
      ${authEl}
    </eMedications.MedicationGroup>`;
  }).join('\n    ');
}

export function buildProceduresBlock(procedures: Record<string, unknown>[]): string {
  if (procedures.length === 0) {
    return `<eProcedures.ProcedureGroup>
      ${nilEl('eProcedures.01')}
      ${nilEl('eProcedures.02')}
      ${nilEl('eProcedures.03')}
      ${nilEl('eProcedures.05')}
      ${nilEl('eProcedures.06')}
      ${nilEl('eProcedures.07')}
      ${nilEl('eProcedures.08')}
      ${nilEl('eProcedures.09')}
      ${nilEl('eProcedures.10')}
    </eProcedures.ProcedureGroup>`;
  }
  return procedures.map(proc => {
    const procDt = fmtDatetime(proc.performed_at ?? proc.created_at);
    const snomed = proc.snomed_code ?? proc.procedure_snomed ?? '';
    return `<eProcedures.ProcedureGroup>
      ${optEl('eProcedures.01', procDt)}
      ${nilEl('eProcedures.02')}
      ${optEl('eProcedures.03', snomed)}
      ${nilEl('eProcedures.05')}
      ${nilEl('eProcedures.06')}
      ${nilEl('eProcedures.07')}
      ${nilEl('eProcedures.08')}
      ${nilEl('eProcedures.09')}
      ${nilEl('eProcedures.10')}
    </eProcedures.ProcedureGroup>`;
  }).join('\n    ');
}

// ─── Main Builder ─────────────────────────────────────────────────────────────

export function buildPcrXml(
  enc: Record<string, unknown>,
  vitals: Record<string, unknown>[],
  medications: Record<string, unknown>[],
  procedures: Record<string, unknown>[]
): string {
  const encId = String(enc.encounter_id ?? enc.id ?? randomUUID());
  const pcrNum = String(enc.pcr_number ?? encId);
  const pcrUUID = randomUUID();

  // Base datetime for mandatory non-nillable fields
  const encDate = enc.date;
  let baseDtStr: string;
  if (encDate) {
    let ds: string;
    if (encDate instanceof Date) {
      // pg returns Date objects for date columns — use UTC to avoid timezone shift
      ds = encDate.toISOString().slice(0, 10);
    } else {
      ds = String(encDate).slice(0, 10);
    }
    baseDtStr = `${ds}T08:00:00+00:00`;
  } else {
    baseDtStr = '2026-01-01T08:00:00+00:00';
  }

  // ─── eResponse delays ───
  const unit = String(enc.unit ?? 'Medic 1');

  // ─── eArrest ───
  let arrestVal = enc.cardiac_arrest ?? 'No';
  if (Array.isArray(arrestVal)) arrestVal = arrestVal[0] ?? 'No';
  const arrestCode = mapVal(CARDIAC_ARREST_MAP, arrestVal, '3001003');

  // ─── eSituation ───
  const possibleInjury = enc.possible_injury;

  // eSituation.14 Work-Related Illness/Injury
  const workRelated14 = possibleInjury === true
    ? '<eSituation.14>9922001</eSituation.14>'      // Yes
    : possibleInjury === false
      ? '<eSituation.14>9922003</eSituation.14>'    // No
      : '<eSituation.14 xsi:nil="true" NV="7701003"/>'  // Not Recorded

  // eSituation.15 + 16: use imported maps from codeMaps.ts
  const industry15 = enc.patient_occupational_industry
    ? INDUSTRY_MAP[enc.patient_occupational_industry as string] || null
    : null
  const occupation16 = enc.patient_occupation
    ? OCCUPATION_MAP[enc.patient_occupation as string] || null
    : null
  let piCode: string;
  if (possibleInjury === true || possibleInjury === 'true') piCode = '9922005';
  else if (possibleInjury === false || possibleInjury === 'false') piCode = '9922001';
  else piCode = mapVal(POSSIBLE_INJURY_MAP, possibleInjury, '');

  const primaryIcd10 = validateIcd10(enc.primary_symptom_text) ?? 'R69';
  const otherSymp = validateIcd10(enc.other_symptoms);
  const primImpIcd10 = validateIcd10(enc.primary_impression_text) ?? 'R69';

  const secImps = ensureArray(enc.secondary_impression);
  const validSec = secImps.map(s => validateIcd10(s)).filter(Boolean) as string[];
  const secImpBlock = validSec.length > 0
    ? validSec.map(s => `<eSituation.12>${s}</eSituation.12>`).join('\n      ')
    : nilEl('eSituation.12');

  const acuityCode = mapVal(ACUITY_MAP, enc.initial_acuity, '');

  // ─── eScene ───
  let sceneType = String(enc.scene_type ?? 'Y92.818');
  for (const sep of [' \u2014 ', ' - ']) {
    if (sceneType.includes(sep)) {
      sceneType = sceneType.split(sep)[0].trim();
      break;
    }
  }

  const sceneState = String(enc.scene_state ?? 'CA');
  const sceneStateCode = resolveStateCode(sceneState) ?? STATE_CODE;

  let countyFips = resolveCountyFips(enc.scene_county, enc.scene_state ?? 'CA');
  if (!countyFips) {
    const rawKey = String(enc.scene_county ?? '').toLowerCase().replace(' county', '').trim();
    countyFips = CA_COUNTY_FIPS[rawKey] ?? '06093';
  }


  // ─── eDisposition ───
  const destState = String(enc.destination_state ?? '');
  const destStateCode = destState ? resolveStateCode(destState) : null;

  // eDisposition.27 — Unit Disposition
  const dispCode = mapVal(UNIT_DISPOSITION_MAP, enc.unit_disposition,
    mapVal(DISPOSITION_MAP, enc.patient_disposition, '4227005'));
  // eDisposition.28 — Patient Evaluation/Care
  const patEvalCode = mapVal(PATIENT_EVALUATION_CARE_MAP, enc.patient_evaluation_care,
    mapVal(INCIDENT_DISPOSITION_MAP, enc.patient_disposition, ''));
  // eDisposition.29 — Crew Disposition
  const crewDispCode = mapVal(EMS_UNIT_ROLE_MAP, enc.crew_disposition, '');
  // eDisposition.30 — Transport Disposition
  const transportDispCode = mapVal(TRANSPORT_DISPOSITION_MAP, enc.transport_disposition, '');
  const noTransReason = String(enc.no_transport_reason ?? '');
  const ntrCode = noTransReason ? mapVal(NO_TRANSPORT_REASON_MAP, noTransReason, '') : '';
  const eDisp31 = ntrCode ? `<eDisposition.31>${ntrCode}</eDisposition.31>` : '';

  const transportMethodRaw = enc.transport_method ?? enc.transport_capability;
  const transportMethodCode = (() => {
    const v = transportMethodRaw != null ? String(transportMethodRaw).trim() : '';
    const r = (EMS_TRANSPORT_METHOD_MAP as Record<string, string | null>)[v];
    if (r === undefined) return '4216005';
    if (r === null) return '4216005';
    return r;
  })();

  const destTypeCode = mapVal(DESTINATION_TYPE_MAP, enc.destination_type, '');
  const hospCapCode = mapVal(HOSPITAL_CAPABILITY_MAP, enc.hospital_capability ?? '', '');
  const levelOfCareCode = mapVal(LEVEL_OF_CARE_MAP, enc.transport_capability, '4232001');

  // ─── ePatient ───
  const patCountyFips = resolveCountyFips(enc.patient_county ?? enc.scene_county, enc.patient_state ?? 'CA');
  const patStateCode = resolveStateCode(String(enc.patient_state ?? 'CA'));

  const ageUnitsMap: Record<string, string> = { 'Years': '2516009', 'Months': '2516007', 'Days': '2516003' };
  const ageUnits = String(enc.patient_age_units ?? 'Years');
  const ageUnitCode = ageUnitsMap[ageUnits] ?? '2516009';
  const patAge = enc.patient_age;

  const phoneRaw = String(enc.patient_phone ?? '').replace(/[-() ]/g, '');
  let phoneFmt = '';
  if (phoneRaw.length === 10) {
    phoneFmt = `${phoneRaw.slice(0, 3)}-${phoneRaw.slice(3, 6)}-${phoneRaw.slice(6)}`;
  }
  const patPhoneEl = phoneFmt ? `<ePatient.18>${phoneFmt}</ePatient.18>` : '';

  // ─── eHistory ───
  const advDirs = ensureArray(enc.advance_directive);
  const advCodes = advDirs.map(d => mapVal(ADVANCE_DIRECTIVE_MAP, d, '')).filter(c => c);
  const advDirBlock = advCodes.length > 0
    ? advCodes.map(c => `<eHistory.05>${c}</eHistory.05>`).join('\n      ')
    : nilEl('eHistory.05');

  // ─── eTimes ───
  const dispatchDt = fmtDatetime(enc.dispatch_datetime) ?? baseDtStr;
  const availDt = fmtDatetime(enc.available_datetime) ?? baseDtStr;

  // ─── eResponse CMS billing code ───
  const tc = String(enc.transport_capability ?? '');
  const cmsMap: Record<string, string> = {
    'Ground Transport (ALS Equipped)': '2650003',
    'Ground Transport (BLS Equipped)': '2650007',
    'Ground Transport (Critical Care Equipped)': '2650005',
    'Non-Transport-Medical Treatment (ALS Equipped)': '2650003',
    'Non-Transport-Medical Treatment (BLS Equipped)': '2650007',
    'Non-Transport-No Medical Equipment': '2650007',
    'Air Transport-Helicopter': '2650017',
    'Air Transport-Fixed Wing': '2650011',
  };
  const cmsCode = cmsMap[tc] ?? '';

  // ─── Num patients ───
  let npCode = '2707001';
  try {
    const np = parseInt(String(enc.num_patients_at_scene ?? '1'), 10);
    npCode = np <= 1 ? '2707001' : np <= 5 ? '2707003' : '2707005';
  } catch (_) { /* use default */ }

  // ─── Vitals blocks ───
  const vitalsBlocks = [
    buildVitalsBlock(enc),
    ...vitals.map(v => buildVitalsBlock(enc, v)),
  ].join('\n    ');

  // ─── Assemble XML ────────────────────────────────────────────────────────
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<EMSDataSet xmlns="http://www.nemsis.org"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.nemsis.org https://nemsis.org/media/nemsis_v3/release-3.5.1/XSDs/NEMSIS_XSDs/EMSDataSet_v3.xsd">
  <Header>
    <DemographicGroup>
      <dAgency.01>${AGENCY_STATE_ID}</dAgency.01>
      <dAgency.02>${AGENCY_NUMBER}</dAgency.02>
      <dAgency.04>${STATE_CODE}</dAgency.04>
    </DemographicGroup>
    <PatientCareReport UUID="${pcrUUID}">

      <eRecord>
        <eRecord.01>${xmlEsc(pcrNum)}</eRecord.01>
        <eRecord.SoftwareApplicationGroup>
          <eRecord.02>${xmlEsc(SOFTWARE_CREATOR)}</eRecord.02>
          <eRecord.03>${xmlEsc(SOFTWARE_NAME)}</eRecord.03>
          <eRecord.04>${xmlEsc(SOFTWARE_VERSION)}</eRecord.04>
        </eRecord.SoftwareApplicationGroup>
      </eRecord>

      <eResponse>
        <eResponse.AgencyGroup>
          <eResponse.01>${AGENCY_NUMBER}</eResponse.01>
          <eResponse.02>${xmlEsc(AGENCY_NAME)}</eResponse.02>
        </eResponse.AgencyGroup>
        ${optEl('eResponse.03', enc.incident_number)}
        ${optEl('eResponse.04', enc.response_number)}
        <eResponse.ServiceGroup>
          <eResponse.05>${mapVal(TYPE_OF_SERVICE_MAP, enc.type_of_service, '2205001')}</eResponse.05>
        </eResponse.ServiceGroup>
        <eResponse.07>${mapVal(TRANSPORT_CAP_MAP, enc.transport_capability, '2207015')}</eResponse.07>
        ${buildDelays(enc, 'eResponse.08', 'dispatch', 'dispatch_delay')}
        ${buildDelays(enc, 'eResponse.09', 'response', 'response_delay')}
        ${buildDelays(enc, 'eResponse.10', 'scene', 'scene_delay')}
        ${buildDelays(enc, 'eResponse.11', 'transport', 'transport_delay')}
        ${buildDelays(enc, 'eResponse.12', 'turnaround', 'turnaround_delay')}
        <eResponse.13>${xmlEsc(unit)}</eResponse.13>
        <eResponse.14>${xmlEsc(unit)}</eResponse.14>
        <eResponse.23>${mapVal(RESPONSE_MODE_MAP, enc.response_mode, '2223001')}</eResponse.23>
        ${nilEl('eResponse.24', '7701001')}
      </eResponse>

      <eDispatch>
        <eDispatch.01>${mapVal(DISPATCH_REASON_MAP, enc.dispatch_reason, '2301051')}</eDispatch.01>
        <eDispatch.02>2302001</eDispatch.02>
      </eDispatch>

      <eTimes>
        ${nilEl('eTimes.01')}
        <eTimes.03>${dispatchDt}</eTimes.03>
        ${optEl('eTimes.05', fmtDatetime(enc.en_route_datetime))}
        ${optEl('eTimes.06', fmtDatetime(enc.arrive_scene_datetime))}
        ${optEl('eTimes.07', fmtDatetime(enc.patient_contact_datetime))}
        ${optEl('eTimes.09', fmtDatetime(enc.depart_scene_datetime))}
        ${optEl('eTimes.11', fmtDatetime(enc.arrive_destination_datetime))}
        ${nilEl('eTimes.12')}
        <eTimes.13>${availDt}</eTimes.13>
      </eTimes>

      <ePatient>
        <ePatient.PatientNameGroup>
          ${optEl('ePatient.02', enc.patient_last_name)}
          ${optEl('ePatient.03', enc.patient_first_name)}
        </ePatient.PatientNameGroup>
        ${optElPlain('ePatient.05', enc.patient_address)}
        ${optEl('ePatient.07', patCountyFips)}
        ${optEl('ePatient.08', patStateCode)}
        ${optEl('ePatient.09', enc.patient_zip)}
        <ePatient.13>${mapVal(GENDER_MAP_DEPRECATED, enc.patient_gender, '9906005')}</ePatient.13>
        ${optEl('ePatient.14', mapVal(RACE_MAP, enc.patient_race, '') || undefined)}
        <ePatient.AgeGroup>
          ${optEl('ePatient.15', patAge)}
          ${patAge != null && String(patAge).trim() ? optEl('ePatient.16', ageUnitCode) : nilEl('ePatient.16')}
        </ePatient.AgeGroup>
        ${optEl('ePatient.17', fmtDate(enc.patient_dob))}
        ${patPhoneEl}
        <ePatient.25>${mapVal(GENDER_MAP, enc.patient_gender, '9919005')}</ePatient.25>
      </ePatient>

      <ePayment>
        ${nilEl('ePayment.01')}
        ${optEl('ePayment.50', cmsCode)}
      </ePayment>

      <eScene>
        <eScene.01>${enc.first_ems_unit_on_scene ? '9923001' : '9923003'}</eScene.01>
        <eScene.06>${npCode}</eScene.06>
        <eScene.07>9923003</eScene.07>
        <eScene.08>2708001</eScene.08>
        <eScene.09>${xmlEsc(sceneType)}</eScene.09>
        ${optEl('eScene.15', enc.scene_address)}
        <eScene.18>${sceneStateCode}</eScene.18>
        ${optEl('eScene.19', enc.scene_zip)}
        <eScene.21>${countyFips}</eScene.21>
      </eScene>

      <eSituation>
        ${optEl('eSituation.01', fmtDatetime(enc.symptom_onset_datetime))}
        ${optEl('eSituation.02', piCode || undefined)}
        <eSituation.PatientComplaintGroup>
          ${nilEl('eSituation.03')}
        </eSituation.PatientComplaintGroup>
        ${nilEl('eSituation.07')}
        ${nilEl('eSituation.08')}
        <eSituation.09>${primaryIcd10}</eSituation.09>
        ${optEl('eSituation.10', otherSymp)}
        <eSituation.11>${primImpIcd10}</eSituation.11>
        ${secImpBlock}
        ${optEl('eSituation.13', acuityCode || undefined)}
        <eSituation.WorkRelatedGroup>
          ${workRelated14}
          ${optEl('eSituation.15', industry15 || undefined)}
          ${optEl('eSituation.16', occupation16 || undefined)}
        </eSituation.WorkRelatedGroup>
        ${optEl('eSituation.18', fmtDatetime(enc.symptom_onset_datetime))}
        ${nilEl('eSituation.20')}
      </eSituation>

      <eInjury>
        ${nilEl('eInjury.01')}
        ${nilEl('eInjury.03')}
        ${nilEl('eInjury.04')}
      </eInjury>

      <eArrest>
        <eArrest.01>${arrestCode}</eArrest.01>
        ${optEl('eArrest.02', mapVal(ARREST_ETIOLOGY_MAP, enc.arrest_etiology, '') || undefined)}
        ${buildMultiVal(enc, 'eArrest.03', RESUS_ATTEMPTED_MAP, 'resuscitation_attempted')}
        ${buildMultiVal(enc, 'eArrest.04', ARREST_WITNESSED_MAP, 'arrest_witnessed')}
        ${optEl('eArrest.07', mapVal(AED_PRIOR_MAP, enc.aed_prior_to_ems, '') || undefined)}
        ${buildMultiVal(enc, 'eArrest.09', CPR_TYPE_MAP, 'cpr_type')}
        ${nilEl('eArrest.11')}
        ${optEl('eArrest.12', mapVal(ROSC_MAP, enc.rosc, '') || undefined)}
        ${optEl('eArrest.14', enc.date_time_cardiac_arrest)}
        ${optEl('eArrest.16', mapVal(END_ARREST_MAP, enc.end_of_arrest_event, '') || undefined)}
        ${nilEl('eArrest.17')}
        ${nilEl('eArrest.18')}
        ${optEl('eArrest.20', mapVal(WHO_CPR_MAP, enc.who_initiated_cpr, '') || undefined)}
        ${optEl('eArrest.21', mapVal(WHO_CPR_MAP, enc.who_used_aed, '') || undefined)}
        ${nilEl('eArrest.22')}
      </eArrest>

      <eHistory>
        ${nilEl('eHistory.01')}
        ${advDirBlock}
        ${nilEl('eHistory.08')}
        ${nilEl('eHistory.17')}
      </eHistory>

      <eVitals>
        ${vitalsBlocks}
      </eVitals>

      <eProtocols>
        <eProtocols.ProtocolGroup>
          ${nilEl('eProtocols.01')}
        </eProtocols.ProtocolGroup>
      </eProtocols>

      <eMedications>
        ${buildMedicationsBlock(medications)}
      </eMedications>

      <eProcedures>
        ${buildProceduresBlock(procedures)}
      </eProcedures>

      <eDisposition>
        <eDisposition.DestinationGroup>
          ${nilEl('eDisposition.01')}
          ${nilEl('eDisposition.02')}
          ${optEl('eDisposition.05', destStateCode)}
          ${nilEl('eDisposition.06')}
          ${nilEl('eDisposition.07')}
        </eDisposition.DestinationGroup>
        ${nilEl('eDisposition.11')}
        <eDisposition.IncidentDispositionGroup>
          <eDisposition.27>${dispCode}</eDisposition.27>
          ${patEvalCode ? `<eDisposition.28>${patEvalCode}</eDisposition.28>` : nilEl('eDisposition.28')}
          ${crewDispCode ? `<eDisposition.29>${crewDispCode}</eDisposition.29>` : nilEl('eDisposition.29')}
          ${transportDispCode ? `<eDisposition.30>${transportDispCode}</eDisposition.30>` : nilEl('eDisposition.30')}
          ${eDisp31}
        </eDisposition.IncidentDispositionGroup>
        <eDisposition.16>${transportMethodCode}</eDisposition.16>
        ${nilEl('eDisposition.17')}
        ${nilEl('eDisposition.18')}
        ${nilEl('eDisposition.19')}
        ${nilEl('eDisposition.20')}
        ${optEl('eDisposition.21', destTypeCode || undefined)}
        ${nilEl('eDisposition.22')}
        ${optEl('eDisposition.23', hospCapCode || undefined)}
        <eDisposition.HospitalTeamActivationGroup>
          ${nilEl('eDisposition.24')}
          ${nilEl('eDisposition.25')}
        </eDisposition.HospitalTeamActivationGroup>
        <eDisposition.32>${levelOfCareCode}</eDisposition.32>
      </eDisposition>

      <eOutcome>
        ${nilEl('eOutcome.01')}
        ${nilEl('eOutcome.02')}
        <eOutcome.EmergencyDepartmentProceduresGroup>
          ${nilEl('eOutcome.09')}
          ${nilEl('eOutcome.19')}
        </eOutcome.EmergencyDepartmentProceduresGroup>
        ${nilEl('eOutcome.10')}
        ${nilEl('eOutcome.11')}
        <eOutcome.HospitalProceduresGroup>
          ${nilEl('eOutcome.12')}
          ${nilEl('eOutcome.20')}
        </eOutcome.HospitalProceduresGroup>
        ${nilEl('eOutcome.13')}
        ${nilEl('eOutcome.16')}
        ${nilEl('eOutcome.18')}
      </eOutcome>

    </PatientCareReport>
  </Header>
</EMSDataSet>`;

  return xml;
}
