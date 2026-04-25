-- Item Catalog Migration
-- Creates item_catalog as single source of truth for inventory items.
-- All existing columns are kept for rollback safety.

-- Step 1: Create item_catalog table
CREATE TABLE IF NOT EXISTS item_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE NOT NULL,
  item_name text UNIQUE NOT NULL,
  category text NOT NULL,
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

-- Step 2: Deduplicate formulary_templates by item_name, pick most complete record,
-- generate SKUs (CS-0001, RX-0001, OTC-0001, SUP-0001, DE-0001, RE-0001)
WITH deduped AS (
  SELECT DISTINCT ON (item_name)
    item_name,
    category,
    COALESCE(is_als, false) AS is_als,
    ndc,
    barcode,
    upc,
    concentration,
    route,
    unit_of_measure,
    supplier,
    units_per_case,
    case_cost,
    unit_cost,
    image_url,
    notes
  FROM formulary_templates
  ORDER BY item_name,
    (
      (CASE WHEN ndc IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN barcode IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN image_url IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN unit_cost IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN concentration IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN ndc IS NOT NULL THEN 1 ELSE 0 END)
    ) DESC
),
numbered AS (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY category
      ORDER BY item_name
    ) AS cat_seq
  FROM deduped
)
INSERT INTO item_catalog (
  sku, item_name, category, is_als, ndc, barcode, upc,
  concentration, route, unit_of_measure, supplier,
  units_per_case, case_cost, unit_cost, image_url, notes
)
SELECT
  CASE category
    WHEN 'CS'     THEN 'CS-'  || LPAD(cat_seq::text, 4, '0')
    WHEN 'Rx'     THEN 'RX-'  || LPAD(cat_seq::text, 4, '0')
    WHEN 'OTC'    THEN 'OTC-' || LPAD(cat_seq::text, 4, '0')
    WHEN 'Supply' THEN 'SUP-' || LPAD(cat_seq::text, 4, '0')
    WHEN 'DE'     THEN 'DE-'  || LPAD(cat_seq::text, 4, '0')
    WHEN 'RE'     THEN 'RE-'  || LPAD(cat_seq::text, 4, '0')
    ELSE UPPER(SUBSTR(category, 1, 3)) || '-' || LPAD(cat_seq::text, 4, '0')
  END AS sku,
  item_name, category, is_als, ndc, barcode, upc,
  concentration, route, unit_of_measure, supplier,
  units_per_case, case_cost, unit_cost, image_url, notes
FROM numbered;

-- Step 3: Add catalog_item_id to formulary_templates
ALTER TABLE formulary_templates ADD COLUMN IF NOT EXISTS catalog_item_id uuid REFERENCES item_catalog(id);

-- Step 4: Backfill formulary_templates
UPDATE formulary_templates ft
SET catalog_item_id = ic.id
FROM item_catalog ic
WHERE ft.item_name = ic.item_name;

-- Step 5: Add catalog_item_id to unit_inventory
ALTER TABLE unit_inventory ADD COLUMN IF NOT EXISTS catalog_item_id uuid REFERENCES item_catalog(id);

-- Step 6: Backfill unit_inventory
UPDATE unit_inventory ui
SET catalog_item_id = ic.id
FROM item_catalog ic
WHERE ui.item_name = ic.item_name;

-- Step 7: Enable RLS + read policy on item_catalog
ALTER TABLE item_catalog ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'item_catalog'
      AND policyname = 'Authenticated users can read item_catalog'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Authenticated users can read item_catalog"
      ON item_catalog FOR SELECT
      TO authenticated
      USING (true)
    $policy$;
  END IF;
END
$$;

-- Step 8: Verify counts
SELECT
  'item_catalog' AS tbl,
  COUNT(*) AS total_rows,
  COUNT(DISTINCT category) AS categories
FROM item_catalog;

SELECT
  'formulary_templates' AS tbl,
  COUNT(*) AS total,
  COUNT(catalog_item_id) AS with_catalog_id,
  COUNT(*) - COUNT(catalog_item_id) AS missing_catalog_id
FROM formulary_templates
UNION ALL
SELECT
  'unit_inventory' AS tbl,
  COUNT(*) AS total,
  COUNT(catalog_item_id) AS with_catalog_id,
  COUNT(*) - COUNT(catalog_item_id) AS missing_catalog_id
FROM unit_inventory;
