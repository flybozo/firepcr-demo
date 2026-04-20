# Phase 4: Component Decomposition Plan

**Author:** Claude (claude-sonnet-4-6)  
**Date:** 2026-04-19  
**Goal:** No component > 500 lines. Break up the four god components into well-structured sub-components.

---

## Summary

| File | Current Lines | Target After | New Files | Primary Risk |
|------|-------------|-------------|-----------|--------------|
| `IncidentDetail.tsx` | 2,808 | ~350 | 14 | DnD cardOrder state + renderCard() switch |
| `EncounterDetail.tsx` | 2,566 | ~300 | 16 | InlineField saveField prop drilling + DnD |
| `NewPCREncounter.tsx` | 1,861 | ~250 | 9 | Giant form state shared across all 6 steps |
| `Chat.tsx` | 1,329 | ~200 | 8 | MessageThread Realtime + polling race |

**Total new files: ~47** (including hooks, utils, and constants)

---

## 1. IncidentDetail.tsx (2,808 lines)

### Logical Sections to Extract

The file has two god functions that must be split first:
- `load()` (~500 lines of interleaved Supabase calls + state sets)
- `renderCard()` (~500 lines, 11-case switch statement)

Plus five inline component definitions that need to become real files:
- `LocationEditField()`, `EditField()`, `StatCard()`, `SortableCard()`

#### Card Components

| Card Key | Extract To | State It Owns | Est. Lines |
|----------|-----------|--------------|------------|
| `incident-info` | `IncidentInfoCard.tsx` | `incident` fields, `saveField()`, GPS, contract upload | 220 |
| `units` | `UnitsCard.tsx` | `incidentUnits`, `allUnits`, `allIncidentUnits`, `unitFilter`, `assignUnit()`, `demobilizeUnit()`, `reassignUnit()` | 280 |
| `deployments` | `DeploymentsCard.tsx` | `crewDeployments`, `deployments`, `allEmployees`, `showAddDeployment`, `deployForm`, `editingDeployId`, `editDeployFields`, all 4 deployment handlers | 320 |
| `unit-revenue` | `RevenueCard.tsx` | `billingTotal` (computed from incidents), display only | 120 |
| `expenses` | `ExpensesCard.tsx` | `expenses`, `showAddExpense`, `expenseForm`, `editingRateIuId` | 250 |
| `encounters` | `EncountersStatCard.tsx` | `encounters`, `encounterCount`, `encounterSubFilter` | 130 |
| `mar` | `MarStatCard.tsx` | `marCount`, `marEntries` | 80 |
| `comp-claims` | `CompClaimsStatCard.tsx` | `compCount`, `compRows` | 80 |
| `supply-runs` | `SupplyRunsStatCard.tsx` | `supplyCount`, `supplyRuns` | 80 |
| `billing-summary` | `BillingSummaryStatCard.tsx` | `billingTotal`, `reorderCount` | 80 |
| `reorder-summary` | `ReorderStatCard.tsx` | `reorderRows` | 80 |
| `ics214` | `ICS214StatCard.tsx` | no local state, reads from `deployments` | 80 |

#### Shared Primitive Extractions

- `EditField` → `src/components/shared/EditField.tsx`
- `LocationEditField` → `src/components/shared/LocationEditField.tsx`
- `StatCard` → `src/components/shared/StatCard.tsx`
- `SortableCard` → `src/components/incidents/SortableCard.tsx`

### Proposed File Structure

```
src/
  components/
    shared/
      EditField.tsx           (was inline in IncidentDetail)
      LocationEditField.tsx   (was inline in IncidentDetail)
      StatCard.tsx            (was inline in IncidentDetail)
    incidents/
      SortableCard.tsx        (was inline in IncidentDetail)
      cards/
        IncidentInfoCard.tsx
        UnitsCard.tsx
        DeploymentsCard.tsx
        RevenueCard.tsx
        ExpensesCard.tsx
        EncountersStatCard.tsx
        MarStatCard.tsx
        CompClaimsStatCard.tsx
        SupplyRunsStatCard.tsx
        BillingSummaryStatCard.tsx
        ReorderStatCard.tsx
        ICS214StatCard.tsx
  hooks/
    useIncidentData.ts        (extracts the load() megafunction)
  utils/
    incidentFormatters.ts     (calcDays, formatDeployDate, acuityPillClass, patientInitials, fmtCurrency)
  pages/
    incidents/
      IncidentDetail.tsx      (~350 lines: DnD shell + incident switcher header)
```

### Shared State Strategy

**Stays in IncidentDetail parent:**
- `activeIncidentId`, `incident`, `loading`, `isOfflineData`
- `cardOrder`, `cardSpans` — DnD grid layout state coordinates all cards
- `handleDragEnd()` — modifies cardOrder
- `unitFilter` — drives which units are shown across multiple cards
- `closingOut`, `closeoutDt`, `handleCloseOut()` — incident lifecycle

**Moves to `useIncidentData(incidentId)` hook:**
- All data fetch logic from `load()`: Supabase queries for incident, units, deployments, employees, encounters, mar, comp, supply, billing, expenses
- Returns: `{ incident, incidentUnits, allUnits, allIncidentUnits, encounters, encounterCount, marCount, marEntries, compCount, compRows, supplyCount, supplyRuns, crewDeployments, deployments, allEmployees, expenses, billingTotal, reorderCount, reorderRows, loading, isOfflineData, reload }`

**Moves to individual card components (own local state):**
- `deployForm`, `editingDeployId`, `editDeployFields`, `showAddDeployment` → `DeploymentsCard`
- `showAddExpense`, `expenseForm`, `editingRateIuId` → `ExpensesCard`
- `encounterSubFilter` → `EncountersStatCard`

**Cards receive `reload` callback** from the hook to trigger data refresh after mutations.

### Extraction Order

1. **`incidentFormatters.ts`** — pure functions, zero risk, no dependencies
2. **`EditField` + `LocationEditField` + `StatCard` + `SortableCard`** — inline components with no dependencies
3. **`useIncidentData` hook** — isolates all data fetching, then IncidentDetail imports it
4. **`ICS214StatCard`** — simplest card, no mutations
5. **`EncountersStatCard`, `MarStatCard`, `CompClaimsStatCard`, `SupplyRunsStatCard`, `BillingSummaryStatCard`, `ReorderStatCard`** — StatCard wrappers, display-only
6. **`RevenueCard`** — display-only financial breakdown
7. **`IncidentInfoCard`** — complex but self-contained save logic
8. **`ExpensesCard`** — isolated add/edit/delete mutations
9. **`DeploymentsCard`** — most complex mutations, but isolated state
10. **`UnitsCard`** — depends on `unitFilter` from parent; wire prop last

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| `renderCard()` switch statement — the DnD `cardOrder` array maps string keys to JSX, so card components must receive all needed data as props from the parent shell | HIGH | Pass data from `useIncidentData` hook down; each card's props interface is the contract |
| `saveField()` is called inside `IncidentInfoCard` but updates `incident` state in parent — need a callback pattern | HIGH | `onFieldSaved: (field: string, value: string) => void` prop + optimistic update in card |
| `handleDragEnd()` references `cardOrder` and `cardSpans` closures — if not careful, stale closures after lifting | MEDIUM | Keep DnD state and handlers entirely in parent shell |
| `load()` has 6 interleaved async calls that use `Promise.all` with shared error handling — splitting into hook breaks the unified error boundary | MEDIUM | Keep single `reload()` function in hook, surface `error` state to parent |
| `generatePayrollReport()` reads `deployments` and `allEmployees` from closure — must be passed into `DeploymentsCard` or called from parent | LOW | Pass as prop function from parent |

### Estimated Sub-Component Count

**12 card components + 4 primitives + 1 hook + 1 utils file = 18 new files**

---

## 2. EncounterDetail.tsx (2,566 lines)

### Logical Sections to Extract

**Inline components to make real:**

| Current Inline | Extract To | Est. Lines |
|----------------|-----------|------------|
| `InlineField()` (87 lines) | `src/components/shared/InlineField.tsx` | 90 |
| `Field()` | `src/components/shared/Field.tsx` | 30 |
| `DraggableSection()` (95 lines) | `src/components/encounters/DraggableSection.tsx` | 100 |
| `SectionCard()` | `src/components/encounters/SectionCard.tsx` | 40 |
| `VitalsTrendTable()` | `src/components/encounters/sections/VitalsTrendTable.tsx` | 120 |
| `AddVitalsForm()` (240 lines) | `src/components/encounters/sections/AddVitalsForm.tsx` | 250 |
| `NEMSISTooltip()` | `src/components/shared/NEMSISTooltip.tsx` | 60 |

**Section components (one per draggable card):**

| Section Key | Extract To | State It Owns | Est. Lines |
|-------------|-----------|--------------|------------|
| `actions` | `EncounterActionsBar.tsx` | `showDeleteConfirm`, `deleteLoading`, `closingOut` | 80 |
| `narrative` | `NarrativeSection.tsx` | narrative fields via `InlineField` | 100 |
| `response` | `ResponseSection.tsx` | response time fields | 80 |
| `scene` | `SceneSection.tsx` | location, GPS fields | 80 |
| `assessment` | `AssessmentSection.tsx` | primary/secondary impression, acuity, NEMSIS options | 180 |
| `cardiac` | `CardiacArrestSection.tsx` | all eArrest fields + CARDIAC_RHYTHMS options | 200 |
| `vitals` | `VitalsSection.tsx` | `additionalVitals`, `showAddVitals`, GCS calc — wraps VitalsTrendTable + AddVitalsForm | 120 |
| `mar` | `MARSection.tsx` | `marEntries`, `editingMarQtyId`, `editingMarQtyValue` | 150 |
| `procedures` | `ProceduresSection.tsx` | `procedures` | 80 |
| `photos` | `PhotosSection.tsx` | `photos`, `photoSignedUrls`, lightbox state | 150 |
| `transport` | `TransportSection.tsx` | disposition, destination, transport method options | 150 |
| `provider` | `ProviderSection.tsx` | `providerOptions`, `crewOptions` | 100 |
| `forms` | `FormsSection.tsx` | `consentForms`, `compClaims`, `formPdfUrls` | 130 |
| `notes` | `ProgressNotesSection.tsx` | `progressNotes`, `showNoteForm`, `noteDraft`, `noteSaving`, `showSignModal`, `showNotePinModal`, `noteToSign`, `expandedNoteIds` | 280 |

### Proposed File Structure

```
src/
  components/
    shared/
      InlineField.tsx
      Field.tsx
      NEMSISTooltip.tsx
    encounters/
      DraggableSection.tsx
      SectionCard.tsx
      EncounterActionsBar.tsx
      sections/
        NarrativeSection.tsx
        ResponseSection.tsx
        SceneSection.tsx
        AssessmentSection.tsx
        CardiacArrestSection.tsx
        VitalsSection.tsx
          VitalsTrendTable.tsx
          AddVitalsForm.tsx
        MARSection.tsx
        ProceduresSection.tsx
        PhotosSection.tsx
        TransportSection.tsx
        ProviderSection.tsx
        FormsSection.tsx
        ProgressNotesSection.tsx
  constants/
    nemsis.ts               (all CARDIAC_RHYTHMS, SKIN_SIGNS, PUPILS_OPTIONS, CLINICAL_OPTION_VALUES, etc.)
  hooks/
    useEncounterData.ts     (data loading + mutations)
  utils/
    encounterFormatters.ts  (acuityColor, acuityLabel, statusColor, formatDateTime, formatTime, dash)
  pages/
    encounters/
      EncounterDetail.tsx   (~300 lines: DnD shell + encounter header + section routing)
```

### Shared State Strategy

**Stays in EncounterDetail parent:**
- `enc` (the Encounter object) — all sections read from it via `InlineField`'s `onSave` callback
- `loading`, `isOfflineData`
- `cardOrder`, `cardSpans` — DnD layout
- `handleDragEnd()`
- `userEmail` — used in notes sign modal

**Moves to `useEncounterData(encounterId)` hook:**
- Initial `enc` fetch from Supabase
- Loads: `photos`, `procedures`, `consentForms`, `compClaims`, `marEntries`, `progressNotes`, `crewOptions`, `providerOptions`, `photoSignedUrls`, `formPdfUrls`
- Returns mutation callbacks: `saveField`, `deleteEncounter`, `reload`

**Moves to individual section components:**
- `showSignModal`, `showNotePinModal`, `noteToSign`, `expandedNoteIds`, `showNoteForm`, `noteDraft`, `noteSaving` → `ProgressNotesSection`
- `showDeleteConfirm`, `deleteLoading` → `EncounterActionsBar`
- `showAddVitals` → `VitalsSection`
- `editingMarQtyId`, `editingMarQtyValue` → `MARSection`
- `showForms` → `FormsSection`

**Key pattern:** `InlineField` receives `onSave: (field: string, value: unknown) => Promise<void>` — the parent provides this callback which calls the service layer. Sections call `onSave` without owning the network logic.

### Extraction Order

1. **`encounterFormatters.ts`** — pure functions
2. **`src/constants/nemsis.ts`** — NEMSIS option arrays (referenced by both EncounterDetail and NewPCREncounter)
3. **`Field` + `InlineField` + `NEMSISTooltip` + `DraggableSection` + `SectionCard`** — building blocks
4. **`useEncounterData` hook** — isolates all fetching
5. **`ProgressNotesSection`** — most self-contained mutation-heavy section
6. **`PhotosSection`** — isolated signed URL logic
7. **`MARSection`** — isolated inline qty editing
8. **`ProceduresSection`** — display-only
9. **`VitalsSection`** + sub-components (VitalsTrendTable, AddVitalsForm)
10. **`AssessmentSection`** + **`CardiacArrestSection`** — NEMSIS option-heavy
11. **`TransportSection`** + **`FormsSection`** + **`ProviderSection`**
12. **`NarrativeSection`** + **`ResponseSection`** + **`SceneSection`** — simple field grids
13. **`EncounterActionsBar`** — last, since it reads `enc` lifecycle status
14. **Slim EncounterDetail.tsx** — wire everything together

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| `InlineField` calls `saveField()` which is defined inline in EncounterDetail with a closure over `enc` — the field key mapping depends on the Supabase table column name | HIGH | Extract `saveField` into `useEncounterData`; pass it as prop to each section; each section passes it to its `InlineField`s |
| NEMSIS option arrays (70+ entries) are currently inline in the file — referenced by both EncounterDetail and NewPCREncounter | HIGH | Extract to `src/constants/nemsis.ts` before doing anything else; both files import from there |
| `useNEMSISWarnings(enc)` produces per-field warnings consumed inside `InlineField` via `NEMSISTooltip` — sections need access to the warnings map | MEDIUM | Pass `nemsisWarnings` map as prop from parent where hook lives, or create `NEMSISContext` if prop drilling gets deep |
| `DraggableSection` uses `useSortable` from dnd-kit, which requires being inside a `DndContext` in the parent — sections must not create their own DnD contexts | LOW | DndContext stays in EncounterDetail; DraggableSection only calls useSortable |
| `AddVitalsForm` calls `blankVitalsForm()` and uses inline GCS auto-calc — needs to be duplicated or shared with NewPCREncounter Step 3 | LOW | Extract `blankVitalsForm` + `gcsTotal` to `utils/vitals.ts` |

### Estimated Sub-Component Count

**14 section components + 7 primitives + 1 hook + 2 utils/constants files = 24 new files**

---

## 3. NewPCREncounter.tsx (1,861 lines)

### Logical Sections to Extract

The component has one massive `form` state object with 50+ fields shared across 6 steps. The outer component `PCRFormInner` holds all state and renders a step-based switch. The step render logic is all inline (no separate render functions, just one long conditional chain).

**Step components:**

| Step | Extract To | Fields Owned | Est. Lines |
|------|-----------|-------------|------------|
| Step 0 | `Step0IncidentTimes.tsx` | incident_id, incident_name, service_date, dispatch/en-route/on-scene/at-destination/in-service times, 5 delay multi-selects | 280 |
| Step 1 | `Step1PatientScene.tsx` | patient demographics (name, DOB, age, gender, race, address, phone), scene (GPS, scene_type, chief complaint, unit) | 260 |
| Step 2 | `Step2Assessment.tsx` | primary/secondary impression (SearchableSelect), acuity, advance directives, cardiac arrest sub-section (11 fields) | 320 |
| Step 3 | `Step3Vitals.tsx` | bp_systolic, bp_diastolic, pulse, resp, spo2, gcs_eye/verbal/motor, temp — mirrors AddVitalsForm | 200 |
| Step 4 | `Step4Transport.tsx` | transport_method, no_transport_reason, patient_disposition, destination_type, destination_name, destination_state | 180 |
| Step 5 | `Step5Provider.tsx` | provider_employee_id, submit button, NEMSIS warning summary | 150 |

**Extracted utilities (usable by both NewPCREncounter and EncounterDetail):**
- `src/constants/nemsis.ts` — all 25+ option arrays (see EncounterDetail plan)
- `src/utils/vitals.ts` — `gcsTotal()`, `blankVitalsForm()`
- `src/services/encounterService.ts` (or extend existing) — `handleSubmit()` logic with offline queue + idempotency

### Proposed File Structure

```
src/
  pages/
    encounters/
      NewPCREncounter.tsx         (~250 lines: form state, step navigation, submit)
      steps/
        Step0IncidentTimes.tsx
        Step1PatientScene.tsx
        Step2Assessment.tsx
        Step3Vitals.tsx
        Step4Transport.tsx
        Step5Provider.tsx
  constants/
    nemsis.ts                     (shared with EncounterDetail)
  utils/
    vitals.ts                     (gcsTotal, blankVitalsForm)
  services/
    encounterService.ts           (createEncounter with offline fallback)
```

### Shared State Strategy

**Stays in NewPCREncounter parent:**
- `form` (the full 50+ field FormData object) — all steps read from it
- `step` (0–5) — navigation state
- `submitting` — disables submit button
- `requestId` ref — idempotency UUID, must persist across re-renders

**Each step component receives:**
```ts
interface StepProps {
  form: FormData;
  set: (field: keyof FormData, value: unknown) => void;
  nemsisWarnings: Record<string, string>;  // from useNEMSISWarnings
  employees: Employee[];                   // for provider step
}
```

**`set()` stays in parent** — it has a side effect (DOB → age auto-calc) that needs to be in one place.

**`handleSubmit()` extracted to `encounterService.createEncounter(form, { requestId, assignment })`** — the service handles the offline queue, idempotency header, and Supabase insert.

### Extraction Order

1. **`src/constants/nemsis.ts`** — do this first, shared with EncounterDetail; cut 600+ lines from this file immediately
2. **`src/utils/vitals.ts`** — extract `gcsTotal`, `blankVitalsForm`
3. **`src/services/encounterService.ts`** — extract `handleSubmit` logic
4. **`Step5Provider`** — simplest step, just provider select + submit
5. **`Step4Transport`** — isolated set of dropdown fields
6. **`Step3Vitals`** — reuses vitals utils
7. **`Step0IncidentTimes`** — datetime inputs + delay multi-selects
8. **`Step1PatientScene`** — demographics, DOB/age auto-calc receives `set` prop
9. **`Step2Assessment`** — most complex, cardiac arrest conditional section

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| `form` is a single flat object with 50+ keys — all steps share it but need to write different slices; the `set()` function has a DOB→age side effect that must stay centralized | HIGH | Pass `form` + `set` to each step; steps never manage their own local state for form values |
| `useNEMSISWarnings(form)` runs at the top level and produces a flat warning map — step components need access to the warnings for their specific fields | MEDIUM | Pass `nemsisWarnings` as a prop to each step; steps use `nemsisWarnings['field_key']` locally |
| Assignment pre-population (`useUserAssignment`) sets unit, incident, provider on mount — must run before steps render | LOW | Keep `useUserAssignment` and the `assignmentApplied` ref in the parent; pre-population writes to `form` via `set()` before step 0 is shown |
| `requestId` is a `useRef` initialized to `crypto.randomUUID()` — must not be re-created on step changes | LOW | Keep ref in parent; pass `requestId.current` to service function at submit time |

### Estimated Sub-Component Count

**6 step components + 1 constants file + 1 utils file + 1 service function = 9 new files**

---

## 4. Chat.tsx (1,329 lines)

### Logical Sections to Extract

Chat already has near-component-quality inline function definitions. The main work is lifting them out with clean interfaces.

**Inline components to extract:**

| Current Inline | Extract To | Est. Lines |
|----------------|-----------|------------|
| `Avatar()` (27 lines) | `src/components/shared/Avatar.tsx` | 30 |
| `ChannelItem()` (104 lines) | `src/components/chat/ChannelItem.tsx` | 110 |
| `ChannelListPanel()` (87 lines) | `src/components/chat/ChannelListPanel.tsx` | 90 |
| `MessageBubble()` (172 lines) | `src/components/chat/MessageBubble.tsx` | 180 |
| `MessageThread()` (475 lines) | `src/components/chat/MessageThread.tsx` | 490 |
| `NewDMModal()` (138 lines) | `src/components/chat/NewDMModal.tsx` | 145 |

**Hooks and utilities to extract:**

| Current Inline | Extract To | Purpose |
|----------------|-----------|---------|
| Message fetch + Realtime + 3s polling logic inside `MessageThread` | `src/hooks/useChatMessages.ts` | deduplication, pagination, subscription |
| File upload handler inside `MessageThread` | `src/hooks/useChatFileUpload.ts` | Supabase storage + message post |
| `normalizeSender()`, `normalizeReply()`, `normalizeMessage()`, `relativeTime()`, `formatMessageTime()`, `formatDateSeparator()`, `channelIcon()` | `src/utils/chatFormatters.ts` | FK polymorphism normalization + display |

### Proposed File Structure

```
src/
  components/
    shared/
      Avatar.tsx
    chat/
      ChannelItem.tsx
      ChannelListPanel.tsx
      MessageBubble.tsx
      MessageThread.tsx
      NewDMModal.tsx
  hooks/
    useChatMessages.ts
    useChatFileUpload.ts
  utils/
    chatFormatters.ts
  pages/
    chat/
      Chat.tsx              (~200 lines: layout shell, channel selection, mobile view toggle)
```

### Shared State Strategy

**Stays in Chat parent:**
- `channels`, `channelsLoading`, `activeChannel`, `mobileView`, `showDMModal`
- `unreadByChannel` (from `useChatUnread` hook — reads Realtime, stays at top level)
- `currentUser`

**Moves to `useChatMessages(channelId)` hook:**
- `messages` array
- `loadingMessages`, `hasMore`
- `fetchMessages()`, `fetchAndMergeNew()`, `handleDeleteMessage()`
- Realtime subscription setup/teardown
- 3s polling interval setup/teardown
- `markRead()` side effect on channel change

**Moves to `useChatFileUpload(channelId)` hook:**
- `uploading` state
- `handleFileUpload(file)` → Supabase storage → POST message

**`MessageThread` receives:**
```ts
interface MessageThreadProps {
  channel: Channel;
  currentUser: User;
  messages: Message[];           // from useChatMessages
  hasMore: boolean;
  onLoadMore: () => void;
  onSend: (text: string, replyTo?: Message) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
  onFileUpload: (file: File) => Promise<void>;
  uploading: boolean;
}
```

**Note:** `MessageThread` is 475 lines even after extraction — it should be further split into `MessageList.tsx` (~200 lines) + `MessageInputBar.tsx` (~150 lines) to stay under 500.

### Extraction Order

1. **`chatFormatters.ts`** — normalize + format utils, zero dependencies
2. **`Avatar`** — used by ChannelItem and MessageBubble, extract first
3. **`ChannelItem`** — used by ChannelListPanel
4. **`ChannelListPanel`** — used by Chat parent
5. **`NewDMModal`** — self-contained, triggered from Chat parent
6. **`MessageBubble`** — used by MessageThread
7. **`useChatMessages`** hook — isolates all polling/Realtime logic
8. **`useChatFileUpload`** hook
9. **`MessageThread`** — now just wires together MessageBubble + input bar
10. **Slim Chat.tsx** — layout shell

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Realtime subscription in `MessageThread` uses a closure over `activeChannel.id` — if channel changes and the component doesn't unmount (React keeps it mounted), old subscriptions leak | HIGH | `useChatMessages` must unsubscribe in its `useEffect` cleanup when `channelId` changes |
| 3s polling `setInterval` + Realtime subscription run simultaneously — deduplication is done by message ID in `fetchAndMergeNew()` — this logic must move into the hook cleanly | MEDIUM | Hook manages both; returns merged deduplicated `messages` array; no dedup logic in components |
| Swipe-to-delete gesture in `ChannelItem` (left swipe on DM channels) uses pointer events and local `swipeX` state — must stay local to the component | LOW | Already a candidate for extraction; swipe state is purely local |
| `normalizeSender()` handles a FK polymorphism (Supabase can return either an array or an object for a join) — this is a fragile runtime type check that must be preserved exactly | MEDIUM | Extract verbatim to `chatFormatters.ts`; add a comment explaining the Supabase FK array behavior |
| File upload posts a message with `file_url` and then `fetchAndMergeNew()` is called — timing-sensitive; the insert may not be visible immediately via Realtime | LOW | `useChatFileUpload` calls `onMessageSent()` callback which triggers a poll |

### Estimated Sub-Component Count

**6 components + 2 hooks + 1 utils file = 9 new files**

---

## Cross-Cutting Concerns

### Shared Constants: `src/constants/nemsis.ts`

Both `EncounterDetail.tsx` and `NewPCREncounter.tsx` contain copies of the same NEMSIS option arrays (CARDIAC_RHYTHMS, SKIN_SIGNS, PUPILS_OPTIONS, CLINICAL_OPTION_VALUES, TYPE_OF_SERVICE_OPTIONS, etc.). These should be extracted **once**, **first**, before touching either component. Approximate size: 600 lines of constant arrays.

### Shared Primitives: Already Queued

`EditField`, `InlineField`, `Field`, `StatCard`, `NEMSISTooltip`, `Avatar`, `DraggableSection` — these are used across multiple god components. They should all go under `src/components/shared/`. Extract them in Step 1 of whichever god component you tackle first.

### Shared Utils

| File | Functions | Used By |
|------|----------|---------|
| `src/utils/vitals.ts` | `gcsTotal()`, `blankVitalsForm()` | EncounterDetail, NewPCREncounter |
| `src/utils/encounterFormatters.ts` | `acuityColor()`, `acuityLabel()`, `statusColor()`, `formatDateTime()`, `dash()` | EncounterDetail |
| `src/utils/incidentFormatters.ts` | `calcDays()`, `formatDeployDate()`, `acuityPillClass()`, `patientInitials()`, `fmtCurrency()` | IncidentDetail |
| `src/utils/chatFormatters.ts` | `normalizeSender()`, `normalizeReply()`, `normalizeMessage()`, `relativeTime()`, `channelIcon()` | Chat |

---

## Recommended Work Order

### Week 1: Foundations (no visible changes)
1. Extract `src/constants/nemsis.ts` — cuts 600 lines from two files immediately
2. Extract all shared utils (`vitals.ts`, `encounterFormatters.ts`, `incidentFormatters.ts`, `chatFormatters.ts`)
3. Extract all shared primitive components (`EditField`, `InlineField`, `Field`, `StatCard`, `NEMSISTooltip`, `Avatar`)
4. Extract `useIncidentData`, `useEncounterData` hooks (data loading only — no mutations yet)

### Week 2: Chat.tsx (lowest risk, cleanest boundaries)
- Extract Chat inline components in order listed above
- Chat is the safest: no DnD, no offline queue, clear prop boundaries

### Week 3: NewPCREncounter.tsx
- Extract step components + `encounterService.createEncounter`
- Medium risk: form state is flat, `set()` side effects are manageable

### Week 4: EncounterDetail.tsx
- Extract sections bottom-up (leaf sections first, then vitals, then notes)
- High risk: NEMSIS warnings prop drilling, InlineField save callbacks

### Week 5: IncidentDetail.tsx
- Extract StatCard wrappers first, then complex cards last
- Highest risk: renderCard() switch + DnD cardOrder coordination

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Largest component (lines) | 2,808 | < 500 |
| Components > 500 lines | 4 | 0 |
| New component files created | 0 | ~47 |
| IncidentDetail.tsx | 2,808 | ~350 |
| EncounterDetail.tsx | 2,566 | ~300 |
| NewPCREncounter.tsx | 1,861 | ~250 |
| Chat.tsx | 1,329 | ~200 |
