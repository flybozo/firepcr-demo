
import { Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoadingSkeleton } from '@/components/ui'
import { useMARForm } from './useMARForm'
import { EncounterPickerSection } from './components/EncounterPickerSection'
import { EntryTypeToggle } from './components/EntryTypeToggle'
import { CSWarningBanner } from './components/CSWarningBanner'
import { MedicationSection } from './components/MedicationSection'
import { PatientSection } from './components/PatientSection'
import { ProviderSection } from './components/ProviderSection'

function MARNewFormInner() {
  const navigate = useNavigate()
  const {
    form, set,
    entryType, setEntryType,
    daysSupply, setDaysSupply,
    providerPin, setProviderPin,
    witnessPin, setWitnessPin,
    submitting,
    isCS, hasUnitInventory, isProviderMatch, isSelfOrder, requiresProviderAuth,
    isOffline,
    dispensers, unitInventory, filteredFormulary,
    providerEmployees, witnessOptions,
    encounterOptions, loadingInventory,
    setRouteAutoSuggested, setDosageAutoSuggested,
    handleUnitChange, handleItemSelect, handleEncounterSelect, handleSubmit,
    encounterId, unitParam, patientNameParam,
  } = useMARForm()

  return (
    <div className="min-h-screen bg-gray-950 text-white mt-8 md:mt-0">
      <div className="max-w-lg mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-white text-sm">← Back</button>
          <div>
            <h1 className="text-xl font-bold">New MAR Entry</h1>
            <p className="text-xs text-gray-500">Medication Administration Record</p>
          </div>
        </div>

        {isOffline && (
          <div className="mb-4 bg-amber-950/60 border border-amber-700 rounded-xl px-4 py-3 text-amber-300 text-sm flex items-center gap-2">
            📶 <span>You're offline. This entry will be saved locally and synced when you reconnect. Inventory deduction will be applied on sync.</span>
          </div>
        )}

        {!encounterId && (
          <EncounterPickerSection
            encounterOptions={encounterOptions}
            formUnit={form.med_unit}
            onSelect={handleEncounterSelect}
          />
        )}

        {encounterId && (
          <div className="bg-blue-950 border border-blue-700 rounded-xl p-3 mb-4 flex items-center gap-3">
            <span className="text-blue-400 text-lg">🔗</span>
            <div>
              <p className="text-blue-300 font-semibold text-sm">Linked Encounter</p>
              <p className="text-blue-400 text-xs font-mono">{encounterId}</p>
            </div>
          </div>
        )}

        <EntryTypeToggle entryType={entryType} onChange={setEntryType} />

        {isCS && <CSWarningBanner lotNumber={form.lot_number} expDate={form.exp_date} />}

        <div className="bg-gray-900 rounded-xl p-4 space-y-4">
          <MedicationSection
            form={form}
            unitInventory={unitInventory}
            filteredFormulary={filteredFormulary}
            loadingInventory={loadingInventory}
            hasUnitInventory={hasUnitInventory}
            entryType={entryType}
            daysSupply={daysSupply}
            unitParam={unitParam}
            onItemSelect={handleItemSelect}
            onUnitChange={handleUnitChange}
            set={set}
            setDaysSupply={setDaysSupply}
            setRouteAutoSuggested={setRouteAutoSuggested}
            setDosageAutoSuggested={setDosageAutoSuggested}
          />

          <PatientSection
            form={form}
            encounterId={encounterId}
            patientNameParam={patientNameParam}
            set={set}
          />

          <ProviderSection
            form={form}
            isCS={isCS}
            isProviderMatch={isProviderMatch}
            isSelfOrder={isSelfOrder}
            requiresProviderAuth={requiresProviderAuth}
            dispensers={dispensers}
            providerEmployees={providerEmployees}
            witnessOptions={witnessOptions}
            providerPin={providerPin}
            witnessPin={witnessPin}
            set={set}
            onProviderPinChange={setProviderPin}
            onWitnessPinChange={setWitnessPin}
          />
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full mt-6 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-4 rounded-xl transition-colors text-lg"
        >
          {submitting ? 'Recording...' : `💾 Record ${entryType}${isCS ? ' (CS)' : ''}`}
        </button>

        <p className="text-center text-gray-600 text-xs mt-4 pb-8">
          All medication administrations are permanently logged.
        </p>
      </div>
    </div>
  )
}

export default function MARNewPage() {
  return (
    <Suspense fallback={<LoadingSkeleton fullPage />}>
      <MARNewFormInner />
    </Suspense>
  )
}
