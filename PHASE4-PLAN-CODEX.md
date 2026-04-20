# Phase 4 Component Decomposition Plan

Context reviewed:
- `ARCHITECTURE.md`
- `REFACTORING-PLAN.md`
- `src/pages/incidents/IncidentDetail.tsx`
- `src/pages/encounters/EncounterDetail.tsx`
- `src/pages/encounters/NewPCREncounter.tsx`
- `src/pages/chat/Chat.tsx`

Goal: get every page component under ~500 LOC without changing behavior, while preserving the Phase 2 service-layer direction and the Phase 3 shared-UI direction already documented in `REFACTORING-PLAN.md`.

## Cross-cutting rules

1. Move non-page-local primitives out first.
- `IncidentDetail.tsx` still defines `LocationEditField`, `EditField`, `StatCard`, and `SortableCard` inline.
- `EncounterDetail.tsx` still defines `NEMSISTooltip`, `InlineField`, `Field`, `DraggableSection`, `SectionCard`, `VitalsTrendTable`, and `AddVitalsForm` inline.
- `Chat.tsx` already has subcomponents, but they all live in one file.

2. Split “data + actions” from “render tree”.
- Each page should keep route params, top-level navigation, coarse loading/error guards, and a single orchestration hook.
- Realtime subscriptions, RPC hydration, form state machines, drag-order persistence, and storage upload logic should move into feature hooks.

3. Prefer feature-local hooks before adding new contexts.
- These pages are mostly single-route screens. A hook is cheaper than a new React context unless state is passed through 3+ layers or multiple sibling trees need write access.

4. Target shape after Phase 4:
- Parent page: 200-400 LOC
- Heavy child cards/sections: 120-350 LOC
- Hooks: 80-250 LOC
- Shared primitives: 60-220 LOC

---

## 1. `src/pages/incidents/IncidentDetail.tsx`

Current page shape:
- 2,800 LOC.
- One parent owns data loading, localStorage preferences, DnD ordering, contract upload, unit assignment, deployment CRUD, expense CRUD, incident close-out, revenue math, and rendering for 11 card types via `renderCard()`.
- Key state in parent: `incident`, `activeIncidentId`, `incidentUnits`, `allIncidentUnits`, `allUnits`, `encounters`, `marEntries`, `supplyRuns`, `crewDeployments`, `deployments`, `allEmployees`, `expenses`, `compRows`, `reorderRows`, `ics214Rows`, `billingTotal`, `reorderCount`, `cardOrder`, `cardSpans`, `unitFilter`, `encounterSubFilter`, `closingOut`, `showAddDeployment`, `showAddExpense`, `editingDeployId`, `editingRateIuId`, `expenseReceipt`, `expenseNoReceiptReason`.
- Key handlers in parent: `load`, `handleContractUpload`, `saveField`, `demobilizeUnit`, `reassignUnit`, `assignUnit`, `handleEmployeeSelect`, `handleAddDeployment`, `handleDeleteDeployment`, `handleSaveDeployEdit`, `handleDragEnd`, `handleCloseOut`, `generatePayrollReport`.

### Logical sections to extract

1. Incident shell/header
- Incident breadcrumb/status header
- close-out panel (`closingOut`, `closeoutDt`, `handleCloseOut`)
- offline banner and closed banner
- active incident switcher
- unit filter pills derived from `encounters`, `marEntries`, and `supplyRuns`

2. Incident info card
- `incident-info` case
- editable incident fields using `EditField` and `LocationEditField`
- contact blocks
- contract upload/replacement UI
- default-fire toggle (`defaultFireId`, `isDefaultFire`, `toggleDefaultFire`)

3. Units card
- `units` case
- available-unit computation
- `assigningUnit`, `selectedUnitId`, `assignUnit`
- demob/reassign actions

4. Deployments card
- `deployments` case
- merged payroll table backed by `crewDeployments`
- inline deployment edit mode (`editingDeployId`, `editDeployFields`, `handleSaveDeployEdit`)
- add-deployment form (`showAddDeployment`, `deployForm`, `handleEmployeeSelect`, `handleAddDeployment`)

5. Unit revenue card
- `unit-revenue` case
- derived `revenueUnits`, `totalRevenue`, `totalPayroll`, `totalExpenses`, `netRevenue`
- inline contract-rate editing (`editingRateIuId`, `editRateVal`)

6. Expenses card
- `expenses` case
- expense table, signed receipt link, delete action
- add-expense form (`showAddExpense`, `expenseForm`, `expenseReceipt`, `expenseNoReceiptReason`, `expenseSubmitting`)

7. Summary/stat cards
- `encounters`
- `mar`
- `comp-claims`
- `supply-runs`
- `billing-summary`
- `reorder-summary`
- `ics214`

8. Dashboard layout/DnD
- `cardOrder`, `cardSpans`, `getSpan`, `cycleCardSpan`, `handleDragEnd`
- `renderCard()` switch should disappear entirely

### Proposed file structure

```text
src/pages/incidents/
  IncidentDetail.tsx
  hooks/
    useIncidentDetailData.ts
    useIncidentDashboardPrefs.ts
    useIncidentCloseout.ts
  components/
    IncidentDetailHeader.tsx
    IncidentUnitFilterTabs.tsx
    IncidentDashboardGrid.tsx
    IncidentInfoCard.tsx
    UnitsCard.tsx
    DeploymentsCard.tsx
    DeploymentTable.tsx
    AddDeploymentForm.tsx
    UnitRevenueCard.tsx
    ExpensesCard.tsx
    AddExpenseForm.tsx
    EncounterSummaryCard.tsx
    MarSummaryCard.tsx
    CompClaimsCard.tsx
    SupplyRunsCard.tsx
    BillingSummaryCard.tsx
    ReorderSummaryCard.tsx
    Ics214Card.tsx
    IncidentCloseoutPanel.tsx
src/components/incidents/
  EditableIncidentField.tsx
  EditableIncidentLocationField.tsx
  IncidentStatCard.tsx
  SortableDashboardCard.tsx
```

### Shared state strategy

Keep in parent or `useIncidentDetailData()`:
- Route-bound state: `activeIncidentId`
- All fetched datasets and coarse loading flags
- Incident-wide actions that must trigger reloads: `load`, `assignUnit`, `demobilizeUnit`, `reassignUnit`, `handleContractUpload`, `handleCloseOut`
- DnD preferences and persisted card order/span state
- `unitFilter` and `encounterSubFilter`

Move into child-local state:
- `IncidentInfoCard`: none besides local edit UI already handled by extracted field components
- `DeploymentsCard`: `showAddDeployment`, `deployForm`, `deploySubmitting`, `editingDeployId`, `editDeployFields`
- `UnitRevenueCard`: `editingRateIuId`, `editRateVal`
- `ExpensesCard`: `showAddExpense`, `expenseForm`, `expenseReceipt`, `expenseNoReceiptReason`, `expenseSubmitting`

Hook split:
- `useIncidentDetailData(activeIncidentId)` handles the current `load()` body and returns normalized data plus mutations.
- `useIncidentDashboardPrefs(currentUserId)` handles `cardOrder`, `cardSpans`, `getSpan`, `cycleCardSpan`, `handleDragEnd`.
- `useIncidentCloseout(activeIncidentId, incident, assignment)` owns `closingOut`, `closeoutDt`, `handleCloseOut`, `generatePayrollReport`.

No new context needed.

### Extraction order

1. Extract shared primitives with no business logic.
- `EditField`
- `LocationEditField`
- `StatCard`
- `SortableCard`

2. Extract passive summary cards.
- `EncounterSummaryCard`
- `MarSummaryCard`
- `CompClaimsCard`
- `SupplyRunsCard`
- `BillingSummaryCard`
- `ReorderSummaryCard`
- `Ics214Card`

3. Extract `IncidentInfoCard` and `UnitsCard`.
- They depend on straightforward parent actions and minimal derived state.

4. Extract `DeploymentsCard`.
- Highest surface area after `load()`
- Keep actual mutation callbacks in parent/hook first, then push form/edit state down.

5. Extract `ExpensesCard`.
- Similar complexity to deployments but fewer inter-table dependencies.

6. Extract `UnitRevenueCard`.
- Depends on normalized unit/deployment/expense data shape; safest after earlier cards settle.

7. Replace `renderCard()` with a static card registry in `IncidentDashboardGrid`.

8. Move loading logic into `useIncidentDetailData()`.

### Risk assessment

Highest risk:
- Deployment merge logic in `load()` because it joins `incident_units`, `unit_assignments`, `deployment_records`, and `employees` with rate precedence logic.
- Revenue math because it mixes active and released `incident_units`, payroll totals from `crewDeployments`, and expense totals.
- Expense receipt upload because it touches storage and DB insert sequencing.
- Unit filter pills because they are derived from mixed datasets and currently build the pill list from encounter/MAR/supply-run data, not just active units.

Moderate risk:
- DnD order persistence to `user_preferences`
- close-out flow because it mutates incident state and generates the payroll report side effect

Low risk:
- summary cards once their props are normalized

### Estimated output

- Parent `IncidentDetail.tsx`: 250-350 LOC
- New hooks: 3 hooks, 120-220 LOC each
- New components: 12-16 components
- Typical card size:
  - info/units/summary cards: 100-220 LOC
  - deployments/expenses/revenue: 220-380 LOC

---

## 2. `src/pages/encounters/EncounterDetail.tsx`

Current page shape:
- 2,566 LOC.
- Parent owns RPC hydration (`get_encounter_detail`), offline fallback, signed URL generation, section DnD, inline field persistence, NEMSIS validation display, note workflows, status transitions, and a large section switch over `cardOrder`.
- Key state: `enc`, `progressNotes`, `additionalVitals`, `photos`, `procedures`, `consentForms`, `compClaims`, `marEntries`, `showNoteForm`, `noteDraft`, `showSignModal`, `showNotePinModal`, `noteToSign`, `expandedNoteIds`, `showDeleteConfirm`, `showAddVitals`, `crewOptions`, `providerOptions`, `editingMarQtyId`, `editingMarQtyValue`, `showForms`, `cardOrder`, `cardSpans`, `photoSignedUrls`, `formPdfUrls`.
- Key handlers: `saveField`, `handleDragEnd`, `loadNotes`, `saveProgressNote`, `markComplete`, `deleteDraft`, `deleteNote`, `signAndLock`.
- Section ids in current DnD switch: `actions`, `narrative`, `response`, `scene`, `assessment`, `cardiac`, `vitals`, `mar`, `procedures`, `photos`, `transport`, `provider`, `forms`, `notes`.

### Logical sections to extract

1. Encounter shell/header
- back link
- status bar with delete/edit/mark-complete/sign actions
- offline banner
- signed/locked banner
- patient header card

2. Encounter orchestration hook
- everything in the large `useEffect(load)` block
- signed URL generation for `photoSignedUrls` and `formPdfUrls`
- `loadNotes`

3. Shared encounter field primitives
- `InlineField`
- `Field`
- `SectionCard`
- `DraggableSection`
- `NEMSISTooltip`

4. Chart action section
- links to consent/AMA/MAR/procedures/photos/comp claim/edit/NEMSIS export

5. Clinical content sections
- `NarrativeSection`
- `ResponseTimesSection`
- `SceneSection`
- `AssessmentSection`
- `CardiacArrestSection`
- `TransportDispositionSection`
- `ProviderSection`

6. Data list sections
- `VitalsSection` with `VitalsTrendTable` and `AddVitalsForm`
- `MedicationsSection` with MAR qty editing flow
- `ProceduresSection`
- `PhotosSection`
- `FormsDocumentsSection`
- `ProgressNotesSection`

7. Modal/dialog layer
- delete confirmation modal
- PIN modal for sign and lock
- PIN modal for note save/sign
- PIN modal for existing unsigned note sign

### Proposed file structure

```text
src/pages/encounters/
  EncounterDetail.tsx
  hooks/
    useEncounterDetailData.ts
    useEncounterSectionPrefs.ts
    useEncounterActions.ts
  components/detail/
    EncounterHeader.tsx
    EncounterStatusBar.tsx
    EncounterSectionGrid.tsx
    ChartActionsSection.tsx
    NarrativeSection.tsx
    ResponseTimesSection.tsx
    SceneSection.tsx
    AssessmentSection.tsx
    CardiacArrestSection.tsx
    VitalsSection.tsx
    AddVitalsForm.tsx
    VitalsTrendTable.tsx
    MedicationsSection.tsx
    ProceduresSection.tsx
    PhotosSection.tsx
    TransportDispositionSection.tsx
    ProviderSection.tsx
    FormsDocumentsSection.tsx
    ProgressNotesSection.tsx
    EncounterDeleteDraftDialog.tsx
    EncounterSignatureModals.tsx
src/components/encounters/
  EncounterInlineField.tsx
  EncounterField.tsx
  EncounterSectionCard.tsx
  SortableEncounterSection.tsx
  NemsisIssueTooltip.tsx
```

### Shared state strategy

Keep in parent or hooks:
- `enc`, `loading`, `isOfflineData`, `incidentName`
- all fetched collections and signed URL maps
- `saveField`
- NEMSIS derivations from `useNEMSISWarnings(enc)`
- `markComplete`, `deleteDraft`, `signAndLock`, `deleteNote`, `loadNotes`
- `cardOrder`, `cardSpans`, `handleDragEnd`

Move into child-local state:
- `VitalsSection`: `showAddVitals`
- `MedicationsSection`: `editingMarQtyId`, `editingMarQtyValue`
- `FormsDocumentsSection`: `showForms`
- `ProgressNotesSection`: `showNoteForm`, `noteDraft`, `noteSaving`, `expandedNoteIds`

Keep PIN modal state in parent:
- `showSignModal`
- `showNotePinModal`
- `noteToSign`
- `showDeleteConfirm`

Recommended hooks:
- `useEncounterDetailData(id)` for RPC/offline hydration and signed URL generation.
- `useEncounterSectionPrefs(enc?.unit)` for `cardOrder`, `cardSpans`, ambulance vs med-unit defaults, and persistence.
- `useEncounterActions({ id, enc, currentUser })` for `saveField`, `markComplete`, `deleteDraft`, `saveProgressNote`, `deleteNote`, `signAndLock`.

No context required unless `saveField` prop-drilling becomes excessive after extraction. If it does, add a narrow `EncounterDetailContext` only for `{ enc, isLocked, saveField, currentUser }`.

### Extraction order

1. Extract encounter primitives.
- `InlineField`
- `Field`
- `SectionCard`
- `DraggableSection`
- `NEMSISTooltip`
- `VitalsTrendTable`
- `AddVitalsForm`

2. Extract the low-risk display sections.
- `NarrativeSection`
- `ProviderSection`
- `ResponseTimesSection`
- `TransportDispositionSection`

3. Extract `SceneSection`, `AssessmentSection`, `CardiacArrestSection`.
- These are large but mostly declarative `InlineField` composition.

4. Extract `PhotosSection`, `ProceduresSection`, and `FormsDocumentsSection`.

5. Extract `MedicationsSection`.
- It contains the most mutation logic inside a card due to `updateMARQuantity` and inventory adjustment.

6. Extract `ProgressNotesSection`.
- It has collapsible rows, unsigned/signed note transitions, and delete/sign affordances.

7. Move hydration/action logic into hooks.

8. Replace section switch in parent with a section registry map.

### Risk assessment

Highest risk:
- `saveField()` coercion logic for booleans, arrays, numbers, and DOB-driven age recalculation.
- `markComplete()` because it blocks on NEMSIS errors and triggers NEMSIS XML export plus storage upload.
- MAR qty edit flow because it also updates inventory quantities when online.
- RPC hydration because `get_encounter_detail` returns multiple datasets that children will now depend on.

Moderate risk:
- note signing flows across three different PIN modal states
- section-order migration from old saved values (`ama`/`comp` -> `forms`)
- signed URL loading for photos and PDFs

Low risk:
- declarative detail sections once field props are standardized

### Estimated output

- Parent `EncounterDetail.tsx`: 300-420 LOC
- Hooks: 3 hooks, 120-260 LOC each
- New components: 16-20
- Section sizes:
  - pure field sections: 80-180 LOC
  - meds/notes/forms/vitals: 180-320 LOC

---

## 3. `src/pages/encounters/NewPCREncounter.tsx`

Current page shape:
- 1,861 LOC.
- `PCRFormInner()` owns query-param resolution, assignment-prefill, employee/provider loading, one massive `form` object, NEMSIS warning projection, geolocation, GCS calculation, payload construction, offline queueing, and a 6-step `renderStep()` switch.
- Key state: `assignmentApplied`, `step`, `submitting`, `employees`, `form`.
- Key helpers: `set`, `handleGetLocation`, `gcsTotal`, `handleSubmit`.
- Current steps:
  - step 0: incident info, timestamps, delays
  - step 1: patient identity and scene
  - step 2: dispatch/impression/acuity/cardiac arrest
  - step 3: vitals/GCS
  - step 4: transport/disposition/documentation
  - step 5: provider/narrative/review/save

### Logical sections to extract

1. Form-state hook
- the giant `form` state object
- `set()`
- derived values like GCS and NEMSIS warning projection
- assignment prefill and incident name resolution

2. Provider-options hook
- employee preload from cache + `loadList<Employee>()`

3. Step components
- `IncidentTimesStep`
- `PatientSceneStep`
- `AssessmentCardiacStep`
- `VitalsStep`
- `TransportDispositionStep`
- `ProviderNarrativeReviewStep`

4. Wizard shell
- header
- step tabs
- next/previous navigation
- step-content host

5. Extract repeated field groups
- delay multi-select list renderer
- hospital capability checklist
- cardiac-arrest conditional block
- review summary card

### Proposed file structure

```text
src/pages/encounters/
  NewPCREncounter.tsx
  hooks/
    usePCRForm.ts
    usePCRProviders.ts
  components/pcr/
    PCRWizardShell.tsx
    PCRStepTabs.tsx
    IncidentTimesStep.tsx
    PatientSceneStep.tsx
    AssessmentCardiacStep.tsx
    CardiacArrestFields.tsx
    VitalsStep.tsx
    TransportDispositionStep.tsx
    HospitalCapabilityChecklist.tsx
    ProviderNarrativeReviewStep.tsx
    PCRReviewSummary.tsx
```

### Shared state strategy

Keep in parent or `usePCRForm()`:
- `step`, `submitting`
- entire `form`
- `set`
- `nemsisWarnings`
- `gcsTotal`
- `handleGetLocation`
- `handleSubmit`

Move into child-local state:
- none required initially; each step should stay controlled by the central form hook

Recommended hook split:
- `usePCRForm({ unitParam, incidentParam, incidentNameParam, crnParam, assignment })`
  - owns the whole form object
  - applies assignment defaults
  - computes age from DOB
  - computes NEMSIS warnings
  - resolves incident id on submit
  - performs online/offline save
- `usePCRProviders()` loads `employees`

No context needed. This is a classic controlled wizard; prop drilling is acceptable if each step receives `{ form, set, warnings }`.

### Extraction order

1. Extract `usePCRProviders()` and `usePCRForm()`.
- This removes most non-JSX logic from `PCRFormInner()` immediately.

2. Extract step components in current render order.
- `IncidentTimesStep`
- `PatientSceneStep`
- `AssessmentCardiacStep`
- `VitalsStep`
- `TransportDispositionStep`
- `ProviderNarrativeReviewStep`

3. Extract embedded subsections with heavy conditionals.
- `CardiacArrestFields`
- `HospitalCapabilityChecklist`
- `PCRReviewSummary`

4. Extract wizard chrome into `PCRWizardShell` and `PCRStepTabs`.

### Risk assessment

Highest risk:
- payload mapping in `handleSubmit()` because the form keys do not match DB field names 1:1 (`dob` -> `patient_dob` semantics, `possible_injury`, array coercions, hospital capability string joining, incident UUID resolution).
- assignment/URL prefill timing (`assignmentApplied`, `incidentParam`, `incidentNameParam`, `assignment.incidentUnit?.incident_id`)
- DOB-driven age auto-calculation and GCS total derivation

Moderate risk:
- NEMSIS warnings projection because it remaps form keys before calling `useNEMSISWarnings`
- transport/documentation conditional UI

Low risk:
- step tabs and navigation shell

### Estimated output

- Parent `NewPCREncounter.tsx`: 180-280 LOC
- Hooks: 2 hooks, 100-220 LOC each
- New components: 8-10
- Step components: 120-260 LOC each

---

## 4. `src/pages/chat/Chat.tsx`

Current page shape:
- 1,329 LOC.
- File already contains multiple internal components: `Avatar`, `ChannelItem`, `ChannelListPanel`, `MessageBubble`, `MessageThread`, `NewDMModal`, `ChatPage`.
- Main remaining problem is file-level sprawl and mixed concerns: channel loading, unread integration, realtime subscriptions, polling fallback, file upload, message send/delete, and DM creation all live together.
- Key page state: `channels`, `activeChannel`, `channelsLoading`, `showDMModal`, `mobileView`.
- Key thread state: `messages`, `loading`, `loadingMore`, `hasMore`, `input`, `sending`, `replyTo`, `uploading`.
- Key thread functions: `loadMessages`, `fetchAndMergeNew`, `handleLoadMore`, `handleSend`, `handleFileSelect`, `handleDeleteMessage`.

### Logical sections to extract

1. Chat page container
- desktop/mobile split view
- channel selection/back behavior
- DM create/delete handling

2. Channel list module
- `ChannelListPanel`
- `ChannelItem`
- channel grouping by type (`company`, `incident`, `unit`, `direct`)

3. Message thread module
- header
- grouped timeline renderer
- reply preview composer
- load-more button
- composer with textarea/file button/send button

4. Message thread hook
- initial load/reset on channel change
- mark-as-read calls
- realtime subscription
- polling fallback every 3 seconds
- pagination
- send/upload/delete logic

5. Message bubble/presentation
- `MessageBubble`
- image lightbox
- swipe-to-delete
- reply affordance

6. New DM modal
- roster load
- search/filter/select chips
- DM creation

### Proposed file structure

```text
src/pages/chat/
  Chat.tsx
  hooks/
    useChatChannels.ts
    useChatThread.ts
  components/
    ChatShell.tsx
    ChannelListPanel.tsx
    ChannelSection.tsx
    ChannelItem.tsx
    MessageThread.tsx
    MessageThreadHeader.tsx
    MessageList.tsx
    MessageComposer.tsx
    MessageBubble.tsx
    Avatar.tsx
    ReplyPreview.tsx
    NewDMModal.tsx
```

### Shared state strategy

Keep in parent or `useChatChannels()`:
- `channels`, `activeChannel`, `channelsLoading`, `showDMModal`, `mobileView`
- unread-map integration from `useChatUnread`
- `handleSelectChannel`, `handleBack`, `handleDMCreated`, `handleDeleteDM`

Move into `useChatThread(channel, employeeId)`:
- `messages`, `loading`, `loadingMore`, `hasMore`, `input`, `sending`, `replyTo`, `uploading`
- `loadMessages`, `fetchAndMergeNew`, `handleLoadMore`, `handleSend`, `handleFileSelect`, `handleDeleteMessage`

Move into child-local state:
- `Avatar`: `imgErr`
- `ChannelItem`: swipe state
- `MessageBubble`: `lightboxOpen`, swipe state
- `NewDMModal`: `employees`, `search`, `selected`, `loading`, `creating`

No context needed.

### Extraction order

1. Split pure presentational pieces into files.
- `Avatar`
- `ChannelItem`
- `ChannelListPanel`
- `MessageBubble`
- `NewDMModal`

2. Extract `useChatThread()`.
- This is the biggest logic win because it isolates realtime, polling, upload, and composer state.

3. Extract `MessageThread` into `MessageThread.tsx` plus `MessageComposer.tsx` and `MessageList.tsx`.

4. Extract `useChatChannels()`.
- It wraps initial `ensure-channels` fetch, mobile/desktop selection behavior, and DM create/delete updates.

### Risk assessment

Highest risk:
- duplicate-message prevention across POST response + realtime + polling
- mark-as-read timing when switching channels or receiving messages from others
- file upload flow because it mixes direct storage upload with message creation

Moderate risk:
- mobile `list/messages` navigation state
- swipe-to-delete interactions on both channel items and message bubbles

Low risk:
- presentational channel grouping and empty states

### Estimated output

- Parent `Chat.tsx`: 150-220 LOC
- Hooks: 2 hooks, 100-220 LOC each
- New components: 10-12
- Largest non-hook child: `MessageThread.tsx` around 220-320 LOC

---

## Recommended implementation sequence across all four pages

1. Extract shared primitives first.
- incident field/card/DnD primitives
- encounter field/card/DnD/NEMSIS primitives

2. Extract passive display cards/sections next.
- incident summary cards
- encounter static detail sections
- chat file-level presentational components

3. Introduce feature hooks.
- `useIncidentDetailData`
- `useEncounterDetailData`
- `usePCRForm`
- `useChatThread`

4. Extract the mutation-heavy sections after hooks exist.
- deployments, expenses, revenue
- MAR, notes, vitals
- chat composer/upload/realtime thread

5. Remove switch-based rendering from parents.
- replace with section/card registries plus explicit prop contracts

6. Finish with testing and visual diff passes.

---

## Highest-value shared abstractions to create during Phase 4

- `SortableDashboardCard` and `SortableEncounterSection`
- `EncounterInlineField` / `EditableIncidentField`
- `useDashboardCardPrefs(resourceKey, defaultOrder, defaultSpans)`
- `useSignedStorageUrls()` for encounter photos/forms if similar patterns appear elsewhere

---

## Suggested line-count target after decomposition

| Page | Current LOC | Target parent LOC | Expected child count |
|---|---:|---:|---:|
| `IncidentDetail.tsx` | 2800 | 250-350 | 12-16 |
| `EncounterDetail.tsx` | 2566 | 300-420 | 16-20 |
| `NewPCREncounter.tsx` | 1861 | 180-280 | 8-10 |
| `Chat.tsx` | 1329 | 150-220 | 10-12 |

If implemented in this order, the first pass should reduce the four page files by roughly 6,000+ LOC without changing routes or data contracts.
