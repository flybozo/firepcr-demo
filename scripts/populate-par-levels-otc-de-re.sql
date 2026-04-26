-- Populate par levels for OTC, DE, RE items across all unit types
-- Sources: MSU Master Supply List, SSV Min Par (LALS), REMS EERA, common sense
-- Run date: 2026-04-25

BEGIN;

-- ═══════════════════════════════════════════════════════════
-- HELPER: unit_type_id subqueries used throughout
-- Amb = (SELECT id FROM unit_types WHERE name = 'Ambulance')
-- MU  = (SELECT id FROM unit_types WHERE name = 'Med Unit')
-- R   = (SELECT id FROM unit_types WHERE name = 'REMS')
-- T   = (SELECT id FROM unit_types WHERE name = 'Truck')
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- AMBULANCE — DE (Durable Equipment) — from SSV LALS
-- ═══════════════════════════════════════════════════════════
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name = 'Adult BVM w/ S/M/L Masks' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Adult Defibrillator Electrodes%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Adult Long Spine Board%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Adult/Pediatric/Thigh BP Cuff%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Ambulance Cot%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Ambulance Mounted H/M O2%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Ambulance Mounted Suction%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Ambulance Wall Mounted O2%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Approved Commercial Pelvic%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'EtCO2 Capnography%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'EZ-IO%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Flashlight%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name = 'Glucometer' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Glucometer Test%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Kendrick Extrication%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Mobile UHF%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Monitor/Defibrillator Leads%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Pediatric BVM%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Pediatric Defibrillator%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Pediatric IO%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Portable Mechanical Suction%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Portable Monitor/Defibrillator%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Portable O2 Regulator%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Portable UHF%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name = 'Pulse Oximeter' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Sharps Container%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Spare Monitor/Defibrillator Battery%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Spare Suction%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name = 'Stethoscope' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name = 'Thermometer' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Traction Splint%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');

-- ═══════════════════════════════════════════════════════════
-- AMBULANCE — OTC — from SSV LALS + MSU Master Supply List
-- ═══════════════════════════════════════════════════════════
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name = '3-Way Stopcock' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Acetaminophen Oral Liquid%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Adhesive Tape%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Adult Non-Rebreather%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 48 WHERE item_name ILIKE 'Adult/Pediatric ECG%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Advanced Airway Tube%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Alcohol Swabs' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Antiseptic Hand%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Approved Commercial Tourniquet%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Arm & Leg Splints%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name = 'Arm Board Long' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name = 'Arm Board Short' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Band-Aids%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Bandage Shears%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Bedpan%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name = 'Blankets' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 5  WHERE item_name ILIKE 'Chlorhexidine%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name = 'Cold Packs' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Collapsible Stretcher%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Covered Waste%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'CS Locking%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'CS Tracking%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Disposable CPAP%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'DMS All Risk%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'DOT Emergency%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Emesis%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Filter Needle%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Fire Extinguisher%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'FIRESCOPE%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Glucose Oral%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Handheld Nebulizer%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Head Immobilization%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name = 'Heat Packs' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Infection Control Kit%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Injection Needles 22ga%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Injection Needles 25ga%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name = 'IV Catheter 14ga' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name = 'IV Catheter 16ga' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name = 'IV Catheter 18ga' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name = 'IV Catheter 20ga' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name = 'IV Catheter 22ga' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name = 'IV Catheter 24ga' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'IV Extension Set' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'IV Fluid Pressure%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'IV Start Pack%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Jack and Wheel%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 5  WHERE item_name ILIKE 'Kling/Kerlix%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name = 'Lancets' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Length-Based Pediatric%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Macro-Drip%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Maps%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Micro-Drip%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Monitor ECG%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Mucosal Atomizer%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Nasal Cannula%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Nasopharyngeal%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'NEMSIS%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 50 WHERE item_name ILIKE 'Non-Sterile 4x4%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 40 WHERE item_name ILIKE 'Non-Sterile Gloves%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'OB Kit%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Oropharyngeal%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Padded Soft%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Pediatric O2%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Pediatric Spine%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Petroleum%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Pillows%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Potable Water%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Refusal of EMS%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Rigid C-Collars%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Sandbags%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Sidestream EtCO2%Adult%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Sidestream EtCO2%Pediatric%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Spare Wheel%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Sterile 4x4%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Suction Catheters%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Syringe 50-60%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name = 'Syringes 10mL' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 3  WHERE item_name = 'Syringes 1mL' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name = 'Syringes 3-5mL' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Tonsillar%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Trauma Dressing%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Triage Kit%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Triangular%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Universal Dressings%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name = 'Urinal' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Vial Access%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Water Soluble%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');

-- Ambulance Rx remaining
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name = 'Lidocaine' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name = 'Normal Saline' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name = 'Oxygen' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Ambulance');

-- ═══════════════════════════════════════════════════════════
-- MED UNIT — DE (Durable Equipment)
-- MSU has more clinical equipment than ambulance
-- ═══════════════════════════════════════════════════════════
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'BVM Pediatric%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'EtCO2 Capnography%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'IO Kit%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Long Spine Board%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'O2 Cylinder%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Traction Splint' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');

-- Med Unit Rx remaining
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Disposable Scalpel%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Endotracheal Tubes%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 3  WHERE item_name ILIKE 'i-gel / LMA%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');

-- ═══════════════════════════════════════════════════════════
-- MED UNIT — OTC — from MSU Master Supply List
-- Par levels inferred from MSU spreadsheet and typical wildfire MSU stocking
-- MSU is the main sick call / treatment facility — higher OTC pars than ambulance
-- ═══════════════════════════════════════════════════════════
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name = '2nd Skin Moist Pads' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name = 'Abbreva' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name = 'Ace Wrap 2"' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name = 'Ace Wrap 3"' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name = 'Ace Wrap 4"' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 100 WHERE item_name ILIKE 'Acetaminophen 325%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Adjustable Cervical%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 100 WHERE item_name ILIKE 'Alcohol Prep Pads' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name = 'Aloe Gel' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Anti-Bacterial%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 30 WHERE item_name ILIKE 'Anti-Diarrheal%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Anti-Inflammatory%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Antifungal Cream%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Antifungal Powder%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Antifungal Spray' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 30 WHERE item_name = 'Aspirin' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name = 'Athletic Tape 1"' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name = 'Athletic Tape 2"' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name = 'AZO' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'AZO Test%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Baby Wipes%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Bag-Valve-Mask Adult%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 50 WHERE item_name ILIKE 'Band-Aid 1x3%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Band-Aid Knuckle' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 30 WHERE item_name ILIKE 'Band-Aids 2x3%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 30 WHERE item_name ILIKE 'Band-Aids Blister' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Band-Aids Fingertip' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name = 'Bedpans' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Body Glide%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name = 'Body Lotion' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Bug Spray%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Bug Wipes' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Burn Gel%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Calagel%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 30 WHERE item_name ILIKE 'Cetirizine%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name = 'Chapstick' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name = 'Coban 1"' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name = 'Coban 2"' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name = 'Coban 3"' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name = 'Cold Packs' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Corn/Callus%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 50 WHERE item_name ILIKE 'Cotton Swabs%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 50 WHERE item_name ILIKE 'Cough Drops' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Cough Syrup%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name = 'DayQuil' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Dent-Temp%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Dish Soap%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 30 WHERE item_name ILIKE 'Docusate%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 30 WHERE item_name ILIKE 'Emergen-C' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Emesis Bags' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name = 'Enema' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 50 WHERE item_name ILIKE 'Excedrin%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name = 'Eye Wash 1oz' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Eye Wash 4oz%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Eyedrops (Allergy)' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Eyedrops (lubricating)' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 30 WHERE item_name ILIKE 'Famotidine%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Fexofenadine%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Floss%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Gas Relief' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 50 WHERE item_name ILIKE 'Gauze 2x2 Non%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 50 WHERE item_name ILIKE 'Gauze 4x4 Sterile' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 30 WHERE item_name ILIKE 'Gauze Squares 2x2%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Glucose Tubes' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Gold Bond Blue%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Gold Bond Gold%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Gold Bond Green%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 30 WHERE item_name ILIKE 'H2 Blocker%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Hand Lotion%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Hand Sanitizer%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Hemorrhoid%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Hemostatic%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name = 'Hot Packs' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Hydrocortisone%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 200 WHERE item_name ILIKE 'Ibuprofen%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name = 'IV Catheters 18g' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name = 'IV Catheters 20g' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name = 'IV Catheters 22g' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name = 'IV Catheters 24g' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'IV Extension%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'IV Pressure%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'IV Securement%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'IV Start Kits%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name = 'Laxative' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Lidocaine Cream%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 30 WHERE item_name ILIKE 'Liquid IV' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Loratadine%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'MDI Spacers' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name = 'Metamucil' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name = 'Miconazole' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Moleskin%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Mucinex%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Muscle Gel%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Muscle Pain%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'N-95%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 50 WHERE item_name ILIKE 'Naproxen%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name = 'Narcan' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Nasal Cannulas%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Nasal Decongestant%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Nasal Saline (Bottles)' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Nasal Saline Spray' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Nasopharyngeal%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Nebulizer Kits%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name = 'New Skin' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Non-Rebreather%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name = 'NyQuil' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Oragel%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Oropharyngeal%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name = 'Pads' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Patient Blankets' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 30 WHERE item_name = 'Pepto' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Phenylephrine%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Poison Oak%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Post Contact%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'PPE%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Pre Contact%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Pregnancy%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Pressure/Trauma%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Primary IV%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Rigid Splints%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'SAM Splints%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name = 'Second Skin' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Sinus Rinse' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Sling & Swathe%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 50 WHERE item_name ILIKE 'Sore Throat%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Splinter Out' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Staple Remover' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Steri-Strips%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Sting Relief%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 30 WHERE item_name = 'Stool Softener' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Suncreen%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name = 'Tampons' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name = 'Tecnu' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Theraflu Day' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Theraflu Night' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Tissue%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Toe Caps%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 50 WHERE item_name ILIKE 'Tongue Depressors' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name = 'Toothbrushes' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Triage Tags' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Triangular Bandages%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 50 WHERE item_name ILIKE 'Triple Antibiotic%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name = 'Tweezers' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name = 'Urinals' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Wax Removal%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Wound Irrigation%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Yankauer%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Zicam%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Zinc Oxide%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'Med Unit');

-- ═══════════════════════════════════════════════════════════
-- REMS — DE (Durable Equipment) — from EERA requirements
-- Each REMS unit = 1 of each major piece unless otherwise specified
-- ═══════════════════════════════════════════════════════════
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'AED or monitor%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'ALS Cardiac%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Backboard%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Boots%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name = 'BP Cuff' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Compact pelvic%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Compact traction%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'DL/VL handle%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Drug box%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Eye protection (ANSI%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Fire shelter%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Flame resistant%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Gloves — heavy%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'GPS Device' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Handheld suction%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Hard hat%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Headlamp%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Hearing protection' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'O2 cylinder%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'O2 regulator%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Penlight%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Pocket BVM' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Portable generator%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name = 'Stethoscope' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name = 'Thermometer' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Vacuum mattress' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');

-- ═══════════════════════════════════════════════════════════
-- REMS — RE (Rescue Equipment) — from EERA spec
-- These are defined precisely in the REMS EERA
-- ═══════════════════════════════════════════════════════════
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE '20%Long webbing%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE '4x4 vehicle%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Basic toolbox%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 12 WHERE item_name = 'Carabiners' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 3  WHERE item_name ILIKE 'Class II or III harness%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Class II victim%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Collapsible basket%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Combination extrication%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Cribbing%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 3  WHERE item_name ILIKE 'Descent control%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Edge protection%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Fire portable radio%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Gathering plate%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Hand tools' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'High efficiency%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'High lift jack' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Line gear%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Litter wheel%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Pickets%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Prusik%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Reciprocating%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Roll-up rescue%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Rope 9.5%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 3  WHERE item_name ILIKE 'Rope rescue gear%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Set of fours%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name = 'Sledgehammer' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Sleeping bag%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Small/mini prusik minding double%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Small/mini prusik minding pulley' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Tow straps%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'UTV with patient%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Various sizes webbing%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');

-- ═══════════════════════════════════════════════════════════
-- REMS — OTC — field-deployable quantities (smaller than MSU)
-- REMS carries a subset — lighter/portable for technical rescue
-- ═══════════════════════════════════════════════════════════
-- Using ~50% of MSU pars for OTC consumables, 1-2 for equipment items
-- Bulk update approach: set reasonable defaults by pattern

-- Clinical consumables (airway, IV, monitoring)
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE '10-15 drop IV%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name = '2nd Skin Moist Pads' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE '3cc and 5cc%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 30 WHERE item_name = '4x4 gauze' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE '5cc Saline flush%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name = 'Abbreva' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name = 'Ace Wrap 2"' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name = 'Ace Wrap 4"' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 50 WHERE item_name ILIKE 'Acetamenophine%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Alcohol pads' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 50 WHERE item_name = 'Alcohol Prep Pads' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name = 'Aloe Gel' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name = 'Angiocaths' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Anti-Diarrheal%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Antifungal Cream%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Antifungal Powder%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name = 'Antifungal Spray' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Assorted non-filter%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Athletic elastic%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Athletic tape' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name = 'Athletic Tape 1"' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name = 'AZO' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Baby Wipes%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 30 WHERE item_name ILIKE 'Band-Aid 1x3%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Band-Aid Knuckle' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Biohazard%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Blood glucose testing%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Body Glide%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name = 'Body Lotion' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name = 'Bougie' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Bug Spray%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name = 'Bug Wipes' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Burn sheet%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Calagel%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Cetirizine%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name = 'Chapstick' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Chest decompression%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Chest seals' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name = 'Coban 1"' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name = 'Coban 2"' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name = 'Cold Packs' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Cotton Swabs%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 30 WHERE item_name = 'Cough Drops' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Cricothyrotomy%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'CS Tracking%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name = 'DayQuil' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Dish Soap%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
-- Fix: use non-join approach for DL/VL OTC
UPDATE formulary_templates SET default_par_qty = 1 WHERE item_name ILIKE 'DL/VL handle%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS') AND default_par_qty = 0;
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Docusate%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Ear protection' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Elastic tape' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name = 'Emergen-C' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Emesis bag' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name = 'Enema' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'ETT 6%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 30 WHERE item_name ILIKE 'Excedrin%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Extra batteries%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Eye irrigation%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Eye protection' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS') AND default_par_qty = 0;
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name = 'Eye Wash 1oz' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Eyedrops (Allergy)' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Eyedrops (lubricating)' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Famotidine%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Fexofenadine%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Filter needle' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS') AND default_par_qty = 0;
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name = 'Flagging' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Flexible suction%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Floss%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name = 'Gas Relief' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 30 WHERE item_name ILIKE 'Gauze 2x2%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 30 WHERE item_name ILIKE 'Gauze 4x4%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'Gloves (sized%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name = 'Glucose Tubes' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Gold Bond Blue%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Gold Bond Gold%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Gold Bond Green%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name ILIKE 'H2 Blocker%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Hand Lotion%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Hand Sanitizer%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Hemorrhoid%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Hemostatic wound%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name = 'Hot Packs' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Hydrocortisone%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 100 WHERE item_name ILIKE 'Ibuprofen%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'IV Fluids 500cc%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'IV pigtail%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'IV Tape%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'IV tourniquet' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name = 'Laxative' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Lidocaine Cream%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name = 'Liquid IV' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Loratadine%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Marker panel' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'McGill%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name = 'Metamucil' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name = 'Miconazole' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Moleskin%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Mucosal Atomizer%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Muscle Gel%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Muscle Pain%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Mylar%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'N-95%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 30 WHERE item_name ILIKE 'Naproxen%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name = 'Narcan' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Nasal Decongestant%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Nasal Saline (Bottles)' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Nasal Saline Spray' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name = 'New Skin' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'NPA 30%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name = 'NyQuil' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'O2 therapy%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Occlusive%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'OPA 50%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Oragel%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name = 'Pads' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'PEEP Valve' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name = 'Pepto' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Phenylephrine%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Pliable patient%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Poison Oak%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Post Contact%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Pre Contact%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Pregnancy%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Ring cutter' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Rolled gauze%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name = 'Second Skin' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Semi-rigid splints%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Sharps container%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Sinus Rinse' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Splinter Out' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'SpO2 monitor%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Sting Relief%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name = 'Stool Softener' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Stylet adult' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Suncreen%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name = 'Tampons' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name = 'Tecnu' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name = 'Theraflu Day' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name = 'Theraflu Night' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Tissue%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name = 'Toothbrushes' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Tourniquet' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS') AND default_par_qty = 0;
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Trauma combine%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Trauma dressing (10%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Trauma Dressing (additional)' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name ILIKE 'Trauma shears' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Triangle bandage' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 30 WHERE item_name ILIKE 'Triple Antibiotic%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Tube holder' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 2  WHERE item_name = 'Tweezers' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 10 WHERE item_name ILIKE 'Zicam%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');

-- ═══════════════════════════════════════════════════════════
-- REMS — Remaining Rx items
-- ═══════════════════════════════════════════════════════════
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name = 'Alcohol swabs' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 20 WHERE item_name = 'Amoxicillin' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Controlled Substances Locking%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 1  WHERE item_name ILIKE 'Drug reference%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Filter needles%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name = 'IV Fluid 1 liter' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 6  WHERE item_name ILIKE 'Needles assorted%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');
UPDATE formulary_templates SET default_par_qty = 4  WHERE item_name ILIKE 'Syringes (1mL%' AND unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS');

-- ═══════════════════════════════════════════════════════════
-- TRUCK — DE + RE — same as REMS (Truck carries same EERA kit)
-- ═══════════════════════════════════════════════════════════
-- Copy REMS DE pars to Truck
UPDATE formulary_templates ft_truck
SET default_par_qty = ft_rems.default_par_qty
FROM formulary_templates ft_rems
WHERE ft_truck.item_name = ft_rems.item_name
  AND ft_truck.unit_type_id = (SELECT id FROM unit_types WHERE name = 'Truck')
  AND ft_rems.unit_type_id = (SELECT id FROM unit_types WHERE name = 'REMS')
  AND ft_truck.default_par_qty = 0
  AND ft_rems.default_par_qty > 0;

-- Copy REMS RE pars to Truck
-- (Already covered by the above since item_names match)

COMMIT;
