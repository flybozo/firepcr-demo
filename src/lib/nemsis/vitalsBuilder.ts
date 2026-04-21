import { CARDIAC_RHYTHM_MAP } from './codeMaps.js';
import { mapVal, gcsNum } from './nemsisUtils.js';
import { xmlEsc, nilEl, optEl } from './xmlHelpers.js';
import { fmtDatetime } from './nemsisDateUtils.js';

export function buildVitalsBlock(enc: Record<string, unknown>, vitalsRow?: Record<string, unknown>): string {
  let takenAt: unknown, hr: unknown, rr: unknown, spo2: unknown;
  let sbp: unknown, dbp: unknown;
  let gcsE: unknown, gcsV: unknown, gcsM: unknown, gcsT: unknown;
  let pain: unknown, glucose: unknown, tempF: unknown;
  let rhythm: unknown;

  if (vitalsRow) {
    takenAt = vitalsRow.recorded_at ?? vitalsRow.taken_at;
    hr      = vitalsRow.hr ?? vitalsRow.heart_rate;
    rr      = vitalsRow.rr ?? vitalsRow.respiratory_rate;
    spo2    = vitalsRow.spo2;
    sbp     = vitalsRow.bp_systolic;
    dbp     = vitalsRow.bp_diastolic;
    gcsE    = vitalsRow.gcs_eye;
    gcsV    = vitalsRow.gcs_verbal;
    gcsM    = vitalsRow.gcs_motor;
    gcsT    = vitalsRow.gcs_total;
    pain    = vitalsRow.pain_scale;
    glucose = vitalsRow.blood_glucose;
    tempF   = vitalsRow.temp_f ?? vitalsRow.temperature_f;
    rhythm  = vitalsRow.cardiac_rhythm;
  } else {
    takenAt = enc.patient_contact_datetime;
    hr      = enc.initial_hr;
    rr      = enc.initial_rr;
    spo2    = enc.initial_spo2;
    sbp     = enc.initial_bp_systolic;
    dbp     = enc.initial_bp_diastolic;
    gcsE    = enc.initial_gcs_eye;
    gcsV    = enc.initial_gcs_verbal;
    gcsM    = enc.initial_gcs_motor;
    gcsT    = enc.initial_gcs_total;
    pain    = enc.initial_pain_scale;
    glucose = enc.initial_blood_glucose;
    tempF   = enc.initial_temp_f;
    rhythm  = enc.cardiac_rhythm;
  }

  const rhythmCode = mapVal(CARDIAC_RHYTHM_MAP, rhythm);
  const sbpVal = sbp != null && String(sbp).trim() ? String(sbp).trim() : null;
  const dbpVal = dbp != null && String(dbp).trim() ? String(dbp).trim() : null;
  const hrVal  = hr  != null && String(hr).trim()  ? String(hr).trim()  : null;
  const spo2Val = spo2 != null && String(spo2).trim() ? String(spo2).trim() : null;
  const rrVal  = rr  != null && String(rr).trim()  ? String(rr).trim()  : null;
  const glucoseVal = glucose != null && String(glucose).trim() ? String(glucose).trim() : null;
  const gcsENum = gcsNum(gcsE);
  const gcsVNum = gcsNum(gcsV);
  const gcsMNum = gcsNum(gcsM);
  const painStr = pain != null && String(pain).trim() ? String(pain).trim() : null;

  let tempBlock = '';
  if (tempF != null && String(tempF).trim()) {
    const tempC = Math.round((parseFloat(String(tempF)) - 32) * 5 / 9 * 10) / 10;
    if (!isNaN(tempC)) {
      tempBlock = `<eVitals.TemperatureGroup><eVitals.24>${tempC}</eVitals.24></eVitals.TemperatureGroup>`;
    }
  }

  let gcsTotalEl = '';
  if (gcsT != null && String(gcsT).trim()) {
    gcsTotalEl = `<eVitals.23>${xmlEsc(gcsT)}</eVitals.23>`;
  }

  return `<eVitals.VitalGroup>
      ${optEl('eVitals.01', fmtDatetime(takenAt))}
      ${nilEl('eVitals.02')}
      <eVitals.CardiacRhythmGroup>
        ${rhythmCode ? optEl('eVitals.03', rhythmCode) : nilEl('eVitals.03')}
        ${nilEl('eVitals.04')}
        ${nilEl('eVitals.05')}
      </eVitals.CardiacRhythmGroup>
      <eVitals.BloodPressureGroup>
        ${sbpVal ? `<eVitals.06>${sbpVal}</eVitals.06>` : nilEl('eVitals.06')}
        ${dbpVal ? `<eVitals.07>${dbpVal}</eVitals.07>` : nilEl('eVitals.07')}
      </eVitals.BloodPressureGroup>
      <eVitals.HeartRateGroup>
        ${hrVal ? `<eVitals.10>${hrVal}</eVitals.10>` : nilEl('eVitals.10')}
      </eVitals.HeartRateGroup>
      ${spo2Val ? `<eVitals.12>${spo2Val}</eVitals.12>` : nilEl('eVitals.12')}
      ${rrVal ? `<eVitals.14>${rrVal}</eVitals.14>` : nilEl('eVitals.14')}
      <eVitals.15>3315009</eVitals.15>
      ${nilEl('eVitals.16')}
      ${glucoseVal ? `<eVitals.18>${glucoseVal}</eVitals.18>` : nilEl('eVitals.18')}
      <eVitals.GlasgowScoreGroup>
        ${gcsENum ? `<eVitals.19>${gcsENum}</eVitals.19>` : nilEl('eVitals.19')}
        ${gcsVNum ? `<eVitals.20>${gcsVNum}</eVitals.20>` : nilEl('eVitals.20')}
        ${gcsMNum ? `<eVitals.21>${gcsMNum}</eVitals.21>` : nilEl('eVitals.21')}
        ${nilEl('eVitals.22')}
        ${gcsTotalEl}
      </eVitals.GlasgowScoreGroup>
      ${tempBlock}
      <eVitals.26>3326001</eVitals.26>
      <eVitals.PainScaleGroup>
        ${painStr ? `<eVitals.27>${painStr}</eVitals.27>` : nilEl('eVitals.27')}
      </eVitals.PainScaleGroup>
      <eVitals.StrokeScaleGroup>
        ${nilEl('eVitals.29')}
        ${nilEl('eVitals.30')}
      </eVitals.StrokeScaleGroup>
      ${nilEl('eVitals.31')}
    </eVitals.VitalGroup>`;
}
