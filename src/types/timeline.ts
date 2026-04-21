export type TimelineEvent = {
  id: string
  event_type: string
  event_timestamp: string
  unit_name: string | null
  actor: string | null
  summary: string
  acuity: string | null
  icon: string
  detail_id: string | null
}
