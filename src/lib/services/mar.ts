/**
 * MAR (Medication Administration Record) service — queries and mutations.
 */
import { createClient } from '@/lib/supabase/client'

// ── Queries ──────────────────────────────────────────────────────────────────

/** Get a single MAR entry */
export function queryMAREntry(id: string) {
  return createClient()
    .from('dispense_admin_log')
    .select('*')
    .eq('id', id)
    .single()
}

/** Get MAR entries for an incident */
export function queryMARByIncident(incidentId: string) {
  return createClient()
    .from('dispense_admin_log')
    .select('*')
    .eq('incident_id', incidentId)
    .order('administered_at', { ascending: false })
}

/** Get formulary items for a unit type */
export function queryFormularyForUnit(unitType: string, categories?: string[]) {
  let q = createClient()
    .from('formulary_templates')
    .select('*')
    .eq('unit_type', unitType)
  if (categories?.length) q = q.in('category', categories)
  return q.order('item_name')
}

/** Get unit inventory (for CS debit) */
export function queryUnitCSInventory(unitName: string) {
  return createClient()
    .from('unit_inventory')
    .select('id, item_name, quantity, lot_number, category')
    .eq('unit_name', unitName)
    .in('category', ['CS', 'Rx'])
    .order('item_name')
}

// ── Mutations ────────────────────────────────────────────────────────────────

/** Create a MAR entry */
export function insertMAREntry(data: Record<string, unknown>) {
  return createClient()
    .from('dispense_admin_log')
    .insert(data)
    .select('id')
    .single()
}

/** Update a MAR entry (e.g., void) */
export function updateMAREntry(id: string, data: Record<string, unknown>) {
  return createClient()
    .from('dispense_admin_log')
    .update(data)
    .eq('id', id)
}

/** Void a MAR entry (sets is_voided, void_reason, voided_by) */
export function voidMAREntry(id: string, data: {
  void_reason: string
  voided_by: string
  voided_at?: string
}) {
  return createClient()
    .from('dispense_admin_log')
    .update({
      is_voided: true,
      ...data,
      voided_at: data.voided_at || new Date().toISOString(),
    })
    .eq('id', id)
}

/** Insert a CS transaction for MAR-related inventory changes */
export function insertCSTransaction(data: Record<string, unknown>) {
  return createClient()
    .from('cs_transactions')
    .insert(data)
}

/** Update unit inventory quantity (for CS debit on admin) */
export function updateInventoryQty(id: string, quantity: number) {
  return createClient()
    .from('unit_inventory')
    .update({ quantity })
    .eq('id', id)
}
