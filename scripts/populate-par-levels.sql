-- Populate formulary_templates.default_par_qty from spreadsheet par levels
-- Sources: MSU Master Supply List, SSV Min Par (LALS), REMS-MST Drug Box Par
-- Run date: 2026-04-25

BEGIN;

-- ═══════════════════════════════════════════════════════════
-- MED UNIT par levels (from MSU Master Supply List)
-- Par Level MSU-1 column used (MSU-1 = MSU-2 pars are identical)
-- ═══════════════════════════════════════════════════════════

-- CS items
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name = 'Morphine' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name = 'Fentanyl' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name = 'Ketamine' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Midazolam%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');

-- Rx items (from MSU Master Supply List MED-001 through MED-022)
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Epinephrine 1:1000%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Epinephrine 1:10000%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Naloxone%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Ondansetron%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Diphenhydramine%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Adenosine%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Amiodarone%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Atropine%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Dextrose 50%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Calcium%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Sodium Bicarbonate%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'TXA%' OR (item_name ILIKE 'Tranexamic%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit'));
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Albuterol%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Glucagon%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Lidocaine 2%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 12 WHERE item_name ILIKE 'Normal Saline 1%L%' OR (item_name = 'Normal Saline 1L' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit'));
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Normal Saline 250%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 12 WHERE item_name ILIKE 'Lactated Ringer%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Ketorolac%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 3  WHERE item_name ILIKE 'Lidocaine 1% Injectable%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Dexamethasone 10mg%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Dexamethasone 4mg%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 3  WHERE item_name ILIKE 'Heparin%' OR (item_name ILIKE '%Saline Flush%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit'));
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Suture%Pack%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Suture Tray%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Skin Staple%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Tissue Adhesive%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Amoxicillin' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 28 WHERE item_name ILIKE 'Cephalex%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Doxycycline%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Ear Anesthetic%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');

-- ═══════════════════════════════════════════════════════════
-- AMBULANCE par levels (from SSV Min Par LALS + MSU Master Supply List)
-- Using LALS Transport column as base
-- ═══════════════════════════════════════════════════════════

-- CS items (SSV: Fentanyl 400mcg min = 4 vials of 100mcg, Midazolam 20mg min = 4 vials of 5mg)
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name = 'Fentanyl' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Midazolam%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Morphine%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name = 'Ketamine' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');

-- Rx items (from SSV LALS medications section)
UPDATE formulary_templates SET default_par_qty = 5  WHERE item_name ILIKE 'Epinephrine 1:1000%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 8  WHERE item_name ILIKE 'Epinephrine 1:10000%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Epinephrine Auto%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Naloxone%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Albuterol%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Atropine%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 3  WHERE item_name ILIKE 'Dextrose 10%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Dextrose 25%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Dextrose 50%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Dextrose 5%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Glucagon%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Lidocaine 2%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Nitroglycerin%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Sodium Bicarbonate%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Normal Saline 1000%' OR (item_name ILIKE 'Normal Saline 1L%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance'));
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Normal Saline 250%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Ondansetron%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Diphenhydramine%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Adenosine%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Amiodarone%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Calcium%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Oral Glucose%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 30 WHERE item_name ILIKE 'Aspirin%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Activated Charcoal%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Dopamine%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Magnesium%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Pralidoxime%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Mark I%' OR (item_name ILIKE 'DuoDote%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance'));
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Lactated Ringer%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 3  WHERE item_name ILIKE 'i-gel%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Sterile Irrigation%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');

-- ═══════════════════════════════════════════════════════════
-- REMS par levels (from REMS-MST Drug Box Par sheet)
-- ═══════════════════════════════════════════════════════════

-- CS items (drug box par: Fentanyl 400mcg=4 vials, Midazolam 20mg=4 vials, Morphine 20mg=2 vials, Ketamine 500mg=1 vial)
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name = 'Fentanyl' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Midazolam%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Morphine%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name = 'Ketamine' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');

-- Rx items (from REMS-MST Drug Box Par)
UPDATE formulary_templates SET default_par_qty = 5  WHERE item_name ILIKE 'Epinephrine 1:1000%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Epinephrine 1:10000%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Naloxone%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Ondansetron%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Diphenhydramine%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Albuterol%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Atropine%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Amiodarone%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Adenosine%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Sodium Bicarbonate%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Lidocaine 2%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Calcium%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Magnesium%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Dextrose 10%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Glucagon%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Oral Glucose%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 8  WHERE item_name ILIKE 'Aspirin%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Activated Charcoal%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Nitroglycerin%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Normal Saline 1%L%' OR (item_name = 'Normal Saline 1L' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS'));
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Normal Saline 1000%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Normal Saline 250%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Lactated Ringer%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 3  WHERE item_name ILIKE 'Lidocaine 1% (plain)%' OR (item_name ILIKE 'Lidocaine 1% Injectable%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS'));
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Lidocaine 1% with%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Ketorolac%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Succinylcholine%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Rocuronium%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Amoxicillin%Clavulanate%' OR (item_name ILIKE 'Augmentin%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS'));
UPDATE formulary_templates SET default_par_qty = 28 WHERE item_name ILIKE 'Cephalex%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Doxycycline%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'TMP-SMX%' OR (item_name ILIKE 'Bactrim%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS'));
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Dexamethasone 10mg%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Dexamethasone 4mg%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');

COMMIT;
