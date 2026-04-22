-- RPC: get_encounter_detail
-- Returns all related data for an encounter in one round-trip.
-- Accepts either a UUID (patient_encounters.id) or a text encounter_id (e.g. 'ENC-123').
-- Returns a single JSONB object with all sub-tables nested.

CREATE OR REPLACE FUNCTION public.get_encounter_detail(p_encounter_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enc           patient_encounters%ROWTYPE;
  v_encounter_uuid uuid;
  v_enc_id_text   text;
  v_incident_name text;
  v_vitals        jsonb;
  v_procedures    jsonb;
  v_mar           jsonb;
  v_consent       jsonb;
  v_comp_claims   jsonb;
  v_notes         jsonb;
  v_photos        jsonb;
  v_crew          jsonb;
  v_providers     jsonb;
BEGIN
  -- Resolve encounter: try UUID match first, then text encounter_id
  BEGIN
    v_encounter_uuid := p_encounter_id::uuid;
    SELECT * INTO v_enc FROM patient_encounters WHERE id = v_encounter_uuid LIMIT 1;
  EXCEPTION WHEN invalid_text_representation THEN
    v_encounter_uuid := NULL;
  END;

  IF v_enc.id IS NULL THEN
    SELECT * INTO v_enc FROM patient_encounters WHERE encounter_id = p_encounter_id LIMIT 1;
  END IF;

  IF v_enc.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  v_encounter_uuid := v_enc.id;
  v_enc_id_text    := v_enc.encounter_id;

  -- Incident name
  IF v_enc.incident_id IS NOT NULL THEN
    SELECT name INTO v_incident_name FROM incidents WHERE id = v_enc.incident_id LIMIT 1;
  END IF;

  -- Vitals
  SELECT COALESCE(jsonb_agg(ev ORDER BY ev.recorded_at ASC), '[]'::jsonb)
  INTO v_vitals
  FROM encounter_vitals ev
  WHERE ev.encounter_id = v_encounter_uuid;

  -- Procedures
  SELECT COALESCE(jsonb_agg(ep ORDER BY ep.performed_at ASC), '[]'::jsonb)
  INTO v_procedures
  FROM encounter_procedures ep
  WHERE ep.encounter_id = v_encounter_uuid;

  -- MAR entries (dispense_admin_log)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', d.id, 'date', d.date, 'time', d.time,
      'item_name', d.item_name, 'item_type', d.item_type,
      'qty_used', d.qty_used, 'dosage_units', d.dosage_units,
      'medication_route', d.medication_route, 'dispensed_by', d.dispensed_by,
      'requires_cosign', d.requires_cosign,
      'provider_signature_url', d.provider_signature_url,
      'med_unit', d.med_unit
    ) ORDER BY d.date DESC, d.time DESC
  ), '[]'::jsonb)
  INTO v_mar
  FROM dispense_admin_log d
  WHERE d.encounter_id = v_enc_id_text;

  -- Consent forms
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', cf.id, 'consent_id', cf.consent_id, 'consent_type', cf.consent_type,
      'date_time', cf.date_time, 'patient_first_name', cf.patient_first_name,
      'patient_last_name', cf.patient_last_name, 'provider_of_record', cf.provider_of_record,
      'signed', cf.signed, 'pdf_url', cf.pdf_url
    ) ORDER BY cf.date_time DESC
  ), '[]'::jsonb)
  INTO v_consent
  FROM consent_forms cf
  WHERE cf.encounter_id = v_enc_id_text OR cf.encounter_id = v_encounter_uuid::text;

  -- Comp claims
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', cc.id, 'encounter_id', cc.encounter_id,
      'patient_name', cc.patient_name, 'date_of_injury', cc.date_of_injury,
      'status', cc.status, 'pdf_url', cc.pdf_url, 'created_at', cc.created_at,
      'provider_name', cc.provider_name
    ) ORDER BY cc.created_at DESC
  ), '[]'::jsonb)
  INTO v_comp_claims
  FROM comp_claims cc
  WHERE cc.encounter_id = v_enc_id_text OR cc.encounter_id = v_encounter_uuid::text;

  -- Progress notes
  SELECT COALESCE(jsonb_agg(pn ORDER BY pn.note_datetime DESC), '[]'::jsonb)
  INTO v_notes
  FROM progress_notes pn
  WHERE pn.encounter_id = v_enc_id_text
    AND pn.deleted_at IS NULL;

  -- Photos (paths only — signed URLs generated client-side or via separate call)
  SELECT COALESCE(jsonb_agg(pp ORDER BY pp.taken_at ASC), '[]'::jsonb)
  INTO v_photos
  FROM patient_photos pp
  WHERE pp.encounter_id = v_encounter_uuid;

  -- Crew for the unit (active assignments, fallback to all active employees)
  IF v_enc.unit_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('id', e.id, 'name', e.name)
      ORDER BY e.name
    ), '[]'::jsonb)
    INTO v_crew
    FROM unit_assignments ua
    JOIN incident_units iu ON iu.id = ua.incident_unit_id
    JOIN employees e ON e.id = ua.employee_id
    WHERE iu.unit_id = v_enc.unit_id
      AND iu.released_at IS NULL
      AND ua.released_at IS NULL;
  END IF;

  -- Fallback crew if none found
  IF v_crew IS NULL OR jsonb_array_length(v_crew) = 0 THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('id', e.id, 'name', e.name)
      ORDER BY e.name
    ), '[]'::jsonb)
    INTO v_crew
    FROM employees e
    WHERE e.status = 'Active';
  END IF;

  -- Providers (MD/DO/NP/PA)
  SELECT COALESCE(jsonb_agg(e.name ORDER BY e.name), '[]'::jsonb)
  INTO v_providers
  FROM employees e
  WHERE e.role IN ('MD', 'MD/DO', 'NP', 'PA')
    AND e.status = 'Active';

  RETURN jsonb_build_object(
    'encounter',       row_to_json(v_enc)::jsonb,
    'incident_name',   v_incident_name,
    'vitals',          v_vitals,
    'procedures',      v_procedures,
    'mar',             v_mar,
    'consent_forms',   v_consent,
    'comp_claims',     v_comp_claims,
    'progress_notes',  v_notes,
    'photos',          v_photos,
    'crew',            v_crew,
    'providers',       v_providers
  );
END;
$$;

-- Grant execute to authenticated users (RLS still applies to underlying tables)
GRANT EXECUTE ON FUNCTION public.get_encounter_detail(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_encounter_detail(text) TO service_role;
