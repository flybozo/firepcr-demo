# Task: Item Catalog Migration

## Goal
Add a master `item_catalog` table as the single source of truth for all inventory items. Deduplicate the current `formulary_templates` table (1215 rows → ~496 unique items) so item metadata lives in one place and formulary_templates becomes a thin join table linking catalog items to unit types with par quantities.

Auto-generate SKU codes for every catalog item: `CS-0001`, `RX-0042`, `OTC-0105`, `SUP-0200`, `DE-0001`, `RE-0001` (prefixed by category, zero-padded 4 digits, sequential within category).

## Current Schema

### formulary_templates (1215 rows, ~496 unique item_names)
```
id uuid PK DEFAULT gen_random_uuid()
unit_type_id uuid FK → unit_types(id)
item_name text NOT NULL
category text NOT NULL          -- CS, Rx, OTC, Supply, DE, RE
default_par_qty numeric DEFAULT 0
unit_of_measure text
ndc text
notes text
created_at timestamptz DEFAULT now()
barcode text
upc text
supplier text
units_per_case numeric
case_cost numeric
concentration text
route text
is_als boolean DEFAULT false
image_url text
unit_cost numeric
```

### unit_inventory (1748 rows)
```
id uuid PK DEFAULT gen_random_uuid()
incident_unit_id uuid FK
item_name text NOT NULL
category text NOT NULL
lot_number text
expiration_date date
quantity numeric DEFAULT 0
par_qty numeric DEFAULT 0
unit_of_measure text
ndc text
updated_at timestamptz DEFAULT now()
barcode text
upc text
cs_lot_number text
cs_expiration_date date
unit_id uuid FK → units(id)
is_als boolean DEFAULT false
```

### unit_types
```
31c914e4-998b-48ba-834c-c2c78ccbbfc0 | Ambulance
30ca32c3-3006-4ba4-97c6-692930a84963 | Med Unit
b107fd4a-8bb7-4653-a44d-50470f4dabcd | REMS
a1b2c3d4-e5f6-7890-abcd-ef1234567890 | Truck
ea04c5ae-7b8f-491b-bb94-46623a4e30ce | Warehouse
```

### Template counts per unit type
- Ambulance: 174
- Med Unit: 195
- REMS: 269
- Truck: 58
- Warehouse: 519 (currently a union of all other types — should become its own proper formulary)

## Target Schema

### NEW: item_catalog (~496 rows)
```sql
CREATE TABLE item_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE NOT NULL,           -- e.g. 'RX-0042'
  item_name text UNIQUE NOT NULL,
  category text NOT NULL,             -- CS, Rx, OTC, Supply, DE, RE
  is_als boolean DEFAULT false,
  ndc text,
  barcode text,
  upc text,
  concentration text,
  route text,
  unit_of_measure text,
  supplier text,
  units_per_case numeric,
  case_cost numeric,
  unit_cost numeric,
  image_url text,
  notes text,
  created_at timestamptz DEFAULT now()
);
```

### MODIFIED: formulary_templates (slim join table)
```sql
-- Add column:
ALTER TABLE formulary_templates ADD COLUMN catalog_item_id uuid REFERENCES item_catalog(id);

-- After backfill, the table effectively becomes:
-- id, catalog_item_id (FK), unit_type_id (FK), default_par_qty
-- Old columns (item_name, category, is_als, ndc, etc.) kept temporarily for rollback safety
-- but all app queries should join through catalog_item_id
```

### MODIFIED: unit_inventory
```sql
-- Add column:
ALTER TABLE unit_inventory ADD COLUMN catalog_item_id uuid REFERENCES item_catalog(id);

-- After backfill, queries join to item_catalog for display info
-- Old item_name/category columns kept for rollback safety
```

## Migration Steps (run via psql — NOT through the app)

1. Create `item_catalog` table
2. Deduplicate formulary_templates by item_name → insert unique items into item_catalog
   - For items that appear in multiple unit types with different metadata (e.g., different ndc), pick the most complete record
   - Generate SKU codes: CS-0001..CS-0006, RX-0001..RX-0103, OTC-0001..OTC-0297, SUP-0001..., DE-0001..DE-0061, RE-0001..RE-0032
3. Add `catalog_item_id` to formulary_templates, backfill by matching item_name
4. Add `catalog_item_id` to unit_inventory, backfill by matching item_name
5. Add RLS policies on item_catalog (same pattern as formulary_templates — authenticated read)
6. Verify: every formulary_templates row has a non-null catalog_item_id
7. Verify: every unit_inventory row has a non-null catalog_item_id

## App Changes Required

### Files that reference formulary_templates or item_name from templates:
(All in src/)

**Core data loading:**
- lib/syncManager.ts — caches formulary + inventory for offline
- lib/offlineFirst.ts — offline data loading helpers
- lib/offlineStore.ts — IndexedDB schema (may need 'item_catalog' store)

**Inventory pages:**
- pages/inventory/InventoryList.tsx — THE BIG ONE. Merge logic joins formulary × units → inventory rows. Must join through catalog now.
- pages/inventory/InventoryDetail.tsx — shows formulary template detail with inventory overlay
- pages/inventory/InventoryAdd.tsx — add inventory item form
- pages/inventory/Reorder.tsx — reorder report
- pages/inventory/BurnRate.tsx — burn rate calculations

**Formulary pages:**
- pages/formulary/Formulary.tsx — formulary list by unit type
- pages/formulary/FormularyDetail.tsx — formulary item detail + photo upload + edit

**CS (Controlled Substances):**
- pages/cs/CSList.tsx — CS inventory list
- pages/cs/CSOverview.tsx — CS overview dashboard
- pages/cs/CSCount.tsx — CS count form
- pages/cs/CSItemDetail.tsx — CS item detail
- pages/cs/CSTransfer.tsx — CS transfer between units
- lib/services/cs.ts — CS query functions

**MAR (Medication Administration):**
- pages/mar/useMARForm.ts — MAR form (medication dropdowns from inventory/formulary)
- pages/mar/MARDetail.tsx — MAR entry detail
- pages/mar/components/MedicationSection.tsx — medication section in MAR form
- lib/services/mar.ts — MAR query functions

**Supply Runs:**
- pages/supply-runs/NewSupplyRun.tsx — new supply run form (item picker from formulary)
- pages/supply-runs/SupplyRunDetail.tsx — supply run detail

**Other:**
- pages/units/components/useUnitDetail.ts — unit detail (inventory tab)
- pages/units/NewUnit.tsx — new unit form
- pages/dashboard/MyUnit.tsx — field user dashboard
- pages/admin/Admin.tsx — admin settings
- pages/analytics/components/OperationsTab.tsx — operations analytics
- pages/fire-admin/FireAdminDashboard.tsx — external dashboard
- pages/billing/Billing.tsx — billing page
- pages/unsigned-items/UnsignedItems.tsx — unsigned items list
- hooks/useBarcodeScan.ts — barcode scanner
- hooks/useIncidentData.ts — incident data loading
- lib/generateOpsReportPdf.ts — PDF generation
- lib/services/encounters.ts, incidents.ts, supplyRuns.ts

**API routes (Vercel serverless):**
- api/ directory — check for any that query formulary_templates directly

## Key Principles

1. **Non-breaking migration** — old columns stay, new catalog_item_id added alongside. If something breaks, the old columns are still there.
2. **All display info comes from item_catalog** — item_name, category, is_als, ndc, image_url, etc. are read from the catalog, not from formulary_templates or unit_inventory.
3. **formulary_templates is just a join** — (catalog_item_id, unit_type_id, default_par_qty). That's the core purpose now.
4. **unit_inventory references catalog** — catalog_item_id replaces item_name as the canonical link.
5. **Offline cache must include item_catalog** — add to syncManager + offlineStore.
6. **The merge logic in InventoryList.tsx** must work with the new schema — iterate catalog items per unit type (via formulary_templates), match to inventory rows by catalog_item_id + unit_id.
7. **Warehouse** — should get its own proper formulary entries rather than being a superset hack. During migration, create proper formulary_templates for Warehouse unit type from the existing 519 rows.
8. **SKU field** — displayed in inventory lists, detail pages, and available for barcode scanning. Add a SKU column to inventory table views.

## Database Connection
- **Prod:** `postgresql://postgres:93RV8nx4J^VGR!6V@db.kfkpvazkikpuwatthtow.supabase.co:5432/postgres`
- **Supabase project:** kfkpvazkikpuwatthtow

## Testing Checklist
After all changes, verify:
- [ ] `npx tsc --noEmit` passes (zero type errors)
- [ ] Inventory page loads and shows all items for all units
- [ ] Formulary page loads and shows items per unit type tab
- [ ] CS list loads with correct items
- [ ] MAR form medication dropdown populates correctly
- [ ] Supply run item picker works
- [ ] Unit detail inventory tab works
- [ ] Inventory detail page works (template + overlay)
- [ ] Formulary detail page works (edit + photo upload)
- [ ] SKU codes appear in inventory/formulary lists
- [ ] Offline cache includes item_catalog data
- [ ] Admin dashboard still loads

## DO NOT
- Do not drop any existing columns (keep for rollback)
- Do not break the offline-first pattern (online-first, cache fallback)
- Do not change the URL structure or routing
- Do not modify the service worker version (we'll bump that separately)
- Do not touch the demo database — prod only
