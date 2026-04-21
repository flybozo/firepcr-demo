# Decomposition & Code Quality Audit — Phase 5 Candidates

**Date:** 2026-04-19  
**Scope:** Post-Phase-4 audit of the next tier (15 files ≥ 500 lines)  
**Method:** Read-only static analysis — no changes made

---

## Table of Contents

1. [Per-File Analysis](#per-file-analysis)
2. [Cross-File Patterns](#cross-file-patterns)
3. [Priority Summary](#priority-summary)
4. [Recommended Extraction Targets](#recommended-extraction-targets)

---

## Per-File Analysis

### 1. `src/pages/mar/MARNew.tsx` — 1065 lines · **HIGH**

**What it does:** Medication Administration Record form for logging drug dispensing. Handles medication selection from unit inventory, provider/witness signatures, controlled-substance waste tracking, and offline-first persistence with inventory deduction on submit.

**Decomposition opportunities:**

| Extracted piece | Est. lines |
|---|---|
| `useUnitInventory(unitId)` hook — inventory load, `handleItemSelect`, lot-number state | ~120 |
| `useEncounterPicker(unitId)` hook — encounter query, `loadEncountersForUnit` | ~70 |
| `useProviderAuth()` hook — signature state, PIN validation, cosign flow | ~100 |
| `EncounterPickerSection` component (currently inline, lines 399–431) | ~35 |
| `MARSignatureSection` component — provider + witness signature UI | ~130 |
| `MARMedicationSection` component — item select, route/dosage fields, CS warning | ~180 |
| Constants file `marConstants.ts` — `ROUTES`, `RESPONSES`, `ROUTE_SUGGESTIONS`, `DOSAGE_UNIT_SUGGESTIONS` | ~50 |

**Estimated post-decomposition size of main file:** ~380 lines

**Code smells:**
- `EncounterPickerSection` defined inline at line 399 — should be a standalone component
- `loadEncountersForUnit` (lines 115–150) and `loadUnitCrew` duplicate the encounter query pattern seen identically in `NewCompClaim.tsx` — shared hook opportunity
- Five related state clusters (`encounterOptions`, `unitCrew`, `unitInventory`, `routeAutoSuggested`, `dosageAutoSuggested`) are prime candidates for three custom hooks
- Complex triple-ternary in provider signature section (lines 959–1010): `isSelfOrder ? … : isProviderMatch ? … : …`
- `uploadSignature` function defined inside component body (line 456) — should be a module-level utility (also duplicated in `ICS214Detail.tsx` and `AMAConsent.tsx`)

---

### 2. `src/pages/analytics/Analytics.tsx` — 966 lines · **MEDIUM**

**What it does:** Multi-tab analytics dashboard (Clinical, Operations, Workforce) rendering Recharts charts for encounter volume, complaints, acuity, disposition, medications, staffing, credential compliance, and supply consumption. Role-gated tab visibility.

**Decomposition opportunities:**

| Extracted piece | Est. lines |
|---|---|
| `src/components/analytics/` — `StatCard`, `Empty`, `Skeleton`, `SectionHeader`, `DatePills` | ~60 |
| `<ChartSection loading empty>` wrapper — replaces 12× `loading ? Skeleton : empty ? Empty : chart` | ~25 |
| `useClinicalData(range, isField, incidentId)` hook — aggregation + load | ~80 |
| `<SupplyChart />` — OperationsTab supply section (lines 649–698) | ~60 |

**Estimated post-decomposition size of main file:** ~750 lines (already partially componentized; tabs are natural boundaries)

**Code smells:**
- `StatCard`, `Empty`, `Skeleton`, `SectionHeader`, `DatePills` are all defined at file scope (lines 57–113) — should be in `src/components/analytics/` and reused from there
- 12+ repetitions of `loading ? <Skeleton /> : data.length === 0 ? <Empty /> : <Chart />` — a `<ChartSection>` wrapper would eliminate this
- 6+ BarChart/LineChart/PieChart blocks share identical margin/tooltip/axis config — extract `<ChartCard>` wrapper
- `CERT_FIELDS` constant (lines 706–720) is a hardcoded compliance list that belongs in a config or data file
- Data aggregation in `ClinicalTab` (lines 206–243) repeats a `forEach + object accumulator` pattern 5 times — extract `aggregateByKey()` utility

---

### 3. `src/pages/comp-claims/NewCompClaim.tsx` — 926 lines · **HIGH**

**What it does:** Workers' compensation claim form with 8 sections (incident, patient, injury, clinical, witnesses, coordinator, employer, notes). Links to patient encounters, auto-fills demographic fields, and generates OSHA 301 PDFs with offline fallback.

**Decomposition opportunities:**

| Extracted piece | Est. lines |
|---|---|
| `useEncounterPreFill(unitId)` hook — merges duplicate encounter logic from this file and `MARNew.tsx` | ~80 |
| `useCompClaimSubmit()` hook — validation, payload build, DB insert, PDF trigger | ~120 |
| `<CompClaimSections1to3 />` — incident, patient, injury fields | ~120 |
| `<CompClaimSections4to8 />` — clinical, witnesses, coordinator, employer, notes | ~120 |
| `<CompClaimSuccess />` — success screen with download button | ~60 |

**Estimated post-decomposition size of main file:** ~380 lines

**Code smells:**
- `loadPickerEncounters` (lines 175–184) and `loadEncountersForUnit` (lines 201–210) both query `patient_encounters` with similar conditions — should be the single shared `useEncounterPicker` hook from MARNew
- 22-field `form` object in a single `useState` (lines 254–297) — candidate for `useReducer` or logical split into patient/incident/clinical sub-objects
- `handleSubmit` is ~100 lines (lines 436–540): validation, payload, DB insert, and PDF generation all together
- `generateCompClaimsPDF` called with the same parameter mapping in both submit (lines 495–527) and download handler (lines 546–578) — extract shared parameter builder
- `CLINICAL_OPTIONS_COMP` constant defined at line 902, after it is used at line 765 — move to top or separate constants file
- 8 section headers with identical `<p className={sectionCls}>` pattern — extract `<FormSection title>` wrapper

---

### 4. `src/lib/nemsis/buildPcrXml.ts` — 867 lines · **MEDIUM**

**What it does:** Converts patient encounter data (vitals, medications, procedures) into NEMSIS 3.5.1 XML for EMS data exchange. Handles field mapping, code translations, date/time formatting, ICD-10 validation, and nested element construction.

**Decomposition opportunities:**

| Extracted piece | Est. lines |
|---|---|
| `xmlHelpers.ts` — `xmlEsc`, `nilEl`, `optEl`, `valEl`, `mapVal`, `ensureArray` | ~60 |
| `nemsisDateUtils.ts` — `fmtDatetime`, `fmtDate`, `resolveCountyFips`, `resolveStateCode` | ~50 |
| `vitalsBuilder.ts` — `buildVitalsBlock()` (currently lines 224–327) | ~105 |
| `situationBuilder.ts` — `INDUSTRY_MAP`, `OCCUPATION_MAP`, eSituation logic | ~100 |
| `dispositionBuilder.ts` — `buildDispositionBlock()` (lines 812–841) | ~35 |

**Estimated post-decomposition size of main file:** ~500 lines

**Code smells:**
- `buildDelays()`, `buildMultiVal()`, `buildMedicationsBlock()`, `buildProceduresBlock()` are all defined **inside** `buildPcrXml()` (nested functions) — prevents individual testing and reuse
- `INDUSTRY_MAP` + `OCCUPATION_MAP` (lines 389–443, ~54 lines of NAICS/SOC codes) should be in a separate data module
- NEMSIS code values scattered as magic strings: `'9922001'`, `'2815001'`, `'3315009'` etc. — should have named constants (e.g. `NEMSIS_CODES.WORK_RELATED_YES`)
- `DEFAULT_STATE_CODE = 'CA'` hardcoded at lines 471, 591, 694 — define once as a constant
- No input validation: missing required fields produce silently incomplete XML rather than thrown errors

---

### 5. `src/pages/units/UnitDetail.tsx` — 860 lines · **HIGH**

**What it does:** Comprehensive unit detail page covering vehicle info, crew assignments, deployment history, inventory summary, and vehicle documents. Manages offline fallback, crew conflict resolution, and per-section edit states.

**Decomposition opportunities:**

| Extracted piece | Est. lines |
|---|---|
| `useVehicleEditor(unitId)` hook — 9 related vehicle states + handlers | ~120 |
| `<CrewSection />` — crew list, add form, `addCrewMember`, `removeCrewMember` | ~100 |
| `<DeploymentHistoryCard />` — currently an IIFE returning 100+ lines of JSX (lines 665–763) | ~110 |
| `<VehicleDocumentUpload />` — doc type select, upload handler, doc list | ~60 |
| `<VehicleDetailsCard />` — view/edit form with photo upload | ~130 |

**Estimated post-decomposition size of main file:** ~320 lines

**Code smells:**
- Vehicle-related state spans 9 variables: `editingVehicle`, `vehicleForm`, `savingVehicle`, `vehicleDocUrls`, `vehicleDocs`, `uploadingDoc`, `docType`, `uploadingPhoto`, `photoInputRef` — classic `useVehicleEditor` hook candidate
- Crew state spans 5 variables: `addingTo`, `selectedEmployee`, `selectedRole`, `saving`, `crewConflict`
- `calcRow` and `fmtDate` utility functions defined inside an IIFE in the deployment section (lines 668–685) — extract to `src/lib/unitDetailUtils.ts`
- `.filter((ua: any) => !ua.released_at)` duplicated 3 times on crew arrays (lines 587, 600, 603) — extract `activeAssignments` variable
- `load()` function (lines 105–221) performs 6 sequential queries — split into `loadUnit`, `loadEmployees`, `loadDeployments`, `loadInventory`, `loadVehicleDocs`
- Extensive `as any` casts despite existing types

---

### 6. `src/components/ThemeProvider.tsx` — 856 lines · **MEDIUM**

**What it does:** Theme system providing 24+ preset color schemes and customizable font families. Manages org-wide and personal overrides, applies CSS variables to the DOM, and dynamically loads Google Fonts.

**Decomposition opportunities:**

| Extracted piece | Est. lines |
|---|---|
| `themePresets.ts` — `THEME_PRESETS` config object (24 themes, repetitive structure) | ~500 |
| `fontLoader.ts` — `THEME_FONTS`, `fontMap`, `googleFonts` (currently defined 3× separately) + Google Font injection | ~80 |
| `applyThemeToDom.ts` — pure CSS variable builder, extracted from side-effect-heavy current function | ~80 |
| `useThemeLoader()` hook — Supabase fetch + personal vs. org fallback (60+ lines in one effect) | ~70 |

**Estimated post-decomposition size of main file:** ~180 lines

**Code smells:**
- Font family data defined **three times**: `THEME_FONTS` (lines 37–62), `fontMap` inside `applyThemeToDom` (lines 638–667), and `googleFonts` lookup (lines 697–725) — all should reference one source
- `THEME_PRESETS` repeats the same 12-field structure 24 times (~480 lines of config) — strongly consider a compact array of `{key, name, emoji, description, colors}` objects
- `applyThemeToDom` mutates the DOM, injects `<style>`, and loads Google Fonts — three distinct concerns in one function
- `saveTheme` and `savePersonalTheme` depend on `orgId`/`employeeId` set asynchronously — if called before the effect completes, values are null without guard
- Theme keys used as lookup strings throughout (e.g., `fontMap['ember']`) with no existence check — one typo breaks silently

---

### 7. `src/pages/ics214/ICS214Detail.tsx` — 790 lines · **HIGH**

**What it does:** ICS 214 activity log detail view with inline field editing, personnel management, activity logging, signature capture, and PDF generation/upload.

**Decomposition opportunities:**

| Extracted piece | Est. lines |
|---|---|
| `<EditField />` component (lines 62–130) — already isolated, just needs extraction | ~70 |
| `<PersonnelSection />` — header row, list, add form | ~90 |
| `<ActivityLogSection />` — activity list, inline add form, type styling | ~110 |
| `useCloseoutFlow()` hook — `showCloseout`, `closeoutSigRef`, `closingOut`, `encounters` | ~60 |
| `generateAndUploadPDF` logic — extract to `src/lib/ics214Pdf.ts` | ~80 |

**Estimated post-decomposition size of main file:** ~350 lines

**Code smells:**
- `EditField` (lines 62–130) is a fully general inline-edit component trapped in this file — should be `src/components/EditField.tsx`
- `formatTime` and `formatDateTime` (lines 132–156) defined at file scope here — duplicated across `MARDetail.tsx` and others; belongs in `src/utils/dateFormatters.ts`
- `uploadSignature` function (lines 236–246) is character-for-character identical to the same function in `AMAConsent.tsx` — extract to `src/lib/signatureUtils.ts`
- Activity type inline conditional styling (lines 590–595) repeated — extract `getActivityTypeStyles(type)` utility
- Line 287–294 queries encounters using `.gte`/`.lte` but comment says equality match — potential logic bug worth investigation

---

### 8. `src/pages/consent/AMAConsent.tsx` — 768 lines · **HIGH**

**What it does:** Multi-step AMA (Against Medical Advice) refusal form with encounter picker, patient and provider signature capture, PDF generation with polling, and success screen with download/share.

**Decomposition opportunities:**

| Extracted piece | Est. lines |
|---|---|
| `<EncounterPicker />` shared component (see critical bug below) | ~60 |
| `<ResizableSignatureCanvas />` — canvas resize logic duplicated for patient + provider sigs | ~80 |
| `useConsentSubmission()` hook — `submitted`, `lastConsentId`, `lastConsentData`, `pdfUrl`, `pdfGenerating`, `copySuccess` | ~80 |
| `usePollUntilValue()` hook — polling + cleanup logic (lines 444–480) | ~40 |
| `<ConsentSuccessScreen />` | ~55 |

**Estimated post-decomposition size of main file:** ~380 lines

**Code smells:**
- **Critical:** `EncounterPicker` component is defined **twice** — at lines 66–117 and again at lines 551–564 with a different implementation. The second definition shadows the first. Extract to `src/components/EncounterPicker.tsx` and import it.
- Patient signature canvas logic (lines 658–668, `onBegin` at 677–687) and provider signature canvas logic (lines 709–719, `onBegin` at 728–738) are identical — extract `<ResizableSignatureCanvas>`
- `uploadSignature` (lines 236–247) — third copy of this function, also in `ICS214Detail.tsx` and `MARNew.tsx`
- `PROVIDERS` and `UNITS` module-level constants are only used here but could be shared with other pages
- Polling cleanup (lines 444–480) is sophisticated and reusable — deserves `usePollUntilValue` in `src/hooks/`
- `AMAFormInner` wrapped by thin `AMAForm` (lines 761–767) only for Suspense boundary — same pattern as `MARNewFormInner` wrapper; consider moving Suspense to router level

---

### 9. `src/pages/profile/Profile.tsx` — 746 lines · **HIGH**

**What it does:** Employee profile page for editing personal info, managing credential uploads/previews, configuring theme/appearance, setting signing PINs, and managing push notification subscriptions.

**Decomposition opportunities:**

| Extracted piece | Est. lines |
|---|---|
| `useProfileForm()` hook — 9 form fields + 10 auxiliary states + load effect | ~80 |
| `useCredentialManagement()` hook — credential load, upload, filename builder | ~80 |
| `<CredentialWallet />` component — list with file download/preview | ~90 |
| `<CredentialUpload />` component — upload form with type/expiry fields | ~45 |
| `<HeadshotUpload />` component — upload button + preview | ~25 |

(AppearanceSection and PinSetupSection already extracted, lines 573–745)

**Estimated post-decomposition size of main file:** ~350 lines

**Code smells:**
- `CERT_CODES` (lines 168–177) and `fieldMap` (lines 234–242) are both cert→employee field mappings defined separately — consolidate into one map
- `buildCanonicalName` utility (line 179) defined inside the component body — extract to module level
- Inline credential blob download logic (lines 454–470) inside JSX return — extract to named function
- Image vs iframe preview nested ternary (lines 555–565) — candidate for `<FilePreview>` sub-component
- `async import(...)` pattern used 7+ times inside `useEffect` blocks — consider a central import or top-level import
- Multiple `useEffect` chains (lines 68–107) for push + profile loading could consolidate

---

### 10. `src/pages/supply-runs/SupplyRunDetail.tsx` — 738 lines · **HIGH**

**What it does:** Supply run detail page for managing inventory items dispensed from a unit, with barcode scanning, manual add/edit/delete, and unit inventory synchronization. Supports offline mode.

**Decomposition opportunities:**

| Extracted piece | Est. lines |
|---|---|
| `useSupplyRunData(id)` hook — load, item state, inventory state | ~90 |
| `useBarcodeScan()` hook — barcode matching logic (3-level fallback) | ~100 |
| `useSupplyRunEdit()` hook — `handleAddItem`, `handleDeleteItem`, `handleUpdateItemQty` | ~80 |
| `<BarcodeScanSection />` component | ~85 |
| `<ItemsList />` component — table with inline quantity editor | ~150 |

**Estimated post-decomposition size of main file:** ~180 lines

**Code smells:**
- Inventory lookup supabase query repeated 4 times (lines 156–164, 317–330, 372–385, 414–422) — extract to utility `fetchUnitInventory(unitId, supabase)`
- Quantity adjustment logic (`item_count` update on `supply_runs`) duplicated in 3 handlers
- Barcode 3-level fallback (unit_inventory → formulary → raw_barcodes) is sophisticated and should be its own tested function
- `inputCls`/`labelCls` defined locally (lines 54–55) — same pattern as 21+ other files (see cross-file section)

---

### 11. `src/pages/encounters/EncounterEdit.tsx` — 690 lines · **MEDIUM**

**What it does:** Edit form for existing medical encounter records. Covers patient demographics, assessment (complaint, impression, acuity), vitals (HR, BP, GCS), and disposition. Supports offline queue.

**Decomposition opportunities:**

| Extracted piece | Est. lines |
|---|---|
| `CLINICAL_OPTIONS` array → `src/data/clinicalOptions.ts` (55-line array currently at top of file) | ~55 |
| `<PatientInfoSection />` | ~65 |
| `<AssessmentSection />` | ~60 |
| `<VitalsSection />` — reusable across `NewSimpleEncounter.tsx` | ~100 |
| `<DispositionSection />` | ~40 |
| `useEncounterForm()` hook | ~60 |

**Estimated post-decomposition size of main file:** ~280 lines

**Code smells:**
- `CLINICAL_OPTIONS` (lines 15–131, ~55 lines of data) defined in the component file — pollutes module scope and should live in `src/data/clinicalOptions.ts` (shared with `NewSimpleEncounter.tsx` which has a similar list)
- 40-field `form` state in a single `useState` — candidate for `useReducer`
- `gcsTotal()` computed fresh on every access (lines 270–275, 307–308, 354, 576–580) — compute once and memoize
- `SearchableSelect` used 3 times with identical structure — loop over a config array
- `inputCls`/`labelCls`/`sectionCls` redefined locally (lines 133–135)

---

### 12. `src/components/ChatBubble.tsx` — 643 lines · **MEDIUM**

**What it does:** Floating AI chat widget (AI Assistant) with draggable bubble, message history, async response polling, voice input via Web Speech API, and full-screen overlay UI.

**Decomposition opportunities:**

| Extracted piece | Est. lines |
|---|---|
| `useDraggablePosition()` hook — drag state + localStorage persistence | ~50 |
| `useMessagePolling()` hook — polling intervals + timeout cleanup | ~80 |
| `useSpeechRecognition()` hook — 70-line effect, currently untestable | ~80 |
| `<DraggableBubble />` component | ~80 |
| `<ChatMessage />` component — `renderMessage` extracted | ~55 |
| `<InputBar />` component | ~60 |

**Estimated post-decomposition size of main file:** ~230 lines

**Code smells:**
- Two parallel polling refs (`pollIntervalsRef`, `pollTimeoutsRef`) cleaned up with identical `forEach` calls — unify into one ref or extract `cleanupPolling()` 
- 70-line `useEffect` for speech recognition (lines 179–248) is deeply nested and not independently testable
- 4+ SVG icons inlined — a lightweight icon library or extracted SVG components would reduce maintenance burden
- Drag position uses both mouse and touch events with duplicated handler logic

---

### 13. `src/pages/ics214/NewICS214.tsx` — 617 lines · **HIGH**

**What it does:** Form for creating a new ICS 214 operational activity log, covering unit/incident selection, operational dates/times, assigned personnel (with role mapping), and the initial activity entry.

**Decomposition opportunities:**

| Extracted piece | Est. lines |
|---|---|
| `useICS214Form()` hook — 16 `useState` calls at top level | ~60 |
| `useICS214DataLoad()` hook — unit/incident pre-fill, crew loading with fallback queries | ~80 |
| `<CrewManager />` component (lines 461–520) | ~70 |
| `handleSubmit` extraction — 89-line 4-step insert sequence | ~95 |

**Estimated post-decomposition size of main file:** ~280 lines

**Code smells:**
- 16 `useState` calls in one component (lines 58–78) — classic `useReducer` or custom hook candidate
- Crew query has a try/fallback-without-released pattern (lines 137–166) — should be a utility with explicit docs
- `handleSubmit` (lines 234–322) does ID generation, incident_unit lookup, and a 4-step insert chain — extract to service function
- `todayStr()` utility (line 28) is a one-liner that belongs in `src/utils/dateFormatters.ts`
- Unit name sanitization (`replace(/[^a-zA-Z0-9]/g, '')`, line 246) is inline — extract to named function

---

### 14. `src/pages/encounters/NewSimpleEncounter.tsx` — 615 lines · **HIGH**

**What it does:** New patient encounter form capturing demographics, vital signs, chief complaint, SOAP narrative, disposition, and provider info. Supports offline write.

**Decomposition opportunities:**

| Extracted piece | Est. lines |
|---|---|
| `useEncounterForm()` hook — 24-field form + DOB→age auto-calc | ~80 |
| `useEncounterDataLoad()` hook — employee fetch + assignment pre-fill | ~55 |
| `<VitalsSection />` — reusable with `EncounterEdit.tsx` | ~65 |
| `buildEncounterData()` — 65-line payload builder extracted from `handleSubmit` | ~70 |

**Estimated post-decomposition size of main file:** ~300 lines

**Code smells:**
- 24-field `form` state in a single `useState` (lines 83–124) — same issue as `EncounterEdit.tsx`
- `VitalsSection` JSX (lines 469–530) is identical in structure to the vitals section in `EncounterEdit.tsx` — extract a shared `<VitalsSection>` component
- Local constant arrays (CHIEF_COMPLAINTS, DISPOSITIONS, ACUITY, etc.) at module top — overlap with `EncounterEdit.tsx` lists; consolidate in `src/data/clinicalOptions.ts`
- `assignmentApplied` ref guards a one-time pre-fill (line 127) — the `useEffect` dependency array (line 150) is long; extract to `useAssignmentPreFill` hook
- Cache-then-fetch in data loading (lines 156–182) makes 2 network calls on cache miss with no error handling

---

### 15. `src/components/Sidebar.tsx` — 611 lines · **MEDIUM**

**What it does:** Main navigation sidebar with dnd-kit drag reorder, collapsible sub-menus, role-based item filtering, badges for unsigned items (charts, notes, MARs), and online/offline awareness.

**Decomposition opportunities:**

| Extracted piece | Est. lines |
|---|---|
| `<BadgePopover />` component — currently duplicated twice inside `SortableNavItem` | ~40 |
| `<DirectLinkNavItem />` | ~70 |
| `<FieldDirectNavItem />` | ~30 |
| `<MenuButtonNavItem />` | ~60 |

**Estimated post-decomposition size of main file:** ~380 lines (sidebar config/logic is inherently large)

**Code smells:**
- `SortableNavItem` is 200+ lines (lines 161–403) with three conditional render branches and repeated badge logic
- Badge detail popover JSX (lines 257–270) duplicated verbatim at lines 337–361 — direct copy/paste
- Inline `style` color objects applied 3 times with the same `color-mix` pattern (lines 236–240, 299–303, 325–329) — extract `useSidebarColors()` or a CSS helper
- Chat unread badge rendered at lines 273–277 and 310–314 with identical logic — extract to named element
- `adminSubs` array defined inline in filter expression (lines 199–209) — should be a module constant

---

## Cross-File Patterns

### A. `uploadSignature` — Triplicated

The same ~12-line blob-upload function appears independently in:
- `src/pages/mar/MARNew.tsx`
- `src/pages/ics214/ICS214Detail.tsx`
- `src/pages/consent/AMAConsent.tsx`

**Fix:** Extract to `src/lib/signatureUtils.ts` and import.

---

### B. `EncounterPicker` / `loadEncountersForUnit` — Quadruplicated

Encounter loading + picker UI is reimplemented independently in:
- `MARNew.tsx` (`EncounterPickerSection` inline component + `loadEncountersForUnit`)
- `NewCompClaim.tsx` (`PickerByUnit` inline + `loadPickerEncounters`)
- `AMAConsent.tsx` (`EncounterPicker` defined **twice** in the same file — critical shadowing bug)

**Fix:** Single `src/components/EncounterPicker.tsx` + `useEncounterPicker(unitId)` hook.

---

### C. `fmtCurrency` — Three Conflicting Definitions

| File | Function name | Options |
|---|---|---|
| `src/utils/incidentFormatters.ts` | `fmtCurrency(n)` | `maximumFractionDigits: 0` |
| `src/pages/admin/Financial.tsx` | `fmtCurrency(n)` (local copy) | `maximumFractionDigits: 0` |
| `src/pages/billing/Billing.tsx` | `fmt(n)` (local copy) | default fractionDigits |
| `src/components/incidents/cards/BillingSummaryStatCard.tsx` | inline `Intl.NumberFormat` | — |

Additionally `calcDays` (day-count between dates) is defined identically in both `incidentFormatters.ts` and `Financial.tsx`.

**Fix:** Delete local copies, import from `incidentFormatters.ts`; decide on `maximumFractionDigits` convention once.

---

### D. `inputCls` / `labelCls` / `sectionCls` — Defined in 21+ Files

`src/components/ui/FormField.tsx` already exports `inputCls`, `selectCls`, `textareaCls`. However every page audited redefines its own copy (sometimes with minor variations like `ring-red-500` vs `ring-blue-500`). 

**Files with local redefinitions (sample):** `MARNew.tsx`, `NewCompClaim.tsx`, `EncounterEdit.tsx`, `NewSimpleEncounter.tsx`, `SupplyRunDetail.tsx`, `Profile.tsx`, `NewICS214.tsx`, plus ~15 more pages.

**Fix:** Delete all local definitions; import from `@/components/ui/FormField`. Settle the accent-color variation in one place.

---

### E. Date Formatting — 50+ Inline Calls, 6 Utility Functions

Six separate date utility functions exist in three different files (`encounterFormatters.ts`, `incidentFormatters.ts`, `chatHelpers.ts`). In addition, 50+ raw `toLocaleDateString()`/`toLocaleString()` calls are scattered across 29+ pages instead of using the utilities.

**Fix:** Consolidate into `src/utils/dateFormatters.ts` with consistent exports: `formatDate`, `formatDateTime`, `formatTime`, `relativeTime`, `formatDateSeparator`. Grep-replace raw inline calls.

---

### F. `VitalsSection` — Duplicated in Two Encounter Forms

`EncounterEdit.tsx` and `NewSimpleEncounter.tsx` both contain a vitals section (HR, RR, SpO2, BP, GCS, pain, glucose, temp, skin signs) with the same fields in the same order.

**Fix:** Extract `src/components/encounters/VitalsSection.tsx` (~65 lines) and import in both.

---

### G. `CLINICAL_OPTIONS` / Dropdown Data Arrays — Duplicated

`EncounterEdit.tsx` (lines 15–131) and `NewSimpleEncounter.tsx` (lines 12–51) each define large arrays of clinical options (complaints, dispositions, acuity, rhythms, pupils). There is overlap.

**Fix:** Extract to `src/data/clinicalOptions.ts` and import where needed.

---

### H. `StatCard` — Two Implementations

- `src/components/ui/StatCard.tsx` — simple metric card
- `src/components/shared/StatCard.tsx` — complex card with drag reorder, expandable overlay, column span

Additionally, `Analytics.tsx` and `Financial.tsx` each define their own local `StatCard` inline.

**Fix:** The two official components serve different purposes (keep both). Delete inline copies in `Analytics.tsx` and `Financial.tsx` — determine which shared component fits and import it.

---

## Priority Summary

| File | Lines | Priority | Top Opportunity |
|---|---|---|---|
| `MARNew.tsx` | 1065 | **HIGH** | 3 custom hooks + 2 component extractions; shares `EncounterPicker` fix with AMAConsent/NewCompClaim |
| `Analytics.tsx` | 966 | **MEDIUM** | `<ChartSection>` wrapper eliminates 12 repeated patterns; move inline components to `components/analytics/` |
| `NewCompClaim.tsx` | 926 | **HIGH** | Shared `useEncounterPicker` hook; split submission logic; fix late constant |
| `buildPcrXml.ts` | 867 | **MEDIUM** | Lift nested function defs to module scope; extract `INDUSTRY_MAP` to data file |
| `UnitDetail.tsx` | 860 | **HIGH** | `useVehicleEditor` hook collapses 9 states; `<DeploymentHistoryCard>` removes IIFE |
| `ThemeProvider.tsx` | 856 | **MEDIUM** | `themePresets.ts` removes 500 lines of repetitive config; fix triple font definition |
| `ICS214Detail.tsx` | 790 | **HIGH** | Extract `EditField` component + shared `uploadSignature`; `useCloseoutFlow` hook |
| `AMAConsent.tsx` | 768 | **HIGH** | **Fix duplicate `EncounterPicker` shadowing bug**; extract `<ResizableSignatureCanvas>` |
| `Profile.tsx` | 746 | **HIGH** | `useCredentialManagement` hook; consolidate cert code maps |
| `SupplyRunDetail.tsx` | 738 | **HIGH** | Deduplicate 4× inventory query; `useBarcodeScan` hook |
| `EncounterEdit.tsx` | 690 | **MEDIUM** | Move `CLINICAL_OPTIONS` to data file; shared `<VitalsSection>` |
| `ChatBubble.tsx` | 643 | **MEDIUM** | `useSpeechRecognition` hook; unify polling refs |
| `NewICS214.tsx` | 617 | **HIGH** | Collapse 16 useState → `useICS214Form`; extract submit service |
| `NewSimpleEncounter.tsx` | 615 | **HIGH** | Shared `<VitalsSection>`; shared clinical options data file |
| `Sidebar.tsx` | 611 | **MEDIUM** | Split `SortableNavItem` into 3; extract duplicated `<BadgePopover>` |

---

## Recommended Extraction Targets

Listed roughly by effort-to-impact ratio:

### Tier 1 — Quick wins, high blast radius (fix cross-cutting duplicates first)

1. **`src/lib/signatureUtils.ts`** — consolidate `uploadSignature` (3 copies eliminated)
2. **`src/components/EncounterPicker.tsx` + `src/hooks/useEncounterPicker.ts`** — fix AMAConsent shadowing bug, remove 4 duplicated implementations
3. **Delete local `inputCls`/`labelCls` definitions** — import from `src/components/ui/FormField.tsx` (21+ files)
4. **`src/utils/dateFormatters.ts`** — consolidate 6 utility functions, replace 50+ inline calls
5. **Delete local `fmtCurrency` copies** — import from `src/utils/incidentFormatters.ts`; delete `calcDays` duplicate

### Tier 2 — File-level decompositions (highest-priority files)

6. **`useVehicleEditor` hook** from `UnitDetail.tsx` (9 states → 1 hook)
7. **`<EditField>` extraction** from `ICS214Detail.tsx` (also usable in other detail pages)
8. **`<VitalsSection>`** shared between `EncounterEdit.tsx` and `NewSimpleEncounter.tsx`
9. **`src/data/clinicalOptions.ts`** — consolidate dropdown arrays from both encounter forms
10. **`themePresets.ts`** — move 500-line config block out of `ThemeProvider.tsx`
11. **`<ResizableSignatureCanvas>`** from `AMAConsent.tsx` (patient + provider sig canvas)
12. **`<DeploymentHistoryCard>`** from `UnitDetail.tsx` (remove IIFE anti-pattern)
13. **`useICS214Form` + `useICS214DataLoad`** from `NewICS214.tsx` (16 useState → hooks)
14. **`<BadgePopover>`** from `Sidebar.tsx` (exact duplicate 2×)
15. **`<ChartSection loading empty>`** wrapper for `Analytics.tsx` (12 repetitions)

### Tier 3 — Medium complexity, medium gain

16. `useBarcodeScan` hook from `SupplyRunDetail.tsx`
17. `useSpeechRecognition` + `useDraggablePosition` hooks from `ChatBubble.tsx`
18. `useCredentialManagement` hook from `Profile.tsx`
19. Lift `buildMedicationsBlock`/`buildProceduresBlock` out of `buildPcrXml()` scope
20. `NEMSIS_CODES` named constants replacing magic strings in `buildPcrXml.ts`
