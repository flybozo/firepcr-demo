# Payroll System Migration Plan

**Date:** 2026-04-19
**Status:** DRAFT — Awaiting bookkeeper input on pay schedule
**Author:** AI Assistant

---

## Problem

Current payroll is a single text report generated only at incident closeout. This doesn't support:
- Interim pay runs during long incidents (fires can run weeks/months)
- Individual demobilization payroll (crew leaves before incident closes)
- California overtime compliance (daily OT after 8h, double time after 12h)
- Configurable pay frequencies
- CSV export for bookkeeper

---

## California Overtime Law (Labor Code §510)

Daily overtime calculation:
| Hours | Rate | Multiplier |
|-------|------|-----------|
| 1–8 | Regular | 1.0x |
| 9–12 | Overtime | 1.5x |
| 13+ | Double Time | 2.0x |

### 16-Hour Day Calculation

For a standard 16-hour operational day:
- 8 regular hours × 1.0 = 8.0 pay-equivalent hours
- 4 OT hours × 1.5 = 6.0 pay-equivalent hours
- 4 DT hours × 2.0 = 8.0 pay-equivalent hours
- **Total: 22.0 pay-equivalent hours**

**Formula:** `base_hourly_rate = daily_rate ÷ 22.0`

**Example:** $1,800/day → $81.82/hr base rate
- 8h × $81.82 = $654.55 (regular)
- 4h × $122.73 = $490.91 (1.5x OT)
- 4h × $163.64 = $654.55 (2.0x DT)
- **Total = $1,800.01** ✅

The current app displays hourly as `daily_rate ÷ 16 = $112.50` which is NOT CA-compliant for paystubs.

---

## Decisions Needed From Bookkeeper

1. **Pay frequency:** Semi-monthly (e.g. 1st & 15th) or biweekly (every other Friday)?
2. **Pay dates:** What are the specific pay days?
3. **Pay period boundaries:** If semi-monthly, does the period run 1st–15th and 16th–end of month?
4. **Travel days:** Currently billed as full days — confirm this is correct for payroll
5. **CSV format:** What fields does the bookkeeper need? What payroll system (if any) does she import into?
6. **Approval flow:** Does someone (Aaron? Rodney?) need to approve payroll before export?
7. **Retro adjustments:** How to handle corrections to prior periods?

---

## Proposed Database Schema

### `payroll_configs` (org-level settings)
```sql
CREATE TABLE payroll_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  pay_frequency TEXT NOT NULL DEFAULT 'semimonthly',
    -- 'semimonthly' | 'biweekly' | 'weekly' | 'monthly'
  pay_day_1 INT,          -- For semimonthly: day of month (e.g. 1)
  pay_day_2 INT,          -- For semimonthly: day of month (e.g. 15)
  pay_day_of_week TEXT,    -- For biweekly: 'monday'–'friday'
  standard_hours_per_day INT NOT NULL DEFAULT 16,
  ot_threshold_daily INT NOT NULL DEFAULT 8,   -- CA: OT after 8h
  dt_threshold_daily INT NOT NULL DEFAULT 12,  -- CA: DT after 12h
  ot_multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.50,
  dt_multiplier NUMERIC(3,2) NOT NULL DEFAULT 2.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `payroll_runs` (each pay period run)
```sql
CREATE TABLE payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES incidents(id),  -- NULL for cross-incident runs
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  run_date TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'draft',
    -- 'draft' | 'approved' | 'exported' | 'paid'
  run_type TEXT NOT NULL DEFAULT 'scheduled',
    -- 'scheduled' | 'demob' | 'closeout' | 'manual'
  total_gross NUMERIC(12,2) DEFAULT 0,
  total_regular_hours NUMERIC(8,2) DEFAULT 0,
  total_ot_hours NUMERIC(8,2) DEFAULT 0,
  total_dt_hours NUMERIC(8,2) DEFAULT 0,
  employee_count INT DEFAULT 0,
  csv_url TEXT,            -- Signed URL to exported CSV in storage
  created_by TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `payroll_line_items` (per employee per run)
```sql
CREATE TABLE payroll_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  deployment_id UUID REFERENCES deployments(id),  -- NULL if manual
  incident_id UUID REFERENCES incidents(id),
  days_worked NUMERIC(5,2) NOT NULL DEFAULT 0,
  regular_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  ot_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  dt_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  base_hourly_rate NUMERIC(10,2) NOT NULL,  -- Back-calculated from daily rate
  daily_rate NUMERIC(10,2) NOT NULL,        -- Rate in effect at time of run
  regular_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  ot_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  dt_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  gross_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_payroll_items_run ON payroll_line_items(payroll_run_id);
CREATE INDEX idx_payroll_items_employee ON payroll_line_items(employee_id);
CREATE INDEX idx_payroll_items_incident ON payroll_line_items(incident_id);
```

---

## Payroll Calculation Logic

### Base Hourly Rate Formula
```
equivalent_hours = (ot_threshold × 1.0) 
                 + ((dt_threshold - ot_threshold) × ot_multiplier)
                 + ((hours_per_day - dt_threshold) × dt_multiplier)

-- For 16h day with CA rules:
-- = (8 × 1.0) + ((12-8) × 1.5) + ((16-12) × 2.0)
-- = 8 + 6 + 8 = 22.0

base_hourly_rate = daily_rate / equivalent_hours
```

### Per-Day Pay Breakdown
```
regular_pay = base_hourly_rate × min(hours_worked, ot_threshold)
ot_pay = base_hourly_rate × ot_multiplier × max(0, min(hours_worked, dt_threshold) - ot_threshold)
dt_pay = base_hourly_rate × dt_multiplier × max(0, hours_worked - dt_threshold)
gross_pay = regular_pay + ot_pay + dt_pay
```

### Per-Period Aggregation
Sum all days in the period for each employee. Each day is calculated independently per CA daily OT rules.

---

## Payroll Run Types

### 1. Scheduled (Interim)
- Auto-generated on pay period boundaries
- Covers all active deployments during the period
- Status: draft → admin reviews → approved → exported

### 2. Demob (Individual)
- Triggered when a crew member's deployment ends mid-period
- Covers hours from last pay period end to demob date
- Included in next scheduled run (or standalone if preferred)

### 3. Closeout (Final)
- Triggered on incident close
- Covers any remaining unbilled time since last scheduled run
- Replaces current text report in incident notes

### 4. Manual
- Admin creates ad hoc for corrections, retro adjustments

---

## App Changes Required

### Pay Rates Page
- Admin enters **daily rate** (unchanged)
- Display adds CA-compliant breakdown:
  - Base hourly rate (daily ÷ equivalent hours)
  - "8h @ $X + 4h @ $Y (1.5x) + 4h @ $Z (2.0x) = $daily_rate"
- Add payroll config section (frequency, pay days)

### New: Payroll Runs Page (Admin)
- List of all payroll runs with status badges
- Click to view line items
- Actions: Approve, Export CSV, Mark Paid
- Create manual run

### New: Payroll Run Detail
- Table of line items per employee
- Days, hours breakdown (regular/OT/DT), pay breakdown
- Total summary
- CSV download button

### MyPayroll Page (Field Users)
- Show pay history by period
- Each row: period dates, days worked, hours breakdown, gross pay
- Current period (pending) shown separately

### Payroll Page (Admin)
- Overview dashboard: current period stats, upcoming runs
- Quick access to approve/export

### Incident Closeout
- Replace text report with proper payroll run creation
- Link to the generated payroll run

---

## CSV Export Format (Draft — confirm with bookkeeper)

```csv
Employee Name,Role,Incident,Period Start,Period End,Days Worked,Regular Hours,OT Hours,DT Hours,Base Hourly Rate,Regular Pay,OT Pay,DT Pay,Gross Pay
Dr. A. Mitchell,MD,Lava Fire,2026-04-01,2026-04-15,14,112.00,56.00,56.00,$81.82,$9163.64,$6872.73,$9163.64,$25200.00
```

---

## Migration Order

1. Create `payroll_configs` table + seed default config
2. Create `payroll_runs` and `payroll_line_items` tables
3. Update Pay Rates page with CA-compliant hourly display
4. Build Payroll Runs admin page + detail view
5. Build CSV export API endpoint
6. Update MyPayroll page to read from payroll_line_items
7. Wire demob trigger into deployment end flow
8. Wire closeout trigger into incident close flow
9. Add cron for scheduled period-end draft generation
10. RLS policies for all new tables

---

## Open Questions

- [ ] Pay frequency and dates (from bookkeeper)
- [ ] CSV format requirements (from bookkeeper)
- [ ] Approval workflow (who approves?)
- [ ] How to handle partial days (e.g. arrive at noon on first day)
- [ ] 7th consecutive day OT rules (CA requires 1.5x for first 8h, 2.0x after 8h on 7th day)
- [ ] Weekly 40-hour OT threshold (relevant if someone works <16h some days)
- [ ] Per diem / expenses — separate from payroll or included?
