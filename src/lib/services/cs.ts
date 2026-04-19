/**
 * Controlled Substances service — queries and mutations for CS inventory,
 * transactions, daily counts, transfers, and receipts.
 */
import { createClient } from '@/lib/supabase/client'

// ── Queries ──────────────────────────────────────────────────────────────────

/** Get units (active, non-storage) */
export function queryActiveUnits() {
  return createClient()
    .from('units')
    .select('id, name')
    .eq('active', true)
    .eq('is_storage', false)
    .order('name')
}

/** Get all units (including storage) */
export function queryAllUnits() {
  return createClient()
    .from('units')
    .select('id, name')
    .eq('active', true)
    .order('name')
}

/** Get active employees */
export function queryActiveEmployees() {
  return createClient()
    .from('employees')
    .select('id, name')
    .eq('status', 'Active')
    .order('name')
}

/** Get clinical staff */
export function queryClinicalEmployees(roles: string[]) {
  return createClient()
    .from('employees')
    .select('id, name, role')
    .eq('status', 'Active')
    .in('role', roles)
    .order('name')
}

/** Get incident_units for a unit (for linking inventory to incidents) */
export function queryIncidentUnitsForUnit(unitName: string) {
  return createClient()
    .from('incident_units')
    .select('id, name')
}

/** Get unit inventory items */
export function queryUnitInventory(unitId: string, category?: string) {
  let q = createClient()
    .from('unit_inventory')
    .select('*')
    .eq('unit_id', unitId)
  if (category) q = q.eq('category', category)
  return q.order('item_name')
}

/** Get CS item detail with MAR history */
export function queryCSItemWithHistory(itemId: string) {
  return createClient()
    .from('unit_inventory')
    .select('*, unit:units(id, name)')
    .eq('id', itemId)
    .single()
}

/** Get MAR entries for a specific drug on a unit */
export function queryMARForDrug(drugName: string, unitName: string) {
  return createClient()
    .from('dispense_admin_log')
    .select('id, drug_name, dose, route, employee_name, administered_at, is_voided, qty_used, lot_number')
    .eq('drug_name', drugName)
    .eq('unit', unitName)
    .order('administered_at', { ascending: false })
}

/** Get warehouse inventory for a drug */
export function queryWarehouseInventory(drugName: string, lotNumber?: string) {
  let q = createClient()
    .from('warehouse_inventory')
    .select('*')
    .eq('item_name', drugName)
  if (lotNumber) q = q.eq('lot_number', lotNumber)
  return q.maybeSingle()
}

/** Get existing unit inventory for a drug */
export function queryExistingUnitInventory(unitId: string, drugName: string, lotNumber?: string) {
  let q = createClient()
    .from('unit_inventory')
    .select('*')
    .eq('unit_id', unitId)
    .eq('item_name', drugName)
  if (lotNumber) q = q.eq('lot_number', lotNumber)
  return q.maybeSingle()
}

// ── Mutations ────────────────────────────────────────────────────────────────

/** Update unit inventory quantity */
export function updateInventoryQty(id: string, quantity: number) {
  return createClient()
    .from('unit_inventory')
    .update({ quantity })
    .eq('id', id)
}

/** Update warehouse inventory quantity */
export function updateWarehouseQty(id: string, quantity: number) {
  return createClient()
    .from('warehouse_inventory')
    .update({ quantity })
    .eq('id', id)
}

/** Insert a CS transaction */
export function insertCSTransaction(data: Record<string, unknown>) {
  return createClient()
    .from('cs_transactions')
    .insert(data)
}

/** Insert a daily count record */
export function insertDailyCount(data: Record<string, unknown>) {
  return createClient()
    .from('cs_daily_counts')
    .insert(data)
}

/** Insert a CS receipt */
export function insertCSReceipt(data: Record<string, unknown>) {
  return createClient()
    .from('cs_receipts')
    .insert(data)
}

/** Insert warehouse inventory */
export function insertWarehouseInventory(data: Record<string, unknown>) {
  return createClient()
    .from('warehouse_inventory')
    .insert(data)
}

/** Insert unit inventory */
export function insertUnitInventory(data: Record<string, unknown>) {
  return createClient()
    .from('unit_inventory')
    .insert(data)
}

/** Get incident_unit ID for linking transfers */
export async function getIncidentUnitId(unitId: string) {
  const { data } = await createClient()
    .from('incident_units')
    .select('id')
    .eq('unit_id', unitId)
    .is('released_at', null)
    .limit(1)
    .maybeSingle()
  return data?.id || null
}
