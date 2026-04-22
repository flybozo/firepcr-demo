-- RPC: get_incident_timeline
-- Returns a unified activity feed for an incident, pulling from multiple sources.
-- Sources: patient encounters, ICS-214 activities/closures, medication administration (MAR),
--          supply runs, comp claims, unit deployment, CS daily counts.
--
-- For med_admin events, item_type is stored in the `acuity` column (reused field)
-- to support de-identification on the external API without extra round-trips.

DROP FUNCTION IF EXISTS public.get_incident_timeline(uuid, integer, timestamptz, text[]);

CREATE OR REPLACE FUNCTION public.get_incident_timeline(
  p_incident_id  uuid,
  p_limit        integer DEFAULT 50,
  p_before       timestamptz DEFAULT now(),
  p_types        text[] DEFAULT NULL
)
RETURNS TABLE(
  id               text,
  event_type       text,
  event_timestamp  timestamptz,
  unit_name        text,
  actor            text,
  summary          text,
  acuity           text,
  icon             text,
  detail_id        text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM (

    -- 1. New patient contact (encounter created)
    SELECT
      pe.id::text,
      'encounter_new'::text                                                                AS event_type,
      pe.created_at                                                                        AS event_timestamp,
      pe.unit                                                                              AS unit_name,
      pe.created_by                                                                        AS actor,
      COALESCE('New patient: ' || pe.primary_symptom_text, 'New patient contact')         AS summary,
      pe.initial_acuity                                                                    AS acuity,
      '🩺'::text                                                                           AS icon,
      pe.id::text                                                                          AS detail_id
    FROM patient_encounters pe
    WHERE pe.incident_id = p_incident_id
      AND pe.deleted_at IS NULL
      AND pe.created_at < p_before
      AND (p_types IS NULL OR 'encounter_new' = ANY(p_types))

    UNION ALL

    -- 2. PCR signed & locked
    SELECT
      (pe.id::text || ':signed'),
      'pcr_signed'::text,
      pe.signed_at,
      pe.unit,
      pe.signed_by,
      'PCR signed & locked',
      NULL::text,
      '✍️'::text,
      pe.id::text
    FROM patient_encounters pe
    WHERE pe.incident_id = p_incident_id
      AND pe.signed_at IS NOT NULL
      AND pe.deleted_at IS NULL
      AND pe.signed_at < p_before
      AND (p_types IS NULL OR 'pcr_signed' = ANY(p_types))

    UNION ALL

    -- 3. ICS 214 activity log entries
    --    ics214_activities.ics214_id (text) -> ics214_headers.ics214_id (text, unique)
    SELECT
      ia.id::text,
      'ics214_activity'::text,
      ia.log_datetime,
      h.unit_name,
      ia.logged_by,
      COALESCE(ia.description, 'Activity logged'),
      NULL::text,
      '📋'::text,
      ia.id::text
    FROM ics214_activities ia
    JOIN ics214_headers h ON h.ics214_id = ia.ics214_id
    WHERE h.incident_id = p_incident_id
      AND ia.log_datetime < p_before
      AND (p_types IS NULL OR 'ics214_activity' = ANY(p_types))

    UNION ALL

    -- 4. ICS 214 closed/submitted (uses closed_at, not signed_at)
    SELECT
      (h.id::text || ':closed'),
      'ics214_signed'::text,
      h.closed_at,
      h.unit_name,
      h.closed_by,
      'ICS 214 submitted — ' || COALESCE(h.unit_name, 'Unit'),
      NULL::text,
      '✅'::text,
      h.id::text
    FROM ics214_headers h
    WHERE h.incident_id = p_incident_id
      AND h.closed_at IS NOT NULL
      AND h.closed_at < p_before
      AND (p_types IS NULL OR 'ics214_signed' = ANY(p_types))

    UNION ALL

    -- 5. Medication administration (MAR)
    --    dispense_admin_log links to incidents via encounter_id -> patient_encounters.incident_id
    --    acuity field reused to carry item_type for external de-identification
    SELECT
      d.id::text,
      'med_admin'::text,
      COALESCE(
        d.created_at,
        (d.date::text || ' ' || COALESCE(d.time::text, '00:00:00'))::timestamptz
      ),
      d.med_unit,
      d.dispensed_by,
      'Medication administered: ' || COALESCE(d.item_name, 'Unknown'),
      d.item_type,   -- reused as drug category for external de-identification
      '💊'::text,
      d.id::text
    FROM dispense_admin_log d
    JOIN patient_encounters pe2 ON pe2.encounter_id = d.encounter_id
    WHERE pe2.incident_id = p_incident_id
      AND pe2.deleted_at IS NULL
      AND COALESCE(
            d.created_at,
            (d.date::text || ' ' || COALESCE(d.time::text, '00:00:00'))::timestamptz
          ) < p_before
      AND (p_types IS NULL OR 'med_admin' = ANY(p_types))

    UNION ALL

    -- 6. Supply runs completed
    --    supply_runs links via incident_id directly, or via incident_unit_id -> incident_units
    --    No unit or items_count column; join to incident_units -> units for name, subquery for count
    SELECT
      sr.id::text,
      'supply_run'::text,
      sr.created_at,
      u_sr.name,
      sr.dispensed_by,
      'Supply run completed (' || COALESCE(
        (SELECT COUNT(*)::text FROM supply_run_items sri WHERE sri.supply_run_id = sr.id AND sri.deleted_at IS NULL),
        '?'
      ) || ' items)',
      NULL::text,
      '📦'::text,
      sr.id::text
    FROM supply_runs sr
    LEFT JOIN incident_units iu_sr ON iu_sr.id = sr.incident_unit_id
    LEFT JOIN units u_sr ON u_sr.id = iu_sr.unit_id
    WHERE (sr.incident_id = p_incident_id OR iu_sr.incident_id = p_incident_id)
      AND sr.deleted_at IS NULL
      AND sr.created_at < p_before
      AND (p_types IS NULL OR 'supply_run' = ANY(p_types))

    UNION ALL

    -- 7. Workers comp claim filed
    SELECT
      cc.id::text,
      'comp_claim'::text,
      cc.created_at,
      NULL::text,
      NULL::text,
      'Workers comp claim filed',
      NULL::text,
      '⚠️'::text,
      cc.id::text
    FROM comp_claims cc
    WHERE cc.incident_id = p_incident_id
      AND cc.created_at < p_before
      AND (p_types IS NULL OR 'comp_claim' = ANY(p_types))

    UNION ALL

    -- 8. Unit deployed / assigned to incident
    SELECT
      iu.id::text,
      'unit_deployed'::text,
      iu.assigned_at,
      u.name,
      NULL::text,
      'Unit deployed: ' || COALESCE(u.name, 'Unknown'),
      NULL::text,
      '🚑'::text,
      iu.id::text
    FROM incident_units iu
    JOIN units u ON u.id = iu.unit_id
    WHERE iu.incident_id = p_incident_id
      AND iu.assigned_at IS NOT NULL
      AND iu.assigned_at < p_before
      AND (p_types IS NULL OR 'unit_deployed' = ANY(p_types))

    UNION ALL

    -- 9. CS daily count completed (internal only — excluded in external API layer)
    --    cs_daily_counts.unit is text (unit name), link to incident via incident_units
    SELECT
      cdc.id::text,
      'cs_count'::text,
      cdc.created_at,
      cdc.unit,
      cdc.performed_by,
      'CS daily count completed',
      NULL::text,
      '🔐'::text,
      cdc.id::text
    FROM cs_daily_counts cdc
    JOIN units u2 ON u2.name = cdc.unit
    JOIN incident_units iu2 ON iu2.unit_id = u2.id AND iu2.incident_id = p_incident_id
    WHERE cdc.created_at < p_before
      AND (p_types IS NULL OR 'cs_count' = ANY(p_types))

  ) AS events
  ORDER BY event_timestamp DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_incident_timeline(uuid, integer, timestamptz, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_incident_timeline(uuid, integer, timestamptz, text[]) TO service_role;
