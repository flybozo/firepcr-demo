/**
 * Supply Runs service — queries and mutations.
 */
import { createClient } from '@/lib/supabase/client'

// ── Queries ──────────────────────────────────────────────────────────────────

/** Get a single supply run with items */
export function querySupplyRun(id: string) {
  return createClient()
    .from('supply_runs')
    .select('*, supply_run_items(*)')
    .eq('id', id)
    .single()
}

/** Get supply runs for an incident */
export function querySupplyRunsByIncident(incidentId: string) {
  return createClient()
    .from('supply_runs')
    .select(`
      id,
      run_date,
      time,
      resource_number,
      dispensed_by,
      notes,
      created_at,
      incident_id,
      incident:incidents(name),
      incident_unit:incident_units(unit:units(name)),
      supply_run_items(id)
    `)
    .eq('incident_id', incidentId)
    .order('created_at', { ascending: false })
}

/** Get unit inventory for supply run item selection (OTC/Supply only) */
export function querySupplyInventory(unitName: string) {
  return createClient()
    .from('unit_inventory')
    .select('id, item_name, quantity, category, catalog_item_id')
    .eq('unit_name', unitName)
    .in('category', ['OTC', 'Supply'])
    .gt('quantity', 0)
    .order('item_name')
}

// ── Mutations ────────────────────────────────────────────────────────────────

/** Create a supply run */
export function insertSupplyRun(data: Record<string, unknown>) {
  return createClient()
    .from('supply_runs')
    .insert(data)
    .select('id')
    .single()
}

/** Insert supply run items */
export function insertSupplyRunItems(items: Record<string, unknown>[]) {
  return createClient()
    .from('supply_run_items')
    .insert(items)
}

/** Update supply run */
export function updateSupplyRun(id: string, data: Record<string, unknown>) {
  return createClient()
    .from('supply_runs')
    .update(data)
    .eq('id', id)
}

/** Delete supply run item */
export function deleteSupplyRunItem(id: string) {
  return createClient()
    .from('supply_run_items')
    .delete()
    .eq('id', id)
}

/** Update inventory quantity after supply run */
export function updateInventoryQty(id: string, quantity: number) {
  return createClient()
    .from('unit_inventory')
    .update({ quantity })
    .eq('id', id)
}
